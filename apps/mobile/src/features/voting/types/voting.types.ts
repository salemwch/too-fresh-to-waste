export interface PrizeOption {
  _id: string;
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  value: string;
}

interface VotingWinner {
  prizeId: string;
  name: string;
  totalWeightedVotes: number;
  voterCount: number;
  announcedAt: string;
}

export interface VotingCycleData {
  _id: string;
  name: string;
  status: string;
  cycleStartDate: string;
  cycleEndDate: string;
  seasonBagTarget: number;
  seasonBagProgress: number;
  ballotOpensAt: string | null;
  ballotClosesAt: string | null;
  prizes: PrizeOption[];
  winner: VotingWinner | null;
  recipientCount: number;
  minimumBags: number;
}

export interface VotingEligibilityData {
  canVote: boolean;
  reason?: string;
  userBagsInCycle: number;
  requiredBags: number;
  pointsSnapshot: number;
}

export interface MyVoteData {
  prizeId: string;
  pointsSnapshot: number;
  votedAt: string;
}

export interface ActiveVotingResponse {
  cycle: VotingCycleData | null;
  eligibility: VotingEligibilityData | null;
  myVote: MyVoteData | null;
}

interface VotingResultItem {
  prizeId: string;
  name: string;
  totalWeightedVotes: number;
  voterCount: number;
}

export interface VotingResultsResponse {
  results: VotingResultItem[];
  totalVoters: number;
  totalEligible: number;
}

export interface VotingHistoryItem {
  _id: string;
  name: string;
  cycleStartDate: string;
  cycleEndDate: string;
  winner: VotingWinner | null;
  status: string;
  cycleNumber: number;
}
