/* eslint-disable require-await */
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';

import { PaymentStatus } from '@foodwaste/shared';

import { Order } from '../../orders/schemas/order.schema';
import { PaymentAttempt } from '../schemas/payment-attempt.schema';
import { KonnectOrderService } from '../services/konnect-order.service';

import { PaymentReconciliationTask } from './payment-reconciliation.task';

import type { TestingModule } from '@nestjs/testing';

const ATTEMPT_ID = new Types.ObjectId();
const ORDER_ID = new Types.ObjectId();

const makeStaleAttempt = (overrides: Record<string, unknown> = {}) => ({
  _id: ATTEMPT_ID,
  orderId: ORDER_ID,
  reference: 'ref-stale-123',
  status: 'pending',
  createdAt: new Date(Date.now() - 10 * 60_000),
  ...overrides,
});

const makeUnresolvedOrder = (overrides: Record<string, unknown> = {}) => ({
  _id: ORDER_ID,
  status: 'pending_payment',
  paymentStatus: PaymentStatus.PENDING,
  paymentExpiresAt: new Date(Date.now() - 10 * 60_000),
  paymentSession: { reference: 'ref-order-456' },
  ...overrides,
});

const createMockModel = () => ({
  find: jest.fn(),
  findByIdAndUpdate: jest.fn().mockResolvedValue({}),
});

describe('PaymentReconciliationTask', () => {
  let task: PaymentReconciliationTask;
  let attemptModel: ReturnType<typeof createMockModel>;
  let orderModel: ReturnType<typeof createMockModel>;
  let konnectOrderService: { handleOrderWebhook: jest.Mock };

  beforeEach(async () => {
    attemptModel = createMockModel();
    orderModel = createMockModel();
    konnectOrderService = { handleOrderWebhook: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentReconciliationTask,
        { provide: getModelToken(PaymentAttempt.name), useValue: attemptModel },
        { provide: getModelToken(Order.name), useValue: orderModel },
        { provide: KonnectOrderService, useValue: konnectOrderService },
      ],
    }).compile();

    task = module.get(PaymentReconciliationTask);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('reconcilePendingPayments', () => {
    it('should do nothing when no stale attempts or unresolved orders', async () => {
      attemptModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([]) });
      orderModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([]) });

      await task.reconcilePendingPayments();

      expect(konnectOrderService.handleOrderWebhook).not.toHaveBeenCalled();
    });

    it('should re-invoke webhook for stale pending attempts', async () => {
      const attempt = makeStaleAttempt();
      attemptModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([attempt]) });
      orderModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([]) });

      await task.reconcilePendingPayments();

      expect(konnectOrderService.handleOrderWebhook).toHaveBeenCalledWith('ref-stale-123');
    });

    it('should reset "processing" attempts to "pending" before re-invoking', async () => {
      const attempt = makeStaleAttempt({ status: 'processing' });
      attemptModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([attempt]) });
      orderModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([]) });

      await task.reconcilePendingPayments();

      expect(attemptModel.findByIdAndUpdate).toHaveBeenCalledWith(ATTEMPT_ID, {
        status: 'pending',
        claimedAt: null,
      });
      expect(konnectOrderService.handleOrderWebhook).toHaveBeenCalledWith('ref-stale-123');
    });

    it('should NOT reset "pending" attempts (only "processing")', async () => {
      const attempt = makeStaleAttempt({ status: 'pending' });
      attemptModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([attempt]) });
      orderModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([]) });

      await task.reconcilePendingPayments();

      expect(attemptModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should handle webhook failure for stale attempt without crashing', async () => {
      const attempt = makeStaleAttempt();
      attemptModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([attempt]) });
      orderModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([]) });
      konnectOrderService.handleOrderWebhook.mockRejectedValue(new Error('DB down'));

      await expect(task.reconcilePendingPayments()).resolves.toBeUndefined();
    });

    it('should process unresolved orders via webhook', async () => {
      attemptModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([]) });
      const order = makeUnresolvedOrder();
      orderModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([order]) });

      await task.reconcilePendingPayments();

      expect(konnectOrderService.handleOrderWebhook).toHaveBeenCalledWith('ref-order-456');
    });

    it('should skip unresolved orders without paymentSession.reference', async () => {
      attemptModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([]) });
      const order = makeUnresolvedOrder({ paymentSession: null });
      orderModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([order]) });

      await task.reconcilePendingPayments();

      expect(konnectOrderService.handleOrderWebhook).not.toHaveBeenCalled();
    });

    it('should continue processing remaining items after one failure', async () => {
      const attempt1 = makeStaleAttempt({ _id: new Types.ObjectId(), reference: 'ref-1' });
      const attempt2 = makeStaleAttempt({ _id: new Types.ObjectId(), reference: 'ref-2' });
      attemptModel.find.mockReturnValue({
        limit: jest.fn().mockResolvedValue([attempt1, attempt2]),
      });
      orderModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([]) });

      konnectOrderService.handleOrderWebhook
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(undefined);

      await task.reconcilePendingPayments();

      expect(konnectOrderService.handleOrderWebhook).toHaveBeenCalledTimes(2);
    });

    it('should process both stale attempts and unresolved orders in same run', async () => {
      const attempt = makeStaleAttempt({ reference: 'ref-attempt' });
      const order = makeUnresolvedOrder({ paymentSession: { reference: 'ref-order' } });
      attemptModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([attempt]) });
      orderModel.find.mockReturnValue({ limit: jest.fn().mockResolvedValue([order]) });

      await task.reconcilePendingPayments();

      expect(konnectOrderService.handleOrderWebhook).toHaveBeenCalledWith('ref-attempt');
      expect(konnectOrderService.handleOrderWebhook).toHaveBeenCalledWith('ref-order');
      expect(konnectOrderService.handleOrderWebhook).toHaveBeenCalledTimes(2);
    });
  });
});
