interface PrizeOptionData {
  _id: string;
  name: string;
  description: string;
  imageUrl?: string;
  category: string;
  value: string;
}

interface VotingWinnerData {
  prizeId: string;
  name: string;
  totalWeightedVotes: number;
  voterCount: number;
  announcedAt: string;
}

export interface VotingCycleRow {
  _id: string;
  name: string;
  status: string;
  cycleNumber: number;
  cycleStartDate: string;
  cycleEndDate: string;
  seasonBagTarget: number;
  seasonBagProgress: number;
  minimumBags: number;
  recipientCount: number;
  prizes: PrizeOptionData[];
  winner: VotingWinnerData | null;
  ballotOpensAt: string | null;
  ballotClosesAt: string | null;
  snapshotReady: boolean;
  createdAt: string;
}

export interface CreateCyclePayload {
  name: string;
  cycleStartDate: string;
  cycleEndDate: string;
  seasonBagTarget: number;
  minimumBags: number;
  recipientCount: number;
  prizes: Array<{
    name: string;
    description: string;
    imageUrl?: string;
    category: string;
    value: string;
  }>;
}

export interface UpdateCyclePayload {
  name?: string;
  cycleStartDate?: string;
  cycleEndDate?: string;
  seasonBagTarget?: number;
  minimumBags?: number;
  recipientCount?: number;
  prizes?: CreateCyclePayload['prizes'];
}

export interface CycleStatsData {
  results: Array<{
    prizeId: string;
    name: string;
    totalWeightedVotes: number;
    voterCount: number;
  }>;
  totalVoters: number;
  totalEligible: number;
  participationRate: number;
}

export interface AdminWinnerRow {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  rank: number;
  pointsSnapshot: number;
  hasClaimed: boolean;
  claimStatus: string | null;
  voucherCode: string | null;
  establishmentName: string | null;
}

export interface PrizeClaimRow {
  _id: string;
  userId: { _id: string; firstName: string; lastName: string; email: string } | string;
  prizeType: 'smartphone' | 'discount';
  status: 'pending' | 'verified' | 'delivered' | 'rejected';
  rank: number;
  totalPoints: number;
  cycleNumber: number;
  source: 'bag_goal' | 'voting';
  establishmentName?: string;
  voucherCode?: string;
  adminNotes?: string;
  verifiedAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

export interface UpdatePrizeClaimPayload {
  status: 'verified' | 'delivered' | 'rejected';
  adminNotes?: string;
}
