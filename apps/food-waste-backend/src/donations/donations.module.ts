import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { DonationsAdminController } from './donations-admin.controller';
import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';
import { OrderEventsListener } from './listeners/order-events.listener';
import { DonationProcessor } from './processors/donation.processor';
import { DonationPool, DonationPoolSchema } from './schemas/donation-pool.schema';
import { UserDonation, UserDonationSchema } from './schemas/user-donation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DonationPool.name, schema: DonationPoolSchema },
      { name: UserDonation.name, schema: UserDonationSchema },
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
    DonationProcessor,
  ],
  exports: [DonationsService, 'DonationsService', MongooseModule],
})
export class DonationsModule {}
