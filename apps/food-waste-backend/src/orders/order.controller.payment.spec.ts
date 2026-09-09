import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { UserRole } from '@foodwaste/shared';

import { OrdersController } from './order.controller';

import type { AuthenticatedRequest } from '../common/decorators/get-user.decorator';

const ORDER_ID = new Types.ObjectId().toString();
const USER_ID = new Types.ObjectId().toString();
const PAY_URL = 'https://konnect.network/pay/test-ref';

const makeReq = (overrides: Record<string, unknown> = {}): AuthenticatedRequest =>
  ({
    user: {
      userId: USER_ID,
      email: 'consumer@test.com',
      role: UserRole.CONSUMER,
    },
    ...overrides,
  }) as any;

const makeOrder = (overrides: Record<string, unknown> = {}) => ({
  _id: ORDER_ID,
  orderNumber: 'ORD-100',
  status: 'pending_payment',
  paymentMethod: 'online',
  customerId: {
    _id: new Types.ObjectId(),
    firstName: 'Ahmed',
    lastName: 'Test',
    email: 'ahmed@test.com',
  },
  pricing: { total: 15, currency: 'TND' },
  ...overrides,
});

describe('OrdersController — retryPayment', () => {
  let controller: OrdersController;
  let ordersService: { findById: jest.Mock };
  let konnectOrderService: { createRetrySession: jest.Mock };
  let logger: Record<string, jest.Mock>;

  beforeEach(() => {
    ordersService = { findById: jest.fn() };
    konnectOrderService = { createRetrySession: jest.fn() };
    logger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      setContext: jest.fn(),
    };

    controller = new OrdersController(
      ordersService as any,
      logger as any,
      konnectOrderService as any,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should return payUrl on successful retry', async () => {
    ordersService.findById.mockResolvedValue(makeOrder());
    konnectOrderService.createRetrySession.mockResolvedValue({
      payUrl: PAY_URL,
      paymentRef: 'test-ref',
    });

    const result = await controller.retryPayment(ORDER_ID, makeReq());

    expect(result).toEqual({
      statusCode: HttpStatus.OK,
      message: 'Payment session ready',
      data: { payUrl: PAY_URL },
    });
  });

  it('should pass customer info from populated order', async () => {
    ordersService.findById.mockResolvedValue(makeOrder());
    konnectOrderService.createRetrySession.mockResolvedValue({
      payUrl: PAY_URL,
      paymentRef: 'ref',
    });

    await controller.retryPayment(ORDER_ID, makeReq());

    expect(konnectOrderService.createRetrySession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        firstName: 'Ahmed',
        lastName: 'Test',
        email: 'ahmed@test.com',
      }),
    );
  });

  it('should fall back to req.user.email when customer email is missing', async () => {
    ordersService.findById.mockResolvedValue(
      makeOrder({
        customerId: { _id: new Types.ObjectId(), firstName: 'X', lastName: 'Y' },
      }),
    );
    konnectOrderService.createRetrySession.mockResolvedValue({
      payUrl: PAY_URL,
      paymentRef: 'ref',
    });

    await controller.retryPayment(ORDER_ID, makeReq());

    expect(konnectOrderService.createRetrySession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: 'consumer@test.com' }),
    );
  });

  it('should throw if order is not found', async () => {
    ordersService.findById.mockRejectedValue(new NotFoundException('Order not found'));

    await expect(controller.retryPayment('bad-id', makeReq())).rejects.toThrow(NotFoundException);
  });

  it('should propagate BadRequestException from createRetrySession', async () => {
    ordersService.findById.mockResolvedValue(makeOrder({ status: 'confirmed' }));
    konnectOrderService.createRetrySession.mockRejectedValue(
      new BadRequestException('Order is not awaiting payment'),
    );

    await expect(controller.retryPayment(ORDER_ID, makeReq())).rejects.toThrow(
      'Order is not awaiting payment',
    );
  });

  it('should call ordersService.findById with correct userId and role', async () => {
    ordersService.findById.mockResolvedValue(makeOrder());
    konnectOrderService.createRetrySession.mockResolvedValue({
      payUrl: PAY_URL,
      paymentRef: 'ref',
    });

    await controller.retryPayment(ORDER_ID, makeReq());

    expect(ordersService.findById).toHaveBeenCalledWith(ORDER_ID, USER_ID, UserRole.CONSUMER);
  });

  it('should use empty strings for missing customer firstName/lastName', async () => {
    ordersService.findById.mockResolvedValue(
      makeOrder({ customerId: { _id: new Types.ObjectId() } }),
    );
    konnectOrderService.createRetrySession.mockResolvedValue({
      payUrl: PAY_URL,
      paymentRef: 'ref',
    });

    await controller.retryPayment(ORDER_ID, makeReq());

    expect(konnectOrderService.createRetrySession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ firstName: '', lastName: '' }),
    );
  });
});
