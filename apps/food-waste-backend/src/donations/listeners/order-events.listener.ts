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
import { OrderStatus } from '@foodwaste/shared';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { plainToClass } from 'class-transformer';
import { Model, Types } from 'mongoose';

import { OrderCompletedEvent, OrderRefundedEvent } from '../../common/events';
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
 * The ids on `OrderCompletedEvent` that `createDonation` turns into
 * `Types.ObjectId` and that the schema marks required. Every one of them
 * arrives on an unvalidated RabbitMQ payload.
 */
export const REQUIRED_DONATION_ID_FIELDS = ['userId', 'orderId', 'merchantId'] as const;

export type RequiredDonationIdField = (typeof REQUIRED_DONATION_ID_FIELDS)[number];

/**
 * Which required ids on the event are not valid ObjectIds.
 *
 * Exported so the branch is testable without a broker or a database. An empty
 * array means the event is safe to turn into a donation.
 */
export function findInvalidDonationIds(
  event: Pick<OrderCompletedEvent, RequiredDonationIdField>,
): RequiredDonationIdField[] {
  return REQUIRED_DONATION_ID_FIELDS.filter(field => !Types.ObjectId.isValid(event[field]));
}

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
    // EventEmitter cannot retry; the failure is logged at error level, with
    // the order id, so the missing pledge can be found and replayed.
    try {
      await this.processOrderDonation(event);
    } catch (error) {
      this.logger.error(
        `Donation for completed order ${event.orderId} was not recorded: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
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

  // ============================================
  // ORDER REFUNDED HANDLERS
  // ============================================

  @OnEvent('order.refunded')
  async handleOrderRefundedLegacy(event: OrderRefundedEvent): Promise<void> {
    await this.reverseOrderDonation(event);
  }

  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'order.refunded',
    queue: 'foodwaste.donations.order-refunded',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'foodwaste.dlx',
        'x-message-ttl': 86400000, // 24 hours
      },
    },
  })
  async handleOrderRefundedRabbitMQ(msg: object): Promise<void | Nack> {
    try {
      await this.reverseOrderDonation(plainToClass(OrderRefundedEvent, msg));
    } catch (error) {
      this.logger.error('RabbitMQ: Failed to process order.refunded event for donations', error);
      return new Nack(true);
    }
  }

  /**
   * A refunded sale no longer contributes. Throws on failure so RabbitMQ
   * requeues it - unlike the completion path, a lost reversal leaves money
   * attributed to a sale that did not happen, and the claim is idempotent.
   */
  private async reverseOrderDonation(event: OrderRefundedEvent): Promise<void> {
    if (!Types.ObjectId.isValid(event.orderId)) {
      this.logger.error(
        `Skipping donation reversal: orderId "${String(event.orderId)}" is invalid`,
      );
      return;
    }
    await this.donationsService.reverseForOrder(new Types.ObjectId(event.orderId), event.reason);
  }

  /**
   * Shared logic: Process donation for 5% of platform's 19% food commission.
   *
   * Throws when the donation could not be written, so the RabbitMQ handler
   * can Nack and the broker redelivers. It used to catch everything, which
   * acknowledged the message and lost the pledge on a transient failure.
   * Redelivery is safe: createDonation is idempotent per order.
   */
  private async processOrderDonation(event: OrderCompletedEvent): Promise<void> {
    this.logger.log(`Processing order.completed event for donations: ${event.orderId}`);

    // A payload with no usable subtotal (plainToClass skips constructor
    // defaults) gave NaN, and `NaN > 0` quietly skipped the donation.
    if (!Number.isFinite(event.subtotalAmount)) {
      this.logger.error(
        `Skipping donation for order ${event.orderId}: subtotalAmount "${String(event.subtotalAmount)}" is not a number`,
      );
      return;
    }

    // Charity is 5% of platform's 19% food commission - calculated from subtotal only, not delivery fee
    const donationAmount = parseFloat(
      (event.subtotalAmount * PLATFORM_FOOD_SHARE * DONATION_RATE_OF_COMMISSION).toFixed(3),
    );

    if (donationAmount > 0) {
      /*
       * `event` is a plainToClass copy of an untrusted RabbitMQ payload with
       * no runtime validation, so merchantId can be present but malformed.
       * Constructing `new Types.ObjectId(...)` off it throws into the catch
       * below, which swallows the error - losing the entire donation, not
       * just its attribution. Writing one with a bogus merchant is worse
       * still: the money would be attributed to nobody and would never
       * appear on any ledger, while looking successful in the logs.
       *
       * Refuse instead, and log at error level so the gap is visible. This
       * is the same guard `resolveEstablishmentId` applies to the optional
       * establishmentId; the required ids had the worse consequence and
       * were the unguarded ones left in this function. All three required
       * ids are checked, not merchantId alone - userId and orderId reach
       * `new Types.ObjectId(...)` on the same unvalidated payload, in the
       * same expression, with the same swallowed failure.
       */
      const invalidIds = findInvalidDonationIds(event);
      if (invalidIds.length > 0) {
        this.logger.error(
          `Skipping donation for order ${event.orderId}: ${invalidIds
            .map(field => `${field}="${String(event[field])}"`)
            .join(', ')} not a valid ObjectId, so the contribution cannot be attributed`,
        );
        return;
      }

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

      /*
       * Refund processed first: order.refunded found no donation to reverse
       * (this completion was still queued or being redelivered), so booking
       * it now would pledge for a sale that was refunded, and nothing would
       * ever reverse it. Both refund paths commit REFUNDED before emitting.
       */
      const current = await this.orderModel
        .findById(event.orderId)
        .select('status')
        .lean<{ status?: OrderStatus }>()
        .exec();
      if (current?.status === OrderStatus.REFUNDED) {
        this.logger.warn(`Skipping donation for order ${event.orderId}: already refunded`);
        return;
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
  }
}
