/**
 * Order Events Listener for Donations Module
 * Handles order-related events to process donation round-ups
 *
 * Dual-mode listener:
 * - @OnEvent: Legacy EventEmitter2 (fallback)
 * - @RabbitSubscribe: RabbitMQ message broker (production)
 *
 * @module donations/listeners
 */

import { RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { plainToClass } from 'class-transformer';
import { Model, Types } from 'mongoose';

import { OrderCompletedEvent } from '../../common/events';
import {
  PLATFORM_FOOD_SHARE,
  DONATION_RATE_OF_COMMISSION,
} from '../../orders/utils/order-pricing.util';
import { Order, OrderDocument } from '../../orders/schemas/order.schema';
import { DonationsService } from '../donations.service';

type OrderEstablishmentLookup = (
  orderId: string,
) => Promise<{ establishmentId?: Types.ObjectId } | null>;

/**
 * The event gained establishmentId in the release that added merchant
 * attribution. Messages already in the RabbitMQ queue at deploy time do not
 * carry it, so fall back to one order read. Never throw: a donation that cannot
 * resolve its establishment is still a donation, and losing it to satisfy an
 * attribution field would be the worse bug.
 *
 * `fromEvent` arrives via `plainToClass` on an untrusted RabbitMQ payload with
 * no runtime validation, so it can be present but malformed. `isValid` guards
 * the `new Types.ObjectId(...)` call rather than widening the try/catch around
 * it: a malformed id should fall through to the order lookup like a missing
 * one would, not be treated as a terminal failure that skips the fallback
 * entirely. Widening the catch would return null immediately on a malformed
 * event id even when the order lookup could have resolved the real
 * establishment - throwing away a fallback that still had a chance to work.
 */
export async function resolveEstablishmentId(
  orderId: string,
  fromEvent: string | undefined,
  lookup: OrderEstablishmentLookup,
): Promise<Types.ObjectId | null> {
  if (fromEvent && Types.ObjectId.isValid(fromEvent)) {
    return new Types.ObjectId(fromEvent);
  }

  try {
    const order = await lookup(orderId);
    return order?.establishmentId ? new Types.ObjectId(order.establishmentId) : null;
  } catch {
    return null;
  }
}

@Injectable()
export class OrderEventsListener {
  private readonly logger = new Logger(OrderEventsListener.name);

  constructor(
    private readonly donationsService: DonationsService,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
  ) {}

  // ============================================
  // ORDER COMPLETED HANDLERS
  // ============================================

  /**
   * LEGACY: EventEmitter2 handler for order completion
   */
  @OnEvent('order.completed')
  async handleOrderCompletedLegacy(event: OrderCompletedEvent): Promise<void> {
    await this.processOrderDonation(event);
  }

  /**
   * RABBITMQ: Message broker handler for order completion
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'order.completed',
    queue: 'foodwaste.donations.order-completed',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'foodwaste.dlx',
        'x-message-ttl': 86400000, // 24 hours
      },
    },
  })
  async handleOrderCompletedRabbitMQ(msg: object): Promise<void | Nack> {
    try {
      const event = plainToClass(OrderCompletedEvent, msg);
      await this.processOrderDonation(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process order.completed event for donations`, error);
      return new Nack(true); // Requeue for retry
    }
  }

  /**
   * Shared logic: Process donation for 5% of platform's 19% food commission
   */
  private async processOrderDonation(event: OrderCompletedEvent): Promise<void> {
    try {
      this.logger.log(`Processing order.completed event for donations: ${event.orderId}`);

      // Charity is 5% of platform's 19% food commission — calculated from subtotal only, not delivery fee
      const donationAmount = parseFloat(
        (event.subtotalAmount * PLATFORM_FOOD_SHARE * DONATION_RATE_OF_COMMISSION).toFixed(3),
      );

      if (donationAmount > 0) {
        const establishmentId = await resolveEstablishmentId(
          event.orderId,
          event.establishmentId,
          async id => {
            // Assigned rather than `return await`: require-await wants the
            // await, no-return-await forbids returning it directly.
            const order = await this.orderModel
              .findById(id)
              .select('establishmentId')
              .lean<{ establishmentId?: Types.ObjectId }>()
              .exec();
            return order;
          },
        );

        if (!establishmentId) {
          this.logger.warn(`Donation for order ${event.orderId} has no establishment attribution`);
        }

        await this.donationsService.createDonation({
          userId: new Types.ObjectId(event.userId),
          orderId: new Types.ObjectId(event.orderId),
          merchantId: new Types.ObjectId(event.merchantId),
          ...(establishmentId ? { establishmentId } : {}),
          amount: donationAmount,
          metadata: {
            platform: 'web',
          },
        });

        this.logger.log(`Created donation of ${donationAmount} TND for order ${event.orderId}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to process order.completed event for donations ${event.orderId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Don't throw - event listeners should not break the flow
    }
  }
}
