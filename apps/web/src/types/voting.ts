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
  /** Optional for the same reason as the cycle counters below. */
  totalWeightedVotes?: number;
  voterCount?: number;
  announcedAt: string;
}

/**
 * A row as the admin list actually returns it.
 *
 * The counters are optional because the API can genuinely omit them. The
 * endpoint returns whole documents with no projection, so a cycle written
 * before a field existed on the schema simply has no such key — and
 * `seasonBagTarget` is declared `required` with no default, so nothing
 * backfills it on read. Typing them as plain `number` was a promise the
 * backend does not keep: `.toLocaleString()` on the missing one threw and
 * blanked the whole admin voting page over a single legacy row.
 *
 * Read them through `formatCount` from `@/lib/format`, which renders an em dash
 * for a value that is not there.
 */
export interface VotingCycleRow {
  _id: string;
  name: string;
  status: string;
  cycleNumber: number;
  cycleStartDate: string;
  cycleEndDate: string;
  seasonBagTarget?: number;
  seasonBagProgress?: number;
  minimumBags?: number;
  recipientCount?: number;
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
