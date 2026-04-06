/**
 * useCommunityBagGoal Hook
 * Fetches community bag goal stats via TanStack Query and subscribes
 * to real-time WebSocket updates for instant UI refreshes.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { socketService } from '@/services/socketService';

import { communityGoalApi } from '../services/communityGoalApi';

import type { CommunityBagGoalStats } from '@foodwaste/shared';
import type { UseQueryResult } from '@tanstack/react-query';

const COMMUNITY_GOAL_QUERY_KEY = ['communityGoal', 'stats'] as const;

const COMMUNITY_GOAL_QUERY_CONFIG = {
  staleTime: 30 * 1000, // 30s — more aggressive than donations since it updates in real-time
  gcTime: 5 * 60 * 1000, // 5 min garbage collection
  retry: 2,
} as const;

export const useCommunityBagGoal = (): UseQueryResult<CommunityBagGoalStats, Error> => {
  const queryClient = useQueryClient();

  // Listen for WebSocket updates and patch query cache directly (no refetch)
  useEffect(() => {
    const handleUpdate = (payload: { data?: CommunityBagGoalStats } | CommunityBagGoalStats) => {
      // Backend wraps via wrapEventPayload: { event, data, timestamp }
      const stats =
        'data' in payload && payload.data != null
          ? payload.data
          : (payload as CommunityBagGoalStats);

      if (stats.currentCount != null && stats.targetCount != null) {
        queryClient.setQueryData<CommunityBagGoalStats>(COMMUNITY_GOAL_QUERY_KEY, stats);
      }
    };

    socketService.on<{ data?: CommunityBagGoalStats } | CommunityBagGoalStats>(
      'community:bag_updated',
      handleUpdate,
    );

    return () => {
      socketService.off('community:bag_updated', handleUpdate as (...args: unknown[]) => void);
    };
  }, [queryClient]);

  return useQuery<CommunityBagGoalStats, Error>({
    queryKey: COMMUNITY_GOAL_QUERY_KEY,
    queryFn: ({ signal }) => communityGoalApi.getStats(signal),
    ...COMMUNITY_GOAL_QUERY_CONFIG,
    refetchOnWindowFocus: false,
  });
};

/** Exported query key for invalidation from HomeScreen refresh */
export { COMMUNITY_GOAL_QUERY_KEY };
