import { IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMonthlyGoalDto {
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(10_000)
  targetBagsPerMonth!: number;
}

// ── Response shapes (plain objects, no class-transformer needed) ──────────────

export interface EsgTierInfo {
  /** Internal key */
  name: string;
  /** Display label (e.g. "Ambassadeur Élite") */
  label: string;
  /** Human-readable badge suffix, or null */
  badge: string | null;
  /** Bags threshold to reach this tier */
  threshold: number;
  /** Whether the merchant has reached this tier */
  reached: boolean;
}

export interface EsgTierResponse {
  currentTier: string;
  currentLabel: string;
  currentBadge: string | null;
  bagsSaved: number;
  /** Progress 0-100 within the current tier toward the next */
  ringProgress: number;
  nextTier: string | null;
  nextMilestoneAt: number | null;
  remaining: number | null;
  allTiers: EsgTierInfo[];
}

export interface MonthlyGoalResponse {
  targetBagsPerMonth: number;
  currentMonthBags: number;
  progressPercentage: number;
  month: string;
  treesEquivalent: number;
}

export interface CarbonMetricsResponse {
  bagsSaved: number;
  foodWeightKg: number;
  carbonKgAvoided: number;
  waterLitersAvoided: number;
  packagingKgSaved: number;
  energyKwhSaved: number;
  carKmEquivalent: number;
  treesEquivalent: number;
  periodLabel: string;
}

export interface SocialImpactResponse {
  bagsSaved: number;
  mealsDistributed: number;
  peopleServedEstimate: number;
  foodWeightKg: number;
  estimatedValueTnd: number;
  periodLabel: string;
}

export interface StreakResponse {
  currentStreak: number;
  longestStreak: number;
  freezesAvailable: number;
  lastListedDate: string | null;
  /** True after 18:00 Tunis time if no offer listed today — triggers urgency UI */
  streakAtRisk: boolean;
  listedToday: boolean;
  /** How many more streak days until the next freeze is earned (awarded every 7 days) */
  nextFreezeAt: number;
}
