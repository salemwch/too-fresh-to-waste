import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { prizeClaimService } from '../services/prizeClaimService';

const PRIZE_CLAIM_KEY = ['prizeClaim', 'status'] as const;

export function usePrizeClaimStatus(enabled = true) {
  return useQuery({
    queryKey: PRIZE_CLAIM_KEY,
    queryFn: ({ signal }) => prizeClaimService.getClaimStatus(signal),
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

/**
 * Claims the grand prize the community voted for.
 *
 * Named for the prize tier, not the item: what the top ranks win is whatever
 * won the vote — a phone, a scooter, a hotel stay — so nothing here should
 * assume a phone.
 */
export function useClaimGrandPrize() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => prizeClaimService.claimGrandPrize(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRIZE_CLAIM_KEY });
    },
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
