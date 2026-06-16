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

export function useClaimSmartphone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => prizeClaimService.claimSmartphone(),
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
