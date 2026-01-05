/**
 * TanStack Query Client Configuration
 * Mobile-optimized settings for React Native
 *
 * Features:
 * - Longer cache times for mobile
 * - Network-aware retries
 * - Stale-while-revalidate strategy
 * - Error handling and logging
 * - TypeScript type safety
 */

import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';

import { ErrorHandler } from '@/utils/errorHandler';
import { Logger } from '@/utils/logger';

/**
 * Mobile-optimized default options
 * Longer cache times and retry logic optimized for mobile networks
 */
const DEFAULT_QUERY_OPTIONS = {
  queries: {
    // Cache Configuration
    gcTime: 1000 * 60 * 60 * 24, // 24 hours (formerly cacheTime)
    staleTime: 1000 * 60 * 5, // 5 minutes - data considered fresh for 5 min

    // Retry Configuration (network-aware)
    retry: (failureCount: number, error: any) => {
      // Don't retry on 4xx errors (client errors)
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false;
      }

      // Retry up to 3 times for network errors and 5xx errors
      return failureCount < 3;
    },
    retryDelay: (attemptIndex: number) =>
      // Exponential backoff: 1s, 2s, 4s
      Math.min(1000 * 2 ** attemptIndex, 30000),
    // Refetch Configuration
    refetchOnWindowFocus: true, // Refetch on app focus
    refetchOnReconnect: true, // Refetch when network reconnects
    refetchOnMount: true, // Refetch on component mount

    // Network Mode
    networkMode: 'online' as const, // Only fetch when online

    // Structural Sharing (performance optimization)
    structuralSharing: true,

    // Disable automatic refetching intervals by default
    // Omitted as default is already false
    refetchIntervalInBackground: false,
  },

  mutations: {
    // Retry Configuration for mutations
    retry: 1, // Only retry once for mutations
    retryDelay: 1000,

    // Network Mode
    networkMode: 'online' as const,
  },
};

/**
 * Query Cache
 * Centralized cache with error handling and logging
 */
const queryCache = new QueryCache({
  onError: (error, query) => {
    Logger.error(
      'Query error',
      {
        queryKey: query.queryKey,
        queryHash: query.queryHash,
      },
      error,
    );

    // Handle specific error types
    ErrorHandler.handle(error, {
      context: 'TanStack Query',
      queryKey: query.queryKey,
    });
  },

  onSuccess: (data, query) => {
    Logger.debug('Query success', {
      queryKey: query.queryKey,
      dataType: typeof data,
    });
  },

  onSettled: (data, error, query) => {
    Logger.debug('Query settled', {
      queryKey: query.queryKey,
      hasError: !!error,
      hasData: !!data,
    });
  },
});

/**
 * Mutation Cache
 * Centralized mutation cache with error handling and logging
 */
const mutationCache = new MutationCache({
  onError: (error, _variables, _context, mutation) => {
    Logger.error(
      'Mutation error',
      {
        mutationKey: mutation.options.mutationKey,
      },
      error,
    );

    // Handle mutation errors
    ErrorHandler.handle(error, {
      context: 'TanStack Mutation',
      mutationKey: mutation.options.mutationKey,
    });
  },

  onSuccess: (_data, _variables, _context, mutation) => {
    Logger.info('Mutation success', {
      mutationKey: mutation.options.mutationKey,
    });
  },

  onSettled: (data, error, _variables, _context, mutation) => {
    Logger.debug('Mutation settled', {
      mutationKey: mutation.options.mutationKey,
      hasError: !!error,
      hasData: !!data,
    });
  },
});

/**
 * Create Query Client with mobile-optimized settings
 */
export const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: DEFAULT_QUERY_OPTIONS,
});

/**
 * Query Client Configuration Summary:
 *
 * Cache Strategy:
 * - 24-hour garbage collection time (gcTime)
 * - 5-minute stale time (data fresh for 5 min)
 * - Structural sharing enabled for performance
 *
 * Retry Strategy:
 * - Automatic retry for 5xx errors and network errors
 * - No retry for 4xx client errors
 * - Exponential backoff (1s, 2s, 4s)
 * - Max 3 retries for queries, 1 for mutations
 *
 * Refetch Strategy:
 * - Refetch on app focus (when user returns to app)
 * - Refetch on network reconnection
 * - Refetch on component mount
 *
 * Network Mode:
 * - Only fetch when online
 * - Prevents unnecessary requests when offline
 *
 * Error Handling:
 * - Centralized error logging
 * - Error tracking with context
 * - Integration with app error handler
 */
