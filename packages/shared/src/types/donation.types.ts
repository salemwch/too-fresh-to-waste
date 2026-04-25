import type { DonationGoalCategory, DonationPoolStatus } from '../enums';

/**
 * Pre-aggregated category progress — one entry per DonationGoalCategory.
 * Frontend renders this directly, no client-side aggregation.
 */
export interface CategoryProgress {
  category: DonationGoalCategory;
  percent: number;
  totalItems: number;
  totalAmount: number;
  targetAmount: number;
  itemPrice: number;
  targetCount: number;
}

/**
 * Donation statistics response from backend
 */
export interface DonationStats {
  totalDonations: number;
  targetAmount: number;
  mealCount: number;
  contributorCount: number;
  progressPercentage: number;
  status: DonationPoolStatus;
  cause: string;
  activeGoalCategory: DonationGoalCategory;
  currency: string;
  targetDate?: string;
  categoryProgress: CategoryProgress[];
}

/**
 * User-specific donation statistics
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
 * Order with donation information
 * Uses _id to match MongoDB backend responses
 */
export interface OrderWithDonation {
  _id: string;
  orderNumber: string;
  donationAmount: number;
  pricing: {
    total: number;
    currency: string;
  };
}
