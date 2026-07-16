/**
 * ordersService — Unit Tests
 *
 * Focus: the error-mapping surface (where payment/order bugs hide) and the
 * payUrl handoff for online payments. axios stays real so isAxiosError /
 * isCancel behave exactly as in production; only the network client is stubbed.
 */

import { ordersService } from '../ordersService';

import type { CreateOrderDto } from '../../types/order.types';

// Stub the network layer only. unwrapBackendResponse mirrors the real contract
// (payload lives at response.data.data) without dragging in Keychain/store/i18n.
const mockPost = jest.fn();
const mockGet = jest.fn();
const mockPatch = jest.fn();

jest.mock('@/services/apiClient', () => ({
  apiClient: {
    post: (...args: unknown[]) => mockPost(...args),
    get: (...args: unknown[]) => mockGet(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
  },
  unwrapBackendResponse: (response: { data: { data: unknown } }) => response.data.data,
}));

jest.mock('@/utils/logger', () => ({
  Logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn(), info: jest.fn() },
}));

interface AxiosLikeErrorInit {
  data?: unknown;
  code?: string;
  message?: string;
}

/** Build an object axios.isAxiosError recognises (isAxiosError === true). */
function makeAxiosError({ data, code, message }: AxiosLikeErrorInit): unknown {
  return {
    isAxiosError: true,
    ...(data !== undefined ? { response: { data } } : {}),
    ...(code !== undefined ? { code } : {}),
    message: message ?? 'Request failed',
    toJSON: () => ({}),
  };
}

const envelope = <T>(data: T, extra: Record<string, unknown> = {}) => ({
  data: { status: 200, message: 'ok', data, ...extra },
});

const ORDER_DTO: CreateOrderDto = {
  items: [{ offerId: 'offer-1', quantity: 1 }],
  establishmentId: 'est-1',
  pickupTimeSlot: { startTime: '14:00', endTime: '16:00' },
  pickupDate: new Date(Date.now() + 3600_000).toISOString(),
  paymentMethod: 'online',
} as CreateOrderDto;

beforeEach(() => {
  mockPost.mockReset();
  mockGet.mockReset();
  mockPatch.mockReset();
});

describe('ordersService.createOrder', () => {
  it('returns the order with payUrl for an online payment', async () => {
    mockPost.mockResolvedValue(
      envelope({ _id: 'o1', orderNumber: 'A1' }, { payUrl: 'https://konnect.pay/xyz' }),
    );

    const order = await ordersService.createOrder(ORDER_DTO);

    expect(order._id).toBe('o1');
    expect(order.payUrl).toBe('https://konnect.pay/xyz');
    expect(mockPost).toHaveBeenCalledWith('/orders', ORDER_DTO, expect.any(Object));
  });

  it('returns the order WITHOUT a payUrl for a cash order', async () => {
    mockPost.mockResolvedValue(envelope({ _id: 'o2', orderNumber: 'A2' }));

    const order = await ordersService.createOrder({
      ...ORDER_DTO,
      paymentMethod: 'cash_on_pickup',
    });

    expect(order._id).toBe('o2');
    expect(order.payUrl).toBeUndefined();
  });

  it('preserves the phone-verification error object (code + flags) for the retry flow', async () => {
    mockPost.mockRejectedValue(
      makeAxiosError({
        data: {
          code: 'PHONE_VERIFICATION_REQUIRED',
          message: 'Phone verification required',
          requiresPhoneSetup: true,
          requiresPhoneVerification: false,
        },
      }),
    );

    await expect(ordersService.createOrder(ORDER_DTO)).rejects.toMatchObject({
      code: 'PHONE_VERIFICATION_REQUIRED',
      requiresPhoneSetup: true,
      requiresPhoneVerification: false,
    });
  });

  it('preserves a pickup error payload (code) so the UI can map it', async () => {
    mockPost.mockRejectedValue(
      makeAxiosError({ data: { statusCode: 400, code: 'CODE_EXPIRED', message: 'expired' } }),
    );

    await expect(ordersService.createOrder(ORDER_DTO)).rejects.toMatchObject({
      code: 'CODE_EXPIRED',
    });
  });

  it('flattens NestJS validation constraint arrays into a readable message', async () => {
    mockPost.mockRejectedValue(
      makeAxiosError({
        data: { message: [{ constraints: { isNotEmpty: 'quantity must not be empty' } }] },
      }),
    );

    await expect(ordersService.createOrder(ORDER_DTO)).rejects.toThrow(
      'quantity must not be empty',
    );
  });

  it('surfaces per-offer validation reasons from details[]', async () => {
    mockPost.mockRejectedValue(
      makeAxiosError({
        data: { details: [{ reason: 'Selected pickup time slot is fully booked' }] },
      }),
    );

    await expect(ordersService.createOrder(ORDER_DTO)).rejects.toThrow(
      'Selected pickup time slot is fully booked',
    );
  });

  it('uses a plain string backend message when present', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ data: { message: 'Insufficient stock' } }));

    await expect(ordersService.createOrder(ORDER_DTO)).rejects.toThrow('Insufficient stock');
  });

  it('rethrows a cancellation error unchanged (does not convert to a generic Error)', async () => {
    const cancelError = makeAxiosError({ code: 'ERR_CANCELED', message: 'canceled' });
    mockPost.mockRejectedValue(cancelError);

    await expect(ordersService.createOrder(ORDER_DTO)).rejects.toBe(cancelError);
  });

  it('wraps a non-axios thrown value into a real Error', async () => {
    mockPost.mockRejectedValue('boom');

    await expect(ordersService.createOrder(ORDER_DTO)).rejects.toThrow('boom');
  });
});

describe('ordersService.retryPayment', () => {
  it('returns a fresh payUrl', async () => {
    mockPost.mockResolvedValue(envelope({ payUrl: 'https://konnect.pay/retry' }));

    const result = await ordersService.retryPayment('order-1');

    expect(result.payUrl).toBe('https://konnect.pay/retry');
    expect(mockPost).toHaveBeenCalledWith('/orders/order-1/retry-payment', {}, expect.any(Object));
  });

  it('maps a backend failure to a readable Error', async () => {
    mockPost.mockRejectedValue(
      makeAxiosError({ data: { message: 'Order can no longer be paid' } }),
    );

    await expect(ordersService.retryPayment('order-1')).rejects.toThrow(
      'Order can no longer be paid',
    );
  });
});

describe('ordersService.confirmPickup', () => {
  it('preserves pickup error codes (PICKUP_ALREADY_DONE) for inline handling', async () => {
    mockPatch.mockRejectedValue(
      makeAxiosError({ data: { statusCode: 409, code: 'PICKUP_ALREADY_DONE', message: 'done' } }),
    );

    await expect(
      ordersService.confirmPickup('order-1', { pickupCode: '123456' }),
    ).rejects.toMatchObject({ code: 'PICKUP_ALREADY_DONE' });
  });
});
