/**
 * Donation Hooks
 * TanStack Query hooks for donation data fetching with caching and error handling
 */

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';

import { donationsApi } from '../services/donationsApi';

import type { DonationStats, UserDonationStats } from '../../../types/donations';
import type { UseQueryResult } from '@tanstack/react-query';
import type { RootState } from '../../../store';

/**
 * ✅ DRY PRINCIPLE: Shared query configuration for all donation hooks
 * Centralizes cache timing and retry strategy
 */
const DONATION_QUERY_CONFIG = {
  staleTime: 5 * 60 * 1000, // 5 minutes - donation data doesn't change frequently
  gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer than stale time
  retry: 2, // Retry failed requests twice before giving up
} as const;

/**
 * Hook to fetch current donation pool statistics
 * - Public endpoint (no auth required)
 * - Cached for 5 minutes to reduce API calls
 * - Supports automatic request cancellation on unmount
 * - Refetch disabled on window focus (appropriate for donation data)
 */
export const useDonationStats = (): UseQueryResult<DonationStats, Error> =>
  useQuery<DonationStats, Error>({
    queryKey: ['donations', 'stats'],
    queryFn: ({ signal }) => donationsApi.getCurrentStats(signal),
    ...DONATION_QUERY_CONFIG,
    refetchOnWindowFocus: false, // Donation stats don't need aggressive refresh
  });

/**
 * Hook to fetch user-specific donation statistics
 * - Protected endpoint (requires authentication)
 * - Automatically disabled when user is not authenticated
 * - Supports automatic request cancellation on unmount
 * - Can be manually disabled via enabled parameter
 *
 * @param manuallyEnabled - Override to disable fetch (default: true)
 * @example
 * ```tsx
 * // Basic usage (auto-checks auth)
 * const { data: stats } = useUserDonationStats();
 *
 * // With manual control
 * const { data: stats } = useUserDonationStats(shouldFetch && someOtherCondition);
 * ```
 */
export const useUserDonationStats = (
  manuallyEnabled: boolean = true,
): UseQueryResult<UserDonationStats, Error> => {
  // ✅ BEST PRACTICE: Auto-check authentication to prevent unnecessary 401 errors
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  return useQuery<UserDonationStats, Error>({
    queryKey: ['donations', 'user', 'stats'],
    queryFn: ({ signal }) => donationsApi.getUserStats(signal),
    // ✅ BEST PRACTICE: Combine auth check with manual override
    enabled: isAuthenticated && manuallyEnabled,
    ...DONATION_QUERY_CONFIG,
  });
};
