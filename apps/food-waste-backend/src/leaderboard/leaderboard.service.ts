import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { OrderStatus, PaymentStatus } from '@foodwaste/shared';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

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
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
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
