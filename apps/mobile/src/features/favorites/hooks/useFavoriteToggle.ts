/**
 * Optimistic Favorite Toggle Hook
 *
 * Provides instant UI updates for favorite toggling with:
 * - Optimistic Redux updates
 * - Background API sync
 * - Automatic rollback on error
 * - Race condition protection
 * - Cross-screen state sync
 */

import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import Toast from 'react-native-toast-message';
import { useDispatch, useSelector } from 'react-redux';

import { offlineWriteQueue } from '@/services/OfflineWriteQueue';
import {
  addFavoriteOptimistic,
  removeFavoriteOptimistic,
  selectIsFavorite,
} from '@/store/slices/favoritesSlice';
import { Logger } from '@/utils/logger';
import { offlineManager } from '@/utils/offlineManager';

import { favoritesService } from '../services';
import { FavoriteType } from '../types';

import type { TabNavigationProp } from '@/navigation/types';
import type { RootState } from '@/store';

export const useFavoriteToggle = (offerId: string, offerName?: string, offerImage?: string) => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const navigation = useNavigation<TabNavigationProp>();
  const [isLoading, setIsLoading] = useState(false);

  const isFavorite = useSelector((state: RootState) => selectIsFavorite(state, offerId));

  const toggle = useCallback(async () => {
    if (isLoading) {
      Logger.warn('Toggle already in progress', { offerId });
      return;
    }

    setIsLoading(true);
    const previousState = isFavorite;

    try {
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
          text1: !previousState ? 'Added to Favorites' : 'Removed from Favorites',
          text2: 'Will sync when back online',
          visibilityTime: 3000,
        });

        return;
      }

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

      void queryClient.invalidateQueries({ queryKey: ['favorites'] });

      if (!previousState) {
        Toast.show({
          type: 'success',
          text1: 'Added to Favorites',
          text2: `${offerName ?? 'Offer'} saved. Tap to view.`,
          visibilityTime: 4000,
          onPress: () => {
            Toast.hide();
            navigation.navigate('Favorites');
          },
        });
      }
    } catch (error) {
      Logger.error('Favorite toggle failed, rolling back', { offerId }, error as Error);

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
  }, [dispatch, navigation, queryClient, offerId, offerName, offerImage, isFavorite, isLoading]);

  return {
    isFavorite,
    toggle,
    isLoading,
  };
};
