'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { publicService } from '@/services/public.service';
import type { JoinWaitlistPayload, PublicImpact, PublicZone } from '@/types/public';

const publicKeys = {
  all: ['public'] as const,
  impact: () => [...publicKeys.all, 'impact'] as const,
  zones: () => [...publicKeys.all, 'zones'] as const,
};

/**
 * Both queries back a marketing section that every visitor sees identically,
 * and the server already caches them for five minutes. A matching client
 * `staleTime` stops a scroll back to the section from refiring the request.
 */
const MARKETING_STALE_TIME = 5 * 60 * 1000;

export function usePublicImpact() {
  return useQuery({
    queryKey: publicKeys.impact(),
    queryFn: async (): Promise<PublicImpact> => {
      const response = await publicService.getImpact();
      return response.data.data;
    },
    staleTime: MARKETING_STALE_TIME,
  });
}

export function usePublicZones() {
  return useQuery({
    queryKey: publicKeys.zones(),
    queryFn: async (): Promise<PublicZone[]> => {
      const response = await publicService.getZones();
      return response.data.data;
    },
    staleTime: MARKETING_STALE_TIME,
  });
}

export function useJoinWaitlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: JoinWaitlistPayload) => {
      await publicService.joinWaitlist(payload);
    },
    onSuccess: async () => {
      // The queue is ranked by these counts, so the visitor should see their own
      // sign-up move the list they just acted on.
      await queryClient.invalidateQueries({ queryKey: publicKeys.zones() });
    },
  });
}
