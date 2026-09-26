import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection, ClientSession } from 'mongoose';

import { OrderStatus, PaymentStatus } from '@foodwaste/shared';

import { perfLog, perfStart } from '../../common/utils/perf-log.util';
import { Establishment } from '../../establishments/schemas/establishment.schema';
import { KonnectService, toMillimes } from '../../subscription/services/konnect.service';
import { Order, OrderDocument } from '../../orders/schemas/order.schema';
import { MerchantWallet } from '../schemas/merchant-wallet.schema';
import { PaymentAttempt } from '../schemas/payment-attempt.schema';
import { PlatformTransaction } from '../schemas/platform-transaction.schema';
import { WalletTransaction } from '../schemas/wallet-transaction.schema';
import { RefundRequest } from '../schemas/refund-request.schema';

import { appError } from '../../common/errors';
/**
 * Revenue splitting lives in orders/utils/order-pricing.util.ts.
 *
 * The rates that used to sit here (0.81 / 0.19 / 0.05) were applied to
 * `order.pricing.total`. Now that `total` includes the delivery fee, that would
 * pay the merchant 81% of a fee they have no part in earning — leaving the
 * platform to fund a 3 TND driver out of a 0.76 TND share. Every split below
 * therefore uses `pricing.subtotal`, the food line.
 */

@Injectable()
export class KonnectOrderService implements OnModuleInit {
  private readonly logger = new Logger(KonnectOrderService.name);
  private readonly paymentTimeoutMinutes: number;
  private readonly orderWebhookUrl: string;
  private readonly mobileDeepLink: string;

  constructor(
    private readonly konnectService: KonnectService,
    private readonly configService: ConfigService,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(PaymentAttempt.name)
    private readonly paymentAttemptModel: Model<PaymentAttempt>,
    @InjectModel(MerchantWallet.name)
    private readonly walletModel: Model<MerchantWallet>,
    @InjectModel(WalletTransaction.name)
    private readonly walletTxModel: Model<WalletTransaction>,
    @InjectModel(PlatformTransaction.name)
    private readonly platformTxModel: Model<PlatformTransaction>,
    @InjectModel(Establishment.name)
    private readonly establishmentModel: Model<Establishment>,
    @InjectModel(RefundRequest.name)
    private readonly refundRequestModel: Model<RefundRequest>,
  ) {
    this.paymentTimeoutMinutes = this.configService.get<number>(
      'KONNECT_PAYMENT_TIMEOUT_MINUTES',
      15,
    );
    this.orderWebhookUrl = this.configService.get<string>(
      'KONNECT_ORDER_WEBHOOK_URL',
      'http://localhost:3000/api/v1/payments/webhook/konnect',
    );
    this.mobileDeepLink = this.configService.get<string>('MOBILE_DEEP_LINK', 'toofreshtowaste');
  }

  async onModuleInit(): Promise<void> {
    await this.paymentAttemptModel.ensureIndexes();
    await this.walletModel.ensureIndexes();
    await this.walletTxModel.ensureIndexes();
    await this.platformTxModel.ensureIndexes();
    await this.refundRequestModel.ensureIndexes();
  }

  async initOrderPayment(
    order: OrderDocument,
    user: { firstName: string; lastName: string; email: string },
  ): Promise<{ payUrl: string; paymentRef: string }> {
    const t0 = performance.now();
    const orderId = (order._id as Types.ObjectId).toString();
    const amountInMillimes = toMillimes(order.pricing.total);

    const [updatedOrder, result] = await Promise.all([
      this.orderModel.findByIdAndUpdate(
        order._id,
        { $inc: { paymentAttemptSequence: 1 } },
        { new: true },
      ),
      this.konnectService.initPayment(
        {
          amount: amountInMillimes,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          orderId: order.orderNumber,
          description: `Too Fresh To Waste - ${order.orderNumber}`,
        },
        {
          successUrl: `${this.mobileDeepLink}://order-payment-success?orderId=${orderId}`,
          failUrl: `${this.mobileDeepLink}://order-payment-failed?orderId=${orderId}`,
          webhook: this.orderWebhookUrl,
          lifespan: this.paymentTimeoutMinutes,
          addPaymentFeesToAmount: false,
        },
      ),
    ]);
    const tKonnect = perfStart();
    perfLog(m => this.logger.log(m), 'DB increment + Konnect API (parallel)', t0);

    const attemptNumber = updatedOrder?.paymentAttemptSequence ?? 1;
    const providerExpiresAt = new Date(Date.now() + this.paymentTimeoutMinutes * 60 * 1000);

    await Promise.all([
      this.paymentAttemptModel.create({
        orderId: order._id,
        attemptNumber,
        provider: 'konnect',
        reference: result.paymentRef,
        amount: order.pricing.total,
        currency: 'TND',
        status: 'pending',
        active: true,
        providerExpiresAt,
      }),
      this.orderModel.findByIdAndUpdate(
        order._id,
        {
          paymentSession: {
            provider: 'konnect',
            reference: result.paymentRef,
            payUrl: result.payUrl,
            expiresAt: providerExpiresAt,
          },
        },
        { writeConcern: { w: 1, j: false } },
      ),
    ]);
    perfLog(m => this.logger.log(m), 'Post-Konnect DB writes (parallel)', tKonnect);
    perfLog(m => this.logger.log(m), 'initOrderPayment total', t0);

    return { payUrl: result.payUrl, paymentRef: result.paymentRef };
  }

  async handleOrderWebhook(paymentRef: string): Promise<void> {
    const attempt = await this.paymentAttemptModel.findOne({
      reference: paymentRef,
    });
    if (!attempt) {
      this.logger.warn(`Webhook: no PaymentAttempt found for ref ${paymentRef}`);
      return;
    }

    if (['paid', 'processing', 'anomalous'].includes(attempt.status)) {
      this.logger.log(`Webhook: ref ${paymentRef} already ${attempt.status}, skipping`);
      return;
    }

    let details;
    try {
      details = await this.konnectService.getPaymentDetails(paymentRef);
    } catch (error) {
      this.logger.warn(
        `Webhook: could not verify ref ${paymentRef} with Konnect: ${(error as Error).message}`,
      );
      return;
    }

    if (details.payment.status !== 'completed') {
      return;
    }

    const expectedMillimes = toMillimes(attempt.amount);
    if (details.payment.amount !== expectedMillimes) {
      this.logger.error(
        `Webhook: amount mismatch for ref ${paymentRef}. Expected ${expectedMillimes} millimes, got ${details.payment.amount}`,
      );
      // The customer's money was captured by Konnect for the wrong amount. Do
      // NOT credit the merchant, but flag it as an anomaly and open a refund
      // request so it is reconciled — otherwise the attempt stays pending and
      // both this webhook and the expiry task reprocess it forever.
      await this.paymentAttemptModel.findByIdAndUpdate(attempt._id, {
        status: 'anomalous',
        active: false,
        konnectPaymentId: details.payment.id,
        failedReason: `Amount mismatch: expected ${expectedMillimes} millimes, got ${details.payment.amount}`,
      });
      const mismatchOrder = await this.orderModel.findById(attempt.orderId);
      if (mismatchOrder) {
        await this.refundRequestModel.findOneAndUpdate(
          { orderId: mismatchOrder._id },
          {
            $setOnInsert: {
              orderId: mismatchOrder._id,
              requestedBy: mismatchOrder.customerId,
              reason: 'anomalous_payment',
              amount: attempt.amount,
              currency: 'TND',
              providerReference: paymentRef,
              status: 'pending',
              notes: `Amount mismatch: charged ${details.payment.amount} millimes, expected ${expectedMillimes}`,
            },
          },
          { upsert: true },
        );
      }
      return;
    }

    const order = await this.orderModel.findById(attempt.orderId);
    if (!order) {
      this.logger.error(`Webhook: order not found for ref ${paymentRef}`);
      return;
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      if (order.paymentSession?.reference !== paymentRef) {
        this.logger.warn(
          `Webhook: late capture on ref ${paymentRef} - order already PAID by different attempt. Marking ANOMALOUS.`,
        );
        await this.paymentAttemptModel.findByIdAndUpdate(attempt._id, {
          status: 'anomalous',
          active: false,
          konnectPaymentId: details.payment.id,
          failedReason: 'Late capture: order already paid by another attempt',
        });
        await this.refundRequestModel.findOneAndUpdate(
          { orderId: order._id },
          {
            $setOnInsert: {
              orderId: order._id,
              requestedBy: order.customerId,
              reason: 'anomalous_payment',
              amount: attempt.amount,
              currency: 'TND',
              providerReference: paymentRef,
              status: 'pending',
              notes: `Late capture: attempt #${attempt.attemptNumber} completed after order was already paid`,
            },
          },
          { upsert: true },
        );
      }
      return;
    }

    if ([OrderStatus.CANCELLED, OrderStatus.EXPIRED].includes(order.status as OrderStatus)) {
      this.logger.warn(
        `Webhook: order ${order._id} is ${order.status}, creating anomalous refund case for ref ${paymentRef}`,
      );
      await this.paymentAttemptModel.findByIdAndUpdate(attempt._id, {
        status: 'anomalous',
        active: false,
        konnectPaymentId: details.payment.id,
        failedReason: `Order already ${order.status} when payment completed`,
      });
      await this.refundRequestModel.findOneAndUpdate(
        { orderId: order._id },
        {
          $setOnInsert: {
            orderId: order._id,
            requestedBy: order.customerId,
            reason: 'anomalous_payment',
            amount: attempt.amount,
            currency: 'TND',
            providerReference: paymentRef,
            status: 'pending',
            notes: `Payment completed after order was ${order.status}`,
          },
        },
        { upsert: true },
      );
      return;
    }

    const claimed = await this.paymentAttemptModel.findOneAndUpdate(
      { _id: attempt._id, status: 'pending' },
      { status: 'processing', claimedAt: new Date() },
      { new: true },
    );

    if (!claimed) {
      this.logger.log(`Webhook: ref ${paymentRef} already claimed, skipping`);
      return;
    }

    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        await this.paymentAttemptModel.findByIdAndUpdate(
          attempt._id,
          {
            status: 'paid',
            active: false,
            konnectPaymentId: details.payment.id,
          },
          { session },
        );

        const nextStatus =
          order.deliveryMode === 'delivery' ? OrderStatus.CONFIRMED : OrderStatus.RESERVED;

        await this.orderModel.findByIdAndUpdate(
          order._id,
          {
            paymentStatus: PaymentStatus.PAID,
            status: nextStatus,
          },
          { session },
        );

        await this.createSaleRecords(
          order,
          attempt as PaymentAttempt & { _id: Types.ObjectId },
          session,
        );
      });

      this.logger.log(`Webhook: order ${order._id} confirmed PAID via ref ${paymentRef}`);
    } catch (txError) {
      await this.paymentAttemptModel.findByIdAndUpdate(attempt._id, {
        status: 'pending',
        claimedAt: null,
      });
      this.logger.error(
        `Webhook: transaction failed for ref ${paymentRef}: ${(txError as Error).message}`,
      );
      throw txError;
    } finally {
      await session.endSession();
    }
  }

  async createRetrySession(
    order: OrderDocument,
    user: { firstName: string; lastName: string; email: string },
  ): Promise<{ payUrl: string; paymentRef: string }> {
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException(appError('ORDER_NOT_AWAITING_PAYMENT'));
    }

    const activeAttempt = await this.paymentAttemptModel
      .findOne({ orderId: order._id, active: true })
      .sort({ attemptNumber: -1 });

    if (activeAttempt) {
      try {
        const details = await this.konnectService.getPaymentDetails(activeAttempt.reference);

        if (details.payment.status === 'completed') {
          await this.handleOrderWebhook(activeAttempt.reference);
          throw new BadRequestException(appError('PAYMENT_ALREADY_SUCCEEDED'));
        }

        // Only resume the existing checkout if it is still open on Konnect's
        // side. A 'failed' (or otherwise non-pending) payment leaves a dead
        // payUrl — supersede it and open a fresh session instead.
        if (
          details.payment.status === 'pending' &&
          activeAttempt.providerExpiresAt &&
          new Date(activeAttempt.providerExpiresAt) > new Date()
        ) {
          if (order.paymentSession?.payUrl) {
            return {
              payUrl: order.paymentSession.payUrl,
              paymentRef: activeAttempt.reference,
            };
          }
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        this.logger.warn(
          `Retry: could not verify previous attempt ${activeAttempt.reference}: ${(error as Error).message}`,
        );
      }

      await this.paymentAttemptModel.findByIdAndUpdate(activeAttempt._id, {
        status: 'expired',
        active: false,
        failedReason: 'Superseded by retry',
      });
    }

    return this.initOrderPayment(order, user);
  }

  /**
   * Pickup confirmed: pending -> available for an online PICKUP sale.
   *
   * Moves out of pending exactly what the payment put in (the SALE row's
   * amount) - 100% for sales made under the commission-settlement model, 81%
   * for sales paid before it - so a rule change between payment and pickup
   * can never overdraw pending. Puts `merchantAmount` into available: the
   * full subtotal on a NORMAL sale, `subtotal - settled` on a SETTLEMENT,
   * as decided by CommissionService in the same transaction.
   *
   * A delivery has no SALE row - the driver paid the merchant in cash at
   * pickup - so there is nothing to move.
   */
  async processPickupConfirmation(
    order: OrderDocument,
    merchantAmount: number,
    session?: ClientSession,
  ): Promise<void> {
    if (!Number.isFinite(merchantAmount) || merchantAmount < 0) {
      throw new Error(
        `Invalid merchantAmount ${String(merchantAmount)} for order ${order._id.toString()}`,
      );
    }

    const pendingCredit = await this.saleAmountFor(order._id, session);
    if (pendingCredit === null) {
      return;
    }

    await this.walletModel.findOneAndUpdate(
      { establishmentId: order.establishmentId },
      {
        $inc: {
          pendingBalance: -pendingCredit,
          availableBalance: parseFloat(merchantAmount.toFixed(3)),
        },
      },
      { ...(session && { session }) },
    );
  }

  /**
   * Reverses the NET_COMMISSION / DONATION pair a payment booked before revenue
   * moved to completion. Reads what is there instead of recomputing it: an
   * order paid after the change has no such rows, and reversing a recomputed
   * 19% would book negative revenue for a sale that never earned any.
   *
   * `ordered: true` is mandatory: Mongoose refuses `create()` with a session
   * and several documents without it, and the throw aborts the refund.
   */
  private async reverseLegacyPaymentBookings(
    order: OrderDocument,
    session: ClientSession,
  ): Promise<void> {
    const booked = await this.platformTxModel
      .find({
        orderId: order._id,
        type: { $in: ['NET_COMMISSION', 'DONATION'] },
        amount: { $gt: 0 },
      })
      .session(session)
      .lean();
    if (booked.length === 0) {
      return;
    }
    await this.platformTxModel.create(
      booked.map(row => ({
        orderId: order._id,
        type: row.type,
        amount: -row.amount,
        currency: row.currency,
        reference: `REFUND-${row.reference}`,
      })),
      { session, ordered: true },
    );
  }

  /** What the payment credited to pending for this order, or `null` if nothing. */
  private async saleAmountFor(
    orderId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<number | null> {
    const sale = await this.walletTxModel
      .findOne({ orderId, type: 'SALE' })
      .select('amount')
      .session(session ?? null)
      .lean();
    const amount = sale ? sale.amount : null;
    return amount;
  }

  async processRefundRequest(
    order: OrderDocument,
    requestedBy: Types.ObjectId,
    reason: 'consumer_cancel' | 'merchant_cancel',
    session: ClientSession,
  ): Promise<void> {
    /*
     * Reverse exactly what the sale credited to pending (0 for a delivery,
     * which never credited the wallet), not a recomputed share - the SALE row
     * may predate the commission-settlement model.
     */
    const merchantAmount = (await this.saleAmountFor(order._id, session)) ?? 0;

    // No SALE row (a delivery) means nothing was credited, so nothing to reverse.
    if (merchantAmount > 0) {
      await this.walletModel.findOneAndUpdate(
        { establishmentId: order.establishmentId },
        { $inc: { pendingBalance: -merchantAmount } },
        { session },
      );

      await this.walletTxModel.create(
        [
          {
            establishmentId: order.establishmentId,
            merchantId: order.merchantId,
            orderId: order._id,
            type: 'REFUND',
            status: 'CREATED',
            amount: -merchantAmount,
            currency: 'TND',
            reference: `REFUND-${order.orderNumber}`,
            notes: `${reason}: reversal of SALE-${order.orderNumber}`,
          },
        ],
        { session },
      );
    }

    await this.reverseLegacyPaymentBookings(order, session);

    await this.refundRequestModel.create(
      [
        {
          orderId: order._id,
          requestedBy,
          reason,
          amount: order.pricing.total,
          currency: 'TND',
          providerReference: order.paymentSession?.reference,
          status: 'pending',
        },
      ],
      { session },
    );
  }

  private async createSaleRecords(
    order: OrderDocument,
    attempt: PaymentAttempt & { _id: Types.ObjectId },
    session: ClientSession,
  ): Promise<void> {
    const establishment = await this.establishmentModel
      .findById(order.establishmentId)
      .select('ownerId')
      .lean();

    if (!establishment) {
      this.logger.error(`createSaleRecords: establishment ${order.establishmentId} not found`);
      return;
    }

    /*
     * Payment time moves the merchant wallet only. TFTW's revenue and the
     * charity pledge are booked when the sale completes - CommissionService
     * (COMMISSION_EARNED / COMMISSION_SETTLED) and DonationsService (DONATION) -
     * for every payment method. Booking them here counted online sales only,
     * at a flat 19%, before anything was earned, and a cancelled order had to
     * be unwound out of revenue it never produced.
     */
    /*
     * Merchant wallet, per the model:
     * - pickup: the FULL subtotal goes to pending. The 19% is not deducted per
     *   sale; it accrues to commissionDue at pickup, and a settlement (if any)
     *   is taken when pending moves to available.
     * - delivery: nothing. The driver pays the merchant in cash from the TFTW
     *   float at pickup - crediting the wallet as well would pay them twice.
     */
    if (order.deliveryMode !== 'delivery') {
      const saleAmount = parseFloat(order.pricing.subtotal.toFixed(3));

      await this.walletTxModel.create(
        [
          {
            establishmentId: order.establishmentId,
            merchantId: establishment.ownerId,
            orderId: order._id,
            paymentAttemptId: attempt._id,
            type: 'SALE',
            status: 'COMPLETED',
            amount: saleAmount,
            currency: 'TND',
            orderTotal: order.pricing.total,
            merchantAmount: saleAmount,
            // Nothing is deducted from this sale; see above.
            platformFee: 0,
            reference: `SALE-${order.orderNumber}`,
          },
        ],
        { session },
      );

      await this.walletModel.findOneAndUpdate(
        { establishmentId: order.establishmentId },
        {
          $inc: { pendingBalance: saleAmount },
          $setOnInsert: {
            merchantId: establishment.ownerId,
            availableBalance: 0,
            currency: 'TND',
          },
        },
        { upsert: true, session },
      );
    }
  }
}
