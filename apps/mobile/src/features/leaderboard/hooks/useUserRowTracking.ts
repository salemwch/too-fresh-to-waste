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

/**
 * Ranks beyond this are outside the loaded window, so the bar offers the
 * neighbourhood view instead of scrolling to a row that is not there.
 */
const LOADED_WINDOW_MAX_RANK = 200;

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
  /** The neighbourhood section is expanded and applicable. */
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
  const userRankWithin200 = userEntry != null && userEntry.rank <= LOADED_WINDOW_MAX_RANK;

  // Only meaningful for users outside the loaded window — anyone within it is
  // already in the list above. Gates both the query and the section.
  const neighborhoodEnabled = showNeighborhood && !userRankWithin200;
  const { data: neighborhood, isLoading: neighborhoodLoading } =
    useNeighborhood(neighborhoodEnabled);

  // Withheld until viewability has reported at least once, so the bar does not
  // flash on mount before the list knows what is on screen.
  const showFloatingBar =
    userEntry != null && !userRowVisible && !isLoading && hasReportedViewability;

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

  const handleFloatingBarPress = useCallback(() => {
    if (userRankWithin200 && userIsInList) {
      const index = allEntries.findIndex(e => e.isCurrentUser);
      if (index >= 0) listRef.current?.scrollToIndex({ index, animated: true });
      return;
    }
    setShowNeighborhood(prev => !prev);
  }, [userRankWithin200, userIsInList, allEntries]);

  return {
    listRef,
    showFloatingBar,
    neighborhoodEnabled,
    neighborhoodEntries: neighborhood,
    neighborhoodLoading,
    onViewableItemsChanged,
    viewabilityConfig,
    handleFloatingBarPress,
  };
}
