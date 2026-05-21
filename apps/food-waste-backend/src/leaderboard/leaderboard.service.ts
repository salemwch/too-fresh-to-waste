import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { OrderStatus, PaymentStatus } from '@foodwaste/shared';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { LeaderboardCacheService } from './leaderboard-cache.service';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  profileImage: string | null;
  isAnonymous: boolean;
  mealsSaved: number;
}

export interface MerchantRankResponse {
  rank: number;
  mealsSaved: number;
  totalMerchants: number;
  percentile: number;
}

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly cacheService: LeaderboardCacheService,
  ) {}

  /** Sum of items.quantity across picked-up orders = bags saved for one merchant */
  async getMealsSaved(merchantId: string): Promise<number> {
    const result = await this.orderModel
      .aggregate([
        {
          $match: {
            merchantId: new Types.ObjectId(merchantId),
            status: OrderStatus.PICKED_UP,
            paymentStatus: PaymentStatus.PAID,
            isDeleted: { $ne: true },
          },
        },
        { $project: { bagCount: { $sum: '$items.quantity' } } },
        { $group: { _id: null, total: { $sum: '$bagCount' } } },
      ])
      .exec();

    return (result[0] as { total?: number } | undefined)?.total ?? 0;
  }

  /** Build aggregate: bags saved per merchant (sum of items.quantity, only picked-up orders) */
  private async allMerchantScores(): Promise<{ merchantId: string; mealsSaved: number }[]> {
    const results = await this.orderModel
      .aggregate([
        {
          $match: {
            status: OrderStatus.PICKED_UP,
            paymentStatus: PaymentStatus.PAID,
            isDeleted: { $ne: true },
          },
        },
        { $project: { merchantId: 1, bagCount: { $sum: '$items.quantity' } } },
        {
          $group: {
            _id: '$merchantId',
            mealsSaved: { $sum: '$bagCount' },
          },
        },
        { $sort: { mealsSaved: -1 } },
      ])
      .exec();

    return results.map(r => ({
      merchantId: String(r._id),
      mealsSaved: r.mealsSaved as number,
    }));
  }

  async getMerchantRank(merchantId: string): Promise<MerchantRankResponse> {
    const cached = await this.cacheService.getMerchantRankData(merchantId);
    if (cached) {
      const { rank, mealsSaved, totalMerchants } = cached;
      if (totalMerchants === 0) {
        return { rank: 0, mealsSaved: 0, totalMerchants: 0, percentile: 0 };
      }
      const percentile =
        totalMerchants === 1
          ? 100
          : rank > 0
            ? Math.round((1 - (rank - 1) / (totalMerchants - 1)) * 100)
            : 0;
      return { rank, mealsSaved, totalMerchants, percentile };
    }

    this.logger.warn('Merchant rank cache miss — falling back to aggregation');
    const scores = await this.allMerchantScores();
    const myScore = scores.find(s => s.merchantId === merchantId);
    const mealsSaved = myScore?.mealsSaved ?? 0;
    const totalMerchants = scores.length;

    if (totalMerchants === 0) {
      return { rank: 0, mealsSaved: 0, totalMerchants: 0, percentile: 0 };
    }

    const rank = myScore ? 1 + scores.filter(s => s.mealsSaved > mealsSaved).length : 0;
    const percentile =
      totalMerchants === 1
        ? 100
        : rank > 0
          ? Math.round((1 - (rank - 1) / (totalMerchants - 1)) * 100)
          : 0;

    return { rank, mealsSaved, totalMerchants, percentile };
  }

  async getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
    const cached = await this.cacheService.getTopMerchants(limit);
    if (cached && cached.length > 0) {
      return this.hydrateMerchantEntries(cached);
    }

    this.logger.warn('Merchant leaderboard cache miss — falling back to aggregation');
    return this.getLeaderboardFromDb(limit);
  }

  private async hydrateMerchantEntries(
    scores: { merchantId: string; mealsSaved: number }[],
  ): Promise<LeaderboardEntry[]> {
    const ids = scores.map(s => new Types.ObjectId(s.merchantId));
    const users = await this.userModel
      .find(
        { _id: { $in: ids } },
        { firstName: 1, lastName: 1, profileImage: 1, avatar: 1, leaderboardAnonymous: 1 },
      )
      .lean()
      .exec();

    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    return scores.map((s, i) => {
      const u = userMap.get(s.merchantId);
      const isAnonymous =
        (u as { leaderboardAnonymous?: boolean } | undefined)?.leaderboardAnonymous === true;
      const displayName = isAnonymous
        ? 'Anonymous'
        : u
          ? `${(u as { firstName?: string }).firstName ?? ''} ${(u as { lastName?: string }).lastName ?? ''}`.trim() ||
            'Merchant'
          : 'Merchant';
      const profileImage = isAnonymous
        ? null
        : ((u as { profileImage?: string }).profileImage ??
          (u as { avatar?: string }).avatar ??
          null);

      return {
        rank: i + 1,
        userId: s.merchantId,
        displayName,
        profileImage,
        isAnonymous,
        mealsSaved: s.mealsSaved,
      };
    });
  }

  private async getLeaderboardFromDb(limit: number): Promise<LeaderboardEntry[]> {
    interface LeaderboardAgg {
      _id: Types.ObjectId;
      mealsSaved: number;
      user: Array<{
        firstName: string;
        lastName: string;
        profileImage?: string;
        avatar?: string;
        leaderboardAnonymous?: boolean | null;
      }>;
    }

    const results = await this.orderModel
      .aggregate<LeaderboardAgg>([
        {
          $match: {
            status: OrderStatus.PICKED_UP,
            paymentStatus: PaymentStatus.PAID,
            isDeleted: { $ne: true },
          },
        },
        { $project: { merchantId: 1, bagCount: { $sum: '$items.quantity' } } },
        {
          $group: {
            _id: '$merchantId',
            mealsSaved: { $sum: '$bagCount' },
          },
        },
        { $sort: { mealsSaved: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            pipeline: [
              {
                $project: {
                  _id: 0,
                  firstName: 1,
                  lastName: 1,
                  profileImage: 1,
                  avatar: 1,
                  leaderboardAnonymous: 1,
                },
              },
            ],
            as: 'user',
          },
        },
      ])
      .exec();

    return results.map((r, i) => {
      const u = r.user[0];
      const isAnonymous = u?.leaderboardAnonymous === true;
      const displayName = isAnonymous
        ? 'Anonymous'
        : u
          ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'Merchant'
          : 'Merchant';
      const profileImage = isAnonymous ? null : (u?.profileImage ?? u?.avatar ?? null);

      return {
        rank: i + 1,
        userId: r._id.toString(),
        displayName,
        profileImage,
        isAnonymous,
        mealsSaved: r.mealsSaved,
      };
    });
  }

  async updatePreference(userId: string, anonymous: boolean): Promise<void> {
    const result = await this.userModel
      .findByIdAndUpdate(userId, { $set: { leaderboardAnonymous: anonymous } })
      .exec();
    if (!result) {
      throw new NotFoundException(`User not found`);
    }
  }
}
