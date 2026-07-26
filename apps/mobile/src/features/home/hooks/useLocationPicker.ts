/**
 * The location-picker bottom sheet: visibility, search, GPS, and selection.
 *
 * One hook rather than four scattered pieces of screen state, because they only
 * make sense together — the search query drives the results, selecting a result
 * closes the sheet and records a recent location, and the GPS path does the same
 * thing by a different route.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useLocationSearch } from '@/features/offers/hooks/useGeocode.v2';
import { reverseGeocodeAsync } from '@/store/slices/locationSlice';
import { Logger } from '@/utils/logger';
import { transformLocationResultsToItems } from '@/utils/location';

import type { LocationItem } from '@/navigation/components';
import type { AppDispatch } from '@/store';

/**
 * Stable empty result. `locationResults ?? []` would hand the picker a new array
 * identity on every render while a search is in flight, re-rendering the list
 * for no change. See .claude/rules/performance.md.
 */
const NO_RESULTS: LocationItem[] = [];

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_LENGTH = 2;
const SEARCH_MAX_RESULTS = 10;

/**
 * Coordinates are rounded to ~11km before being used to rank search results.
 * Ranking does not get better with more precision, and reacting to raw GPS
 * would re-run the search on every jitter.
 */
const COARSE_PRECISION = 10;

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface UseLocationPickerParams {
  /** Current position, used to geo-rank search results. */
  coordinates: Coordinates | null;
  requestLocation: () => Promise<{ success: boolean; coordinates?: Coordinates | undefined }>;
  setManualLocationValue: (coordinates: Coordinates, name: string) => void;
  saveToRecentLocations: (location: LocationItem) => void;
  dispatch: AppDispatch;
}

export interface LocationPicker {
  isVisible: boolean;
  open: () => void;
  close: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchResults: LocationItem[];
  isSearching: boolean;
  /** True while acquiring GPS and resolving its name. */
  isLoadingGPS: boolean;
  onUseCurrentLocation: () => void;
  onSelectLocation: (location: LocationItem) => void;
}

export function useLocationPicker({
  coordinates,
  requestLocation,
  setManualLocationValue,
  saveToRecentLocations,
  dispatch,
}: UseLocationPickerParams): LocationPicker {
  const [isVisible, setIsVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingGPS, setIsLoadingGPS] = useState(false);

  const coarseLat =
    coordinates != null
      ? Math.round(coordinates.latitude * COARSE_PRECISION) / COARSE_PRECISION
      : null;
  const coarseLng =
    coordinates != null
      ? Math.round(coordinates.longitude * COARSE_PRECISION) / COARSE_PRECISION
      : null;

  const userCoords = useMemo(
    () => (coordinates ? { lat: coordinates.latitude, lng: coordinates.longitude } : undefined),
    // `coordinates` is deliberately omitted: reacting to it is the exact
    // behaviour the rounding exists to prevent. The coarse pair is the intended
    // trigger, and it is derived from `coordinates`, so the value read inside
    // can never be older than the last meaningful move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coarseLat, coarseLng],
  );

  const {
    data: locationResults,
    isLoading: isSearching,
    resolveGooglePlace,
    resetSessionToken,
  } = useLocationSearch(searchQuery, {
    debounceDelay: SEARCH_DEBOUNCE_MS,
    minLength: SEARCH_MIN_LENGTH,
    maxResults: SEARCH_MAX_RESULTS,
    enableRemoteFallback: true,
    ...(userCoords ? { userCoords } : {}),
  });

  const searchResults = useMemo<LocationItem[]>(
    () => (locationResults ? transformLocationResultsToItems(locationResults, false) : NO_RESULTS),
    [locationResults],
  );

  const open = useCallback(() => setIsVisible(true), []);
  const close = useCallback(() => setIsVisible(false), []);
  const onSearchChange = useCallback((query: string) => setSearchQuery(query), []);

  // Closing ends the Google autocomplete session, so the next search is billed
  // as a new one rather than extending the last.
  useEffect(() => {
    if (!isVisible) resetSessionToken();
  }, [isVisible, resetSessionToken]);

  /**
   * GPS path: acquire coordinates, then resolve a display name.
   *
   * The sheet stays open with its spinner until the name is resolved, so the
   * header does not flash "Current Location" before settling. A failed
   * reverse geocode is not fatal — the coordinates are still good, and the
   * header falls back.
   */
  const acquireCurrentLocation = useCallback(async (): Promise<void> => {
    setIsLoadingGPS(true);

    try {
      const result = await requestLocation();
      if (!result.success || !result.coordinates) return;

      try {
        await dispatch(reverseGeocodeAsync(result.coordinates)).unwrap();
      } catch (error) {
        Logger.warn('[useLocationPicker] Reverse geocoding failed, using fallback', {
          error: String(error),
        });
      }

      setIsVisible(false);
    } catch (error) {
      Logger.error('[useLocationPicker] Failed to get current location', {}, error as Error);
    } finally {
      setIsLoadingGPS(false);
    }
  }, [requestLocation, dispatch]);

  /** The sheet's onPress is synchronous; failures are handled above. */
  const onUseCurrentLocation = useCallback(() => {
    void acquireCurrentLocation();
  }, [acquireCurrentLocation]);

  const selectLocation = useCallback(
    async (location: LocationItem): Promise<void> => {
      let { latitude, longitude } = location;

      // Autocomplete carries no coordinates; Place Details does. This is the
      // billed call, so it only runs on selection.
      if (location.googlePlaceId != null) {
        const resolved = await resolveGooglePlace(location.googlePlaceId);
        // Without coordinates there is nothing to select — leave the sheet open
        // rather than closing it on a location that was never applied.
        if (!resolved) return;

        latitude = resolved.coords.lat;
        longitude = resolved.coords.lng;
      }

      if (latitude != null && longitude != null) {
        setManualLocationValue({ latitude, longitude }, location.city ?? location.name);
        saveToRecentLocations({ ...location, latitude, longitude });
      }

      setIsVisible(false);
      setSearchQuery('');
    },
    [setManualLocationValue, saveToRecentLocations, resolveGooglePlace],
  );

  const onSelectLocation = useCallback(
    (location: LocationItem) => {
      void selectLocation(location);
    },
    [selectLocation],
  );

  return {
    isVisible,
    open,
    close,
    searchQuery,
    onSearchChange,
    searchResults,
    isSearching,
    isLoadingGPS,
    onUseCurrentLocation,
    onSelectLocation,
  };
}
