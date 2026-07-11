import { apiClient } from '@/lib/api-client';
import type { BackendEnvelope } from '@/types/dashboard';
import type {
  Review,
  ReviewAnalyticsResponse,
  TrendingKeyword,
  ReviewSummary,
} from '@/types/reviews';

const REVIEWS_BASE = '/reviews';

export const reviewsService = {
  getMerchantReviews(params: {
    page?: number;
    limit?: number;
    rating?: number;
    establishmentId?: string;
    hasResponse?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    return apiClient.get<BackendEnvelope<Review[]>>(`${REVIEWS_BASE}/merchant/reviews`, {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 10,
        ...(params.rating ? { rating: params.rating } : {}),
        ...(params.establishmentId ? { establishmentId: params.establishmentId } : {}),
        ...(params.hasResponse !== undefined ? { hasResponse: params.hasResponse } : {}),
        ...(params.sortBy ? { sortBy: params.sortBy } : {}),
        ...(params.sortOrder ? { sortOrder: params.sortOrder } : {}),
      },
    });
  },

  getReviewAnalytics(params?: { startDate?: string; endDate?: string; establishmentId?: string }) {
    return apiClient.get<BackendEnvelope<ReviewAnalyticsResponse>>(`${REVIEWS_BASE}/analytics`, {
      params: {
        ...(params?.startDate ? { startDate: params.startDate } : {}),
        ...(params?.endDate ? { endDate: params.endDate } : {}),
        ...(params?.establishmentId ? { establishmentId: params.establishmentId } : {}),
      },
    });
  },

  getTrendingKeywords(establishmentId?: string, days?: number) {
    return apiClient.get<BackendEnvelope<TrendingKeyword[]>>(`${REVIEWS_BASE}/trending/keywords`, {
      params: {
        ...(establishmentId ? { establishmentId } : {}),
        ...(days ? { days } : {}),
      },
    });
  },

  respondToReview(reviewId: string, responseText: string) {
    return apiClient.post<BackendEnvelope<Review>>(`${REVIEWS_BASE}/${reviewId}/response`, {
      responseText,
    });
  },

  reportReview(reviewId: string, reason: string, additionalDetails?: string) {
    return apiClient.post<BackendEnvelope<{ message: string }>>(
      `${REVIEWS_BASE}/${reviewId}/report`,
      {
        reason,
        ...(additionalDetails ? { additionalDetails } : {}),
      },
    );
  },

  getEstablishmentSummary(establishmentId: string) {
    return apiClient.get<BackendEnvelope<ReviewSummary>>(
      `${REVIEWS_BASE}/establishment/${establishmentId}/summary`,
    );
  },
};
