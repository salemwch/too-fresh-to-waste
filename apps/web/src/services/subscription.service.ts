import { apiClient } from '@/lib/api-client';
import type { BackendEnvelope } from '@/types/dashboard';

interface SubscriptionStatus {
  subscriptionStatus: 'trial' | 'paid' | 'suspended';
  subscriptionTier?: 'standard' | 'pro';
  subscriptionCycle?: 'monthly' | 'yearly';
  trialEndsAt?: string;
  subscriptionExpiresAt?: string;
  canPublishOffers: boolean;
}

interface InitiatePaymentResponse {
  payUrl: string;
  paymentRef: string;
}

interface VerifyPaymentResponse {
  success: boolean;
  establishmentId?: string;
}

export const subscriptionService = {
  getStatus(establishmentId?: string) {
    const params = establishmentId ? { establishmentId } : {};
    return apiClient.get<BackendEnvelope<SubscriptionStatus>>('/subscriptions/status', { params });
  },

  initiatePayment(tier: 'standard' | 'pro', cycle: 'monthly' | 'yearly', establishmentId?: string) {
    return apiClient.post<BackendEnvelope<InitiatePaymentResponse>>('/subscriptions/initiate', {
      tier,
      cycle,
      ...(establishmentId ? { establishmentId } : {}),
    });
  },

  verifyPayment(paymentRef: string) {
    return apiClient.get<BackendEnvelope<VerifyPaymentResponse>>('/subscriptions/verify', {
      params: { paymentRef },
    });
  },
};
