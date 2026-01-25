/**
 * Favorites Types
 * Type definitions matching backend favorites API
 * Backend: apps/food-waste-backend/src/favorites/
 */

import type { ID, Timestamp} from '@/types';
import type { OfferListItem } from '@/features/offers/types';

// ============================================================================
// Enums (must match backend exactly)
// ============================================================================

export enum FavoriteType {
  ESTABLISHMENT = 'establishment',
  OFFER = 'offer',
  CATEGORY = 'category',
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Favorite preferences for notifications
 */
export interface FavoritePreference {
  notifications?: boolean;
  emailAlerts?: boolean;
  pushNotifications?: boolean;
  preferredTimes?: string[];
  preferredDays?: number[];
  maxDistance?: number;
}

/**
 * Favorite item (backend response)
 * Uses _id to match MongoDB backend responses
 */
export interface Favorite {
  _id: ID;
  userId: ID;
  type: FavoriteType;
  itemId: ID;
  itemName?: string;
  itemImage?: string;
  preferences: FavoritePreference;
  addedAt: Timestamp;
  lastNotified?: Timestamp;
  notificationCount: number;
  interactionCount: number;
  lastInteraction?: Timestamp;
  isActive: boolean;
  tags?: string[];
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Favorite with populated offer data (for display)
 * Note: When populated, itemId becomes the full offer object
 */
export interface FavoriteOffer extends Omit<Favorite, 'itemId'> {
  itemId: ID | OfferListItem; // Can be ID string or populated offer data
}

/**
 * Favorites list response
 */
export interface FavoritesResponse {
  favorites: Favorite[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Favorites statistics
 */
export interface FavoriteStats {
  totalFavorites: number;
  favoriteEstablishments: number;
  favoriteOffers: number;
  favoriteCategories: number;
  totalLists: number;
  activeLists: number;
  sharedLists: number;
  totalNotifications: number;
  recentActivity: number;
}

// ============================================================================
// DTOs (Data Transfer Objects for API requests)
// ============================================================================

/**
 * Add favorite request
 */
export interface AddFavoriteRequest {
  type: FavoriteType;
  itemId: string;
  itemName?: string | undefined;
  itemImage?: string | undefined;
  preferences?: FavoritePreference | undefined;
  tags?: string[] | undefined;
  notes?: string | undefined;
}

/**
 * Update favorite request
 */
export interface UpdateFavoriteRequest {
  preferences?: FavoritePreference;
  tags?: string[];
  notes?: string;
  isActive?: boolean;
}

/**
 * Favorites filter request
 */
export interface FavoritesFilterRequest {
  type?: FavoriteType | undefined;
  tag?: string | undefined;
  isActive?: boolean | undefined;
  page?: number | undefined;
  limit?: number | undefined;
  sortBy?: string | undefined;
}

/**
 * Check favorite status response
 */
export interface CheckFavoriteResponse {
  isFavorite: boolean;
}
