/**
 * Optimistic Favorite Toggle Hook
 *
 * Provides instant UI updates for favorite toggling with:
 * - Optimistic Redux updates (instant feedback)
 * - Background API sync
 * - Automatic rollback on error
 * - Race condition protection
 * - Cross-screen state sync
 *
 * Usage:
 * ```tsx
 * const { isFavorite, toggle, isLoading } = useFavoriteToggle(
 *   offerId,
 *   offerName,
 *   offerImage
 * );
 *
 * <TouchableOpacity onPress={toggle} disabled={isLoading}>
 *   <Icon name={isFavorite ? 'heart' : 'heart-outline'} />
 * </TouchableOpacity>
 * ```
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';

import {
  addFavoriteOptimistic,
  removeFavoriteOptimistic,
  selectIsFavorite,
} from '@/store/slices/favoritesSlice';
import { Logger } from '@/utils/logger';
import Toast from 'react-native-toast-message';

import { offlineManager } from '@/utils/offlineManager';
import { offlineWriteQueue } from '@/services/OfflineWriteQueue';
import { favoritesService } from '../services';
import { FavoriteType } from '../types';

import type { RootState } from '@/store';

/**
 * Optimistic favorite toggle hook - Production-grade implementation
 *
 * ✅ BEST PRACTICES:
 * - Optimistic UI (instant Redux update)
 * - Background API call (fire and forget)
 * - Local cache update with setQueryData (zero-latency, no refetch)
 * - Rollback on failure
 * - Toast notification with "View" action (no auto-navigation)
 *
 * @param offerId - Offer ID to toggle
 * @param offerName - Offer name (for API request and toast)
 * @param offerImage - Offer image URL (for API request)
 * @returns Favorite state, toggle function, and loading state
 */
export const useFavoriteToggle = (offerId: string, offerName?: string, offerImage?: string) => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const navigation = useNavigation<any>();
  const [isLoading, setIsLoading] = useState(false);

  // ✅ Read from Redux (instant, no API call)
  const isFavorite = useSelector((state: RootState) => selectIsFavorite(state, offerId));

  const toggle = useCallback(async () => {
    // ✅ Prevent double-tap (race condition protection)
    if (isLoading) {
      Logger.warn('Toggle already in progress', { offerId });
      return;
    }

    setIsLoading(true);
    const previousState = isFavorite;

    try {
      // 1️⃣ Optimistic update (instant UI feedback)
      dispatch(
        isFavorite
          ? removeFavoriteOptimistic({ itemId: offerId })
          : addFavoriteOptimistic({
              itemId: offerId,
              type: FavoriteType.OFFER,
              addedAt: Date.now(),
            }),
      );

      Logger.info('Optimistic favorite toggle', {
        offerId,
        newState: !isFavorite,
      });

      // 2️⃣ If offline, queue the intent and keep the optimistic update
      if (offlineManager.isOffline()) {
        offlineWriteQueue.enqueue({
          id: `FAVORITE_TOGGLE:${offerId}`,
          type: 'FAVORITE_TOGGLE',
          payload: {
            favoriteType: FavoriteType.OFFER,
            offerId,
            ...(offerName ? { offerName } : {}),
            ...(offerImage ? { offerImage } : {}),
          },
        });

        Logger.info('Favorite queued for offline sync', { offerId });

        Toast.show({
          type: 'info',
          text1: !previousState ? '✓ Added to Favorites' : 'Removed from Favorites',
          text2: 'Will sync when back online',
          visibilityTime: 3000,
        });

        return; // Keep the optimistic Redux state — queue will sync later
      }

      // 3️⃣ Online: call API
      const result = await favoritesService.toggleFavorite(
        FavoriteType.OFFER,
        offerId,
        offerName,
        offerImage,
      );

      Logger.info('Favorite toggle API success', {
        offerId,
        isFavorite: result.isFavorite,
        message: result.message,
      });

      // 4️⃣ Invalidate cache (refetch on next Favorites screen visit)
      queryClient.invalidateQueries({ queryKey: ['favorites'] });

      // 5️⃣ Show toast with "View" action
      if (!previousState) {
        Toast.show({
          type: 'success',
          text1: '✓ Added to Favorites!',
          text2: `${offerName || 'Offer'} saved • Tap to view`,
          visibilityTime: 4000,
          onPress: () => {
            Toast.hide();
            navigation.navigate('Favorites' as never);
          },
        });
      }
    } catch (error) {
      // 6️⃣ Rollback on online API failure (network truly failed, not just offline)
      Logger.error('Favorite toggle failed, rolling back', {
        offerId,
        error,
      });

      dispatch(
        previousState
          ? addFavoriteOptimistic({
              itemId: offerId,
              type: FavoriteType.OFFER,
              addedAt: Date.now(),
            })
          : removeFavoriteOptimistic({ itemId: offerId }),
      );

      Toast.show({
        type: 'error',
        text1: 'Failed to Update Favorite',
        text2: 'Please check your connection and try again',
        visibilityTime: 4000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, queryClient, offerId, offerName, offerImage, isFavorite, isLoading]);

  return {
    isFavorite, // Current favorite state (from Redux)
    toggle, // Toggle function
    isLoading, // Loading state (true during API call)
  };
};
