import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { DonationsAdminController } from './donations-admin.controller';
import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';
import { OrderEventsListener } from './listeners/order-events.listener';
import { DonationPool, DonationPoolSchema } from './schemas/donation-pool.schema';
import { UserDonation, UserDonationSchema } from './schemas/user-donation.schema';

/**
 * DonationsModule
 * Enterprise-grade module for donation management
 * Handles donation pools, user contributions, and impact tracking
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DonationPool.name, schema: DonationPoolSchema },
      { name: UserDonation.name, schema: UserDonationSchema },
    ]),
  ],
  controllers: [DonationsController, DonationsAdminController],
  providers: [
    DonationsService,
    {
      provide: 'DonationsService',
      useExisting: DonationsService,
    },
    OrderEventsListener, // Event listener for order-related events
  ],
  exports: [DonationsService, 'DonationsService', MongooseModule],
})
export class DonationsModule {}
