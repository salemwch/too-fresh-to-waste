'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { paymentsService } from '@/services/payments.service';
import type {
  EarningsRowsPage,
  EarningsTab,
  MerchantSalesSummary,
  SalesPeriod,
} from '@/types/payments';

const paymentKeys = {
  all: ['payments'] as const,
  stats: (period: SalesPeriod) => [...paymentKeys.all, 'stats', period] as const,
  rows: (period: SalesPeriod, tab: EarningsTab) =>
    [...paymentKeys.all, 'rows', period, tab] as const,
};

/** The stats card - the same earnings calculation as the Dashboard. */
export function usePaymentStats(period: SalesPeriod) {
  return useQuery({
    queryKey: paymentKeys.stats(period),
    queryFn: async (): Promise<MerchantSalesSummary> => {
      const response = await paymentsService.getStats(period);
      return response.data.data;
    },
    staleTime: 60 * 1000,
  });
}

/** The exact orders behind one Payments tab, paginated with the backend's opaque cursor. */
export function useMerchantEarningsRows(period: SalesPeriod, tab: EarningsTab) {
  return useInfiniteQuery({
    queryKey: paymentKeys.rows(period, tab),
    queryFn: async ({ pageParam }): Promise<EarningsRowsPage> => {
      const response = await paymentsService.getMyPayments({
        period,
        tab,
        ...(pageParam ? { after: pageParam } : {}),
      });
      return response.data.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    staleTime: 60 * 1000,
  });
}
