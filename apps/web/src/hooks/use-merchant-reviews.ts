'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewsService } from '@/services/reviews.service';
import { useAuthStore } from '@/lib/auth';
import type {
  Review,
  ReviewAnalyticsResponse,
  TrendingKeyword,
  ReviewFilters,
} from '@/types/reviews';
import type { PaginationMeta } from '@/types/dashboard';

// ─── Query keys ─────────────────────────────────────────────────────────────

const reviewKeys = {
  all: ['merchant-reviews'] as const,
  list: (page: number, limit: number, filters: string) =>
    [...reviewKeys.all, 'list', page, limit, filters] as const,
  analytics: (estId?: string) => [...reviewKeys.all, 'analytics', estId ?? 'all'] as const,
  trendingKeywords: (estId?: string, days?: number) =>
    [...reviewKeys.all, 'trending', estId ?? 'all', days ?? 30] as const,
};

// ─── Result types ───────────────────────────────────────────────────────────

interface MerchantReviewsResult {
  reviews: Review[];
  meta: PaginationMeta | undefined;
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useMerchantReviews(filters: ReviewFilters) {
  const estId = useAuthStore(s => s.activeEstablishmentId);
  const effectiveEstId = filters.establishmentId ?? estId ?? undefined;
  const filterKey = JSON.stringify({ ...filters, establishmentId: effectiveEstId });

  return useQuery({
    queryKey: reviewKeys.list(filters.page, filters.limit, filterKey),
    queryFn: async (): Promise<MerchantReviewsResult> => {
      const response = await reviewsService.getMerchantReviews({
        page: filters.page,
        limit: filters.limit,
        ...(filters.rating ? { rating: filters.rating } : {}),
        ...(effectiveEstId ? { establishmentId: effectiveEstId } : {}),
        ...(filters.hasResponse !== undefined ? { hasResponse: filters.hasResponse } : {}),
        ...(filters.sortBy ? { sortBy: filters.sortBy } : {}),
        ...(filters.sortOrder ? { sortOrder: filters.sortOrder } : {}),
      });
      return {
        reviews: response.data.data,
        meta: response.data.meta,
      };
    },
    staleTime: 2 * 60 * 1000,
    placeholderData: prev => prev,
  });
}

export function useReviewAnalytics() {
  const estId = useAuthStore(s => s.activeEstablishmentId);
  return useQuery({
    queryKey: reviewKeys.analytics(estId ?? undefined),
    queryFn: async (): Promise<ReviewAnalyticsResponse> => {
      const response = await reviewsService.getReviewAnalytics({
        ...(estId ? { establishmentId: estId } : {}),
      });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useTrendingKeywords(days = 30) {
  const estId = useAuthStore(s => s.activeEstablishmentId);
  return useQuery({
    queryKey: reviewKeys.trendingKeywords(estId ?? undefined, days),
    queryFn: async (): Promise<TrendingKeyword[]> => {
      const response = await reviewsService.getTrendingKeywords(estId ?? undefined, days);
      return response.data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useReportReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      reviewId,
      reason,
      additionalDetails,
    }: {
      reviewId: string;
      reason: string;
      additionalDetails?: string;
    }) => reviewsService.reportReview(reviewId, reason, additionalDetails),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewKeys.all });
    },
  });
}
