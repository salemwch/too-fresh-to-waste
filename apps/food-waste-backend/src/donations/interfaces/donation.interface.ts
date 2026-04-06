import type { DonationPoolStatus } from '../schemas/donation-pool.schema';
import type { Types } from 'mongoose';

/**
 * Interface for donation calculation configuration
 */
export interface DonationCalculationConfig {
  platformFeePercentage: number; // 25% = 0.25
  donationPercentage: number; // 5% = 0.05
  mealCostEstimate: number; // Cost per meal in TND
}

/**
 * Interface for donation calculation result
 */
export interface DonationCalculationResult {
  donationAmount: number;
  estimatedMeals: number;
  currency: string;
}

/**
 * Interface for creating a donation record
 */
export interface CreateDonationInput {
  userId: Types.ObjectId;
  orderId: Types.ObjectId;
  amount: number;
  currency?: string;
  isAnonymous?: boolean;
  metadata?: {
    deviceInfo?: string;
    platform?: 'mobile' | 'web';
    sessionId?: string;
  };
}

/**
 * Interface for donation pool statistics
 */
export interface DonationPoolStats {
  currentAmount: number;
  targetAmount: number;
  mealCount: number;
  contributorCount: number;
  progressPercentage: number;
  status: DonationPoolStatus;
  cause: string;
  currency: string;
  targetDate?: Date;
}

/**
 * Interface for user donation statistics
 */
export interface UserDonationStats {
  totalDonated: number;
  contributionCount: number;
  badgesEarned: string[];
  mealsContributed: number;
  rank: number;
  currency: string;
}

/**
 * Interface for badge calculation criteria
 */
export interface BadgeCriteria {
  badgeType: string;
  requiredAmount?: number;
  requiredCount?: number;
}

/**
 * Constants for donation business logic
 */
export const DONATION_CONSTANTS = {
  PLATFORM_FEE_PERCENTAGE: 0.25, // 25% platform fee
  DONATION_PERCENTAGE: 0.05, // 5% of platform fee goes to donations
  MEAL_COST_ESTIMATE_TND: 2.5, // Estimated cost per meal in TND (1 meal per 2.5 TND)
  DEFAULT_TARGET_AMOUNT: 300, // Default pool target (changed from 1000)
} as const;

/**
 * Badge thresholds for gamification
 */
export const BADGE_THRESHOLDS = {
  FIRST_STEP: { count: 1, amount: 0 },
  COMMUNITY_HELPER: { count: 10, amount: 0 },
  IMPACT_MAKER: { count: 0, amount: 50 },
  FOOD_HERO: { count: 0, amount: 100 },
  CHAMPION: { count: 0, amount: 500 },
} as const;
