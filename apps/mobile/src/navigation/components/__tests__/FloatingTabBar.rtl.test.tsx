/**
 * The coral disc must mark the focused tab - in Arabic as well as English.
 *
 * WHY THIS EXISTS
 * ---------------
 * The disc used to be positioned independently of the icons: first as an SVG
 * `<Circle cx={activeCentre} />`, then as an absolutely-positioned View at
 * `left: …`, in both cases from an index that `visualTabIndex` had mirrored by
 * hand. Under RTL the platform mirrors some of those coordinate systems and not
 * others - and measurement showed which ones depended on how the app had been
 * restarted:
 *
 *     restarted from inside the app     JS isRTL false, native layout RTL
 *     restarted cold from the launcher  JS isRTL true,  native layout RTL
 *
 * Measured off device screenshots (720x1280, density 240), the disc landed on:
 *
 *     locale  active tab   disc on circle   should have been
 *     en      Profile (4)        4                 4
 *     ar      Home    (0)        0                 4
 *     ar      Profile (4)        4                 0
 *
 * And because the focused icon is painted WHITE so it reads on coral, in Arabic
 * it landed on a plain white circle and disappeared - a different icon on every
 * tab change, which is how it was reported.
 *
 * WHAT THIS ASSERTS, AND WHY THAT SHAPE
 * -------------------------------------
 * Not "the disc is at circle N", and not a pixel offset. Both of those re-encode
 * the arithmetic the component does, so they pass whichever way the mirroring
 * went - which is precisely how the bug survived. This asserts the structural
 * invariant the fix creates: the disc is rendered INSIDE the focused tab. A
 * renderer that mirrors the row, and one that does not, both satisfy it, because
 * a child cannot be laid out anywhere but inside its parent.
 */

import { render, within } from '@testing-library/react-native';
import React from 'react';
import { I18nManager } from 'react-native';

import { ThemeProvider } from '@/design-system/providers';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual<Record<string, unknown>>('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 44, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/features/voting/components/VotingLiveDot', () => ({
  VotingLiveDot: () => null,
}));

import { FloatingTabBar } from '../FloatingTabBar';

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const ROUTES = ['Home', 'Search', 'Favorites', 'Orders', 'Profile'] as const;
const DISC = 'floating-tab-bar-active-circle';

const makeProps = (focusedIndex: number): BottomTabBarProps =>
  ({
    state: {
      index: focusedIndex,
      routes: ROUTES.map((name, i) => ({ key: `${name}-${i}`, name })),
    },
    descriptors: Object.fromEntries(
      ROUTES.map((name, i) => [`${name}-${i}`, { options: { title: name } }]),
    ),
    navigation: { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() },
    insets: { top: 44, bottom: 0, left: 0, right: 0 },
  }) as unknown as BottomTabBarProps;

const renderBar = (focusedIndex: number): ReturnType<typeof render> =>
  render(
    <ThemeProvider defaultTheme='light'>
      <FloatingTabBar {...makeProps(focusedIndex)} />
    </ThemeProvider>,
  );

/** `isRTL` is read synchronously; the app flips it via forceRTL and a restart. */
const withDirection = (isRTL: boolean, run: () => void): void => {
  const real = I18nManager.isRTL;
  Object.defineProperty(I18nManager, 'isRTL', { value: isRTL, configurable: true });
  try {
    run();
  } finally {
    Object.defineProperty(I18nManager, 'isRTL', { value: real, configurable: true });
  }
};

describe.each([
  ['LTR', false],
  ['RTL', true],
])('FloatingTabBar in %s', (_label, isRTL) => {
  it.each(ROUTES.map((name, index) => [name, index]))(
    'renders the active disc inside %s when it is focused',
    (routeName, index) => {
      withDirection(isRTL, () => {
        const { getByTestId } = renderBar(index as number);

        expect(within(getByTestId(`tab-${routeName as string}`)).getByTestId(DISC)).toBeTruthy();
      });
    },
  );

  it.each(ROUTES.map((name, index) => [name, index]))(
    'renders no disc inside any tab other than %s',
    (routeName, index) => {
      withDirection(isRTL, () => {
        const { getByTestId } = renderBar(index as number);

        const others = ROUTES.filter(name => name !== routeName);
        for (const name of others) {
          expect(within(getByTestId(`tab-${name}`)).queryByTestId(DISC)).toBeNull();
        }
      });
    },
  );

  it('renders exactly one disc, never a second stale one', () => {
    withDirection(isRTL, () => {
      expect(renderBar(2).getAllByTestId(DISC)).toHaveLength(1);
    });
  });

  it('renders all five tabs, so none can go missing', () => {
    withDirection(isRTL, () => {
      const { getByTestId } = renderBar(0);

      for (const name of ROUTES) expect(getByTestId(`tab-${name}`)).toBeTruthy();
    });
  });

  it('marks the focused tab as selected for a screen reader, and only it', () => {
    withDirection(isRTL, () => {
      const { getByTestId } = renderBar(3);

      for (const name of ROUTES) {
        const selected = (
          getByTestId(`tab-${name}`).props['accessibilityState'] as { selected?: boolean }
        ).selected;
        expect(selected).toBe(name === 'Orders');
      }
    });
  });
});

describe('FloatingTabBar - the tab order itself', () => {
  /*
   * Direction is the layout engine's job now (`flexDirection: 'row'` plus
   * `marginStart`), and neither is observable from the test renderer - so this
   * asserts what IS observable: the routes are handed to the row in their
   * navigator order, unreversed, in both directions. Reversing them here would
   * mirror twice on a device and put Home back on the wrong side.
   */
  it.each([
    ['LTR', false],
    ['RTL', true],
  ])('keeps the routes in navigator order in %s', (_label, isRTL) => {
    withDirection(isRTL, () => {
      const { getByTestId } = renderBar(0);
      const row = getByTestId('floating-tab-bar').findAllByProps({ accessibilityRole: 'tab' });

      const names = row
        .map(node => node.props['accessibilityLabel'] as string)
        .filter((name, i, all) => all.indexOf(name) === i);

      expect(names).toEqual([...ROUTES]);
    });
  });
});
