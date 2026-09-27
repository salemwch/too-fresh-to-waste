import { apiClient } from '@/lib/api-client';
import type { BackendEnvelope } from '@/types/dashboard';
import type {
  EarningsRowsPage,
  EarningsTab,
  MerchantSalesSummary,
  SalesPeriod,
} from '@/types/payments';

const BASE = '/payments';

export const paymentsService = {
  /** GET /payments/stats?period= - the same earnings calculation as the Dashboard. */
  getStats(period: SalesPeriod) {
    return apiClient.get<BackendEnvelope<MerchantSalesSummary>>(`${BASE}/stats`, {
      params: { period },
    });
  },

  /** GET /payments/my-merchant-payments?period=&tab=&after=&limit= */
  getMyPayments(params: { period: SalesPeriod; tab: EarningsTab; after?: string; limit?: number }) {
    return apiClient.get<BackendEnvelope<EarningsRowsPage>>(`${BASE}/my-merchant-payments`, {
      params: {
        period: params.period,
        tab: params.tab,
        limit: params.limit ?? 20,
        ...(params.after ? { after: params.after } : {}),
      },
    });
  },
};
