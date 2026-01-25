/**
 * Nearby Offers Service
 *
 * API client for proximity-based offer search.
 * Integrates with backend /api/v1/proximity-search endpoints.
 *
 * Endpoints used:
 * - POST /proximity-search/offers - Search offers by location (JWT required)
 * - POST /proximity-search/establishments - Search establishments (public)
 * - GET /proximity-search/quick-search - Quick search with query params (public)
 * - POST /geolocation/geocode - Address to coordinates (public)
 * - POST /geolocation/reverse-geocode - Coordinates to address (public)
 */

import axios, { type AxiosError, type AxiosResponse } from 'axios';

import { environment } from '@/config/environment';
import { Logger, NetworkLogger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

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
 * Pricing information for an offer
 */
export interface OfferPricing {
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
  pricing: OfferPricing;
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
 * Parameters for proximity search
 */
export interface NearbyOffersParams {
  /** Center point for search */
  center: GeoCoordinates;
  /** Search radius in meters (100-50000) */
  radius: number;
  /** Maximum results to return (1-100, default 20) */
  limit?: number;
  /** Pagination offset (default 0) */
  skip?: number;
  /** Filter by categories */
  categories?: string[];
  /** Sort by distance (default true) */
  sortByDistance?: boolean;
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

/**
 * Standard API response wrapper from backend
 */
interface ApiResponseWrapper<T> {
  statusCode: number;
  data: T;
  timestamp: string;
}

// ============================================================================
// Service Implementation
// ============================================================================

class NearbyOffersService {
  private readonly proximityBaseURL: string;
  private readonly geolocationBaseURL: string;
  private readonly timeout: number;

  constructor() {
    this.proximityBaseURL = `${environment.api.baseUrl}/proximity-search`;
    this.geolocationBaseURL = `${environment.api.baseUrl}/geolocation`;
    this.timeout = environment.api.timeout;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private async makeRequest<T>(
    method: 'GET' | 'POST',
    url: string,
    data?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    const startTime = Date.now();

    try {
      NetworkLogger.logRequest(url, method, headers);

      const response: AxiosResponse<ApiResponseWrapper<T>> = await axios({
        method,
        url,
        data,
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          ...headers,
        },
        timeout: this.timeout,
      });

      const duration = Date.now() - startTime;
      NetworkLogger.logResponse(url, response.status, duration);

      return response.data.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.handleError(error, url, duration);
      throw error;
    }
  }

  private handleError(error: unknown, url: string, duration: number): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ message?: string }>;
      NetworkLogger.logResponse(url, axiosError.response?.status ?? 0, duration);

      const message = axiosError.response?.data?.message ?? axiosError.message;
      Logger.error('Nearby offers API error', { url, status: axiosError.response?.status }, new Error(message));

      // Re-throw with user-friendly message
      throw new Error(message || 'Failed to fetch nearby offers');
    }

    Logger.error('Network error in nearby offers service', { url }, error as Error);
    throw new Error('Network error. Please check your connection.');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Proximity Search (Offers) - Requires Auth
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Search for offers within a radius of a point
   *
   * @param params - Search parameters
   * @param accessToken - JWT access token (required)
   * @returns Array of offers with distance information
   */
  async searchOffers(
    params: NearbyOffersParams,
    accessToken: string,
  ): Promise<ProximitySearchResult<NearbyOffer>[]> {
    const url = `${this.proximityBaseURL}/offers`;

    const requestBody = {
      center: params.center,
      radius: params.radius,
      limit: params.limit ?? 20,
      skip: params.skip ?? 0,
      categories: params.categories,
      sortByDistance: params.sortByDistance ?? true,
    };

    return this.makeRequest<ProximitySearchResult<NearbyOffer>[]>('POST', url, requestBody, {
      Authorization: `Bearer ${accessToken}`,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Proximity Search (Establishments) - Public
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Search for establishments within a radius of a point
   *
   * @param params - Search parameters
   * @returns Array of establishments with distance information
   */
  async searchEstablishments(
    params: NearbyOffersParams,
  ): Promise<ProximitySearchResult<NearbyEstablishment>[]> {
    const url = `${this.proximityBaseURL}/establishments`;

    const requestBody = {
      center: params.center,
      radius: params.radius,
      limit: params.limit ?? 20,
      skip: params.skip ?? 0,
      sortByDistance: params.sortByDistance ?? true,
    };

    return this.makeRequest<ProximitySearchResult<NearbyEstablishment>[]>('POST', url, requestBody);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Quick Search - Public
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Quick search using query parameters (simpler API)
   *
   * @param latitude - Center latitude
   * @param longitude - Center longitude
   * @param radius - Search radius in meters
   * @returns Array of nearby establishments
   */
  async quickSearch(
    latitude: number,
    longitude: number,
    radius: number,
  ): Promise<ProximitySearchResult<NearbyEstablishment>[]> {
    const url = `${this.proximityBaseURL}/quick-search?latitude=${latitude}&longitude=${longitude}&radius=${radius}`;

    const startTime = Date.now();

    try {
      NetworkLogger.logRequest(url, 'GET');

      const response = await axios.get<ApiResponseWrapper<ProximitySearchResult<NearbyEstablishment>[]>>(
        url,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: this.timeout,
        },
      );

      const duration = Date.now() - startTime;
      NetworkLogger.logResponse(url, response.status, duration);

      return response.data.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.handleError(error, url, duration);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Geocoding - Public
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Search for locations by address/city name (forward geocoding)
   *
   * @param query - Search query (e.g., "Paris, France")
   * @param limit - Maximum results (default 5)
   * @returns Array of matching locations
   */
  async geocodeSearch(query: string, limit: number = 5): Promise<GeocodeResult[]> {
    const url = `${this.geolocationBaseURL}/geocode`;

    // Backend expects 'address' field, not 'query'
    return this.makeRequest<GeocodeResult[]>('POST', url, { address: query, limit });
  }

  /**
   * Get address from coordinates (reverse geocoding)
   *
   * @param coordinates - Lat/lng to reverse geocode
   * @param language - Preferred language (default 'en')
   * @returns Address information
   */
  async reverseGeocode(
    coordinates: GeoCoordinates,
    language: string = 'en',
  ): Promise<AddressInfo> {
    const url = `${this.geolocationBaseURL}/reverse-geocode`;

    // Backend expects nested 'coordinates' object per ReverseGeocodingDto
    return this.makeRequest<AddressInfo>('POST', url, {
      coordinates: {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      },
      language,
    });
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const nearbyOffersService = new NearbyOffersService();
