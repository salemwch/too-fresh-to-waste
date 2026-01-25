/**
 * Offers Service V2 - With Centralized API Client & Auto Token Refresh
 *
 * MIGRATION: This replaces offersService.ts with best practices:
 * - Automatic token injection via interceptor (no manual token passing)
 * - Automatic token refresh on 401 errors
 * - Consistent error handling
 * - Simplified API - removed all accessToken parameters
 *
 * @version 2.0.0
 * @migration-date 2026-01-09
 */

import {
  apiClient,
  unwrapResponse,
  unwrapPaginatedResponse,
  type ApiResponseWrapper,
} from '@/services/apiClient';
import { Logger } from '@/utils/logger';

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

class OffersServiceV2 {
  private readonly baseURL = '/offers';

  // ─────────────────────────────────────────────────────────────────────────
  // Public API Methods (No Authentication Required)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get single offer by ID
   * @param offerId - Offer ID
   * @returns Offer details
   */
  async getOfferById(offerId: string): Promise<Offer> {
    Logger.info('Fetching offer by ID', { offerId });
    const response = await apiClient.get<ApiResponseWrapper<{ data: Offer; message: string }>>(
      `${this.baseURL}/${offerId}`,
    );
    return unwrapResponse(response.data);
  }

  /**
   * Get all offers with optional filters and pagination
   * @param params - Search parameters
   * @returns Paginated list of offers
   */
  async getAllOffers(params?: OfferSearchParams): Promise<OffersResponse> {
    const queryParams = new URLSearchParams();

    if (params?.page != null) queryParams.append('page', params.page.toString());
    if (params?.limit != null) queryParams.append('limit', params.limit.toString());
    if (params?.search != null) queryParams.append('search', params.search);
    if (params?.type != null) queryParams.append('type', params.type);
    if (params?.status != null) queryParams.append('status', params.status);
    if (params?.minPrice !== undefined) queryParams.append('minPrice', params.minPrice.toString());
    if (params?.maxPrice !== undefined) queryParams.append('maxPrice', params.maxPrice.toString());
    if (params?.categories) queryParams.append('categories', params.categories.join(','));
    if (params?.tags != null) queryParams.append('tags', params.tags.join(','));
    if (params?.isFeatured !== undefined)
      queryParams.append('isFeatured', params.isFeatured.toString());

    const url = queryParams.toString() ? `${this.baseURL}?${queryParams}` : this.baseURL;

    Logger.info('Fetching all offers', { params });
    const response =
      await apiClient.get<
        ApiResponseWrapper<{ data: OfferListItem[]; meta: any; message: string }>
      >(url);
    return unwrapPaginatedResponse(response.data);
  }

  /**
   * Get featured offers
   * @param limit - Maximum number of featured offers
   * @returns List of featured offers
   */
  async getFeaturedOffers(limit: number = 10): Promise<OfferListItem[]> {
    Logger.info('Fetching featured offers', { limit });
    const response = await apiClient.get<
      ApiResponseWrapper<{ data: OfferListItem[]; message: string }>
    >(`${this.baseURL}/featured?limit=${limit}`);
    return unwrapResponse(response.data);
  }

  /**
   * Get offers near a location
   * @param params - Location parameters
   * @returns List of nearby offers
   */
  async getNearbyOffers(params: NearbyOffersParams): Promise<OfferListItem[]> {
    const { longitude, latitude, maxDistance = 5000, limit = 20 } = params;
    const url = `${this.baseURL}/nearby?longitude=${longitude}&latitude=${latitude}&maxDistance=${maxDistance}&limit=${limit}`;

    Logger.info('Fetching nearby offers', { params });
    const response =
      await apiClient.get<ApiResponseWrapper<{ data: OfferListItem[]; message: string }>>(url);
    return unwrapResponse(response.data);
  }

  /**
   * Get offers by establishment
   * @param establishmentId - Establishment ID
   * @param page - Page number (default 1)
   * @param limit - Items per page (default 10)
   * @returns Paginated list of offers
   */
  async getOffersByEstablishment(
    establishmentId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<OffersResponse> {
    const url = `${this.baseURL}/establishment/${establishmentId}?page=${page}&limit=${limit}`;

    Logger.info('Fetching offers by establishment', { establishmentId, page, limit });
    const response =
      await apiClient.get<
        ApiResponseWrapper<{ data: OfferListItem[]; meta: any; message: string }>
      >(url);
    return unwrapPaginatedResponse(response.data);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Authenticated Methods (Auto Token Injection via Interceptor)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Reserve quantity from an offer (requires authentication)
   *
   * @param offerId - Offer ID
   * @param quantity - Quantity to reserve
   * @returns Updated offer
   */
  async reserveQuantity(offerId: string, quantity: number): Promise<Offer> {
    Logger.info('Reserving quantity', { offerId, quantity });
    const payload: ReserveQuantityRequest = { quantity };
    const response = await apiClient.patch<ApiResponseWrapper<{ data: Offer; message: string }>>(
      `${this.baseURL}/${offerId}/reserve`,
      payload,
    );
    return unwrapResponse(response.data);
  }

}

// ============================================================================
// Export Singleton
// ============================================================================

export const offersServiceV2 = new OffersServiceV2();
