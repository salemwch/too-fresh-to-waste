/**
 * Donation Type Definitions
 * Enterprise-grade TypeScript interfaces for donation features
 */

/**
 * Donation pool status enum
 */
export enum DonationPoolStatus {
  ACTIVE = 'active',
  FUNDED = 'funded',
  DISTRIBUTED = 'distributed',
  ARCHIVED = 'archived',
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
 * API response wrapper
 */
export interface DonationApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

/**
 * Order with donation information
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
