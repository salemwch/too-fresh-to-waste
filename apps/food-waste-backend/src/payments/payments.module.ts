import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { CommonModule } from '../common/common.module';
import { Establishment, EstablishmentSchema } from '../establishments/schemas/establishment.schema';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { SubscriptionModule } from '../subscription/subscription.module';
import { User, UserSchema } from '../users/schemas/user.schema';

import { PaymentController } from './payments.controller';
import { PaymentService } from './payments.service';
import { EncryptionKey, EncryptionKeySchema } from './schemas/encryption-key.schema';
import {
  MerchantPayoutLedger,
  MerchantPayoutLedgerSchema,
} from './schemas/merchant-payout-ledger.schema';
import { MerchantWallet, MerchantWalletSchema } from './schemas/merchant-wallet.schema';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { PaymentAttempt, PaymentAttemptSchema } from './schemas/payment-attempt.schema';
import {
  PlatformTransaction,
  PlatformTransactionSchema,
} from './schemas/platform-transaction.schema';
import { RefundRequest, RefundRequestSchema } from './schemas/refund-request.schema';
import { CommissionLedger, CommissionLedgerSchema } from './schemas/commission-ledger.schema';
import { WalletTransaction, WalletTransactionSchema } from './schemas/wallet-transaction.schema';
import { PaymentWebhook, PaymentWebhookSchema } from './schemas/webhook.schema';
import { KonnectOrderService } from './services/konnect-order.service';
import { CommissionService } from './services/commission.service';
import { MerchantCommissionService } from './services/merchant-commission.service';
import { PayoutService } from './services/payout.service';
import { RefundService } from './services/refund.service';
import { WalletPayoutService } from './services/wallet-payout.service';
import { PaymentExpiryTask } from './tasks/payment-expiry.task';
import { PaymentReconciliationTask } from './tasks/payment-reconciliation.task';
import { PayoutTask } from './tasks/payout.task';

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    SubscriptionModule,
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: PaymentWebhook.name, schema: PaymentWebhookSchema },
      { name: EncryptionKey.name, schema: EncryptionKeySchema },
      { name: MerchantPayoutLedger.name, schema: MerchantPayoutLedgerSchema },
      { name: PaymentAttempt.name, schema: PaymentAttemptSchema },
      { name: MerchantWallet.name, schema: MerchantWalletSchema },
      { name: WalletTransaction.name, schema: WalletTransactionSchema },
      { name: CommissionLedger.name, schema: CommissionLedgerSchema },
      { name: PlatformTransaction.name, schema: PlatformTransactionSchema },
      { name: RefundRequest.name, schema: RefundRequestSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Offer.name, schema: OfferSchema },
      { name: Establishment.name, schema: EstablishmentSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    PayoutService,
    CommissionService,
    MerchantCommissionService,
    RefundService,
    KonnectOrderService,
    WalletPayoutService,
    PayoutTask,
    PaymentExpiryTask,
    PaymentReconciliationTask,
  ],
  exports: [
    PaymentService,
    PayoutService,
    CommissionService,
    MerchantCommissionService,
    RefundService,
    KonnectOrderService,
  ],
})
export class PaymentModule {}
