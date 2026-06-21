/**
 * Voting Hooks
 * TanStack Query hooks for the community voting feature.
 *
 * Exports:
 *   useActiveVotingCycle()     — active cycle + eligibility + myVote, focus-refetch, staleTime 60s
 *   useVoteMutation()          — cast a vote, invalidates active cycle on success
 *   useVotingResults(cycleId?) — live results with 60s polling when enabled
 *   useVotingHistory()         — past cycle history
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useQueryWithFocus } from '@/lib/react-query';

import { votingService } from '../services/votingService';
import type {
  ActiveVotingResponse,
  VotingResultsResponse,
  VotingHistoryItem,
} from '../types/voting.types';

const VOTING_KEYS = {
  active: ['voting', 'active'] as const,
  results: (cycleId?: string) => ['voting', 'results', cycleId] as const,
  history: ['voting', 'history'] as const,
} as const;

/**
 * Fetches the active voting cycle, user eligibility, and the user's existing vote.
 * Auto-refetches on screen focus; stale after 60 seconds.
 */
export function useActiveVotingCycle() {
  const { data, isLoading, error, refetch, isRefetching } = useQueryWithFocus<ActiveVotingResponse>(
    VOTING_KEYS.active,
    () => votingService.getActiveCycle(),
    { staleTime: 60_000 },
  );

  return {
    cycle: data?.cycle ?? null,
    eligibility: data?.eligibility ?? null,
    myVote: data?.myVote ?? null,
    isLoading,
    error,
    refetch,
    isRefetching,
  };
}

/**
 * Mutation to cast a vote for a prize in the active cycle.
 * Invalidates the active cycle query on success so eligibility and myVote refresh.
 */
export function useVoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (prizeId: string) => votingService.castVote(prizeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: VOTING_KEYS.active });
    },
  });
}

/**
 * Fetches voting results for the active cycle (or a specific cycle by id).
 * Polls every 60 seconds when `enabled` is true.
 */
export function useVotingResults(cycleId?: string, enabled = false) {
  return useQuery<VotingResultsResponse>({
    queryKey: VOTING_KEYS.results(cycleId),
    queryFn: () => votingService.getResults(cycleId),
    enabled,
    refetchInterval: enabled ? 60_000 : false,
  });
}

/**
 * Fetches the user's voting history across all past cycles.
 */
export function useVotingHistory() {
  return useQuery<VotingHistoryItem[]>({
    queryKey: VOTING_KEYS.history,
    queryFn: ({ signal }) => votingService.getHistory(signal),
  });
}
