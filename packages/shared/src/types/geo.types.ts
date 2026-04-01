/**
 * Geolocation & Proximity Search Types
 * Shared types for geo/map features matching backend proximity-search endpoints.
 */

/**
 * Coordinates for proximity search
 */
export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Address information returned from geocoding
 */
export interface AddressInfo {
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  formattedAddress?: string;
  // Backend returns nested primaryAddress
  primaryAddress?: {
    city?: string;
    postalCode?: string;
    country?: string;
    formattedAddress?: string;
  };
}

/**
 * Distance information for search results
 */
export interface DistanceInfo {
  /** Distance value in the specified unit */
  value: number;
  /** Unit of measurement */
  unit: 'meters' | 'kilometers' | 'miles';
  /** Human-readable formatted string (e.g., "1.2 km") */
  formatted: string;
}

/**
 * Geo data associated with an item
 */
export interface GeoData {
  coordinates: GeoCoordinates;
  address: AddressInfo;
}

/**
 * Offer pricing in proximity search results.
 * Uses string for currency (backend proximity-search returns plain string).
 */
export interface GeoOfferPricing {
  originalPrice: number;
  discountedPrice: number;
  discountPercentage: number;
  currency: string;
}

/**
 * Offer data returned from proximity search
 * Uses _id to match MongoDB backend responses
 */
export interface NearbyOffer {
  _id: string;
  title: string;
  description?: string;
  establishmentId: string;
  establishmentName: string;
  establishmentLogo: string | null;
  pricing: GeoOfferPricing;
  availableFrom: string;
  availableUntil: string;
  availableQuantity: number;
  categories: string[];
  images: string[];
}

/**
 * Establishment data returned from proximity search
 * Uses _id to match MongoDB backend responses
 */
export interface NearbyEstablishment {
  _id: string;
  name: string;
  type: string;
  address: AddressInfo;
  coordinates: GeoCoordinates;
  averageRating?: number;
  totalOffers?: number;
  isActive: boolean;
  isVerified: boolean;
  images?: string[];
}

/**
 * Single result from proximity search
 */
export interface ProximitySearchResult<T> {
  item: T;
  distance: DistanceInfo;
  geoData: GeoData;
}

/**
 * Lightweight offer summary returned inside MapEstablishment.
 * Mirrors backend MapOfferSummary interface.
 */
export interface MapOfferSummary {
  _id: string;
  title: string;
  description: string;
  pricing: GeoOfferPricing;
  availableFrom: string;
  availableUntil: string;
  availableQuantity: number;
  categories: string[];
  images: string[];
}

/**
 * Establishment enriched with active offers for map marker display.
 * Mirrors backend MapEstablishmentGeoData interface.
 */
export interface MapEstablishment {
  _id: string;
  name: string;
  type: string;
  profileImage: string | null;
  coordinates: GeoCoordinates;
  address: AddressInfo;
  averageRating: number;
  totalReviews: number;
  isVerified: boolean;
  activeOfferCount: number;
  offers: MapOfferSummary[];
}

/**
 * Geocode search result
 */
export interface GeocodeResult {
  coordinates: GeoCoordinates;
  displayName: string;
  address: AddressInfo;
  boundingBox?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}
