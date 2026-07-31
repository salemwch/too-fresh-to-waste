/**
 * Donation Hooks
 * TanStack Query hooks for donation data fetching with caching and error handling
 */

import { useQuery } from '@tanstack/react-query';

import { donationsApi } from '../services/donationsApi';

import type { DonationStats } from '../../../types/donations';
import type { UseQueryResult } from '@tanstack/react-query';

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
