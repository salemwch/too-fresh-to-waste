import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { OrderStatus, PaymentStatus } from '@foodwaste/shared';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { LEADERBOARD_PARTICIPANT_FILTER } from '../loyalty/constants/leaderboard-ranking';
import { LoyaltyAccount, LoyaltyAccountDocument } from '../loyalty/schemas/loyalty-account.schema';
import { RedisService } from '../redis/redis.service';

const MERCHANT_SCORES = 'leaderboard:merchant:scores';
const LOYALTY_SCORES = 'leaderboard:loyalty:scores';
const MERCHANT_WARMED = 'leaderboard:merchant:warmed';
const LOYALTY_WARMED = 'leaderboard:loyalty:warmed';
const WARM_TTL_SECONDS = 3600;
const CHAMPION_CACHE_KEY = 'leaderboard:loyalty:champion';
const CHAMPION_TTL_SECONDS = 300;

@Injectable()
export class LeaderboardCacheService implements OnModuleInit {
  private readonly logger = new Logger(LeaderboardCacheService.name);

  constructor(
    private readonly redisService: RedisService,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(LoyaltyAccount.name)
    private readonly loyaltyModel: Model<LoyaltyAccountDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await Promise.all([this.warmMerchantCache(), this.warmLoyaltyCache()]);
      this.logger.log('Leaderboard caches warmed successfully');
    } catch (error) {
      this.logger.warn(
        `Cache warmup failed (will rebuild on first read): ${(error as Error).message}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Merchant leaderboard — ranked by meals (bags) saved
  // ---------------------------------------------------------------------------

  async warmMerchantCache(): Promise<void> {
    const client = await this.redisService.getClient();

    const scores = await this.orderModel
      .aggregate<{ _id: Types.ObjectId; mealsSaved: number }>([
        {
          $match: {
            status: { $in: [OrderStatus.PICKED_UP, OrderStatus.COMPLETED] },
            paymentStatus: PaymentStatus.PAID,
            isDeleted: { $ne: true },
          },
        },
        { $project: { merchantId: 1, bagCount: { $sum: '$items.quantity' } } },
        { $group: { _id: '$merchantId', mealsSaved: { $sum: '$bagCount' } } },
      ])
      .exec();

    if (scores.length === 0) {
      await client.set(MERCHANT_WARMED, '1', { EX: WARM_TTL_SECONDS });
      return;
    }

    const members = scores.map(s => ({
      score: s.mealsSaved,
      value: s._id.toString(),
    }));

    await client.del(MERCHANT_SCORES);
    await client.zAdd(MERCHANT_SCORES, members);
    await client.set(MERCHANT_WARMED, '1', { EX: WARM_TTL_SECONDS });

    this.logger.log(`Merchant cache warmed with ${members.length} entries`);
  }

  async warmLoyaltyCache(): Promise<void> {
    const client = await this.redisService.getClient();

    const accounts = await this.loyaltyModel
      .find(LEADERBOARD_PARTICIPANT_FILTER, { userId: 1, totalPoints: 1 })
      .lean()
      .exec();

    if (accounts.length === 0) {
      await client.set(LOYALTY_WARMED, '1', { EX: WARM_TTL_SECONDS });
      return;
    }

    const members = accounts.map(a => ({
      score: a.totalPoints,
      value: a.userId.toString(),
    }));

    await client.del(LOYALTY_SCORES);
    await client.zAdd(LOYALTY_SCORES, members);
    await client.set(LOYALTY_WARMED, '1', { EX: WARM_TTL_SECONDS });

    this.logger.log(`Loyalty cache warmed with ${members.length} entries`);
  }

  private async ensureWarmed(warmKey: string, warmFn: () => Promise<void>): Promise<boolean> {
    try {
      const client = await this.redisService.getClient();
      const flag = await client.get(warmKey);
      if (flag) {
        return true;
      }
      await warmFn();
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Merchant writes
  // ---------------------------------------------------------------------------

  async incrementMerchantScore(merchantId: string, bags: number): Promise<void> {
    try {
      const client = await this.redisService.getClient();
      await client.zIncrBy(MERCHANT_SCORES, bags, merchantId);
    } catch (error) {
      this.logger.warn(`Failed to update merchant cache: ${(error as Error).message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Loyalty writes
  // ---------------------------------------------------------------------------

  async setLoyaltyScore(userId: string, totalPoints: number): Promise<void> {
    try {
      const client = await this.redisService.getClient();
      await client.zAdd(LOYALTY_SCORES, [{ score: totalPoints, value: userId }]);
    } catch (error) {
      this.logger.warn(`Failed to update loyalty cache: ${(error as Error).message}`);
    }
  }

  async removeLoyaltyEntry(userId: string): Promise<void> {
    try {
      const client = await this.redisService.getClient();
      await client.zRem(LOYALTY_SCORES, userId);
    } catch (error) {
      this.logger.warn(`Failed to remove loyalty cache entry: ${(error as Error).message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Merchant reads
  // ---------------------------------------------------------------------------

  async getTopMerchants(
    limit: number,
  ): Promise<{ merchantId: string; mealsSaved: number }[] | null> {
    const warmed = await this.ensureWarmed(MERCHANT_WARMED, async () => {
      await this.warmMerchantCache();
    });
    if (!warmed) {
      return null;
    }

    try {
      const client = await this.redisService.getClient();
      const results = await client.zRangeWithScores(MERCHANT_SCORES, '+inf', '-inf', {
        BY: 'SCORE',
        REV: true,
        LIMIT: { offset: 0, count: limit },
      });

      return results.map(r => ({
        merchantId: r.value,
        mealsSaved: r.score,
      }));
    } catch {
      return null;
    }
  }

  async getMerchantRankData(merchantId: string): Promise<{
    rank: number;
    mealsSaved: number;
    totalMerchants: number;
  } | null> {
    const warmed = await this.ensureWarmed(MERCHANT_WARMED, async () => {
      await this.warmMerchantCache();
    });
    if (!warmed) {
      return null;
    }

    try {
      const client = await this.redisService.getClient();
      const [revRank, score, total] = await Promise.all([
        client.zRevRank(MERCHANT_SCORES, merchantId),
        client.zScore(MERCHANT_SCORES, merchantId),
        client.zCard(MERCHANT_SCORES),
      ]);

      if (revRank === null || score === null) {
        return { rank: 0, mealsSaved: 0, totalMerchants: total };
      }

      return {
        rank: revRank + 1,
        mealsSaved: score,
        totalMerchants: total,
      };
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Loyalty reads
  // ---------------------------------------------------------------------------

  async getTopLoyalty(
    limit: number,
    offset: number,
  ): Promise<{ userId: string; totalPoints: number }[] | null> {
    const warmed = await this.ensureWarmed(LOYALTY_WARMED, async () => {
      await this.warmLoyaltyCache();
    });
    if (!warmed) {
      return null;
    }

    try {
      const client = await this.redisService.getClient();
      const results = await client.zRangeWithScores(LOYALTY_SCORES, '+inf', '-inf', {
        BY: 'SCORE',
        REV: true,
        LIMIT: { offset, count: limit },
      });

      return results.map(r => ({
        userId: r.value,
        totalPoints: r.score,
      }));
    } catch {
      return null;
    }
  }

  async getLoyaltyRankData(userId: string): Promise<{ rank: number; totalPoints: number } | null> {
    try {
      const client = await this.redisService.getClient();
      const [revRank, score] = await Promise.all([
        client.zRevRank(LOYALTY_SCORES, userId),
        client.zScore(LOYALTY_SCORES, userId),
      ]);

      if (revRank === null || score === null) {
        return null;
      }

      return { rank: revRank + 1, totalPoints: score };
    } catch {
      return null;
    }
  }

  async getLoyaltyTotal(): Promise<number | null> {
    try {
      const client = await this.redisService.getClient();
      return await client.zCard(LOYALTY_SCORES);
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Loyalty neighborhood — ±N users around the caller
  // ---------------------------------------------------------------------------

  async getLoyaltyNeighborhood(
    userId: string,
    radius = 5,
  ): Promise<{
    entries: { userId: string; totalPoints: number }[];
    rank: number;
    total: number;
  } | null> {
    try {
      const client = await this.redisService.getClient();
      const [revRank, total] = await Promise.all([
        client.zRevRank(LOYALTY_SCORES, userId),
        client.zCard(LOYALTY_SCORES),
      ]);

      if (revRank === null) {
        return null;
      }

      const rank = revRank + 1;
      const start = Math.max(0, revRank - radius);
      const stop = Math.min(total - 1, revRank + radius);

      const results = await client.zRangeWithScores(LOYALTY_SCORES, start, stop, { REV: true });

      return {
        entries: results.map(r => ({ userId: r.value, totalPoints: r.score })),
        rank,
        total,
      };
    } catch (error) {
      this.logger.warn(`Failed to get loyalty neighborhood: ${(error as Error).message}`);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Champion cache — lightweight #1 user
  // ---------------------------------------------------------------------------

  async getCachedChampion(): Promise<string | null> {
    try {
      const client = await this.redisService.getClient();
      return await client.get(CHAMPION_CACHE_KEY);
    } catch {
      return null;
    }
  }

  async setCachedChampion(json: string): Promise<void> {
    try {
      const client = await this.redisService.getClient();
      await client.set(CHAMPION_CACHE_KEY, json, { EX: CHAMPION_TTL_SECONDS });
    } catch (error) {
      this.logger.warn(`Failed to set champion cache: ${(error as Error).message}`);
    }
  }

  async invalidateChampionCache(): Promise<void> {
    try {
      const client = await this.redisService.getClient();
      await client.del(CHAMPION_CACHE_KEY);
    } catch (error) {
      this.logger.warn(`Failed to invalidate champion cache: ${(error as Error).message}`);
    }
  }
}
