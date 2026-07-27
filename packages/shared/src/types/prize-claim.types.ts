export enum PrizeType {
  SMARTPHONE = 'smartphone',
  DISCOUNT = 'discount',
}

export enum PrizeClaimStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  DELIVERED = 'delivered',
  REJECTED = 'rejected',
}

export interface PrizeClaimResponse {
  id: string;
  userId: string;
  prizeType: PrizeType;
  status: PrizeClaimStatus;
  rank: number;
  totalPoints: number;
  cycleNumber: number;
  establishmentId?: string;
  establishmentName?: string;
  voucherCode?: string;
  adminNotes?: string;
  verifiedAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

export interface ClaimSmartphoneRequest {
  /** No fields needed — rank is validated server-side from leaderboard */
}

export interface ClaimDiscountRequest {
  establishmentId: string;
}

export interface PrizeClaimStatusResponse {
  hasClaimed: boolean;
  claim: PrizeClaimResponse | null;
  eligiblePrizeType: PrizeType | null;
  rank: number | null;
  /**
   * Whether the ended season hit its community bag target.
   *
   * The smartphone is unlocked by the community goal, so when this is false
   * nobody wins one and every ranked user — the top 3 included — falls back to
   * the discount voucher. `eligiblePrizeType` already accounts for it; this
   * field is what lets the UI explain *why*.
   */
  targetReached: boolean;
}
