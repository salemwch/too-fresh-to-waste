import { RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { plainToClass } from 'class-transformer';
import { Model } from 'mongoose';

import { AdminUserDeletedEvent } from '../../common/events/admin-user.events';
import { UserDonation, UserDonationDocument } from '../schemas/user-donation.schema';

@Injectable()
export class AdminUserEventsListener {
  private readonly logger = new Logger('DonationsAdminUserEventsListener');

  constructor(
    @InjectModel(UserDonation.name)
    private readonly userDonationModel: Model<UserDonationDocument>,
  ) {}

  // ============================================
  // USER DELETED HANDLERS (no restore — financial records)
  // ============================================

  @OnEvent('admin.user.deleted')
  async handleUserDeletedLegacy(event: AdminUserDeletedEvent): Promise<void> {
    await this.softDeleteUserDonations(event);
  }

  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'admin.user.deleted',
    queue: 'foodwaste.donations.user-deleted',
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
      await this.softDeleteUserDonations(event);
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process admin.user.deleted for donations`, error);
      return new Nack(true);
    }
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async softDeleteUserDonations(event: AdminUserDeletedEvent): Promise<void> {
    try {
      const now = new Date();
      const result = await this.userDonationModel
        .updateMany(
          { userId: event.userId, isDeleted: { $ne: true } },
          {
            $set: {
              isDeleted: true,
              deletedAt: now,
              deletedBy: event.adminId,
            },
          },
        )
        .setOptions({ includeDeleted: true });

      if (result.modifiedCount > 0) {
        this.logger.log(
          `Soft-deleted ${result.modifiedCount} donation(s) for user ${event.userId}`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to soft-delete donations for user ${event.userId}`, error);
    }
  }
}
