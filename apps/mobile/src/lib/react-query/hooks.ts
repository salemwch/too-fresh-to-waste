/**
 * TanStack Query Custom Hooks
 * Reusable hooks for common query patterns
 *
 * Features:
 * - Screen focus refetch hook
 * - Network-aware queries
 * - Optimistic updates helper
 * - Pagination helper
 * - Infinite scroll helper
 */

import { useFocusEffect } from '@react-navigation/native';
import { useQuery, type UseQueryOptions, type QueryKey } from '@tanstack/react-query';
import { useCallback } from 'react';

import { Logger } from '@/utils/logger';

/**
 * Use Query with Screen Focus Refetch
 * Automatically refetches when screen gains focus
 *
 * @param queryKey - Query key
 * @param queryFn - Query function
 * @param options - Query options
 * @param refetchOnFocus - Whether to refetch on screen focus (default: true)
 */
export function useQueryWithFocus<TQueryFnData = unknown, TError = unknown, TData = TQueryFnData>(
  queryKey: QueryKey,
  queryFn: () => Promise<TQueryFnData>,
  options?: Omit<UseQueryOptions<TQueryFnData, TError, TData>, 'queryKey' | 'queryFn'>,
  refetchOnFocus = true,
) {
  const query = useQuery<TQueryFnData, TError, TData>({
    queryKey,
    queryFn,
    ...options,
  });
  const { isStale, refetch: refetchQuery } = query;

  // Refetch when screen gains focus
  useFocusEffect(
    useCallback(() => {
      if (refetchOnFocus && isStale) {
        Logger.debug('Screen focused, refetching query', { queryKey });
        void refetchQuery();
      }
    }, [refetchOnFocus, isStale, queryKey, refetchQuery]),
  );

  return query;
}
