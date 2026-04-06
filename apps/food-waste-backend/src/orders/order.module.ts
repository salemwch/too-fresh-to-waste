import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CommonModule } from '../common/common.module';
import { QueryComplexityGuard } from '../common/guards/query-complexity.guard';
import { RegexSecurityUtil } from '../common/utils/regex-security.util';
import { Establishment, EstablishmentSchema } from '../establishments/schemas/establishment.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';
import { PaymentModule } from '../payments/payments.module';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { WebSocketModule } from '../websocket/websocket.module';

import { PickupThrottlerGuard } from './guards/pickup-throttler.guard';
import { AdminUserEventsListener } from './listeners/admin-user-events.listener';
import { OrdersController } from './order.controller';
import { OrdersService } from './order.service';
import { Order, OrderSchema } from './schemas/order.schema';

@Module({
  imports: [
    CommonModule,
    forwardRef(() => PaymentModule),
    forwardRef(() => WebSocketModule),
    forwardRef(() => NotificationsModule),
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Offer.name, schema: OfferSchema },
      { name: Establishment.name, schema: EstablishmentSchema },
      { name: User.name, schema: UserSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    QueryComplexityGuard,
    RegexSecurityUtil,
    PickupThrottlerGuard,
    AdminUserEventsListener,
  ],
  exports: [OrdersService, MongooseModule],
})
export class OrdersModule {}
