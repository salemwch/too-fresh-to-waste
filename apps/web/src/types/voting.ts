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
  communityGoalTarget: number;
  communityGoalProgress: number;
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
  communityGoalTarget: number;
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
  communityGoalTarget?: number;
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
