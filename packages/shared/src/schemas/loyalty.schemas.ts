/**
 * Loyalty Domain Zod Schemas
 *
 * Converted from backend class-validator DTOs (loyalty-account.dto.ts).
 *
 * @module shared/schemas/loyalty
 */
import { z } from 'zod';

// ============================================================================
// Create Loyalty Account
// ============================================================================

export const CreateLoyaltyAccountSchema = z.object({
  userId: z.string().min(1),
  referredBy: z.string().optional(),
});

export type CreateLoyaltyAccountInput = z.infer<typeof CreateLoyaltyAccountSchema>;

// ============================================================================
// Add Points
// ============================================================================

export const AddPointsSchema = z.object({
  amount: z.number().min(1),
  reason: z.string().min(1),
  orderId: z.string().optional(),
  offerId: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  orderAmount: z.number().min(0).optional(),
  bagCount: z.number().min(1).optional(),
  bypassMultiplier: z.boolean().optional(),
});

export type AddPointsInput = z.infer<typeof AddPointsSchema>;

// ============================================================================
// Redeem Points
// ============================================================================

export const RedeemPointsSchema = z.object({
  amount: z.number().min(1),
  reason: z.string().min(1),
  orderId: z.string().optional(),
});

export type RedeemPointsInput = z.infer<typeof RedeemPointsSchema>;

// ============================================================================
// Donate Points
// ============================================================================

export const DonatePointsSchema = z.object({
  amount: z.number().min(1),
  isAnonymous: z.boolean().optional().default(false),
  message: z.string().optional(),
});

export type DonatePointsInput = z.infer<typeof DonatePointsSchema>;

// ============================================================================
// Loyalty Stats (read-only response shape)
// ============================================================================

export const LoyaltyStatsSchema = z.object({
  totalPoints: z.number(),
  availablePoints: z.number(),
  lifetimePointsEarned: z.number(),
  totalOrdersCount: z.number(),
  totalBagsSaved: z.number(),
  totalAmountSpent: z.number(),
  currentTier: z.string(),
  badgeCount: z.number(),
  referralCount: z.number(),
  joinedAt: z.string(),
  lastActivity: z.string().optional(),
});

export type LoyaltyStats = z.infer<typeof LoyaltyStatsSchema>;

// ============================================================================
// Donate Points Response (read-only)
// ============================================================================

export const DonatePointsResponseSchema = z.object({
  success: z.boolean(),
  pointsDonated: z.number(),
  donationAmount: z.number(),
  currency: z.string(),
  estimatedMeals: z.number(),
  remainingPoints: z.number(),
  message: z.string(),
});

export type DonatePointsResponse = z.infer<typeof DonatePointsResponseSchema>;
