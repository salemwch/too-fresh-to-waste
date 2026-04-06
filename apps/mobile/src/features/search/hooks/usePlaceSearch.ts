/**
 * usePlaceSearch Hook
 *
 * Unified search hook that combines Google Places Autocomplete and
 * app establishment search into a single dropdown experience.
 *
 * Architecture:
 * - Google Places Autocomplete (via backend proxy, FREE with session token)
 * - App establishment search (POST /proximity-search/establishments with query)
 * - Both run in parallel via Promise.all
 * - Results separated into two sections for the dropdown UI
 *
 * Session Token Lifecycle (Google billing optimization):
 * 1. Token generated when search session starts
 * 2. Same token used for all autocomplete requests
 * 3. Token passed to Place Details on selection (billed call)
 * 4. Token reset after selection
 *
 * @module usePlaceSearch
 */

import { useQuery } from '@tanstack/react-query';
import { useCallback, useRef, useMemo } from 'react';

import {
  nearbyOffersService,
  type ProximitySearchResult,
  type NearbyEstablishment,
  type GeoCoordinates,
} from '@/features/offers/services/nearbyOffersService';
import { useDebounce } from '@/hooks/useDebounce';
import { remoteLocationService } from '@/services/location/RemoteLocationService';
import { Logger } from '@/utils/logger';

import type { ILocationResult } from '@/types/location.types';

// ============================================================================
// Session Token Generator
// ============================================================================

/**
 * Generate a random session token for Google Places API billing optimization.
 * UUID v4-like format without requiring the uuid package.
 */
function generateSessionToken(): string {
  const hex = () =>
    Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);

  return `${hex()}${hex()}-${hex()}-4${hex().substring(1)}-${hex()}-${hex()}${hex()}${hex()}`;
}

// ============================================================================
// Types
// ============================================================================

interface PlaceSearchResult {
  /** Google Places autocomplete results (placeholder coords until selected) */
  googleResults: ILocationResult[];
  /** App registered establishments from MongoDB */
  appResults: ProximitySearchResult<NearbyEstablishment>[];
}

interface UsePlaceSearchOptions {
  /** Minimum query length to trigger search (default: 2) */
  minLength?: number;
  /** Debounce delay in ms (default: 300) */
  debounceDelay?: number;
  /** Max Google results (default: 5) */
  googleLimit?: number;
  /** Max app establishment results (default: 10) */
  appLimit?: number;
  /** Whether search is enabled (default: true) */
  enabled?: boolean;
}

// ============================================================================
// Query Key Factory
// ============================================================================

const placeSearchKeys = {
  all: ['placeSearch'] as const,
  search: (query: string, center: GeoCoordinates) =>
    [...placeSearchKeys.all, query, center.latitude, center.longitude] as const,
};

// ============================================================================
// usePlaceSearch Hook
// ============================================================================

/**
 * Unified place search combining Google Places + app establishments.
 *
 * @param query - User search query
 * @param center - Current map center for proximity search
 * @param radius - Search radius in meters
 * @param options - Configuration options
 */
export function usePlaceSearch(
  query: string,
  center: GeoCoordinates,
  radius: number,
  options: UsePlaceSearchOptions = {},
) {
  const {
    minLength = 2,
    debounceDelay = 300,
    googleLimit = 5,
    appLimit = 10,
    enabled = true,
  } = options;

  // Session token for Google Places billing optimization
  const sessionTokenRef = useRef<string>(generateSessionToken());

  // Debounce the query
  const debouncedQuery = useDebounce(query, debounceDelay);

  const isEnabled = enabled && debouncedQuery.length >= minLength;

  // Stable search params to avoid unnecessary refetches
  const searchCenter = useMemo(
    () => ({ latitude: center.latitude, longitude: center.longitude }),
    [center.latitude, center.longitude],
  );

  const queryResult = useQuery<PlaceSearchResult, Error>({
    queryKey: placeSearchKeys.search(debouncedQuery, searchCenter),
    queryFn: async (): Promise<PlaceSearchResult> => {
      const sessionToken = sessionTokenRef.current;

      // Run both searches in parallel
      const [googleResults, appResults] = await Promise.all([
        // Google Places Autocomplete (FREE with session token)
        remoteLocationService
          .autocomplete(debouncedQuery, sessionToken, googleLimit)
          .catch(error => {
            Logger.warn('[usePlaceSearch] Google autocomplete failed:', error);
            return [] as ILocationResult[];
          }),

        // App establishment search from MongoDB
        nearbyOffersService
          .searchEstablishments({
            center: searchCenter,
            radius,
            limit: appLimit,
            query: debouncedQuery,
            sortByDistance: true,
          })
          .catch(error => {
            Logger.warn('[usePlaceSearch] App establishment search failed:', error);
            return [] as ProximitySearchResult<NearbyEstablishment>[];
          }),
      ]);

      return { googleResults, appResults };
    },
    enabled: isEnabled,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
    refetchOnWindowFocus: false,
  });

  /**
   * Resolve full coordinates for a Google Place result.
   * Concludes the session token billing session.
   *
   * @param googlePlaceId - Google Place ID from selected result
   * @returns ILocationResult with real coordinates, or null
   */
  const resolveGooglePlace = useCallback(
    async (googlePlaceId: string): Promise<ILocationResult | null> => {
      const currentToken = sessionTokenRef.current;

      // Reset token (session concluded by Place Details call)
      sessionTokenRef.current = generateSessionToken();

      return remoteLocationService.getPlaceDetails(googlePlaceId, currentToken);
    },
    [],
  );

  /**
   * Reset session token (e.g., when search is cleared without selection)
   */
  const resetSessionToken = useCallback(() => {
    sessionTokenRef.current = generateSessionToken();
  }, []);

  // Convenience accessors
  const googleResults = queryResult.data?.googleResults ?? [];
  const appResults = queryResult.data?.appResults ?? [];
  const hasResults = googleResults.length > 0 || appResults.length > 0;
  const totalResults = googleResults.length + appResults.length;

  return {
    ...queryResult,
    googleResults,
    appResults,
    hasResults,
    totalResults,
    resolveGooglePlace,
    resetSessionToken,
    debouncedQuery,
  };
}
