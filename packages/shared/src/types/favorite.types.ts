import type { FavoriteType } from '../enums';
import type { Offer, OfferListItem } from './offer.types';

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
  _id: string;
  userId: string;
  type: FavoriteType;
  itemId: string;
  itemName?: string;
  itemImage?: string;
  preferences: FavoritePreference;
  addedAt: string;
  lastNotified?: string;
  notificationCount: number;
  interactionCount: number;
  lastInteraction?: string;
  isActive: boolean;
  tags?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Favorite with populated offer data (for display)
 * Note: When populated, itemId becomes the full offer object
 */
export interface FavoriteOffer extends Omit<Favorite, 'itemId'> {
  itemId: string | OfferListItem | Offer;
}

/**
 * Favorites list response
 */
export interface FavoritesResponse {
  favorites: Array<Favorite | FavoriteOffer>;
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
  itemName?: string;
  itemImage?: string;
  preferences?: FavoritePreference;
  tags?: string[];
  notes?: string;
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
 * Note: `| undefined` on optional fields is required for exactOptionalPropertyTypes compat
 */
export interface FavoritesFilterRequest {
  type?: FavoriteType | undefined;
  tag?: string | undefined;
  isActive?: boolean | undefined;
  page?: number | undefined;
  limit?: number | undefined;
  sortBy?: string | undefined;
  establishmentType?: string | undefined;
}

/**
 * Check favorite status response
 */
export interface CheckFavoriteResponse {
  isFavorite: boolean;
}
