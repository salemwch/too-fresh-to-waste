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

import { RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { plainToClass } from 'class-transformer';

import { UserRegisteredEvent } from '../../common/events';
import { GamificationService } from '../services/gamification.service';

@Injectable()
export class UserEventsListener {
  private readonly logger = new Logger(UserEventsListener.name);

  constructor(private readonly gamificationService: GamificationService) {
    void this.gamificationService;
  }

  // ============================================
  // USER REGISTERED HANDLERS
  // ============================================

  /**
   * LEGACY: EventEmitter2 handler for user registration
   */
  @OnEvent('user.registered')
  handleUserRegisteredLegacy(event: UserRegisteredEvent): void {
    this.processUserRegistration(event);
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
  handleUserRegisteredRabbitMQ(msg: object): void | Nack {
    try {
      const event = plainToClass(UserRegisteredEvent, msg);
      this.processUserRegistration(event);
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process user.registered event for loyalty`, error);
      return new Nack(true);
    }
  }

  // Loyalty creation and referral processing are now handled synchronously
  // in AuthService.register() and GoogleAuthService.signIn() to guarantee
  // reliability. This listener is a no-op safety net.
  private processUserRegistration(event: UserRegisteredEvent): void {
    this.logger.log(
      `user.registered event received for user: ${event.userId} (role: ${event.role}) — loyalty + referral already processed inline`,
    );
  }
}
