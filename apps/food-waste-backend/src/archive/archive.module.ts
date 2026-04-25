import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { DonationsModule } from '../donations/donations.module';
import { EstablishmentsModule } from '../establishments/establishments.module';
import { OffersModule } from '../offers/offers.module';
import { OrdersModule } from '../orders/order.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { UsersModule } from '../users/user.module';

import { ArchiveService } from './archive.service';
import { ArchiveData, ArchiveDataSchema } from './schemas/archive-data.schema';
import { ArchiveTask } from './tasks/archive.task';

@Module({
  imports: [
    // Archive's own collection
    MongooseModule.forFeature([{ name: ArchiveData.name, schema: ArchiveDataSchema }]),
    // Feature modules re-export MongooseModule, giving us their Model tokens
    OrdersModule,
    ReviewsModule,
    OffersModule,
    EstablishmentsModule,
    DonationsModule,
    UsersModule,
  ],
  providers: [ArchiveService, ArchiveTask],
  exports: [ArchiveService],
})
export class ArchiveModule {}
