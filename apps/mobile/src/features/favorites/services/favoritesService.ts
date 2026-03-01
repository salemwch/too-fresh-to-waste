/**
 * Favorites Service
 * API client for favorites endpoints
 * Backend: apps/food-waste-backend/src/favorites/favorites.controller.ts
 */

import { apiClient, unwrapBackendResponse } from '@/services/apiClient';

import type {
  AddFavoriteRequest,
  UpdateFavoriteRequest,
  FavoritesFilterRequest,
  Favorite,
  FavoritesResponse,
  FavoriteStats,
  CheckFavoriteResponse,
  FavoriteType,
} from '../types';

const FAVORITES_BASE_URL = '/favorites';

/**
 * Favorites API Service
 */
export const favoritesService = {
  /**
   * Add item to favorites
   * POST /favorites
   */
  async addFavorite(data: AddFavoriteRequest): Promise<Favorite> {
    const response = await apiClient.post(FAVORITES_BASE_URL, data);
    return unwrapBackendResponse<Favorite>(response, 'addFavorite');
  },

  /**
   * Get user favorites with filters
   * GET /favorites
   */
  async getFavorites(filters?: FavoritesFilterRequest): Promise<FavoritesResponse> {
    console.log('📡 Fetching favorites from API...', { filters });

    const response = await apiClient.get<any>(FAVORITES_BASE_URL, {
      params: filters,
    });

    console.log('🔍 Raw API response structure:', {
      hasData: !!response.data,
      dataKeys: response.data ? Object.keys(response.data) : [],
      hasNestedData: !!response.data?.data,
      nestedDataKeys: response.data?.data ? Object.keys(response.data.data) : [],
    });

    // ✅ CRITICAL FIX: Backend wraps response in TransformInterceptor
    // Actual structure: { status: 200, data: { favorites: [...], total: 4 } }
    // We need to unwrap: response.data.data (not just response.data)
    const wrappedData = response.data;
    const actualData = wrappedData?.data || wrappedData; // Fallback to direct data if not wrapped

    const result = {
      favorites: Array.isArray(actualData?.favorites) ? actualData.favorites : [],
      total: actualData?.total ?? 0,
      page: actualData?.page ?? 1,
      totalPages: actualData?.totalPages ?? 0,
    };

    console.log('✅ Favorites API response:', {
      total: result.total,
      favoritesCount: result.favorites.length,
      page: result.page,
      totalPages: result.totalPages,
      filters,
      firstFavorite: result.favorites[0] ? {
        id: result.favorites[0]._id,
        type: result.favorites[0].type,
        isActive: result.favorites[0].isActive,
        itemIdType: typeof result.favorites[0].itemId,
        hasPopulatedOffer: typeof result.favorites[0].itemId === 'object' && result.favorites[0].itemId !== null,
        // ✅ CRITICAL: Show actual itemId value to debug
        itemIdValue: result.favorites[0].itemId,
        itemIdIsString: typeof result.favorites[0].itemId === 'string',
        // If itemId is object, show its keys
        itemIdKeys: typeof result.favorites[0].itemId === 'object' && result.favorites[0].itemId !== null
          ? Object.keys(result.favorites[0].itemId)
          : [],
      } : null,
    });

    return result;
  },

  /**
   * Get user favorite offer IDs (lightweight)
   * GET /favorites/ids
   *
   * ✅ Optimized endpoint that returns only IDs (not full documents)
   * Used for Redux hydration and isFavorite computation
   */
  async getFavoriteIds(): Promise<{ ids: string[] }> {
    const response = await apiClient.get(`${FAVORITES_BASE_URL}/ids`);
    return unwrapBackendResponse<{ ids: string[] }>(response, 'getFavoriteIds');
  },

  /**
   * Toggle favorite status (add or remove)
   * POST /favorites/toggle
   *
   * ✅ Atomic operation with rate limiting (10 req/min)
   * Returns new favorite status
   */
  async toggleFavorite(
    type: FavoriteType,
    itemId: string,
    itemName?: string,
    itemImage?: string,
  ): Promise<{ isFavorite: boolean; message: string }> {
    const response = await apiClient.post(
      `${FAVORITES_BASE_URL}/toggle`,
      {
        type,
        itemId,
        itemName,
        itemImage,
      },
    );
    return unwrapBackendResponse<{ isFavorite: boolean; message: string }>(response, 'toggleFavorite');
  },

  /**
   * Remove favorite by ID
   * DELETE /favorites/:id
   */
  async removeFavorite(favoriteId: string): Promise<void> {
    await apiClient.delete(`${FAVORITES_BASE_URL}/${favoriteId}`);
  },

  /**
   * Remove favorite by item type and ID
   * DELETE /favorites/item/:type/:itemId
   */
  async removeFavoriteByItem(type: FavoriteType, itemId: string): Promise<void> {
    await apiClient.delete(`${FAVORITES_BASE_URL}/item/${type}/${itemId}`);
  },

  /**
   * Update favorite settings
   * PUT /favorites/:id
   */
  async updateFavorite(favoriteId: string, data: UpdateFavoriteRequest): Promise<Favorite> {
    const response = await apiClient.put(`${FAVORITES_BASE_URL}/${favoriteId}`, data);
    return unwrapBackendResponse<Favorite>(response, 'updateFavorite');
  },

  /**
   * Check if item is favorited
   * GET /favorites/check/:type/:itemId
   */
  async checkIsFavorite(type: FavoriteType, itemId: string): Promise<boolean> {
    const response = await apiClient.get(
      `${FAVORITES_BASE_URL}/check/${type}/${itemId}`,
    );
    const data = unwrapBackendResponse<CheckFavoriteResponse>(response, 'checkIsFavorite');
    return data.isFavorite;
  },

  /**
   * Get user favorites statistics
   * GET /favorites/stats
   */
  async getFavoriteStats(): Promise<FavoriteStats> {
    const response = await apiClient.get(`${FAVORITES_BASE_URL}/stats`);
    return unwrapBackendResponse<FavoriteStats>(response, 'getFavoriteStats');
  },
};
