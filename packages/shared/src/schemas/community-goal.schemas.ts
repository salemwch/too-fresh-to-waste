/**
 * Community Goal Domain Zod Schemas
 *
 * Converted from backend class-validator DTOs (community-goal.dto.ts).
 *
 * @module shared/schemas/community-goal
 */
import { z } from 'zod';

// ============================================================================
// Set Goal Target
// ============================================================================

export const MonthlyGoalCauseTypeSchema = z.enum(['FOOD', 'CLOTHING', 'EDUCATION', 'MEDICINE']);

export const SetGoalTargetSchema = z.object({
  targetCount: z.number().min(100).max(1_000_000),
  causeType: MonthlyGoalCauseTypeSchema.optional(),
  causeTitle: z.string().max(80).optional(),
  causeDescription: z.string().max(600).optional(),
  seasonName: z.string().max(80).optional(),
  endDate: z.string().datetime().optional(),
});

export type SetGoalTargetInput = z.infer<typeof SetGoalTargetSchema>;

// ============================================================================
// Community Goal Stats (read-only response)
// ============================================================================

export const MonthlyBagGoalStatsSchema = z.object({
  currentCount: z.number(),
  targetCount: z.number(),
  progressPercentage: z.number(),
  remaining: z.number(),
  cycleNumber: z.number(),
  status: z.enum(['active', 'completed', 'archived']),
  lastUpdatedAt: z.string(),
  causeType: MonthlyGoalCauseTypeSchema.optional(),
  causeTitle: z.string().optional(),
  causeDescription: z.string().optional(),
  seasonName: z.string().optional(),
  endDate: z.string().optional(),
  participantCount: z.number().optional(),
});
