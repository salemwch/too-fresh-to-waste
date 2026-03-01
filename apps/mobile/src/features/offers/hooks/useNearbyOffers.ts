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

import {
  nearbyOffersService,
  type NearbyOffersParams,
  type ProximitySearchResult,
  type NearbyOffer,
  type NearbyEstablishment,
  type MapEstablishment,
} from '../services/nearbyOffersService';

// ============================================================================
// Query Key Factory
// ============================================================================

/**
 * Query key factory for nearby offers queries.
 * Enables targeted cache invalidation and proper cache separation.
 */
export const nearbyOffersKeys = {
  /** Base key for all nearby offers queries */
  all: ['nearbyOffers'] as const,

  /** Key for offer search with specific params */
  offers: (params: NearbyOffersParams | null) =>
    [...nearbyOffersKeys.all, 'offers', params] as const,

  /** Key for establishment search */
  establishments: (params: NearbyOffersParams | null) =>
    [...nearbyOffersKeys.all, 'establishments', params] as const,

  /** Key for quick search */
  quickSearch: (lat: number, lng: number, radius: number) =>
    [...nearbyOffersKeys.all, 'quick', { lat, lng, radius }] as const,

  /** Key for map establishments (with embedded offers) */
  mapEstablishments: (params: NearbyOffersParams | null) =>
    [...nearbyOffersKeys.all, 'mapEstablishments', params] as const,
};

// ============================================================================
// useNearbyOffers Hook
// ============================================================================

export interface UseNearbyOffersOptions {
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
  const { tokens } = useAppSelector(state => state.auth);

  const {
    enabled = true,
    staleTime = 5 * 60 * 1000, // 5 minutes
    refetchOnFocus = true,
  } = options;

  const isEnabled = enabled && !!params && !!tokens?.accessToken;

  return useQueryWithFocus<ProximitySearchResult<NearbyOffer>[], Error>(
    nearbyOffersKeys.offers(params),
    async () => {
      if (!params || !tokens?.accessToken) {
        throw new Error('Missing required parameters');
      }
      return nearbyOffersService.searchOffers(params, tokens.accessToken);
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
// useNearbyEstablishments Hook
// ============================================================================

/**
 * Fetch nearby establishments (public endpoint, no auth required).
 *
 * @param params - Search parameters (null to disable query)
 * @param options - Query options
 * @returns TanStack Query result with establishments data
 */
export function useNearbyEstablishments(
  params: NearbyOffersParams | null,
  options: UseNearbyOffersOptions = {},
) {
  const { enabled = true, staleTime = 5 * 60 * 1000, refetchOnFocus = true } = options;

  const isEnabled = enabled && !!params;

  return useQueryWithFocus<ProximitySearchResult<NearbyEstablishment>[], Error>(
    nearbyOffersKeys.establishments(params),
    async () => {
      if (!params) {
        throw new Error('Missing required parameters');
      }
      return nearbyOffersService.searchEstablishments(params);
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
// useQuickSearch Hook
// ============================================================================

/**
 * Quick search for nearby establishments (public endpoint).
 *
 * @param latitude - Center latitude (null to disable)
 * @param longitude - Center longitude (null to disable)
 * @param radius - Search radius in meters
 * @param options - Query options
 * @returns TanStack Query result with establishments
 */
export function useQuickSearch(
  latitude: number | null,
  longitude: number | null,
  radius: number,
  options: UseNearbyOffersOptions = {},
) {
  const { enabled = true, staleTime = 5 * 60 * 1000, refetchOnFocus = true } = options;

  const isEnabled = enabled && latitude !== null && longitude !== null;

  return useQueryWithFocus<ProximitySearchResult<NearbyEstablishment>[], Error>(
    nearbyOffersKeys.quickSearch(latitude ?? 0, longitude ?? 0, radius),
    async () => {
      if (latitude === null || longitude === null) {
        throw new Error('Missing coordinates');
      }
      return nearbyOffersService.quickSearch(latitude, longitude, radius);
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
  NearbyOffersParams,
  ProximitySearchResult,
  NearbyOffer,
  NearbyEstablishment,
  MapEstablishment,
  MapOfferSummary,
  DistanceInfo,
  GeoData,
  AddressInfo,
  OfferPricing,
} from '../services/nearbyOffersService';
