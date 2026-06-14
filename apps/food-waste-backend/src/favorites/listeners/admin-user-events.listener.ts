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
import { Favorite, FavoriteDocument } from '../schemas/favorite.schema';
import { FavoriteList, FavoriteListDocument } from '../schemas/favorite-list.schema';

@Injectable()
export class AdminUserEventsListener {
  private readonly logger = new Logger('FavoritesAdminUserEventsListener');

  constructor(
    @InjectModel(Favorite.name)
    private readonly favoriteModel: Model<FavoriteDocument>,
    @InjectModel(FavoriteList.name)
    private readonly favoriteListModel: Model<FavoriteListDocument>,
  ) {}

  // ============================================
  // USER DELETED HANDLERS
  // ============================================

  @OnEvent('admin.user.deleted')
  async handleUserDeletedLegacy(event: AdminUserDeletedEvent): Promise<void> {
    await this.deactivateUserFavorites(event.userId);
  }

  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'admin.user.deleted',
    queue: 'foodwaste.favorites.user-deleted',
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
      await this.deactivateUserFavorites(event.userId);
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process admin.user.deleted for favorites`, error);
      return new Nack(true);
    }
  }

  // ============================================
  // USER RESTORED HANDLERS
  // ============================================

  @OnEvent('admin.user.restored')
  async handleUserRestoredLegacy(event: AdminUserRestoredEvent): Promise<void> {
    await this.reactivateUserFavorites(event.userId);
  }

  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'admin.user.restored',
    queue: 'foodwaste.favorites.user-restored',
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
      await this.reactivateUserFavorites(event.userId);
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process admin.user.restored for favorites`, error);
      return new Nack(true);
    }
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async deactivateUserFavorites(userId: string): Promise<void> {
    try {
      const [favResult, listResult] = await Promise.all([
        this.favoriteModel.updateMany({ userId, isActive: true }, { $set: { isActive: false } }),
        this.favoriteListModel.updateMany(
          { userId, isActive: true },
          { $set: { isActive: false } },
        ),
      ]);

      const total = favResult.modifiedCount + listResult.modifiedCount;
      if (total > 0) {
        this.logger.log(
          `Deactivated ${favResult.modifiedCount} favorite(s) and ${listResult.modifiedCount} list(s) for user ${userId}`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to deactivate favorites for user ${userId}`, error);
    }
  }

  private async reactivateUserFavorites(userId: string): Promise<void> {
    try {
      const [favResult, listResult] = await Promise.all([
        this.favoriteModel.updateMany({ userId, isActive: false }, { $set: { isActive: true } }),
        this.favoriteListModel.updateMany(
          { userId, isActive: false },
          { $set: { isActive: true } },
        ),
      ]);

      const total = favResult.modifiedCount + listResult.modifiedCount;
      if (total > 0) {
        this.logger.log(
          `Reactivated ${favResult.modifiedCount} favorite(s) and ${listResult.modifiedCount} list(s) for user ${userId}`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to reactivate favorites for user ${userId}`, error);
    }
  }
}
