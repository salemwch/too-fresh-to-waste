import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { DriverProfile, DriverProfileSchema } from './schemas/driver-profile.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: DriverProfile.name, schema: DriverProfileSchema },
    ]),
    ConfigModule,
  ],
  controllers: [DriversController],
  providers: [DriversService],
  exports: [MongooseModule],
})
export class DriversModule {}
