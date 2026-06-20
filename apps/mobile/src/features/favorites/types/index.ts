/**
 * Favorites Types
 * Type definitions matching backend favorites API
 * Backend: apps/food-waste-backend/src/favorites/
 */

// ============================================================================
// Shared types — re-exported from @foodwaste/shared (single source of truth)
// ============================================================================
export { FavoriteType } from '@foodwaste/shared';

export type {
  Favorite,
  FavoritesResponse,
  FavoriteStats,
  AddFavoriteRequest,
  UpdateFavoriteRequest,
  FavoritesFilterRequest,
  CheckFavoriteResponse,
} from '@foodwaste/shared';
