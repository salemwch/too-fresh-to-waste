/**
 * Donation Domain Zod Schemas
 *
 * Converted from backend class-validator DTOs (donation-stats, update-donation-pool).
 *
 * @module shared/schemas/donation
 */
import { z } from 'zod';
import { DonationPoolStatus } from '../enums';

// ============================================================================
// Update Donation Pool (admin)
// ============================================================================

export const UpdateDonationPoolSchema = z.object({
  targetAmount: z.number().min(1).max(1_000_000).optional(),
  cause: z.string().min(3).max(200).optional(),
});

export type UpdateDonationPoolInput = z.infer<typeof UpdateDonationPoolSchema>;

// ============================================================================
// Donation Stats (read-only response)
// ============================================================================

export const DonationStatsResponseSchema = z.object({
  totalDonations: z.number().min(0),
  targetAmount: z.number().min(0),
  mealCount: z.number().min(0),
  contributorCount: z.number().min(0),
  progressPercentage: z.number().min(0),
  status: z.nativeEnum(DonationPoolStatus),
  cause: z.string(),
  currency: z.string(),
  targetDate: z.string().datetime().optional(),
});

export type DonationStatsResponse = z.infer<typeof DonationStatsResponseSchema>;

// ============================================================================
// User Donation Stats (read-only response)
// ============================================================================

export const UserDonationStatsResponseSchema = z.object({
  totalDonated: z.number().min(0),
  contributionCount: z.number().min(0),
  badgesEarned: z.array(z.string()),
  mealsContributed: z.number().min(0),
  rank: z.number().min(1),
  currency: z.string(),
});

export type UserDonationStatsResponse = z.infer<typeof UserDonationStatsResponseSchema>;

// ============================================================================
// Donation History Query
// ============================================================================

export const DonationHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.nativeEnum(DonationPoolStatus).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type DonationHistoryQueryInput = z.infer<typeof DonationHistoryQuerySchema>;
