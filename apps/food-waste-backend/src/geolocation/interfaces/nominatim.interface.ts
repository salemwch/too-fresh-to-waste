/**
 * OpenStreetMap Nominatim API Interfaces
 * https://nominatim.openstreetmap.org/ui/search.html
 */

import { GeoCoordinate, AddressInfo, GeocodingAccuracy } from './geolocation.interface';

export interface NominatimSearchParams {
  q?: string; // Free-form query string
  street?: string; // House number and street name
  city?: string; // City name
  county?: string; // County
  state?: string; // State
  country?: string; // Country
  postalcode?: string; // Postal code
  countrycodes?: string; // Limit to specific countries (comma-separated ISO 3166-1 country codes)
  addressdetails?: number; // Include breakdown of address into elements (0 or 1)
  extratags?: number; // Include additional information (0 or 1)
  namedetails?: number; // Include list of alternative names (0 or 1)
  limit?: number; // Maximum number of results (default: 10, max: 50)
  format?: 'json' | 'jsonv2' | 'geojson' | 'geocodejson'; // Output format
  polygon_geojson?: number; // Include polygon outline (0 or 1)
  polygon_kml?: number; // Include polygon as KML (0 or 1)
  polygon_svg?: number; // Include polygon as SVG (0 or 1)
  polygon_text?: number; // Include polygon as WKT (0 or 1)
  polygon_threshold?: number; // Simplify polygon (0.0-1.0)
  viewbox?: string; // Preferred area to find search results (left,top,right,bottom)
  bounded?: number; // Restrict results to viewbox area (0 or 1)
  dedupe?: number; // Remove duplicate results (0 or 1, default: 1)
  'accept-language'?: string; // Preferred language for results
}

export interface NominatimReverseParams {
  lat: number; // Latitude
  lon: number; // Longitude
  format?: 'json' | 'jsonv2' | 'geojson' | 'geocodejson'; // Output format
  addressdetails?: number; // Include breakdown of address (0 or 1, default: 0)
  extratags?: number; // Include additional information (0 or 1)
  namedetails?: number; // Include list of alternative names (0 or 1)
  zoom?: number; // Level of detail (3-18, default: 18)
  'accept-language'?: string; // Preferred language for results
}

export interface NominatimSearchResult {
  place_id: number;
  licence: string;
  osm_type: 'node' | 'way' | 'relation';
  osm_id: number;
  lat: string;
  lon: string;
  category: string;
  type: string;
  place_rank: number;
  importance: number;
  addresstype: string;
  name: string;
  display_name: string;
  boundingbox: [string, string, string, string]; // [min_lat, max_lat, min_lon, max_lon]
  address?: NominatimAddress;
  extratags?: Record<string, string>;
  namedetails?: Record<string, string>;
  geojson?: any;
}

export interface NominatimReverseResult {
  place_id: number;
  licence: string;
  osm_type: 'node' | 'way' | 'relation';
  osm_id: number;
  lat: string;
  lon: string;
  category: string;
  type: string;
  place_rank: number;
  importance: number;
  addresstype: string;
  name: string;
  display_name: string;
  address?: NominatimAddress;
  extratags?: Record<string, string>;
  namedetails?: Record<string, string>;
  boundingbox: [string, string, string, string];
}

export interface NominatimAddress {
  house_number?: string;
  road?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city?: string;
  city_district?: string;
  county?: string;
  state_district?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
  neighbourhood?: string;
  quarter?: string;
  residential?: string;
  commercial?: string;
  industrial?: string;
  retail?: string;
  amenity?: string;
  tourism?: string;
  historic?: string;
  building?: string;
  public_building?: string;
  place_of_worship?: string;
  shop?: string;
  craft?: string;
  office?: string;
  leisure?: string;
  man_made?: string;
  natural?: string;
  landuse?: string;
  boundary?: string;
  railway?: string;
  aeroway?: string;
  waterway?: string;
  emergency?: string;
  military?: string;
  highway?: string;
}

export interface NominatimGeocodingResult {
  coordinates: GeoCoordinate;
  address: AddressInfo;
  bounds?: {
    northeast: GeoCoordinate;
    southwest: GeoCoordinate;
  };
  accuracy: GeocodingAccuracy;
  provider: 'nominatim';
  raw: NominatimSearchResult;
  placeId: number;
  osmType: string;
  osmId: number;
  category: string;
  type: string;
  importance: number;
  displayName: string;
}

export interface NominatimReverseGeocodingResult {
  coordinates: GeoCoordinate;
  address: AddressInfo;
  provider: 'nominatim';
  raw: NominatimReverseResult;
  placeId: number;
  osmType: string;
  osmId: number;
  category: string;
  type: string;
  importance: number;
  displayName: string;
}

export interface NominatimConfig {
  baseUrl: string;
  userAgent: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  rateLimit: {
    requestsPerSecond: number;
    burstSize: number;
  };
  defaultLanguage: string;
  defaultCountryCodes?: string[];
  enableCaching: boolean;
  cacheTtl: number;
}

export interface NominatimError {
  error: string;
  code?: number;
  message: string;
  details?: any;
}

/**
 * Service-level interfaces for abstraction
 */
export interface INominatimSearchRequest {
  address?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  countryCode?: string;
  limit?: number;
  language?: string;
  bounds?: {
    viewbox: string;
    bounded: boolean;
  };
  includePolygon?: boolean;
  includeExtraTags?: boolean;
}

export interface INominatimReverseRequest {
  coordinates: GeoCoordinate;
  zoom?: number;
  language?: string;
  includeAddress?: boolean;
  includeExtraTags?: boolean;
}

export interface INominatimService {
  search(params: INominatimSearchRequest): Promise<NominatimGeocodingResult[]>;
  reverse(params: INominatimReverseRequest): Promise<NominatimReverseGeocodingResult>;
  isHealthy(): Promise<boolean>;
  getUsageStats(): NominatimUsageStats;
}

export interface NominatimUsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  rateLimitHits: number;
  cacheHits: number;
  cacheMisses: number;
  lastRequestTime?: Date;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}

export interface NominatimCacheEntry {
  key: string;
  data: any;
  createdAt: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessed: Date;
}