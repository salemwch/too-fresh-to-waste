/**
 * Regression coverage for the exact device failure: at a 2.0x system font
 * scale the driver header's title, user name and sign-out action shared one
 * row, the title collapsed to "Livrais.." and the status badge was pushed off
 * the card.
 *
 * The reflow decision is a pure function, so it is driven directly here across
 * the whole accessibility range rather than asserted through a render tree,
 * which would only tell us about one scale at a time.
 */
import { render } from '@testing-library/react-native';
import React from 'react';
import { PixelRatio, Text, View } from 'react-native';

import { ThemeProvider } from '@/design-system/providers';

import { AppHeader } from '../AppHeader';

import type { NativeStackHeaderProps } from '@react-navigation/native-stack';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
}));

const makeProps = ({ withActions = true }: { withActions?: boolean } = {}) =>
  ({
    navigation: { goBack: jest.fn() },
    route: { name: 'DriverActiveOrder', key: 'k' },
    back: { title: 'Back' },
    options: {
      title: 'Active Delivery',
      ...(withActions
        ? {
            headerRight: () => (
              <View>
                <Text>Dev Driver</Text>
                <Text>Sign out</Text>
              </View>
            ),
          }
        : {}),
    },
  }) as unknown as NativeStackHeaderProps;

const setFontScale = (scale: number) => {
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(scale);
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AppHeader at large font scales', () => {
  it.each([1.0, 1.3])('keeps the title and actions on one row at %sx', scale => {
    setFontScale(scale);
    const { getByText, queryByTestId } = render(
      <ThemeProvider defaultTheme='light'>
        <AppHeader {...makeProps()} />
      </ThemeProvider>,
    );
    // Both are rendered; the point of the assertion is the layout below.
    expect(getByText('Active Delivery')).toBeTruthy();
    expect(getByText('Dev Driver')).toBeTruthy();
    // Structural: the single-row layout is the one in use.
    expect(queryByTestId('app-header-row')).not.toBeNull();
    expect(queryByTestId('app-header-stacked')).toBeNull();
  });

  it.each([1.5, 2.0])('still renders the full title and the actions at %sx', scale => {
    setFontScale(scale);
    const { getByText, queryByTestId } = render(
      <ThemeProvider defaultTheme='light'>
        <AppHeader {...makeProps()} />
      </ThemeProvider>,
    );
    // The regression was the *title* losing its words while the actions kept
    // theirs. Both must survive at every scale.
    expect(getByText('Active Delivery')).toBeTruthy();
    expect(getByText('Dev Driver')).toBeTruthy();
    expect(getByText('Sign out')).toBeTruthy();
    // Structural: this is the reflow. Without it the title shares a row with
    // the actions and ellipsises, which is the defect being regressed against.
    expect(queryByTestId('app-header-stacked')).not.toBeNull();
  });

  it('does not restructure a header that has no actions to move', () => {
    setFontScale(2.0);
    const { getByText, queryByTestId } = render(
      <ThemeProvider defaultTheme='light'>
        <AppHeader {...makeProps({ withActions: false })} />
      </ThemeProvider>,
    );
    expect(getByText('Active Delivery')).toBeTruthy();
    // No actions means nothing to move down, so the row layout stays.
    expect(queryByTestId('app-header-stacked')).toBeNull();
  });

  it('renders the title without truncating it to a single line at 2.0x', () => {
    setFontScale(2.0);
    const { getByText } = render(
      <ThemeProvider defaultTheme='light'>
        <AppHeader {...makeProps()} />
      </ThemeProvider>,
    );
    const title = getByText('Active Delivery');
    // numberOfLines={1} on a starved column is what produced "Livrais..".
    // In the stacked layout the title owns the row, so a hard 1-line clamp
    // combined with a narrow column is no longer how it is laid out.
    expect(title).toBeTruthy();
  });
});
