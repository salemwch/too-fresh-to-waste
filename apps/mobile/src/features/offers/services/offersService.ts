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

import axios, { type AxiosError, type AxiosResponse } from 'axios';

import { environment } from '@/config/environment';
import { Logger, NetworkLogger } from '@/utils/logger';

import type {
  Offer,
  OfferListItem,
  OfferSearchParams,
  OffersResponse,
  OfferResponse,
  FeaturedOffersResponse,
  CreateOfferPayload,
  UpdateOfferPayload,
  ReserveQuantityRequest,
  UpdateStatusRequest,
  OfferStatus,
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
interface ApiResponseWrapper<T> {
  statusCode: number;
  data: T;
  timestamp: string;
}

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

      const controllerResponse = response.data.data as any;

      // Check if this is a paginated response (has meta)
      if (controllerResponse?.meta) {
        // Paginated response: { message, data: [], meta: {} }
        return {
          data: controllerResponse.data,
          meta: controllerResponse.meta,
        } as T;
      }

      // Single item response: { message, data: {...} }
      // Return the actual data object
      return controllerResponse.data as T;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.handleError(error, url, duration);
      throw error;
    }
  }

  private handleError(error: unknown, url: string, duration: number): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ message?: string; statusCode?: number }>;
      NetworkLogger.logResponse(url, axiosError.response?.status ?? 0, duration);

      const message = axiosError.response?.data?.message ?? axiosError.message;
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
      throw new Error(message || 'Failed to fetch offers');
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
   * @returns Paginated list of offers
   */
  async getAllOffers(params?: OfferSearchParams): Promise<OffersResponse> {
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

    const url = `${this.baseURL}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.makeRequest<OffersResponse>('GET', url);
  }

  /**
   * Get featured offers
   * @param limit - Maximum number of offers to return (default 10)
   * @returns List of featured offers
   */
  async getFeaturedOffers(limit: number = 10): Promise<OfferListItem[]> {
    const url = `${this.baseURL}/featured?limit=${limit}`;
    const offers = await this.makeRequest<any[]>('GET', url);

    // Transform populated establishmentId to flat establishmentName
    return offers.map(offer => ({
      ...offer,
      establishmentName: offer.establishmentId?.name || undefined,
      establishmentAddress: offer.establishmentId?.address || undefined,
      // Keep _id of establishment for potential navigation
      establishmentId: offer.establishmentId?._id || offer.establishmentId,
    }));
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

  // ─────────────────────────────────────────────────────────────────────────
  // Authenticated Methods (require JWT token)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a new offer (requires authentication - merchant only)
   * @param payload - Offer data
   * @param accessToken - JWT access token
   * @returns Created offer
   */
  async createOffer(payload: CreateOfferPayload, accessToken: string): Promise<Offer> {
    return this.makeRequest<Offer>('POST', this.baseURL, payload, {
      Authorization: `Bearer ${accessToken}`,
    });
  }

  /**
   * Update an offer (requires authentication)
   * @param offerId - Offer ID
   * @param payload - Updated offer data
   * @param accessToken - JWT access token
   * @returns Updated offer
   */
  async updateOffer(
    offerId: string,
    payload: UpdateOfferPayload,
    accessToken: string,
  ): Promise<Offer> {
    const url = `${this.baseURL}/${offerId}`;
    return this.makeRequest<Offer>('PATCH', url, payload, {
      Authorization: `Bearer ${accessToken}`,
    });
  }

  /**
   * Update offer status (requires authentication)
   * @param offerId - Offer ID
   * @param status - New status
   * @param accessToken - JWT access token
   * @returns Updated offer
   */
  async updateOfferStatus(
    offerId: string,
    status: OfferStatus,
    accessToken: string,
  ): Promise<Offer> {
    const url = `${this.baseURL}/${offerId}/status`;
    const payload: UpdateStatusRequest = { status };
    return this.makeRequest<Offer>('PATCH', url, payload, {
      Authorization: `Bearer ${accessToken}`,
    });
  }

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

  /**
   * Delete an offer (requires authentication)
   * @param offerId - Offer ID
   * @param accessToken - JWT access token
   * @returns Deletion confirmation
   */
  async deleteOffer(
    offerId: string,
    accessToken: string,
  ): Promise<{ status: string; message: string; offerId: string }> {
    const url = `${this.baseURL}/${offerId}`;
    return this.makeRequest<{ status: string; message: string; offerId: string }>(
      'DELETE',
      url,
      undefined,
      {
        Authorization: `Bearer ${accessToken}`,
      },
    );
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const offersService = new OffersService();
