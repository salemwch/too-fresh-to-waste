/**
 * Offers Services - Central Export
 *
 * API services for offer-related operations.
 */

export { nearbyOffersService } from './nearbyOffersService';
export { offersService } from './offersService';

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
