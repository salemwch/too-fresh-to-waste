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
import { Review, ReviewDocument } from '../schemas/review.schema';

const CASCADE_DELETION_REASON = 'user_account_deleted';

@Injectable()
export class AdminUserEventsListener {
  private readonly logger = new Logger('ReviewsAdminUserEventsListener');

  constructor(
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>,
  ) {}

  // ============================================
  // USER DELETED HANDLERS
  // ============================================

  @OnEvent('admin.user.deleted')
  async handleUserDeletedLegacy(event: AdminUserDeletedEvent): Promise<void> {
    await this.softDeleteUserReviews(event);
  }

  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'admin.user.deleted',
    queue: 'foodwaste.reviews.user-deleted',
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
      await this.softDeleteUserReviews(event);
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process admin.user.deleted for reviews`, error);
      return new Nack(true);
    }
  }

  // ============================================
  // USER RESTORED HANDLERS
  // ============================================

  @OnEvent('admin.user.restored')
  async handleUserRestoredLegacy(event: AdminUserRestoredEvent): Promise<void> {
    await this.restoreCascadeDeletedReviews(event.userId);
  }

  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'admin.user.restored',
    queue: 'foodwaste.reviews.user-restored',
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
      await this.restoreCascadeDeletedReviews(event.userId);
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process admin.user.restored for reviews`, error);
      return new Nack(true);
    }
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async softDeleteUserReviews(event: AdminUserDeletedEvent): Promise<void> {
    try {
      const now = new Date();
      const result = await this.reviewModel
        .updateMany(
          { reviewerId: event.userId, isDeleted: { $ne: true } },
          {
            $set: {
              isDeleted: true,
              deletedAt: now,
              deletedBy: event.adminId,
              deletionReason: CASCADE_DELETION_REASON,
            },
          },
        )
        .setOptions({ includeDeleted: true });

      if (result.modifiedCount > 0) {
        this.logger.log(`Soft-deleted ${result.modifiedCount} review(s) for user ${event.userId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to soft-delete reviews for user ${event.userId}`, error);
    }
  }

  private async restoreCascadeDeletedReviews(userId: string): Promise<void> {
    try {
      // Only restore reviews that were cascade-deleted, not moderation-deleted
      const result = await this.reviewModel
        .updateMany(
          {
            reviewerId: userId,
            isDeleted: true,
            deletionReason: CASCADE_DELETION_REASON,
          },
          {
            $set: { isDeleted: false },
            $unset: { deletedAt: 1, deletedBy: 1, deletionReason: 1 },
          },
        )
        .setOptions({ includeDeleted: true });

      if (result.modifiedCount > 0) {
        this.logger.log(
          `Restored ${result.modifiedCount} cascade-deleted review(s) for user ${userId}`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to restore reviews for user ${userId}`, error);
    }
  }
}
