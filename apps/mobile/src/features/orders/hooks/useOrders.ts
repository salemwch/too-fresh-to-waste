/**
 * useOrders Hook
 * Fetches the authenticated consumer's orders with screen-focus refetch.
 *
 * Data flow:
 *   useQueryWithFocus → ordersService.getMyOrders → { data: Order[], meta }
 *   Client-side filter into active / history via isActiveOrder / isHistoryOrder
 */

import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';

import { useQueryWithFocus } from '@/lib/react-query';

import { ordersService } from '../services/ordersService';
import { isActiveOrder, isHistoryOrder } from '../types/order.types';

import type { Order, PaginatedOrdersResponse } from '../types/order.types';

/** Query key factory — single source of truth */
const ORDERS_QUERY_KEY = ['orders', 'my-orders'] as const;

/** Order detail query key — kept in sync with OrderDetailsScreen */
export const orderDetailQueryKey = (orderId: string) => ['orders', 'detail', orderId] as const;

export function useOrders() {
  const queryClient = useQueryClient();

  const {
    data: response,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQueryWithFocus<PaginatedOrdersResponse, Error>(
    ORDERS_QUERY_KEY,
    () => ordersService.getMyOrders(1, 50),
    {
      staleTime: 1000 * 60 * 2, // 2 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
    },
  );

  const orders = useMemo<Order[]>(() => response?.data ?? [], [response?.data]);

  const activeOrders = useMemo(() => orders.filter(isActiveOrder), [orders]);

  const historyOrders = useMemo(() => orders.filter(isHistoryOrder), [orders]);

  /** Pull-to-refresh handler */
  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  /** Invalidate orders cache (e.g. after creating a new order) */
  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
  }, [queryClient]);

  return {
    orders,
    activeOrders,
    historyOrders,
    isLoading,
    isRefetching,
    error,
    refetch: handleRefresh,
    invalidate,
    totalCount: response?.meta?.total ?? orders.length,
  };
}

/**
 * Returns a stable callback that prefetches an order into the TanStack cache.
 * Call on tap (before navigation.navigate) so data is ready when the screen mounts.
 */
export function usePrefetchOrder() {
  const queryClient = useQueryClient();
  return useCallback(
    (orderId: string) => {
      void queryClient.prefetchQuery({
        queryKey: orderDetailQueryKey(orderId),
        queryFn: () => ordersService.getOrderById(orderId),
        staleTime: 1000 * 60 * 2,
      });
    },
    [queryClient],
  );
}
