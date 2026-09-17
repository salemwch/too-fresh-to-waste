/**
 * The two hero banners must occupy the same box.
 *
 * WHY THIS EXISTS
 * ---------------
 * They sit side by side in a horizontal FlatList, which does NOT stretch its
 * rows to the tallest one. Both cards used `minHeight: 96`, so each was as tall
 * as its own copy - and the copy differs per locale, per amount and per season
 * name. In French the impact card's title wrapped to two lines and its amount
 * line to two more, so it stood ~20dp taller than the prize card and the pair
 * read as a rendering defect while the user swiped between them.
 *
 * Nothing caught it. Type-check passes either way, and no snapshot covers these
 * two components. Only measuring the rendered box can tell.
 *
 * The parity is asserted on the RENDERED style rather than on the shared
 * constant: reading `HERO_CARD_HEIGHT` in both files would pass even if one
 * card stopped applying it.
 */

import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { ThemeProvider } from '@/design-system/providers';

import { HERO_CARD_HEIGHT } from '../../utils/heroCard';

import type { ViewStyle } from 'react-native';

const mockUseMonthlyBagGoal = jest.fn();
const mockUseDonationStats = jest.fn();

jest.mock('../../hooks/useMonthlyBagGoal', () => ({
  useMonthlyBagGoal: () => mockUseMonthlyBagGoal() as unknown,
}));

jest.mock('@/features/donations/hooks/useDonations', () => ({
  useDonationStats: () => mockUseDonationStats() as unknown,
}));

import { ImpactBanner } from '@/features/donations/components/ImpactBanner';

import { MonthlyBagGoalBanner } from '../MonthlyBagGoalBanner';

const GOAL_STATS = {
  currentCount: 12,
  targetCount: 100,
  progressPercentage: 12,
  remaining: 88,
  cycleNumber: 1,
  status: 'active',
  lastUpdatedAt: '2026-09-16T00:00:00.000Z',
  seasonName: 'Save Bags Together',
};

const DONATION_STATS = {
  totalDonations: 20.67,
  contributorCount: 0,
  currency: 'TND',
};

/** Both cards read theme tokens, so neither can mount bare. */
const withTheme = (node: React.ReactElement): React.ReactElement => (
  <ThemeProvider defaultTheme='light'>{node}</ThemeProvider>
);

const heightOf = (style: unknown): number | undefined =>
  (StyleSheet.flatten(style as ViewStyle) as ViewStyle | undefined)?.height as number | undefined;

beforeEach(() => {
  mockUseMonthlyBagGoal.mockReturnValue({ data: GOAL_STATS, isLoading: false, isError: false });
  mockUseDonationStats.mockReturnValue({ data: DONATION_STATS, isLoading: false, isError: false });
});

describe('hero card parity', () => {
  it('renders both cards at exactly the same height', () => {
    const prize = render(withTheme(<MonthlyBagGoalBanner onPress={jest.fn()} />));
    const impact = render(withTheme(<ImpactBanner />));

    const prizeHeight = heightOf(prize.getByTestId('community-bag-goal-banner').props['style']);
    const impactHeight = heightOf(impact.getByTestId('impact-banner-card').props['style']);

    expect(prizeHeight).toBe(HERO_CARD_HEIGHT);
    expect(impactHeight).toBe(HERO_CARD_HEIGHT);
  });

  it('keeps the impact card at that height when its copy is long', () => {
    // The regression case: a four-digit amount is the widest the amount line
    // gets, and it used to wrap and grow the card.
    mockUseDonationStats.mockReturnValue({
      data: { totalDonations: 12345.67, contributorCount: 9999, currency: 'TND' },
      isLoading: false,
      isError: false,
    });

    const { getByTestId } = render(withTheme(<ImpactBanner />));

    expect(heightOf(getByTestId('impact-banner-card').props['style'])).toBe(HERO_CARD_HEIGHT);
  });

  it('keeps the prize card at that height when the season name is long', () => {
    mockUseMonthlyBagGoal.mockReturnValue({
      data: { ...GOAL_STATS, seasonName: 'Une saison au nom particulierement long' },
      isLoading: false,
      isError: false,
    });

    const { getByTestId } = render(withTheme(<MonthlyBagGoalBanner onPress={jest.fn()} />));

    expect(heightOf(getByTestId('community-bag-goal-banner').props['style'])).toBe(
      HERO_CARD_HEIGHT,
    );
  });
});

describe('the prize card fills its extra height with real data', () => {
  it('shows how many bags are still needed', () => {
    const { getByText } = render(withTheme(<MonthlyBagGoalBanner onPress={jest.fn()} />));

    expect(getByText('88 bags to go')).toBeTruthy();
  });

  it('switches to the reached copy at exactly zero', () => {
    mockUseMonthlyBagGoal.mockReturnValue({
      data: { ...GOAL_STATS, currentCount: 100, remaining: 0, progressPercentage: 100 },
      isLoading: false,
      isError: false,
    });

    const { getByText, queryByText } = render(
      withTheme(<MonthlyBagGoalBanner onPress={jest.fn()} />),
    );

    expect(getByText('Goal reached!')).toBeTruthy();
    expect(queryByText('0 bags to go')).toBeNull();
  });

  it('shows the reached copy rather than a negative count once the goal is overshot', () => {
    // The backend keeps counting bags past the target, so `remaining` goes
    // negative. "-5 bags to go" is the bug this guards.
    mockUseMonthlyBagGoal.mockReturnValue({
      data: { ...GOAL_STATS, currentCount: 105, remaining: -5, progressPercentage: 105 },
      isLoading: false,
      isError: false,
    });

    const { getByText } = render(withTheme(<MonthlyBagGoalBanner onPress={jest.fn()} />));

    expect(getByText('Goal reached!')).toBeTruthy();
  });

  it('names the remaining bags in the accessibility label, not just on screen', () => {
    const { getByTestId } = render(withTheme(<MonthlyBagGoalBanner onPress={jest.fn()} />));

    expect(getByTestId('community-bag-goal-banner').props['accessibilityLabel']).toContain(
      '88 bags to go',
    );
  });
});
