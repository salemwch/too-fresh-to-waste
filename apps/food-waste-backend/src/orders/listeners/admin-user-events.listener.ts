import { RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { plainToClass } from 'class-transformer';

import {
  AdminUserSuspendedEvent,
  AdminUserBlockedEvent,
  AdminUserDeletedEvent,
} from '../../common/events/admin-user.events';
import { OrdersService } from '../order.service';

/**
 * Listener for admin user events in the Orders module
 * Handles order cancellation when users are suspended/blocked/deleted
 *
 * Dual-mode listener:
 * - @OnEvent: Legacy EventEmitter2 (fallback)
 * - @RabbitSubscribe: RabbitMQ message broker (production)
 */
@Injectable()
export class AdminUserEventsListener {
  private readonly logger = new Logger(AdminUserEventsListener.name);

  constructor(private readonly orderService: OrdersService) {}

  // ============================================
  // USER SUSPENDED HANDLERS
  // ============================================

  /**
   * LEGACY: EventEmitter2 handler for user suspension
   */
  @OnEvent('admin.user.suspended')
  async handleUserSuspendedLegacy(event: AdminUserSuspendedEvent): Promise<void> {
    await this.cancelUserOrders(
      event.userId,
      event.adminEmail,
      event.suspensionReason,
      'suspended',
    );
  }

  /**
   * RABBITMQ: Message broker handler for user suspension
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'admin.user.suspended',
    queue: 'foodwaste.orders.user-suspended',
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
      await this.cancelUserOrders(
        event.userId,
        event.adminEmail,
        event.suspensionReason,
        'suspended',
      );
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`CRITICAL: RabbitMQ failed to process admin.user.suspended event`, error);
      return new Nack(true); // Requeue for retry - critical for order consistency
    }
  }

  /**
   * Shared logic: Cancel user orders when suspended
   */
  private async cancelUserOrders(
    userId: string,
    adminEmail: string,
    reason: string,
    action: 'suspended' | 'blocked' | 'deleted',
  ): Promise<void> {
    try {
      this.logger.log(
        `User ${userId} ${action} by admin ${adminEmail}. Cancelling pending orders.`,
      );

      // Cancel all pending orders for this user
      const cancelledCount = await this.orderService.cancelUserPendingOrders(
        userId,
        `Account ${action} by admin: ${reason}`,
      );

      if (cancelledCount > 0) {
        this.logger.log(
          `Successfully cancelled ${cancelledCount} pending orders for ${action} user ${userId}`,
        );
      } else {
        this.logger.debug(`No pending orders to cancel for ${action} user ${userId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to cancel orders for ${action} user ${userId}:`, error);
      // Don't throw - order cancellation failure shouldn't block the admin action
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
    await this.cancelUserOrders(event.userId, event.adminEmail, event.blockReason, 'blocked');
    this.logger.warn(`SECURITY: All pending orders cancelled for blocked user ${event.userId}`);
  }

  /**
   * RABBITMQ: Message broker handler for user block
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'admin.user.blocked',
    queue: 'foodwaste.orders.user-blocked',
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
      await this.cancelUserOrders(event.userId, event.adminEmail, event.blockReason, 'blocked');
      this.logger.warn(`SECURITY: All pending orders cancelled for blocked user ${event.userId}`);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`CRITICAL: RabbitMQ failed to process admin.user.blocked event`, error);
      return new Nack(true); // Requeue for retry - critical security event
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
    await this.handleUserDeletion(event);
  }

  /**
   * RABBITMQ: Message broker handler for user deletion
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'admin.user.deleted',
    queue: 'foodwaste.orders.user-deleted',
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
      await this.handleUserDeletion(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`CRITICAL: RabbitMQ failed to process admin.user.deleted event`, error);
      return new Nack(true); // Requeue for retry - critical for GDPR compliance
    }
  }

  /**
   * Shared logic: Handle user deletion and order cleanup
   */
  private async handleUserDeletion(event: AdminUserDeletedEvent): Promise<void> {
    try {
      this.logger.log(
        `User ${event.userId} deleted (${event.hardDelete ? 'hard' : 'soft'}) by admin ${event.adminEmail}. Handling order history.`,
      );

      // Cancel any pending orders first
      const cancelledCount = await this.orderService.cancelUserPendingOrders(
        event.userId,
        `Account deleted by admin: ${event.deletionReason}`,
      );

      if (cancelledCount > 0) {
        this.logger.log(
          `Cancelled ${cancelledCount} pending orders for deleted user ${event.userId}`,
        );
      }

      // For hard delete, anonymize order history for GDPR compliance
      if (event.hardDelete) {
        await this.orderService.anonymizeUserOrders(event.userId);
        this.logger.log(`Anonymized order history for hard-deleted user ${event.userId}`);
      }

      this.logger.log(`Successfully handled orders for deleted user ${event.userId}`);
    } catch (error) {
      this.logger.error(`Failed to handle orders for deleted user ${event.userId}:`, error);
      // Don't throw - deletion should proceed even if order handling fails
    }
  }
}
