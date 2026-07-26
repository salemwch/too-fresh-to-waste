/**
 * PodiumTop5 — extracted from LeaderboardScreen, which had no tests.
 *
 * The logic worth pinning is the visual reordering: entries arrive ranked
 * 1..5 but render 5-3-1-2-4 so the champion sits centre. An off-by-one in the
 * rank→entry lookup would silently show the wrong person on the top step.
 */

import { render } from '@testing-library/react-native';
import React from 'react';

jest.mock('../../UserAvatar', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react');
  const mockRN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    UserAvatar: ({ firstName, size }: { firstName: string; size: number }) =>
      mockReact.createElement(mockRN.Text, null, `avatar:${firstName}:${size}`),
  };
});

import { PodiumTop5 } from '../PodiumTop5';

import type { LeaderboardEntry } from '../../../types/leaderboard.types';

const entry = (rank: number): LeaderboardEntry =>
  ({
    userId: `u${rank}`,
    rank,
    firstName: `Name${rank}`,
    lastName: 'X',
    profileImage: null,
    totalPoints: 1000 - rank,
    isCurrentUser: false,
  }) as LeaderboardEntry;

const entries = (count: number) => Array.from({ length: count }, (_, i) => entry(i + 1));

describe('PodiumTop5', () => {
  describe('when there is nothing to show', () => {
    it('renders nothing for an empty list', () => {
      expect(render(<PodiumTop5 entries={[]} />).toJSON()).toBeNull();
    });

    // One player is not a podium — the list below already says who leads.
    it('renders nothing for a single entry', () => {
      expect(render(<PodiumTop5 entries={entries(1)} />).toJSON()).toBeNull();
    });

    it('renders once there are two', () => {
      expect(render(<PodiumTop5 entries={entries(2)} />).toJSON()).not.toBeNull();
    });
  });

  describe('podium order', () => {
    // The whole point of the component: ranked order in, 5-3-1-2-4 out.
    it('lays the five out with the champion centre', () => {
      const { getAllByText } = render(<PodiumTop5 entries={entries(5)} />);
      const names = getAllByText(/^Name\d$/).map(n => n.props.children);

      expect(names).toEqual(['Name5', 'Name3', 'Name1', 'Name2', 'Name4']);
    });

    it('keeps the layout centred when there are fewer than five', () => {
      const { getAllByText } = render(<PodiumTop5 entries={entries(3)} />);
      const names = getAllByText(/^Name\d$/).map(n => n.props.children);

      // Ranks 4 and 5 become empty spacers, so 3 and 1 and 2 stay in place.
      expect(names).toEqual(['Name3', 'Name1', 'Name2']);
    });
  });

  describe('emphasis by place', () => {
    it('crowns the champion and medals second and third', () => {
      const { getByText } = render(<PodiumTop5 entries={entries(5)} />);

      expect(getByText('👑')).toBeTruthy();
      expect(getByText('🥈')).toBeTruthy();
      expect(getByText('🥉')).toBeTruthy();
    });

    it('numbers fourth and fifth instead of medalling them', () => {
      const { getByText } = render(<PodiumTop5 entries={entries(5)} />);

      expect(getByText('4')).toBeTruthy();
      expect(getByText('5')).toBeTruthy();
    });

    // Avatar size is how the podium conveys placing at a glance.
    it('sizes the avatars champion > medal > rest', () => {
      const { getByText } = render(<PodiumTop5 entries={entries(5)} />);

      expect(getByText('avatar:Name1:68')).toBeTruthy();
      expect(getByText('avatar:Name2:52')).toBeTruthy();
      expect(getByText('avatar:Name4:42')).toBeTruthy();
    });
  });

  it('formats point totals with separators', () => {
    const big = [{ ...entry(1), totalPoints: 12345 }, entry(2)] as LeaderboardEntry[];
    const { getByText } = render(<PodiumTop5 entries={big} />);

    expect(getByText((12345).toLocaleString())).toBeTruthy();
  });
});
