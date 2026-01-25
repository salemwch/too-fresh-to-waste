/**
 * User Events Listener for Loyalty Module
 * Handles user-related events to manage loyalty program interactions
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
import { UserRegisteredEvent } from '../../common/events';
import { GamificationService } from '../services/gamification.service';

@Injectable()
export class UserEventsListener {
  private readonly logger = new Logger(UserEventsListener.name);

  constructor(private readonly gamificationService: GamificationService) {}

  // ============================================
  // USER REGISTERED HANDLERS
  // ============================================

  /**
   * LEGACY: EventEmitter2 handler for user registration
   */
  @OnEvent('user.registered')
  async handleUserRegisteredLegacy(event: UserRegisteredEvent): Promise<void> {
    await this.processUserRegistration(event);
  }

  /**
   * RABBITMQ: Message broker handler for user registration
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'user.registered',
    queue: 'foodwaste.loyalty.user-registered',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'foodwaste.dlx',
        'x-message-ttl': 86400000, // 24 hours
      },
    },
  })
  async handleUserRegisteredRabbitMQ(msg: object): Promise<void | Nack> {
    try {
      const event = plainToClass(UserRegisteredEvent, msg);
      await this.processUserRegistration(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(
        `RabbitMQ: Failed to process user.registered event for loyalty`,
        error,
      );
      return new Nack(true); // Requeue for retry
    }
  }

  /**
   * Shared logic: Award signup bonus and process referral codes
   */
  private async processUserRegistration(event: UserRegisteredEvent): Promise<void> {
    try {
      this.logger.log(`Processing user.registered event for user: ${event.userId}`);

      // Award signup bonus (if gamification service has this method)
      // Note: You may need to implement this method in GamificationService
      // await this.gamificationService.awardSignupBonus(event.userId);

      this.logger.log(`Successfully processed user registration for loyalty: ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process user.registered event for user ${event.userId}: ${error.message}`,
        error.stack,
      );
      // Don't throw - event listeners should not break the flow
    }
  }
}
