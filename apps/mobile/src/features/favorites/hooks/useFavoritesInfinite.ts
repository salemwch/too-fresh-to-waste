/**
 * Infinite Scroll Hook for Favorites List
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';

import { Freshness } from '@/lib/react-query/freshness';
import { Logger } from '@/utils/logger';

import { favoritesService } from '../services';

import type { FavoritesFilterRequest, FavoritesResponse } from '../types';
import type { RootState } from '@/store';

export const useFavoritesInfinite = (filters?: Omit<FavoritesFilterRequest, 'page' | 'limit'>) => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  Logger.debug('[useFavoritesInfinite] Hook initialized', {
    filters,
    isAuthenticated,
    queryKey: ['favorites', 'infinite', filters],
  });

  return useInfiniteQuery<FavoritesResponse, Error>({
    queryKey: ['favorites', 'infinite', filters],
    queryFn: async ({ pageParam }) => {
      Logger.debug('[useFavoritesInfinite] Fetching favorites page', {
        pageParam,
        filters,
        limit: 20,
      });

      const response = await favoritesService.getFavorites({
        ...filters,
        page: pageParam as number,
        limit: 20,
      });

      Logger.debug('[useFavoritesInfinite] Query result received', {
        favoritesCount: response.favorites.length,
        total: response.total,
        page: response.page,
        totalPages: response.totalPages,
      });

      return response;
    },
    getNextPageParam: lastPage => {
      const currentPage = lastPage.page || 1;
      const totalPages = lastPage.totalPages || 1;

      if (currentPage < totalPages) {
        return currentPage + 1;
      }

      return undefined;
    },
    enabled: isAuthenticated,
    initialPageParam: 1,
    staleTime: Freshness.LIVE,
    gcTime: 300000,
  });
};
