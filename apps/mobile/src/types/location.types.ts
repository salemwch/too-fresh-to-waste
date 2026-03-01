/**
 * Location Search Types
 *
 * Unified interface for location results from both LOCAL and GOOGLE sources.
 * This is the single source of truth for location data across the app.
 *
 * @module LocationTypes
 */

/**
 * Source of the location data
 * - LOCAL: From bundled tunisian-cities.json
 * - GOOGLE: From Google Places API via backend proxy
 */
export type LocationSource = 'LOCAL' | 'GOOGLE';

/**
 * Geographic coordinates
 */
export interface LocationCoords {
  /** Latitude in decimal degrees (-90 to 90) */
  lat: number;
  /** Longitude in decimal degrees (-180 to 180) */
  lng: number;
}

/**
 * Unified location result interface
 *
 * This interface is used by all location search components.
 * Both LOCAL and GOOGLE sources must be mapped to this format.
 *
 * UI components MUST only accept ILocationResult[] - they should
 * NOT know about the underlying data formats (JSON or Google API).
 */
export interface ILocationResult {
  /**
   * Unique identifier for the location
   * Format: `${source}_${city}_${delegation}_${postalCode}`
   * Example: "LOCAL_TUNIS_CARTHAGE_2016"
   */
  id: string;

  /**
   * Primary name in Latin script (English or French)
   * Example: "Carthage" or "CARTHAGE (Cartage Byrsa)"
   */
  name: string;

  /**
   * Name in Arabic script
   * Fallback to `name` if Arabic not available
   * Example: "قرطاج"
   */
  nameAr: string;

  /**
   * Subtext providing context (delegation, city, or full address)
   * Example: "Tunis, Tunisia" or "حومة السوق، جربة"
   */
  subtext: string;

  /**
   * Geographic coordinates
   */
  coords: LocationCoords;

  /**
   * Data source identifier
   */
  source: LocationSource;

  /**
   * Optional postal code (primarily for LOCAL sources)
   */
  postalCode?: string;

  /**
   * Optional formatted address (primarily for GOOGLE sources)
   */
  formattedAddress?: string;

  /**
   * Google Place ID for deferred detail fetching (GOOGLE sources only).
   * When present, coords may be placeholder values (0, 0) until
   * the user selects this result and Place Details are fetched.
   */
  googlePlaceId?: string;
}

/**
 * Raw delegation data from tunisian-cities.json
 */
export interface TunisianDelegation {
  Name: string;
  NameAr: string;
  Value: string;
  PostalCode: string;
  Latitude: number;
  Longitude: number;
}

/**
 * Raw city data from tunisian-cities.json
 */
export interface TunisianCity {
  Name: string;
  NameAr: string;
  Value: string;
  Delegations: TunisianDelegation[];
}

/**
 * Google Places API response (simplified)
 */
export interface GooglePlaceResult {
  place_id: string;
  formatted_address: string;
  name: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
}
