/**
 * useMonthlyBagGoal Hook
 * Fetches community bag goal stats via TanStack Query and subscribes
 * to real-time WebSocket updates for instant UI refreshes.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { Freshness } from '@/lib/react-query/freshness';
import { socketService } from '@/services/socketService';

import { monthlyBagGoalApi } from '../services/monthlyBagGoalApi';

import type { MonthlyBagGoalStats } from '@foodwaste/shared';
import type { UseQueryResult } from '@tanstack/react-query';

const MONTHLY_BAG_GOAL_QUERY_KEY = ['communityGoal', 'stats'] as const;

const MONTHLY_BAG_GOAL_QUERY_CONFIG = {
  staleTime: Freshness.LIVE,
  gcTime: 5 * 60 * 1000, // 5 min garbage collection
  retry: 2,
} as const;

export const useMonthlyBagGoal = (): UseQueryResult<MonthlyBagGoalStats, Error> => {
  const queryClient = useQueryClient();

  // Listen for WebSocket updates and patch query cache directly (no refetch)
  useEffect(() => {
    const handleUpdate = (payload: { data?: MonthlyBagGoalStats } | MonthlyBagGoalStats) => {
      // Backend wraps via wrapEventPayload: { event, data, timestamp }
      const stats =
        'data' in payload && payload.data != null ? payload.data : (payload as MonthlyBagGoalStats);

      if (stats.currentCount != null && stats.targetCount != null) {
        queryClient.setQueryData<MonthlyBagGoalStats>(MONTHLY_BAG_GOAL_QUERY_KEY, stats);
      }
    };

    socketService.on<{ data?: MonthlyBagGoalStats } | MonthlyBagGoalStats>(
      'community:bag_updated',
      handleUpdate,
    );

    return () => {
      socketService.off('community:bag_updated', handleUpdate as (...args: unknown[]) => void);
    };
  }, [queryClient]);

  return useQuery<MonthlyBagGoalStats, Error>({
    queryKey: MONTHLY_BAG_GOAL_QUERY_KEY,
    queryFn: ({ signal }) => monthlyBagGoalApi.getStats(signal),
    ...MONTHLY_BAG_GOAL_QUERY_CONFIG,
    refetchOnWindowFocus: false,
  });
};

/** Exported query key for invalidation from HomeScreen refresh */
export { MONTHLY_BAG_GOAL_QUERY_KEY };
