/**
 * useFavorites Hook
 * React hook for managing favorites with TanStack Query + Redux
 *
 * Features:
 * - Server state sync with TanStack Query
 * - Local state management with Redux
 * - Optimistic updates for instant feedback
 * - Automatic refetch on focus
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useSelector } from 'react-redux';

import { selectIsFavorite, selectFavoritesState } from '@/store/slices/favoritesSlice';

import { favoritesService } from '../services';
import { FavoriteType } from '../types';

import type { FavoritesFilterRequest } from '../types';
import type { RootState } from '@/store';

/**
 * Query keys for favorites
 */
export const favoritesKeys = {
  all: ['favorites'] as const,
  lists: () => [...favoritesKeys.all, 'list'] as const,
  list: (filters?: FavoritesFilterRequest) => [...favoritesKeys.lists(), filters] as const,
  stats: () => [...favoritesKeys.all, 'stats'] as const,
  check: (type: FavoriteType, itemId: string) =>
    [...favoritesKeys.all, 'check', type, itemId] as const,
};

/**
 * Hook to get user's favorites list
 */
export const useFavoritesList = (filters?: FavoritesFilterRequest) => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  return useQuery({
    queryKey: favoritesKeys.list(filters),
    queryFn: async () => {
      try {
        return await favoritesService.getFavorites(filters);
      } catch (error) {
        console.error('[useFavoritesList] Failed to fetch favorites', error);
        // Return empty result on error
        return {
          favorites: [],
          total: 0,
          page: filters?.page != null || 1,
          limit: filters?.limit != null || 20,
          totalPages: 0,
        };
      }
    },
    enabled: isAuthenticated, // Only fetch if authenticated
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });
};

/**
 * Hook to get favorites statistics
 */
export const useFavoritesStats = () =>
  useQuery({
    queryKey: favoritesKeys.stats(),
    queryFn: () => favoritesService.getFavoriteStats(),
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });

/**
 * Hook to check if an item is favorited
 */
export const useIsFavorite = (type: FavoriteType, itemId: string) => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  // Get from Redux for instant feedback
  const isFavoriteRedux = useSelector((state: RootState) => selectIsFavorite(state, itemId));

  // Sync with server (only if authenticated)
  const { data } = useQuery({
    queryKey: favoritesKeys.check(type, itemId),
    queryFn: async () => {
      try {
        return await favoritesService.checkIsFavorite(type, itemId);
      } catch (error) {
        // Fallback to Redux state if API fails
        console.warn('[useIsFavorite] API check failed, using local state', error);
        return isFavoriteRedux;
      }
    },
    enabled: isAuthenticated, // Only run if authenticated
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
    initialData: isFavoriteRedux,
  });

  return data ?? isFavoriteRedux;
};

/**
 * Hook to toggle favorite status with optimistic updates
 */
export const useToggleFavorite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      type,
      itemId,
      itemName,
      itemImage,
    }: {
      type: FavoriteType;
      itemId: string;
      itemName?: string | undefined;
      itemImage?: string | undefined;
    }) =>
      // Server request (optimistic update handled by component)
      favoritesService.toggleFavorite(type, itemId, itemName, itemImage),
    onSuccess: (_isFavorite, variables) => {
      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: favoritesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: favoritesKeys.stats() });
      queryClient.invalidateQueries({
        queryKey: favoritesKeys.check(variables.type, variables.itemId),
      });
    },
  });
};

/**
 * Convenience hook for managing offer favorites
 */
export const useOfferFavorite = (
  offerId: string,
  offerName?: string | undefined,
  offerImage?: string | undefined,
) => {
  const isFavorite = useIsFavorite(FavoriteType.OFFER, offerId);
  const toggleMutation = useToggleFavorite();

  const toggle = useCallback(() => {
    toggleMutation.mutate({
      type: FavoriteType.OFFER,
      itemId: offerId,
      itemName: offerName ?? undefined,
      itemImage: offerImage ?? undefined,
    });
  }, [offerId, offerName, offerImage, toggleMutation]);

  return {
    isFavorite,
    toggle,
    isLoading: toggleMutation.isPending,
    error: toggleMutation.error,
  };
};

/**
 * Hook to get favorites state from Redux
 */
export const useFavoritesReduxState = () => useSelector(selectFavoritesState);
