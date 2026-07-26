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

/**
 * Default fixture: the user's row IS in the loaded list, so the bar is
 * viewability-driven. Tests for an absent row override allEntries as well.
 */
const setup = (over: Partial<Parameters<typeof useUserRowTracking>[0]> = {}) =>
  renderHook(() =>
    useUserRowTracking({
      allEntries: [entry(1), entry(50, true)],
      userEntry: entry(50, true),
      isLoading: false,
      ...over,
    }),
  );

/** A viewability report where the current user's row is not among the items. */
const reportOffScreen = { viewableItems: [{ item: entry(1) }] as never };
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

  /*
   * Only a handful of pages are loaded, so most users are simply not on the
   * board. Their row can never scroll into view, viewability is not even wired
   * for them, and the bar is the only place they see their own rank — so it is
   * permanent rather than viewability-driven.
   */
  describe('when the row is not in the loaded list', () => {
    const distant = { allEntries: [entry(1), entry(2)], userEntry: entry(100_000) };

    it('shows the bar immediately, with no viewability report', () => {
      expect(setup(distant).result.current.showFloatingBar).toBe(true);
    });

    it('keeps the bar up after a report that does not contain the row', () => {
      const { result } = setup(distant);

      act(() => result.current.onViewableItemsChanged(reportOffScreen));

      expect(result.current.showFloatingBar).toBe(true);
    });

    it('still hides it while loading', () => {
      expect(setup({ ...distant, isLoading: true }).result.current.showFloatingBar).toBe(false);
    });

    it('reports that the row is absent so the screen can skip viewability', () => {
      expect(setup(distant).result.current.userIsInList).toBe(false);
      expect(
        setup({ allEntries: [entry(1, true)], userEntry: entry(1, true) }).result.current
          .userIsInList,
      ).toBe(true);
    });
  });

  describe('pressing the bar', () => {
    it('scrolls to the row rather than opening nearby ranks when it is loaded', () => {
      const { result } = setup({
        allEntries: [entry(1), entry(2, true)],
        userEntry: entry(2, true),
      });

      act(() => result.current.handleFloatingBarPress());

      // Nearby ranks are not the answer for someone already on screen.
      expect(result.current.neighborhoodEnabled).toBe(false);
    });

    it('toggles nearby ranks when the row is not in the list', () => {
      const { result } = setup({ allEntries: [entry(1), entry(2)], userEntry: entry(100_000) });

      act(() => result.current.handleFloatingBarPress());
      expect(result.current.neighborhoodEnabled).toBe(true);

      act(() => result.current.handleFloatingBarPress());
      expect(result.current.neighborhoodEnabled).toBe(false);
    });

    // Only a few pages are loaded, so a low rank can be absent too — and needs
    // the same answer as rank 100,000. Gating on rank left these users with a
    // bar that did nothing.
    it('offers nearby ranks for a low rank that has not been paged in yet', () => {
      const { result } = setup({ allEntries: [entry(1), entry(2)], userEntry: entry(60) });

      act(() => result.current.handleFloatingBarPress());

      expect(result.current.neighborhoodEnabled).toBe(true);
    });
  });

  /*
   * Failure and edge paths. Viewability payloads come from a native list and
   * the entry list changes underneath as pages load, so none of these shapes
   * can be assumed away.
   */
  describe('malformed or empty viewability payloads', () => {
    it('treats an empty report as "row not visible" rather than crashing', () => {
      const { result } = setup();

      expect(() =>
        act(() => result.current.onViewableItemsChanged({ viewableItems: [] })),
      ).not.toThrow();
      expect(result.current.showFloatingBar).toBe(true);
    });

    it('survives tokens with no item attached', () => {
      const { result } = setup();

      expect(() =>
        act(() =>
          result.current.onViewableItemsChanged({
            viewableItems: [{ item: undefined }, { item: null }] as never,
          }),
        ),
      ).not.toThrow();
      expect(result.current.showFloatingBar).toBe(true);
    });

    it('still finds the row when mixed with malformed tokens', () => {
      const { result } = setup();

      act(() =>
        result.current.onViewableItemsChanged({
          viewableItems: [{ item: null }, { item: entry(50, true) }] as never,
        }),
      );

      expect(result.current.showFloatingBar).toBe(false);
    });

    it('handles repeated identical reports idempotently', () => {
      const { result } = setup();

      act(() => result.current.onViewableItemsChanged(reportOffScreen));
      act(() => result.current.onViewableItemsChanged(reportOffScreen));
      act(() => result.current.onViewableItemsChanged(reportOffScreen));

      expect(result.current.showFloatingBar).toBe(true);
    });
  });

  describe('empty and shifting data', () => {
    it('shows no bar before any data has arrived', () => {
      const { result } = setup({ allEntries: [], userEntry: null });

      expect(result.current.showFloatingBar).toBe(false);
      expect(result.current.userIsInList).toBe(false);
    });

    // Ranked but nothing loaded yet: the bar is the only place they see it.
    it('shows the bar when ranked but the list is still empty', () => {
      const { result } = setup({ allEntries: [], userEntry: entry(100_000) });

      expect(result.current.showFloatingBar).toBe(true);
    });

    // Paging in the user's own row must flip the press behaviour from
    // "open nearby ranks" to "scroll to it".
    it('switches from nearby-ranks to scroll once the row is paged in', () => {
      const { result, rerender } = renderHook(
        (props: Parameters<typeof useUserRowTracking>[0]) => useUserRowTracking(props),
        {
          initialProps: {
            allEntries: [entry(1)],
            userEntry: entry(50, true),
            isLoading: false,
          },
        },
      );
      expect(result.current.userIsInList).toBe(false);

      rerender({
        allEntries: [entry(1), entry(50, true)],
        userEntry: entry(50, true),
        isLoading: false,
      });

      expect(result.current.userIsInList).toBe(true);
      act(() => result.current.handleFloatingBarPress());
      expect(result.current.neighborhoodEnabled).toBe(false);
    });
  });

  describe('pressing when scrolling cannot happen', () => {
    // The ref is null until FlashList mounts; a press in that window must not
    // throw, and must not silently open nearby ranks either.
    it('does not throw when the list ref is not attached', () => {
      const { result } = setup();

      expect(() => act(() => result.current.handleFloatingBarPress())).not.toThrow();
      expect(result.current.neighborhoodEnabled).toBe(false);
    });

    // userEntry says the user is ranked at 2 and a rank-2 row is loaded, but it
    // is not flagged isCurrentUser — so it is somebody else's row. Falling
    // through to nearby ranks is right; scrolling to a coincidental rank match
    // would highlight the wrong person.
    //
    // (The `index >= 0` guard inside the hook is unreachable by construction:
    // userIsInList and findIndex use the same predicate, so reaching the scroll
    // branch guarantees a hit. It stays as defence, not as a tested path.)
    it('opens nearby ranks when no loaded row is flagged as the user', () => {
      const { result } = setup({ allEntries: [entry(1), entry(2)], userEntry: entry(2) });

      expect(() => act(() => result.current.handleFloatingBarPress())).not.toThrow();
      expect(result.current.neighborhoodEnabled).toBe(true);
    });
  });

  describe('the neighbourhood query', () => {
    it('stays disabled until the section is opened', () => {
      setup({ allEntries: [entry(1), entry(2)], userEntry: entry(100_000) });

      expect(mockUseNeighborhood).toHaveBeenLastCalledWith(false);
    });

    it('is enabled once opened for a row outside the list', () => {
      const { result } = setup({ allEntries: [entry(1), entry(2)], userEntry: entry(100_000) });

      act(() => result.current.handleFloatingBarPress());

      expect(mockUseNeighborhood).toHaveBeenLastCalledWith(true);
    });

    it('passes its data and loading state through', () => {
      mockNeighborhood = { data: { entries: [entry(99_999)] }, isLoading: true };
      const { result } = setup({ allEntries: [entry(1), entry(2)], userEntry: entry(100_000) });

      expect(result.current.neighborhoodEntries).toEqual({ entries: [entry(99_999)] });
      expect(result.current.neighborhoodLoading).toBe(true);
    });
  });
});
