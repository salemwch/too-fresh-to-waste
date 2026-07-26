/**
 * EstablishmentOfferRow — list-view section for one establishment.
 *
 * Extracted from SearchScreen, which had no tests. Covers what the component
 * actually decides: the offer-count wording, and that every offer in the group
 * reaches the carousel.
 */

import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/design-system/components/atoms', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react');
  const mockRN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Text: ({ children }: { children?: unknown }) =>
      mockReact.createElement(mockRN.Text, null, children as React.ReactNode),
  };
});

// Stubbed to a pressable label: the card itself is covered by its own tests, and
// rendering the real one would pull in the favourites stack.
jest.mock('@/features/favorites', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react');
  const mockRN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    FavoriteOfferCard: ({
      offer,
      onPress,
      testID,
    }: {
      offer: { title: string };
      onPress: () => void;
      testID: string;
    }) =>
      mockReact.createElement(
        mockRN.Pressable,
        { onPress, testID },
        mockReact.createElement(mockRN.Text, null, offer.title),
      ),
  };
});

import { EstablishmentOfferRow } from '../EstablishmentOfferRow';

import type { EstablishmentGroup } from '../../../utils/groupOffers';

const offerHit = (id: string, title: string) =>
  ({
    item: {
      _id: id,
      title,
      establishmentId: 'e1',
      establishmentName: 'Boulangerie',
      establishmentLogo: null,
      images: [],
      pricing: { originalPrice: 20, discountedPrice: 8, discountPercentage: 60, currency: 'TND' },
      availableFrom: new Date(Date.now() - 3_600_000).toISOString(),
      availableUntil: new Date(Date.now() + 3_600_000).toISOString(),
      availableQuantity: 2,
    },
    distance: { value: 1, unit: 'kilometers', formatted: '1 km' },
    geoData: {},
  }) as never;

const group = (...offers: ReturnType<typeof offerHit>[]): EstablishmentGroup =>
  ({
    establishmentId: 'e1',
    establishmentName: 'Boulangerie',
    establishmentLogo: null,
    offers,
  }) as EstablishmentGroup;

describe('EstablishmentOfferRow', () => {
  it('shows the establishment name', () => {
    const { getByText } = render(
      <EstablishmentOfferRow group={group(offerHit('o1', 'Bag A'))} onOfferPress={jest.fn()} />,
    );

    expect(getByText('Boulangerie')).toBeTruthy();
  });

  it('says "offer" for one and "offers" for more', () => {
    const single = render(
      <EstablishmentOfferRow group={group(offerHit('o1', 'Bag A'))} onOfferPress={jest.fn()} />,
    );
    expect(single.getByText('1 offer')).toBeTruthy();

    const many = render(
      <EstablishmentOfferRow
        group={group(offerHit('o1', 'Bag A'), offerHit('o2', 'Bag B'))}
        onOfferPress={jest.fn()}
      />,
    );
    expect(many.getByText('2 offers')).toBeTruthy();
  });

  it('renders a card per offer in the group', () => {
    const { getByTestId } = render(
      <EstablishmentOfferRow
        group={group(offerHit('o1', 'Bag A'), offerHit('o2', 'Bag B'))}
        onOfferPress={jest.fn()}
      />,
    );

    expect(getByTestId('search-offer-o1')).toBeTruthy();
    expect(getByTestId('search-offer-o2')).toBeTruthy();
  });

  // The screen needs the full hit back, not just an id — it uses the coordinates
  // to move the map as well as the offer id to navigate.
  it('passes the whole search hit to onOfferPress', () => {
    const onOfferPress = jest.fn();
    const hit = offerHit('o1', 'Bag A');

    const { getByTestId } = render(
      <EstablishmentOfferRow group={group(hit)} onOfferPress={onOfferPress} />,
    );
    fireEvent.press(getByTestId('search-offer-o1'));

    expect(onOfferPress).toHaveBeenCalledWith(hit);
  });
});
