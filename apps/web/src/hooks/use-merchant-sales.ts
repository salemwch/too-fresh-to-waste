'use client';

import { useQuery } from '@tanstack/react-query';

import { dashboardKeys } from '@/hooks/use-merchant-dashboard';
import { useAuthStore } from '@/lib/auth';
import { dashboardService } from '@/services/dashboard.service';
import type { MerchantSalesChart, MerchantSalesSummary, SalesPeriod } from '@/types/payments';

/**
 * The single earnings calculation for the given period - food only, cash and
 * online lines, commission and the unverified-orders notice. Backend:
 * GET /orders/merchant-sales-summary?period=&establishmentId=
 */
export function useSalesSummary(period: SalesPeriod) {
  const estId = useAuthStore(s => s.activeEstablishmentId) ?? undefined;
  return useQuery({
    queryKey: dashboardKeys.salesSummary(period, estId),
    queryFn: async (): Promise<MerchantSalesSummary> => {
      const response = await dashboardService.getSalesSummary(period, estId);
      return response.data.data;
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Earnings per slot (hour/day/month, chosen server-side from the period), for
 * the dashboard trend chart. Backend: GET /orders/merchant-sales-chart?period=&establishmentId=
 */
export function useSalesChart(period: SalesPeriod) {
  const estId = useAuthStore(s => s.activeEstablishmentId) ?? undefined;
  return useQuery({
    queryKey: dashboardKeys.salesChart(period, estId),
    queryFn: async (): Promise<MerchantSalesChart> => {
      const response = await dashboardService.getSalesChart(period, estId);
      return response.data.data;
    },
    staleTime: 60 * 1000,
  });
}
