/**
 * Review Domain Zod Schemas
 *
 * Converted from backend class-validator DTOs (create-review.dto.ts).
 *
 * @module shared/schemas/review
 */
import { z } from 'zod';

import { ReviewStatus, ReviewType, SentimentType } from '../enums';

// ============================================================================
// Nested schemas
// ============================================================================

const DetailedRatingsSchema = z.object({
  foodQuality: z.number().min(1).max(5).optional(),
  serviceQuality: z.number().min(1).max(5).optional(),
  valueForMoney: z.number().min(1).max(5).optional(),
  packaging: z.number().min(1).max(5).optional(),
  pickupExperience: z.number().min(1).max(5).optional(),
  sustainability: z.number().min(1).max(5).optional(),
});

// ============================================================================
// Create Review
// ============================================================================

export const CreateReviewSchema = z.object({
  establishmentId: z.string().min(1, 'Establishment ID is required'),
  orderId: z.string().optional(),
  offerId: z.string().optional(),
  type: z.nativeEnum(ReviewType).optional().default(ReviewType.ESTABLISHMENT),
  overallRating: z.coerce
    .number()
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
  detailedRatings: DetailedRatingsSchema.optional(),
  comment: z
    .string()
    .trim()
    .min(10, 'Comment must be between 10 and 2000 characters')
    .max(2000, 'Comment must be between 10 and 2000 characters'),
  title: z
    .string()
    .trim()
    .min(3, 'Title must be between 3 and 100 characters')
    .max(100, 'Title must be between 3 and 100 characters')
    .optional(),
  images: z.array(z.string()).max(10, 'Maximum 10 images allowed').optional(),
  reviewerLocation: z.string().min(1).max(100).optional(),
  tags: z.array(z.string()).max(10, 'Maximum 10 tags allowed').optional(),
  isRecommended: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;

// ============================================================================
// Update Review
// ============================================================================

export const UpdateReviewSchema = CreateReviewSchema.partial().extend({
  updateReason: z.string().min(1).max(500).optional(),
});

export type UpdateReviewInput = z.infer<typeof UpdateReviewSchema>;

// ============================================================================
// Review Response (merchant reply)
// ============================================================================

export const ReviewResponseSchema = z.object({
  responseText: z
    .string()
    .trim()
    .min(5, 'Response must be between 5 and 1000 characters')
    .max(1000, 'Response must be between 5 and 1000 characters'),
});

export type ReviewResponseInput = z.infer<typeof ReviewResponseSchema>;

// ============================================================================
// Review Moderation (admin)
// ============================================================================

export const ReviewModerationSchema = z.object({
  status: z.nativeEnum(ReviewStatus),
  moderationReason: z.string().min(1).max(500).optional(),
});

export type ReviewModerationInput = z.infer<typeof ReviewModerationSchema>;

// ============================================================================
// Review Interaction
// ============================================================================

export const ReviewInteractionSchema = z.object({
  interactionType: z.enum(['helpful', 'not_helpful']),
});

export type ReviewInteractionInput = z.infer<typeof ReviewInteractionSchema>;

// ============================================================================
// Review Report
// ============================================================================

export const REPORT_REASONS = [
  'spam',
  'inappropriate',
  'fake',
  'offensive',
  'irrelevant',
  'other',
] as const;

export const ReviewReportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  additionalDetails: z.string().min(1).max(500).optional(),
});

export type ReviewReportInput = z.infer<typeof ReviewReportSchema>;

// ============================================================================
// Review Query
// ============================================================================

export const REVIEW_SORT_FIELDS = [
  'createdAt',
  'overallRating',
  'helpfulCount',
  'engagementScore',
] as const;

export const ReviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  status: z.nativeEnum(ReviewStatus).optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  maxRating: z.coerce.number().min(1).max(5).optional(),
  type: z.nativeEnum(ReviewType).optional(),
  sentiment: z.nativeEnum(SentimentType).optional(),
  search: z.string().min(1).max(100).optional(),
  sortBy: z.enum(REVIEW_SORT_FIELDS).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  establishmentId: z.string().optional(),
  reviewerId: z.string().optional(),
  verifiedPurchaseOnly: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform(val => val === true || val === 'true')
    .optional(),
  recommendedOnly: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform(val => val === true || val === 'true')
    .optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  tags: z.string().optional(),
});

export type ReviewQueryInput = z.infer<typeof ReviewQuerySchema>;

// ============================================================================
// Review Analytics
// ============================================================================

export const ReviewAnalyticsSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  groupBy: z.enum(['day', 'week', 'month', 'year']).optional().default('month'),
  establishmentId: z.string().optional(),
  status: z.nativeEnum(ReviewStatus).optional(),
});

export type ReviewAnalyticsInput = z.infer<typeof ReviewAnalyticsSchema>;

// ============================================================================
// Bulk Review Moderation
// ============================================================================

export const BulkReviewModerationSchema = z.object({
  reviewIds: z.array(z.string()).min(1).max(100),
  action: z.enum(['approve', 'reject', 'flag', 'spam']),
  reason: z.string().min(1).max(500).optional(),
});

export type BulkReviewModerationInput = z.infer<typeof BulkReviewModerationSchema>;

// ============================================================================
// Sub-exports
// ============================================================================

export { DetailedRatingsSchema };
