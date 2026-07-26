/**
 * Search field + place selection state.
 *
 * Choosing a Google place and choosing an app establishment were written as two
 * handlers that differed only in how they derived a name, an address and a pair
 * of coordinates — the six writes that follow were identical. They now share
 * `selectPlace`, so "what happens when you pick something" is defined once.
 *
 * Effects it cannot own are injected: moving the camera, writing the location
 * store, resolving a Google place id, and clearing the map's marker selection.
 * That keeps this hook about *selection* rather than about the map.
 */

import { useCallback, useState } from 'react';

import { usePlaceSearch } from './usePlaceSearch';

import type { NearbyEstablishment, ProximitySearchResult } from '@/features/offers/hooks';
import type { ILocationResult } from '@/types/location.types';

interface Coordinates {
  latitude: number;
  longitude: number;
}

/** A chosen place: drives the bottom sheet and re-centres the offer query. */
export interface SelectedPlace {
  name: string;
  address: string;
  coordinates: Coordinates;
}

/** Below this the dropdown stays closed — matches usePlaceSearch's minLength. */
const MIN_QUERY_LENGTH = 2;

const UNKNOWN_PLACE_NAME = 'Unknown';

/** Long enough for a tap on a result to beat the blur that hides the panel. */
const BLUR_DISMISS_DELAY_MS = 200;

interface UseSearchPlaceSelectionParams {
  /** Where to search from, and how wide — passed through to usePlaceSearch. */
  center: Coordinates;
  radiusMeters: number;
  animateTo: (coordinates: Coordinates) => void;
  setManualLocationValue: (coordinates: Coordinates, name: string) => void;
  /** Clears the map's marker selection — a new place supersedes it. */
  onPlaceSelected: () => void;
}

export interface SearchPlaceSelection {
  searchQuery: string;
  showPlaceResults: boolean;
  selectedPlace: SelectedPlace | null;
  /** Google Places suggestions for the current query. */
  googleResults: ILocationResult[];
  /** Establishments already on the platform. */
  appResults: ProximitySearchResult<NearbyEstablishment>[];
  isSearching: boolean;
  /** Debounced query — what the results actually correspond to. */
  debouncedQuery: string;
  handleSearchChange: (text: string) => void;
  handleClearSearch: () => void;
  /** Re-opens the panel on focus when there is already a query to show. */
  handleSearchFocus: () => void;
  handleSearchBlur: () => void;
  handleGooglePlacePress: (place: ILocationResult) => void;
  handleAppEstablishmentSelect: (establishment: ProximitySearchResult<NearbyEstablishment>) => void;
  /** Dismiss the place sheet without changing the location. */
  closePlaceSheet: () => void;
}

/**
 * Owns usePlaceSearch rather than taking its output as parameters. The query
 * lives here, and resolving a Google place id is part of selecting one — wiring
 * those through the screen would mean the screen holding the query for the
 * search hook while the search hook hands back the resolver this one needs.
 */
export function useSearchPlaceSelection({
  center,
  radiusMeters,
  animateTo,
  setManualLocationValue,
  onPlaceSelected,
}: UseSearchPlaceSelectionParams): SearchPlaceSelection {
  const [searchQuery, setSearchQuery] = useState('');
  const [showPlaceResults, setShowPlaceResults] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);

  const {
    googleResults,
    appResults,
    isLoading: isSearching,
    resolveGooglePlace,
    resetSessionToken,
    debouncedQuery,
  } = usePlaceSearch(searchQuery, center, radiusMeters, {
    minLength: MIN_QUERY_LENGTH,
    debounceDelay: 300,
    googleLimit: 5,
    appLimit: 10,
  });

  /**
   * Everything that happens when a place is chosen, from either source: record
   * it, make it the active location, dismiss the search UI, drop any marker
   * selection, and move the camera.
   */
  const selectPlace = useCallback(
    (place: SelectedPlace) => {
      setSelectedPlace(place);
      setManualLocationValue(place.coordinates, place.name);
      setSearchQuery('');
      setShowPlaceResults(false);
      onPlaceSelected();
      animateTo(place.coordinates);
    },
    [animateTo, setManualLocationValue, onPlaceSelected],
  );

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    setShowPlaceResults(text.length >= MIN_QUERY_LENGTH);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setShowPlaceResults(false);
    // Ends the Google autocomplete session so the next search is billed as new.
    resetSessionToken();
  }, [resetSessionToken]);

  const handleSearchFocus = useCallback(() => {
    setShowPlaceResults(searchQuery.length >= MIN_QUERY_LENGTH);
  }, [searchQuery]);

  /**
   * Closing is deferred: blur fires before the press on a result lands, so
   * hiding immediately would unmount the row before its onPress runs.
   */
  const handleSearchBlur = useCallback(() => {
    setTimeout(() => setShowPlaceResults(false), BLUR_DISMISS_DELAY_MS);
  }, []);

  const handleGooglePlaceSelect = useCallback(
    async (place: ILocationResult) => {
      let coords = place.coords;

      // Autocomplete gives no coordinates; Place Details does. This is the
      // billed call, and it concludes the session token.
      if (place.googlePlaceId != null) {
        const resolved = await resolveGooglePlace(place.googlePlaceId);
        if (!resolved) return;
        coords = resolved.coords;
      }

      selectPlace({
        name: place.name || UNKNOWN_PLACE_NAME,
        address: place.subtext ?? place.formattedAddress ?? '',
        coordinates: { latitude: coords.lat, longitude: coords.lng },
      });
    },
    [resolveGooglePlace, selectPlace],
  );

  /** The dropdown's onPress is sync; failures are handled inside. */
  const handleGooglePlacePress = useCallback(
    (place: ILocationResult) => {
      void handleGooglePlaceSelect(place);
    },
    [handleGooglePlaceSelect],
  );

  const handleAppEstablishmentSelect = useCallback(
    (establishment: ProximitySearchResult<NearbyEstablishment>) => {
      const est = establishment.item;

      selectPlace({
        name: est.name,
        address: est.address?.formattedAddress ?? est.address?.city ?? '',
        coordinates: {
          latitude: est.coordinates?.latitude ?? establishment.geoData.coordinates.latitude,
          longitude: est.coordinates?.longitude ?? establishment.geoData.coordinates.longitude,
        },
      });
    },
    [selectPlace],
  );

  const closePlaceSheet = useCallback(() => setSelectedPlace(null), []);

  return {
    searchQuery,
    showPlaceResults,
    selectedPlace,
    googleResults,
    appResults,
    isSearching,
    debouncedQuery,
    handleSearchChange,
    handleClearSearch,
    handleSearchFocus,
    handleSearchBlur,
    handleGooglePlacePress,
    handleAppEstablishmentSelect,
    closePlaceSheet,
  };
}
