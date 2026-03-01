/**
 * useGeocode Hook
 *
 * TanStack Query hooks for geocoding operations.
 * Used for manual location search with autocomplete.
 *
 * Features:
 * - Debounced search (query length >= 3)
 * - Long cache time (30 min) for geocode results
 * - Forward geocoding (address → coordinates)
 * - Reverse geocoding (coordinates → address)
 *
 * Usage:
 * ```tsx
 * const { data: results, isLoading } = useLocationSearch('Paris');
 * ```
 */

import { useQuery } from '@tanstack/react-query';

import {
  nearbyOffersService,
  type GeocodeResult,
  type GeoCoordinates,
  type AddressInfo,
} from '../services/nearbyOffersService';

// ============================================================================
// Query Key Factory
// ============================================================================

export const geocodeKeys = {
  /** Base key for all geocode queries */
  all: ['geocode'] as const,

  /** Key for forward geocode (search) */
  search: (query: string) => [...geocodeKeys.all, 'search', query] as const,

  /** Key for reverse geocode */
  reverse: (coords: GeoCoordinates) =>
    [...geocodeKeys.all, 'reverse', coords.latitude, coords.longitude] as const,
};

// ============================================================================
// useLocationSearch Hook
// ============================================================================

export interface UseLocationSearchOptions {
  /** Minimum query length to trigger search (default: 3) */
  minLength?: number;
  /** Maximum results to return (default: 5) */
  limit?: number;
  /** Whether query is enabled */
  enabled?: boolean;
  /** Debounce time in ms (handled by caller) */
}

/**
 * Search for locations by name/address (forward geocoding).
 * Typically used for city/area autocomplete in manual location selection.
 *
 * @param query - Search query (e.g., "Paris, France")
 * @param options - Query options
 * @returns TanStack Query result with matching locations
 */
export function useLocationSearch(query: string, options: UseLocationSearchOptions = {}) {
  const { minLength = 3, limit = 5, enabled = true } = options;

  const isEnabled = enabled && query.length >= minLength;

  return useQuery<GeocodeResult[], Error>({
    queryKey: geocodeKeys.search(query),
    queryFn: () => nearbyOffersService.geocodeSearch(query, limit),
    enabled: isEnabled,
    staleTime: 30 * 60 * 1000, // 30 minutes - geocode results rarely change
    gcTime: 60 * 60 * 1000, // 1 hour cache
    retry: 1, // Only retry once for geocoding
  });
}

// ============================================================================
// useReverseGeocode Hook
// ============================================================================

export interface UseReverseGeocodeOptions {
  /** Preferred language for results (default: 'en') */
  language?: string;
  /** Whether query is enabled */
  enabled?: boolean;
}

/**
 * Get address from coordinates (reverse geocoding).
 * Useful for displaying user's current location name.
 *
 * @param coordinates - Lat/lng to reverse geocode (null to disable)
 * @param options - Query options
 * @returns TanStack Query result with address information
 */
export function useReverseGeocode(
  coordinates: GeoCoordinates | null,
  options: UseReverseGeocodeOptions = {},
) {
  const { language = 'en', enabled = true } = options;

  const isEnabled = enabled && coordinates !== null;

  return useQuery<AddressInfo, Error>({
    queryKey: coordinates ? geocodeKeys.reverse(coordinates) : ['geocode', 'reverse', 'disabled'],
    queryFn: () => {
      if (!coordinates) {
        throw new Error('Coordinates required');
      }
      return nearbyOffersService.reverseGeocode(coordinates, language);
    },
    enabled: isEnabled,
    staleTime: 60 * 60 * 1000, // 1 hour - location names don't change
    gcTime: 24 * 60 * 60 * 1000, // 24 hour cache
    retry: 1,
  });
}

// ============================================================================
// Re-export Types
// ============================================================================

export type { GeocodeResult, GeoCoordinates, AddressInfo };
