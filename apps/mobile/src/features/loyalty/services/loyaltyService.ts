/**
 * Loyalty Service
 * API integration for loyalty endpoints.
 *
 * Endpoints:
 *   GET  /loyalty/account       → LoyaltyAccount
 *   GET  /loyalty/gamification  → GamificationStats
 *   POST /loyalty/login-streak  → LoginStreakResponse
 */

import axios from 'axios';

import { apiClient, unwrapBackendResponse, type BackendApiResponse } from '@/services/apiClient';

import type {
  LoyaltyAccount,
  GamificationStats,
  LoginStreakResponse,
  ReferralLinkResponse,
} from '../types/loyalty.types';

interface LoyaltyApiError {
  message?: string;
}

const handleApiError = (error: unknown): Error => {
  if (axios.isAxiosError<LoyaltyApiError>(error)) {
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      throw error;
    }

    const responseData = error.response?.data;
    const message =
      typeof responseData?.message === 'string' && responseData.message.trim() !== ''
        ? responseData.message
        : error.message.trim() !== ''
          ? error.message
          : 'An unexpected error occurred';

    return new Error(message);
  }

  if (error instanceof Error) return error;

  return new Error(typeof error === 'string' ? error : 'An unexpected error occurred');
};

export const loyaltyService = {
  /**
   * Get the authenticated user's loyalty account
   */
  async getAccount(signal?: AbortSignal): Promise<LoyaltyAccount> {
    try {
      const response = await apiClient.get<BackendApiResponse<LoyaltyAccount>>('/loyalty/account', {
        ...(signal !== undefined && { signal }),
      });
      return unwrapBackendResponse(response, 'loyalty account');
    } catch (error) {
      throw handleApiError(error);
    }
  },

  /**
   * Get gamification stats (streaks, referrals, reviews)
   */
  async getGamification(signal?: AbortSignal): Promise<GamificationStats> {
    try {
      const response = await apiClient.get<BackendApiResponse<GamificationStats>>(
        '/loyalty/gamification',
        { ...(signal !== undefined && { signal }) },
      );
      return unwrapBackendResponse(response, 'gamification stats');
    } catch (error) {
      throw handleApiError(error);
    }
  },

  /**
   * Record a daily login (fire-and-forget, awards 2 pts/day up to 20/month)
   */
  async recordLoginStreak(signal?: AbortSignal): Promise<LoginStreakResponse> {
    try {
      const response = await apiClient.post<BackendApiResponse<LoginStreakResponse>>(
        '/loyalty/login-streak',
        {},
        { ...(signal !== undefined && { signal }) },
      );
      return unwrapBackendResponse(response, 'login streak');
    } catch (error) {
      throw handleApiError(error);
    }
  },

  /**
   * Get the authenticated user's personal referral link
   */
  async getReferralLink(signal?: AbortSignal): Promise<ReferralLinkResponse> {
    try {
      const response = await apiClient.get<BackendApiResponse<ReferralLinkResponse>>(
        '/loyalty/referral-link',
        { ...(signal !== undefined && { signal }) },
      );
      return unwrapBackendResponse(response, 'referral link');
    } catch (error) {
      throw handleApiError(error);
    }
  },
};
