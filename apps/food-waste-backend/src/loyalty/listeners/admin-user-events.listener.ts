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
import { LoyaltyAccount, LoyaltyAccountDocument } from '../schemas/loyalty-account.schema';

@Injectable()
export class AdminUserEventsListener {
  private readonly logger = new Logger('LoyaltyAdminUserEventsListener');

  constructor(
    @InjectModel(LoyaltyAccount.name)
    private readonly loyaltyModel: Model<LoyaltyAccountDocument>,
  ) {}

  // ============================================
  // USER DELETED HANDLERS
  // ============================================

  @OnEvent('admin.user.deleted')
  async handleUserDeletedLegacy(event: AdminUserDeletedEvent): Promise<void> {
    await this.deactivateUserLoyalty(event.userId);
  }

  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'admin.user.deleted',
    queue: 'foodwaste.loyalty.user-deleted',
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
      await this.deactivateUserLoyalty(event.userId);
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process admin.user.deleted for loyalty`, error);
      return new Nack(true);
    }
  }

  // ============================================
  // USER RESTORED HANDLERS
  // ============================================

  @OnEvent('admin.user.restored')
  async handleUserRestoredLegacy(event: AdminUserRestoredEvent): Promise<void> {
    await this.reactivateUserLoyalty(event.userId);
  }

  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'admin.user.restored',
    queue: 'foodwaste.loyalty.user-restored',
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
      await this.reactivateUserLoyalty(event.userId);
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process admin.user.restored for loyalty`, error);
      return new Nack(true);
    }
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async deactivateUserLoyalty(userId: string): Promise<void> {
    try {
      const result = await this.loyaltyModel.updateOne(
        { userId, isActive: true },
        { $set: { isActive: false, lastActivity: new Date() } },
      );

      if (result.modifiedCount > 0) {
        this.logger.log(`Deactivated loyalty account for user ${userId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to deactivate loyalty for user ${userId}`, error);
    }
  }

  private async reactivateUserLoyalty(userId: string): Promise<void> {
    try {
      const result = await this.loyaltyModel.updateOne(
        { userId, isActive: false },
        { $set: { isActive: true, lastActivity: new Date() } },
      );

      if (result.modifiedCount > 0) {
        this.logger.log(`Reactivated loyalty account for user ${userId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to reactivate loyalty for user ${userId}`, error);
    }
  }
}
