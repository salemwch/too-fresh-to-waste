import { UserRole } from '@foodwaste/shared';
import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage, FilterQuery } from 'mongoose';

import { toObjectId } from 'src/common/utils/mongo.utils';
import { RegexSecurityUtil } from 'src/common/utils/regex-security.util';

import { PaymentQueryDto } from './dto/payment-query.dto';
import { Payment, PaymentDocument, PaymentStatus } from './schemas/payment.schema';

interface PaymentOverviewStats {
  totalPayments: number;
  totalAmount: number;
  totalRefunded: number;
  completedPayments: number;
  failedPayments: number;
  pendingPayments: number;
  refundedPayments: number;
  averageAmount: number;
  totalProcessingFees: number;
}

interface PaymentMethodStat {
  _id: string | null;
  count: number;
  total: number;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectModel(Payment.name) readonly paymentModel: Model<PaymentDocument>,
    private readonly regexSecurityUtil: RegexSecurityUtil,
  ) {
    void this.logger;
  }

  async findAllCursor(
    limit: number = 10,
    after?: string,
    filters: PaymentQueryDto = {},
    userId?: string,
    userRole?: UserRole,
  ): Promise<{ payments: PaymentDocument[]; nextCursor?: string | undefined }> {
    if (limit > 10) {
      limit = 10;
    }

    const query: FilterQuery<PaymentDocument> = {};
    if (userRole === UserRole.MERCHANT && userId) {
      query.merchantId = toObjectId(userId);
    }
    if (filters.status !== null && filters.status !== undefined) {
      query.status = filters.status;
    }
    if (filters.paymentMethod !== null && filters.paymentMethod !== undefined) {
      query.paymentMethod = filters.paymentMethod;
    }
    if (filters.customerId) {
      query.customerId = filters.customerId;
    }
    if (filters.merchantId) {
      query.merchantId = filters.merchantId;
    }
    if (filters.establishmentId) {
      query.establishmentId = filters.establishmentId;
    }

    // Date filter
    if (filters.fromDate ?? filters.toDate) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};
      if (filters.fromDate) {
        dateFilter.$gte = new Date(filters.fromDate);
      }
      if (filters.toDate) {
        dateFilter.$lte = new Date(filters.toDate);
      }
      Object.assign(query, { createdAt: dateFilter });
    }

    // Amount filter
    if (filters.minAmount ?? filters.maxAmount) {
      const amountFilter: { $gte?: number; $lte?: number } = {};
      if (filters.minAmount) {
        amountFilter.$gte = filters.minAmount;
      }
      if (filters.maxAmount) {
        amountFilter.$lte = filters.maxAmount;
      }
      Object.assign(query, { amount: amountFilter });
    }

    // Free-text search
    if (filters.search) {
      const escaped = this.regexSecurityUtil.escapeRegexPattern(filters.search);
      query.$or = [
        { transactionId: { $regex: escaped, $options: 'i' } },
        { merchantTransactionId: { $regex: escaped, $options: 'i' } },
      ];
    }

    // Cursor pagination
    if (after) {
      const afterDoc = await this.paymentModel.findById(after).lean<PaymentDocument>();
      if (afterDoc) {
        const existing = (query as { createdAt?: { $gte?: Date; $lte?: Date } }).createdAt;
        Object.assign(query, {
          createdAt: { ...existing, $gt: afterDoc.createdAt },
        });
      }
    }

    // ✅ PERFORMANCE: Single aggregation replaces find + 3 populates (4 → 1 round-trip)
    const pipeline: PipelineStage[] = [
      { $match: query },
      { $sort: { createdAt: 1 as const } },
      { $limit: limit + 1 },
      ...this.buildCustomerLookupForPayment(),
      ...this.buildEstablishmentLookupForPayment(),
      ...this.buildMerchantLookupForPayment(),
    ];

    const payments = await this.paymentModel.aggregate<PaymentDocument>(pipeline).exec();

    let nextCursor: string | undefined;
    if (payments.length > limit) {
      const nextItem = payments.pop() as PaymentDocument;
      nextCursor = String(nextItem._id);
    }

    return { payments, nextCursor };
  }

  async findById(
    paymentId: string,
    userId?: string,
    userRole?: UserRole,
  ): Promise<PaymentDocument> {
    // ✅ PERFORMANCE: Single aggregation replaces findById + 4 populates (5 → 1 round-trip)
    const pipeline: PipelineStage[] = [
      { $match: { _id: new Types.ObjectId(paymentId) } },
      ...this.buildCustomerLookupForPayment(true),
      ...this.buildEstablishmentLookupForPayment(true),
      ...this.buildMerchantLookupForPayment(true),
      ...this.buildOrderLookupForPayment(),
    ];

    const results = await this.paymentModel.aggregate(pipeline).exec();
    const payment = results[0] as PaymentDocument | undefined;

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Access control
    if (userId && userRole !== UserRole.ADMIN) {
      const isCustomer = payment.customerId._id.toString() === userId;
      const isMerchant = payment.merchantId._id.toString() === userId;

      if (!isCustomer && !isMerchant) {
        throw new ForbiddenException('Access denied');
      }
    }

    return payment;
  }

  async getPaymentStats(userId: string, userRole: UserRole): Promise<Record<string, unknown>> {
    // Define match conditions based on role
    let matchCondition: FilterQuery<PaymentDocument> = {};

    switch (userRole) {
      case UserRole.CONSUMER:
        matchCondition.customerId = new Types.ObjectId(userId);
        break;
      case UserRole.MERCHANT:
        matchCondition.merchantId = new Types.ObjectId(userId);
        break;
      case UserRole.ADMIN:
        // Admin sees all payments
        matchCondition = {};
        break;
      case UserRole.MODERATOR:
        throw new ForbiddenException('Role not allowed to view stats');
      default:
        throw new ForbiddenException('Role not allowed to view stats');
    }

    // Aggregate overview stats
    const overviewStats = await this.paymentModel.aggregate<PaymentOverviewStats>([
      { $match: matchCondition },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalRefunded: { $sum: '$refundedAmount' },
          completedPayments: {
            $sum: { $cond: [{ $eq: ['$status', PaymentStatus.COMPLETED] }, 1, 0] },
          },
          failedPayments: {
            $sum: { $cond: [{ $eq: ['$status', PaymentStatus.FAILED] }, 1, 0] },
          },
          pendingPayments: {
            $sum: { $cond: [{ $eq: ['$status', PaymentStatus.PENDING] }, 1, 0] },
          },
          refundedPayments: {
            $sum: { $cond: [{ $eq: ['$status', PaymentStatus.REFUNDED] }, 1, 0] },
          },
          averageAmount: { $avg: '$amount' },
          totalProcessingFees: { $sum: '$processingFee' },
        },
      },
    ]);

    // Aggregate payment method breakdown
    const paymentMethodStats = await this.paymentModel.aggregate<PaymentMethodStat>([
      { $match: matchCondition },
      { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]);

    return {
      overview: overviewStats[0] ?? {
        totalPayments: 0,
        totalAmount: 0,
        totalRefunded: 0,
        completedPayments: 0,
        failedPayments: 0,
        pendingPayments: 0,
        refundedPayments: 0,
        averageAmount: 0,
        totalProcessingFees: 0,
      },
      paymentMethods: paymentMethodStats,
    };
  }

  // =========================================================================
  // REUSABLE $lookup PIPELINE BUILDERS (replaces .populate() — 1 round-trip)
  // =========================================================================

  private buildCustomerLookupForPayment(includePhone = false): PipelineStage[] {
    const fields: Record<string, 1> = { _id: 1, firstName: 1, lastName: 1, email: 1 };
    if (includePhone) {
      fields['phoneNumber'] = 1;
    }

    return [
      {
        $lookup: {
          from: 'users',
          let: { refId: '$customerId' },
          pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$refId'] } } }, { $project: fields }],
          as: '_customerDoc',
        },
      },
      { $unwind: { path: '$_customerDoc', preserveNullAndEmptyArrays: true } },
      { $addFields: { customerId: '$_customerDoc' } },
      { $project: { _customerDoc: 0 } },
    ];
  }

  private buildEstablishmentLookupForPayment(includeAddress = false): PipelineStage[] {
    const fields: Record<string, 1> = { _id: 1, name: 1, type: 1 };
    if (includeAddress) {
      fields['address'] = 1;
    }

    return [
      {
        $lookup: {
          from: 'establishments',
          let: { refId: '$establishmentId' },
          pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$refId'] } } }, { $project: fields }],
          as: '_establishmentDoc',
        },
      },
      { $unwind: { path: '$_establishmentDoc', preserveNullAndEmptyArrays: true } },
      { $addFields: { establishmentId: '$_establishmentDoc' } },
      { $project: { _establishmentDoc: 0 } },
    ];
  }

  private buildMerchantLookupForPayment(includeEmail = false): PipelineStage[] {
    const fields: Record<string, 1> = { _id: 1, firstName: 1, lastName: 1 };
    if (includeEmail) {
      fields['email'] = 1;
    }

    return [
      {
        $lookup: {
          from: 'users',
          let: { refId: '$merchantId' },
          pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$refId'] } } }, { $project: fields }],
          as: '_merchantDoc',
        },
      },
      { $unwind: { path: '$_merchantDoc', preserveNullAndEmptyArrays: true } },
      { $addFields: { merchantId: '$_merchantDoc' } },
      { $project: { _merchantDoc: 0 } },
    ];
  }

  private buildOrderLookupForPayment(): PipelineStage[] {
    return [
      {
        $lookup: {
          from: 'orders',
          let: { refId: '$orderId' },
          pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$refId'] } } }],
          as: '_orderDoc',
        },
      },
      { $unwind: { path: '$_orderDoc', preserveNullAndEmptyArrays: true } },
      { $addFields: { orderId: '$_orderDoc' } },
      { $project: { _orderDoc: 0 } },
    ];
  }
}
