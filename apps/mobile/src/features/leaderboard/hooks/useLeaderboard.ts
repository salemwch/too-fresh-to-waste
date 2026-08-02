import { useInfiniteQuery } from '@tanstack/react-query';

import { Freshness } from '@/lib/react-query/freshness';

import { leaderboardService } from '../services/leaderboardService';

import type { LeaderboardResponse } from '../types/leaderboard.types';

const LEADERBOARD_QUERY_KEY = ['loyalty', 'leaderboard'] as const;

/**
 * Rows per request.
 *
 * Small on purpose. Roughly eight rows fit on screen, so a 50-row page fetched
 * and rendered five screens of data nobody had scrolled to yet — and most users
 * never leave the podium. Ten keeps the first paint cheap and lets scrolling pay
 * for itself.
 *
 * Users outside the loaded window do not page through to find themselves: the
 * position bar shows their rank, and "nearby ranks" fetches just their
 * neighbours. See useUserRowTracking.
 */
const PAGE_SIZE = 10;

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
    staleTime: Freshness.SHORT,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}
