import type { BadgeType } from '../enums';

export type PointTransactionType = 'earned' | 'redeemed' | 'expired' | 'donated';

export type TierName = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

// ---------------------------------------------------------------------------
// Subdocument interfaces
// ---------------------------------------------------------------------------

export interface Badge {
  type: BadgeType;
  earnedAt: string;
  name: string;
  description: string;
  iconUrl: string;
}

export interface PointTransaction {
  amount: number;
  type: PointTransactionType;
  reason: string;
  orderId?: string;
  offerId?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface LoginStreak {
  currentStreak: number;
  lastLoginDate?: string;
  pointsEarnedThisMonth: number;
  monthlyResetDate?: string;
  longestStreak: number;
}

export interface PurchaseStreak {
  bagsThisPeriod: number;
  periodStartDate?: string;
  completedThisMonth: boolean;
  monthlyResetDate?: string;
  totalStreaksCompleted: number;
}

export interface ReviewTracking {
  reviewedOrderIds: string[];
  totalReviewsCount: number;
  totalReviewPoints: number;
}

// ---------------------------------------------------------------------------
// Main loyalty account (GET /loyalty/account response)
// ---------------------------------------------------------------------------

export interface LeaderboardConsent {
  given: boolean;
  showRealName: boolean;
  setAt?: string | null;
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
  currentTier: TierName;
  badges: Badge[];
  pointsHistory: PointTransaction[];
  referralCount: number;
  joinedAt: string;
  lastActivity?: string;
  isActive: boolean;
  loginStreak: LoginStreak;
  purchaseStreak: PurchaseStreak;
  reviewTracking: ReviewTracking;
  referralCode?: string;
  leaderboardConsent: LeaderboardConsent;
}

// ---------------------------------------------------------------------------
// Gamification stats (GET /loyalty/gamification response)
// ---------------------------------------------------------------------------

export interface GamificationStats {
  referralCode?: string;
  friendReferrals: {
    pending: number;
    completed: number;
    pointsReward: number;
    pendingDetails: Array<{
      friendBagCount: number;
      bagsRequired: number;
      expiresAt: string;
    }>;
  };
  businessReferrals: {
    pending: number;
    completed: number;
    pointsReward: number;
    pendingDetails: Array<{
      businessOrderCount: number;
      ordersRequired: number;
      expiresAt: string;
    }>;
  };
  loginStreak: {
    currentStreak: number;
    pointsEarnedThisMonth: number;
    maxPointsPerMonth: number;
    daysRequired: number;
    longestStreak: number;
  };
  purchaseStreak: {
    bagsThisPeriod: number;
    bagsRequired: number;
    daysRemaining: number;
    completedThisMonth: boolean;
    totalStreaksCompleted: number;
  };
  reviews: {
    totalReviews: number;
    totalPointsFromReviews: number;
    pointsPerReview: number;
    minWordsRequired: number;
  };
}

// ---------------------------------------------------------------------------
// Login streak response (POST /loyalty/login-streak)
// ---------------------------------------------------------------------------

export interface LoginStreakResponse {
  streakDays: number;
  pointsAwarded: number;
  message: string;
}

// ---------------------------------------------------------------------------
// Referral link response (GET /loyalty/referral-link)
// ---------------------------------------------------------------------------

export interface ReferralLinkResponse {
  referralCode: string;
  referralLink: string;
}

// ---------------------------------------------------------------------------
// Tier helpers
// ---------------------------------------------------------------------------

/** Tier ordering for comparison */
const TIER_ORDER: Record<TierName, number> = {
  Bronze: 0,
  Silver: 1,
  Gold: 2,
  Platinum: 3,
};

/** Get the next tier (or undefined if already Platinum) */
export function getNextTier(current: TierName): TierName | undefined {
  const tiers: TierName[] = ['Bronze', 'Silver', 'Gold', 'Platinum'];
  const idx = tiers.indexOf(current);
  return idx < tiers.length - 1 ? tiers[idx + 1] : undefined;
}

/** Compare two tiers: -1 if a < b, 0 if equal, 1 if a > b */
export function compareTiers(a: TierName, b: TierName): number {
  return Math.sign(TIER_ORDER[a] - TIER_ORDER[b]);
}
