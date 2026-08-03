import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';

import { OrderStatus, PaymentStatus } from '@foodwaste/shared';

import { CronLockName, CronLockTtl } from '../../common/constants/cron-lock.constant';
import { CronLockService } from '../../common/services/cron-lock.service';
import { Order, OrderDocument } from '../../orders/schemas/order.schema';
import { Offer } from '../../offers/schemas/offer.schema';
import { KonnectService } from '../../subscription/services/konnect.service';
import { KonnectOrderService } from '../services/konnect-order.service';
import { PaymentAttempt } from '../schemas/payment-attempt.schema';

@Injectable()
export class PaymentExpiryTask {
  private readonly logger = new Logger(PaymentExpiryTask.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Offer.name) private readonly offerModel: Model<Offer>,
    @InjectModel(PaymentAttempt.name)
    private readonly paymentAttemptModel: Model<PaymentAttempt>,
    private readonly konnectService: KonnectService,
    private readonly konnectOrderService: KonnectOrderService,
    private readonly cronLock: CronLockService,
  ) {}

  /**
   * Expires unpaid orders and releases their reserved stock. Locked because
   * concurrent replicas would each issue the release/refund for the same order.
   */
  @Cron('*/2 * * * *', { timeZone: 'Africa/Tunis' })
  async handlePaymentExpiry(): Promise<void> {
    await this.cronLock.runExclusive(CronLockName.PAYMENT_EXPIRY, CronLockTtl.QUICK, async () => {
      await this.expireStalePayments();
    });
  }

  private async expireStalePayments(): Promise<void> {
    const now = new Date();
    const expiredOrders = await this.orderModel
      .find({
        status: OrderStatus.PENDING_PAYMENT,
        paymentExpiresAt: { $lte: now },
        paymentStatus: { $ne: PaymentStatus.PAID },
      })
      .limit(50);

    if (expiredOrders.length === 0) {
      return;
    }

    this.logger.log(`Payment expiry: found ${expiredOrders.length} expired orders`);

    for (const order of expiredOrders) {
      await this.processOrderExpiry(order);
    }
  }

  private async processOrderExpiry(order: OrderDocument): Promise<void> {
    if (!order.paymentSession?.reference) {
      await this.expireOrder(order);
      return;
    }

    try {
      const details = await this.konnectService.getPaymentDetails(order.paymentSession.reference);

      if (details.payment.status === 'completed') {
        this.logger.log(
          `Payment expiry: order ${order._id} actually PAID on Konnect, processing instead`,
        );
        await this.konnectOrderService.handleOrderWebhook(order.paymentSession.reference);
        return;
      }

      await this.expireOrder(order);
    } catch (error) {
      this.logger.warn(
        `Payment expiry: Konnect unreachable for order ${order._id}, skipping (reconciliation will retry): ${(error as Error).message}`,
      );
    }
  }

  private async expireOrder(order: OrderDocument): Promise<void> {
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        await this.orderModel.findByIdAndUpdate(
          order._id,
          {
            status: OrderStatus.EXPIRED,
            paymentStatus: PaymentStatus.FAILED,
          },
          { session },
        );

        if (order.items?.length) {
          for (const item of order.items) {
            await this.offerModel.findByIdAndUpdate(
              item.offerId,
              { $inc: { reservedQuantity: -(item.quantity ?? 1) } },
              { session },
            );
          }
        }

        await this.paymentAttemptModel.updateMany(
          { orderId: order._id, active: true },
          { status: 'expired', active: false },
          { session },
        );
      });

      this.logger.log(`Payment expired for order ${order._id}, inventory released`);
    } finally {
      await session.endSession();
    }
  }
}
