/**
 * Offers Services - Central Export
 *
 * API services for offer-related operations.
 *
 * NOTE: offersService now uses facade pattern for safe migration
 * - Development/Staging: Uses V2 (auto token refresh) ✅
 * - Production: Uses V1 (manual tokens) until rollout
 */

export { nearbyOffersService } from './nearbyOffersService';
export { offersServiceFacade as offersService } from './offersService.facade';

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

export type { NearbyOffersParams } from './offersService';
