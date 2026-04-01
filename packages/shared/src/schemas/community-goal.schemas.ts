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

export const SetGoalTargetSchema = z.object({
  targetCount: z.number().min(100).max(1_000_000),
});

export type SetGoalTargetInput = z.infer<typeof SetGoalTargetSchema>;

// ============================================================================
// Community Goal Stats (read-only response)
// ============================================================================

export const CommunityGoalStatsSchema = z.object({
  currentCount: z.number(),
  targetCount: z.number(),
  progressPercentage: z.number(),
  remaining: z.number(),
  cycleNumber: z.number(),
  status: z.enum(['active', 'completed', 'archived']),
  lastUpdatedAt: z.string(),
});

export type CommunityGoalStats = z.infer<typeof CommunityGoalStatsSchema>;
