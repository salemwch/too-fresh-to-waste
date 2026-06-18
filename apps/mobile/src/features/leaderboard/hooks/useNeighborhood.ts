import { useQuery } from '@tanstack/react-query';

import { leaderboardService } from '../services/leaderboardService';

import type { LeaderboardNeighborhoodResponse } from '../types/leaderboard.types';

const NEIGHBORHOOD_QUERY_KEY = ['loyalty', 'leaderboard', 'neighborhood'] as const;

export function useNeighborhood(enabled: boolean) {
  return useQuery<LeaderboardNeighborhoodResponse, Error>({
    queryKey: NEIGHBORHOOD_QUERY_KEY,
    queryFn: ({ signal }) => leaderboardService.getNeighborhood(signal),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
}
