import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Geozone, GeozoneSchema } from '../admin/schemas/geozone.schema';
import { CommonModule } from '../common/common.module';
import { Establishment, EstablishmentSchema } from '../establishments/schemas/establishment.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { CityWaitlistEntry, CityWaitlistEntrySchema } from './schemas/city-waitlist-entry.schema';

/**
 * Aggregate-only endpoints for the marketing site. Read models are registered
 * here rather than importing the owning modules, so nothing in this module can
 * reach a service that performs writes on them.
 */
@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([
      { name: CityWaitlistEntry.name, schema: CityWaitlistEntrySchema },
      { name: Order.name, schema: OrderSchema },
      { name: Establishment.name, schema: EstablishmentSchema },
      { name: User.name, schema: UserSchema },
      { name: Geozone.name, schema: GeozoneSchema },
    ]),
  ],
  controllers: [PublicController],
  providers: [PublicService],
  exports: [PublicService],
})
export class PublicModule {}
