/**
 * Offers Service
 *
 * Single consolidated API client for food waste offers.
 * Uses centralized apiClient with automatic token injection and refresh.
 *
 * All endpoints require authentication (JWT) — enforced by backend.
 * Token management is handled by apiClient interceptors.
 *
 * Endpoints:
 * - GET /offers - List all offers with filters
 * - GET /offers/:id - Get single offer
 * - GET /offers/featured - Get featured offers
 * - GET /offers/urgent - Get urgent offers (expiring soon)
 * - GET /offers/nearby - Get offers near location
 * - GET /offers/recommended - Get personalized recommendations
 * - GET /offers/pickup-today - Get offers for pickup today
 * - GET /offers/pickup-tomorrow - Get offers for pickup tomorrow
 * - GET /offers/establishment/:id - Get offers by establishment
 * - PATCH /offers/:id/reserve - Reserve quantity
 */

import axios from 'axios';

import { apiClient, unwrapBackendResponse, type BackendApiResponse } from '@/services/apiClient';
import { Logger } from '@/utils/logger';

import type {
  Offer,
  OfferListItem,
  OfferSearchParams,
  OffersResponse,
  ReserveQuantityRequest,
} from '../types/offer.types';
import type { GeoCoordinates } from '@foodwaste/shared';

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

class OffersService {
  private readonly basePath = '/offers';

  // ─────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Build location params object (only if both lat/lng provided)
   */
  private buildLocationParams(userLocation?: GeoCoordinates): Record<string, number> | undefined {
    if (!userLocation) return undefined;
    return {
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
    };
  }

  /**
   * Build query params from OfferSearchParams, filtering out undefined/null values
   */
  private buildSearchParams(
    params?: OfferSearchParams,
    userLocation?: GeoCoordinates,
  ): Record<string, unknown> {
    if (!params) return { ...this.buildLocationParams(userLocation) };

    const scalarFields: Array<[string, unknown]> = [
      ['page', params.page],
      ['limit', params.limit],
      ['status', params.status],
      ['type', params.type],
      ['minPrice', params.minPrice],
      ['maxPrice', params.maxPrice],
      ['minDiscount', params.minDiscount],
      ['establishmentId', params.establishmentId],
      ['search', params.search],
      ['maxDistance', params.maxDistance],
    ];

    const result: Record<string, unknown> = {};

    for (const [key, value] of scalarFields) {
      if (value != null) result[key] = value;
    }

    // Boolean field — must check undefined explicitly (false is valid)
    if (params.isFeatured !== undefined) result['isFeatured'] = params.isFeatured;

    // Array params
    if (params.categories?.length != null) result['categories'] = params.categories;
    if (params.establishmentTypes?.length != null)
      result['establishmentTypes'] = params.establishmentTypes;
    if (params.cuisineTypes?.length != null) result['cuisineTypes'] = params.cuisineTypes;

    // Location
    const locationParams = this.buildLocationParams(userLocation);
    if (locationParams) Object.assign(result, locationParams);

    return result;
  }

  /**
   * Handle and normalize Axios errors
   */
  private handleError(error: unknown, url: string): never {
    if (axios.isAxiosError(error)) {
      // Ignore cancellations — expected behavior from TanStack Query
      if (axios.isCancel(error) || error.code === 'ERR_CANCELED' || error.message === 'canceled') {
        Logger.debug('Request cancelled (expected)', { url });
        throw error;
      }

      const responseData = error.response?.data as { message?: unknown } | undefined;
      const rawMessage = responseData?.message;

      let message: string;
      if (typeof rawMessage === 'string') {
        message = rawMessage;
      } else if (Array.isArray(rawMessage)) {
        message = rawMessage.join(', ');
      } else {
        message = error.message || 'Failed to fetch offers';
      }

      Logger.error(
        'Offers API error',
        {
          url,
          status: error.response?.status,
        },
        new Error(message),
      );

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
   */
  async getOfferById(offerId: string, signal?: AbortSignal): Promise<Offer> {
    const url = `${this.basePath}/${offerId}`;
    try {
      const response = await apiClient.get<BackendApiResponse<Offer>>(url, {
        params: { populate: 'establishmentId' },
        ...(signal && { signal }),
      });
      const offer = unwrapBackendResponse(response, 'getOfferById');

      // Ensure availableQuantity is always computed
      // Backend adds it via $addFields, but fallback for safety
      offer.availableQuantity ??= offer.totalQuantity - offer.soldQuantity - offer.reservedQuantity;

      return offer;
    } catch (error) {
      this.handleError(error, url);
    }
  }

  /**
   * Get all offers with optional filters and pagination
   */
  async getAllOffers(
    params?: OfferSearchParams,
    userLocation?: GeoCoordinates,
    signal?: AbortSignal,
  ): Promise<OffersResponse> {
    try {
      const response = await apiClient.get<BackendApiResponse<OfferListItem[]>>(this.basePath, {
        params: this.buildSearchParams(params, userLocation),
        paramsSerializer: {
          indexes: null, // categories=a&categories=b (no bracket notation)
        },
        ...(signal && { signal }),
      });

      const backendData = response.data;
      const data = unwrapBackendResponse(response, 'getAllOffers');

      return {
        data: Array.isArray(data) ? data : [],
        meta: {
          page: backendData.meta?.page ?? 1,
          limit: backendData.meta?.limit ?? 10,
          total: backendData.meta?.total ?? 0,
          totalPages: backendData.meta?.totalPages ?? 0,
        },
      };
    } catch (error) {
      this.handleError(error, this.basePath);
    }
  }

  /**
   * Get featured offers
   */
  async getFeaturedOffers(
    limit: number = 10,
    userLocation?: GeoCoordinates,
    signal?: AbortSignal,
  ): Promise<OfferListItem[]> {
    const url = `${this.basePath}/featured`;
    try {
      const response = await apiClient.get<BackendApiResponse<OfferListItem[]>>(url, {
        params: {
          limit,
          ...this.buildLocationParams(userLocation),
        },
        ...(signal && { signal }),
      });
      const data = unwrapBackendResponse(response, 'getFeaturedOffers');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      this.handleError(error, url);
    }
  }

  /**
   * Get urgent offers (expiring soon)
   */
  async getUrgentOffers(
    hoursUntilExpiry: number = 1,
    limit: number = 10,
    userLocation?: GeoCoordinates,
    signal?: AbortSignal,
  ): Promise<OfferListItem[]> {
    const url = `${this.basePath}/urgent`;
    try {
      const response = await apiClient.get<BackendApiResponse<OfferListItem[]>>(url, {
        params: {
          hoursUntilExpiry,
          limit,
          ...this.buildLocationParams(userLocation),
        },
        ...(signal && { signal }),
      });
      const data = unwrapBackendResponse(response, 'getUrgentOffers');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      this.handleError(error, url);
    }
  }

  /**
   * Get nearby offers
   */
  async getNearbyOffers(
    params: NearbyOffersParams,
    signal?: AbortSignal,
  ): Promise<OfferListItem[]> {
    const url = `${this.basePath}/nearby`;
    try {
      const { longitude, latitude, maxDistance = 5000, limit = 20 } = params;
      const response = await apiClient.get<BackendApiResponse<OfferListItem[]>>(url, {
        params: { longitude, latitude, maxDistance, limit },
        ...(signal && { signal }),
      });
      const data = unwrapBackendResponse(response, 'getNearbyOffers');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      this.handleError(error, url);
    }
  }

  /**
   * Get personalized recommended offers
   * Token is injected automatically by apiClient interceptor.
   */
  async getRecommendedOffers(
    limit: number = 20,
    userLocation?: GeoCoordinates,
    signal?: AbortSignal,
  ): Promise<OfferListItem[]> {
    const url = `${this.basePath}/recommended`;
    try {
      const response = await apiClient.get<BackendApiResponse<OfferListItem[]>>(url, {
        params: {
          limit,
          ...this.buildLocationParams(userLocation),
        },
        ...(signal && { signal }),
      });
      const data = unwrapBackendResponse(response, 'getRecommendedOffers');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      this.handleError(error, url);
    }
  }

  /**
   * Get offers by establishment
   */
  async getOffersByEstablishment(
    establishmentId: string,
    page: number = 1,
    limit: number = 10,
    signal?: AbortSignal,
  ): Promise<OffersResponse> {
    const url = `${this.basePath}/establishment/${establishmentId}`;
    try {
      const response = await apiClient.get<BackendApiResponse<OfferListItem[]>>(url, {
        params: { page, limit },
        ...(signal && { signal }),
      });

      const backendData = response.data;
      const data = unwrapBackendResponse(response, 'getOffersByEstablishment');

      return {
        data: Array.isArray(data) ? data : [],
        meta: {
          page: backendData.meta?.page ?? page,
          limit: backendData.meta?.limit ?? limit,
          total: backendData.meta?.total ?? 0,
          totalPages: backendData.meta?.totalPages ?? 0,
        },
      };
    } catch (error) {
      this.handleError(error, url);
    }
  }

  /**
   * Get offers available for pickup today
   */
  async getPickupTodayOffers(
    limit: number = 20,
    userLocation?: GeoCoordinates,
    signal?: AbortSignal,
  ): Promise<OfferListItem[]> {
    const url = `${this.basePath}/pickup-today`;
    try {
      const response = await apiClient.get<BackendApiResponse<OfferListItem[]>>(url, {
        params: {
          limit,
          ...this.buildLocationParams(userLocation),
        },
        ...(signal && { signal }),
      });
      const data = unwrapBackendResponse(response, 'getPickupTodayOffers');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      this.handleError(error, url);
    }
  }

  /**
   * Get offers available for pickup tomorrow
   */
  async getPickupTomorrowOffers(
    limit: number = 20,
    userLocation?: GeoCoordinates,
    signal?: AbortSignal,
  ): Promise<OfferListItem[]> {
    const url = `${this.basePath}/pickup-tomorrow`;
    try {
      const response = await apiClient.get<BackendApiResponse<OfferListItem[]>>(url, {
        params: {
          limit,
          ...this.buildLocationParams(userLocation),
        },
        ...(signal && { signal }),
      });
      const data = unwrapBackendResponse(response, 'getPickupTomorrowOffers');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      this.handleError(error, url);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mutation Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Reserve quantity from an offer
   * Token is injected automatically by apiClient interceptor.
   */
  async reserveQuantity(offerId: string, quantity: number): Promise<Offer> {
    const url = `${this.basePath}/${offerId}/reserve`;
    try {
      const payload: ReserveQuantityRequest = { quantity };
      const response = await apiClient.patch<BackendApiResponse<Offer>>(url, payload);
      return unwrapBackendResponse(response, 'reserveQuantity');
    } catch (error) {
      this.handleError(error, url);
    }
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const offersService = new OffersService();
