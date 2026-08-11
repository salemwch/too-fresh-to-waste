/**
 * What kind of thing was won.
 *
 * `GRAND_PRIZE` is whatever the community voted for that season — a phone, a
 * scooter, a hotel stay, a gym year, a voucher. The specific item is carried in
 * `prizeName` / `prizeCategory`, because the catalogue is admin-defined per
 * cycle and an enum cannot track it.
 *
 * `SMARTPHONE` is kept only so historical claims still read; nothing writes it.
 * @deprecated use `GRAND_PRIZE`.
 */
export enum PrizeType {
  GRAND_PRIZE = 'grand_prize',
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
  /**
   * The prize as the user was shown it — "Electric Scooter", "5 Days in a Hotel".
   * Snapshotted at claim time, so an admin editing the cycle's catalogue later
   * cannot rewrite what someone was told they won.
   */
  prizeName?: string;
  /** `PrizeCategory` from the voting cycle — PHONE, ELECTRIC_SCOOTER, … */
  prizeCategory?: string;
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

/** No fields needed — rank is validated server-side from leaderboard. */
export type ClaimSmartphoneRequest = Record<string, never>;

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
   * The grand prize is unlocked by the community goal, so when this is false
   * nobody wins one and every ranked user — the top ranks included — falls back
   * to the discount voucher. `eligiblePrizeType` already accounts for it; this
   * field is what lets the UI explain *why*.
   */
  targetReached: boolean;
  /**
   * How many top ranks win the grand prize this season — the admin sets it per
   * cycle. The app draws its prize cutoff here rather than assuming a number,
   * which is how the leaderboard came to say 3 while voting awarded 5.
   */
  recipientCount: number;
}
