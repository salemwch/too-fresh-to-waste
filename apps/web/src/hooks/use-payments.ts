'use client';

import { useQuery } from '@tanstack/react-query';
import { paymentsService } from '@/services/payments.service';
import type {
  PaymentListResponse,
  PaymentQueryFilters,
  PaymentStats,
  MerchantPayment,
} from '@/types/payments';

export const paymentKeys = {
  all: ['payments'] as const,
  list: (filters: string) => [...paymentKeys.all, 'list', filters] as const,
  detail: (id: string) => [...paymentKeys.all, 'detail', id] as const,
  stats: () => [...paymentKeys.all, 'stats'] as const,
};

export function useMerchantPayments(filters: PaymentQueryFilters) {
  const filterKey = JSON.stringify(filters);
  return useQuery({
    queryKey: paymentKeys.list(filterKey),
    queryFn: async (): Promise<PaymentListResponse> => {
      const response = await paymentsService.getMerchantPayments(filters);
      return response.data.data;
    },
    staleTime: 60 * 1000,
    placeholderData: prev => prev,
  });
}

export function usePaymentDetail(id: string) {
  return useQuery({
    queryKey: paymentKeys.detail(id),
    queryFn: async (): Promise<MerchantPayment> => {
      const response = await paymentsService.getPaymentById(id);
      return response.data.data;
    },
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

export function usePaymentStats() {
  return useQuery({
    queryKey: paymentKeys.stats(),
    queryFn: async (): Promise<PaymentStats> => {
      const response = await paymentsService.getStats();
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
