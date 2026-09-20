import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage, isValidObjectId } from 'mongoose';
import { OrderStatus, PaymentStatus as OrderPaymentStatus } from '@foodwaste/shared';

import { RegexSecurityUtil } from '../../common/utils/regex-security.util';
import { Order, OrderDocument } from '../../orders/schemas/order.schema';
import { CommissionService } from '../../payments/services/commission.service';
import { KonnectOrderService } from '../../payments/services/konnect-order.service';
import { RefundRequest, RefundRequestDocument } from '../../payments/schemas/refund-request.schema';
import {
  AdminCancelOrderDto,
  AdminRefundOrderDto,
  AdminOrderQueryDto,
} from '../dto/admin-order-query.dto';
import { AdminAction } from '../interfaces/admin-analytics.interface';
import { AdminAuditService } from './admin-audit.service';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface AdminOrderStats {
  totalOrders: number;
  activeOrders: number;
  disputeRate: number;
  totalRevenue: number;
  countByStatus: Record<string, number>;
  countByPaymentStatus: Record<string, number>;
  refundTotal: number;
}

interface AuditContext {
  adminId: string;
  adminEmail: string;
  ipAddress: string;
  userAgent: string;
}

// ─── Select fields for list vs detail ────────────────────────────────────────

const LIST_PROJECT: Record<string, 1> = {
  orderNumber: 1,
  status: 1,
  paymentStatus: 1,
  paymentProvider: 1,
  'pricing.total': 1,
  'pricing.currency': 1,
  'paymentDetails.method': 1,
  createdAt: 1,
  cancellationReason: 1,
  refundReason: 1,
  deliveryMode: 1,
  // The join keys must survive this projection: an inclusion `$project` drops
  // every unlisted field, so without these the `$lookup` stages below match on
  // a missing localField and every joined name comes back null. They are
  // removed again by the `$unset` after the reshape.
  customerId: 1,
  merchantId: 1,
  establishmentId: 1,
  driverId: 1,
};

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class OrderManagementService {
  private readonly logger = new Logger(OrderManagementService.name);

  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(RefundRequest.name)
    private readonly refundRequestModel: Model<RefundRequestDocument>,
    private readonly konnectOrderService: KonnectOrderService,
    private readonly commissionService: CommissionService,
    private readonly auditService: AdminAuditService,
    private readonly regexSecurityUtil: RegexSecurityUtil,
  ) {}

  // ── List Orders ───────────────────────────────────────────────────────────

  async listOrders(
    query: AdminOrderQueryDto,
  ): Promise<{ data: Record<string, unknown>[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const match = this.buildMatch(query);
    const sortField = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const pipeline: PipelineStage[] = [
      { $match: match },
      { $sort: { [sortField]: sortOrder } as Record<string, 1 | -1> },
      { $skip: skip },
      { $limit: limit },
      { $project: LIST_PROJECT },
      // Customer lookup (name + email)
      {
        $lookup: {
          from: 'users',
          localField: 'customerId',
          foreignField: '_id',
          pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1 } }],
          as: '_customer',
        },
      },
      { $unwind: { path: '$_customer', preserveNullAndEmptyArrays: true } },
      // Merchant lookup (name + email)
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
      // Establishment lookup (name)
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
      // Driver lookup (name) — absent on pickup and unaccepted delivery orders
      {
        $lookup: {
          from: 'users',
          localField: 'driverId',
          foreignField: '_id',
          pipeline: [{ $project: { firstName: 1, lastName: 1 } }],
          as: '_driver',
        },
      },
      { $unwind: { path: '$_driver', preserveNullAndEmptyArrays: true } },
      // Reshape
      {
        $addFields: {
          customer: {
            name: { $concat: ['$_customer.firstName', ' ', '$_customer.lastName'] },
            email: '$_customer.email',
          },
          merchant: {
            name: { $concat: ['$_merchant.firstName', ' ', '$_merchant.lastName'] },
            email: '$_merchant.email',
          },
          establishment: { name: '$_establishment.name' },
          driver: {
            $cond: [
              { $ifNull: ['$driverId', false] },
              {
                _id: '$driverId',
                name: { $concat: ['$_driver.firstName', ' ', '$_driver.lastName'] },
              },
              null,
            ],
          },
        },
      },
      {
        $unset: [
          '_customer',
          '_merchant',
          '_establishment',
          '_driver',
          'customerId',
          'merchantId',
          'establishmentId',
          'driverId',
        ],
      },
    ];

    const [data, countResult] = await Promise.all([
      this.orderModel.aggregate(pipeline).exec(),
      this.orderModel.countDocuments(match),
    ]);

    return { data, total: countResult, page, limit };
  }

  // ── Order Detail ──────────────────────────────────────────────────────────

  async getOrderDetail(orderId: string): Promise<Record<string, unknown>> {
    if (!isValidObjectId(orderId)) {
      throw new BadRequestException('Invalid order ID');
    }

    const pipeline: PipelineStage[] = [
      { $match: { _id: new Types.ObjectId(orderId) } },
      // Customer
      {
        $lookup: {
          from: 'users',
          localField: 'customerId',
          foreignField: '_id',
          pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1, phone: 1 } }],
          as: '_customer',
        },
      },
      { $unwind: { path: '$_customer', preserveNullAndEmptyArrays: true } },
      // Merchant
      {
        $lookup: {
          from: 'users',
          localField: 'merchantId',
          foreignField: '_id',
          pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1, phone: 1 } }],
          as: '_merchant',
        },
      },
      { $unwind: { path: '$_merchant', preserveNullAndEmptyArrays: true } },
      // Establishment
      {
        $lookup: {
          from: 'establishments',
          localField: 'establishmentId',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1, address: 1 } }],
          as: '_establishment',
        },
      },
      { $unwind: { path: '$_establishment', preserveNullAndEmptyArrays: true } },
      // Driver — null on pickup orders and on delivery orders nobody has
      // accepted yet, so the unwind must preserve empty.
      {
        $lookup: {
          from: 'users',
          localField: 'driverId',
          foreignField: '_id',
          pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1, phoneNumber: 1 } }],
          as: '_driver',
        },
      },
      { $unwind: { path: '$_driver', preserveNullAndEmptyArrays: true } },
      // Refund request (if exists)
      {
        $lookup: {
          from: 'refund_requests',
          localField: '_id',
          foreignField: 'orderId',
          pipeline: [{ $project: { reason: 1, status: 1, amount: 1, notes: 1, createdAt: 1 } }],
          as: '_refundRequests',
        },
      },
      // Reshape
      {
        $addFields: {
          customer: {
            _id: '$_customer._id',
            name: { $concat: ['$_customer.firstName', ' ', '$_customer.lastName'] },
            email: '$_customer.email',
            phone: '$_customer.phone',
          },
          merchant: {
            _id: '$_merchant._id',
            name: { $concat: ['$_merchant.firstName', ' ', '$_merchant.lastName'] },
            email: '$_merchant.email',
            phone: '$_merchant.phone',
          },
          establishment: {
            _id: '$_establishment._id',
            name: '$_establishment.name',
            address: '$_establishment.address',
          },
          refundRequests: '$_refundRequests',
          // `$ifNull` on the id rather than on the joined doc: a driver who
          // has since been deleted still leaves `driverId` set, and the admin
          // needs to see the order was assigned rather than a silent null.
          driver: {
            $cond: [
              { $ifNull: ['$driverId', false] },
              {
                _id: '$driverId',
                name: { $concat: ['$_driver.firstName', ' ', '$_driver.lastName'] },
                email: '$_driver.email',
                phone: '$_driver.phoneNumber',
              },
              null,
            ],
          },
        },
      },
      { $unset: ['_customer', '_merchant', '_establishment', '_driver', '_refundRequests'] },
    ];

    const [order] = await this.orderModel.aggregate(pipeline).exec();
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order as Record<string, unknown>;
  }

  // ── Order Stats ───────────────────────────────────────────────────────────

  async getOrderStats(): Promise<AdminOrderStats> {
    const [result] = await this.orderModel
      .aggregate([
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  totalOrders: { $sum: 1 },
                  totalRevenue: {
                    $sum: {
                      $cond: [
                        { $in: ['$status', ['completed', 'picked_up', 'delivered']] },
                        '$pricing.total',
                        0,
                      ],
                    },
                  },
                  cancelledCount: {
                    $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
                  },
                },
              },
            ],
            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
            byPaymentStatus: [{ $group: { _id: '$paymentStatus', count: { $sum: 1 } } }],
            refunds: [
              {
                $match: {
                  paymentStatus: { $in: ['refunded', 'refund_pending', 'partially_refunded'] },
                },
              },
              { $group: { _id: null, total: { $sum: '$pricing.total' } } },
            ],
            active: [
              {
                $match: {
                  status: {
                    $in: [
                      'pending',
                      'pending_payment',
                      'reserved',
                      'confirmed',
                      'ready_for_pickup',
                      'driver_assigned',
                      'out_for_delivery',
                    ],
                  },
                },
              },
              { $count: 'count' },
            ],
          },
        },
      ])
      .exec();

    const totals = result.totals[0] ?? { totalOrders: 0, totalRevenue: 0, cancelledCount: 0 };
    const activeCount = result.active[0]?.count ?? 0;
    const refundTotal = result.refunds[0]?.total ?? 0;

    const countByStatus: Record<string, number> = {};
    for (const item of result.byStatus) {
      countByStatus[item._id] = item.count;
    }

    const countByPaymentStatus: Record<string, number> = {};
    for (const item of result.byPaymentStatus) {
      countByPaymentStatus[item._id] = item.count;
    }

    const disputeRate = totals.totalOrders > 0 ? totals.cancelledCount / totals.totalOrders : 0;

    return {
      totalOrders: totals.totalOrders,
      activeOrders: activeCount,
      disputeRate: Math.round(disputeRate * 10000) / 10000,
      totalRevenue: Math.round(totals.totalRevenue * 100) / 100,
      countByStatus,
      countByPaymentStatus,
      refundTotal: Math.round(refundTotal * 100) / 100,
    };
  }

  // ── Admin Cancel Order ────────────────────────────────────────────────────

  async adminCancelOrder(
    orderId: string,
    dto: AdminCancelOrderDto,
    audit: AuditContext,
  ): Promise<Record<string, unknown>> {
    if (!isValidObjectId(orderId)) {
      throw new BadRequestException('Invalid order ID');
    }

    const order = await this.orderModel.findById(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const terminalStatuses: string[] = [
      OrderStatus.COMPLETED,
      OrderStatus.PICKED_UP,
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
      OrderStatus.EXPIRED,
      OrderStatus.REFUNDED,
    ];

    if (terminalStatuses.includes(order.status)) {
      throw new BadRequestException(`Cannot cancel order in "${order.status}" status`);
    }

    const session = await this.orderModel.db.startSession();
    try {
      await session.withTransaction(async () => {
        // If online-paid, trigger refund
        if (
          order.paymentProvider === 'konnect' &&
          order.paymentStatus === OrderPaymentStatus.PAID
        ) {
          order.paymentStatus = OrderPaymentStatus.REFUND_PENDING;
          await this.konnectOrderService.processRefundRequest(
            order,
            new Types.ObjectId(audit.adminId),
            'merchant_cancel',
            session,
          );
        }

        order.status = OrderStatus.CANCELLED;
        order.cancellationReason = `[Admin] ${dto.reason}`;
        order.cancelledAt = new Date();
        await order.save({ session });
      });
    } finally {
      await session.endSession();
    }

    await this.auditService.createAuditLog({
      action: AdminAction.ORDER_CANCELLED,
      adminId: audit.adminId,
      adminEmail: audit.adminEmail,
      targetType: 'order',
      targetId: orderId,
      reason: dto.reason,
      metadata: { orderNumber: order.orderNumber },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    });

    this.logger.log(`Admin ${audit.adminEmail} cancelled order ${order.orderNumber}`);
    return this.getOrderDetail(orderId);
  }

  // ── Admin Issue Refund ────────────────────────────────────────────────────

  async adminIssueRefund(
    orderId: string,
    dto: AdminRefundOrderDto,
    audit: AuditContext,
  ): Promise<Record<string, unknown>> {
    if (!isValidObjectId(orderId)) {
      throw new BadRequestException('Invalid order ID');
    }

    const order = await this.orderModel.findById(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.paymentProvider !== 'konnect') {
      throw new BadRequestException('Refund is only available for online payments');
    }

    const refundableStatuses: string[] = [OrderPaymentStatus.PAID, OrderPaymentStatus.HELD];

    if (!refundableStatuses.includes(order.paymentStatus)) {
      throw new BadRequestException(
        `Cannot refund order with payment status "${order.paymentStatus}"`,
      );
    }

    // Check for existing refund request
    const existingRefund = await this.refundRequestModel.findOne({
      orderId: new Types.ObjectId(orderId),
      status: { $in: ['pending', 'approved'] },
    });

    if (existingRefund) {
      throw new BadRequestException('A refund request already exists for this order');
    }

    const session = await this.orderModel.db.startSession();
    try {
      await session.withTransaction(async () => {
        await this.konnectOrderService.processRefundRequest(
          order,
          new Types.ObjectId(audit.adminId),
          'merchant_cancel',
          session,
        );

        /*
         * Unwind the commission. This path accepts `paymentStatus: PAID`, which
         * is exactly what an order carries *after* pickup confirmation — so by
         * the time an admin refunds, the order has usually already accrued its
         * 19% and may have settled part of the merchant's balance.
         *
         * Both directions have to move. Dropping only the accrual would leave
         * the merchant permanently short by whatever was settled from a sale
         * that no longer exists; dropping only the settlement would hand him
         * free commission. `reverseForOrder` is a no-op when the order never
         * reached pickup, so cancel-before-pickup stays correct.
         */
        await this.commissionService.reverseForOrder(
          {
            establishmentId: order.establishmentId as Types.ObjectId,
            merchantId: order.merchantId as Types.ObjectId,
            orderId: order._id,
            subtotal: order.pricing.subtotal,
          },
          1,
          session,
        );

        order.paymentStatus = OrderPaymentStatus.REFUND_PENDING;
        order.refundReason = `[Admin] ${dto.reason}`;
        order.status = OrderStatus.REFUNDED;
        await order.save({ session });
      });
    } finally {
      await session.endSession();
    }

    await this.auditService.createAuditLog({
      action: AdminAction.ORDER_REFUNDED,
      adminId: audit.adminId,
      adminEmail: audit.adminEmail,
      targetType: 'order',
      targetId: orderId,
      reason: dto.reason,
      metadata: {
        notes: dto.notes,
        orderNumber: order.orderNumber,
        amount: order.pricing.total,
      },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    });

    this.logger.log(`Admin ${audit.adminEmail} issued refund for order ${order.orderNumber}`);
    return this.getOrderDetail(orderId);
  }

  // ── Private: Build match filter ───────────────────────────────────────────

  private buildMatch(query: AdminOrderQueryDto): Record<string, unknown> {
    const match: Record<string, unknown> = {};

    if (query.status) {
      match['status'] = query.status;
    }

    if (query.paymentStatus) {
      match['paymentStatus'] = query.paymentStatus;
    }

    if (query.paymentProvider) {
      match['paymentProvider'] = query.paymentProvider;
    }

    if (query.customerId) {
      if (!isValidObjectId(query.customerId)) {
        throw new BadRequestException('Invalid customerId');
      }
      match['customerId'] = new Types.ObjectId(query.customerId);
    }

    if (query.merchantId) {
      if (!isValidObjectId(query.merchantId)) {
        throw new BadRequestException('Invalid merchantId');
      }
      match['merchantId'] = new Types.ObjectId(query.merchantId);
    }

    if (query.establishmentId) {
      if (!isValidObjectId(query.establishmentId)) {
        throw new BadRequestException('Invalid establishmentId');
      }
      match['establishmentId'] = new Types.ObjectId(query.establishmentId);
    }

    if (query.dateFrom || query.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (query.dateFrom) {
        dateFilter['$gte'] = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        dateFilter['$lte'] = new Date(query.dateTo);
      }
      match['createdAt'] = dateFilter;
    }

    if (query.search) {
      const escaped = this.regexSecurityUtil.escapeRegexPattern(query.search);
      if (escaped) {
        const regex = { $regex: escaped, $options: 'i' };
        match['$or'] = [{ orderNumber: regex }];
      }
    }

    return match;
  }
}
