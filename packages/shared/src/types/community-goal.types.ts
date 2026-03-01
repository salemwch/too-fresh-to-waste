/**
 * Community Bag Goal Types
 * Shared types for the community bag saving goal feature
 */

export enum CommunityGoalStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export interface CommunityBagGoalStats {
  currentCount: number;
  targetCount: number;
  progressPercentage: number;
  remaining: number;
  cycleNumber: number;
  status: CommunityGoalStatus;
  lastUpdatedAt: string;
}
