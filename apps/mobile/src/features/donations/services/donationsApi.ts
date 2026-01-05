/**
 * Donations API Service
 * Enterprise-grade API client for donation endpoints with error handling
 */

import axios, { AxiosError } from 'axios';
import { DonationStats, UserDonationStats } from '../../../types/donations';
import { environment } from '../../../config/environment';

/**
 * API client instance with default configuration
 * Uses centralized environment configuration
 */
const apiClient = axios.create({
  baseURL: `${environment.api.baseUrl}/donations`,
  timeout: environment.api.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Error handler for API requests
 */
const handleApiError = (error: unknown): Error => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string }>;
    const message =
      axiosError.response?.data?.message ||
      axiosError.message ||
      'An unexpected error occurred';
    return new Error(message);
  }
  return error as Error;
};

/**
 * Donations API methods
 */
export const donationsApi = {
  /**
   * Get current donation pool statistics (public endpoint)
   */
  async getCurrentStats(): Promise<DonationStats> {
    try {
      const response = await apiClient.get<DonationStats>('/stats');
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  /**
   * Get user-specific donation statistics (requires auth)
   */
  async getUserStats(): Promise<UserDonationStats> {
    try {
      const response = await apiClient.get<UserDonationStats>('/user/stats');
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  /**
   * Health check for donations service
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      const response = await apiClient.get('/health');
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },
};

/**
 * Set auth token for authenticated requests
 */
export const setDonationsApiAuthToken = (token: string | null): void => {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
};
