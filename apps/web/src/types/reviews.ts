// Passthroughs from @foodwaste/shared, narrowed to what web actually imports.
// Re-exporting the whole surface made this file look like the canonical home for
// review types; anything not listed here should be imported from
// @foodwaste/shared directly rather than added back.
export type { Review, ReviewSummary } from '@foodwaste/shared';

export { REPORT_REASONS } from '@foodwaste/shared';

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
