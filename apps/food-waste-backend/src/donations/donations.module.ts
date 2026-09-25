import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CommonModule } from '../common/common.module';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import {
  PlatformTransaction,
  PlatformTransactionSchema,
} from '../payments/schemas/platform-transaction.schema';

import { DonationsAdminController } from './donations-admin.controller';
import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';
import { AdminUserEventsListener } from './listeners/admin-user-events.listener';
import { OrderEventsListener } from './listeners/order-events.listener';
import { DonationProcessor } from './processors/donation.processor';
import { DonationPool, DonationPoolSchema } from './schemas/donation-pool.schema';
import {
  DonationPoolSnapshot,
  DonationPoolSnapshotSchema,
} from './schemas/donation-pool-snapshot.schema';
import { PoolContributor, PoolContributorSchema } from './schemas/pool-contributor.schema';
import { UserDonation, UserDonationSchema } from './schemas/user-donation.schema';

@Module({
  imports: [
    // DonationsService injects CronLockService from CommonModule, which is not
    // @Global — without this import Nest cannot resolve it.
    CommonModule,
    MongooseModule.forFeature([
      { name: DonationPool.name, schema: DonationPoolSchema },
      { name: DonationPoolSnapshot.name, schema: DonationPoolSnapshotSchema },
      { name: UserDonation.name, schema: UserDonationSchema },
      { name: PoolContributor.name, schema: PoolContributorSchema },
      { name: Order.name, schema: OrderSchema },
      // The DONATION pledge is booked with the pool contribution, here.
      { name: PlatformTransaction.name, schema: PlatformTransactionSchema },
    ]),
    BullModule.registerQueue({
      name: 'donations',
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    }),
  ],
  controllers: [DonationsController, DonationsAdminController],
  providers: [
    DonationsService,
    {
      provide: 'DonationsService',
      useExisting: DonationsService,
    },
    OrderEventsListener,
    AdminUserEventsListener,
    DonationProcessor,
  ],
  exports: [DonationsService, 'DonationsService', MongooseModule],
})
export class DonationsModule {}
