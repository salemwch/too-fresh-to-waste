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
      this.logger.error(`RabbitMQ: Failed to process user.registered event for loyalty`, error);
      return new Nack(true); // Requeue for retry
    }
  }

  private async processUserRegistration(event: UserRegisteredEvent): Promise<void> {
    this.logger.log(
      `Processing user.registered event for user: ${event.userId} (role: ${event.role})`,
    );

    // Create loyalty account for consumers only
    if (event.role !== 'merchant' && event.role !== 'admin') {
      try {
        await this.gamificationService.createLoyaltyAccountForNewUser(event.userId);
        this.logger.log(`Successfully created loyalty account for user: ${event.userId}`);
      } catch (error) {
        this.logger.error(
          `Failed to create loyalty account for ${event.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    // Process referral code (applies to BOTH consumers and merchants)
    // Separate try/catch so referral processing is not skipped if loyalty creation fails
    if (event.referralCode) {
      try {
        await this.processReferralCode(event);
      } catch (error) {
        this.logger.error(
          `Failed to process referral for ${event.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  private async processReferralCode(event: UserRegisteredEvent): Promise<void> {
    const { referralCode, userId, email, phoneNumber, role } = event;
    if (!referralCode) {
      return;
    }

    try {
      const referrerAccount = await this.gamificationService.findReferrerByCode(referralCode);
      if (!referrerAccount) {
        this.logger.warn(`Referral code "${referralCode}" not found — ignoring`);
        return;
      }

      if (referrerAccount.userId.toString() === userId) {
        this.logger.warn(`Self-referral blocked for user ${userId}`);
        return;
      }

      const referredAs = role === 'merchant' ? 'merchant' : 'consumer';
      const isNewIdentity = await this.gamificationService.checkAndRecordReferredIdentity(
        email,
        phoneNumber,
        userId,
        referrerAccount.userId.toString(),
        referredAs,
      );

      if (!isNewIdentity) {
        this.logger.warn(
          `Anti-fraud blocked referral: email=${email} or phone=${phoneNumber} already referred`,
        );
        return;
      }

      if (role === 'merchant') {
        await this.gamificationService.registerBusinessReferral(
          referrerAccount.userId.toString(),
          userId,
        );
        this.logger.log(
          `Business referral registered: ${userId} referred by ${referrerAccount.userId}`,
        );
      } else {
        await this.gamificationService.registerFriendReferral(
          referrerAccount.userId.toString(),
          userId,
        );
        this.logger.log(
          `Friend referral registered: ${userId} referred by ${referrerAccount.userId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to process referral code "${referralCode}" for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
