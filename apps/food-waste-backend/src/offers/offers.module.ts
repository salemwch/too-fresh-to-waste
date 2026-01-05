import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { Offer, OfferSchema } from './schemas/offer.schema';
import { ScheduleModule } from '@nestjs/schedule';
import { CommonModule } from '../common/common.module';

@Module({
    imports: [
        CommonModule,
        ScheduleModule.forRoot(),
        MongooseModule.forFeature([
            { name: Offer.name, schema: OfferSchema }
        ]),
    ],
    controllers: [OffersController],
    providers: [OffersService],
    exports: [OffersService],
})
export class OffersModule { }