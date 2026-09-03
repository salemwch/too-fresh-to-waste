/**
 * MonthlyBagGoalBanner — the card must go where it says it goes.
 *
 * WHY THIS EXISTS
 * ---------------
 * This card shipped with an empty handler:
 *
 *     const handlePress = useCallback(() => {
 *       // Navigate to prize details in the future
 *     }, []);
 *
 * while rendering a chevron, setting accessibilityRole='button' and announcing
 * accessibilityHint "Opens more details". So it promised a destination to
 * sighted and screen-reader users alike and delivered nothing. Tapping it was
 * confirmed to be a no-op on a production build.
 *
 * Nothing caught it: type-check passed, lint passed, and every other suite
 * passed, because an empty function is valid in all of them. Only pressing the
 * thing can tell. That is what this asserts.
 *
 * The prop is required rather than optional for the same reason — an optional
 * `onPress?` would let a caller drop it and restore the silence.
 */

import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { ThemeProvider } from '@/design-system/providers';

const mockStats = {
  currentCount: 12,
  targetCount: 100,
  progressPercentage: 12,
  seasonName: 'Save Bags Together',
};

const mockUseMonthlyBagGoal = jest.fn();

jest.mock('../../hooks/useMonthlyBagGoal', () => ({
  useMonthlyBagGoal: () => mockUseMonthlyBagGoal() as unknown,
}));

jest.mock('../SkeletonMonthlyBagGoal', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react');
  const mockRN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    SkeletonMonthlyBagGoal: () => mockReact.createElement(mockRN.Text, null, 'skeleton'),
  };
});

import { MonthlyBagGoalBanner } from '../MonthlyBagGoalBanner';

const TEST_ID = 'community-bag-goal-banner';

/** The card reads theme tokens, so it cannot mount bare. */
const renderCard = (onPress: () => void) =>
  render(
    <ThemeProvider defaultTheme='light'>
      <MonthlyBagGoalBanner onPress={onPress} />
    </ThemeProvider>,
  );

beforeEach(() => {
  mockUseMonthlyBagGoal.mockReturnValue({ data: mockStats, isLoading: false, isError: false });
});

describe('MonthlyBagGoalBanner', () => {
  it('calls its destination when pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = renderCard(onPress);

    fireEvent.press(getByTestId(TEST_ID));

    // The assertion the empty handler would have failed.
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('presents itself as a button, which is why the press has to do something', () => {
    const { getByTestId } = renderCard(jest.fn());
    const card = getByTestId(TEST_ID);

    expect(card.props['accessibilityRole']).toBe('button');
    // If this hint is ever removed the card stops promising navigation, and the
    // test above stops being about honesty. Pinned so the two move together.
    expect(card.props['accessibilityHint']).toBeTruthy();
  });

  describe('states', () => {
    it('shows the skeleton while loading rather than an empty card', () => {
      mockUseMonthlyBagGoal.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      });
      const { getByText } = renderCard(jest.fn());

      expect(getByText('skeleton')).toBeTruthy();
    });

    // A goal that failed to load is not a goal of zero — showing 0 / 0 bags
    // would misstate the community's progress.
    it('renders nothing when the goal failed to load', () => {
      mockUseMonthlyBagGoal.mockReturnValue({ data: undefined, isLoading: false, isError: true });

      expect(renderCard(jest.fn()).toJSON()).toBeNull();
    });
  });
});
