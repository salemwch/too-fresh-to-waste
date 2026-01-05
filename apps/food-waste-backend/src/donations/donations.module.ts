import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DonationPool, DonationPoolSchema } from './schemas/donation-pool.schema';
import { UserDonation, UserDonationSchema } from './schemas/user-donation.schema';
import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';

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
    controllers: [DonationsController],
    providers: [
        DonationsService,
        {
            provide: 'DonationsService',
            useExisting: DonationsService,
        },
    ],
    exports: [DonationsService, 'DonationsService'], // Export both for flexibility
})
export class DonationsModule {}
