import { apiClient } from '@/lib/api-client';
import type { BackendEnvelope } from '@/types/dashboard';
import type { JoinWaitlistPayload, PublicImpact, PublicZone } from '@/types/public';

/**
 * The unauthenticated marketing endpoints.
 *
 * Thin wrappers over `apiClient`, matching the service pattern used by the
 * dashboard. These routes carry no session, but the shared client is still the
 * right seam — it owns the base URL and the response envelope.
 */
export const publicService = {
  getImpact() {
    return apiClient.get<BackendEnvelope<PublicImpact>>('/public/impact');
  },

  getZones() {
    return apiClient.get<BackendEnvelope<PublicZone[]>>('/public/geozones');
  },

  joinWaitlist(payload: JoinWaitlistPayload) {
    return apiClient.post<BackendEnvelope<null>>('/public/waitlist', payload);
  },
};
