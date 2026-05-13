import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]), ConfigModule],
  controllers: [DriversController],
  providers: [DriversService],
})
export class DriversModule {}
