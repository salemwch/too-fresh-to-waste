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
}
