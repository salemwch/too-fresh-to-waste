import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { Offer, OfferSchema } from './schemas/offer.schema';
import { FavoriteEventsListener } from './listeners/favorite-events.listener';
import { AdminEstablishmentEventsListener } from './listeners/admin-establishment-events.listener';
import { CommonModule } from '../common/common.module';

// Note: ScheduleModule.forRoot() is already called in AppModule
// Cron decorators in OffersService will work automatically

@Module({
    imports: [
        CommonModule,
        MongooseModule.forFeature([
            { name: Offer.name, schema: OfferSchema },
        ]),
    ],
    controllers: [OffersController],
    providers: [
        OffersService,
        FavoriteEventsListener, // Event listener for favorite-related events
        AdminEstablishmentEventsListener, // Event listener for admin establishment events
    ],
    exports: [OffersService],
})
export class OffersModule { }