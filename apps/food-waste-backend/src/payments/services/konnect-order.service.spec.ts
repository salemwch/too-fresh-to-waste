/* eslint-disable require-await */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';

import { OrderStatus, PaymentStatus } from '@foodwaste/shared';

import { Establishment } from '../../establishments/schemas/establishment.schema';
import { KonnectService } from '../../subscription/services/konnect.service';
import { Order } from '../../orders/schemas/order.schema';
import { MerchantWallet } from '../schemas/merchant-wallet.schema';
import { PaymentAttempt } from '../schemas/payment-attempt.schema';
import { PlatformTransaction } from '../schemas/platform-transaction.schema';
import { WalletTransaction } from '../schemas/wallet-transaction.schema';
import { RefundRequest } from '../schemas/refund-request.schema';

import { KonnectOrderService } from './konnect-order.service';

import type { TestingModule } from '@nestjs/testing';

// ─── Test constants ──────────────────────────────────────────────────────────

const ORDER_ID = new Types.ObjectId();
const CUSTOMER_ID = new Types.ObjectId();
const ESTABLISHMENT_ID = new Types.ObjectId();
const MERCHANT_ID = new Types.ObjectId();
const ATTEMPT_ID = new Types.ObjectId();
const PAYMENT_REF = 'konnect-ref-abc123';
const PAY_URL = 'https://konnect.network/pay/abc123';
const KONNECT_PAYMENT_ID = 'kpay-xyz-789';

const makeOrder = (overrides: Record<string, unknown> = {}) =>
  ({
    _id: ORDER_ID,
    orderNumber: 'ORD-001',
    customerId: CUSTOMER_ID,
    establishmentId: ESTABLISHMENT_ID,
    merchantId: MERCHANT_ID,
    status: OrderStatus.PENDING_PAYMENT,
    paymentStatus: PaymentStatus.PENDING,
    paymentMethod: 'online',
    deliveryMode: 'pickup',
    pricing: { subtotal: 10.0, deliveryFee: 0, total: 10.0, currency: 'TND' },
    paymentAttemptSequence: 0,
    paymentSession: null,
    ...overrides,
  }) as any;

const makeAttempt = (overrides: Record<string, unknown> = {}) => ({
  _id: ATTEMPT_ID,
  orderId: ORDER_ID,
  attemptNumber: 1,
  provider: 'konnect',
  reference: PAYMENT_REF,
  amount: 10.0,
  currency: 'TND',
  status: 'pending',
  active: true,
  providerExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
  ...overrides,
});

const makeUser = () => ({
  firstName: 'Ahmed',
  lastName: 'Ben Ali',
  email: 'ahmed@test.com',
});

// ─── Mock factories ──────────────────────────────────────────────────────────

const createMockModel = () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  create: jest.fn(),
  ensureIndexes: jest.fn().mockResolvedValue(undefined),
});

const createMockSession = () => ({
  startSession: jest.fn().mockResolvedValue({
    withTransaction: jest.fn().mockImplementation(async (fn: () => Promise<void>) => fn()),
    endSession: jest.fn().mockResolvedValue(undefined),
  }),
});

describe('KonnectOrderService', () => {
  let service: KonnectOrderService;
  let konnectService: { initPayment: jest.Mock; getPaymentDetails: jest.Mock };
  let orderModel: ReturnType<typeof createMockModel>;
  let attemptModel: ReturnType<typeof createMockModel>;
  let walletModel: ReturnType<typeof createMockModel>;
  let walletTxModel: ReturnType<typeof createMockModel>;
  let platformTxModel: ReturnType<typeof createMockModel>;
  let establishmentModel: ReturnType<typeof createMockModel>;
  let refundRequestModel: ReturnType<typeof createMockModel>;
  let mockConnection: ReturnType<typeof createMockSession>;

  beforeEach(async () => {
    konnectService = {
      initPayment: jest.fn().mockResolvedValue({ payUrl: PAY_URL, paymentRef: PAYMENT_REF }),
      getPaymentDetails: jest.fn(),
    };

    orderModel = createMockModel();
    attemptModel = createMockModel();
    walletModel = createMockModel();
    walletTxModel = createMockModel();
    platformTxModel = createMockModel();
    establishmentModel = createMockModel();
    refundRequestModel = createMockModel();
    mockConnection = createMockSession();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KonnectOrderService,
        { provide: KonnectService, useValue: konnectService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: unknown) => {
              const map: Record<string, unknown> = {
                KONNECT_PAYMENT_TIMEOUT_MINUTES: 15,
                KONNECT_ORDER_WEBHOOK_URL: 'http://localhost:3000/api/v1/payments/webhook/konnect',
                MOBILE_DEEP_LINK: 'toofreshtowaste',
              };
              return map[key] ?? fallback;
            }),
          },
        },
        { provide: getConnectionToken(), useValue: mockConnection },
        { provide: getModelToken(Order.name), useValue: orderModel },
        { provide: getModelToken(PaymentAttempt.name), useValue: attemptModel },
        { provide: getModelToken(MerchantWallet.name), useValue: walletModel },
        { provide: getModelToken(WalletTransaction.name), useValue: walletTxModel },
        { provide: getModelToken(PlatformTransaction.name), useValue: platformTxModel },
        { provide: getModelToken(Establishment.name), useValue: establishmentModel },
        { provide: getModelToken(RefundRequest.name), useValue: refundRequestModel },
      ],
    }).compile();

    service = module.get(KonnectOrderService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // onModuleInit
  // ═══════════════════════════════════════════════════════════════════════════

  describe('onModuleInit', () => {
    it('should ensure indexes on all payment schemas', async () => {
      await service.onModuleInit();

      expect(attemptModel.ensureIndexes).toHaveBeenCalled();
      expect(walletModel.ensureIndexes).toHaveBeenCalled();
      expect(walletTxModel.ensureIndexes).toHaveBeenCalled();
      expect(platformTxModel.ensureIndexes).toHaveBeenCalled();
      expect(refundRequestModel.ensureIndexes).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // initOrderPayment
  // ═══════════════════════════════════════════════════════════════════════════

  describe('initOrderPayment', () => {
    const order = makeOrder();
    const user = makeUser();

    beforeEach(() => {
      orderModel.findByIdAndUpdate.mockResolvedValue({
        ...order,
        paymentAttemptSequence: 1,
      });
      attemptModel.create.mockResolvedValue({});
    });

    it('should create payment session and return payUrl', async () => {
      const result = await service.initOrderPayment(order, user);

      expect(result.payUrl).toBe(PAY_URL);
      expect(result.paymentRef).toBe(PAYMENT_REF);
    });

    it('should increment paymentAttemptSequence on the order', async () => {
      await service.initOrderPayment(order, user);

      expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
        order._id,
        { $inc: { paymentAttemptSequence: 1 } },
        { new: true },
      );
    });

    it('should call konnect with amount in millimes', async () => {
      await service.initOrderPayment(order, user);

      expect(konnectService.initPayment).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 10000 }),
        expect.objectContaining({
          lifespan: 15,
          addPaymentFeesToAmount: false,
        }),
      );
    });

    it('should pass deep link success/fail URLs', async () => {
      await service.initOrderPayment(order, user);

      const callArgs = konnectService.initPayment.mock.calls[0][1];
      expect(callArgs.successUrl).toContain('toofreshtowaste://order-payment-success');
      expect(callArgs.failUrl).toContain('toofreshtowaste://order-payment-failed');
    });

    it('should create a PaymentAttempt with pending status', async () => {
      await service.initOrderPayment(order, user);

      expect(attemptModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: order._id,
          attemptNumber: 1,
          provider: 'konnect',
          reference: PAYMENT_REF,
          amount: 10.0,
          status: 'pending',
          active: true,
        }),
      );
    });

    it('should save paymentSession on the order', async () => {
      await service.initOrderPayment(order, user);

      const updateCall = orderModel.findByIdAndUpdate.mock.calls[1];
      expect(updateCall[0]).toEqual(order._id);
      expect(updateCall[1]).toEqual(
        expect.objectContaining({
          paymentSession: expect.objectContaining({
            provider: 'konnect',
            reference: PAYMENT_REF,
            payUrl: PAY_URL,
          }),
        }),
      );
    });

    it('should handle fractional TND amounts correctly (millimes conversion)', async () => {
      const fractionalOrder = makeOrder({
        pricing: { subtotal: 7.55, deliveryFee: 0, total: 7.55, currency: 'TND' },
      });
      orderModel.findByIdAndUpdate.mockResolvedValue({
        ...fractionalOrder,
        paymentAttemptSequence: 1,
      });

      await service.initOrderPayment(fractionalOrder, user);

      expect(konnectService.initPayment).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 7550 }),
        expect.anything(),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // handleOrderWebhook
  // ═══════════════════════════════════════════════════════════════════════════

  describe('handleOrderWebhook', () => {
    const completedPaymentDetails = {
      payment: { id: KONNECT_PAYMENT_ID, amount: 10000, status: 'completed' },
    };

    describe('Happy path — successful payment', () => {
      it('should confirm order as RESERVED for pickup', async () => {
        attemptModel.findOne.mockResolvedValue(makeAttempt());
        konnectService.getPaymentDetails.mockResolvedValue(completedPaymentDetails);
        orderModel.findById.mockResolvedValue(makeOrder());
        attemptModel.findOneAndUpdate.mockResolvedValue(makeAttempt({ status: 'processing' }));
        attemptModel.findByIdAndUpdate.mockResolvedValue({});
        orderModel.findByIdAndUpdate.mockResolvedValue({});
        establishmentModel.findById.mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({ _id: ESTABLISHMENT_ID, ownerId: MERCHANT_ID }),
          }),
        });
        walletTxModel.create.mockResolvedValue({});
        walletModel.findOneAndUpdate.mockResolvedValue({});
        platformTxModel.create.mockResolvedValue({});

        await service.handleOrderWebhook(PAYMENT_REF);

        const orderUpdateCall = orderModel.findByIdAndUpdate.mock.calls.find(
          (c: any[]) => c[1]?.paymentStatus === PaymentStatus.PAID,
        );
        expect(orderUpdateCall).toBeDefined();
        expect(orderUpdateCall[1].status).toBe(OrderStatus.RESERVED);
      });

      it('passes ordered:true on every multi-document create inside the transaction', async () => {
        // Mongoose throws "Cannot call `create()` with a session and multiple
        // documents unless `ordered: true` is set". That throw aborts the
        // settlement transaction, resets the attempt to `pending`, and leaves
        // the order unpaid — and the reconciliation cron then retries into the
        // same error every five minutes, forever.
        //
        // This asserts the call shape rather than the outcome, because the
        // model is a mock here: `create` resolves happily no matter what it is
        // given, which is precisely why the existing settlement tests passed
        // while the real path could never once succeed. The shape is the only
        // thing a mocked model can still tell the truth about.
        attemptModel.findOne.mockResolvedValue(makeAttempt());
        konnectService.getPaymentDetails.mockResolvedValue(completedPaymentDetails);
        orderModel.findById.mockResolvedValue(makeOrder());
        attemptModel.findOneAndUpdate.mockResolvedValue(makeAttempt({ status: 'processing' }));
        attemptModel.findByIdAndUpdate.mockResolvedValue({});
        orderModel.findByIdAndUpdate.mockResolvedValue({});
        establishmentModel.findById.mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({ _id: ESTABLISHMENT_ID, ownerId: MERCHANT_ID }),
          }),
        });
        walletTxModel.create.mockResolvedValue({});
        walletModel.findOneAndUpdate.mockResolvedValue({});
        platformTxModel.create.mockResolvedValue({});

        await service.handleOrderWebhook(PAYMENT_REF);

        const multiDocCreates = [
          ...platformTxModel.create.mock.calls,
          ...walletTxModel.create.mock.calls,
        ].filter(([docs]: [unknown]) => Array.isArray(docs) && docs.length > 1);

        // The settlement writes NET_COMMISSION and DONATION together, so there
        // is at least one. If that ever stops being true the assertion below
        // would pass vacuously.
        expect(multiDocCreates.length).toBeGreaterThan(0);

        for (const [, options] of multiDocCreates) {
          expect(options).toMatchObject({ ordered: true });
          expect(options.session).toBeDefined();
        }
      });

      it('should confirm order as CONFIRMED for delivery', async () => {
        attemptModel.findOne.mockResolvedValue(makeAttempt());
        konnectService.getPaymentDetails.mockResolvedValue(completedPaymentDetails);
        orderModel.findById.mockResolvedValue(makeOrder({ deliveryMode: 'delivery' }));
        attemptModel.findOneAndUpdate.mockResolvedValue(makeAttempt({ status: 'processing' }));
        attemptModel.findByIdAndUpdate.mockResolvedValue({});
        orderModel.findByIdAndUpdate.mockResolvedValue({});
        establishmentModel.findById.mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({ _id: ESTABLISHMENT_ID, ownerId: MERCHANT_ID }),
          }),
        });
        walletTxModel.create.mockResolvedValue({});
        walletModel.findOneAndUpdate.mockResolvedValue({});
        platformTxModel.create.mockResolvedValue({});

        await service.handleOrderWebhook(PAYMENT_REF);

        const orderUpdateCall = orderModel.findByIdAndUpdate.mock.calls.find(
          (c: any[]) => c[1]?.paymentStatus === PaymentStatus.PAID,
        );
        expect(orderUpdateCall[1].status).toBe(OrderStatus.CONFIRMED);
      });
    });

    describe('Financial math — sale records', () => {
      beforeEach(() => {
        attemptModel.findOne.mockResolvedValue(makeAttempt());
        konnectService.getPaymentDetails.mockResolvedValue(completedPaymentDetails);
        orderModel.findById.mockResolvedValue(makeOrder());
        attemptModel.findOneAndUpdate.mockResolvedValue(makeAttempt({ status: 'processing' }));
        attemptModel.findByIdAndUpdate.mockResolvedValue({});
        orderModel.findByIdAndUpdate.mockResolvedValue({});
        establishmentModel.findById.mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({ _id: ESTABLISHMENT_ID, ownerId: MERCHANT_ID }),
          }),
        });
        walletTxModel.create.mockResolvedValue({});
        walletModel.findOneAndUpdate.mockResolvedValue({});
        platformTxModel.create.mockResolvedValue({});
      });

      it('should create SALE wallet transaction with 81% merchant share', async () => {
        await service.handleOrderWebhook(PAYMENT_REF);

        expect(walletTxModel.create).toHaveBeenCalledWith(
          [
            expect.objectContaining({
              type: 'SALE',
              amount: 8.1, // 10.0 * 0.81
              merchantAmount: 8.1,
              platformFee: 1.9, // 10.0 * 0.19
            }),
          ],
          expect.anything(),
        );
      });

      it('should credit pendingBalance on merchant wallet', async () => {
        await service.handleOrderWebhook(PAYMENT_REF);

        expect(walletModel.findOneAndUpdate).toHaveBeenCalledWith(
          { establishmentId: ESTABLISHMENT_ID },
          expect.objectContaining({
            $inc: { pendingBalance: 8.1 },
          }),
          expect.objectContaining({ upsert: true }),
        );
      });

      it('should create NET_COMMISSION and DONATION platform transactions', async () => {
        await service.handleOrderWebhook(PAYMENT_REF);

        const createCall = platformTxModel.create.mock.calls[0];
        const records = createCall[0];
        expect(records).toHaveLength(2);

        const commission = records.find((r: { type: string }) => r.type === 'NET_COMMISSION');
        const donation = records.find((r: { type: string }) => r.type === 'DONATION');

        // platformFee = 1.9, donation = 5% of 1.9 = 0.095, netCommission = 1.9 - 0.095 = 1.805
        expect(commission.amount).toBe(1.805);
        expect(donation.amount).toBe(0.095);
      });

      it('should verify 81% + 19% = 100% and donation comes from commission', async () => {
        const orderTotal = 10.0;
        const merchantShare = parseFloat((orderTotal * 0.81).toFixed(3));
        const platformFee = parseFloat((orderTotal * 0.19).toFixed(3));
        const donation = parseFloat((platformFee * 0.05).toFixed(3));
        const netCommission = parseFloat((platformFee - donation).toFixed(3));

        expect(merchantShare + platformFee).toBe(orderTotal);
        expect(netCommission + donation).toBe(platformFee);
      });
    });

    describe('Idempotency — duplicate webhook', () => {
      it('should skip if attempt status is already paid', async () => {
        attemptModel.findOne.mockResolvedValue(makeAttempt({ status: 'paid' }));

        await service.handleOrderWebhook(PAYMENT_REF);

        expect(konnectService.getPaymentDetails).not.toHaveBeenCalled();
      });

      it('should skip if attempt status is processing', async () => {
        attemptModel.findOne.mockResolvedValue(makeAttempt({ status: 'processing' }));

        await service.handleOrderWebhook(PAYMENT_REF);

        expect(konnectService.getPaymentDetails).not.toHaveBeenCalled();
      });
    });

    describe('Concurrent claim prevention', () => {
      it('should skip if atomic claim returns null (another worker won)', async () => {
        attemptModel.findOne.mockResolvedValue(makeAttempt());
        konnectService.getPaymentDetails.mockResolvedValue(completedPaymentDetails);
        orderModel.findById.mockResolvedValue(makeOrder());
        attemptModel.findOneAndUpdate.mockResolvedValue(null);

        await service.handleOrderWebhook(PAYMENT_REF);

        expect(mockConnection.startSession).not.toHaveBeenCalled();
      });
    });

    describe('No PaymentAttempt found', () => {
      it('should return silently when no attempt exists for the ref', async () => {
        attemptModel.findOne.mockResolvedValue(null);

        await expect(service.handleOrderWebhook('unknown-ref')).resolves.toBeUndefined();

        expect(konnectService.getPaymentDetails).not.toHaveBeenCalled();
      });
    });

    describe('Konnect verification failure', () => {
      it('should return silently if Konnect API is unreachable', async () => {
        attemptModel.findOne.mockResolvedValue(makeAttempt());
        konnectService.getPaymentDetails.mockRejectedValue(new Error('Network timeout'));

        await expect(service.handleOrderWebhook(PAYMENT_REF)).resolves.toBeUndefined();

        expect(orderModel.findById).not.toHaveBeenCalled();
      });
    });

    describe('Non-completed payment status from Konnect', () => {
      it('should return silently if Konnect status is not completed', async () => {
        attemptModel.findOne.mockResolvedValue(makeAttempt());
        konnectService.getPaymentDetails.mockResolvedValue({
          payment: { id: KONNECT_PAYMENT_ID, amount: 10000, status: 'pending' },
        });

        await service.handleOrderWebhook(PAYMENT_REF);

        expect(orderModel.findById).not.toHaveBeenCalled();
      });
    });

    describe('Amount mismatch', () => {
      it('should NOT credit the merchant when the amount does not match', async () => {
        attemptModel.findOne.mockResolvedValue(makeAttempt({ amount: 10.0 }));
        konnectService.getPaymentDetails.mockResolvedValue({
          payment: { id: KONNECT_PAYMENT_ID, amount: 5000, status: 'completed' },
        });
        orderModel.findById.mockResolvedValue(makeOrder());
        attemptModel.findByIdAndUpdate.mockResolvedValue({});
        refundRequestModel.findOneAndUpdate.mockResolvedValue({});

        await service.handleOrderWebhook(PAYMENT_REF);

        // Never marked PAID and no sale records created
        expect(orderModel.findByIdAndUpdate).not.toHaveBeenCalledWith(
          ORDER_ID,
          expect.objectContaining({ paymentStatus: PaymentStatus.PAID }),
          expect.anything(),
        );
        expect(walletTxModel.create).not.toHaveBeenCalled();
      });

      it('should flag the attempt anomalous and open a refund request (money captured)', async () => {
        attemptModel.findOne.mockResolvedValue(makeAttempt({ amount: 10.0 }));
        konnectService.getPaymentDetails.mockResolvedValue({
          payment: { id: KONNECT_PAYMENT_ID, amount: 5000, status: 'completed' },
        });
        orderModel.findById.mockResolvedValue(makeOrder());
        attemptModel.findByIdAndUpdate.mockResolvedValue({});
        refundRequestModel.findOneAndUpdate.mockResolvedValue({});

        await service.handleOrderWebhook(PAYMENT_REF);

        expect(attemptModel.findByIdAndUpdate).toHaveBeenCalledWith(
          ATTEMPT_ID,
          expect.objectContaining({ status: 'anomalous', active: false }),
        );
        expect(refundRequestModel.findOneAndUpdate).toHaveBeenCalledWith(
          { orderId: ORDER_ID },
          expect.objectContaining({
            $setOnInsert: expect.objectContaining({ reason: 'anomalous_payment' }),
          }),
          { upsert: true },
        );
      });

      it('should skip reprocessing once the attempt is already anomalous (idempotent)', async () => {
        attemptModel.findOne.mockResolvedValue(makeAttempt({ status: 'anomalous' }));

        await service.handleOrderWebhook(PAYMENT_REF);

        // Bailed at the status guard — never re-verified with Konnect
        expect(konnectService.getPaymentDetails).not.toHaveBeenCalled();
        expect(orderModel.findById).not.toHaveBeenCalled();
      });
    });

    describe('Order already PAID by different attempt', () => {
      it('should mark attempt as anomalous and create refund request', async () => {
        attemptModel.findOne.mockResolvedValue(makeAttempt({ reference: 'different-ref' }));
        konnectService.getPaymentDetails.mockResolvedValue(completedPaymentDetails);
        orderModel.findById.mockResolvedValue(
          makeOrder({
            paymentStatus: PaymentStatus.PAID,
            paymentSession: { reference: 'already-paid-ref' },
          }),
        );
        attemptModel.findByIdAndUpdate.mockResolvedValue({});
        refundRequestModel.findOneAndUpdate.mockResolvedValue({});

        await service.handleOrderWebhook('different-ref');

        expect(attemptModel.findByIdAndUpdate).toHaveBeenCalledWith(
          ATTEMPT_ID,
          expect.objectContaining({ status: 'anomalous', active: false }),
        );
        expect(refundRequestModel.findOneAndUpdate).toHaveBeenCalledWith(
          { orderId: ORDER_ID },
          expect.objectContaining({
            $setOnInsert: expect.objectContaining({ reason: 'anomalous_payment' }),
          }),
          { upsert: true },
        );
      });
    });

    describe('Order already cancelled/expired when payment completes', () => {
      it.each([OrderStatus.CANCELLED, OrderStatus.EXPIRED])(
        'should create anomalous refund when order is %s',
        async status => {
          attemptModel.findOne.mockResolvedValue(makeAttempt());
          konnectService.getPaymentDetails.mockResolvedValue(completedPaymentDetails);
          orderModel.findById.mockResolvedValue(makeOrder({ status }));
          attemptModel.findByIdAndUpdate.mockResolvedValue({});
          refundRequestModel.findOneAndUpdate.mockResolvedValue({});

          await service.handleOrderWebhook(PAYMENT_REF);

          expect(attemptModel.findByIdAndUpdate).toHaveBeenCalledWith(
            ATTEMPT_ID,
            expect.objectContaining({
              status: 'anomalous',
              failedReason: expect.stringContaining(status),
            }),
          );
        },
      );
    });

    describe('Transaction rollback on failure', () => {
      it('should reset attempt to pending if transaction fails', async () => {
        attemptModel.findOne.mockResolvedValue(makeAttempt());
        konnectService.getPaymentDetails.mockResolvedValue(completedPaymentDetails);
        orderModel.findById.mockResolvedValue(makeOrder());
        attemptModel.findOneAndUpdate.mockResolvedValue(makeAttempt({ status: 'processing' }));

        const mockSession = {
          withTransaction: jest.fn().mockRejectedValue(new Error('DB write failed')),
          endSession: jest.fn().mockResolvedValue(undefined),
        };
        mockConnection.startSession.mockResolvedValue(mockSession);

        attemptModel.findByIdAndUpdate.mockResolvedValue({});

        await expect(service.handleOrderWebhook(PAYMENT_REF)).rejects.toThrow('DB write failed');

        expect(attemptModel.findByIdAndUpdate).toHaveBeenCalledWith(ATTEMPT_ID, {
          status: 'pending',
          claimedAt: null,
        });
        expect(mockSession.endSession).toHaveBeenCalled();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // createRetrySession
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createRetrySession', () => {
    const user = makeUser();

    it('should throw if order is not PENDING_PAYMENT', async () => {
      const order = makeOrder({ status: OrderStatus.CONFIRMED });

      await expect(service.createRetrySession(order, user)).rejects.toThrow(BadRequestException);
    });

    it('should return existing payUrl if active attempt is still valid', async () => {
      const order = makeOrder({
        paymentSession: { payUrl: PAY_URL, reference: PAYMENT_REF },
      });
      attemptModel.findOne.mockReturnValue({
        sort: jest
          .fn()
          .mockResolvedValue(
            makeAttempt({ providerExpiresAt: new Date(Date.now() + 10 * 60 * 1000) }),
          ),
      });
      konnectService.getPaymentDetails.mockResolvedValue({
        payment: { id: KONNECT_PAYMENT_ID, amount: 10000, status: 'pending' },
      });

      const result = await service.createRetrySession(order, user);

      expect(result.payUrl).toBe(PAY_URL);
      expect(konnectService.initPayment).not.toHaveBeenCalled();
    });

    it('should open a fresh session when the previous attempt FAILED (dead payUrl)', async () => {
      const order = makeOrder({
        paymentSession: { payUrl: PAY_URL, reference: PAYMENT_REF },
      });
      attemptModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(
          // still within lifespan, but Konnect says the payment failed
          makeAttempt({ providerExpiresAt: new Date(Date.now() + 10 * 60 * 1000) }),
        ),
      });
      konnectService.getPaymentDetails.mockResolvedValue({
        payment: { id: KONNECT_PAYMENT_ID, amount: 10000, status: 'failed' },
      });
      attemptModel.findByIdAndUpdate.mockResolvedValue({});

      const result = await service.createRetrySession(order, user);

      // Old (failed) session must be superseded, not reused
      expect(attemptModel.findByIdAndUpdate).toHaveBeenCalledWith(
        ATTEMPT_ID,
        expect.objectContaining({ status: 'expired', active: false }),
      );
      expect(konnectService.initPayment).toHaveBeenCalledTimes(1);
      expect(result.paymentRef).toBe(PAYMENT_REF);
    });

    it('should detect completed payment and throw after updating', async () => {
      const order = makeOrder();
      const attempt = makeAttempt();

      // findOne is called twice:
      // 1) createRetrySession: .findOne({orderId, active}).sort(...)
      // 2) handleOrderWebhook: .findOne({reference})
      let findOneCallCount = 0;
      // First call returns a query stub (.sort chain); second returns a promise.
      attemptModel.findOne.mockImplementation((): unknown => {
        findOneCallCount++;
        if (findOneCallCount === 1) {
          return { sort: jest.fn().mockResolvedValue(attempt) };
        }
        return Promise.resolve(attempt);
      });

      konnectService.getPaymentDetails.mockResolvedValue({
        payment: { id: KONNECT_PAYMENT_ID, amount: 10000, status: 'completed' },
      });

      // handleOrderWebhook will be called internally — mock the chain
      attemptModel.findOneAndUpdate.mockResolvedValue(makeAttempt({ status: 'processing' }));
      orderModel.findById.mockResolvedValue(order);
      attemptModel.findByIdAndUpdate.mockResolvedValue({});
      orderModel.findByIdAndUpdate.mockResolvedValue({});
      establishmentModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: ESTABLISHMENT_ID, ownerId: MERCHANT_ID }),
        }),
      });
      walletTxModel.create.mockResolvedValue({});
      walletModel.findOneAndUpdate.mockResolvedValue({});
      platformTxModel.create.mockResolvedValue({});

      await expect(service.createRetrySession(order, user)).rejects.toThrow(
        'Previous payment was actually successful',
      );
    });

    it('should expire old attempt and create new session when provider session expired', async () => {
      const order = makeOrder();
      attemptModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(
          makeAttempt({
            providerExpiresAt: new Date(Date.now() - 60 * 1000), // expired 1 min ago
          }),
        ),
      });
      konnectService.getPaymentDetails.mockResolvedValue({
        payment: { id: KONNECT_PAYMENT_ID, amount: 10000, status: 'pending' },
      });
      attemptModel.findByIdAndUpdate.mockResolvedValue({});

      // initOrderPayment chain
      orderModel.findByIdAndUpdate.mockResolvedValue({ ...order, paymentAttemptSequence: 2 });
      attemptModel.create.mockResolvedValue({});

      const result = await service.createRetrySession(order, user);

      expect(attemptModel.findByIdAndUpdate).toHaveBeenCalledWith(
        ATTEMPT_ID,
        expect.objectContaining({ status: 'expired', active: false }),
      );
      expect(result.payUrl).toBe(PAY_URL);
    });

    it('should handle no active attempt gracefully and create new session', async () => {
      const order = makeOrder();
      attemptModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });

      orderModel.findByIdAndUpdate.mockResolvedValue({ ...order, paymentAttemptSequence: 1 });
      attemptModel.create.mockResolvedValue({});

      const result = await service.createRetrySession(order, user);

      expect(result.payUrl).toBe(PAY_URL);
    });

    it('should handle Konnect API failure during verification and create new session', async () => {
      const order = makeOrder();
      attemptModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(makeAttempt()),
      });
      konnectService.getPaymentDetails.mockRejectedValue(new Error('Network error'));
      attemptModel.findByIdAndUpdate.mockResolvedValue({});

      orderModel.findByIdAndUpdate.mockResolvedValue({ ...order, paymentAttemptSequence: 2 });
      attemptModel.create.mockResolvedValue({});

      const result = await service.createRetrySession(order, user);

      expect(result.payUrl).toBe(PAY_URL);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // processPickupConfirmation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('processPickupConfirmation', () => {
    it('should move funds from pending to available balance', async () => {
      const order = makeOrder({ pricing: { subtotal: 10.0, deliveryFee: 0, total: 10.0 } });
      establishmentModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: ESTABLISHMENT_ID, ownerId: MERCHANT_ID }),
        }),
      });
      walletModel.findOneAndUpdate.mockResolvedValue({});

      await service.processPickupConfirmation(order);

      expect(walletModel.findOneAndUpdate).toHaveBeenCalledWith(
        { establishmentId: order.establishmentId },
        {
          $inc: {
            pendingBalance: -8.1,
            availableBalance: 8.1,
          },
        },
        expect.anything(),
      );
    });

    it('should throw NotFoundException if establishment not found', async () => {
      const order = makeOrder();
      establishmentModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(service.processPickupConfirmation(order)).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // processRefundRequest
  // ═══════════════════════════════════════════════════════════════════════════

  describe('processRefundRequest', () => {
    const mockSession = {} as any;

    beforeEach(() => {
      walletModel.findOneAndUpdate.mockResolvedValue({});
      walletTxModel.create.mockResolvedValue({});
      platformTxModel.create.mockResolvedValue({});
      refundRequestModel.create.mockResolvedValue({});
    });

    it('should reverse wallet balance, create refund records', async () => {
      const order = makeOrder({
        pricing: { subtotal: 10.0, deliveryFee: 0, total: 10.0 },
        paymentSession: { reference: PAYMENT_REF },
      });

      await service.processRefundRequest(order, CUSTOMER_ID, 'consumer_cancel', mockSession);

      // Reverse pendingBalance
      expect(walletModel.findOneAndUpdate).toHaveBeenCalledWith(
        { establishmentId: order.establishmentId },
        { $inc: { pendingBalance: -8.1 } },
        { session: mockSession },
      );

      // REFUND wallet transaction
      expect(walletTxModel.create).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            type: 'REFUND',
            amount: -8.1,
          }),
        ],
        { session: mockSession },
      );

      // Platform refund records (negative amounts)
      const platformRecords = platformTxModel.create.mock.calls[0][0];
      const commissionRefund = platformRecords.find(
        (r: { type: string }) => r.type === 'NET_COMMISSION',
      );
      const donationRefund = platformRecords.find((r: { type: string }) => r.type === 'DONATION');
      expect(commissionRefund.amount).toBe(-1.805);
      expect(donationRefund.amount).toBe(-0.095);

      // Refund request record
      expect(refundRequestModel.create).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            reason: 'consumer_cancel',
            amount: 10.0,
            status: 'pending',
            providerReference: PAYMENT_REF,
          }),
        ],
        { session: mockSession },
      );
    });

    it('should handle merchant_cancel reason', async () => {
      const order = makeOrder({ pricing: { subtotal: 5.0, deliveryFee: 0, total: 5.0 } });

      await service.processRefundRequest(order, MERCHANT_ID, 'merchant_cancel', mockSession);

      expect(refundRequestModel.create).toHaveBeenCalledWith(
        [expect.objectContaining({ reason: 'merchant_cancel' })],
        { session: mockSession },
      );
    });

    it('should calculate correct amounts for non-round totals', async () => {
      const order = makeOrder({ pricing: { subtotal: 7.55, deliveryFee: 0, total: 7.55 } });

      await service.processRefundRequest(order, CUSTOMER_ID, 'consumer_cancel', mockSession);

      const merchantAmount = parseFloat((7.55 * 0.81).toFixed(3)); // 6.116
      const platformFee = parseFloat((7.55 * 0.19).toFixed(3)); // 1.435
      const donation = parseFloat((platformFee * 0.05).toFixed(3)); // 0.072
      const netCommission = parseFloat((platformFee - donation).toFixed(3)); // 1.363

      expect(walletModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { $inc: { pendingBalance: -merchantAmount } },
        expect.anything(),
      );

      const platformRecords = platformTxModel.create.mock.calls[0][0];
      expect(platformRecords[0].amount).toBe(-netCommission);
      expect(platformRecords[1].amount).toBe(-donation);
    });
  });
});
