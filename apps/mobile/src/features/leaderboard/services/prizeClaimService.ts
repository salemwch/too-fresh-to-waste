import axios from 'axios';

import { apiClient, unwrapBackendResponse, type BackendApiResponse } from '@/services/apiClient';

import type { PrizeClaimResponse, PrizeClaimStatusResponse } from '@foodwaste/shared';

const handleApiError = (error: unknown): Error => {
  if (axios.isAxiosError(error)) {
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

export const prizeClaimService = {
  async getClaimStatus(signal?: AbortSignal): Promise<PrizeClaimStatusResponse> {
    try {
      const response = await apiClient.get<BackendApiResponse<PrizeClaimStatusResponse>>(
        '/loyalty/prize-claim/status',
        { ...(signal !== undefined && { signal }) },
      );
      return unwrapBackendResponse(response, 'prizeClaimStatus');
    } catch (error) {
      throw handleApiError(error);
    }
  },

  /**
   * Claims the grand prize for a top-ranked user.
   *
   * The endpoint is still `/smartphone` — renaming it is a breaking API change
   * for older app builds, so the route stays and only the client naming moves
   * on. What it awards is whatever the community voted for.
   */
  async claimGrandPrize(): Promise<PrizeClaimResponse> {
    try {
      const response = await apiClient.post<BackendApiResponse<PrizeClaimResponse>>(
        '/loyalty/prize-claim/smartphone',
      );
      return unwrapBackendResponse(response, 'prizeClaimGrandPrize');
    } catch (error) {
      throw handleApiError(error);
    }
  },

  async claimDiscount(establishmentId: string): Promise<PrizeClaimResponse> {
    try {
      const response = await apiClient.post<BackendApiResponse<PrizeClaimResponse>>(
        '/loyalty/prize-claim/discount',
        { establishmentId },
      );
      return unwrapBackendResponse(response, 'prizeClaimDiscount');
    } catch (error) {
      throw handleApiError(error);
    }
  },
};
