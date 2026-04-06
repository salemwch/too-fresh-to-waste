/**
 * Donations API Service
 * Enterprise-grade API client for donation endpoints with error handling
 *
 * Architecture:
 * - Uses centralized apiClient for automatic token management
 * - Automatic token refresh on 401 errors
 * - No manual token setting required
 */

import axios, { type AxiosError } from 'axios';

import { apiClient, unwrapBackendResponse, type BackendApiResponse } from '@/services/apiClient';
import { Logger } from '@/utils/logger';

import type { DonationStats, UserDonationStats } from '../../../types/donations';

/**
 * Error handler for API requests
 * Distinguish between cancellations and real errors
 */
const handleApiError = (error: unknown): Error => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string }>;

    // Don't wrap cancellation errors
    // TanStack Query expects the original error to detect cancellations
    if (
      axios.isCancel(error) ||
      axiosError.code === 'ERR_CANCELED' ||
      axiosError.message === 'canceled'
    ) {
      // Re-throw as-is - this is expected behavior, not an error
      throw error;
    }

    const message =
      axiosError.response?.data?.message ?? axiosError.message ?? 'An unexpected error occurred';
    return new Error(message);
  }
  return error as Error;
};

/**
 * Donations API methods
 * All methods use centralized apiClient with automatic token injection and cancellation support
 */
export const donationsApi = {
  /**
   * Get current donation pool statistics (public endpoint)
   * No authentication required
   * @param signal - Optional AbortSignal for request cancellation
   */
  async getCurrentStats(signal?: AbortSignal): Promise<DonationStats> {
    try {
      const response = await apiClient.get<BackendApiResponse<DonationStats>>('/donations/stats', {
        ...(signal != null && { signal }),
      });
      return unwrapBackendResponse({ data: response.data }, 'donation stats');
    } catch (error) {
      throw handleApiError(error);
    }
  },

  /**
   * Get user-specific donation statistics (requires auth)
   * Authentication token automatically injected by centralized apiClient
   * @param signal - Optional AbortSignal for request cancellation
   */
  async getUserStats(signal?: AbortSignal): Promise<UserDonationStats> {
    try {
      const response = await apiClient.get<BackendApiResponse<UserDonationStats>>(
        '/donations/user/stats',
        { ...(signal != null && { signal }) },
      );
      return unwrapBackendResponse({ data: response.data }, 'user donation stats');
    } catch (error) {
      throw handleApiError(error);
    }
  },

  /**
   * Health check for donations service
   * @param signal - Optional AbortSignal for request cancellation
   */
  async healthCheck(signal?: AbortSignal): Promise<{ status: string; timestamp: string }> {
    try {
      const response = await apiClient.get<
        BackendApiResponse<{ status: string; timestamp: string }>
      >('/donations/health', { ...(signal != null && { signal }) });
      return unwrapBackendResponse({ data: response.data }, 'donation health check');
    } catch (error) {
      throw handleApiError(error);
    }
  },
};

/**
 * @deprecated No longer needed - centralized apiClient handles token management
 * This function is kept for backward compatibility but does nothing
 */
export const setDonationsApiAuthToken = (_token: string | null): void => {
  // No-op: centralized apiClient automatically injects tokens
  // Token refresh is handled by apiClient interceptors
  Logger.warn(
    '[donationsApi] setDonationsApiAuthToken is deprecated. Token management is automatic via centralized apiClient.',
  );
};
