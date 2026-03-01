import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
    ArchiveData,
    ArchiveDataSchema,
} from './schemas/archive-data.schema';
import { ArchiveService } from './archive.service';
import { ArchiveTask } from './tasks/archive.task';

// Entity schemas required for archive queries
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Review, ReviewSchema } from '../reviwes/schemas/reviwe.schema';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';
import {
    Establishment,
    EstablishmentSchema,
} from '../establishments/schemas/establishment.schema';
import {
    UserDonation,
    UserDonationSchema,
} from '../donations/schemas/user-donation.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: ArchiveData.name, schema: ArchiveDataSchema },
            { name: Order.name, schema: OrderSchema },
            { name: Review.name, schema: ReviewSchema },
            { name: Offer.name, schema: OfferSchema },
            { name: Establishment.name, schema: EstablishmentSchema },
            { name: UserDonation.name, schema: UserDonationSchema },
            { name: User.name, schema: UserSchema },
        ]),
    ],
    providers: [ArchiveService, ArchiveTask],
    exports: [ArchiveService],
})
export class ArchiveModule {}
