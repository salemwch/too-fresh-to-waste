/**
 * useOrders Hook
 * Fetches the authenticated consumer's orders with cursor-based infinite scroll.
 *
 * Data flow:
 *   useInfiniteQuery → ordersService.getMyOrdersCursor → { data: Order[], meta }
 *   Client-side filter into active / history via isActiveOrder / isHistoryOrder
 */

import { useFocusEffect } from '@react-navigation/native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';

import { Logger } from '@/utils/logger';

import { ordersService } from '../services/ordersService';
import { isActiveOrder, isHistoryOrder } from '../types/order.types';

import type { Order, CursorPaginatedOrdersResponse } from '../types/order.types';

/** Query key factory — single source of truth */
const ORDERS_QUERY_KEY = ['orders', 'my-orders'] as const;

/** Order detail query key — kept in sync with OrderDetailsScreen */
const orderDetailQueryKey = (orderId: string) => ['orders', 'detail', orderId] as const;

const PAGE_SIZE = 20;

export function useOrders() {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isRefetching,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<CursorPaginatedOrdersResponse, Error>({
    queryKey: ORDERS_QUERY_KEY,
    queryFn: ({ pageParam }) =>
      ordersService.getMyOrdersCursor(PAGE_SIZE, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => lastPage.meta.nextCursor ?? undefined,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
  });

  // Refetch first page on screen focus (same behavior as previous useQueryWithFocus)
  useFocusEffect(
    useCallback(() => {
      if (data && data.pages.length > 0) {
        Logger.debug('Screen focused, refetching orders', { queryKey: ORDERS_QUERY_KEY });
        void refetch();
      }
    }, [data, refetch]),
  );

  const orders = useMemo<Order[]>(() => data?.pages.flatMap(page => page.data) ?? [], [data]);

  const activeOrders = useMemo(() => orders.filter(isActiveOrder), [orders]);

  const historyOrders = useMemo(() => orders.filter(isHistoryOrder), [orders]);

  /** Pull-to-refresh handler */
  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  /** Load more handler for infinite scroll */
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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
    loadMore: handleLoadMore,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    invalidate,
    totalCount: orders.length,
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
