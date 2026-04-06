/**
 * useGeocode Hook (V2 - Hybrid Local-First Strategy with Session Tokens)
 *
 * TanStack Query hooks for geocoding operations using hybrid search.
 *
 * Primary Source: Local JSON (tunisian-cities.json)
 * Secondary Source: Google Places API (via backend proxy)
 *
 * Cost Optimization:
 * - Session tokens group all Autocomplete requests into one billing session
 * - Autocomplete requests with session token are FREE (Google Places billing)
 * - Only the Place Details call (on user selection) is billed
 * - Combined with local-first strategy, Google API calls are minimized
 *
 * Session Token Lifecycle:
 * 1. Token generated when search becomes active (user starts typing)
 * 2. Same token used for all autocomplete requests in the session
 * 3. Token passed to Place Details when user selects a Google result
 * 4. Token reset after selection (new token for next search)
 *
 * Usage:
 * ```tsx
 * const { data: results, isLoading, resolveGooglePlace } = useLocationSearch('Tunis');
 *
 * // When user selects a GOOGLE result:
 * const handleSelect = async (result: ILocationResult) => {
 *   if (result.googlePlaceId) {
 *     const resolved = await resolveGooglePlace(result.googlePlaceId);
 *     if (resolved) useCoords(resolved.coords);
 *   } else {
 *     useCoords(result.coords); // LOCAL result - coords already available
 *   }
 * };
 * ```
 *
 * @module useGeocode
 */

import { useQuery } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

import { useDebounce } from '@/hooks/useDebounce';
import { hybridLocationService } from '@/services/location/HybridLocationService';

import type { ILocationResult } from '@/types/location.types';

// ============================================================================
// Session Token Generator
// ============================================================================

/**
 * Generate a random session token for Google Places API.
 *
 * Google requires a unique string per session. UUID v4 format recommended
 * but any unique string works. We generate a UUID-like string without
 * requiring the uuid package.
 *
 * Reference: https://developers.google.com/maps/documentation/places/web-service/session-tokens
 */
function generateSessionToken(): string {
  const hex = () =>
    Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);

  return `${hex()}${hex()}-${hex()}-4${hex().substring(1)}-${hex()}-${hex()}${hex()}${hex()}`;
}

// ============================================================================
// Query Key Factory
// ============================================================================

const geocodeKeys = {
  /** Base key for all geocode queries */
  all: ['geocode', 'v2'] as const,

  /** Key for hybrid location search */
  search: (query: string) => [...geocodeKeys.all, 'search', query] as const,
};

// ============================================================================
// useLocationSearch Hook (Hybrid + Session Token)
// ============================================================================

interface UseLocationSearchOptions {
  /** Minimum query length to trigger search (default: 2) */
  minLength?: number;
  /** Maximum results to return (default: 10) */
  maxResults?: number;
  /** Minimum local results before remote fallback (default: 3) */
  minLocalResults?: number;
  /** Whether query is enabled */
  enabled?: boolean;
  /** Debounce delay in milliseconds (default: 300ms) */
  debounceDelay?: number;
  /** Enable remote Google Places fallback (default: true) */
  enableRemoteFallback?: boolean;
  /** Maximum results for useLocationSearch (v1 compat) */
  limit?: number;
}

/**
 * Search for locations using hybrid strategy with session token optimization.
 *
 * Flow:
 * 1. User types -> Debounced (300ms default)
 * 2. Search local JSON instantly
 * 3. If local results < 3 OR no exact match -> Call Google Places Autocomplete
 *    (with session token = FREE)
 * 4. Merge and deduplicate results
 * 5. When user selects a GOOGLE result -> Call resolveGooglePlace()
 *    (with same session token = ONE billed request)
 *
 * @param query - Search query (e.g., "Tunis")
 * @param options - Query options
 * @returns TanStack Query result with matching locations + resolveGooglePlace callback
 */
export function useLocationSearch(query: string, options: UseLocationSearchOptions = {}) {
  const {
    minLength = 2,
    maxResults = 10,
    minLocalResults = 3,
    enabled = true,
    debounceDelay = 300,
    enableRemoteFallback = true,
  } = options;

  // Session token ref - persists across re-renders, reset on selection
  const sessionTokenRef = useRef<string>(generateSessionToken());

  // Debounce the query to avoid excessive API calls
  const debouncedQuery = useDebounce(query, debounceDelay);

  const isEnabled = enabled && debouncedQuery.length >= minLength;

  const queryResult = useQuery<ILocationResult[], Error>({
    queryKey: geocodeKeys.search(debouncedQuery),
    queryFn: () =>
      hybridLocationService.search(debouncedQuery, {
        maxResults,
        minLocalResults,
        enableRemoteFallback,
        sessionToken: sessionTokenRef.current,
      }),
    enabled: isEnabled,
    staleTime: 30 * 60 * 1000, // 30 minutes - location results rarely change
    gcTime: 60 * 60 * 1000, // 1 hour cache
    retry: 1, // Only retry once for location searches
    refetchOnWindowFocus: false, // Don't refetch on focus
  });

  /**
   * Resolve full details (coordinates) for a Google Place result.
   *
   * Call this when the user selects a result with googlePlaceId set.
   * This concludes the session token billing session and generates
   * a new token for the next search.
   *
   * @param googlePlaceId - Google Place ID from the selected result
   * @returns ILocationResult with real coordinates, or null on failure
   */
  const resolveGooglePlace = useCallback(
    async (googlePlaceId: string): Promise<ILocationResult | null> => {
      const currentToken = sessionTokenRef.current;

      // Reset session token immediately (session concluded by Place Details call)
      sessionTokenRef.current = generateSessionToken();

      return hybridLocationService.resolveGooglePlace(googlePlaceId, currentToken);
    },
    [],
  );

  /**
   * Reset the session token manually (e.g., when modal closes without selection)
   */
  const resetSessionToken = useCallback(() => {
    sessionTokenRef.current = generateSessionToken();
  }, []);

  return {
    ...queryResult,
    resolveGooglePlace,
    resetSessionToken,
  };
}

// ============================================================================
// Re-export Types
// ============================================================================
