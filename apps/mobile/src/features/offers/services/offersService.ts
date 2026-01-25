/**
 * Offers Service
 *
 * API client for food waste offers.
 * Integrates with backend /api/v1/offers endpoints.
 *
 * Endpoints:
 * - GET /offers - List all offers with filters (public)
 * - GET /offers/:id - Get single offer (public)
 * - GET /offers/featured - Get featured offers (public)
 * - GET /offers/nearby - Get offers near location (public)
 * - GET /offers/establishment/:establishmentId - Get offers by establishment (public)
 * - POST /offers - Create offer (requires auth, merchant only)
 * - PATCH /offers/:id - Update offer (requires auth)
 * - PATCH /offers/:id/status - Update offer status (requires auth)
 * - PATCH /offers/:id/reserve - Reserve quantity (requires auth)
 * - DELETE /offers/:id - Delete offer (requires auth)
 */

import { type AxiosError, type AxiosResponse } from 'axios';

import { environment } from '@/config/environment';
import { apiClient, type ApiResponseWrapper as ImportedApiResponseWrapper } from '@/services/apiClient';
import { Logger, NetworkLogger } from '@/utils/logger';

import type {
  Offer,
  OfferListItem,
  OfferSearchParams,
  OffersResponse,
  ReserveQuantityRequest,
} from '../types/offer.types';

// ============================================================================
// Types
// ============================================================================

/**
 * Standard API response wrapper from backend
 *
 * NOTE: Backend uses TransformInterceptor which wraps all responses:
 * {
 *   statusCode: 200,
 *   data: {              // This is T (controller response)
 *     message: "...",
 *     data: {...},       // Actual data we want
 *     meta: {...}        // Optional pagination
 *   },
 *   timestamp: "..."
 * }
 */
type ApiResponseWrapper<T> = ImportedApiResponseWrapper<T>;

/**
 * Nearby offers parameters
 */
export interface NearbyOffersParams {
  longitude: number;
  latitude: number;
  maxDistance?: number; // In meters, default 5000
  limit?: number; // Default 20
}

// ============================================================================
// Service Implementation
// ============================================================================

class OffersService {
  private readonly baseURL: string;
  private readonly timeout: number;

  constructor() {
    this.baseURL = `${environment.api.baseUrl}/offers`;
    this.timeout = environment.api.timeout;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    data?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    const startTime = Date.now();

    try {
      NetworkLogger.logRequest(url, method, headers);

      // ✅ Use shared apiClient for automatic 401 handling and token refresh
      const response: AxiosResponse<ApiResponseWrapper<T>> = await apiClient({
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

      // Debug: Log raw response structure
      console.log('[OffersService] Raw response:', {
        url,
        status: response.status,
        responseDataKeys: Object.keys(response.data || {}),
        hasStatusCode: !!response.data?.statusCode,
        hasTimestamp: !!response.data?.timestamp,
        innerDataKeys: response.data?.data ? Object.keys(response.data.data) : [],
        hasMessage: !!(response.data?.data as any)?.message,
        hasInnerData: !!(response.data?.data as any)?.data,
        hasMeta: !!(response.data?.data as any)?.meta,
      });

      // RESPONSE STRUCTURE (with TransformInterceptor):
      // {
      //   statusCode: 200,
      //   data: {
      //     message: "...",         // Controller response
      //     data: {...} OR [],      // Actual data
      //     meta: {...}             // Pagination (if present)
      //   },
      //   timestamp: "..."
      // }

      // 🚨 DEBUG RAW RESPONSE BEFORE ASSIGNMENT
      console.log('🚨🚨🚨 RAW response.data.data:', JSON.stringify(response.data.data).substring(0, 800));

      const controllerResponse = response.data.data as any;

      // 🔍 DEBUG: Log response structure
      console.log('========================================');
      console.log('🔍 SERVICE: Response structure analysis');
      console.log('========================================');
      console.log('URL:', url);
      console.log('response.data keys:', Object.keys(response.data || {}));
      console.log('response.data.data type:', typeof controllerResponse);
      console.log('response.data.data isArray:', Array.isArray(controllerResponse));
      console.log('controllerResponse keys:', controllerResponse ? Object.keys(controllerResponse) : 'null');
      console.log('controllerResponse.meta exists:', !!controllerResponse?.meta);
      console.log('controllerResponse.data exists:', !!controllerResponse?.data);
      console.log('========================================');

      // Validate response structure
      if (!controllerResponse && controllerResponse !== 0 && controllerResponse !== false) {
        Logger.error('Invalid response structure - controllerResponse is undefined', {
          url,
          responseData: response.data,
        });
        throw new Error('Invalid response from server');
      }

      // ✅ FIX: Check if top-level response has meta (new interceptor format)
      // After TransformInterceptor fix, meta is at response.data.meta (same level as response.data.data)
      if (response.data.meta) {
        console.log('🔍🔍🔍 PAGINATED RESPONSE DEBUG 🔍🔍🔍');
        console.log('URL:', url);
        console.log('controllerResponse type:', typeof controllerResponse);
        console.log('controllerResponse isArray:', Array.isArray(controllerResponse));
        console.log('controllerResponse length:', Array.isArray(controllerResponse) ? controllerResponse.length : 'N/A');

        if (Array.isArray(controllerResponse) && controllerResponse[0]) {
          console.log('FIRST ITEM BEFORE RETURN:');
          console.log('  - id:', controllerResponse[0].id);
          console.log('  - title:', controllerResponse[0].title);
          console.log('  - establishment:', JSON.stringify(controllerResponse[0].establishment));
          console.log('  - pickupTimeSlots:', JSON.stringify(controllerResponse[0].pickupTimeSlots));
          console.log('  - full item keys:', Object.keys(controllerResponse[0]));
        }

        Logger.info('Response has meta at top level, returning paginated format', {
          url,
          dataLength: Array.isArray(controllerResponse) ? controllerResponse.length : 0,
        });

        const result = {
          data: Array.isArray(controllerResponse) ? controllerResponse : [],
          meta: response.data.meta,
        } as T;

        console.log('🔍🔍🔍 RETURNING:', JSON.stringify(result).substring(0, 500));
        return result;
      }

      // Check if controllerResponse is already an array (featured, nearby, recommended endpoints)
      if (Array.isArray(controllerResponse)) {
        Logger.info('Response is already an array, returning directly', { url, count: controllerResponse.length });
        return controllerResponse as T;
      }

      // Check if this is a paginated response (has meta) - old format
      if (controllerResponse?.meta) {
        // Paginated response: { message, data: [], meta: {} }
        console.log('🔍 makeRequest: Paginated response detected');
        console.log('  - controllerResponse.data length:', Array.isArray(controllerResponse.data) ? controllerResponse.data.length : 'NOT ARRAY');
        if (Array.isArray(controllerResponse.data) && controllerResponse.data[0]) {
          console.log('  - First item establishment:', controllerResponse.data[0].establishment);
        }
        return {
          data: Array.isArray(controllerResponse.data) ? controllerResponse.data : [],
          meta: controllerResponse.meta,
        } as T;
      }

      // Check if data field exists
      if (controllerResponse.data === undefined) {
        // INFO: Some endpoints return the object directly without wrapping in { message, data }
        // This is expected for single object responses (e.g., GET /offers/:id)
        Logger.info('Response contains object directly (no data wrapper), returning as-is', {
          url,
          controllerResponseType: typeof controllerResponse,
          isArray: Array.isArray(controllerResponse),
        });
        // Return controllerResponse directly if it's a valid value
        return controllerResponse as T;
      }

      // Standard response: { message, data: {...} or [...] }
      // Return the actual data object or array
      console.log('🔍 makeRequest: Standard response with data field');
      console.log('  - controllerResponse.data length:', Array.isArray(controllerResponse.data) ? controllerResponse.data.length : 'NOT ARRAY');
      if (Array.isArray(controllerResponse.data) && controllerResponse.data[0]) {
        console.log('  - First item establishment:', controllerResponse.data[0].establishment);
      }
      return controllerResponse.data as T;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.handleError(error, url, duration);
      throw error;
    }
  }

  private handleError(error: unknown, url: string, duration: number): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ message?: string | any; statusCode?: number }>;
      NetworkLogger.logResponse(url, axiosError.response?.status ?? 0, duration);

      // ✅ FIX: Properly extract message (handle strings, arrays, objects)
      let message: string;
      const responseMessage = axiosError.response?.data?.message;

      if (typeof responseMessage === 'string') {
        message = responseMessage;
      } else if (Array.isArray(responseMessage)) {
        message = responseMessage.join(', ');
      } else if (responseMessage && typeof responseMessage === 'object') {
        message = JSON.stringify(responseMessage);
      } else {
        message = axiosError.message || 'Failed to fetch offers';
      }

      Logger.error(
        'Offers API error',
        {
          url,
          status: axiosError.response?.status,
          statusCode: axiosError.response?.data?.statusCode,
        },
        new Error(message),
      );

      // Re-throw with user-friendly message
      throw new Error(message);
    }

    Logger.error('Network error in offers service', { url }, error as Error);
    throw new Error('Network error. Please check your connection.');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get single offer by ID
   * @param offerId - Offer ID
   * @returns Offer details
   */
  async getOfferById(offerId: string): Promise<Offer> {
    const url = `${this.baseURL}/${offerId}`;
    return this.makeRequest<Offer>('GET', url);
  }

  /**
   * Get all offers with optional filters and pagination
   * @param params - Search parameters
   * @param userLocation - Optional user location for distance calculation
   * @returns Paginated list of offers
   */
  async getAllOffers(
    params?: OfferSearchParams,
    userLocation?: { latitude: number; longitude: number }
  ): Promise<OffersResponse> {
    const queryParams = new URLSearchParams();

    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.type) queryParams.append('type', params.type);
    if (params?.categories?.length) {
      params.categories.forEach(cat => queryParams.append('categories', cat));
    }
    if (params?.minPrice) queryParams.append('minPrice', params.minPrice.toString());
    if (params?.maxPrice) queryParams.append('maxPrice', params.maxPrice.toString());
    if (params?.minDiscount) queryParams.append('minDiscount', params.minDiscount.toString());
    if (params?.establishmentId) queryParams.append('establishmentId', params.establishmentId);
    if (params?.isFeatured !== undefined)
      queryParams.append('isFeatured', params.isFeatured.toString());
    if (params?.search) queryParams.append('search', params.search);

    // ✅ NEW: Establishment filters
    if (params?.establishmentTypes?.length) {
      params.establishmentTypes.forEach(type => queryParams.append('establishmentTypes', type));
    }
    if (params?.cuisineTypes?.length) {
      params.cuisineTypes.forEach(cuisine => queryParams.append('cuisineTypes', cuisine));
    }

    // Add user location for distance calculation
    if (userLocation) {
      queryParams.append('latitude', userLocation.latitude.toString());
      queryParams.append('longitude', userLocation.longitude.toString());
    }

    const url = `${this.baseURL}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    // 🔍 DEBUG: Log request details
    console.log('========================================');
    console.log('🌐 API REQUEST: getAllOffers');
    console.log('========================================');
    console.log('URL:', url);
    console.log('Params:', JSON.stringify(params, null, 2));
    console.log('User Location:', userLocation);
    console.log('Query String:', queryParams.toString());
    console.log('========================================');

    return this.makeRequest<OffersResponse>('GET', url);
  }

  /**
   * Get featured offers
   * @param limit - Maximum number of offers to return (default 10)
   * @param userLocation - Optional user location for distance calculation
   * @returns List of featured offers
   * ✅ Backend now returns clean OfferCardDto - no transformation needed
   */
  async getFeaturedOffers(
    limit: number = 10,
    userLocation?: { latitude: number; longitude: number }
  ): Promise<OfferListItem[]> {
    let url = `${this.baseURL}/featured?limit=${limit}`;
    if (userLocation) {
      url += `&latitude=${userLocation.latitude}&longitude=${userLocation.longitude}`;
    }
    return this.makeRequest<OfferListItem[]>('GET', url);
  }

  /**
   * Get urgent offers (expiring soon)
   *
   * Returns offers expiring within a specified time window (default: 1 hour).
   * Designed for "Urgent Deals" sections that need to show offers based on
   * actual time remaining, not manual/auto featuring flags.
   *
   * @param hoursUntilExpiry - Maximum hours until expiry (default: 1)
   * @param limit - Maximum number of offers to return (default: 10)
   * @param userLocation - Optional user location for distance calculation
   * @returns List of urgent offers sorted by soonest expiring first
   * ✅ Backend returns clean OfferCardDto - no transformation needed
   */
  async getUrgentOffers(
    hoursUntilExpiry: number = 1,
    limit: number = 10,
    userLocation?: { latitude: number; longitude: number }
  ): Promise<OfferListItem[]> {
    let url = `${this.baseURL}/urgent?hoursUntilExpiry=${hoursUntilExpiry}&limit=${limit}`;
    if (userLocation) {
      url += `&latitude=${userLocation.latitude}&longitude=${userLocation.longitude}`;
    }
    return this.makeRequest<OfferListItem[]>('GET', url);
  }

  /**
   * Get offers near a location
   * @param params - Location parameters
   * @returns List of nearby offers
   */
  async getNearbyOffers(params: NearbyOffersParams): Promise<OfferListItem[]> {
    const { longitude, latitude, maxDistance = 5000, limit = 20 } = params;
    const url = `${this.baseURL}/nearby?longitude=${longitude}&latitude=${latitude}&maxDistance=${maxDistance}&limit=${limit}`;
    return this.makeRequest<OfferListItem[]>('GET', url);
  }

  /**
   * Get personalized recommended offers (requires authentication)
   * Based on user's favorited establishments and categories
   * Falls back to featured offers if no favorites exist
   *
   * Business Logic:
   * - Priority 1: Offers from favorited establishments
   * - Priority 2: Offers in favorited categories
   * - Ranking: Priority → Discount → Urgency → CreatedAt
   *
   * @param limit - Maximum number of offers (default 20)
   * @param accessToken - JWT access token
   * @param userLocation - Optional user location for distance calculation
   * @returns List of recommended offers
   * ✅ Backend returns clean OfferCardDto - no transformation needed
   */
  async getRecommendedOffers(
    limit: number = 20,
    accessToken: string,
    userLocation?: { latitude: number; longitude: number },
  ): Promise<OfferListItem[]> {
    let url = `${this.baseURL}/recommended?limit=${limit}`;

    // Append location parameters if provided
    if (userLocation) {
      url += `&latitude=${userLocation.latitude}&longitude=${userLocation.longitude}`;
    }

    return this.makeRequest<OfferListItem[]>('GET', url, undefined, {
      Authorization: `Bearer ${accessToken}`,
    });
  }

  /**
   * Get offers by establishment
   * @param establishmentId - Establishment ID
   * @param page - Page number (default 1)
   * @param limit - Items per page (default 10)
   * @returns Paginated list of offers for the establishment
   */
  async getOffersByEstablishment(
    establishmentId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<OffersResponse> {
    const url = `${this.baseURL}/establishment/${establishmentId}?page=${page}&limit=${limit}`;
    return this.makeRequest<OffersResponse>('GET', url);
  }

  /**
   * Get offers available for pickup today
   * @param limit - Maximum number of offers (default 20)
   * @param userLocation - Optional user location for distance calculation
   * @returns List of offers available for pickup today
   * ✅ Backend returns clean OfferCardDto - no transformation needed
   */
  async getPickupTodayOffers(
    limit: number = 20,
    userLocation?: { latitude: number; longitude: number }
  ): Promise<OfferListItem[]> {
    let url = `${this.baseURL}/pickup-today?limit=${limit}`;
    if (userLocation) {
      url += `&latitude=${userLocation.latitude}&longitude=${userLocation.longitude}`;
    }
    const response = await this.makeRequest<OffersResponse>('GET', url);
    return response.data || [];
  }

  /**
   * Get offers available for pickup tomorrow
   * @param limit - Maximum number of offers (default 20)
   * @param userLocation - Optional user location for distance calculation
   * @returns List of offers available for pickup tomorrow
   * ✅ Backend returns clean OfferCardDto - no transformation needed
   */
  async getPickupTomorrowOffers(
    limit: number = 20,
    userLocation?: { latitude: number; longitude: number }
  ): Promise<OfferListItem[]> {
    let url = `${this.baseURL}/pickup-tomorrow?limit=${limit}`;
    if (userLocation) {
      url += `&latitude=${userLocation.latitude}&longitude=${userLocation.longitude}`;
    }
    const response = await this.makeRequest<OffersResponse>('GET', url);
    return response.data || [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Authenticated Methods (require JWT token)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Reserve quantity from an offer (requires authentication)
   * @param offerId - Offer ID
   * @param quantity - Quantity to reserve
   * @param accessToken - JWT access token
   * @returns Updated offer
   */
  async reserveQuantity(
    offerId: string,
    quantity: number,
    accessToken: string,
  ): Promise<Offer> {
    const url = `${this.baseURL}/${offerId}/reserve`;
    const payload: ReserveQuantityRequest = { quantity };
    return this.makeRequest<Offer>('PATCH', url, payload, {
      Authorization: `Bearer ${accessToken}`,
    });
  }

}

// ============================================================================
// Export Singleton
// ============================================================================

export const offersService = new OffersService();
