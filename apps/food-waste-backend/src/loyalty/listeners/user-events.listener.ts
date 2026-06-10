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
import * as Sentry from '@sentry/node';

import { UserRegisteredEvent } from '../../common/events';
import { GamificationService } from '../services/gamification.service';

@Injectable()
export class UserEventsListener {
  private readonly logger = new Logger(UserEventsListener.name);

  constructor(private readonly gamificationService: GamificationService) {}

  // ============================================
  // USER REGISTERED HANDLERS
  // ============================================

  @OnEvent('user.registered')
  async handleUserRegisteredLegacy(event: UserRegisteredEvent): Promise<void> {
    await this.processUserRegistration(event);
  }

  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'user.registered',
    queue: 'foodwaste.loyalty.user-registered',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'foodwaste.dlx',
        'x-message-ttl': 86400000,
      },
    },
  })
  async handleUserRegisteredRabbitMQ(msg: object): Promise<void | Nack> {
    try {
      const event = plainToClass(UserRegisteredEvent, msg);
      await this.processUserRegistration(event);
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process user.registered event for loyalty`, error);
      return new Nack(true);
    }
  }

  private async processUserRegistration(event: UserRegisteredEvent): Promise<void> {
    const { userId, role, referralCode } = event;

    if (role !== 'merchant') {
      try {
        await this.gamificationService.createLoyaltyAccountForNewUser(userId);
        this.logger.log(`Loyalty account created for user: ${userId}`);
      } catch (error) {
        this.logger.error(
          `Failed to create loyalty account for ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    if (referralCode) {
      await this.processReferral(referralCode, userId, event.email, event.phoneNumber, role);
    }
  }

  private async processReferral(
    referralCode: string,
    userId: string,
    email: string,
    phone: string | undefined,
    role: string,
  ): Promise<void> {
    try {
      const referrerAccount = await this.gamificationService.findReferrerByCode(referralCode);
      if (!referrerAccount) {
        Sentry.captureMessage(`[REFERRAL] code="${referralCode}" NOT FOUND`, 'error');
        return;
      }

      if (referrerAccount.userId.toString() === userId) {
        Sentry.captureMessage(`[REFERRAL] self-referral blocked for ${userId}`, 'error');
        return;
      }

      const referredAs = role === 'merchant' ? 'merchant' : 'consumer';
      const isNewIdentity = await this.gamificationService.checkAndRecordReferredIdentity(
        email,
        phone,
        userId,
        referrerAccount.userId.toString(),
        referredAs,
      );

      if (!isNewIdentity) {
        Sentry.captureMessage(`[REFERRAL] anti-fraud blocked email=${email}`, 'error');
        return;
      }

      if (role === 'merchant') {
        await this.gamificationService.registerBusinessReferral(
          referrerAccount.userId.toString(),
          userId,
        );
      } else {
        await this.gamificationService.registerFriendReferral(
          referrerAccount.userId.toString(),
          userId,
        );
      }

      Sentry.captureMessage(
        `[REFERRAL] SUCCESS: ${userId} referred by ${referrerAccount.userId} (code: ${referralCode})`,
        'info',
      );
    } catch (error) {
      Sentry.captureException(error, {
        tags: { flow: 'referral' },
        extra: { referralCode, userId, email, role },
      });
      this.logger.error(
        `Failed to process referral "${referralCode}" for ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
