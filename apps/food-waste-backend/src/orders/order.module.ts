import { BullModule } from '@nestjs/bull';
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CommonModule } from '../common/common.module';
import { QueryComplexityGuard } from '../common/guards/query-complexity.guard';
import { RegexSecurityUtil } from '../common/utils/regex-security.util';
import { Establishment, EstablishmentSchema } from '../establishments/schemas/establishment.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';
import { PaymentModule } from '../payments/payments.module';
import { PaymentAttempt, PaymentAttemptSchema } from '../payments/schemas/payment-attempt.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { WebSocketModule } from '../websocket/websocket.module';

import { PickupThrottlerGuard } from './guards/pickup-throttler.guard';
import { AdminUserEventsListener } from './listeners/admin-user-events.listener';
import { OrdersController } from './order.controller';
import { OrdersService } from './order.service';
import { PickupReminderProcessor } from './processors/pickup-reminder.processor';
import { Order, OrderSchema } from './schemas/order.schema';
import { OrderExpiryTask } from './tasks/order-expiry.task';

@Module({
  imports: [
    CommonModule,
    forwardRef(() => PaymentModule),
    forwardRef(() => WebSocketModule),
    forwardRef(() => NotificationsModule),
    BullModule.registerQueue({
      name: 'pickup-reminders',
      /*
       * Bull retains completed and failed jobs in Redis forever by default.
       * At one reminder per order, 100k orders/day silently accumulates 100k
       * job hashes per day in the same Redis that backs the throttler, the
       * cache and the Socket.IO adapter — a slow leak that ends in eviction of
       * live keys, not in an error anyone can trace back to here.
       *
       * These caps only affect jobs that have already run; a pending delayed
       * reminder is untouched and still fires at its scheduled time.
       */
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    }),
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Offer.name, schema: OfferSchema },
      { name: Establishment.name, schema: EstablishmentSchema },
      { name: User.name, schema: UserSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: PaymentAttempt.name, schema: PaymentAttemptSchema },
    ]),
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    QueryComplexityGuard,
    RegexSecurityUtil,
    PickupThrottlerGuard,
    AdminUserEventsListener,
    PickupReminderProcessor,
    OrderExpiryTask,
  ],
  exports: [OrdersService, MongooseModule],
})
export class OrdersModule {}
