/**
 * Offers Hooks - Central Export
 *
 * TanStack Query hooks for offer-related data fetching.
 */

// Offers data hooks (Consumer-only)
// Nearby offers hooks (proximity search)
export { useNearbyOffers, useMapEstablishments } from './useNearbyOffers';

export type {
  ProximitySearchResult,
  NearbyOffer,
  NearbyEstablishment,
  MapEstablishment,
  MapOfferSummary,
} from './useNearbyOffers';

// Geocoding hooks
export { useLocationSearch } from './useGeocode';

export type { GeocodeResult } from './useGeocode';
