import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { PaymentStatus } from '@foodwaste/shared';

import { Order, OrderDocument } from '../../orders/schemas/order.schema';
import { PaymentAttempt } from '../schemas/payment-attempt.schema';
import { KonnectOrderService } from '../services/konnect-order.service';

@Injectable()
export class PaymentReconciliationTask {
  private readonly logger = new Logger(PaymentReconciliationTask.name);

  constructor(
    @InjectModel(PaymentAttempt.name)
    private readonly paymentAttemptModel: Model<PaymentAttempt>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly konnectOrderService: KonnectOrderService,
  ) {}

  @Cron('*/5 * * * *', { timeZone: 'Africa/Tunis' })
  async reconcilePendingPayments(): Promise<void> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const staleAttempts = await this.paymentAttemptModel
      .find({
        status: { $in: ['pending', 'processing'] },
        createdAt: { $lt: fiveMinutesAgo },
      })
      .limit(50);

    const unresolvedOrders = await this.orderModel
      .find({
        status: 'pending_payment',
        paymentExpiresAt: { $lt: fiveMinutesAgo },
        paymentStatus: { $ne: PaymentStatus.PAID },
        'paymentSession.reference': { $exists: true },
      })
      .limit(50);

    const totalWork = staleAttempts.length + unresolvedOrders.length;
    if (totalWork === 0) {
      return;
    }

    this.logger.log(
      `Reconciliation: ${staleAttempts.length} stale attempts, ${unresolvedOrders.length} unresolved orders`,
    );

    for (const attempt of staleAttempts) {
      try {
        if (attempt.status === 'processing') {
          await this.paymentAttemptModel.findByIdAndUpdate(attempt._id, {
            status: 'pending',
            claimedAt: null,
          });
        }
        await this.konnectOrderService.handleOrderWebhook(attempt.reference);
      } catch (error) {
        this.logger.warn(
          `Reconciliation: failed for ref ${attempt.reference}: ${(error as Error).message}`,
        );
      }
    }

    for (const order of unresolvedOrders) {
      if (!order.paymentSession?.reference) {
        continue;
      }
      try {
        await this.konnectOrderService.handleOrderWebhook(order.paymentSession.reference);
      } catch (error) {
        this.logger.warn(
          `Reconciliation: order ${order._id} still unresolved: ${(error as Error).message}`,
        );
      }
    }
  }
}
