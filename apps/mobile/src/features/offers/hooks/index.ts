/**
 * Offers Hooks - Central Export
 *
 * TanStack Query hooks for offer-related data fetching.
 */

// Nearby offers hooks
export {
  useNearbyOffers,
  useNearbyEstablishments,
  useQuickSearch,
  nearbyOffersKeys,
} from './useNearbyOffers';

export type {
  UseNearbyOffersOptions,
  NearbyOffersParams,
  ProximitySearchResult,
  NearbyOffer,
  NearbyEstablishment,
  DistanceInfo,
  GeoData,
  AddressInfo,
  OfferPricing,
} from './useNearbyOffers';

// Geocoding hooks
export { useLocationSearch, useReverseGeocode, geocodeKeys } from './useGeocode';

export type { UseLocationSearchOptions, UseReverseGeocodeOptions, GeocodeResult, GeoCoordinates } from './useGeocode';
