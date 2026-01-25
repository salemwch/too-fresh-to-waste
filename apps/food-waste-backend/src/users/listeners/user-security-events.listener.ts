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

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
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
  async handlePasswordChangedLegacy(event: UserPasswordChangedEvent): Promise<void> {
    await this.processPasswordChanged(event);
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
  async handlePasswordChangedRabbitMQ(msg: object): Promise<void | Nack> {
    try {
      const event = plainToClass(UserPasswordChangedEvent, msg);
      await this.processPasswordChanged(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(
        `RabbitMQ: Failed to process user.password.changed event`,
        error,
      );
      return new Nack(true); // Requeue for retry - critical security event
    }
  }

  /**
   * Shared logic: Handle password change events
   * Log security event for monitoring suspicious activity
   */
  private async processPasswordChanged(event: UserPasswordChangedEvent): Promise<void> {
    try {
      this.logger.log(
        `Password changed for user ${event.email} from IP ${event.ipAddress}`,
      );

      // TODO: Add integration with security monitoring service
      // TODO: Send security alert email to user
      // TODO: Invalidate all existing sessions except current

      this.logger.debug(
        `Password change event processed for user: ${event.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process user.password.changed event for user ${event.userId}: ${error.message}`,
        error.stack,
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
  async handleAccountLockedLegacy(event: UserAccountLockedEvent): Promise<void> {
    await this.processAccountLocked(event);
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
  async handleAccountLockedRabbitMQ(msg: object): Promise<void | Nack> {
    try {
      const event = plainToClass(UserAccountLockedEvent, msg);
      await this.processAccountLocked(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(
        `RabbitMQ: Failed to process user.account.locked event`,
        error,
      );
      return new Nack(true); // Requeue for retry - critical security event
    }
  }

  /**
   * Shared logic: Handle account locked events
   * Alert admins for potential brute-force attacks
   */
  private async processAccountLocked(event: UserAccountLockedEvent): Promise<void> {
    try {
      this.logger.warn(
        `Account locked for user ${event.email} after ${event.failedAttempts} failed attempts from IP ${event.ipAddress}`,
      );

      // TODO: Send security alert email to user
      // TODO: Notify admins if multiple accounts locked from same IP
      // TODO: Consider IP blocking if threshold exceeded

      this.logger.debug(
        `Account locked event processed for user: ${event.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process user.account.locked event for user ${event.userId}: ${error.message}`,
        error.stack,
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
  async handleAccountUnlockedLegacy(event: UserAccountUnlockedEvent): Promise<void> {
    await this.processAccountUnlocked(event);
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
  async handleAccountUnlockedRabbitMQ(msg: object): Promise<void | Nack> {
    try {
      const event = plainToClass(UserAccountUnlockedEvent, msg);
      await this.processAccountUnlocked(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(
        `RabbitMQ: Failed to process user.account.unlocked event`,
        error,
      );
      return new Nack(false); // Don't requeue - non-critical event
    }
  }

  /**
   * Shared logic: Handle account unlocked events
   * Log admin action for audit trail
   */
  private async processAccountUnlocked(event: UserAccountUnlockedEvent): Promise<void> {
    try {
      this.logger.log(
        `Account unlocked for user ${event.email} by admin ${event.unlockedBy}`,
      );

      // TODO: Send notification email to user
      // TODO: Log admin action in audit trail

      this.logger.debug(
        `Account unlocked event processed for user: ${event.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process user.account.unlocked event for user ${event.userId}: ${error.message}`,
        error.stack,
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
  async handleMfaEnabledLegacy(event: UserMfaEnabledEvent): Promise<void> {
    await this.processMfaEnabled(event);
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
  async handleMfaEnabledRabbitMQ(msg: object): Promise<void | Nack> {
    try {
      const event = plainToClass(UserMfaEnabledEvent, msg);
      await this.processMfaEnabled(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(
        `RabbitMQ: Failed to process user.mfa.enabled event`,
        error,
      );
      return new Nack(true); // Requeue for retry - critical security event
    }
  }

  /**
   * Shared logic: Handle MFA enabled events
   * Log security enhancement for compliance
   */
  private async processMfaEnabled(event: UserMfaEnabledEvent): Promise<void> {
    try {
      this.logger.log(
        `MFA enabled for user ${event.email} using method: ${event.mfaMethod}`,
      );

      // TODO: Send security confirmation email
      // TODO: Update user security score
      // TODO: Award achievement/badge for security-conscious users

      this.logger.debug(`MFA enabled event processed for user: ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process user.mfa.enabled event for user ${event.userId}: ${error.message}`,
        error.stack,
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
  async handleMfaDisabledLegacy(event: UserMfaDisabledEvent): Promise<void> {
    await this.processMfaDisabled(event);
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
  async handleMfaDisabledRabbitMQ(msg: object): Promise<void | Nack> {
    try {
      const event = plainToClass(UserMfaDisabledEvent, msg);
      await this.processMfaDisabled(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(
        `RabbitMQ: Failed to process user.mfa.disabled event`,
        error,
      );
      return new Nack(false); // Don't requeue - non-critical event
    }
  }

  /**
   * Shared logic: Handle MFA disabled events
   * Alert for security downgrade
   */
  private async processMfaDisabled(event: UserMfaDisabledEvent): Promise<void> {
    try {
      this.logger.warn(`MFA disabled for user ${event.email}`);

      // TODO: Send security warning email
      // TODO: Alert admins for high-value merchant accounts
      // TODO: Update user security score

      this.logger.debug(
        `MFA disabled event processed for user: ${event.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process user.mfa.disabled event for user ${event.userId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
