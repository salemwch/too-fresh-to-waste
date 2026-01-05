/**
 * TanStack Query DevTools Configuration
 * React Native DevTools integration
 *
 * Note: TanStack Query DevTools are primarily for web.
 * For React Native, we integrate with Reactotron for debugging.
 *
 * Features:
 * - Query inspection via Reactotron
 * - Query logging
 * - Cache visualization
 * - Development-only code
 */

import { Logger } from '@/utils/logger';

import { queryClient } from './queryClient';

/**
 * DevTools Configuration
 */
const DEV_TOOLS_CONFIG = {
  enabled: __DEV__, // Only enable in development
  logQueries: __DEV__,
  logMutations: __DEV__,
  logCache: false, // Set to true for verbose cache logging
};

/**
 * Initialize Query DevTools
 * Integrates with Reactotron for React Native debugging
 */
export const initializeQueryDevTools = () => {
  if (!DEV_TOOLS_CONFIG.enabled) {
    return;
  }

  Logger.info('Initializing TanStack Query DevTools');

  // Log query client state
  if (DEV_TOOLS_CONFIG.logQueries) {
    setupQueryLogging();
  }

  // Log mutation state
  if (DEV_TOOLS_CONFIG.logMutations) {
    setupMutationLogging();
  }

  Logger.info('Query DevTools initialized');
};

/**
 * Setup Query Logging
 * Logs query events for debugging
 */
const setupQueryLogging = () => {
  const queryCache = queryClient.getQueryCache();

  // Subscribe to query cache events
  queryCache.subscribe(event => {
    if (event?.type === 'added') {
      Logger.debug('Query added', {
        queryKey: event.query.queryKey,
        queryHash: event.query.queryHash,
      });
    }

    if (event?.type === 'removed') {
      Logger.debug('Query removed', {
        queryKey: event.query.queryKey,
      });
    }

    if (event?.type === 'updated') {
      const query = event.query;
      const state = query.state;
      Logger.debug('Query updated', {
        queryKey: query.queryKey,
        status: state.status,
        dataUpdatedAt: state.dataUpdatedAt,
        errorUpdatedAt: state.errorUpdatedAt,
        fetchStatus: state.fetchStatus,
      });
    }
  });
};

/**
 * Setup Mutation Logging
 * Logs mutation events for debugging
 */
const setupMutationLogging = () => {
  const mutationCache = queryClient.getMutationCache();

  // Subscribe to mutation cache events
  mutationCache.subscribe(event => {
    if (event?.type === 'added') {
      Logger.debug('Mutation added', {
        mutationKey: event.mutation.options.mutationKey,
      });
    }

    if (event?.type === 'removed') {
      Logger.debug('Mutation removed', {
        mutationKey: event.mutation.options.mutationKey,
      });
    }

    if (event?.type === 'updated') {
      const mutation = event.mutation;
      const state = mutation.state;
      Logger.debug('Mutation updated', {
        mutationKey: mutation.options.mutationKey,
        status: state.status,
        submittedAt: state.submittedAt,
      });
    }
  });
};

/**
 * Get Query Cache Stats
 * Utility function to inspect cache state
 */
export const getQueryCacheStats = () => {
  const queryCache = queryClient.getQueryCache();
  const queries = queryCache.getAll();

  const stats = {
    totalQueries: queries.length,
    activeQueries: queries.filter(q => q.getObserversCount() > 0).length,
    inactiveQueries: queries.filter(q => q.getObserversCount() === 0).length,
    staleQueries: queries.filter(q => q.isStale()).length,
    fetchingQueries: queries.filter(q => q.state.fetchStatus === 'fetching').length,
  };

  Logger.info('Query Cache Stats', stats);
  return stats;
};

/**
 * Get Mutation Cache Stats
 * Utility function to inspect mutation state
 */
export const getMutationCacheStats = () => {
  const mutationCache = queryClient.getMutationCache();
  const mutations = mutationCache.getAll();

  const stats = {
    totalMutations: mutations.length,
    pendingMutations: mutations.filter(m => m.state.status === 'pending').length,
    successMutations: mutations.filter(m => m.state.status === 'success').length,
    errorMutations: mutations.filter(m => m.state.status === 'error').length,
  };

  Logger.info('Mutation Cache Stats', stats);
  return stats;
};

/**
 * Clear All Queries
 * Utility function to clear query cache
 */
export const clearAllQueries = () => {
  queryClient.clear();
  Logger.info('All queries cleared');
};

/**
 * Invalidate All Queries
 * Utility function to invalidate all queries
 */
export const invalidateAllQueries = async () => {
  await queryClient.invalidateQueries();
  Logger.info('All queries invalidated');
};

/**
 * Debug Utilities
 * Export for use in development/debugging
 */
export const queryDebugUtils = {
  getCacheStats: getQueryCacheStats,
  getMutationStats: getMutationCacheStats,
  clearQueries: clearAllQueries,
  invalidateQueries: invalidateAllQueries,
  client: queryClient,
};

/**
 * DevTools Summary:
 *
 * React Native DevTools Options:
 * 1. Reactotron Plugin (recommended, already installed)
 *    - Install: @tanstack/react-query-reactotron (optional third-party)
 *    - Provides visual query inspection
 *
 * 2. Built-in Logging (this file)
 *    - Query event logging
 *    - Mutation event logging
 *    - Cache statistics
 *
 * 3. Flipper Plugin (alternative)
 *    - Install: react-query-native-devtools
 *    - Requires Flipper setup
 *
 * Current Setup:
 * - Built-in logging via Logger
 * - Debug utilities for cache inspection
 * - Development-only code
 *
 * Usage in Development:
 * ```tsx
 * import { queryDebugUtils } from '@/lib/react-query/devtools';
 *
 * // Check cache stats
 * queryDebugUtils.getCacheStats();
 *
 * // Clear all queries
 * queryDebugUtils.clearQueries();
 *
 * // Invalidate all queries
 * await queryDebugUtils.invalidateQueries();
 * ```
 *
 * Reactotron Integration:
 * Add to your Reactotron config (optional):
 * ```tsx
 * import { createReactQueryMonitor } from '@tanstack/react-query-reactotron';
 *
 * Reactotron.use(createReactQueryMonitor());
 * ```
 */
