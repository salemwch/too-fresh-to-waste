/**
 * useCreateOrder — Unit Tests
 *
 * Covers the "intercept & retry" phone-verification flow, online vs cash
 * routing, and the user-facing error sanitisation that keeps raw backend text
 * off the screen.
 */

import { renderHook, act } from '@testing-library/react-native';

import { useCreateOrder } from '../useCreateOrder';

import type { CreateOrderDto } from '../../types/order.types';

const mockCreateOrder = jest.fn();

jest.mock('../../services/ordersService', () => ({
  ordersService: {
    createOrder: (dto: unknown) => mockCreateOrder(dto),
  },
}));

jest.mock('@/utils/logger', () => ({
  Logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn(), info: jest.fn() },
}));

const DTO: CreateOrderDto = {
  items: [{ offerId: 'offer-1', quantity: 1 }],
  establishmentId: 'est-1',
  pickupTimeSlot: { startTime: '14:00', endTime: '16:00' },
  pickupDate: new Date(Date.now() + 3600_000).toISOString(),
  paymentMethod: 'online',
} as CreateOrderDto;

beforeEach(() => mockCreateOrder.mockReset());

describe('useCreateOrder — success paths', () => {
  it('calls onSuccess and stores the order (online, with payUrl)', async () => {
    const order = {
      _id: 'o1',
      orderNumber: 'A1',
      payUrl: 'https://konnect.pay/x',
      pricing: { total: 12, currency: 'TND' },
    };
    mockCreateOrder.mockResolvedValue(order);
    const onSuccess = jest.fn();

    const { result } = renderHook(() => useCreateOrder({ onSuccess }));

    await act(async () => {
      await result.current.createOrder(DTO);
    });

    expect(onSuccess).toHaveBeenCalledWith(order);
    expect(result.current.order).toEqual(order);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('works for a cash order with no payUrl', async () => {
    const order = { _id: 'o2', orderNumber: 'A2', pricing: { total: 8, currency: 'TND' } };
    mockCreateOrder.mockResolvedValue(order);
    const onSuccess = jest.fn();

    const { result } = renderHook(() => useCreateOrder({ onSuccess }));
    await act(async () => {
      await result.current.createOrder({ ...DTO, paymentMethod: 'cash_on_pickup' });
    });

    expect(onSuccess).toHaveBeenCalledWith(order);
    expect(result.current.order).toEqual(order);
  });
});

describe('useCreateOrder — phone verification interception', () => {
  it('opens the modal with the backend flags and does NOT set an error or call onError', async () => {
    mockCreateOrder.mockRejectedValue({
      code: 'PHONE_VERIFICATION_REQUIRED',
      message: 'Phone verification required',
      requiresPhoneSetup: true,
      requiresPhoneVerification: false,
    });
    const onError = jest.fn();

    const { result } = renderHook(() => useCreateOrder({ onError }));

    let returned: unknown;
    await act(async () => {
      returned = await result.current.createOrder(DTO);
    });

    expect(returned).toBeNull();
    expect(result.current.error).toBeNull();
    expect(onError).not.toHaveBeenCalled();
    expect(result.current.phoneVerificationModal).toEqual({
      isVisible: true,
      requiresPhoneSetup: true,
      requiresPhoneVerification: false,
    });
  });

  it('retryOrderCreation re-submits the stored order data after verification', async () => {
    mockCreateOrder.mockRejectedValueOnce({
      code: 'PHONE_VERIFICATION_REQUIRED',
      requiresPhoneSetup: false,
      requiresPhoneVerification: true,
    });
    const successOrder = { _id: 'o3', orderNumber: 'A3', pricing: { total: 5, currency: 'TND' } };
    mockCreateOrder.mockResolvedValueOnce(successOrder);

    const { result } = renderHook(() => useCreateOrder());

    await act(async () => {
      await result.current.createOrder(DTO);
    });

    let retried: unknown;
    await act(async () => {
      retried = await result.current.retryOrderCreation();
    });

    expect(retried).toEqual(successOrder);
    expect(mockCreateOrder).toHaveBeenCalledTimes(2);
    expect(mockCreateOrder).toHaveBeenLastCalledWith(DTO);
    expect(result.current.phoneVerificationModal.isVisible).toBe(false);
  });

  it('retryOrderCreation returns null when there is no pending order', async () => {
    const { result } = renderHook(() => useCreateOrder());

    let retried: unknown = 'sentinel';
    await act(async () => {
      retried = await result.current.retryOrderCreation();
    });

    expect(retried).toBeNull();
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });
});

describe('useCreateOrder — error sanitisation (no raw backend text on screen)', () => {
  it('maps a known backend phrase to friendly copy and calls onError, then rethrows', async () => {
    mockCreateOrder.mockRejectedValue(new Error('insufficient stock'));
    const onError = jest.fn();

    const { result } = renderHook(() => useCreateOrder({ onError }));

    await act(async () => {
      await expect(result.current.createOrder(DTO)).rejects.toThrow('insufficient stock');
    });

    expect(result.current.error).toBe(
      'Sorry, this item is no longer available in the requested quantity.',
    );
    expect(onError).toHaveBeenCalled();
  });

  it('replaces technical error text (internal/exception/null) with a generic message', async () => {
    mockCreateOrder.mockRejectedValue(new Error('Internal server error: cannot read null'));

    const { result } = renderHook(() => useCreateOrder());
    await act(async () => {
      await expect(result.current.createOrder(DTO)).rejects.toBeInstanceOf(Error);
    });

    expect(result.current.error).toBe('Something went wrong. Please try again.');
  });
});
