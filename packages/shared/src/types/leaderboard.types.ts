/**
 * Leaderboard entry returned from backend
 */
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  firstName: string;
  lastName: string;
  profileImage: string | null;
  currentBadge: string | null;
  currentBadgeType: string | null;
  currentTier: string;
  totalPoints: number;
  isCurrentUser: boolean;
  percentile?: number;
}

/**
 * Leaderboard response
 */
export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  currentUserEntry: LeaderboardEntry | null;
  total: number;
  hasMore: boolean;
  /** true if the calling user has already responded to the consent prompt */
  hasSetConsent: boolean;
}

/**
 * Neighborhood response — ±5 users around the caller
 */
export interface LeaderboardNeighborhoodEntry extends LeaderboardEntry {
  isAnchor: boolean;
}

export interface LeaderboardNeighborhoodResponse {
  entries: LeaderboardNeighborhoodEntry[];
  anchorRank: number;
  total: number;
}

/**
 * Champion (rank #1) lightweight response
 */
export interface LeaderboardChampionResponse {
  userId: string;
  firstName: string;
  lastName: string;
  profileImage: string | null;
  totalPoints: number;
  currentTier: string;
  currentBadge: string | null;
}
