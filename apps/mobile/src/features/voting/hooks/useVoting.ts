/**
 * Voting Hooks
 * TanStack Query hooks for the community voting feature.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useQueryWithFocus } from '@/lib/react-query';

import { votingService } from '../services/votingService';
import type { ActiveVotingResponse } from '../types/voting.types';

const VOTING_KEYS = {
  active: ['voting', 'active'] as const,
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: VOTING_KEYS.active });
    },
  });
}
