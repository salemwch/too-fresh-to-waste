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
}

/**
 * Leaderboard response
 */
export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  currentUserEntry: LeaderboardEntry | null;
  total: number;
}
