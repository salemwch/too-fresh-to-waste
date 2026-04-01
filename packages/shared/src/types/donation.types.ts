import { DonationPoolStatus } from '../enums';

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
  currency: string;
  targetDate?: string;
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
