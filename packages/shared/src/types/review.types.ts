/**
 * Review types — single source of truth for all apps
 *
 * Represents the API response shape for reviews.
 * Source: apps/food-waste-backend/src/reviews/schemas/review.schema.ts
 *         apps/food-waste-backend/src/reviews/dto/create-review.dto.ts
 */

import type { ReviewStatus, ReviewType, SentimentType } from '../enums/review.enum';

// ─── Sub-types ──────────────────────────────────────────────────────────────

/** Detailed per-category ratings (all optional, 1-5 scale) */
export interface DetailedRatings {
  foodQuality?: number;
  serviceQuality?: number;
  valueForMoney?: number;
  packaging?: number;
  pickupExperience?: number;
  sustainability?: number;
}

/** Engagement metrics for a review */
export interface ReviewMetrics {
  helpfulCount: number;
  notHelpfulCount: number;
  reportCount: number;
  viewCount: number;
  shareCount: number;
}

/** Image attached to a review */
export interface ReviewImage {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  isVerified?: boolean;
}

/** AI-driven sentiment analysis result */
export interface ReviewSentiment {
  sentiment: SentimentType;
  confidence: number;
  positiveScore: number;
  negativeScore: number;
  neutralScore: number;
  keywords: string[];
  language?: string;
}

/** Merchant/owner response to a review */
export interface ReviewResponseEntry {
  responseText: string;
  respondedBy: string;
  respondedAt: Date;
  isOwnerResponse: boolean;
  lastEditedAt?: Date;
}

/** Report filed against a review */
export interface ReviewReport {
  reportedBy: string;
  reason: string;
  additionalDetails?: string;
  reportedAt: Date;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolutionNote?: string;
}

// ─── Main Review type (API response shape) ──────────────────────────────────

/**
 * Full review object as returned by GET /reviews/:id
 *
 * Fields map 1-to-1 with the backend Review schema.
 * MongoDB ObjectId references are serialized as strings.
 */
export interface Review {
  /** Review unique identifier */
  id: string;

  /** ID of the user who wrote the review */
  reviewerId: string;

  /** ID of the reviewed establishment */
  establishmentId: string;

  /** Associated order ID (if review is for a specific order) */
  orderId?: string;

  /** Associated offer ID (if review is for a specific offer) */
  offerId?: string;

  /** What this review is about */
  type: ReviewType;

  /** Overall rating (1-5) */
  overallRating: number;

  /** Per-category breakdown (optional) */
  detailedRatings?: DetailedRatings;

  /** Review text (10-2000 chars) */
  comment: string;

  /** Short title (auto-generated from comment if not provided) */
  title?: string;

  /** Attached images */
  images: ReviewImage[];

  /** Moderation status */
  status: ReviewStatus;

  /** Engagement metrics */
  metrics: ReviewMetrics;

  /** AI sentiment analysis (populated asynchronously) */
  sentimentAnalysis?: ReviewSentiment;

  /** Merchant/owner responses */
  responses: ReviewResponseEntry[];

  /** Whether reviewer actually purchased from this establishment */
  isVerifiedPurchase: boolean;

  /** Whether reviewer recommends this establishment */
  isRecommended: boolean;

  /** Whether the review has been edited after initial submission */
  isEdited: boolean;

  /** Last edit timestamp */
  lastEditedAt?: Date;

  /** Reviewer's approximate location */
  reviewerLocation?: string;

  /** User-defined or auto-assigned tags */
  tags: string[];

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;
}

// ─── Request DTOs ───────────────────────────────────────────────────────────

/** POST /reviews — Create a new review */
export interface CreateReviewRequest {
  /** What this review is about */
  type: ReviewType;

  /** Target establishment */
  establishmentId: string;

  /** Associated order (required for order reviews) */
  orderId?: string;

  /** Associated offer */
  offerId?: string;

  /** Overall rating (1-5) */
  overallRating: number;

  /** Per-category ratings */
  detailedRatings?: DetailedRatings;

  /** Review text (10-2000 chars) */
  comment: string;

  /** Short title (max 100 chars) */
  title?: string;

  /** Image URLs to attach */
  images?: string[];

  /** Tags for the review */
  tags?: string[];

  /** Does the reviewer recommend? */
  isRecommended?: boolean;
}

/** PATCH /reviews/:id — Update an existing review */
export interface UpdateReviewRequest {
  overallRating?: number;
  detailedRatings?: DetailedRatings;
  comment?: string;
  title?: string;
  tags?: string[];
  isRecommended?: boolean;
}

/** POST /reviews/:id/interact — Mark as helpful/not helpful */
export interface ReviewInteractionRequest {
  interactionType: 'helpful' | 'not_helpful';
}

/** POST /reviews/:id/report — Report a review */
export interface ReviewReportRequest {
  reason: string;
  additionalDetails?: string;
}

/** POST /reviews/:id/response — Merchant response */
export interface ReviewResponseRequest {
  responseText: string;
}

/** GET /reviews — Query parameters */
export interface ReviewQueryParams {
  page?: number;
  limit?: number;
  type?: ReviewType;
  status?: ReviewStatus;
  rating?: number;
  sortBy?: 'createdAt' | 'overallRating' | 'helpfulCount';
  sortOrder?: 'asc' | 'desc';
  establishmentId?: string;
}

// ─── Response types ─────────────────────────────────────────────────────────

/** Review list response with pagination meta */
export interface ReviewListResponse {
  reviews: Review[];
  total: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
}

/** Establishment review summary (GET /reviews/establishment/:id/summary) */
export interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  recentReviews: Review[];
  /** Per-category average scores — keys match DetailedRatings field names */
  averageDetailedRatings?: Record<string, number>;
}

/** User review stats (GET /reviews/user/:userId/stats) */
export interface UserReviewStats {
  totalReviews: number;
  averageRating: number;
  helpfulVotes: number;
  verifiedPurchases: number;
}
