/**
 * usePaymentPolling — Unit Tests
 *
 * Locks in the payment-polling lifecycle:
 *  - poll every 3s while PENDING_PAYMENT and the window is open (webhook detection)
 *  - stop once paymentExpiresAt passes (Bug E — no unbounded polling on a dead order)
 *  - refetch on app foreground (Bug C — returning from the Konnect browser)
 *  - never poll for non-pending orders
 */

import { renderHook, act } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { OrderStatus } from '../../types/order.types';
import { usePaymentPolling, PAYMENT_POLL_INTERVAL_MS } from '../usePaymentPolling';

import type { Order } from '../../types/order.types';

const makeOrder = (overrides: Partial<Order> = {}): Order =>
  ({
    _id: 'o1',
    status: OrderStatus.PENDING_PAYMENT,
    // window open by default
    paymentExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    ...overrides,
  }) as Order;

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('usePaymentPolling — interval', () => {
  it('polls every 3s while PENDING_PAYMENT and the window is open', () => {
    const refetch = jest.fn();
    renderHook(() => usePaymentPolling(makeOrder(), refetch));

    expect(refetch).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(PAYMENT_POLL_INTERVAL_MS));
    expect(refetch).toHaveBeenCalledTimes(1);

    act(() => jest.advanceTimersByTime(PAYMENT_POLL_INTERVAL_MS * 2));
    expect(refetch).toHaveBeenCalledTimes(3);
  });

  it('does NOT poll when the payment window has already expired (Bug E)', () => {
    const refetch = jest.fn();
    const { result } = renderHook(() =>
      usePaymentPolling(
        makeOrder({ paymentExpiresAt: new Date(Date.now() - 1000).toISOString() }),
        refetch,
      ),
    );

    act(() => jest.advanceTimersByTime(PAYMENT_POLL_INTERVAL_MS * 5));

    expect(refetch).not.toHaveBeenCalled();
    expect(result.current.isPaymentExpired).toBe(true);
    expect(result.current.isPendingPayment).toBe(true);
  });

  it('does NOT poll for a non-pending order', () => {
    const refetch = jest.fn();
    const { result } = renderHook(() =>
      usePaymentPolling(makeOrder({ status: OrderStatus.CONFIRMED }), refetch),
    );

    act(() => jest.advanceTimersByTime(PAYMENT_POLL_INTERVAL_MS * 5));

    expect(refetch).not.toHaveBeenCalled();
    expect(result.current.isPendingPayment).toBe(false);
  });

  it('stops polling once the order leaves PENDING_PAYMENT (rerender)', () => {
    const refetch = jest.fn();
    const { rerender } = renderHook(
      ({ order }: { order: Order }) => usePaymentPolling(order, refetch),
      { initialProps: { order: makeOrder() } },
    );

    act(() => jest.advanceTimersByTime(PAYMENT_POLL_INTERVAL_MS));
    expect(refetch).toHaveBeenCalledTimes(1);

    // Webhook landed → order now RESERVED → polling must stop
    rerender({ order: makeOrder({ status: OrderStatus.RESERVED }) });
    act(() => jest.advanceTimersByTime(PAYMENT_POLL_INTERVAL_MS * 5));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('treats a missing paymentExpiresAt as an open window (keeps polling)', () => {
    const refetch = jest.fn();
    const order = makeOrder();
    delete (order as { paymentExpiresAt?: string }).paymentExpiresAt;
    renderHook(() => usePaymentPolling(order, refetch));

    act(() => jest.advanceTimersByTime(PAYMENT_POLL_INTERVAL_MS));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('usePaymentPolling — app foreground (Bug C)', () => {
  it('refetches when the app returns to the foreground while pending', () => {
    const listeners: Array<(s: string) => void> = [];
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, cb) => {
      listeners.push(cb as (s: string) => void);
      return { remove } as unknown as ReturnType<typeof AppState.addEventListener>;
    });

    const refetch = jest.fn();
    renderHook(() => usePaymentPolling(makeOrder(), refetch));

    act(() => listeners.forEach(l => l('active')));
    expect(refetch).toHaveBeenCalledTimes(1);

    // background transitions must not refetch
    act(() => listeners.forEach(l => l('background')));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe to AppState for a non-pending order', () => {
    const addSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as unknown as ReturnType<
        typeof AppState.addEventListener
      >);

    const refetch = jest.fn();
    renderHook(() => usePaymentPolling(makeOrder({ status: OrderStatus.COMPLETED }), refetch));

    expect(addSpy).not.toHaveBeenCalled();
  });

  it('removes the AppState subscription on unmount', () => {
    const remove = jest.fn();
    jest
      .spyOn(AppState, 'addEventListener')
      .mockReturnValue({ remove } as unknown as ReturnType<typeof AppState.addEventListener>);

    const { unmount } = renderHook(() => usePaymentPolling(makeOrder(), jest.fn()));
    unmount();

    expect(remove).toHaveBeenCalled();
  });
});
