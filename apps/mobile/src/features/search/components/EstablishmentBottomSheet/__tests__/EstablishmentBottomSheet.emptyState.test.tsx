/**
 * The empty state of the map's establishment sheet.
 *
 * WHY THIS EXISTS
 * ---------------
 * This sheet shipped with a "Notify Me" button that was hardcoded `disabled`,
 * drawn at `opacity: 0.5`, and carried no `onPress` at all. Nothing behind it
 * existed either - there is no subscribe endpoint, and the one delivery method
 * that would serve it (`notifyEstablishmentFollowers` in
 * `websocket/gateways/offer.gateway.ts`) is never called by anything in the
 * repo. A user tapping it got nothing and could not tell why.
 *
 * Nothing caught it: type-check passes on a button with no handler, and lint
 * has no opinion about `disabled`. Only pressing the thing can tell - the same
 * failure `MonthlyBagGoalBanner.test.tsx` was written for.
 *
 * The other half is i18n. Every string in this sheet was a literal English one,
 * so a French or Arabic user read English inside an otherwise translated app.
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import { ThemeProvider } from '@/design-system/providers';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual<Record<string, unknown>>('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

/*
 * The offer card is not under test here, and importing it for real drags in
 * `@/features/favorites` -> design-system organisms -> offers hooks ->
 * react-redux, whose ESM build Jest's transform does not cover.
 */
jest.mock('@/features/favorites', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react');
  const mockRN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    FavoriteOfferCard: ({ testID }: { testID?: string }) =>
      mockReact.createElement(mockRN.View, { testID }),
  };
});

import { EstablishmentBottomSheet } from '../EstablishmentBottomSheet';

import type { MapEstablishment, ProximitySearchResult } from '@/features/offers/hooks';

const establishment = (
  overrides: Partial<MapEstablishment> = {},
): ProximitySearchResult<MapEstablishment> =>
  ({
    distance: 1.2,
    item: {
      _id: 'est-1',
      name: 'Boulangerie Messadine',
      averageRating: 4.9,
      totalReviews: 12,
      activeOfferCount: 0,
      offers: [],
      ...overrides,
    },
  }) as unknown as ProximitySearchResult<MapEstablishment>;

const renderSheet = (
  selected: ProximitySearchResult<MapEstablishment>,
): ReturnType<typeof render> =>
  render(
    <ThemeProvider defaultTheme='light'>
      <EstablishmentBottomSheet
        visible
        establishment={selected}
        onClose={jest.fn()}
        onOfferPress={jest.fn()}
      />
    </ThemeProvider>,
  );

describe('EstablishmentBottomSheet - empty state', () => {
  it('shows the empty copy when the business has no offers', () => {
    const { getByText } = renderSheet(establishment());

    expect(getByText('Nothing available right now.')).toBeTruthy();
    expect(getByText('Check back later!')).toBeTruthy();
  });

  it('no longer offers a "Notify Me" button that cannot be pressed', () => {
    const { queryByText } = renderSheet(establishment());

    expect(queryByText('Notify Me')).toBeNull();
  });

  it('leaves no permanently disabled control anywhere in the sheet', () => {
    // Broader than the text assertion above: a renamed dead button would slip
    // past `queryByText('Notify Me')` but not past this.
    const { UNSAFE_root } = renderSheet(establishment());

    const disabled = UNSAFE_root.findAll(
      node => node.props['accessibilityRole'] === 'button' && node.props['disabled'] === true,
    );

    expect(disabled).toHaveLength(0);
  });
});

describe('EstablishmentBottomSheet - offer count', () => {
  it('uses the singular form for one offer', () => {
    const { getByText } = renderSheet(
      establishment({
        activeOfferCount: 1,
        offers: [],
      }),
    );

    expect(getByText('1 offer available')).toBeTruthy();
  });

  it('uses the plural form for several', () => {
    const { getByText } = renderSheet(establishment({ activeOfferCount: 5, offers: [] }));

    expect(getByText('5 offers available')).toBeTruthy();
  });

  it('hides the count row entirely at zero rather than saying "0 offers"', () => {
    const { queryByText } = renderSheet(establishment({ activeOfferCount: 0 }));

    expect(queryByText('0 offers available')).toBeNull();
  });
});
