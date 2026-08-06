/**
 * Monthly Bag Goal Types
 * Shared types for the recurring monthly bag saving goal feature (500 bags → points).
 */

export enum MonthlyGoalStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

/** Extensible cause enum — add new values here as the programme grows */
export enum MonthlyGoalCauseType {
  FOOD = 'FOOD',
  CLOTHING = 'CLOTHING',
  EDUCATION = 'EDUCATION',
  MEDICINE = 'MEDICINE',
}

export interface MonthlyBagGoalStats {
  currentCount: number;
  targetCount: number;
  progressPercentage: number;
  remaining: number;
  cycleNumber: number;
  status: MonthlyGoalStatus;
  lastUpdatedAt: string;
  /** Optional — absent on legacy goals that pre-date the cause feature */
  causeType?: MonthlyGoalCauseType;
  causeTitle?: string;
  causeDescription?: string;
  /** Admin-set display name for this challenge cycle */
  seasonName?: string;
  /** Optional deadline — challenge expires if bags not reached by this date */
  endDate?: string;
  /** Number of unique users who contributed bags this cycle */
  participantCount?: number;
}
