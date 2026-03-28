/**
 * User Lifecycle Events Listener
 * Handles user lifecycle events (registration, verification, deletion, etc.)
 * Supports both EventEmitter (legacy) and RabbitMQ messaging
 *
 * @module users/listeners
 */

import { RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { plainToClass } from 'class-transformer';

import {
  UserRegisteredEvent,
  UserEmailVerifiedEvent,
  UserPhoneVerifiedEvent,
  UserStatusChangedEvent,
  UserDataDeletionRequestedEvent,
  UserDataDeletionCompletedEvent,
  UserAccountRestoredEvent,
  UserProfileUpdatedEvent,
} from '../events/user.events';

const DEAD_LETTER_EXCHANGE = 'foodwaste.events.dlx';
const MESSAGE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class UserLifecycleEventsListener {
  private readonly logger = new Logger(UserLifecycleEventsListener.name);

  /**
   * Handle user registration events (Legacy EventEmitter)
   */
  @OnEvent('user.registered')
  handleUserRegisteredLegacy(event: UserRegisteredEvent): void {
    this.processUserRegistered(event);
  }

  /**
   * Handle user registration events (RabbitMQ)
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'user.registered',
    queue: 'foodwaste.users.registered',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE,
        'x-message-ttl': MESSAGE_TTL_MS,
      },
    },
  })
  handleUserRegistered(msg: object): void | Nack {
    try {
      const event = plainToClass(UserRegisteredEvent, msg);
      this.processUserRegistered(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process user.registered event`, error);
      return new Nack(true); // Requeue for retry
    }
  }

  /**
   * Process user registration logic
   * @private
   */
  private processUserRegistered(event: UserRegisteredEvent): void {
    try {
      this.logger.log(
        `New user registered: ${event.email} (${event.role}) at ${event.registeredAt}`,
      );

      // TODO: Send welcome email via NotificationService
      // TODO: Create loyalty account (handled by loyalty module listener)
      // TODO: Track registration analytics
      // TODO: Initialize user preferences with defaults

      this.logger.debug(`User registration event processed for user: ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process user.registered event for user ${event.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Don't throw - event listeners should not break the flow
    }
  }

  /**
   * Handle email verification events (Legacy EventEmitter)
   */
  @OnEvent('user.email.verified')
  handleEmailVerifiedLegacy(event: UserEmailVerifiedEvent): void {
    this.processEmailVerified(event);
  }

  /**
   * Handle email verification events (RabbitMQ)
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'user.email.verified',
    queue: 'foodwaste.users.email-verified',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE,
        'x-message-ttl': MESSAGE_TTL_MS,
      },
    },
  })
  handleEmailVerified(msg: object): void | Nack {
    try {
      const event = plainToClass(UserEmailVerifiedEvent, msg);
      this.processEmailVerified(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process user.email.verified event`, error);
      return new Nack(true); // Requeue for retry
    }
  }

  /**
   * Process email verification logic
   * @private
   */
  private processEmailVerified(event: UserEmailVerifiedEvent): void {
    try {
      this.logger.log(`Email verified for user: ${event.email}`);

      // TODO: Send email verification confirmation
      // TODO: Update user trust score
      // TODO: Track verification analytics
      // TODO: Award verification achievement/badge

      this.logger.debug(`Email verification event processed for user: ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process user.email.verified event for user ${event.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Don't throw - event listeners should not break the flow
    }
  }

  /**
   * Handle phone verification events (Legacy EventEmitter)
   */
  @OnEvent('user.phone.verified')
  handlePhoneVerifiedLegacy(event: UserPhoneVerifiedEvent): void {
    this.processPhoneVerified(event);
  }

  /**
   * Handle phone verification events (RabbitMQ)
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'user.phone.verified',
    queue: 'foodwaste.users.phone-verified',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE,
        'x-message-ttl': MESSAGE_TTL_MS,
      },
    },
  })
  handlePhoneVerified(msg: object): void | Nack {
    try {
      const event = plainToClass(UserPhoneVerifiedEvent, msg);
      this.processPhoneVerified(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process user.phone.verified event`, error);
      return new Nack(true); // Requeue for retry
    }
  }

  /**
   * Process phone verification logic
   * @private
   */
  private processPhoneVerified(event: UserPhoneVerifiedEvent): void {
    try {
      this.logger.log(`Phone verified for user: ${event.userId} (${event.phoneNumber})`);

      // TODO: Send SMS confirmation
      // TODO: Enable SMS notifications
      // TODO: Update user trust score
      // TODO: Track verification analytics

      this.logger.debug(`Phone verification event processed for user: ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process user.phone.verified event for user ${event.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Don't throw - event listeners should not break the flow
    }
  }

  /**
   * Handle user status change events (Legacy EventEmitter)
   */
  @OnEvent('user.status.changed')
  handleStatusChangedLegacy(event: UserStatusChangedEvent): void {
    this.processStatusChanged(event);
  }

  /**
   * Handle user status change events (RabbitMQ)
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'user.status.changed',
    queue: 'foodwaste.users.status-changed',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE,
        'x-message-ttl': MESSAGE_TTL_MS,
      },
    },
  })
  handleStatusChanged(msg: object): void | Nack {
    try {
      const event = plainToClass(UserStatusChangedEvent, msg);
      this.processStatusChanged(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process user.status.changed event`, error);
      return new Nack(true); // Requeue for retry - critical event
    }
  }

  /**
   * Process user status change logic
   * @private
   */
  private processStatusChanged(event: UserStatusChangedEvent): void {
    try {
      this.logger.log(
        `User status changed: ${event.email} from ${event.oldStatus} to ${event.newStatus}`,
      );

      // TODO: Handle status-specific logic
      // - SUSPENDED: Cancel active orders, invalidate sessions
      // - DELETED: Trigger data cleanup (handled by deletion events)
      // - ACTIVE: Re-enable user access

      this.logger.debug(`Status change event processed for user: ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process user.status.changed event for user ${event.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Don't throw - event listeners should not break the flow
    }
  }

  /**
   * Handle data deletion request events (Legacy EventEmitter)
   */
  @OnEvent('user.data_deletion.requested')
  handleDataDeletionRequestedLegacy(event: UserDataDeletionRequestedEvent): void {
    this.processDataDeletionRequested(event);
  }

  /**
   * Handle data deletion request events (RabbitMQ)
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'user.data_deletion.requested',
    queue: 'foodwaste.users.data-deletion-requested',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE,
        'x-message-ttl': MESSAGE_TTL_MS,
      },
    },
  })
  handleDataDeletionRequested(msg: object): void | Nack {
    try {
      const event = plainToClass(UserDataDeletionRequestedEvent, msg);
      this.processDataDeletionRequested(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process user.data_deletion.requested event`, error);
      return new Nack(true); // Requeue - compliance critical
    }
  }

  /**
   * Process data deletion request logic
   * @private
   */
  private processDataDeletionRequested(event: UserDataDeletionRequestedEvent): void {
    try {
      this.logger.log(`Data deletion requested for user ${event.email}: ${event.deletionType}`);

      // TODO: Send confirmation email with 30-day grace period
      // TODO: Schedule deletion job
      // TODO: Notify admins for compliance tracking
      // TODO: Log in compliance audit trail

      this.logger.debug(`Data deletion request event processed for user: ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process user.data_deletion.requested event for user ${event.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Don't throw - event listeners should not break the flow
    }
  }

  /**
   * Handle data deletion completion events (Legacy EventEmitter)
   */
  @OnEvent('user.data_deletion.completed')
  handleDataDeletionCompletedLegacy(event: UserDataDeletionCompletedEvent): void {
    this.processDataDeletionCompleted(event);
  }

  /**
   * Handle data deletion completion events (RabbitMQ)
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'user.data_deletion.completed',
    queue: 'foodwaste.users.data-deletion-completed',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE,
        'x-message-ttl': MESSAGE_TTL_MS,
      },
    },
  })
  handleDataDeletionCompleted(msg: object): void | Nack {
    try {
      const event = plainToClass(UserDataDeletionCompletedEvent, msg);
      this.processDataDeletionCompleted(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process user.data_deletion.completed event`, error);
      return new Nack(true); // Requeue - compliance critical
    }
  }

  /**
   * Process data deletion completion logic
   * @private
   */
  private processDataDeletionCompleted(event: UserDataDeletionCompletedEvent): void {
    try {
      this.logger.log(`Data deletion completed for user ${event.userId}: ${event.deletionType}`);

      // TODO: Send deletion confirmation email (if email retained)
      // TODO: Update compliance dashboard
      // TODO: Archive deletion audit logs
      // TODO: Remove user from all caches

      this.logger.debug(`Data deletion completion event processed for user: ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process user.data_deletion.completed event for user ${event.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Don't throw - event listeners should not break the flow
    }
  }

  /**
   * Handle account restoration events (Legacy EventEmitter)
   */
  @OnEvent('user.account.restored')
  handleAccountRestoredLegacy(event: UserAccountRestoredEvent): void {
    this.processAccountRestored(event);
  }

  /**
   * Handle account restoration events (RabbitMQ)
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'user.account.restored',
    queue: 'foodwaste.users.account-restored',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE,
        'x-message-ttl': MESSAGE_TTL_MS,
      },
    },
  })
  handleAccountRestored(msg: object): void | Nack {
    try {
      const event = plainToClass(UserAccountRestoredEvent, msg);
      this.processAccountRestored(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process user.account.restored event`, error);
      return new Nack(false); // Don't requeue - non-critical notification
    }
  }

  /**
   * Process account restoration logic
   * @private
   */
  private processAccountRestored(event: UserAccountRestoredEvent): void {
    try {
      this.logger.log(`Account restored for user ${event.email} by admin ${event.restoredBy}`);

      // TODO: Send account restoration notification email
      // TODO: Restore soft-deleted orders/data
      // TODO: Re-enable user access
      // TODO: Log admin action in audit trail

      this.logger.debug(`Account restoration event processed for user: ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process user.account.restored event for user ${event.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Don't throw - event listeners should not break the flow
    }
  }

  /**
   * Handle profile update events (Legacy EventEmitter)
   */
  @OnEvent('user.profile.updated')
  handleProfileUpdatedLegacy(event: UserProfileUpdatedEvent): void {
    this.processProfileUpdated(event);
  }

  /**
   * Handle profile update events (RabbitMQ)
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'user.profile.updated',
    queue: 'foodwaste.users.profile-updated',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE,
        'x-message-ttl': MESSAGE_TTL_MS,
      },
    },
  })
  handleProfileUpdated(msg: object): void | Nack {
    try {
      const event = plainToClass(UserProfileUpdatedEvent, msg);
      this.processProfileUpdated(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process user.profile.updated event`, error);
      return new Nack(false); // Don't requeue - non-critical cache update
    }
  }

  /**
   * Process profile update logic
   * @private
   */
  private processProfileUpdated(event: UserProfileUpdatedEvent): void {
    try {
      this.logger.log(`Profile updated for user ${event.email}: ${event.updatedFields.join(', ')}`);

      // TODO: Invalidate user cache
      // TODO: Update search index if name/email changed
      // TODO: Track profile completion percentage

      this.logger.debug(`Profile update event processed for user: ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process user.profile.updated event for user ${event.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Don't throw - event listeners should not break the flow
    }
  }
}
