import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { NotificationsModule } from '../notifications/notifications.module';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { DeliveryOrderListener } from './listeners/delivery-order.listener';
import { DELIVERY_TIMEOUT_QUEUE } from './processors/delivery-timeout.constants';
import { DeliveryTimeoutProcessor } from './processors/delivery-timeout.processor';
import { DriverProfile, DriverProfileSchema } from './schemas/driver-profile.schema';
import { DriverNotificationsService } from './services/driver-notifications.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: DriverProfile.name, schema: DriverProfileSchema },
    ]),
    BullModule.registerQueue({ name: DELIVERY_TIMEOUT_QUEUE }),
    NotificationsModule,
    ConfigModule,
  ],
  controllers: [DriversController],
  providers: [
    DriversService,
    DriverNotificationsService,
    DeliveryOrderListener,
    DeliveryTimeoutProcessor,
  ],
  // DriversService is exported so the admin fleet dashboard can reuse the
  // earnings roll-up rather than re-deriving it and risking a different number
  // from the one the driver sees in their own app.
  exports: [MongooseModule, DriversService],
})
export class DriversModule {}
