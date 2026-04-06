/**
 * Loyalty Types
 * Type definitions matching the backend loyalty schema exactly.
 *
 * Source: apps/food-waste-backend/src/loyalty/schemas/loyalty-account.schema.ts
 * Source: apps/food-waste-backend/src/loyalty/dto/loyalty-account.dto.ts
 */

// ============================================================================
// Shared types — re-exported from @foodwaste/shared (single source of truth)
// ============================================================================
export { BadgeType } from '@foodwaste/shared';

export type {
  PointTransactionType,
  TierName,
  Badge,
  PointTransaction,
  LoginStreak,
  PurchaseStreak,
  ReviewTracking,
  LoyaltyAccount,
  GamificationStats,
  LoginStreakResponse,
} from '@foodwaste/shared';
