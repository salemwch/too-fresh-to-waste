import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';

import {
  MerchantWallet,
  MerchantWalletDocument,
} from '../../payments/schemas/merchant-wallet.schema';
import { Payment, PaymentDocument } from '../../payments/schemas/payment.schema';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface AdminPaymentStats {
  totalPayments: number;
  totalAmount: number;
  totalRefunded: number;
  completedPayments: number;
  failedPayments: number;
  pendingPayments: number;
  refundedPayments: number;
  averageAmount: number;
  totalProcessingFees: number;
  paymentMethods: Array<{ method: string; count: number; total: number }>;
}

export interface AdminPayoutSummary {
  _id: string;
  establishmentName: string;
  merchantName: string;
  merchantEmail: string;
  availableBalance: number;
  pendingBalance: number;
  currency: string;
  lastPayoutDate?: string;
}

export interface AdminPayoutListResult {
  data: AdminPayoutSummary[];
  total: number;
  page: number;
  limit: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class PaymentManagementService {
  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(MerchantWallet.name)
    private readonly walletModel: Model<MerchantWalletDocument>,
  ) {}

  async getAdminPaymentStats(): Promise<AdminPaymentStats> {
    const [overviewResult, methodsResult] = await Promise.all([
      this.paymentModel.aggregate([
        {
          $group: {
            _id: null,
            totalPayments: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalRefunded: { $sum: '$refundedAmount' },
            completedPayments: {
              $sum: { $cond: [{ $in: ['$status', ['completed', 'earned']] }, 1, 0] },
            },
            failedPayments: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] },
            },
            pendingPayments: {
              $sum: { $cond: [{ $in: ['$status', ['pending', 'processing', 'held']] }, 1, 0] },
            },
            refundedPayments: {
              $sum: {
                $cond: [{ $in: ['$status', ['refunded', 'partially_refunded']] }, 1, 0],
              },
            },
            averageAmount: { $avg: '$amount' },
            totalProcessingFees: { $sum: '$processingFee' },
          },
        },
      ]),
      this.paymentModel.aggregate([
        { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      ]),
    ]);

    const overview = overviewResult[0] ?? {
      totalPayments: 0,
      totalAmount: 0,
      totalRefunded: 0,
      completedPayments: 0,
      failedPayments: 0,
      pendingPayments: 0,
      refundedPayments: 0,
      averageAmount: 0,
      totalProcessingFees: 0,
    };

    return {
      ...overview,
      paymentMethods: methodsResult.map(m => ({
        method: m._id,
        count: m.count,
        total: m.total,
      })),
    };
  }

  async getPayoutSummaries(page = 1, limit = 20): Promise<AdminPayoutListResult> {
    const skip = (page - 1) * limit;

    const pipeline: PipelineStage[] = [
      { $sort: { pendingBalance: -1 as const } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'establishments',
          localField: 'establishmentId',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1 } }],
          as: '_establishment',
        },
      },
      { $unwind: { path: '$_establishment', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'merchantId',
          foreignField: '_id',
          pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1 } }],
          as: '_merchant',
        },
      },
      { $unwind: { path: '$_merchant', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          establishmentName: '$_establishment.name',
          merchantName: { $concat: ['$_merchant.firstName', ' ', '$_merchant.lastName'] },
          merchantEmail: '$_merchant.email',
          availableBalance: 1,
          pendingBalance: 1,
          currency: 1,
        },
      },
    ];

    const [data, total] = await Promise.all([
      this.walletModel.aggregate(pipeline).exec(),
      this.walletModel.countDocuments(),
    ]);

    return { data, total, page, limit };
  }
}
