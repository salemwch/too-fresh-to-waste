/**
 * Voting Prize Service
 * API integration for voting prize endpoints.
 *
 * Endpoints:
 *   GET  /voting/my-prize      → VotingPrizeStatusResponse (winner status + claim state)
 *   POST /voting/claim-prize   → VotingPrizeStatusResponse (updated after claim)
 */

import axios from 'axios';

import { apiClient, unwrapBackendResponse, type BackendApiResponse } from '@/services/apiClient';

import type { VotingPrizeStatusResponse } from '@foodwaste/shared';

interface VotingPrizeApiError {
  message?: string;
  error?: string;
}

const handleApiError = (error: unknown): Error => {
  if (axios.isAxiosError<VotingPrizeApiError>(error)) {
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      throw error;
    }
    const responseData = error.response?.data;
    const message =
      typeof responseData?.message === 'string' && responseData.message.trim() !== ''
        ? responseData.message
        : error.message;
    return new Error(message);
  }
  if (error instanceof Error) return error;
  return new Error('An unexpected error occurred');
};

export const votingPrizeService = {
  /**
   * Fetch the logged-in user's voting prize status for the most recently
   * completed cycle. Passes an AbortSignal so TanStack Query can cancel on
   * unmount (GET is safe to abort).
   */
  async getMyPrize(signal?: AbortSignal): Promise<VotingPrizeStatusResponse> {
    try {
      const response = await apiClient.get<BackendApiResponse<VotingPrizeStatusResponse>>(
        '/voting/my-prize',
        { ...(signal !== undefined && { signal }) },
      );
      return unwrapBackendResponse(response, 'voting prize status');
    } catch (error) {
      throw handleApiError(error);
    }
  },

  /**
   * Claim the voting voucher at the given establishment.
   * Fire-and-forget POST — intentionally takes NO AbortSignal (project rule:
   * no AbortController on fire-and-forget mutations).
   */
  async claimPrize(establishmentId: string): Promise<VotingPrizeStatusResponse> {
    try {
      const response = await apiClient.post<BackendApiResponse<VotingPrizeStatusResponse>>(
        '/voting/claim-prize',
        { establishmentId },
      );
      return unwrapBackendResponse(response, 'voting prize claim');
    } catch (error) {
      throw handleApiError(error);
    }
  },
};
