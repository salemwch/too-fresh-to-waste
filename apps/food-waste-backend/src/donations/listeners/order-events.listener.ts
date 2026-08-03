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
import { plainToClass } from 'class-transformer';
import { Types } from 'mongoose';

import { OrderCompletedEvent } from '../../common/events';
import {
  PLATFORM_FOOD_SHARE,
  DONATION_RATE_OF_COMMISSION,
} from '../../orders/utils/order-pricing.util';
import { DonationsService } from '../donations.service';

@Injectable()
export class OrderEventsListener {
  private readonly logger = new Logger(OrderEventsListener.name);

  constructor(private readonly donationsService: DonationsService) {}

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
        await this.donationsService.createDonation({
          userId: new Types.ObjectId(event.userId),
          orderId: new Types.ObjectId(event.orderId),
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
