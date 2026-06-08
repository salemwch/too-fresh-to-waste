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
import { apiClient, unwrapBackendResponse } from '@/services/apiClient';
import { Logger, NetworkLogger } from '@/utils/logger';

import type {
  ApiResponse,
  GeoCoordinates,
  NearbyOffer,
  NearbyEstablishment,
  ProximitySearchResult,
  MapEstablishment,
  AddressInfo,
  GeocodeResult,
} from '@foodwaste/shared';

// ============================================================================
// Shared geo types — re-exported from @foodwaste/shared (single source of truth)
// ============================================================================
export type {
  GeoCoordinates,
  AddressInfo,
  DistanceInfo,
  GeoData,
  GeoOfferPricing,
  NearbyOffer,
  NearbyEstablishment,
  ProximitySearchResult,
  MapOfferSummary,
  MapEstablishment,
  GeocodeResult,
} from '@foodwaste/shared';

// Backward-compatible alias: mobile used OfferPricing, shared uses GeoOfferPricing
export type { GeoOfferPricing as OfferPricing } from '@foodwaste/shared';

// ============================================================================
// Mobile-only types
// ============================================================================

/**
 * Parameters for proximity search (mobile-specific request config)
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
  /** Text query to search offers by title or establishment name */
  query?: string;
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

  /**
   * Raw-axios request helper for PUBLIC endpoints (no auth).
   * Authenticated endpoints must go through `apiClient` so 401s route
   * through the shared `refreshTokenSafe` pipeline — see `searchOffers`.
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST',
    url: string,
    data?: unknown,
    headers?: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<T> {
    const startTime = Date.now();

    try {
      NetworkLogger.logRequest(url, method, headers);

      const response: AxiosResponse<ApiResponse<T>> = await axios({
        method,
        url,
        data,
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-Platform': 'mobile',
          'X-App-Version': environment.app.version,
          ...headers,
        },
        timeout: this.timeout,
        ...(signal && { signal }),
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
      Logger.error(
        'Nearby offers API error',
        { url, status: axiosError.response?.status },
        new Error(message),
      );

      throw new Error(message || 'Failed to fetch nearby offers');
    }

    Logger.error('Network error in nearby offers service', { url }, error as Error);
    throw new Error('Network error. Please check your connection.');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Proximity Search (Offers) - Requires Auth
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Search for offers within a radius of a point.
   *
   * Routes through the shared `apiClient` (not raw axios) so:
   * - Bearer token is injected from Redux on every call — no stale token
   *   passed by the caller
   * - 401 responses flow through `refreshTokenSafe` (single-flight refresh)
   *   and the original request is retried with the new token
   *
   * This was the root cause of the post-background-resume 401 flood on
   * `/proximity-search/offers`: the previous raw-axios path bypassed the
   * interceptor entirely, so each 401 bubbled up as a query error instead
   * of triggering a refresh.
   */
  async searchOffers(params: NearbyOffersParams): Promise<ProximitySearchResult<NearbyOffer>[]> {
    const url = '/proximity-search/offers';
    const body = {
      center: params.center,
      radius: params.radius,
      limit: params.limit ?? 20,
      skip: params.skip ?? 0,
      categories: params.categories,
      sortByDistance: params.sortByDistance ?? true,
      ...(params.query ? { query: params.query } : {}),
    };

    const response = await apiClient.post(url, body);
    return unwrapBackendResponse<ProximitySearchResult<NearbyOffer>[]>(
      response,
      'nearby offers search',
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Proximity Search (Establishments) - Public
  // ─────────────────────────────────────────────────────────────────────────

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
      ...(params.query ? { query: params.query } : {}),
    };

    return this.makeRequest<ProximitySearchResult<NearbyEstablishment>[]>('POST', url, requestBody);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Proximity Search (Map Establishments) - Public
  // ─────────────────────────────────────────────────────────────────────────

  async searchMapEstablishments(
    params: NearbyOffersParams,
  ): Promise<ProximitySearchResult<MapEstablishment>[]> {
    const url = `${this.proximityBaseURL}/map-establishments`;

    const requestBody = {
      center: params.center,
      radius: params.radius,
      limit: params.limit ?? 50,
      skip: params.skip ?? 0,
      sortByDistance: params.sortByDistance ?? true,
      ...(params.query ? { query: params.query } : {}),
    };

    return this.makeRequest<ProximitySearchResult<MapEstablishment>[]>('POST', url, requestBody);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Quick Search - Public
  // ─────────────────────────────────────────────────────────────────────────

  async quickSearch(
    latitude: number,
    longitude: number,
    radius: number,
  ): Promise<ProximitySearchResult<NearbyEstablishment>[]> {
    const url = `${this.proximityBaseURL}/quick-search?latitude=${latitude}&longitude=${longitude}&radius=${radius}`;

    const startTime = Date.now();

    try {
      NetworkLogger.logRequest(url, 'GET');

      const response = await axios.get<ApiResponse<ProximitySearchResult<NearbyEstablishment>[]>>(
        url,
        {
          headers: { 'Content-Type': 'application/json' },
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

  async geocodeSearch(query: string, limit: number = 5): Promise<GeocodeResult[]> {
    const url = `${this.geolocationBaseURL}/geocode`;
    return this.makeRequest<GeocodeResult[]>('POST', url, { address: query, limit });
  }

  async reverseGeocode(
    coordinates: GeoCoordinates,
    language: string = 'en',
    signal?: AbortSignal,
  ): Promise<AddressInfo> {
    const url = `${this.geolocationBaseURL}/reverse-geocode`;

    return this.makeRequest<AddressInfo>(
      'POST',
      url,
      {
        coordinates: {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        },
        language,
      },
      undefined,
      signal,
    );
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const nearbyOffersService = new NearbyOffersService();
