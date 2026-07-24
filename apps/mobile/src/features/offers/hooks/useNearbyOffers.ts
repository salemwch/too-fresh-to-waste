/**
 * useNearbyOffers Hook
 *
 * TanStack Query hook for fetching nearby offers based on user location.
 * Integrates with nearbyOffersService and Redux auth state.
 *
 * Features:
 * - Automatic refetch on screen focus
 * - Stale time: 5 minutes
 * - Cache time: 1 hour
 * - Requires valid auth token
 *
 * Usage:
 * ```tsx
 * const { data: offers, isLoading, error, refetch } = useNearbyOffers({
 *   center: { latitude: 48.8566, longitude: 2.3522 },
 *   radius: 5000,
 * });
 * ```
 */

import { useAppSelector } from '@/hooks/redux';
import { useQueryWithFocus } from '@/lib/react-query/hooks';
import { selectIsAuthenticated } from '@/features/auth/store/authSlice';

import {
  nearbyOffersService,
  type NearbyOffersParams,
  type ProximitySearchResult,
  type NearbyOffer,
  type MapEstablishment,
} from '../services/nearbyOffersService';

// ============================================================================
// Query Key Factory
// ============================================================================

/**
 * Query key factory for nearby offers queries.
 * Enables targeted cache invalidation and proper cache separation.
 */
const nearbyOffersKeys = {
  /** Base key for all nearby offers queries */
  all: ['nearbyOffers'] as const,

  /** Key for offer search with specific params */
  offers: (params: NearbyOffersParams | null) =>
    [...nearbyOffersKeys.all, 'offers', params] as const,

  /** Key for map establishments (with embedded offers) */
  mapEstablishments: (params: NearbyOffersParams | null) =>
    [...nearbyOffersKeys.all, 'mapEstablishments', params] as const,
};

// ============================================================================
// useNearbyOffers Hook
// ============================================================================

interface UseNearbyOffersOptions {
  /** Whether the query is enabled (default: true when params provided) */
  enabled?: boolean;
  /** Stale time in ms (default: 5 minutes) */
  staleTime?: number;
  /** Refetch on window focus (default: true) */
  refetchOnFocus?: boolean;
}

/**
 * Fetch nearby offers based on location parameters.
 *
 * @param params - Search parameters (null to disable query)
 * @param options - Query options
 * @returns TanStack Query result with offers data
 */
export function useNearbyOffers(
  params: NearbyOffersParams | null,
  options: UseNearbyOffersOptions = {},
) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  const { enabled = true, staleTime = 5 * 60 * 1000, refetchOnFocus = true } = options;

  const isEnabled = enabled && !!params && isAuthenticated;

  return useQueryWithFocus<ProximitySearchResult<NearbyOffer>[], Error>(
    nearbyOffersKeys.offers(params),
    async () => {
      if (!params) {
        throw new Error('Missing required parameters');
      }
      return nearbyOffersService.searchOffers(params);
    },
    {
      enabled: isEnabled,
      staleTime,
      gcTime: 60 * 60 * 1000, // 1 hour cache
    },
    refetchOnFocus,
  );
}

// ============================================================================
// useMapEstablishments Hook
// ============================================================================

/**
 * Fetch establishments with their active offers for map markers.
 * Public endpoint — no auth required.
 *
 * @param params - Search parameters (null to disable query)
 * @param options - Query options
 * @returns TanStack Query result with map establishment data
 */
export function useMapEstablishments(
  params: NearbyOffersParams | null,
  options: UseNearbyOffersOptions = {},
) {
  const { enabled = true, staleTime = 3 * 60 * 1000, refetchOnFocus = true } = options;

  const isEnabled = enabled && !!params;

  return useQueryWithFocus<ProximitySearchResult<MapEstablishment>[], Error>(
    nearbyOffersKeys.mapEstablishments(params),
    async () => {
      if (!params) {
        throw new Error('Missing required parameters');
      }
      return nearbyOffersService.searchMapEstablishments(params);
    },
    {
      enabled: isEnabled,
      staleTime,
      gcTime: 60 * 60 * 1000,
    },
    refetchOnFocus,
  );
}

// ============================================================================
// Re-export Types
// ============================================================================

export type {
  ProximitySearchResult,
  NearbyOffer,
  NearbyEstablishment,
  MapEstablishment,
  MapOfferSummary,
} from '../services/nearbyOffersService';
