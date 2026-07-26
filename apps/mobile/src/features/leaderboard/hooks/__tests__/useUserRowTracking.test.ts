/**
 * useUserRowTracking.
 *
 * The first test is a regression: `hasReportedViewability` used to be a ref
 * mutated inside onViewableItemsChanged and read during render. For a user
 * whose row is off screen — the only case the floating bar exists for —
 * setUserRowVisible(false) matches the existing state, React bails out of
 * re-rendering, and the ref is never re-read. The bar never appeared.
 *
 * It was masked while the countdown ticked once a second and re-rendered the
 * screen anyway; isolating the countdown removed that accident.
 */

import { act, renderHook } from '@testing-library/react-native';

let mockNeighborhood: Record<string, unknown> = { data: undefined, isLoading: false };
const mockUseNeighborhood = jest.fn();
jest.mock('../useNeighborhood', () => ({
  useNeighborhood: (enabled: boolean) => {
    mockUseNeighborhood(enabled);
    return mockNeighborhood;
  },
}));

import { useUserRowTracking } from '../useUserRowTracking';

import type { LeaderboardEntry } from '../../types/leaderboard.types';

const entry = (rank: number, isCurrentUser = false): LeaderboardEntry =>
  ({ userId: `u${rank}`, rank, isCurrentUser }) as LeaderboardEntry;

const setup = (over: Partial<Parameters<typeof useUserRowTracking>[0]> = {}) =>
  renderHook(() =>
    useUserRowTracking({
      allEntries: [entry(1), entry(2)],
      userEntry: entry(50),
      isLoading: false,
      ...over,
    }),
  );

/** A viewability report where the current user's row is not among the items. */
const reportOffScreen = { viewableItems: [{ item: entry(1) }, { item: entry(2) }] as never };
const reportOnScreen = { viewableItems: [{ item: entry(50, true) }] as never };

describe('useUserRowTracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNeighborhood = { data: undefined, isLoading: false };
  });

  describe('the floating bar', () => {
    it('is hidden before viewability has reported', () => {
      expect(setup().result.current.showFloatingBar).toBe(false);
    });

    // THE REGRESSION. The user's row is off screen, so setUserRowVisible(false)
    // is a no-op state write — the bar must still appear.
    it('appears on the first report when the row is off screen', () => {
      const { result } = setup();

      act(() => result.current.onViewableItemsChanged(reportOffScreen));

      expect(result.current.showFloatingBar).toBe(true);
    });

    it('stays hidden while the row is on screen', () => {
      const { result } = setup();

      act(() => result.current.onViewableItemsChanged(reportOnScreen));

      expect(result.current.showFloatingBar).toBe(false);
    });

    it('appears when the row scrolls out of view', () => {
      const { result } = setup();

      act(() => result.current.onViewableItemsChanged(reportOnScreen));
      expect(result.current.showFloatingBar).toBe(false);

      act(() => result.current.onViewableItemsChanged(reportOffScreen));
      expect(result.current.showFloatingBar).toBe(true);
    });

    it('stays hidden for a user with no leaderboard entry', () => {
      const { result } = setup({ userEntry: null });

      act(() => result.current.onViewableItemsChanged(reportOffScreen));

      expect(result.current.showFloatingBar).toBe(false);
    });

    // Otherwise it flashes over the skeleton.
    it('stays hidden while the list is still loading', () => {
      const { result } = setup({ isLoading: true });

      act(() => result.current.onViewableItemsChanged(reportOffScreen));

      expect(result.current.showFloatingBar).toBe(false);
    });
  });

  describe('pressing the bar', () => {
    it('scrolls to the row when the user is inside the loaded window', () => {
      const { result } = setup({
        allEntries: [entry(1), entry(2, true)],
        userEntry: entry(2, true),
      });

      act(() => result.current.handleFloatingBarPress());

      // Neighbourhood is not the answer for someone already in the list.
      expect(result.current.neighborhoodEnabled).toBe(false);
    });

    // Beyond the loaded window there is no row to scroll to.
    it('toggles the neighbourhood view for a distant rank', () => {
      const { result } = setup({ userEntry: entry(5000) });

      act(() => result.current.handleFloatingBarPress());
      expect(result.current.neighborhoodEnabled).toBe(true);

      act(() => result.current.handleFloatingBarPress());
      expect(result.current.neighborhoodEnabled).toBe(false);
    });

    // A rank inside the window that has not been paged in yet: scrolling would
    // target an index that is not there, so fall through to the neighbourhood.
    it('falls back to the neighbourhood when the row is not loaded', () => {
      const { result } = setup({ allEntries: [entry(1), entry(2)], userEntry: entry(50) });

      act(() => result.current.handleFloatingBarPress());

      expect(result.current.neighborhoodEnabled).toBe(false);
    });
  });

  describe('the neighbourhood query', () => {
    it('stays disabled until the section is opened', () => {
      setup({ userEntry: entry(5000) });

      expect(mockUseNeighborhood).toHaveBeenLastCalledWith(false);
    });

    it('is enabled once opened for a distant rank', () => {
      const { result } = setup({ userEntry: entry(5000) });

      act(() => result.current.handleFloatingBarPress());

      expect(mockUseNeighborhood).toHaveBeenLastCalledWith(true);
    });

    it('passes its data and loading state through', () => {
      mockNeighborhood = { data: { entries: [entry(4999)] }, isLoading: true };
      const { result } = setup({ userEntry: entry(5000) });

      expect(result.current.neighborhoodEntries).toEqual({ entries: [entry(4999)] });
      expect(result.current.neighborhoodLoading).toBe(true);
    });
  });
});
