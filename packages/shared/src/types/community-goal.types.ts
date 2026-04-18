/**
 * Community Bag Goal Types
 * Shared types for the community bag saving goal feature
 */

export enum CommunityGoalStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

/** Extensible cause enum — add new values here as the programme grows */
export enum CommunityGoalCauseType {
  FOOD = 'FOOD',
  CLOTHING = 'CLOTHING',
  EDUCATION = 'EDUCATION',
  MEDICINE = 'MEDICINE',
}

export interface CommunityBagGoalStats {
  currentCount: number;
  targetCount: number;
  progressPercentage: number;
  remaining: number;
  cycleNumber: number;
  status: CommunityGoalStatus;
  lastUpdatedAt: string;
  /** Optional — absent on legacy goals that pre-date the cause feature */
  causeType?: CommunityGoalCauseType;
  causeTitle?: string;
  causeDescription?: string;
}
