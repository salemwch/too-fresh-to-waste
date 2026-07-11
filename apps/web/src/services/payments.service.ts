import { apiClient } from '@/lib/api-client';
import type { BackendEnvelope } from '@/types/dashboard';
import type {
  MerchantPayment,
  PaymentListResponse,
  PaymentQueryFilters,
  PaymentStats,
} from '@/types/payments';

const BASE = '/payments';

export const paymentsService = {
  getMerchantPayments(filters: PaymentQueryFilters) {
    return apiClient.get<BackendEnvelope<PaymentListResponse>>(`${BASE}/my-merchant-payments`, {
      params: {
        limit: filters.limit ?? 20,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.after ? { after: filters.after } : {}),
        ...(filters.fromDate ? { fromDate: filters.fromDate } : {}),
        ...(filters.toDate ? { toDate: filters.toDate } : {}),
        ...(filters.minAmount ? { minAmount: filters.minAmount } : {}),
        ...(filters.maxAmount ? { maxAmount: filters.maxAmount } : {}),
        ...(filters.sortBy ? { sortBy: filters.sortBy } : {}),
        ...(filters.sortOrder ? { sortOrder: filters.sortOrder } : {}),
      },
    });
  },

  getPaymentById(id: string) {
    return apiClient.get<BackendEnvelope<MerchantPayment>>(`${BASE}/${id}`);
  },

  getStats() {
    return apiClient.get<BackendEnvelope<PaymentStats>>(`${BASE}/stats`);
  },
};
