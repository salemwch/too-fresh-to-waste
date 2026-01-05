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
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
  type QueryKey,
} from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';

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

  // Refetch when screen gains focus
  useFocusEffect(
    useCallback(() => {
      if (refetchOnFocus && query.isStale) {
        Logger.debug('Screen focused, refetching query', { queryKey });
        query.refetch();
      }
    }, [refetchOnFocus, query.isStale, queryKey]),
  );

  return query;
}

/**
 * Use Mutation with Optimistic Updates
 * Helper for mutations with automatic optimistic updates
 *
 * @param mutationFn - Mutation function
 * @param options - Mutation options with optimistic update config
 */
export function useMutationWithOptimistic<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown,
>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, TError, TVariables, TContext> & {
    // Optimistic update configuration
    optimistic?: {
      queryKey: QueryKey;
      updater: (oldData: any, variables: TVariables) => any;
    };
  },
) {
  const queryClient = useQueryClient();

  return useMutation<TData, TError, TVariables, TContext>({
    mutationFn,
    ...options,

    // Optimistic update
    onMutate: async (variables, context) => {
      if (options?.optimistic) {
        const { queryKey, updater } = options.optimistic;

        // Cancel any outgoing refetches
        await queryClient.cancelQueries({ queryKey });

        // Snapshot the previous value
        const previousData = queryClient.getQueryData(queryKey);

        // Optimistically update to the new value
        queryClient.setQueryData(queryKey, (old: any) => updater(old, variables));

        Logger.debug('Optimistic update applied', { queryKey });

        // Return context with previous data for rollback
        const onMutateResult = await options?.onMutate?.(variables, context);
        return { previousData, ...onMutateResult } as any;
      }

      return await options?.onMutate?.(variables, context);
    },

    // Rollback on error
    onError: (error, variables, onMutateResult: any, context: any) => {
      if (options?.optimistic && onMutateResult?.previousData) {
        queryClient.setQueryData(options.optimistic.queryKey, onMutateResult.previousData);
        Logger.warn('Optimistic update rolled back', {
          queryKey: options.optimistic.queryKey,
        });
      }

      if (options?.onError) {
        options.onError(error, variables, onMutateResult, context);
      }
    },

    // Refetch on success or error
    onSettled: (data, error, variables, onMutateResult, context) => {
      if (options?.optimistic) {
        queryClient.invalidateQueries({ queryKey: options.optimistic.queryKey });
      }

      if (options?.onSettled) {
        options.onSettled(data, error, variables, onMutateResult, context);
      }
    },
  });
}

/**
 * Use Network-Aware Query
 * Query that adapts based on network conditions
 *
 * @param queryKey - Query key
 * @param queryFn - Query function
 * @param options - Query options
 */
export function useNetworkAwareQuery<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
>(
  queryKey: QueryKey,
  queryFn: () => Promise<TQueryFnData>,
  options?: Omit<UseQueryOptions<TQueryFnData, TError, TData>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<TQueryFnData, TError, TData>({
    queryKey,
    queryFn,
    ...options,

    // Network-aware settings
    networkMode: 'online', // Only fetch when online
    refetchOnReconnect: true, // Refetch when network reconnects

    // Longer stale time for mobile
    staleTime: options?.staleTime ?? 1000 * 60 * 5, // 5 minutes

    // Keep data in cache longer on mobile
    gcTime: options?.gcTime ?? 1000 * 60 * 60 * 24, // 24 hours
  });
}

/**
 * Use Invalidate Queries
 * Helper hook to invalidate queries with type safety
 */
export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  return useCallback(
    async (queryKey: QueryKey) => {
      await queryClient.invalidateQueries({ queryKey });
      Logger.debug('Queries invalidated', { queryKey });
    },
    [queryClient],
  );
}

/**
 * Use Prefetch Query
 * Helper hook to prefetch queries
 */
export function usePrefetchQuery() {
  const queryClient = useQueryClient();

  return useCallback(
    async <TQueryFnData = unknown>(
      queryKey: QueryKey,
      queryFn: () => Promise<TQueryFnData>,
      options?: { staleTime?: number },
    ) => {
      // Conditional spreading for exactOptionalPropertyTypes compliance
      await queryClient.prefetchQuery({
        queryKey,
        queryFn,
        ...(options?.staleTime !== undefined && { staleTime: options.staleTime }),
      });
      Logger.debug('Query prefetched', { queryKey });
    },
    [queryClient],
  );
}

/**
 * Use Query Subscription
 * Lightweight query subscription without triggering rerenders
 * Useful for background sync or cache warming
 */
export function useQuerySubscription<TData = unknown>(
  queryKey: QueryKey,
  queryFn: () => Promise<TData>,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
    onData?: (data: TData) => void;
    onError?: (error: unknown) => void;
  },
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!options?.enabled) return;

    const unsubscribe = queryClient.getQueryCache().subscribe(event => {
      if (
        event?.type === 'updated' &&
        event.query.queryKey === queryKey &&
        event.query.state.data
      ) {
        options?.onData?.(event.query.state.data as TData);
      }

      if (
        event?.type === 'updated' &&
        event.query.queryKey === queryKey &&
        event.query.state.error
      ) {
        options?.onError?.(event.query.state.error);
      }
    });

    // Initial fetch
    queryClient.prefetchQuery({ queryKey, queryFn });

    // Setup interval if specified
    let intervalId: NodeJS.Timeout | undefined;
    if (options?.refetchInterval) {
      intervalId = setInterval(() => {
        queryClient.refetchQueries({ queryKey });
      }, options.refetchInterval);
    }

    return () => {
      unsubscribe();
      if (intervalId) clearInterval(intervalId);
    };
  }, [queryKey, queryFn, queryClient, options?.enabled, options?.refetchInterval]);
}

/**
 * Custom Hooks Summary:
 *
 * useQueryWithFocus:
 * - Automatically refetches when screen gains focus
 * - Perfect for React Navigation screens
 * - Keeps data fresh when user navigates back
 *
 * useMutationWithOptimistic:
 * - Automatic optimistic updates
 * - Automatic rollback on error
 * - Simplified optimistic update pattern
 *
 * useNetworkAwareQuery:
 * - Mobile-optimized cache times
 * - Only fetches when online
 * - Automatic refetch on reconnect
 *
 * useInvalidateQueries:
 * - Type-safe query invalidation
 * - Logging support
 *
 * usePrefetchQuery:
 * - Type-safe query prefetching
 * - Useful for anticipating user navigation
 *
 * useQuerySubscription:
 * - Lightweight background sync
 * - No component rerenders
 * - Perfect for cache warming
 *
 * Usage Examples:
 *
 * ```tsx
 * // Screen focus refetch
 * const { data } = useQueryWithFocus(
 *   ['offers'],
 *   fetchOffers
 * );
 *
 * // Optimistic updates
 * const mutation = useMutationWithOptimistic(
 *   updateOffer,
 *   {
 *     optimistic: {
 *       queryKey: ['offers'],
 *       updater: (old, variables) => ({
 *         ...old,
 *         ...variables,
 *       }),
 *     },
 *   }
 * );
 *
 * // Network-aware query
 * const { data } = useNetworkAwareQuery(
 *   ['offers'],
 *   fetchOffers
 * );
 * ```
 */
