/**
 * useSearchPlaceSelection.
 *
 * Choosing a Google place and choosing an app establishment were two handlers
 * doing the same six things. They now share selectPlace, so the tests that
 * matter assert that fan-out happens identically from both entry points — that
 * is exactly what used to be duplicated and could drift.
 */

import { act, renderHook } from '@testing-library/react-native';

const mockResolveGooglePlace = jest.fn();
const mockResetSessionToken = jest.fn();
let mockSearchState: Record<string, unknown> = {};

jest.mock('../usePlaceSearch', () => ({
  usePlaceSearch: (query: string) => ({
    googleResults: [],
    appResults: [],
    isLoading: false,
    debouncedQuery: query,
    resolveGooglePlace: (...a: unknown[]) => mockResolveGooglePlace(...a),
    resetSessionToken: () => mockResetSessionToken(),
    ...mockSearchState,
  }),
}));

import { useSearchPlaceSelection } from '../useSearchPlaceSelection';

const CENTER = { latitude: 35.82, longitude: 10.63 };

const animateTo = jest.fn();
const setManualLocationValue = jest.fn();
const onPlaceSelected = jest.fn();

const setup = () =>
  renderHook(() =>
    useSearchPlaceSelection({
      center: CENTER,
      radiusMeters: 15000,
      animateTo,
      setManualLocationValue,
      onPlaceSelected,
    }),
  );

const googlePlace = (over: Record<string, unknown> = {}) =>
  ({
    id: 'g1',
    name: 'Parc',
    subtext: 'Sousse',
    coords: { lat: 35.9, lng: 10.7 },
    ...over,
  }) as never;

const establishment = (over: Record<string, unknown> = {}) =>
  ({
    item: {
      _id: 'e1',
      name: 'Boulangerie',
      address: { formattedAddress: '12 rue X' },
      coordinates: { latitude: 35.7, longitude: 10.5 },
      ...over,
    },
    geoData: { coordinates: { latitude: 1, longitude: 2 } },
    distance: { value: 1, unit: 'kilometers', formatted: '1 km' },
  }) as never;

describe('useSearchPlaceSelection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockSearchState = {};
  });

  describe('the search field', () => {
    it('opens the panel once the query reaches the minimum length', () => {
      const { result } = setup();

      act(() => result.current.handleSearchChange('b'));
      expect(result.current.showPlaceResults).toBe(false);

      act(() => result.current.handleSearchChange('bou'));
      expect(result.current.showPlaceResults).toBe(true);
    });

    // Ends the Google autocomplete session so the next search bills as new.
    it('clearing resets the query, closes the panel and ends the session', () => {
      const { result } = setup();
      act(() => result.current.handleSearchChange('boul'));

      act(() => result.current.handleClearSearch());

      expect(result.current.searchQuery).toBe('');
      expect(result.current.showPlaceResults).toBe(false);
      expect(mockResetSessionToken).toHaveBeenCalledTimes(1);
    });

    it('re-opens on focus only when there is already a query', () => {
      const { result } = setup();

      act(() => result.current.handleSearchFocus());
      expect(result.current.showPlaceResults).toBe(false);

      act(() => result.current.handleSearchChange('boul'));
      act(() => result.current.handleSearchFocus());
      expect(result.current.showPlaceResults).toBe(true);
    });

    // Blur fires before the press on a result lands; closing immediately would
    // unmount the row before its onPress could run.
    it('defers closing on blur so a result tap still registers', () => {
      jest.useFakeTimers();
      const { result } = setup();
      act(() => result.current.handleSearchChange('boul'));

      act(() => result.current.handleSearchBlur());
      expect(result.current.showPlaceResults).toBe(true);

      act(() => jest.advanceTimersByTime(200));
      expect(result.current.showPlaceResults).toBe(false);
    });
  });

  // The point of the refactor: both entry points must fan out identically.
  describe.each([
    [
      'a google place',
      async (r: { current: ReturnType<typeof useSearchPlaceSelection> }) => {
        await act(async () => {
          r.current.handleGooglePlacePress(googlePlace());
        });
      },
      { name: 'Parc', address: 'Sousse', coordinates: { latitude: 35.9, longitude: 10.7 } },
    ],
    [
      'an app establishment',
      async (r: { current: ReturnType<typeof useSearchPlaceSelection> }) => {
        await act(async () => {
          r.current.handleAppEstablishmentSelect(establishment());
        });
      },
      {
        name: 'Boulangerie',
        address: '12 rue X',
        coordinates: { latitude: 35.7, longitude: 10.5 },
      },
    ],
  ])('selecting %s', (_label, select, expected) => {
    it('records it as the selected place', async () => {
      const { result } = setup();
      await select(result);

      expect(result.current.selectedPlace).toEqual(expected);
    });

    it('makes it the active location', async () => {
      const { result } = setup();
      await select(result);

      expect(setManualLocationValue).toHaveBeenCalledWith(expected.coordinates, expected.name);
    });

    it('moves the camera to it', async () => {
      const { result } = setup();
      await select(result);

      expect(animateTo).toHaveBeenCalledWith(expected.coordinates);
    });

    it('dismisses the search UI', async () => {
      const { result } = setup();
      await act(async () => {
        result.current.handleSearchChange('boul');
      });
      await select(result);

      expect(result.current.searchQuery).toBe('');
      expect(result.current.showPlaceResults).toBe(false);
    });

    it('clears any open marker selection', async () => {
      const { result } = setup();
      await select(result);

      expect(onPlaceSelected).toHaveBeenCalledTimes(1);
    });
  });

  describe('google place resolution', () => {
    // Autocomplete returns no coordinates; Place Details does. That is the
    // billed call, so it only runs on selection.
    it('resolves the place id and uses the resolved coordinates', async () => {
      mockResolveGooglePlace.mockResolvedValue({ coords: { lat: 1.5, lng: 2.5 } });
      const { result } = setup();

      await act(async () => {
        result.current.handleGooglePlacePress(googlePlace({ googlePlaceId: 'abc' }));
      });

      expect(mockResolveGooglePlace).toHaveBeenCalledWith('abc');
      expect(result.current.selectedPlace?.coordinates).toEqual({ latitude: 1.5, longitude: 2.5 });
    });

    // A failed lookup must change nothing — moving the map to a stale
    // coordinate would be worse than doing nothing.
    it('selects nothing when resolution fails', async () => {
      mockResolveGooglePlace.mockResolvedValue(null);
      const { result } = setup();

      await act(async () => {
        result.current.handleGooglePlacePress(googlePlace({ googlePlaceId: 'abc' }));
      });

      expect(result.current.selectedPlace).toBeNull();
      expect(animateTo).not.toHaveBeenCalled();
      expect(setManualLocationValue).not.toHaveBeenCalled();
    });

    it('skips the billed lookup when there is no place id', async () => {
      const { result } = setup();

      await act(async () => {
        result.current.handleGooglePlacePress(googlePlace());
      });

      expect(mockResolveGooglePlace).not.toHaveBeenCalled();
    });

    it('falls back to a placeholder name when the place has none', async () => {
      const { result } = setup();

      await act(async () => {
        result.current.handleGooglePlacePress(googlePlace({ name: '' }));
      });

      expect(result.current.selectedPlace?.name).toBe('Unknown');
    });
  });

  describe('establishment coordinate fallback', () => {
    // Some establishments carry no own coordinates; the search hit's geoData
    // always does.
    it('falls back to geoData when the establishment has no coordinates', async () => {
      const { result } = setup();

      await act(async () => {
        result.current.handleAppEstablishmentSelect(establishment({ coordinates: undefined }));
      });

      expect(result.current.selectedPlace?.coordinates).toEqual({ latitude: 1, longitude: 2 });
    });

    it('falls back to the city when there is no formatted address', async () => {
      const { result } = setup();

      await act(async () => {
        result.current.handleAppEstablishmentSelect(establishment({ address: { city: 'Sousse' } }));
      });

      expect(result.current.selectedPlace?.address).toBe('Sousse');
    });
  });

  describe('closePlaceSheet', () => {
    it('clears the selection without touching the location', async () => {
      const { result } = setup();
      await act(async () => {
        result.current.handleGooglePlacePress(googlePlace());
      });
      setManualLocationValue.mockClear();

      act(() => result.current.closePlaceSheet());

      expect(result.current.selectedPlace).toBeNull();
      expect(setManualLocationValue).not.toHaveBeenCalled();
    });
  });
});
