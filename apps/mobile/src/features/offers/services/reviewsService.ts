import { apiClient, unwrapBackendResponse } from '@/services/apiClient';

import type { ReviewSummary, CreateReviewRequest, Review, ReviewType } from '@foodwaste/shared';

export const reviewsService = {
  async getEstablishmentSummary(establishmentId: string): Promise<ReviewSummary> {
    const response = await apiClient.get(`/reviews/establishment/${establishmentId}/summary`);
    return unwrapBackendResponse<ReviewSummary>(response);
  },

  async createReview(data: CreateReviewRequest): Promise<Review> {
    const response = await apiClient.post('/reviews', data);
    return unwrapBackendResponse<Review>(response);
  },
};

export type { ReviewType };
