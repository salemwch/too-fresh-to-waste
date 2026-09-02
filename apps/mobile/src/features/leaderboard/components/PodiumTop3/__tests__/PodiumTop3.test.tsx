/**
 * PodiumTop3 — was PodiumTop5.
 *
 * The logic worth pinning is the visual reordering: entries arrive ranked 1..n
 * but render 3-1-2 so the champion sits centre. An off-by-one in the
 * rank→entry lookup would silently show the wrong person on the top step.
 *
 * The case that pins the redesign is `excludes ranks beyond the podium`: the
 * season awards three prizes, so a fourth face on the podium contradicts the
 * tier card beside it. Without that assertion, restoring the two extra slots
 * would pass every other test here.
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

import { PodiumTop3 } from '../PodiumTop3';

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

describe('PodiumTop3', () => {
  describe('when there is nothing to show', () => {
    it('renders nothing for an empty list', () => {
      expect(render(<PodiumTop3 entries={[]} />).toJSON()).toBeNull();
    });

    // One player is not a podium — the list below already says who leads.
    it('renders nothing for a single entry', () => {
      expect(render(<PodiumTop3 entries={entries(1)} />).toJSON()).toBeNull();
    });

    it('renders once there are two', () => {
      expect(render(<PodiumTop3 entries={entries(2)} />).toJSON()).not.toBeNull();
    });
  });

  describe('podium order', () => {
    // The whole point of the component: ranked order in, 3-1-2 out.
    it('lays the three out with the champion centre', () => {
      const { getAllByText } = render(<PodiumTop3 entries={entries(3)} />);
      const names = getAllByText(/^Name\d$/).map(n => n.props['children']);

      expect(names).toEqual(['Name3', 'Name1', 'Name2']);
    });

    it('keeps the layout centred when there are only two', () => {
      const { getAllByText } = render(<PodiumTop3 entries={entries(2)} />);
      const names = getAllByText(/^Name\d$/).map(n => n.props['children']);

      // Rank 3 becomes an empty spacer, so 1 and 2 stay in their places.
      expect(names).toEqual(['Name1', 'Name2']);
    });

    it('excludes ranks beyond the podium even when the list is longer', () => {
      // Three prizes, three places. A fourth face here would promise a prize
      // the season does not award.
      const { queryByText } = render(<PodiumTop3 entries={entries(8)} />);

      expect(queryByText('Name4')).toBeNull();
      expect(queryByText('Name5')).toBeNull();
      expect(queryByText('Name8')).toBeNull();
    });
  });

  describe('emphasis by place', () => {
    it('crowns the champion and medals second and third', () => {
      const { getByText } = render(<PodiumTop3 entries={entries(3)} />);

      expect(getByText('👑')).toBeTruthy();
      expect(getByText('🥈')).toBeTruthy();
      expect(getByText('🥉')).toBeTruthy();
    });

    it('numbers every place on its chip', () => {
      const { getByText } = render(<PodiumTop3 entries={entries(3)} />);

      expect(getByText('1')).toBeTruthy();
      expect(getByText('2')).toBeTruthy();
      expect(getByText('3')).toBeTruthy();
    });

    // Avatar size is how the podium conveys placing at a glance.
    it('sizes the champion above the runners-up', () => {
      const { getByText } = render(<PodiumTop3 entries={entries(3)} />);

      expect(getByText('avatar:Name1:88')).toBeTruthy();
      expect(getByText('avatar:Name2:64')).toBeTruthy();
      expect(getByText('avatar:Name3:64')).toBeTruthy();
    });
  });

  it('formats point totals with separators', () => {
    const big = [{ ...entry(1), totalPoints: 12345 }, entry(2)] as LeaderboardEntry[];
    const { getByText } = render(<PodiumTop3 entries={big} />);

    expect(getByText((12345).toLocaleString())).toBeTruthy();
  });
});
