export interface VotingPrizeStatusResponse {
  /** True when the logged-in user is among the top recipientCount voters for the winning prize. */
  isWinner: boolean;
  /** 1-based rank among winning-prize voters, or null if the user did not win. */
  rank: number | null;
  /** How many top voters are eligible for the prize this cycle. */
  recipientCount: number;
  /** Completed cycle id this status refers to, or null when no completed cycle / not a winner. */
  cycleId: string | null;
  cycleName: string | null;
  /** Name of the winning prize, or null. */
  prizeName: string | null;
  /** True when the user has already claimed their voting voucher for this cycle. */
  hasClaimed: boolean;
  voucherCode: string | null;
  establishmentName: string | null;
  status: 'pending' | 'verified' | 'delivered' | 'rejected' | null;
}

export interface ClaimVotingPrizeRequest {
  establishmentId: string;
}
