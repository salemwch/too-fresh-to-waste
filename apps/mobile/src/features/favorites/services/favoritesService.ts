/**
 * Favorites Service
 * API client for favorites endpoints
 */

import { apiClient, unwrapBackendResponse, type BackendApiResponse } from '@/services/apiClient';
import { Logger } from '@/utils/logger';

import type {
  AddFavoriteRequest,
  CheckFavoriteResponse,
  Favorite,
  FavoritesFilterRequest,
  FavoritesResponse,
  FavoriteStats,
  FavoriteType,
  UpdateFavoriteRequest,
} from '../types';

const FAVORITES_BASE_URL = '/favorites';

type FavoritesApiData = FavoritesResponse | BackendApiResponse<FavoritesResponse>;
type PartialFavoritesResponse = Partial<FavoritesResponse>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';

export const favoritesService = {
  async addFavorite(data: AddFavoriteRequest): Promise<Favorite> {
    const response = await apiClient.post(FAVORITES_BASE_URL, data);
    return unwrapBackendResponse<Favorite>(response, 'addFavorite');
  },

  async getFavorites(filters?: FavoritesFilterRequest): Promise<FavoritesResponse> {
    Logger.debug('[favoritesService] Fetching favorites', { filters });

    const response = await apiClient.get<FavoritesApiData>(FAVORITES_BASE_URL, {
      params: filters,
    });

    const wrappedData = response.data;
    const actualData =
      isRecord(wrappedData) && 'data' in wrappedData && isRecord(wrappedData.data)
        ? (wrappedData.data as PartialFavoritesResponse)
        : (wrappedData as PartialFavoritesResponse);

    Logger.debug('[favoritesService] Raw API response structure', {
      dataKeys: isRecord(wrappedData) ? Object.keys(wrappedData) : [],
      hasData: response.data !== undefined,
      hasNestedData: isRecord(wrappedData) && 'data' in wrappedData && isRecord(wrappedData.data),
      nestedDataKeys:
        isRecord(wrappedData) && 'data' in wrappedData && isRecord(wrappedData.data)
          ? Object.keys(wrappedData.data)
          : [],
    });

    const favorites = Array.isArray(actualData.favorites) ? actualData.favorites : [];
    const result: FavoritesResponse = {
      favorites,
      total: actualData.total ?? 0,
      page: actualData.page ?? 1,
      totalPages: actualData.totalPages ?? 0,
    };

    const firstFavorite = result.favorites[0];
    const populatedItem =
      firstFavorite !== undefined &&
      typeof firstFavorite.itemId === 'object' &&
      firstFavorite.itemId !== null
        ? firstFavorite.itemId
        : undefined;

    Logger.debug('[favoritesService] Favorites API response', {
      favoritesCount: result.favorites.length,
      filters,
      firstFavorite:
        firstFavorite !== undefined
          ? {
              hasPopulatedOffer: populatedItem !== undefined,
              id: firstFavorite._id,
              isActive: firstFavorite.isActive,
              itemIdIsString: typeof firstFavorite.itemId === 'string',
              itemIdKeys: populatedItem !== undefined ? Object.keys(populatedItem) : [],
              itemIdType: typeof firstFavorite.itemId,
              itemIdValue: firstFavorite.itemId,
              type: firstFavorite.type,
            }
          : null,
      page: result.page,
      total: result.total,
      totalPages: result.totalPages,
    });

    return result;
  },

  async getFavoriteIds(): Promise<{ ids: string[] }> {
    const response = await apiClient.get(`${FAVORITES_BASE_URL}/ids`);
    return unwrapBackendResponse<{ ids: string[] }>(response, 'getFavoriteIds');
  },

  async toggleFavorite(
    type: FavoriteType,
    itemId: string,
    itemName?: string,
    itemImage?: string,
  ): Promise<{ isFavorite: boolean; message: string }> {
    const response = await apiClient.post(`${FAVORITES_BASE_URL}/toggle`, {
      type,
      itemId,
      itemName,
      itemImage,
    });

    return unwrapBackendResponse<{ isFavorite: boolean; message: string }>(
      response,
      'toggleFavorite',
    );
  },

  async removeFavorite(favoriteId: string): Promise<void> {
    await apiClient.delete(`${FAVORITES_BASE_URL}/${favoriteId}`);
  },

  async removeFavoriteByItem(type: FavoriteType, itemId: string): Promise<void> {
    await apiClient.delete(`${FAVORITES_BASE_URL}/item/${type}/${itemId}`);
  },

  async updateFavorite(favoriteId: string, data: UpdateFavoriteRequest): Promise<Favorite> {
    const response = await apiClient.put(`${FAVORITES_BASE_URL}/${favoriteId}`, data);
    return unwrapBackendResponse<Favorite>(response, 'updateFavorite');
  },

  async checkIsFavorite(type: FavoriteType, itemId: string): Promise<boolean> {
    const response = await apiClient.get(`${FAVORITES_BASE_URL}/check/${type}/${itemId}`);
    const data = unwrapBackendResponse<CheckFavoriteResponse>(response, 'checkIsFavorite');
    return data.isFavorite;
  },

  async getFavoriteStats(): Promise<FavoriteStats> {
    const response = await apiClient.get(`${FAVORITES_BASE_URL}/stats`);
    return unwrapBackendResponse<FavoriteStats>(response, 'getFavoriteStats');
  },
};
