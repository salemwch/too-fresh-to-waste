import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { LeaderboardCacheService } from '../../leaderboard/leaderboard-cache.service';
import { NotificationService } from '../../notifications/services/notification.service';
import {
  NotificationTrigger,
  NotificationType,
} from '../../notifications/types/notification.types';
import { RedisService } from '../../redis/redis.service';
import { LoyaltyAccount, LoyaltyAccountDocument } from '../schemas/loyalty-account.schema';

const THROTTLE_PREFIX = 'leaderboard:throttle:under_attack:';
const THROTTLE_TTL_SECONDS = 3600;
const POINTS_GAP_THRESHOLD = 50;

@Injectable()
export class LeaderboardNotificationService {
  private readonly logger = new Logger(LeaderboardNotificationService.name);

  constructor(
    private readonly leaderboardCache: LeaderboardCacheService,
    private readonly notificationService: NotificationService,
    private readonly redisService: RedisService,
    @InjectModel(LoyaltyAccount.name)
    private readonly loyaltyModel: Model<LoyaltyAccountDocument>,
  ) {}

  async checkRankChangeNotifications(
    userId: string,
    newTotalPoints: number,
    previousRank: number | null,
  ): Promise<void> {
    try {
      const client = await this.redisService.getClient();

      const userRank = await this.leaderboardCache.getLoyaltyRankData(userId);
      if (!userRank) {
        return;
      }

      const top = await this.leaderboardCache.getTopLoyalty(1, 0);
      if (!top || top.length === 0) {
        return;
      }

      const currentChampion = top[0]!;

      // User IS the champion
      if (currentChampion.userId === userId) {
        // Only send "Dethroned" if user was NOT already #1 before the score update
        if (userRank.rank === 1 && previousRank !== 1) {
          const formerTop = await this.leaderboardCache.getTopLoyalty(2, 0);
          if (formerTop && formerTop.length >= 2) {
            const formerChampion = formerTop[1]!;
            if (formerChampion.userId !== userId) {
              const challengerName = await this.getDisplayName(userId);
              await this.sendDethroned(formerChampion.userId, challengerName);
              await this.leaderboardCache.invalidateChampionCache();
            }
          }
        }
        return;
      }

      // User is NOT the champion — check if close enough to trigger "Under Attack"
      const gap = currentChampion.totalPoints - newTotalPoints;
      if (gap <= POINTS_GAP_THRESHOLD && gap >= 0) {
        const throttleKey = `${THROTTLE_PREFIX}${userId}`;
        const throttled = await client.get(throttleKey);

        if (!throttled) {
          const challengerName = await this.getDisplayName(userId);
          await this.sendUnderAttack(currentChampion.userId, challengerName);
          await client.set(throttleKey, '1', { EX: THROTTLE_TTL_SECONDS });
        }
      }
    } catch (error) {
      this.logger.warn(
        `Leaderboard notification check failed (non-blocking): ${(error as Error).message}`,
      );
    }
  }

  private async sendUnderAttack(targetUserId: string, challengerName: string): Promise<void> {
    await this.notificationService.sendTriggeredNotification(
      NotificationTrigger.LEADERBOARD_UNDER_ATTACK,
      {
        userId: targetUserId,
        variables: { challengerName },
      },
      {
        type: NotificationType.PUSH,
        target: { userId: targetUserId },
        payload: {
          title: 'Your Crown is Under Attack! 🚨',
          body: `Look out! ${challengerName} is right behind you and about to take your crown. Log in now to protect your streak!`,
          clickAction: 'OPEN_LEADERBOARD',
        },
        priority: 'high',
      },
    );
    this.logger.log(`Sent UNDER_ATTACK notification to user ${targetUserId}`);
  }

  private async sendDethroned(targetUserId: string, challengerName: string): Promise<void> {
    await this.notificationService.sendTriggeredNotification(
      NotificationTrigger.LEADERBOARD_DETHRONED,
      {
        userId: targetUserId,
        variables: { challengerName },
      },
      {
        type: NotificationType.PUSH,
        target: { userId: targetUserId },
        payload: {
          title: "You've Been Dethroned! 👑",
          body: `You've been dethroned! ${challengerName} is now the #1 King. Tap to reclaim your throne!`,
          clickAction: 'OPEN_LEADERBOARD',
        },
        priority: 'high',
      },
    );
    this.logger.log(`Sent DETHRONED notification to user ${targetUserId}`);
  }

  async getDisplayName(userId: string): Promise<string> {
    try {
      const account = await this.loyaltyModel
        .findOne(
          { userId: new Types.ObjectId(userId) },
          { 'leaderboardConsent.showRealName': 1, userId: 1 },
        )
        .lean();

      if (!account?.leaderboardConsent?.showRealName) {
        return 'An anonymous challenger';
      }

      const userInfo = await this.loyaltyModel.aggregate<{
        userInfo?: { firstName?: string };
      }>([
        { $match: { userId: new Types.ObjectId(userId) } },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            pipeline: [{ $project: { firstName: 1 } }],
            as: 'userInfo',
          },
        },
        { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
      ]);

      return userInfo[0]?.userInfo?.firstName ?? 'A challenger';
    } catch {
      return 'A challenger';
    }
  }
}
