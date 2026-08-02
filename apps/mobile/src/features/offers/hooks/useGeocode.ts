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

import { Freshness } from '@/lib/react-query/freshness';

import { nearbyOffersService, type GeocodeResult } from '../services/nearbyOffersService';

// ============================================================================
// Query Key Factory
// ============================================================================

const geocodeKeys = {
  /** Base key for all geocode queries */
  all: ['geocode'] as const,

  /** Key for forward geocode (search) */
  search: (query: string) => [...geocodeKeys.all, 'search', query] as const,
};

// ============================================================================
// useLocationSearch Hook
// ============================================================================

interface UseLocationSearchOptions {
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
    staleTime: Freshness.STATIC,
    gcTime: 60 * 60 * 1000, // 1 hour cache
    retry: 1, // Only retry once for geocoding
  });
}

// ============================================================================
// Re-export Types
// ============================================================================

export type { GeocodeResult };
