import { apiClient } from '@/lib/api-client';
import type { BackendEnvelope } from '@/types/dashboard';
import type {
  LoyaltyAccount,
  LoyaltyStats,
  GamificationProgress,
  DonationHistoryItem,
} from '@/types/loyalty';

const BASE = '/loyalty';

export const loyaltyService = {
  getAccount() {
    return apiClient.get<BackendEnvelope<LoyaltyAccount>>(`${BASE}/account`);
  },

  getStats() {
    return apiClient.get<BackendEnvelope<LoyaltyStats>>(`${BASE}/stats`);
  },

  getGamification() {
    return apiClient.get<BackendEnvelope<GamificationProgress>>(`${BASE}/gamification`);
  },

  getReferralCode() {
    return apiClient.get<BackendEnvelope<{ referralCode: string }>>(`${BASE}/referral-code`);
  },

  getReferralLink() {
    return apiClient.get<BackendEnvelope<{ referralLink: string }>>(`${BASE}/referral-link`);
  },

  getDonationHistory() {
    return apiClient.get<BackendEnvelope<DonationHistoryItem[]>>(`${BASE}/donations/history`);
  },

  donatePoints(amount: number, isAnonymous = false, message?: string) {
    return apiClient.post<
      BackendEnvelope<{
        success: boolean;
        pointsDonated: number;
        donationAmount: number;
        estimatedMeals: number;
        remainingPoints: number;
      }>
    >(`${BASE}/donate`, {
      amount,
      isAnonymous,
      ...(message ? { message } : {}),
    });
  },

  recordLoginStreak() {
    return apiClient.post<BackendEnvelope<{ streak: number }>>(`${BASE}/login-streak`);
  },
};
