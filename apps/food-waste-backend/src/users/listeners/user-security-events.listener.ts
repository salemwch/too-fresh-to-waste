/**
 * User Security Events Listener
 * Handles security-related user events for logging and monitoring
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

import {
  UserPasswordChangedEvent,
  UserAccountLockedEvent,
  UserAccountUnlockedEvent,
  UserMfaEnabledEvent,
  UserMfaDisabledEvent,
} from '../events/user.events';

@Injectable()
export class UserSecurityEventsListener {
  private readonly logger = new Logger(UserSecurityEventsListener.name);

  // ============================================
  // PASSWORD CHANGED HANDLERS
  // ============================================

  /**
   * LEGACY: EventEmitter2 handler for password changes
   */
  @OnEvent('user.password.changed')
  handlePasswordChangedLegacy(event: UserPasswordChangedEvent): void {
    this.processPasswordChanged(event);
  }

  /**
   * RABBITMQ: Message broker handler for password changes
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'user.password.changed',
    queue: 'foodwaste.users.password-changed',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'foodwaste.dlx',
        'x-message-ttl': 86400000, // 24 hours
      },
    },
  })
  handlePasswordChangedRabbitMQ(msg: object): void | Nack {
    try {
      const event = plainToClass(UserPasswordChangedEvent, msg);
      this.processPasswordChanged(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process user.password.changed event`, error);
      return new Nack(true); // Requeue for retry - critical security event
    }
  }

  /**
   * Shared logic: Handle password change events
   * Log security event for monitoring suspicious activity
   */
  private processPasswordChanged(event: UserPasswordChangedEvent): void {
    try {
      this.logger.log(`Password changed for user ${event.email} from IP ${event.ipAddress}`);

      // TODO: Add integration with security monitoring service
      // TODO: Send security alert email to user
      // TODO: Invalidate all existing sessions except current

      this.logger.debug(`Password change event processed for user: ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process user.password.changed event for user ${event.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Don't throw - event listeners should not break the flow
    }
  }

  // ============================================
  // ACCOUNT LOCKED HANDLERS
  // ============================================

  /**
   * LEGACY: EventEmitter2 handler for account locked
   */
  @OnEvent('user.account.locked')
  handleAccountLockedLegacy(event: UserAccountLockedEvent): void {
    this.processAccountLocked(event);
  }

  /**
   * RABBITMQ: Message broker handler for account locked
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'user.account.locked',
    queue: 'foodwaste.users.account-locked',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'foodwaste.dlx',
        'x-message-ttl': 86400000, // 24 hours
      },
    },
  })
  handleAccountLockedRabbitMQ(msg: object): void | Nack {
    try {
      const event = plainToClass(UserAccountLockedEvent, msg);
      this.processAccountLocked(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process user.account.locked event`, error);
      return new Nack(true); // Requeue for retry - critical security event
    }
  }

  /**
   * Shared logic: Handle account locked events
   * Alert admins for potential brute-force attacks
   */
  private processAccountLocked(event: UserAccountLockedEvent): void {
    try {
      this.logger.warn(
        `Account locked for user ${event.email} after ${event.failedAttempts} failed attempts from IP ${event.ipAddress}`,
      );

      // TODO: Send security alert email to user
      // TODO: Notify admins if multiple accounts locked from same IP
      // TODO: Consider IP blocking if threshold exceeded

      this.logger.debug(`Account locked event processed for user: ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process user.account.locked event for user ${event.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  // ============================================
  // ACCOUNT UNLOCKED HANDLERS
  // ============================================

  /**
   * LEGACY: EventEmitter2 handler for account unlocked
   */
  @OnEvent('user.account.unlocked')
  handleAccountUnlockedLegacy(event: UserAccountUnlockedEvent): void {
    this.processAccountUnlocked(event);
  }

  /**
   * RABBITMQ: Message broker handler for account unlocked
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'user.account.unlocked',
    queue: 'foodwaste.users.account-unlocked',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'foodwaste.dlx',
        'x-message-ttl': 86400000, // 24 hours
      },
    },
  })
  handleAccountUnlockedRabbitMQ(msg: object): void | Nack {
    try {
      const event = plainToClass(UserAccountUnlockedEvent, msg);
      this.processAccountUnlocked(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process user.account.unlocked event`, error);
      return new Nack(false); // Don't requeue - non-critical event
    }
  }

  /**
   * Shared logic: Handle account unlocked events
   * Log admin action for audit trail
   */
  private processAccountUnlocked(event: UserAccountUnlockedEvent): void {
    try {
      this.logger.log(`Account unlocked for user ${event.email} by admin ${event.unlockedBy}`);

      // TODO: Send notification email to user
      // TODO: Log admin action in audit trail

      this.logger.debug(`Account unlocked event processed for user: ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process user.account.unlocked event for user ${event.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  // ============================================
  // MFA ENABLED HANDLERS
  // ============================================

  /**
   * LEGACY: EventEmitter2 handler for MFA enabled
   */
  @OnEvent('user.mfa.enabled')
  handleMfaEnabledLegacy(event: UserMfaEnabledEvent): void {
    this.processMfaEnabled(event);
  }

  /**
   * RABBITMQ: Message broker handler for MFA enabled
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'user.mfa.enabled',
    queue: 'foodwaste.users.mfa-enabled',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'foodwaste.dlx',
        'x-message-ttl': 86400000, // 24 hours
      },
    },
  })
  handleMfaEnabledRabbitMQ(msg: object): void | Nack {
    try {
      const event = plainToClass(UserMfaEnabledEvent, msg);
      this.processMfaEnabled(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process user.mfa.enabled event`, error);
      return new Nack(true); // Requeue for retry - critical security event
    }
  }

  /**
   * Shared logic: Handle MFA enabled events
   * Log security enhancement for compliance
   */
  private processMfaEnabled(event: UserMfaEnabledEvent): void {
    try {
      this.logger.log(`MFA enabled for user ${event.email} using method: ${event.mfaMethod}`);

      // TODO: Send security confirmation email
      // TODO: Update user security score
      // TODO: Award achievement/badge for security-conscious users

      this.logger.debug(`MFA enabled event processed for user: ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process user.mfa.enabled event for user ${event.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  // ============================================
  // MFA DISABLED HANDLERS
  // ============================================

  /**
   * LEGACY: EventEmitter2 handler for MFA disabled
   */
  @OnEvent('user.mfa.disabled')
  handleMfaDisabledLegacy(event: UserMfaDisabledEvent): void {
    this.processMfaDisabled(event);
  }

  /**
   * RABBITMQ: Message broker handler for MFA disabled
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'user.mfa.disabled',
    queue: 'foodwaste.users.mfa-disabled',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'foodwaste.dlx',
        'x-message-ttl': 86400000, // 24 hours
      },
    },
  })
  handleMfaDisabledRabbitMQ(msg: object): void | Nack {
    try {
      const event = plainToClass(UserMfaDisabledEvent, msg);
      this.processMfaDisabled(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process user.mfa.disabled event`, error);
      return new Nack(false); // Don't requeue - non-critical event
    }
  }

  /**
   * Shared logic: Handle MFA disabled events
   * Alert for security downgrade
   */
  private processMfaDisabled(event: UserMfaDisabledEvent): void {
    try {
      this.logger.warn(`MFA disabled for user ${event.email}`);

      // TODO: Send security warning email
      // TODO: Alert admins for high-value merchant accounts
      // TODO: Update user security score

      this.logger.debug(`MFA disabled event processed for user: ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process user.mfa.disabled event for user ${event.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
