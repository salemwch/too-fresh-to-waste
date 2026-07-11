'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryService } from '@/services/inventory.service';
import { useAuthStore } from '@/lib/auth';
import type {
  InventoryItem,
  InventoryFilters,
  StockUpdatePayload,
  BulkUpdatePayload,
  InventoryAlert,
  InventoryAnalytics,
  StockHistoryEntry,
} from '@/types/inventory';
import type { PaginationMeta } from '@/types/dashboard';

export const inventoryKeys = {
  all: ['inventory'] as const,
  list: (filters: string) => [...inventoryKeys.all, 'list', filters] as const,
  item: (id: string) => [...inventoryKeys.all, 'item', id] as const,
  analytics: () => [...inventoryKeys.all, 'analytics'] as const,
  alerts: () => [...inventoryKeys.all, 'alerts'] as const,
  lowStock: () => [...inventoryKeys.all, 'low-stock'] as const,
  expiring: (days: number) => [...inventoryKeys.all, 'expiring', days] as const,
  history: (id: string) => [...inventoryKeys.all, 'history', id] as const,
};

interface InventoryListResult {
  items: InventoryItem[];
  meta: PaginationMeta | undefined;
}

export function useInventoryItems(filters: InventoryFilters) {
  const estId = useAuthStore(s => s.activeEstablishmentId);
  const effectiveFilters = {
    ...filters,
    ...(estId && !filters.establishmentId ? { establishmentId: estId } : {}),
  };
  const filterKey = JSON.stringify(effectiveFilters);

  return useQuery({
    queryKey: inventoryKeys.list(filterKey),
    queryFn: async (): Promise<InventoryListResult> => {
      const response = await inventoryService.getItems(effectiveFilters);
      return {
        items: response.data.data,
        meta: response.data.meta,
      };
    },
    staleTime: 60 * 1000,
    placeholderData: prev => prev,
  });
}

export function useInventoryItem(id: string) {
  return useQuery({
    queryKey: inventoryKeys.item(id),
    queryFn: async (): Promise<InventoryItem> => {
      const response = await inventoryService.getItem(id);
      return response.data.data;
    },
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

export function useUpdateStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: StockUpdatePayload }) =>
      inventoryService.updateStock(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

export function useBulkUpdateStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BulkUpdatePayload) => inventoryService.bulkUpdateStock(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

export function useInventoryAnalytics() {
  return useQuery({
    queryKey: inventoryKeys.analytics(),
    queryFn: async (): Promise<InventoryAnalytics> => {
      const response = await inventoryService.getAnalytics();
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useInventoryAlerts() {
  return useQuery({
    queryKey: inventoryKeys.alerts(),
    queryFn: async (): Promise<InventoryAlert[]> => {
      const response = await inventoryService.getAlerts();
      return response.data.data;
    },
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useLowStockReport() {
  return useQuery({
    queryKey: inventoryKeys.lowStock(),
    queryFn: async (): Promise<InventoryItem[]> => {
      const response = await inventoryService.getLowStockReport();
      return response.data.data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useExpiringReport(days = 7) {
  return useQuery({
    queryKey: inventoryKeys.expiring(days),
    queryFn: async (): Promise<InventoryItem[]> => {
      const response = await inventoryService.getExpiringReport(days);
      return response.data.data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useStockHistory(id: string) {
  return useQuery({
    queryKey: inventoryKeys.history(id),
    queryFn: async (): Promise<StockHistoryEntry[]> => {
      const response = await inventoryService.getStockHistory(id);
      return response.data.data;
    },
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}
