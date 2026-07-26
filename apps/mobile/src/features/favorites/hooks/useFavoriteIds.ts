/**
 * Favorite ids — the single source of truth for "is this offer favorited?".
 *
 * Replaces `favoritesSlice.favoriteMap`, which mirrored this same server data
 * into Redux and persisted a third copy to MMKV. Server data belongs to React
 * Query; Redux keeps client state only.
 *
 * Shape and cost
 * --------------
 * One query holds the whole id set and every card reads from it. A query per
 * card would mean N requests and N subscriptions for a list that renders dozens
 * of cards.
 *
 * The cached value is a plain `string[]`, not a `Set`: the query cache is
 * serialised with JSON.stringify to survive a cold start, and a Set stringifies
 * to `{}` — the favourites would silently come back empty on every relaunch.
 * The Set is derived instead, memoised per array identity so all cards share
 * one instance (see `idSetFor`).
 *
 * `useIsFavorite` returns a boolean, so a card re-renders only when *its own*
 * flag flips rather than whenever any favourite anywhere changes — matching
 * what the memoized `createSelector` gave us before.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAppSelector } from '@/hooks/redux';
import { Freshness } from '@/lib/react-query/freshness';
import { isAuthReadyForApiCalls } from '@/utils/tokenValidator';

import { favoritesService } from '../services';

import { favoriteKeys } from './favoriteKeys';

const NO_IDS: readonly string[] = [];

/**
 * Array → Set, memoised on the array's identity.
 *
 * A WeakMap rather than a hook: every card asks the same question about the
 * same array, and building one Set per card per render would undo the point of
 * using a Set at all. Entries drop out on their own once React Query replaces
 * the array.
 */
const setCache = new WeakMap<readonly string[], ReadonlySet<string>>();

function idSetFor(ids: readonly string[]): ReadonlySet<string> {
  const cached = setCache.get(ids);
  if (cached) return cached;

  const built: ReadonlySet<string> = new Set(ids);
  setCache.set(ids, built);
  return built;
}

/**
 * The full list of favorited item ids.
 *
 * Gated on auth readiness for the same reason the old `syncAllFavorites` thunk
 * rejected rather than fulfilled when tokens were not ready: firing this while
 * the session is mid-refresh returns 401, and a fulfilled-with-empty result
 * would replace a good id set with nothing. When `enabled` is false the query
 * does not run and existing data stays put.
 */
export function useFavoriteIds(): UseQueryResult<readonly string[]> {
  const authState = useAppSelector(state => state.auth);
  const { isReady } = isAuthReadyForApiCalls(authState);

  return useQuery({
    queryKey: favoriteKeys.ids(),
    queryFn: async (): Promise<readonly string[]> => {
      const { ids } = await favoritesService.getFavoriteIds();
      return ids;
    },
    enabled: isReady,
    // Favourites change only through this device's own toggles, which patch the
    // cache directly, so background refetching adds requests without adding
    // information.
    staleTime: Freshness.LONG,
  });
}

/** Whether a single offer is favorited. */
export function useIsFavorite(itemId: string): boolean {
  const { data } = useFavoriteIds();
  const ids = data ?? NO_IDS;

  return useMemo(() => idSetFor(ids).has(itemId), [ids, itemId]);
}
