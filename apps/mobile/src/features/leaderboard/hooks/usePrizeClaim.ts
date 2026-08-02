import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Freshness } from '@/lib/react-query/freshness';

import { prizeClaimService } from '../services/prizeClaimService';

/*
 * There is no grand-prize mutation here any more. One endpoint awards it —
 * POST /voting/claim-prize, via useClaimVotingPrize — so the leaderboard and
 * the voting card cannot write two different records for the same season.
 */

const PRIZE_CLAIM_KEY = ['prizeClaim', 'status'] as const;

export function usePrizeClaimStatus(enabled = true) {
  return useQuery({
    queryKey: PRIZE_CLAIM_KEY,
    queryFn: ({ signal }) => prizeClaimService.getClaimStatus(signal),
    enabled,
    staleTime: Freshness.SHORT,
    gcTime: 5 * 60_000,
  });
}

export function useClaimDiscount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (establishmentId: string) => prizeClaimService.claimDiscount(establishmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRIZE_CLAIM_KEY });
    },
  });
}
