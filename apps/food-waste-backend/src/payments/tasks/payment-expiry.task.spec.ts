/* eslint-disable require-await */
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';

import { OrderStatus, PaymentStatus } from '@foodwaste/shared';

import { Order } from '../../orders/schemas/order.schema';
import { Offer } from '../../offers/schemas/offer.schema';
import { CronLockService } from '../../common/services/cron-lock.service';
import { KonnectService } from '../../subscription/services/konnect.service';
import { KonnectOrderService } from '../services/konnect-order.service';
import { PaymentAttempt } from '../schemas/payment-attempt.schema';

import { PaymentExpiryTask } from './payment-expiry.task';

import type { TestingModule } from '@nestjs/testing';

const ORDER_A = new Types.ObjectId();
const ORDER_B = new Types.ObjectId();
const OFFER_ID = new Types.ObjectId();

const makeExpiredOrder = (overrides: Record<string, unknown> = {}) => ({
  _id: ORDER_A,
  status: OrderStatus.PENDING_PAYMENT,
  paymentStatus: PaymentStatus.PENDING,
  paymentExpiresAt: new Date(Date.now() - 60_000),
  paymentSession: { reference: 'ref-abc', payUrl: 'https://pay.test' },
  items: [{ offerId: OFFER_ID, quantity: 2 }],
  ...overrides,
});

const createMockModel = () => ({
  find: jest.fn(),
  findByIdAndUpdate: jest.fn().mockResolvedValue({}),
  updateMany: jest.fn().mockResolvedValue({}),
});

describe('PaymentExpiryTask', () => {
  let task: PaymentExpiryTask;
  let orderModel: ReturnType<typeof createMockModel>;
  let offerModel: ReturnType<typeof createMockModel>;
  let attemptModel: ReturnType<typeof createMockModel>;
  let konnectService: { getPaymentDetails: jest.Mock };
  let konnectOrderService: { handleOrderWebhook: jest.Mock };
  let mockSession: { withTransaction: jest.Mock; endSession: jest.Mock };
  let mockConnection: { startSession: jest.Mock };

  beforeEach(async () => {
    orderModel = createMockModel();
    offerModel = createMockModel();
    attemptModel = createMockModel();
    konnectService = { getPaymentDetails: jest.fn() };
    konnectOrderService = { handleOrderWebhook: jest.fn().mockResolvedValue(undefined) };

    mockSession = {
      withTransaction: jest.fn().mockImplementation(async (fn: () => Promise<void>) => fn()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    mockConnection = { startSession: jest.fn().mockResolvedValue(mockSession) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentExpiryTask,
        { provide: getConnectionToken(), useValue: mockConnection },
        { provide: getModelToken(Order.name), useValue: orderModel },
        { provide: getModelToken(Offer.name), useValue: offerModel },
        { provide: getModelToken(PaymentAttempt.name), useValue: attemptModel },
        { provide: KonnectService, useValue: konnectService },
        { provide: KonnectOrderService, useValue: konnectOrderService },
        // Always wins the lock, so the existing assertions still exercise the
        // real job body. Lock behaviour itself is covered in
        // common/services/__tests__/cron-lock.service.spec.ts.
        {
          provide: CronLockService,
          useValue: {
            runExclusive: jest.fn(
              async (_name: string, _ttl: number, fn: () => Promise<unknown>) => {
                const result = await fn();
                return result;
              },
            ),
          },
        },
      ],
    }).compile();

    task = module.get(PaymentExpiryTask);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('handlePaymentExpiry', () => {
    it('should do nothing when no expired orders found', async () => {
      orderModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([]) });

      await task.handlePaymentExpiry();

      expect(konnectService.getPaymentDetails).not.toHaveBeenCalled();
    });

    it('should expire order when Konnect confirms payment is NOT completed', async () => {
      const order = makeExpiredOrder();
      orderModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([order]) });
      konnectService.getPaymentDetails.mockResolvedValue({
        payment: { id: 'p1', amount: 10000, status: 'pending' },
      });

      await task.handlePaymentExpiry();

      expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
        ORDER_A,
        {
          status: OrderStatus.EXPIRED,
          paymentStatus: PaymentStatus.FAILED,
        },
        expect.objectContaining({ session: mockSession }),
      );
    });

    it('should release inventory on expiry', async () => {
      const order = makeExpiredOrder();
      orderModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([order]) });
      konnectService.getPaymentDetails.mockResolvedValue({
        payment: { id: 'p1', amount: 10000, status: 'pending' },
      });

      await task.handlePaymentExpiry();

      expect(offerModel.findByIdAndUpdate).toHaveBeenCalledWith(
        OFFER_ID,
        { $inc: { reservedQuantity: -2 } },
        expect.objectContaining({ session: mockSession }),
      );
    });

    it('should expire all active payment attempts', async () => {
      const order = makeExpiredOrder();
      orderModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([order]) });
      konnectService.getPaymentDetails.mockResolvedValue({
        payment: { id: 'p1', amount: 10000, status: 'pending' },
      });

      await task.handlePaymentExpiry();

      expect(attemptModel.updateMany).toHaveBeenCalledWith(
        { orderId: ORDER_A, active: true },
        { status: 'expired', active: false },
        expect.objectContaining({ session: mockSession }),
      );
    });

    it('should process webhook instead of expiring when Konnect says completed', async () => {
      const order = makeExpiredOrder();
      orderModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([order]) });
      konnectService.getPaymentDetails.mockResolvedValue({
        payment: { id: 'p1', amount: 10000, status: 'completed' },
      });

      await task.handlePaymentExpiry();

      expect(konnectOrderService.handleOrderWebhook).toHaveBeenCalledWith('ref-abc');
      expect(orderModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should skip order (safe) when Konnect is unreachable — no expiry', async () => {
      const order = makeExpiredOrder();
      orderModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([order]) });
      konnectService.getPaymentDetails.mockRejectedValue(new Error('Connection timeout'));

      await task.handlePaymentExpiry();

      expect(orderModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(konnectOrderService.handleOrderWebhook).not.toHaveBeenCalled();
    });

    it('should expire directly when order has no paymentSession.reference', async () => {
      const order = makeExpiredOrder({ paymentSession: null });
      orderModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([order]) });

      await task.handlePaymentExpiry();

      expect(konnectService.getPaymentDetails).not.toHaveBeenCalled();
      expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
        ORDER_A,
        expect.objectContaining({ status: OrderStatus.EXPIRED }),
        expect.anything(),
      );
    });

    it('should handle multiple expired orders independently', async () => {
      const orderA = makeExpiredOrder();
      const orderB = makeExpiredOrder({
        _id: ORDER_B,
        paymentSession: { reference: 'ref-xyz' },
        items: [{ offerId: OFFER_ID, quantity: 1 }],
      });
      orderModel.find.mockReturnValue({
        limit: jest.fn().mockResolvedValue([orderA, orderB]),
      });
      // First: Konnect unreachable (skip), Second: not completed (expire)
      konnectService.getPaymentDetails
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce({
          payment: { id: 'p2', amount: 5000, status: 'failed' },
        });

      await task.handlePaymentExpiry();

      // OrderA skipped, OrderB expired
      expect(orderModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
        ORDER_B,
        expect.objectContaining({ status: OrderStatus.EXPIRED }),
        expect.anything(),
      );
    });

    it('should handle order with empty items array during expiry', async () => {
      const order = makeExpiredOrder({ items: [] });
      orderModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([order]) });
      konnectService.getPaymentDetails.mockResolvedValue({
        payment: { id: 'p1', amount: 10000, status: 'pending' },
      });

      await task.handlePaymentExpiry();

      expect(orderModel.findByIdAndUpdate).toHaveBeenCalled();
      expect(offerModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });
});
