import axios from 'axios';

import { apiClient, unwrapBackendResponse, type BackendApiResponse } from '@/services/apiClient';

import type {
  LeaderboardResponse,
  LeaderboardNeighborhoodResponse,
} from '../types/leaderboard.types';

interface LeaderboardApiError {
  message?: string;
}

const handleApiError = (error: unknown): Error => {
  if (axios.isAxiosError<LeaderboardApiError>(error)) {
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') throw error;
    const apiMessage = error.response?.data?.message;
    const msg =
      typeof apiMessage === 'string' && apiMessage.trim() !== ''
        ? apiMessage
        : error.message.trim() !== ''
          ? error.message
          : 'An unexpected error occurred';
    return new Error(msg);
  }
  if (error instanceof Error) return error;
  return new Error(typeof error === 'string' ? error : 'An unexpected error occurred');
};

export const leaderboardService = {
  async getLeaderboard(limit = 50, offset = 0, signal?: AbortSignal): Promise<LeaderboardResponse> {
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

  async getNeighborhood(signal?: AbortSignal): Promise<LeaderboardNeighborhoodResponse> {
    try {
      const response = await apiClient.get<BackendApiResponse<LeaderboardNeighborhoodResponse>>(
        '/loyalty/leaderboard/neighborhood',
        { ...(signal !== undefined && { signal }) },
      );
      return unwrapBackendResponse(response, 'neighborhood');
    } catch (error) {
      throw handleApiError(error);
    }
  },

  async updateLeaderboardConsent(showRealName: boolean): Promise<void> {
    try {
      await apiClient.patch('/loyalty/leaderboard-consent', { showRealName });
    } catch (error) {
      throw handleApiError(error);
    }
  },
};
