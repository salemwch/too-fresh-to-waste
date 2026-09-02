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
import { DEFAULT_PRIZE_RANKS, firstDiscountRank } from '../../../utils/prizeTiers';

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
  describe('the grand-prize cutoff', () => {
    // Driven by the constant rather than literal ranks: the cutoff moved from
    // 5 to 3 and a hardcoded pair silently stopped testing the boundary.
    //
    // The 2026-09-02 redesign moved this distinction from the points colour to
    // the rank chip, which now carries the podium's metal. Asserting the chip
    // is what keeps the test pointed at the boundary rather than at whichever
    // element happened to be tinted when it was written.
    it('marks the rank of a place inside the cutoff differently from one outside', () => {
      const { getByText } = render(<LeaderboardRow entry={entry({ rank: DEFAULT_PRIZE_RANKS })} />);
      const inside = styleOf(getByText(String(DEFAULT_PRIZE_RANKS)));

      const { getByText: getOutside } = render(
        <LeaderboardRow entry={entry({ rank: firstDiscountRank() })} />,
      );
      const outside = styleOf(getOutside(String(firstDiscountRank())));

      expect(inside.color).not.toBe(outside.color);
    });

    it('gives the champion a different points colour from the rest of the podium', () => {
      const { getByText } = render(<LeaderboardRow entry={entry({ rank: 1 })} />);
      const first = styleOf(getByText(`${(1234).toLocaleString()} pt`));

      const { getByText: getSecond } = render(<LeaderboardRow entry={entry({ rank: 2 })} />);
      const second = styleOf(getSecond(`${(1234).toLocaleString()} pt`));

      expect(first.color).not.toBe(second.color);
    });
  });

  describe('the current user', () => {
    // Every name is bold in the redesign, so weight alone no longer separates
    // them — the accent colour is what makes your own row findable in a scroll.
    it('emphasises their own name', () => {
      const mine = render(<LeaderboardRow entry={entry({ isCurrentUser: true })} />);
      const theirs = render(<LeaderboardRow entry={entry({ isCurrentUser: false })} />);

      const mineStyle = styleOf(mine.getByText('Amine B'));
      const theirsStyle = styleOf(theirs.getByText('Amine B'));

      expect(mineStyle.color).not.toBe(theirsStyle.color);
      expect(mineStyle.fontWeight).not.toBe(theirsStyle.fontWeight);
    });

    it('leaves other names on the default treatment', () => {
      const { getByText } = render(<LeaderboardRow entry={entry({ isCurrentUser: false })} />);

      expect(styleOf(getByText('Amine B')).fontWeight).toBe('700');
    });
  });

  it('is memoised so list scrolling does not re-render every row', () => {
    expect(LeaderboardRow.displayName).toBe('LeaderboardRow');
    expect(typeof LeaderboardRow).toBe('object');
  });
});
