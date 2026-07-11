export type {
  Review,
  ReviewSummary,
  ReviewResponseEntry,
  ReviewReportRequest,
  ReviewResponseRequest,
  ReviewQueryParams,
  DetailedRatings,
  ReviewMetrics,
  ReviewImage,
  ReviewSentiment,
  ReviewListResponse,
} from '@foodwaste/shared';

export { ReviewStatus, ReviewType, SentimentType, REPORT_REASONS } from '@foodwaste/shared';

// ─── Frontend-specific types ────────────────────────────────────────────────

export interface ReviewAnalyticsResponse {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<string, number>;
  responseRate: number;
  trends: Array<{ period: string; count: number; avgRating: number }>;
}

export interface TrendingKeyword {
  keyword: string;
  count: number;
  sentiment?: string;
}

export interface ReviewFilters {
  rating?: number;
  establishmentId?: string;
  hasResponse?: boolean;
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
