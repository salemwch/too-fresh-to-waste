import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
import { plainToClass } from 'class-transformer';
import {
  AdminUserSuspendedEvent,
  AdminUserBlockedEvent,
  AdminUserDeletedEvent,
  AdminUserActivatedEvent,
} from '../../common/events/admin-user.events';
import { SessionManagementService } from '../services/session-management.service';

/**
 * Listener for admin user events in the Auth module
 * Handles session revocation when users are suspended/blocked/deleted
 *
 * Dual-mode listener:
 * - @OnEvent: Legacy EventEmitter2 (fallback)
 * - @RabbitSubscribe: RabbitMQ message broker (production)
 */
@Injectable()
export class AdminUserEventsListener {
  private readonly logger = new Logger(AdminUserEventsListener.name);

  constructor(
    private readonly sessionManagementService: SessionManagementService,
  ) {}

  // ============================================
  // USER SUSPENDED HANDLERS
  // ============================================

  /**
   * LEGACY: EventEmitter2 handler for user suspension
   */
  @OnEvent('admin.user.suspended')
  async handleUserSuspendedLegacy(event: AdminUserSuspendedEvent): Promise<void> {
    await this.revokeUserSessions(event.userId, event.adminEmail, 'suspended');
  }

  /**
   * RABBITMQ: Message broker handler for user suspension
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'admin.user.suspended',
    queue: 'foodwaste.auth.user-suspended',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'foodwaste.dlx',
        'x-message-ttl': 86400000, // 24 hours
      },
    },
  })
  async handleUserSuspendedRabbitMQ(msg: object): Promise<void | Nack> {
    try {
      const event = plainToClass(AdminUserSuspendedEvent, msg);
      await this.revokeUserSessions(event.userId, event.adminEmail, 'suspended');
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process user.suspended event`, error);
      return new Nack(true); // Requeue for retry
    }
  }

  /**
   * Shared logic: Revoke all sessions when user is suspended
   */
  private async revokeUserSessions(
    userId: string,
    adminEmail: string,
    reason: 'suspended' | 'blocked' | 'deleted',
  ): Promise<void> {
    try {
      this.logger.log(
        `User ${userId} ${reason} by admin ${adminEmail}. Revoking all sessions.`,
      );

      await this.sessionManagementService.destroyAllUserSessions(userId);

      this.logger.log(`Successfully revoked all sessions for ${reason} user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to revoke sessions for ${reason} user ${userId}:`,
        error,
      );
      // Don't throw - session revocation failure shouldn't block the operation
    }
  }

  // ============================================
  // USER BLOCKED HANDLERS
  // ============================================

  /**
   * LEGACY: EventEmitter2 handler for user block
   */
  @OnEvent('admin.user.blocked')
  async handleUserBlockedLegacy(event: AdminUserBlockedEvent): Promise<void> {
    await this.revokeUserSessions(event.userId, event.adminEmail, 'blocked');
    this.logger.warn(
      `SECURITY: All sessions revoked for blocked user ${event.userId}. Reason: ${event.blockReason}`,
    );
  }

  /**
   * RABBITMQ: Message broker handler for user block
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'admin.user.blocked',
    queue: 'foodwaste.auth.user-blocked',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'foodwaste.dlx',
        'x-message-ttl': 86400000,
      },
    },
  })
  async handleUserBlockedRabbitMQ(msg: object): Promise<void | Nack> {
    try {
      const event = plainToClass(AdminUserBlockedEvent, msg);
      await this.revokeUserSessions(event.userId, event.adminEmail, 'blocked');
      this.logger.warn(
        `SECURITY: All sessions revoked for blocked user ${event.userId}. Reason: ${event.blockReason}`,
      );
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`CRITICAL: RabbitMQ failed to process user.blocked event`, error);
      return new Nack(true); // Requeue for retry
    }
  }

  // ============================================
  // USER DELETED HANDLERS
  // ============================================

  /**
   * LEGACY: EventEmitter2 handler for user deletion
   */
  @OnEvent('admin.user.deleted')
  async handleUserDeletedLegacy(event: AdminUserDeletedEvent): Promise<void> {
    await this.cleanupUserAuthData(event.userId, event.adminEmail, event.hardDelete);
  }

  /**
   * RABBITMQ: Message broker handler for user deletion
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'admin.user.deleted',
    queue: 'foodwaste.auth.user-deleted',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'foodwaste.dlx',
        'x-message-ttl': 86400000,
      },
    },
  })
  async handleUserDeletedRabbitMQ(msg: object): Promise<void | Nack> {
    try {
      const event = plainToClass(AdminUserDeletedEvent, msg);
      await this.cleanupUserAuthData(event.userId, event.adminEmail, event.hardDelete);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process user.deleted event`, error);
      return new Nack(true); // Requeue for retry
    }
  }

  /**
   * Shared logic: Clean up auth data when user is deleted
   */
  private async cleanupUserAuthData(
    userId: string,
    adminEmail: string,
    hardDelete: boolean,
  ): Promise<void> {
    try {
      this.logger.log(
        `User ${userId} deleted (${hardDelete ? 'hard' : 'soft'}) by admin ${adminEmail}. Cleaning up auth data.`,
      );

      // Revoke all sessions
      await this.sessionManagementService.destroyAllUserSessions(userId);

      // Additional cleanup for hard delete
      if (hardDelete) {
        // Note: Refresh tokens are stored with user document, so they'll be deleted automatically
        // MFA settings are also part of user document
        this.logger.log(
          `Hard delete: Authentication data will be purged with user document for ${userId}`,
        );
      }

      this.logger.log(`Successfully cleaned up auth data for deleted user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to clean up auth data for deleted user ${userId}:`,
        error,
      );
      // Don't throw - deletion should proceed even if cleanup fails
    }
  }

  // ============================================
  // USER ACTIVATED HANDLERS
  // ============================================

  /**
   * LEGACY: EventEmitter2 handler for user activation
   */
  @OnEvent('admin.user.activated')
  async handleUserActivatedLegacy(event: AdminUserActivatedEvent): Promise<void> {
    this.logger.log(
      `User ${event.userId} activated by admin ${event.adminEmail}. User can now log in again.`,
    );
  }

  /**
   * RABBITMQ: Message broker handler for user activation
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'admin.user.activated',
    queue: 'foodwaste.auth.user-activated',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'foodwaste.dlx',
        'x-message-ttl': 86400000,
      },
    },
  })
  async handleUserActivatedRabbitMQ(msg: object): Promise<void | Nack> {
    try {
      const event = plainToClass(AdminUserActivatedEvent, msg);
      this.logger.log(
        `User ${event.userId} activated by admin ${event.adminEmail}. User can now log in again.`,
      );
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process user.activated event`, error);
      return new Nack(false); // Don't requeue - just log
    }
  }
}
