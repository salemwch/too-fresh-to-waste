import { RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { plainToClass } from 'class-transformer';
import { Model } from 'mongoose';

import {
  AdminUserDeletedEvent,
  AdminUserRestoredEvent,
} from '../../common/events/admin-user.events';
import {
  NotificationPreference,
  NotificationPreferenceDocument,
} from '../schemas/notification-preference.schema';

@Injectable()
export class AdminUserEventsListener {
  private readonly logger = new Logger('NotificationsAdminUserEventsListener');

  constructor(
    @InjectModel(NotificationPreference.name)
    private readonly prefModel: Model<NotificationPreferenceDocument>,
  ) {}

  // ============================================
  // USER DELETED HANDLERS
  // ============================================

  @OnEvent('admin.user.deleted')
  async handleUserDeletedLegacy(event: AdminUserDeletedEvent): Promise<void> {
    await this.sanitizeUserPreferences(event.userId);
  }

  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'admin.user.deleted',
    queue: 'foodwaste.notifications.user-deleted',
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
      await this.sanitizeUserPreferences(event.userId);
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process admin.user.deleted for notifications`, error);
      return new Nack(true);
    }
  }

  // ============================================
  // USER RESTORED HANDLERS
  // ============================================

  @OnEvent('admin.user.restored')
  async handleUserRestoredLegacy(event: AdminUserRestoredEvent): Promise<void> {
    await this.reEnableUserPreferences(event.userId);
  }

  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'admin.user.restored',
    queue: 'foodwaste.notifications.user-restored',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'foodwaste.dlx',
        'x-message-ttl': 86400000,
      },
    },
  })
  async handleUserRestoredRabbitMQ(msg: object): Promise<void | Nack> {
    try {
      const event = plainToClass(AdminUserRestoredEvent, msg);
      await this.reEnableUserPreferences(event.userId);
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process admin.user.restored for notifications`, error);
      return new Nack(true);
    }
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async sanitizeUserPreferences(userId: string): Promise<void> {
    try {
      const result = await this.prefModel.updateOne(
        { userId },
        {
          $set: {
            deviceTokens: [],
            globalPushEnabled: false,
            globalEmailEnabled: false,
            globalSmsEnabled: false,
          },
        },
      );

      if (result.modifiedCount > 0) {
        this.logger.log(`Sanitized notification preferences for user ${userId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to sanitize notification preferences for user ${userId}`, error);
    }
  }

  private async reEnableUserPreferences(userId: string): Promise<void> {
    try {
      // Re-enable email only — push tokens were cleared and must be re-registered by the client
      const result = await this.prefModel.updateOne(
        { userId },
        { $set: { globalEmailEnabled: true } },
      );

      if (result.modifiedCount > 0) {
        this.logger.log(`Re-enabled email notifications for restored user ${userId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to re-enable notifications for user ${userId}`, error);
    }
  }
}
