/**
 * Favorite toggle — optimistic, offline-aware.
 *
 * Rewritten onto React Query's mutation lifecycle. It previously dispatched
 * `addFavoriteOptimistic`/`removeFavoriteOptimistic` into a Redux slice that
 * mirrored server data, so the same favorites existed in three places (Redux,
 * the React Query cache, and MMKV via redux-persist) and could disagree.
 *
 * The optimistic contract is unchanged:
 *   1. the heart flips before the request leaves      → onMutate
 *   2. it rolls back if the request fails             → onError + snapshot
 *   3. a second toggle cannot race the first          → isPending
 *   4. offline toggles are queued, not sent           → offline branch below
 */

import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';

import { offlineWriteQueue } from '@/services/OfflineWriteQueue';
import { Logger } from '@/utils/logger';
import { offlineManager } from '@/utils/offlineManager';

import { favoritesService } from '../services';
import { FavoriteType } from '../types';

import { favoriteKeys } from './favoriteKeys';
import { useIsFavorite } from './useFavoriteIds';

/**
 * Applies a toggle to the cached id list, returning a new array (never
 * mutating). An array rather than a Set because this value is persisted to disk
 * as JSON — see useFavoriteIds.
 */
function patchIds(current: readonly string[] | undefined, itemId: string): string[] {
  const ids = current ?? [];
  return ids.includes(itemId) ? ids.filter(id => id !== itemId) : [...ids, itemId];
}

export const useFavoriteToggle = (offerId: string, offerName?: string, offerImage?: string) => {
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const { t } = useTranslation();

  const isFavorite = useIsFavorite(offerId);

  const mutation = useMutation({
    mutationFn: async () => {
      await favoritesService.toggleFavorite(FavoriteType.OFFER, offerId, offerName, offerImage);
    },

    onMutate: async () => {
      // Stop an in-flight refetch from landing after the patch and undoing it.
      await queryClient.cancelQueries({ queryKey: favoriteKeys.ids() });

      const previous = queryClient.getQueryData<readonly string[]>(favoriteKeys.ids());
      queryClient.setQueryData<readonly string[]>(favoriteKeys.ids(), current =>
        patchIds(current, offerId),
      );

      return { previous };
    },

    onError: (error, _vars, context) => {
      Logger.error('Favorite toggle failed, rolling back', { offerId }, error as Error);

      // Restore the exact snapshot rather than re-toggling: a plain re-toggle
      // would be wrong if anything else changed the set meanwhile.
      if (context?.previous !== undefined) {
        queryClient.setQueryData(favoriteKeys.ids(), context.previous);
      }

      Toast.show({
        type: 'error',
        text1: t('favorites.failedToUpdate'),
        text2: t('favorites.checkConnection'),
        visibilityTime: 4000,
      });
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
    },
  });

  const { isPending, mutateAsync } = mutation;

  const toggle = useCallback(async () => {
    if (isPending) {
      Logger.warn('Toggle already in progress', { offerId });
      return;
    }

    const wasFavorite = isFavorite;

    // Offline: patch the cache so the UI is truthful about the user's intent,
    // and hand the write to the queue. The request is never attempted, so the
    // mutation is deliberately not used on this path.
    if (offlineManager.isOffline()) {
      queryClient.setQueryData<readonly string[]>(favoriteKeys.ids(), current =>
        patchIds(current, offerId),
      );

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
        text1: wasFavorite ? t('favorites.removedFromFavorites') : t('favorites.addedToFavorites'),
        text2: t('favorites.willSyncOnline'),
        visibilityTime: 3000,
      });

      return;
    }

    try {
      await mutateAsync();
    } catch {
      // onError has already rolled back and told the user; mutateAsync rethrows
      // by design and there is nothing further for the caller to do.
      return;
    }

    if (!wasFavorite) {
      Toast.show({
        type: 'success',
        text1: t('favorites.addedToFavorites'),
        text2: t('favorites.savedTapToView', { name: offerName ?? 'Offer' }),
        visibilityTime: 4000,
        onPress: () => {
          Toast.hide();
          navigation.dispatch({
            type: 'NAVIGATE' as const,
            payload: { name: 'MainTabs', params: { screen: 'Favorites' } },
          });
        },
      });
    }
  }, [
    isPending,
    mutateAsync,
    queryClient,
    navigation,
    offerId,
    offerName,
    offerImage,
    isFavorite,
    t,
  ]);

  return {
    isFavorite,
    toggle,
    isLoading: isPending,
  };
};
