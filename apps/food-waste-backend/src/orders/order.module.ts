import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { Order, OrderSchema } from './schemas/order.schema';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';
import { Establishment, EstablishmentSchema } from '../establishments/schemas/establishment.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { OrdersController } from './order.controller';
import { OrdersService } from './order.service';
import { CommonModule } from '../common/common.module';
import { PaymentModule } from '../payments/payments.module';
import { QueryComplexityGuard } from '../common/guards/query-complexity.guard';
import { RegexSecurityUtil } from '../common/utils/regex-security.util';
import { PickupThrottlerGuard } from './guards/pickup-throttler.guard';
import { AdminUserEventsListener } from './listeners/admin-user-events.listener';

@Module({
    imports: [
        CommonModule,
        forwardRef(() => PaymentModule), // Import for PayoutService and RefundService access
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
    exports: [OrdersService, MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),],
})
export class OrdersModule { }