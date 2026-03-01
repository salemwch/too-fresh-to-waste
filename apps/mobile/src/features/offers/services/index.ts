/**
 * Offers Services - Central Export
 *
 * API services for offer-related operations.
 * All endpoints require authentication (JWT via apiClient interceptor).
 */

export { offersService } from './offersService';
export { nearbyOffersService } from './nearbyOffersService';

export type { NearbyOffersParams } from './offersService';

export type {
  GeoCoordinates,
  AddressInfo,
  DistanceInfo,
  GeoData,
  OfferPricing,
  NearbyOffer,
  NearbyEstablishment,
  ProximitySearchResult,
  NearbyOffersParams as NearbyOffersServiceParams,
  GeocodeResult,
} from './nearbyOffersService';
