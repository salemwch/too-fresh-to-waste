/**
 * Order Events Listener for Loyalty Module
 * Handles order-related events to award loyalty points and update gamification
 *
 * Dual-mode listener:
 * - @OnEvent: Legacy EventEmitter2 (fallback)
 * - @RabbitSubscribe: RabbitMQ message broker (production)
 *
 * @module loyalty/listeners
 */

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
import { plainToClass } from 'class-transformer';
import { OrderCompletedEvent } from '../../common/events';
import { LoyaltyService } from '../loyalty.service';
import { GamificationService } from '../services/gamification.service';

@Injectable()
export class OrderEventsListener {
  private readonly logger = new Logger(OrderEventsListener.name);
  private readonly POINTS_PER_BAG = 10;

  constructor(
    private readonly loyaltyService: LoyaltyService,
    private readonly gamificationService: GamificationService,
  ) {}

  // ============================================
  // ORDER COMPLETED HANDLERS
  // ============================================

  /**
   * LEGACY: EventEmitter2 handler for order completion
   */
  @OnEvent('order.completed')
  async handleOrderCompletedLegacy(event: OrderCompletedEvent): Promise<void> {
    await this.processOrderLoyalty(event);
  }

  /**
   * RABBITMQ: Message broker handler for order completion
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'order.completed',
    queue: 'foodwaste.loyalty.order-completed',
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
      await this.processOrderLoyalty(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(
        `RabbitMQ: Failed to process order.completed event for loyalty`,
        error,
      );
      return new Nack(true); // Requeue for retry
    }
  }

  /**
   * Shared logic: Award loyalty points and update gamification
   */
  private async processOrderLoyalty(event: OrderCompletedEvent): Promise<void> {
    try {
      this.logger.log(`Processing order.completed event for order: ${event.orderId}`);

      const totalBags = event.metadata?.itemCount || 1;

      // Award loyalty points
      const pointsToAward = totalBags * this.POINTS_PER_BAG;
      await this.loyaltyService.addPoints(event.userId, {
        amount: pointsToAward,
        reason: `Order pickup completed - ${totalBags} bag(s)`,
        orderId: event.orderId,
      });

      this.logger.log(
        `Awarded ${pointsToAward} loyalty points to user ${event.userId} for order ${event.orderId}`,
      );

      // Update gamification tracking
      await this.gamificationService.updateFriendBagCount(event.userId, totalBags);
      const streakResult = await this.gamificationService.updatePurchaseStreak(event.userId, totalBags);

      if (streakResult.completed) {
        this.logger.log(
          `Purchase streak completed! +${streakResult.pointsAwarded} points for user ${event.userId}`,
        );
      }

      // Update business referral tracking for merchant
      await this.gamificationService.updateBusinessOrderCount(event.merchantId);

      this.logger.log(`Successfully processed order completion for loyalty: ${event.orderId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process order.completed event for order ${event.orderId}: ${error.message}`,
        error.stack,
      );
      // Don't throw - event listeners should not break the flow
    }
  }
}
