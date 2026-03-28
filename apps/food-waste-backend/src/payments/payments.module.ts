import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { CommonModule } from '../common/common.module';

// Note: ScheduleModule.forRoot() is already called in AppModule
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

import { PaymentController } from './payments.controller';
import { PaymentService } from './payments.service';
import { EncryptionKey, EncryptionKeySchema } from './schemas/encryption-key.schema';
import {
  MerchantPayoutLedger,
  MerchantPayoutLedgerSchema,
} from './schemas/merchant-payout-ledger.schema';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { PaymentWebhook, PaymentWebhookSchema } from './schemas/webhook.schema';
import { PayoutService } from './services/payout.service';
import { RefundService } from './services/refund.service';
import { SMTPaymentService } from './services/smt-payment.service';
import { PayoutTask } from './tasks/payout.task';

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    // ScheduleModule is initialized in AppModule
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
  providers: [PaymentService, SMTPaymentService, PayoutService, RefundService, PayoutTask],
  exports: [PaymentService, SMTPaymentService, PayoutService, RefundService],
})
export class PaymentModule {}
