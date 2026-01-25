/**
 * Favorites Service
 * API client for favorites endpoints
 * Backend: apps/food-waste-backend/src/favorites/favorites.controller.ts
 */

import { apiClient } from '@/services/apiClient';
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
    const response = await apiClient.post<Favorite>(FAVORITES_BASE_URL, data);
    return response.data;
  },

  /**
   * Get user favorites with filters
   * GET /favorites
   */
  async getFavorites(filters?: FavoritesFilterRequest): Promise<FavoritesResponse> {
    const response = await apiClient.get<FavoritesResponse>(FAVORITES_BASE_URL, {
      params: filters,
    });

    // Backend returns data directly (no extra wrapping needed)
    // Ensure we always return the expected structure
    const data = response.data;

    return {
      favorites: Array.isArray(data?.favorites) ? data.favorites : [],
      total: data?.total ?? 0,
      page: data?.page ?? 1,
      totalPages: data?.totalPages ?? 0,
    };
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
    const response = await apiClient.put<Favorite>(`${FAVORITES_BASE_URL}/${favoriteId}`, data);
    return response.data;
  },

  /**
   * Check if item is favorited
   * GET /favorites/check/:type/:itemId
   */
  async checkIsFavorite(type: FavoriteType, itemId: string): Promise<boolean> {
    const response = await apiClient.get<CheckFavoriteResponse>(
      `${FAVORITES_BASE_URL}/check/${type}/${itemId}`
    );
    return response.data.isFavorite;
  },

  /**
   * Get user favorites statistics
   * GET /favorites/stats
   */
  async getFavoriteStats(): Promise<FavoriteStats> {
    const response = await apiClient.get<FavoriteStats>(`${FAVORITES_BASE_URL}/stats`);
    return response.data;
  },

  /**
   * Toggle favorite status for an item
   * Convenience method that checks status and adds/removes accordingly
   */
  async toggleFavorite(
    type: FavoriteType,
    itemId: string,
    itemName?: string | undefined,
    itemImage?: string | undefined
  ): Promise<boolean> {
    const isFavorite = await this.checkIsFavorite(type, itemId);

    if (isFavorite) {
      await this.removeFavoriteByItem(type, itemId);
      return false;
    } else {
      await this.addFavorite({
        type,
        itemId,
        itemName: itemName ?? undefined,
        itemImage: itemImage ?? undefined,
      });
      return true;
    }
  },
};
