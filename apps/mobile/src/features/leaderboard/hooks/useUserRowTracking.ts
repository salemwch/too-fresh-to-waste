/**
 * Tracks whether the current user's row is on screen, and drives the floating
 * position bar and the neighbourhood section from that.
 *
 * `hasReportedViewability` is state, not a ref, and that matters. The bar is
 * shown when the user's row is *off* screen — which is precisely the case where
 * `setUserRowVisible(false)` matches the existing state, React bails out of
 * re-rendering, and a ref flipped in the same callback would never be re-read.
 * The bar would simply never appear. See the regression test.
 */

import { useCallback, useMemo, useRef, useState } from 'react';

import { useNeighborhood } from './useNeighborhood';

import type { LeaderboardEntry } from '../types/leaderboard.types';
import type { FlashList, ViewToken } from '@shopify/flash-list';

/** A row counts as visible once half of it is on screen. */
const VISIBILITY_THRESHOLD_PERCENT = 50;

interface UseUserRowTrackingParams {
  allEntries: LeaderboardEntry[];
  userEntry: LeaderboardEntry | null;
  isLoading: boolean;
}

export interface UserRowTracking {
  listRef: React.RefObject<FlashList<LeaderboardEntry> | null>;
  /** Show the floating position bar. */
  showFloatingBar: boolean;
  /** The user's own row is among the loaded pages. */
  userIsInList: boolean;
  /** The nearby-ranks section is expanded and applicable. */
  neighborhoodEnabled: boolean;
  neighborhoodEntries: ReturnType<typeof useNeighborhood>['data'];
  neighborhoodLoading: boolean;
  onViewableItemsChanged: (info: { viewableItems: ViewToken[] }) => void;
  viewabilityConfig: { itemVisiblePercentThreshold: number };
  /** Scrolls to the user's row, or toggles the neighbourhood view. */
  handleFloatingBarPress: () => void;
}

export function useUserRowTracking({
  allEntries,
  userEntry,
  isLoading,
}: UseUserRowTrackingParams): UserRowTracking {
  const listRef = useRef<FlashList<LeaderboardEntry>>(null);
  const [userRowVisible, setUserRowVisible] = useState(false);
  const [showNeighborhood, setShowNeighborhood] = useState(false);
  const [hasReportedViewability, setHasReportedViewability] = useState(false);

  const userIsInList = useMemo(() => allEntries.some(e => e.isCurrentUser), [allEntries]);

  // Nearby ranks answer "where am I?" for someone whose row is not on the
  // leaderboard at all. Gated on presence in the list rather than on a rank
  // threshold: only a few pages are loaded, so plenty of low-numbered ranks are
  // absent too, and they need the same answer.
  const neighborhoodEnabled = showNeighborhood && !userIsInList;
  const { data: neighborhood, isLoading: neighborhoodLoading } =
    useNeighborhood(neighborhoodEnabled);

  /*
   * Two different questions, depending on whether the row exists in the list.
   *
   *  in the list     — show the bar only once the row scrolls out of view, so it
   *                    does not sit on top of the row it describes. Waiting for
   *                    the first viewability report also stops it flashing on
   *                    mount before the list knows what is on screen.
   *  not in the list — the row can never be seen, so the bar is permanent. It is
   *                    the only way these users learn their rank, and gating it
   *                    on viewability hid it from them entirely: viewability is
   *                    not even wired when the row is absent.
   */
  const showFloatingBar =
    userEntry != null &&
    !isLoading &&
    (!userIsInList || (hasReportedViewability && !userRowVisible));

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      setHasReportedViewability(true);
      setUserRowVisible(
        viewableItems.some(token => (token.item as LeaderboardEntry | undefined)?.isCurrentUser),
      );
    },
    [],
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: VISIBILITY_THRESHOLD_PERCENT,
  }).current;

  // In the list: jump to the row. Not in it: there is nothing to jump to, so
  // open the nearby ranks instead.
  const handleFloatingBarPress = useCallback(() => {
    if (userIsInList) {
      const index = allEntries.findIndex(e => e.isCurrentUser);
      if (index >= 0) listRef.current?.scrollToIndex({ index, animated: true });
      return;
    }
    setShowNeighborhood(prev => !prev);
  }, [userIsInList, allEntries]);

  return {
    listRef,
    showFloatingBar,
    userIsInList,
    neighborhoodEnabled,
    neighborhoodEntries: neighborhood,
    neighborhoodLoading,
    onViewableItemsChanged,
    viewabilityConfig,
    handleFloatingBarPress,
  };
}
