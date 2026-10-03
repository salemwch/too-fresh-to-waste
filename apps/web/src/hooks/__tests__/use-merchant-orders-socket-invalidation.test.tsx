import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { WebSocketEvents } from '@foodwaste/shared';

import { useMerchantOrdersSocket } from '../use-merchant-orders-socket';
import { useAuthStore } from '@/lib/auth';

import type { ReactNode } from 'react';

/**
 * Task-17 B4 #8: an `order:status_updated` event moves money - the status
 * that just landed may be the one that creates, settles or reverses a
 * commission decision - so every figure derived from it (Dashboard earnings
 * summary/chart/KPIs, Payments stats/rows) must invalidate, not wait for the
 * merchant to refocus the tab. This drives the real handler the hook
 * registers with the socket, through a fake `socket.io-client`, and asserts
 * on the real `QueryClient` rather than a mocked one.
 */

jest.mock('sonner', () => ({ toast: { success: jest.fn() } }));

const handlers = new Map<string, (payload: unknown) => void>();
const fakeSocket = {
  on: jest.fn((event: string, cb: (payload: unknown) => void) => {
    handlers.set(event, cb);
  }),
  emit: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => fakeSocket),
}));

describe('useMerchantOrdersSocket - order:status_updated invalidation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    handlers.clear();
    jest.clearAllMocks();
    useAuthStore.setState({ isAuthenticated: true });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    jest.spyOn(queryClient, 'invalidateQueries');
  });

  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  it('invalidates sales summary/chart, order stats, business metrics and payment stats/rows', () => {
    renderHook(() => useMerchantOrdersSocket(), { wrapper });

    const onStatusUpdated = handlers.get(WebSocketEvents.ORDER_STATUS_UPDATED);
    expect(onStatusUpdated).toBeDefined();

    onStatusUpdated?.({
      data: { orderId: 'order-1', status: 'picked_up', previousStatus: 'ready_for_pickup' },
    });

    const invalidated = (queryClient.invalidateQueries as jest.Mock).mock.calls.map(
      call => call[0]?.queryKey,
    );

    expect(invalidated).toContainEqual(['merchant-dashboard', 'sales-summary']);
    expect(invalidated).toContainEqual(['merchant-dashboard', 'sales-chart']);
    expect(invalidated).toContainEqual(['merchant-dashboard', 'order-stats']);
    expect(invalidated).toContainEqual(['merchant-dashboard', 'business-metrics']);
    expect(invalidated).toContainEqual(['payments', 'stats']);
    expect(invalidated).toContainEqual(['payments', 'rows']);
  });

  it('ignores a malformed payload and invalidates nothing', () => {
    renderHook(() => useMerchantOrdersSocket(), { wrapper });

    const onStatusUpdated = handlers.get(WebSocketEvents.ORDER_STATUS_UPDATED);
    onStatusUpdated?.({ data: { orderId: 'order-1', status: 'not-a-real-status' } });

    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });
});
