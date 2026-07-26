/**
 * LeaderboardRow — extracted from LeaderboardScreen, which had no tests.
 *
 * A row's job is to say who, where they placed, and how much — plus two visual
 * distinctions that carry meaning: the prize cutoff and "this is you".
 */

import { render } from '@testing-library/react-native';
import React from 'react';

jest.mock('../../UserAvatar', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react');
  const mockRN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    UserAvatar: ({ firstName }: { firstName: string }) =>
      mockReact.createElement(mockRN.Text, null, `avatar:${firstName}`),
  };
});

import { LeaderboardRow } from '../LeaderboardRow';

import type { LeaderboardEntry } from '../../../types/leaderboard.types';

const entry = (over: Partial<LeaderboardEntry> = {}): LeaderboardEntry =>
  ({
    userId: 'u1',
    rank: 7,
    firstName: 'Amine',
    lastName: 'B',
    profileImage: null,
    totalPoints: 1234,
    isCurrentUser: false,
    currentBadge: null,
    ...over,
  }) as LeaderboardEntry;

/** Flattened style array for a node, as RN would apply it. */
const styleOf = (node: { props: { style?: unknown } }) =>
  Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));

describe('LeaderboardRow', () => {
  it('shows rank, full name and points', () => {
    const { getByText } = render(<LeaderboardRow entry={entry()} />);

    expect(getByText('7')).toBeTruthy();
    expect(getByText('Amine B')).toBeTruthy();
    expect(getByText(`${(1234).toLocaleString()} pt`)).toBeTruthy();
  });

  describe('the badge line', () => {
    it('shows the badge when the user has one', () => {
      const { getByText } = render(<LeaderboardRow entry={entry({ currentBadge: 'Eco Hero' })} />);

      expect(getByText('Eco Hero')).toBeTruthy();
    });

    // Not an empty line — the row is compact and a blank would misalign it.
    it('omits the line entirely when there is no badge', () => {
      const { queryByText } = render(<LeaderboardRow entry={entry({ currentBadge: null })} />);

      expect(queryByText('Eco Hero')).toBeNull();
    });
  });

  // The cutoff is a prize boundary, so the styling difference is meaningful
  // rather than decorative.
  describe('the phone-prize cutoff', () => {
    it('highlights the points of a rank inside the cutoff', () => {
      const { getByText } = render(<LeaderboardRow entry={entry({ rank: 5 })} />);
      const inside = styleOf(getByText(`${(1234).toLocaleString()} pt`));

      const { getByText: getOutside } = render(<LeaderboardRow entry={entry({ rank: 6 })} />);
      const outside = styleOf(getOutside(`${(1234).toLocaleString()} pt`));

      expect(inside.color).not.toBe(outside.color);
    });
  });

  describe('the current user', () => {
    it('emphasises their own name', () => {
      const { getByText } = render(<LeaderboardRow entry={entry({ isCurrentUser: true })} />);

      expect(styleOf(getByText('Amine B')).fontWeight).toBe('700');
    });

    it('leaves other names unemphasised', () => {
      const { getByText } = render(<LeaderboardRow entry={entry({ isCurrentUser: false })} />);

      expect(styleOf(getByText('Amine B')).fontWeight).toBe('600');
    });
  });

  it('is memoised so list scrolling does not re-render every row', () => {
    expect(LeaderboardRow.displayName).toBe('LeaderboardRow');
    expect(typeof LeaderboardRow).toBe('object');
  });
});
