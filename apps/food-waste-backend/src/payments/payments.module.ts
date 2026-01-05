import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CommonModule } from '../common/common.module';
import { SMTPaymentService } from './services/smt-payment.service';
import { PayoutService } from './services/payout.service';
import { RefundService } from './services/refund.service';
import { PayoutTask } from './tasks/payout.task';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { PaymentWebhook, PaymentWebhookSchema } from './schemas/webhook.schema';
import { EncryptionKey, EncryptionKeySchema } from './schemas/encryption-key.schema';
import { MerchantPayoutLedger, MerchantPayoutLedgerSchema } from './schemas/merchant-payout-ledger.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { PaymentController } from './payments.controller';
import { PaymentService } from './payments.service';

@Module({
    imports: [
        ConfigModule,
        CommonModule,
        ScheduleModule.forRoot(),
        MongooseModule.forFeature([
            { name: Payment.name, schema: PaymentSchema },
            { name: PaymentWebhook.name, schema: PaymentWebhookSchema },
            { name: EncryptionKey.name, schema: EncryptionKeySchema },
            { name: MerchantPayoutLedger.name, schema: MerchantPayoutLedgerSchema },
            { name: Order.name, schema: OrderSchema },
            { name: User.name, schema: UserSchema },
        ]),
    ],
    controllers: [PaymentController],
    providers: [
        PaymentService,
        SMTPaymentService,
        PayoutService,
        RefundService,
        PayoutTask,
    ],
    exports: [
        PaymentService,
        SMTPaymentService,
        PayoutService,
        RefundService,
    ],
})
export class PaymentModule { }