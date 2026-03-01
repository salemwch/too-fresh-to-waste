/**
 * useEstablishment Hook
 * React Query hook for fetching establishment details
 */

import { useQuery } from '@tanstack/react-query';

import { establishmentsService } from '../services/establishmentsService';

import type { Establishment } from '../types/establishment.types';

/**
 * Query keys for establishments
 */
export const establishmentKeys = {
  all: ['establishments'] as const,
  detail: (id: string) => [...establishmentKeys.all, 'detail', id] as const,
};

/**
 * Hook to fetch establishment details
 */
export const useEstablishment = (establishmentId: string | undefined) =>
  useQuery<Establishment, Error>({
    queryKey: establishmentKeys.detail(establishmentId ?? ''),
    queryFn: () => {
      if (!establishmentId) {
        throw new Error('Establishment ID is required');
      }
      return establishmentsService.getEstablishment(establishmentId);
    },
    enabled: !!establishmentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
