export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

type BadgeType =
  | 'newcomer'
  | 'eco_warrior'
  | 'frequent_saver'
  | 'early_bird'
  | 'night_owl'
  | 'loyal_customer'
  | 'super_saver'
  | 'community_champion'
  | 'streak_master'
  | 'referral_champion'
  | 'business_recruiter'
  | 'reviewer';

export interface LoyaltyStats {
  totalPoints: number;
  availablePoints: number;
  lifetimePointsEarned: number;
  totalOrdersCount: number;
  totalBagsSaved: number;
  totalAmountSpent: number;
  currentTier: LoyaltyTier;
  badgeCount: number;
  referralCount: number;
  joinedAt: string;
  lastActivity?: string;
}

export interface LoyaltyAccount {
  _id: string;
  userId: string;
  totalPoints: number;
  availablePoints: number;
  lifetimePointsEarned: number;
  totalOrdersCount: number;
  totalBagsSaved: number;
  totalAmountSpent: number;
  currentTier: LoyaltyTier;
  badges: Array<{
    type: BadgeType;
    earnedAt: string;
    name: string;
  }>;
  referralCode?: string;
  referralCount: number;
  isActive: boolean;
  joinedAt: string;
  lastActivity?: string;
}

export interface GamificationProgress {
  friendReferrals: { count: number; pointsEarned: number };
  businessReferrals: { count: number; pointsEarned: number };
  loginStreak: { current: number; longest: number; lastLogin?: string };
  purchaseStreak: { current: number; longest: number };
  reviewTracking: { count: number; pointsEarned: number };
}

export interface DonationHistoryItem {
  id: string;
  amount: number;
  donationAmount: number;
  estimatedMeals: number;
  isAnonymous: boolean;
  message?: string;
  createdAt: string;
}

export const TIER_CONFIG: Record<
  LoyaltyTier,
  { threshold: number; multiplier: number; color: string }
> = {
  Bronze: { threshold: 0, multiplier: 1.0, color: '#CD7F32' },
  Silver: { threshold: 400, multiplier: 1.2, color: '#C0C0C0' },
  Gold: { threshold: 1200, multiplier: 1.5, color: '#FFD700' },
  Platinum: { threshold: 2700, multiplier: 2.0, color: '#E5E4E2' },
};
