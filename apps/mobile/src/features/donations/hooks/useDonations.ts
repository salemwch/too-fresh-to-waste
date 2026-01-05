/**
 * Donation Hooks
 * React Query hooks for donation data fetching with caching and error handling
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { donationsApi } from '../services/donationsApi';
import { DonationStats, UserDonationStats } from '../../../types/donations';

/**
 * Hook to fetch current donation pool statistics
 * Cached for 5 minutes to reduce API calls
 */
export const useDonationStats = (): UseQueryResult<DonationStats, Error> => {
  return useQuery<DonationStats, Error>({
    queryKey: ['donations', 'stats'],
    queryFn: donationsApi.getCurrentStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime in v4)
    retry: 2,
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook to fetch user-specific donation statistics
 * Requires authentication
 */
export const useUserDonationStats = (
  enabled: boolean = true,
): UseQueryResult<UserDonationStats, Error> => {
  return useQuery<UserDonationStats, Error>({
    queryKey: ['donations', 'user', 'stats'],
    queryFn: donationsApi.getUserStats,
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime in v4)
    retry: 2,
  });
};
