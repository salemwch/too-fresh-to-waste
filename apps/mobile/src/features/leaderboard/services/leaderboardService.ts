import axios from 'axios';

import { apiClient, unwrapBackendResponse, type BackendApiResponse } from '@/services/apiClient';

import type { LeaderboardResponse } from '../types/leaderboard.types';

const handleApiError = (error: unknown): Error => {
  if (axios.isAxiosError(error)) {
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') throw error;
    const msg =
      typeof error.response?.data?.message === 'string'
        ? error.response.data.message
        : error.message || 'An unexpected error occurred';
    return new Error(msg);
  }
  if (error instanceof Error) return error;
  return new Error(typeof error === 'string' ? error : 'An unexpected error occurred');
};

export const leaderboardService = {
  async getLeaderboard(
    limit  = 50,
    offset = 0,
    signal?: AbortSignal,
  ): Promise<LeaderboardResponse> {
    try {
      const response = await apiClient.get<BackendApiResponse<LeaderboardResponse>>(
        `/loyalty/leaderboard?limit=${limit}&offset=${offset}`,
        { ...(signal !== undefined && { signal }) },
      );
      return unwrapBackendResponse(response, 'leaderboard');
    } catch (error) {
      throw handleApiError(error);
    }
  },
};
