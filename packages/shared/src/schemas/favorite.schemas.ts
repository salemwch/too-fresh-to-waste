/**
 * Favorites Domain Zod Schemas
 *
 * Converted from backend class-validator DTOs (favorite.dto.ts).
 *
 * @module shared/schemas/favorite
 */
import { z } from 'zod';

import { EstablishmentType, FavoriteType, ListVisibility } from '../enums';

// ============================================================================
// Nested schemas
// ============================================================================

const FavoritePreferenceSchema = z.object({
  notifications: z.boolean().optional(),
  emailAlerts: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  preferredTimes: z.array(z.string()).optional(),
  preferredDays: z.array(z.number()).optional(),
  maxDistance: z.number().min(0).max(50).optional(),
});

// ============================================================================
// Add Favorite
// ============================================================================

export const AddFavoriteSchema = z.object({
  type: z.nativeEnum(FavoriteType),
  itemId: z.string().min(1),
  itemName: z.string().optional(),
  itemImage: z.string().optional(),
  preferences: FavoritePreferenceSchema.optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export type AddFavoriteInput = z.infer<typeof AddFavoriteSchema>;

// ============================================================================
// Update Favorite
// ============================================================================

export const UpdateFavoriteSchema = z.object({
  preferences: FavoritePreferenceSchema.optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateFavoriteInput = z.infer<typeof UpdateFavoriteSchema>;

// ============================================================================
// Favorites Filter
// ============================================================================

export const FavoritesFilterSchema = z.object({
  type: z.nativeEnum(FavoriteType).optional(),
  tag: z.string().optional(),
  isActive: z
    .union([z.boolean(), z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
    .transform((val) => val === true || val === 'true' || val === '1')
    .optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.string().optional().default('-addedAt'),
  establishmentType: z.nativeEnum(EstablishmentType).optional(),
});

export type FavoritesFilterInput = z.infer<typeof FavoritesFilterSchema>;

// ============================================================================
// Create Favorite List
// ============================================================================

export const CreateFavoriteListSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  visibility: z.nativeEnum(ListVisibility).optional().default(ListVisibility.PRIVATE),
  iconEmoji: z.string().optional(),
  coverImage: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateFavoriteListInput = z.infer<typeof CreateFavoriteListSchema>;

// ============================================================================
// Update Favorite List
// ============================================================================

export const UpdateFavoriteListSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  visibility: z.nativeEnum(ListVisibility).optional(),
  iconEmoji: z.string().optional(),
  coverImage: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateFavoriteListInput = z.infer<typeof UpdateFavoriteListSchema>;

// ============================================================================
// Add to List
// ============================================================================

export const AddToListSchema = z.object({
  itemId: z.string().min(1),
  type: z.string().min(1),
  notes: z.string().optional(),
  position: z.number().min(0).optional(),
});

export type AddToListInput = z.infer<typeof AddToListSchema>;

// ============================================================================
// Share List
// ============================================================================

export const ShareListSchema = z.object({
  userIds: z.array(z.string()).min(1),
  message: z.string().optional(),
});

export type ShareListInput = z.infer<typeof ShareListSchema>;

// ============================================================================
// Recommendation Filters
// ============================================================================

export const RecommendationFiltersSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  type: z.nativeEnum(FavoriteType).optional(),
  category: z.string().optional(),
  maxDistance: z.coerce.number().min(1).max(100).optional(),
  minConfidence: z.coerce.number().min(0).max(1).optional(),
});

export type RecommendationFiltersInput = z.infer<typeof RecommendationFiltersSchema>;

// ============================================================================
// Trends Filters
// ============================================================================

export const TrendsFiltersSchema = z.object({
  period: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional().default('week'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  type: z.nativeEnum(FavoriteType).optional(),
  category: z.string().optional(),
  minFavoriteCount: z.coerce.number().min(1).optional(),
});

export type TrendsFiltersInput = z.infer<typeof TrendsFiltersSchema>;

// ============================================================================
// Sub-exports
// ============================================================================

export { FavoritePreferenceSchema };
