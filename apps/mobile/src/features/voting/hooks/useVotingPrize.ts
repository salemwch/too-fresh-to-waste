/**
 * Voting Prize Hooks
 * TanStack Query hooks for the voting prize feature.
 *
 * Exports:
 *   useVotingPrizeStatus   — query: GET /voting/my-prize
 *   useClaimVotingPrize    — mutation: POST /voting/claim-prize
 *   votingPrizeToClaimData — adapter: VotingPrizeStatusResponse → PrizeClaimResponse | null
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useQueryWithFocus } from '@/lib/react-query';

import { PrizeClaimStatus, PrizeType } from '@foodwaste/shared';
import type { PrizeClaimResponse, VotingPrizeStatusResponse } from '@foodwaste/shared';

import { votingPrizeService } from '../services/votingPrizeService';

// ─── Query Keys ─────────────────────────────────────────────────────────────

const VOTING_PRIZE_KEY = ['voting', 'myPrize'] as const;
const VOTING_CYCLE_KEY = ['voting', 'cycle'] as const;

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Fetches the user's voting prize status for the most recently completed cycle.
 * Auto-refetches on screen focus; stale after 60 seconds.
 *
 * @param enabled - Set to false to skip fetching (e.g. user is not a winner candidate).
 */
export function useVotingPrizeStatus(enabled = true) {
  return useQueryWithFocus<VotingPrizeStatusResponse>(
    VOTING_PRIZE_KEY,
    () => votingPrizeService.getMyPrize(),
    { staleTime: 60_000, enabled },
  );
}

/**
 * Mutation to claim the voting voucher at a selected establishment.
 * On success, updates the local cache immediately (optimistic set) then
 * invalidates the prize and cycle queries so background refresh can confirm.
 */
export function useClaimVotingPrize() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (establishmentId: string) => votingPrizeService.claimPrize(establishmentId),
    onSuccess: data => {
      // Optimistically populate cache so UI reflects claimed state immediately.
      queryClient.setQueryData(VOTING_PRIZE_KEY, data);
      // Background invalidation confirms server state.
      void queryClient.invalidateQueries({ queryKey: VOTING_PRIZE_KEY });
      void queryClient.invalidateQueries({ queryKey: VOTING_CYCLE_KEY });
    },
  });
}

// ─── Adapter ────────────────────────────────────────────────────────────────

/**
 * Adapts a VotingPrizeStatusResponse into the PrizeClaimResponse shape that
 * DiscountClaimModal expects for its `claimData` prop.
 *
 * Returns null when the user has not yet claimed (hasClaimed=false or
 * voucherCode is null), which maps to the "selecting" UX state in the modal.
 */
export function votingPrizeToClaimData(
  status: VotingPrizeStatusResponse,
): PrizeClaimResponse | null {
  if (!status.hasClaimed || status.voucherCode === null) {
    return null;
  }

  return {
    id: status.cycleId ?? 'voting',
    userId: '',
    prizeType: PrizeType.DISCOUNT,
    // status field is narrowed: VotingPrizeStatusResponse.status values are a
    // subset of PrizeClaimStatus, so the cast is safe.
    status: (status.status as PrizeClaimStatus) ?? PrizeClaimStatus.PENDING,
    rank: status.rank ?? 0,
    totalPoints: 0,
    cycleNumber: 0,
    // Conditional spreads required by exactOptionalPropertyTypes.
    ...(status.voucherCode !== null ? { voucherCode: status.voucherCode } : {}),
    ...(status.establishmentName !== null ? { establishmentName: status.establishmentName } : {}),
    createdAt: new Date().toISOString(),
  };
}
