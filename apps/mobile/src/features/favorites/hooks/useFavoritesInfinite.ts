/**
 * Infinite Scroll Hook for Favorites List
 *
 * Uses TanStack Query's useInfiniteQuery for paginated favorites.
 * Loads 20 items at a time with automatic pagination.
 *
 * Features:
 * - Infinite scroll with automatic page loading
 * - Pull-to-refresh support
 * - Automatic cache invalidation
 * - Optimized for performance
 *
 * Usage:
 * ```tsx
 * const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useFavoritesInfinite();
 * const favorites = data?.pages.flatMap(page => page.favorites) ?? [];
 * ```
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';

import { favoritesService } from '../services';

import type { FavoritesFilterRequest, FavoritesResponse } from '../types';
import type { RootState } from '@/store';

/**
 * Infinite scroll hook for favorites list
 *
 * @param filters - Optional filters (type, isActive, etc.)
 * @returns TanStack Query infinite query result
 */
export const useFavoritesInfinite = (filters?: Omit<FavoritesFilterRequest, 'page' | 'limit'>) => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  console.log('🔄 useFavoritesInfinite hook initialized', {
    filters,
    isAuthenticated,
    queryKey: ['favorites', 'infinite', filters],
  });

  return useInfiniteQuery<FavoritesResponse, Error>({
    queryKey: ['favorites', 'infinite', filters],
    queryFn: async ({ pageParam }) => {
      console.log('🔄 Fetching favorites page:', {
        pageParam,
        filters,
        limit: 20,
      });

      const response = await favoritesService.getFavorites({
        ...filters,
        page: pageParam as number,
        limit: 20, // Fetch 20 items per page
      });

      console.log('✅ useFavoritesInfinite queryFn result:', {
        favoritesCount: response.favorites.length,
        total: response.total,
        page: response.page,
        totalPages: response.totalPages,
      });

      return response;
    },
    getNextPageParam: lastPage => {
      // Return next page number if there are more pages
      const currentPage = lastPage.page || 1;
      const totalPages = lastPage.totalPages || 1;

      if (currentPage < totalPages) {
        return currentPage + 1;
      }
      return undefined; // No more pages
    },
    enabled: isAuthenticated, // Only run when user is logged in
    initialPageParam: 1,
    staleTime: 30000, // Consider data stale after 30 seconds
    gcTime: 300000, // Cache for 5 minutes (formerly cacheTime)
  });
};
