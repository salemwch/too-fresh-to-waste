/**
 * User Privacy Events Listener
 * Handles privacy and compliance-related user events
 *
 * Dual-mode listener:
 * - @OnEvent: Legacy EventEmitter2 (fallback)
 * - @RabbitSubscribe: RabbitMQ message broker (production)
 *
 * @module users/listeners
 */

import { RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { plainToClass } from 'class-transformer';

import { UserPrivacyConsentUpdatedEvent } from '../events/user.events';

@Injectable()
export class UserPrivacyEventsListener {
  private readonly logger = new Logger(UserPrivacyEventsListener.name);

  // ============================================
  // PRIVACY CONSENT UPDATED HANDLERS
  // ============================================

  /**
   * LEGACY: EventEmitter2 handler for privacy consent updates
   */
  @OnEvent('user.privacy_consent.updated')
  handlePrivacyConsentUpdatedLegacy(event: UserPrivacyConsentUpdatedEvent): void {
    this.processPrivacyConsentUpdate(event);
  }

  /**
   * RABBITMQ: Message broker handler for privacy consent updates
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'user.privacy_consent.updated',
    queue: 'foodwaste.users.privacy-consent-updated',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'foodwaste.dlx',
        'x-message-ttl': 86400000, // 24 hours
      },
    },
  })
  handlePrivacyConsentUpdatedRabbitMQ(msg: object): void | Nack {
    try {
      const event = plainToClass(UserPrivacyConsentUpdatedEvent, msg);
      this.processPrivacyConsentUpdate(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process user.privacy_consent.updated event`, error);
      return new Nack(true); // Requeue for retry - important for compliance
    }
  }

  /**
   * Shared logic: Process privacy consent updates
   */
  private processPrivacyConsentUpdate(event: UserPrivacyConsentUpdatedEvent): void {
    try {
      this.logger.log(`Privacy consent updated for user ${event.email}: ${event.consentType}`);

      // TODO: Update compliance dashboard
      // TODO: Track consent changes for audit trail
      // TODO: Enable/disable features based on consent
      //   - Analytics tracking based on analyticsOptIn
      //   - Marketing emails based on marketingOptIn
      //   - Location tracking based on locationTrackingConsent
      // TODO: Send consent confirmation email

      this.logger.debug(`Privacy consent update event processed for user: ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process user.privacy_consent.updated event for user ${event.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Don't throw - event listeners should not break the flow
    }
  }
}
