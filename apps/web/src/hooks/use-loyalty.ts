'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loyaltyService } from '@/services/loyalty.service';
import type {
  LoyaltyAccount,
  LoyaltyStats,
  GamificationProgress,
  DonationHistoryItem,
} from '@/types/loyalty';

const loyaltyKeys = {
  all: ['loyalty'] as const,
  account: () => [...loyaltyKeys.all, 'account'] as const,
  stats: () => [...loyaltyKeys.all, 'stats'] as const,
  gamification: () => [...loyaltyKeys.all, 'gamification'] as const,
  referralCode: () => [...loyaltyKeys.all, 'referral-code'] as const,
  referralLink: () => [...loyaltyKeys.all, 'referral-link'] as const,
  donations: () => [...loyaltyKeys.all, 'donations'] as const,
};

export function useLoyaltyAccount() {
  return useQuery({
    queryKey: loyaltyKeys.account(),
    queryFn: async (): Promise<LoyaltyAccount> => {
      const response = await loyaltyService.getAccount();
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useLoyaltyStats() {
  return useQuery({
    queryKey: loyaltyKeys.stats(),
    queryFn: async (): Promise<LoyaltyStats> => {
      const response = await loyaltyService.getStats();
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useGamification() {
  return useQuery({
    queryKey: loyaltyKeys.gamification(),
    queryFn: async (): Promise<GamificationProgress> => {
      const response = await loyaltyService.getGamification();
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useReferralCode() {
  return useQuery({
    queryKey: loyaltyKeys.referralCode(),
    queryFn: async (): Promise<string> => {
      const response = await loyaltyService.getReferralCode();
      return response.data.data.referralCode;
    },
    staleTime: 30 * 60 * 1000,
  });
}

export function useDonationHistory() {
  return useQuery({
    queryKey: loyaltyKeys.donations(),
    queryFn: async (): Promise<DonationHistoryItem[]> => {
      const response = await loyaltyService.getDonationHistory();
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDonatePoints() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      amount,
      isAnonymous,
      message,
    }: {
      amount: number;
      isAnonymous?: boolean;
      message?: string;
    }) => loyaltyService.donatePoints(amount, isAnonymous, message),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: loyaltyKeys.all });
    },
  });
}
