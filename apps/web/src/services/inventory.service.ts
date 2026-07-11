import { apiClient } from '@/lib/api-client';
import type { BackendEnvelope, PaginationMeta } from '@/types/dashboard';
import type {
  InventoryItem,
  InventoryFilters,
  StockUpdatePayload,
  BulkUpdatePayload,
  InventoryAlert,
  InventoryAnalytics,
  StockHistoryEntry,
} from '@/types/inventory';

const BASE = '/inventory';

export const inventoryService = {
  getItems(filters: InventoryFilters) {
    return apiClient.get<BackendEnvelope<InventoryItem[]> & { meta?: PaginationMeta }>(BASE, {
      params: {
        page: filters.page,
        limit: filters.limit,
        ...(filters.establishmentId ? { establishmentId: filters.establishmentId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.lowStock ? { lowStock: filters.lowStock } : {}),
        ...(filters.expiringSoon ? { expiringSoon: filters.expiringSoon } : {}),
        ...(filters.expiringInDays ? { expiringInDays: filters.expiringInDays } : {}),
        ...(filters.sortBy ? { sortBy: filters.sortBy } : {}),
      },
    });
  },

  getItem(id: string) {
    return apiClient.get<BackendEnvelope<InventoryItem>>(`${BASE}/${id}`);
  },

  updateStock(id: string, payload: StockUpdatePayload) {
    return apiClient.patch<BackendEnvelope<InventoryItem>>(`${BASE}/${id}/stock`, payload);
  },

  bulkUpdateStock(payload: BulkUpdatePayload) {
    return apiClient.post<BackendEnvelope<{ updated: number }>>(`${BASE}/bulk-update`, payload);
  },

  getAnalytics() {
    return apiClient.get<BackendEnvelope<InventoryAnalytics>>(`${BASE}/analytics/overview`);
  },

  getAlerts() {
    return apiClient.get<BackendEnvelope<InventoryAlert[]>>(`${BASE}/alerts/active`);
  },

  getLowStockReport() {
    return apiClient.get<BackendEnvelope<InventoryItem[]>>(`${BASE}/reports/low-stock`);
  },

  getExpiringReport(days = 7) {
    return apiClient.get<BackendEnvelope<InventoryItem[]>>(`${BASE}/reports/expiring`, {
      params: { days },
    });
  },

  getStockHistory(id: string) {
    return apiClient.get<BackendEnvelope<StockHistoryEntry[]>>(`${BASE}/${id}/history`);
  },
};
