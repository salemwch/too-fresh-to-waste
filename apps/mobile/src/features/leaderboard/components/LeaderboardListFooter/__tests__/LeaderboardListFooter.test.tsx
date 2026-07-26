/**
 * LeaderboardListFooter — pagination control + optional neighbourhood section.
 *
 * The branching worth pinning is the spinner/button exclusivity: showing both,
 * or leaving the button live during a fetch, lets the user queue a second
 * request for the page already in flight.
 */

import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/design-system/components/atoms', () => ({ Icon: () => null }));

jest.mock('../../NeighborhoodSection', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react');
  const mockRN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    NeighborhoodSection: ({ isLoading }: { isLoading: boolean }) =>
      mockReact.createElement(mockRN.Text, null, `neighborhood:${String(isLoading)}`),
  };
});

import { LeaderboardListFooter } from '../LeaderboardListFooter';

const NO_ENTRIES: never[] = [];

const defaults = {
  isFetchingNextPage: false,
  hasNextPage: false,
  onViewMore: jest.fn(),
  showNeighborhood: false,
  neighborhoodEntries: NO_ENTRIES,
  neighborhoodLoading: false,
};

const setup = (over: Partial<React.ComponentProps<typeof LeaderboardListFooter>> = {}) =>
  render(<LeaderboardListFooter {...defaults} {...over} />);

// Resolved through the real i18next instance in jest.setup.js — asserting on
// the English string also proves the key exists, since a missing one would
// come back as 'leaderboard.viewMore'.
const VIEW_MORE = 'View More';

describe('LeaderboardListFooter', () => {
  beforeEach(() => jest.clearAllMocks());

  // No footer at all rather than an empty wrapper below the list.
  it('renders nothing when there is nothing to show', () => {
    expect(setup().toJSON()).toBeNull();
  });

  describe('pagination', () => {
    it('offers "view more" when another page exists', () => {
      expect(setup({ hasNextPage: true }).getByText(VIEW_MORE)).toBeTruthy();
    });

    // Otherwise a second tap queues a duplicate request for the same page.
    it('replaces the button with a spinner while fetching', () => {
      const { queryByText, toJSON } = setup({ hasNextPage: true, isFetchingNextPage: true });

      expect(queryByText(VIEW_MORE)).toBeNull();
      expect(toJSON()).not.toBeNull();
    });

    it('shows the spinner even on the last page fetch', () => {
      expect(setup({ hasNextPage: false, isFetchingNextPage: true }).toJSON()).not.toBeNull();
    });

    it('calls onViewMore when tapped', () => {
      const onViewMore = jest.fn();
      const { getByText } = setup({ hasNextPage: true, onViewMore });

      fireEvent.press(getByText(VIEW_MORE));

      expect(onViewMore).toHaveBeenCalledTimes(1);
    });
  });

  describe('neighbourhood section', () => {
    it('is hidden by default', () => {
      expect(setup({ hasNextPage: true }).queryByText(/^neighborhood:/)).toBeNull();
    });

    it('renders when expanded, even with no pagination', () => {
      expect(setup({ showNeighborhood: true }).getByText('neighborhood:false')).toBeTruthy();
    });

    it('passes its loading state through', () => {
      const { getByText } = setup({ showNeighborhood: true, neighborhoodLoading: true });

      expect(getByText('neighborhood:true')).toBeTruthy();
    });

    it('renders alongside the pagination control', () => {
      const { getByText } = setup({ hasNextPage: true, showNeighborhood: true });

      expect(getByText(VIEW_MORE)).toBeTruthy();
      expect(getByText('neighborhood:false')).toBeTruthy();
    });
  });

  it('is memoised so list scrolling does not rebuild it', () => {
    expect(LeaderboardListFooter.displayName).toBe('LeaderboardListFooter');
  });
});
