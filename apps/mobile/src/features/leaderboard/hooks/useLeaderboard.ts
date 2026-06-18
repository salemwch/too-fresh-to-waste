import { useInfiniteQuery } from '@tanstack/react-query';

import { leaderboardService } from '../services/leaderboardService';

import type { LeaderboardResponse } from '../types/leaderboard.types';

const LEADERBOARD_QUERY_KEY = ['loyalty', 'leaderboard'] as const;

const PAGE_SIZE = 50;

export function useLeaderboard(limit = PAGE_SIZE) {
  return useInfiniteQuery<LeaderboardResponse, Error>({
    queryKey: [...LEADERBOARD_QUERY_KEY, limit],
    queryFn: ({ signal, pageParam }) =>
      leaderboardService.getLeaderboard(limit, (pageParam as number) ?? 0, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      const loaded = allPages.reduce((sum, p) => sum + p.entries.length, 0);
      return loaded < lastPage.total && lastPage.entries.length === limit ? loaded : undefined;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}
