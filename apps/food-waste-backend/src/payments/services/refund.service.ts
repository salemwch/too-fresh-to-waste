import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';

import { AppLoggerService } from 'src/common/services/logger.service';
import { Order, OrderDocument, OrderStatus } from 'src/orders/schemas/order.schema';

import { Payment, PaymentDocument, PaymentStatus } from '../schemas/payment.schema';

interface RefundRetryConfig {
  maxRetries: number;
  retryDelays: number[];
}

export interface RefundResult {
  success: boolean;
  paymentId: string;
  amount: number;
  refundedAt?: Date;
  error?: string;
  willRetry?: boolean;
}

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  private readonly retryConfig: RefundRetryConfig = {
    maxRetries: 3,
    retryDelays: [60000, 300000, 900000],
  };

  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly appLogger: AppLoggerService,
  ) {
    void this.logger;
  }

  async processFullRefund(
    paymentId: string,
    reason: string,
    session?: ClientSession,
  ): Promise<RefundResult> {
    const payment = session
      ? await this.paymentModel.findById(paymentId).session(session)
      : await this.paymentModel.findById(paymentId);

    if (!payment) {
      return {
        success: false,
        paymentId,
        amount: 0,
        error: 'Payment not found',
      };
    }

    if (payment.status !== PaymentStatus.HELD && payment.status !== PaymentStatus.COMPLETED) {
      return {
        success: false,
        paymentId,
        amount: payment.amount,
        error: `Cannot refund payment in status: ${payment.status}`,
      };
    }

    try {
      payment.status = PaymentStatus.REFUNDED;
      payment.refundedAmount = payment.amount;
      payment.refundReason = reason;
      payment.refundedAt = new Date();

      if (session) {
        await payment.save({ session });
      } else {
        await payment.save();
      }

      this.appLogger.log(
        `Refund successful for payment ${paymentId}: ${payment.amount} ${payment.currency}`,
        'RefundService',
      );

      return {
        success: true,
        paymentId,
        amount: payment.amount,
        refundedAt: payment.refundedAt,
      };
    } catch (error) {
      this.appLogger.error(
        `Refund exception for payment ${paymentId}: ${(error as Error).message}`,
        'RefundService',
      );

      return {
        success: false,
        paymentId,
        amount: payment.amount,
        error: (error as Error).message,
        willRetry: payment.retryCount < this.retryConfig.maxRetries,
      };
    }
  }

  async processExpiredOrderRefund(orderId: string, session?: ClientSession): Promise<RefundResult> {
    const payment = session
      ? await this.paymentModel.findOne({ orderId: new Types.ObjectId(orderId) }).session(session)
      : await this.paymentModel.findOne({ orderId: new Types.ObjectId(orderId) });

    if (!payment) {
      this.appLogger.warn(`No payment found for expired order ${orderId}`, 'RefundService');
      return {
        success: true,
        paymentId: '',
        amount: 0,
      };
    }

    const result = await this.processFullRefund(
      payment._id.toString(),
      `Order expired - pickup window passed (Order: ${orderId})`,
      session,
    );

    if (result.success) {
      if (session) {
        await this.orderModel.findByIdAndUpdate(
          orderId,
          {
            status: OrderStatus.EXPIRED,
            paymentStatus: 'refunded',
            expiredAt: new Date(),
            refundReason: 'Order expired - automatic refund',
          },
          { session },
        );
      } else {
        await this.orderModel.findByIdAndUpdate(orderId, {
          status: OrderStatus.EXPIRED,
          paymentStatus: 'refunded',
          expiredAt: new Date(),
          refundReason: 'Order expired - automatic refund',
        });
      }
    }

    return result;
  }

  async processCancelledOrderRefund(
    orderId: string,
    cancellationReason: string,
    session?: ClientSession,
  ): Promise<RefundResult> {
    const payment = session
      ? await this.paymentModel.findOne({ orderId: new Types.ObjectId(orderId) }).session(session)
      : await this.paymentModel.findOne({ orderId: new Types.ObjectId(orderId) });

    if (!payment) {
      this.appLogger.warn(`No payment found for cancelled order ${orderId}`, 'RefundService');
      return {
        success: true,
        paymentId: '',
        amount: 0,
      };
    }

    const result = await this.processFullRefund(
      payment._id.toString(),
      `Order cancelled by consumer: ${cancellationReason}`,
      session,
    );

    if (result.success) {
      if (session) {
        await this.orderModel.findByIdAndUpdate(
          orderId,
          {
            status: OrderStatus.CANCELLED,
            paymentStatus: 'refunded',
            refundReason: `Consumer cancellation - full refund (1+ hour before pickup)`,
          },
          { session },
        );
      } else {
        await this.orderModel.findByIdAndUpdate(orderId, {
          status: OrderStatus.CANCELLED,
          paymentStatus: 'refunded',
          refundReason: `Consumer cancellation - full refund (1+ hour before pickup)`,
        });
      }
    }

    return result;
  }

  async scheduleRefundRetry(paymentId: string): Promise<void> {
    const payment = await this.paymentModel.findById(paymentId);

    if (!payment) {
      return;
    }

    if (payment.retryCount >= this.retryConfig.maxRetries) {
      this.appLogger.error(
        `Max refund retries reached for payment ${paymentId}. Manual intervention required.`,
        'RefundService',
      );
      return;
    }

    const nextDelay =
      this.retryConfig.retryDelays[payment.retryCount] ??
      this.retryConfig.retryDelays[this.retryConfig.retryDelays.length - 1] ??
      0;
    const nextRetryAt = new Date(Date.now() + nextDelay);

    await this.paymentModel.findByIdAndUpdate(paymentId, {
      $inc: { retryCount: 1 },
      $set: {
        metadata: {
          ...payment.metadata,
          lastRefundAttempt: new Date(),
          nextRefundRetry: nextRetryAt,
          refundRetryReason: 'Automated retry scheduled',
        },
      },
    });

    this.appLogger.log(
      `Refund retry scheduled for payment ${paymentId} at ${nextRetryAt.toISOString()}`,
      'RefundService',
    );
  }

  async getPaymentsNeedingRefundRetry(): Promise<PaymentDocument[]> {
    const now = new Date();

    const payments = await this.paymentModel.find({
      status: PaymentStatus.HELD,
      retryCount: { $gt: 0, $lt: this.retryConfig.maxRetries },
      'metadata.nextRefundRetry': { $lte: now },
    });
    return payments;
  }

  async findPaymentByOrderId(orderId: string): Promise<PaymentDocument | null> {
    const payment = await this.paymentModel.findOne({ orderId: new Types.ObjectId(orderId) });
    return payment;
  }
}
