/**
 * Voting Service
 * API integration for community voting endpoints.
 *
 * Endpoints:
 *   GET  /voting/active         → ActiveVotingResponse (cycle + eligibility + myVote)
 *   POST /voting/vote           → vote confirmation
 *   GET  /voting/results        → VotingResultsResponse
 *   GET  /voting/history        → VotingHistoryItem[]
 */

import axios from 'axios';

import { apiClient, unwrapBackendResponse, type BackendApiResponse } from '@/services/apiClient';

import type {
  ActiveVotingResponse,
  VotingResultsResponse,
  VotingHistoryItem,
} from '../types/voting.types';

interface VotingApiError {
  message?: string;
  error?: string;
}

const handleApiError = (error: unknown): Error => {
  if (axios.isAxiosError<VotingApiError>(error)) {
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      throw error;
    }
    const responseData = error.response?.data;
    const errorCode = responseData?.error;
    const message =
      typeof responseData?.message === 'string' && responseData.message.trim() !== ''
        ? responseData.message
        : error.message;
    const err = new Error(message);
    (err as Error & { code: string | undefined }).code = errorCode;
    return err;
  }
  if (error instanceof Error) return error;
  return new Error('An unexpected error occurred');
};

export const votingService = {
  /**
   * Get the active voting cycle with eligibility and the user's existing vote.
   */
  async getActiveCycle(signal?: AbortSignal): Promise<ActiveVotingResponse> {
    try {
      const response = await apiClient.get<BackendApiResponse<ActiveVotingResponse>>(
        '/voting/active',
        { ...(signal !== undefined && { signal }) },
      );
      return unwrapBackendResponse(response, 'active voting cycle');
    } catch (error) {
      throw handleApiError(error);
    }
  },

  /**
   * Cast a vote for the given prize in the current active cycle.
   */
  async castVote(prizeId: string): Promise<unknown> {
    try {
      const response = await apiClient.post<BackendApiResponse<unknown>>('/voting/vote', {
        prizeId,
      });
      return unwrapBackendResponse(response, 'cast vote');
    } catch (error) {
      throw handleApiError(error);
    }
  },

  /**
   * Get voting results, optionally scoped to a specific cycle.
   */
  async getResults(cycleId?: string): Promise<VotingResultsResponse> {
    try {
      const params = cycleId !== undefined ? { cycleId } : {};
      const response = await apiClient.get<BackendApiResponse<VotingResultsResponse>>(
        '/voting/results',
        { params },
      );
      return unwrapBackendResponse(response, 'voting results');
    } catch (error) {
      throw handleApiError(error);
    }
  },

  /**
   * Get the user's voting history across past cycles.
   */
  async getHistory(signal?: AbortSignal): Promise<VotingHistoryItem[]> {
    try {
      const response = await apiClient.get<BackendApiResponse<VotingHistoryItem[]>>(
        '/voting/history',
        { ...(signal !== undefined && { signal }) },
      );
      return unwrapBackendResponse(response, 'voting history');
    } catch (error) {
      throw handleApiError(error);
    }
  },
};
