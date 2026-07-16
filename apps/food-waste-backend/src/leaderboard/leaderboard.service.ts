import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { OrderStatus, PaymentStatus } from '@foodwaste/shared';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  establishmentId: string;
  displayName: string;
  profileImage: string | null;
  isAnonymous: boolean;
  mealsSaved: number;
}

export interface MerchantRankResponse {
  rank: number;
  mealsSaved: number;
  totalParticipants: number;
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
            status: { $in: [OrderStatus.PICKED_UP, OrderStatus.COMPLETED] },
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

  /** Aggregate: bags saved per establishment (sum of items.quantity, only picked-up orders) */
  private async allEstablishmentScores(): Promise<
    { establishmentId: string; merchantId: string; mealsSaved: number }[]
  > {
    const results = await this.orderModel
      .aggregate([
        {
          $match: {
            status: { $in: [OrderStatus.PICKED_UP, OrderStatus.COMPLETED] },
            paymentStatus: PaymentStatus.PAID,
            isDeleted: { $ne: true },
            establishmentId: { $exists: true, $ne: null },
          },
        },
        {
          $project: {
            establishmentId: 1,
            merchantId: 1,
            bagCount: { $sum: '$items.quantity' },
          },
        },
        {
          $group: {
            _id: '$establishmentId',
            merchantId: { $first: '$merchantId' },
            mealsSaved: { $sum: '$bagCount' },
          },
        },
        { $sort: { mealsSaved: -1 } },
      ])
      .exec();

    return results.map(r => ({
      establishmentId: String(r._id),
      merchantId: String(r.merchantId),
      mealsSaved: r.mealsSaved as number,
    }));
  }

  async getMerchantRank(
    merchantId: string,
    establishmentId?: string,
  ): Promise<MerchantRankResponse> {
    const scores = await this.allEstablishmentScores();
    const totalParticipants = scores.length;

    if (totalParticipants === 0) {
      return { rank: 0, mealsSaved: 0, totalParticipants: 0, percentile: 0 };
    }

    let myScore: { mealsSaved: number } | undefined;
    if (establishmentId) {
      myScore = scores.find(s => s.establishmentId === establishmentId);
    } else {
      myScore = scores.find(s => s.merchantId === merchantId);
    }

    const mealsSaved = myScore?.mealsSaved ?? 0;
    const rank = myScore ? 1 + scores.filter(s => s.mealsSaved > mealsSaved).length : 0;
    const percentile =
      totalParticipants === 1
        ? 100
        : rank > 0
          ? Math.round((1 - (rank - 1) / (totalParticipants - 1)) * 100)
          : 0;

    return { rank, mealsSaved, totalParticipants, percentile };
  }

  async getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
    const entries = await this.getLeaderboardFromDb(limit);
    return entries;
  }

  private async getLeaderboardFromDb(limit: number): Promise<LeaderboardEntry[]> {
    interface LeaderboardAgg {
      _id: Types.ObjectId;
      merchantId: Types.ObjectId;
      mealsSaved: number;
      establishment: Array<{ name: string }>;
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
            status: { $in: [OrderStatus.PICKED_UP, OrderStatus.COMPLETED] },
            paymentStatus: PaymentStatus.PAID,
            isDeleted: { $ne: true },
            establishmentId: { $exists: true, $ne: null },
          },
        },
        {
          $project: {
            establishmentId: 1,
            merchantId: 1,
            bagCount: { $sum: '$items.quantity' },
          },
        },
        {
          $group: {
            _id: '$establishmentId',
            merchantId: { $first: '$merchantId' },
            mealsSaved: { $sum: '$bagCount' },
          },
        },
        { $sort: { mealsSaved: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'establishments',
            localField: '_id',
            foreignField: '_id',
            pipeline: [{ $project: { _id: 0, name: 1 } }],
            as: 'establishment',
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'merchantId',
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
      const est = r.establishment[0];
      const isAnonymous = u?.leaderboardAnonymous === true;
      const estName = est?.name ?? 'Unknown';
      const displayName = isAnonymous ? 'Anonymous' : estName;
      const profileImage = isAnonymous ? null : (u?.profileImage ?? u?.avatar ?? null);

      return {
        rank: i + 1,
        userId: r.merchantId.toString(),
        establishmentId: r._id.toString(),
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
