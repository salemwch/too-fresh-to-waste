'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { paymentsService } from '@/services/payments.service';
import { useAuthStore } from '@/lib/auth';
import type {
  EarningsRowsPage,
  EarningsTab,
  MerchantSalesSummary,
  SalesPeriod,
} from '@/types/payments';

export const paymentKeys = {
  all: ['payments'] as const,
  stats: (period: SalesPeriod, estId?: string) =>
    [...paymentKeys.all, 'stats', period, estId ?? 'all'] as const,
  rows: (period: SalesPeriod, tab: EarningsTab, estId?: string) =>
    [...paymentKeys.all, 'rows', period, tab, estId ?? 'all'] as const,
};

/** The stats card - the same earnings calculation as the Dashboard. */
export function usePaymentStats(period: SalesPeriod) {
  const estId = useAuthStore(s => s.activeEstablishmentId) ?? undefined;
  return useQuery({
    queryKey: paymentKeys.stats(period, estId),
    queryFn: async (): Promise<MerchantSalesSummary> => {
      const response = await paymentsService.getStats(period, estId);
      return response.data.data;
    },
    staleTime: 60 * 1000,
  });
}

/** The exact orders behind one Payments tab, paginated with the backend's opaque cursor. */
export function useMerchantEarningsRows(period: SalesPeriod, tab: EarningsTab) {
  const estId = useAuthStore(s => s.activeEstablishmentId) ?? undefined;
  return useInfiniteQuery({
    queryKey: paymentKeys.rows(period, tab, estId),
    queryFn: async ({ pageParam }): Promise<EarningsRowsPage> => {
      const response = await paymentsService.getMyPayments({
        period,
        tab,
        ...(estId ? { establishmentId: estId } : {}),
        ...(pageParam ? { after: pageParam } : {}),
      });
      return response.data.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    staleTime: 60 * 1000,
  });
}
