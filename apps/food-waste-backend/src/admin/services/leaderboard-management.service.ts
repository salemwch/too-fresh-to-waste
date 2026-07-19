import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { OrderStatus, PaymentStatus } from '@foodwaste/shared';
import {
  LoyaltyAccount,
  LoyaltyAccountDocument,
} from '../../loyalty/schemas/loyalty-account.schema';
import { Order, type OrderDocument } from '../../orders/schemas/order.schema';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface AdminLeaderboardStats {
  totalParticipants: number;
  totalPointsDistributed: number;
  averagePoints: number;
  topTier: string;
  tierBreakdown: Array<{ tier: string; count: number }>;
}

export interface AdminLeaderboardEntry {
  _id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  totalPoints: number;
  totalOrdersCount: number;
  totalBagsSaved: number;
  currentTier: string;
  referralCount: number;
  rank: number;
}

export interface AdminLeaderboardResult {
  data: AdminLeaderboardEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminTopMerchant {
  rank: number;
  establishmentId: string;
  establishmentName: string;
  merchantId: string;
  bagsSaved: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class LeaderboardManagementService {
  constructor(
    @InjectModel(LoyaltyAccount.name)
    private readonly loyaltyModel: Model<LoyaltyAccountDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
  ) {}

  async getLeaderboardStats(): Promise<AdminLeaderboardStats> {
    const [statsResult, tierResult] = await Promise.all([
      this.loyaltyModel.aggregate([
        {
          $group: {
            _id: null,
            totalParticipants: { $sum: 1 },
            totalPointsDistributed: { $sum: '$lifetimePointsEarned' },
            averagePoints: { $avg: '$totalPoints' },
          },
        },
      ]),
      this.loyaltyModel.aggregate([
        { $group: { _id: '$currentTier', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const overview = statsResult[0] ?? {
      totalParticipants: 0,
      totalPointsDistributed: 0,
      averagePoints: 0,
    };

    return {
      totalParticipants: overview.totalParticipants,
      totalPointsDistributed: overview.totalPointsDistributed,
      averagePoints: Math.round(overview.averagePoints),
      topTier: tierResult[0]?._id ?? 'Bronze',
      tierBreakdown: tierResult.map(t => ({ tier: t._id, count: t.count })),
    };
  }

  async getTopUsers(page = 1, limit = 20): Promise<AdminLeaderboardResult> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.loyaltyModel.aggregate([
        { $sort: { totalPoints: -1 as const } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1 } }],
            as: '_user',
          },
        },
        { $unwind: { path: '$_user', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            userId: 1,
            firstName: '$_user.firstName',
            lastName: '$_user.lastName',
            email: '$_user.email',
            totalPoints: 1,
            totalOrdersCount: 1,
            totalBagsSaved: 1,
            currentTier: 1,
            referralCount: 1,
          },
        },
      ]),
      this.loyaltyModel.countDocuments(),
    ]);

    const ranked = data.map((entry, i) => ({
      ...entry,
      rank: skip + i + 1,
    }));

    return { data: ranked, total, page, limit };
  }

  async getTopMerchants(limit = 3): Promise<AdminTopMerchant[]> {
    const results = await this.orderModel.aggregate([
      {
        $match: {
          status: { $in: [OrderStatus.PICKED_UP, OrderStatus.COMPLETED] },
          paymentStatus: PaymentStatus.PAID,
          isDeleted: { $ne: true },
          establishmentId: { $exists: true, $ne: null },
        },
      },
      { $project: { establishmentId: 1, merchantId: 1, bagCount: { $sum: '$items.quantity' } } },
      {
        $group: {
          _id: '$establishmentId',
          merchantId: { $first: '$merchantId' },
          bagsSaved: { $sum: '$bagCount' },
        },
      },
      { $sort: { bagsSaved: -1 as const } },
      { $limit: limit },
      {
        $lookup: {
          from: 'establishments',
          localField: '_id',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1 } }],
          as: '_est',
        },
      },
      { $unwind: { path: '$_est', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          establishmentId: '$_id',
          establishmentName: '$_est.name',
          merchantId: 1,
          bagsSaved: 1,
        },
      },
    ]);

    return results.map((r, i) => ({
      rank: i + 1,
      establishmentId: r.establishmentId.toString(),
      establishmentName: r.establishmentName ?? '',
      merchantId: r.merchantId?.toString() ?? '',
      bagsSaved: r.bagsSaved,
    }));
  }
}
