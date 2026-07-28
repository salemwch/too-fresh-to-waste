/**
 * Community Goal API Service
 * Fetches community bag goal statistics (public endpoint, no auth required)
 *
 * Pattern: mirrors donationsApi.ts exactly
 */

import axios, { type AxiosError } from 'axios';

import { apiClient, unwrapBackendResponse, type BackendApiResponse } from '@/services/apiClient';

import type { MonthlyBagGoalStats } from '@foodwaste/shared';

const handleApiError = (error: unknown): Error => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string }>;

    if (
      axios.isCancel(error) ||
      axiosError.code === 'ERR_CANCELED' ||
      axiosError.message === 'canceled'
    ) {
      throw error;
    }

    const message =
      axiosError.response?.data?.message ?? axiosError.message ?? 'An unexpected error occurred';
    return new Error(message);
  }
  return error as Error;
};

export const monthlyBagGoalApi = {
  /**
   * Get community bag goal statistics (public endpoint)
   * @param signal — AbortSignal for TanStack Query cancellation
   */
  async getStats(signal?: AbortSignal): Promise<MonthlyBagGoalStats> {
    try {
      const response = await apiClient.get<BackendApiResponse<MonthlyBagGoalStats>>(
        '/community-goal/stats',
        { ...(signal != null && { signal }) },
      );
      return unwrapBackendResponse({ data: response.data }, 'community goal stats');
    } catch (error) {
      throw handleApiError(error);
    }
  },
};
