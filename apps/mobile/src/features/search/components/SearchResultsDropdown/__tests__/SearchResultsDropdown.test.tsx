/**
 * SearchResultsDropdown — the autocomplete panel.
 *
 * Extracted from SearchScreen, which had no tests. The branching here is real:
 * loading vs empty vs results, and both sections capped so the panel cannot
 * swallow the map.
 */

import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/design-system/components/atoms', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react');
  const mockRN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Text: ({ children }: { children?: unknown }) =>
      mockReact.createElement(mockRN.Text, null, children as React.ReactNode),
    Icon: () => null,
  };
});

jest.mock('@/design-system/providers', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      primary: '#1E4448',
      outline: '#e0e0e0',
      primaryContainer: '#dbe',
      surfaceVariant: '#eee',
      onSurfaceVariant: '#888',
    },
  }),
}));

import { SearchResultsDropdown } from '../SearchResultsDropdown';

const appHit = (id: string, name: string) =>
  ({
    item: { _id: id, name, address: { city: 'Sousse' } },
    distance: { value: 1, unit: 'kilometers', formatted: '1 km' },
    geoData: {},
  }) as never;

const googleHit = (id: string, name: string) => ({ id, name, subtext: `${name} street` }) as never;

const defaults = {
  visible: true,
  isSearching: false,
  query: 'boul',
  appResults: [],
  googleResults: [],
  onAppEstablishmentPress: jest.fn(),
  onGooglePlacePress: jest.fn(),
};

const setup = (over: Partial<React.ComponentProps<typeof SearchResultsDropdown>> = {}) =>
  render(<SearchResultsDropdown {...defaults} {...over} />);

describe('SearchResultsDropdown', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when not visible', () => {
    const { toJSON } = setup({ visible: false, appResults: [appHit('e1', 'Boulangerie')] });

    expect(toJSON()).toBeNull();
  });

  describe('loading and empty states', () => {
    it('shows the spinner while searching with nothing yet', () => {
      const { getByText } = setup({ isSearching: true });

      expect(getByText('Searching...')).toBeTruthy();
    });

    // Results already on screen should not be replaced by a spinner on the next
    // keystroke — that flickers the whole panel.
    it('keeps showing results while a further search runs', () => {
      const { getByText, queryByText } = setup({
        isSearching: true,
        appResults: [appHit('e1', 'Boulangerie')],
      });

      expect(getByText('Boulangerie')).toBeTruthy();
      expect(queryByText('Searching...')).toBeNull();
    });

    it('reports no results once the search settles', () => {
      const { getByText } = setup({ query: 'zzzz' });

      expect(getByText(/No results found/)).toBeTruthy();
    });

    // Below the 2-char minimum no search has run, so "no results" would be a lie.
    it('does not claim "no results" for a query below the minimum length', () => {
      const { queryByText } = setup({ query: 'b' });

      expect(queryByText(/No results found/)).toBeNull();
    });
  });

  describe('sections', () => {
    it('shows the app section only when there are app results', () => {
      expect(
        setup({ appResults: [appHit('e1', 'Boulangerie')] }).getByText('In WasteFood'),
      ).toBeTruthy();
      expect(
        setup({ googleResults: [googleHit('g1', 'Park')] }).queryByText('In WasteFood'),
      ).toBeNull();
    });

    it('shows the places section only when there are google results', () => {
      expect(
        setup({ googleResults: [googleHit('g1', 'Park')] }).getByText('More places'),
      ).toBeTruthy();
      expect(
        setup({ appResults: [appHit('e1', 'Boulangerie')] }).queryByText('More places'),
      ).toBeNull();
    });

    it('renders both sections together', () => {
      const { getByText } = setup({
        appResults: [appHit('e1', 'Boulangerie')],
        googleResults: [googleHit('g1', 'Park')],
      });

      expect(getByText('In WasteFood')).toBeTruthy();
      expect(getByText('More places')).toBeTruthy();
    });

    // The cap is what keeps the panel from covering the map.
    it('caps each section at 4 entries', () => {
      const many = Array.from({ length: 7 }, (_, i) => appHit(`e${i}`, `Est ${i}`));
      const manyGoogle = Array.from({ length: 7 }, (_, i) => googleHit(`g${i}`, `Place ${i}`));

      const { queryByText } = setup({ appResults: many, googleResults: manyGoogle });

      expect(queryByText('Est 3')).toBeTruthy();
      expect(queryByText('Est 4')).toBeNull();
      expect(queryByText('Place 3')).toBeTruthy();
      expect(queryByText('Place 4')).toBeNull();
    });
  });

  describe('selection', () => {
    it('passes the whole establishment hit back', () => {
      const onAppEstablishmentPress = jest.fn();
      const hit = appHit('e1', 'Boulangerie');

      const { getByText } = setup({ appResults: [hit], onAppEstablishmentPress });
      fireEvent.press(getByText('Boulangerie'));

      expect(onAppEstablishmentPress).toHaveBeenCalledWith(hit);
    });

    it('passes the whole place back', () => {
      const onGooglePlacePress = jest.fn();
      const place = googleHit('g1', 'Park');

      const { getByText } = setup({ googleResults: [place], onGooglePlacePress });
      fireEvent.press(getByText('Park'));

      expect(onGooglePlacePress).toHaveBeenCalledWith(place);
    });
  });
});
