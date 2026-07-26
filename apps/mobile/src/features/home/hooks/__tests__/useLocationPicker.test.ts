/**
 * useLocationPicker.
 *
 * Changing location changes what the whole home screen shows, so the paths that
 * must NOT apply a location carry the most weight: a denied GPS permission, a
 * Google place whose coordinates cannot be resolved, and an entry with no
 * coordinates at all. Each of those must leave the current location untouched.
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockResolveGooglePlace = jest.fn();
const mockResetSessionToken = jest.fn();
let mockSearchState: Record<string, unknown> = { data: undefined, isLoading: false };

jest.mock('@/features/offers/hooks/useGeocode.v2', () => ({
  useLocationSearch: (query: string) => ({
    isLoading: false,
    ...mockSearchState,
    resolveGooglePlace: (...a: unknown[]) => mockResolveGooglePlace(...a),
    resetSessionToken: () => mockResetSessionToken(),
    query,
  }),
}));

jest.mock('@/utils/location', () => ({
  transformLocationResultsToItems: (results: unknown[]) => results,
}));

jest.mock('@/store/slices/locationSlice', () => ({
  reverseGeocodeAsync: (coords: unknown) => ({ type: 'geocode', payload: coords }),
}));

jest.mock('@/utils/logger', () => ({
  Logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { useLocationPicker } from '../useLocationPicker';

import type { LocationItem } from '@/navigation/components';

const COORDS = { latitude: 35.82, longitude: 10.63 };

const requestLocation = jest.fn();
const setManualLocationValue = jest.fn();
const saveToRecentLocations = jest.fn();

/** Resolves the thunk, so `.unwrap()` succeeds by default. */
const dispatch = jest.fn(() => ({ unwrap: () => Promise.resolve({}) })) as never;

const setup = (over: Record<string, unknown> = {}) =>
  renderHook(() =>
    useLocationPicker({
      coordinates: COORDS,
      requestLocation,
      setManualLocationValue,
      saveToRecentLocations,
      dispatch,
      ...over,
    } as never),
  );

const place = (over: Partial<LocationItem> = {}): LocationItem =>
  ({ id: 'p1', name: 'Sousse', latitude: 35.8, longitude: 10.6, ...over }) as LocationItem;

describe('useLocationPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchState = { data: undefined, isLoading: false };
    requestLocation.mockResolvedValue({ success: true, coordinates: COORDS });
  });

  describe('visibility', () => {
    it('starts closed', () => {
      expect(setup().result.current.isVisible).toBe(false);
    });

    it('opens and closes', () => {
      const { result } = setup();

      act(() => result.current.open());
      expect(result.current.isVisible).toBe(true);

      act(() => result.current.close());
      expect(result.current.isVisible).toBe(false);
    });

    // Closing ends the Google autocomplete session so the next search bills as
    // new rather than extending the last one.
    it('resets the session token while closed', () => {
      setup();

      expect(mockResetSessionToken).toHaveBeenCalled();
    });

    it('does not reset it while open', () => {
      const { result } = setup();
      mockResetSessionToken.mockClear();

      act(() => result.current.open());

      expect(mockResetSessionToken).not.toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('starts with an empty query and no results', () => {
      const { result } = setup();

      expect(result.current.searchQuery).toBe('');
      expect(result.current.searchResults).toEqual([]);
    });

    it('records the query', () => {
      const { result } = setup();

      act(() => result.current.onSearchChange('sous'));

      expect(result.current.searchQuery).toBe('sous');
    });

    it('passes results through the transform', () => {
      mockSearchState = { data: [place()], isLoading: false };

      expect(setup().result.current.searchResults).toHaveLength(1);
    });

    // A fresh [] each render would re-render the picker list for no change.
    it('keeps a stable empty array across renders', () => {
      const { result, rerender } = setup();
      const first = result.current.searchResults;

      rerender(undefined);

      expect(result.current.searchResults).toBe(first);
    });

    it('reports the search loading state', () => {
      mockSearchState = { data: undefined, isLoading: true };

      expect(setup().result.current.isSearching).toBe(true);
    });
  });

  describe('using GPS', () => {
    it('applies the location and closes on success', async () => {
      const { result } = setup();
      act(() => result.current.open());

      await act(async () => result.current.onUseCurrentLocation());

      await waitFor(() => expect(result.current.isVisible).toBe(false));
      expect(dispatch).toHaveBeenCalled();
    });

    it('clears the loading flag on success', async () => {
      const { result } = setup();

      await act(async () => result.current.onUseCurrentLocation());

      await waitFor(() => expect(result.current.isLoadingGPS).toBe(false));
    });

    // Permission denied, or no fix. The sheet stays open so the user can pick
    // manually instead of being dropped back with nothing changed silently.
    it('keeps the sheet open when GPS is unavailable', async () => {
      requestLocation.mockResolvedValue({ success: false });
      const { result } = setup();
      act(() => result.current.open());

      await act(async () => result.current.onUseCurrentLocation());

      await waitFor(() => expect(result.current.isLoadingGPS).toBe(false));
      expect(result.current.isVisible).toBe(true);
    });

    it('keeps it open when GPS reports success but no coordinates', async () => {
      requestLocation.mockResolvedValue({ success: true });
      const { result } = setup();
      act(() => result.current.open());

      await act(async () => result.current.onUseCurrentLocation());

      await waitFor(() => expect(result.current.isLoadingGPS).toBe(false));
      expect(result.current.isVisible).toBe(true);
    });

    // The coordinates are still good; only the name lookup failed. The header
    // falls back rather than the whole action being discarded.
    it('still applies the location when reverse geocoding fails', async () => {
      (dispatch as jest.Mock).mockReturnValue({
        unwrap: () => Promise.reject(new Error('geocode down')),
      });
      const { result } = setup();
      act(() => result.current.open());

      await act(async () => result.current.onUseCurrentLocation());

      await waitFor(() => expect(result.current.isVisible).toBe(false));
    });

    it('clears the loading flag when the request itself throws', async () => {
      requestLocation.mockRejectedValue(new Error('boom'));
      const { result } = setup();

      await act(async () => result.current.onUseCurrentLocation());

      await waitFor(() => expect(result.current.isLoadingGPS).toBe(false));
    });
  });

  describe('selecting a location', () => {
    it('applies it, records it, and closes', async () => {
      const { result } = setup();
      act(() => result.current.open());

      await act(async () => result.current.onSelectLocation(place()));

      await waitFor(() => expect(result.current.isVisible).toBe(false));
      expect(setManualLocationValue).toHaveBeenCalledWith(
        { latitude: 35.8, longitude: 10.6 },
        'Sousse',
      );
      expect(saveToRecentLocations).toHaveBeenCalled();
    });

    it('prefers the city as the display name', async () => {
      const { result } = setup();

      await act(async () => result.current.onSelectLocation(place({ city: 'Sousse Ville' })));

      expect(setManualLocationValue).toHaveBeenCalledWith(expect.anything(), 'Sousse Ville');
    });

    it('clears the search query afterwards', async () => {
      const { result } = setup();
      act(() => result.current.onSearchChange('sous'));

      await act(async () => result.current.onSelectLocation(place()));

      await waitFor(() => expect(result.current.searchQuery).toBe(''));
    });

    describe('google places', () => {
      // Autocomplete carries no coordinates; Place Details is the billed call.
      it('resolves the place id and uses the resolved coordinates', async () => {
        mockResolveGooglePlace.mockResolvedValue({ coords: { lat: 1.5, lng: 2.5 } });
        const { result } = setup();

        await act(async () =>
          result.current.onSelectLocation(place({ googlePlaceId: 'abc' } as never)),
        );

        expect(mockResolveGooglePlace).toHaveBeenCalledWith('abc');
        expect(setManualLocationValue).toHaveBeenCalledWith(
          { latitude: 1.5, longitude: 2.5 },
          'Sousse',
        );
      });

      it('does not call the billed lookup without a place id', async () => {
        const { result } = setup();

        await act(async () => result.current.onSelectLocation(place()));

        expect(mockResolveGooglePlace).not.toHaveBeenCalled();
      });

      // Nothing was applied, so closing would look like it worked.
      it('changes nothing and stays open when resolution fails', async () => {
        mockResolveGooglePlace.mockResolvedValue(null);
        const { result } = setup();
        act(() => result.current.open());

        await act(async () =>
          result.current.onSelectLocation(place({ googlePlaceId: 'abc' } as never)),
        );

        expect(setManualLocationValue).not.toHaveBeenCalled();
        expect(saveToRecentLocations).not.toHaveBeenCalled();
        expect(result.current.isVisible).toBe(true);
      });
    });

    // A malformed recent entry, or a result the transform could not complete.
    it('does not apply a location with no coordinates', async () => {
      const { result } = setup();

      await act(async () =>
        result.current.onSelectLocation({ id: 'x', name: 'Nowhere' } as LocationItem),
      );

      expect(setManualLocationValue).not.toHaveBeenCalled();
      expect(saveToRecentLocations).not.toHaveBeenCalled();
    });
  });

  describe('without a current position', () => {
    it('works with null coordinates', () => {
      const { result } = setup({ coordinates: null });

      expect(result.current.isVisible).toBe(false);
      expect(result.current.searchResults).toEqual([]);
    });
  });
});
