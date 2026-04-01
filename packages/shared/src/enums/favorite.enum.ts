/**
 * Favorite enums — single source of truth
 * Source: apps/food-waste-backend/src/favorites/schemas/favorite.schema.ts
 * Source: apps/food-waste-backend/src/favorites/schemas/favorite-list.schema.ts
 */

export enum FavoriteType {
  ESTABLISHMENT = 'establishment',
  OFFER = 'offer',
  CATEGORY = 'category',
}

export enum ListVisibility {
  PRIVATE = 'private',
  PUBLIC = 'public',
  SHARED = 'shared',
}
