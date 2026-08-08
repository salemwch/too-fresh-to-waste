'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryService } from '@/services/inventory.service';
import { useAuthStore } from '@/lib/auth';
import type {
  InventoryItem,
  InventoryFilters,
  StockUpdatePayload,
  InventoryAlert,
  InventoryAnalytics,
} from '@/types/inventory';
import type { PaginationMeta } from '@/types/dashboard';

const inventoryKeys = {
  all: ['inventory'] as const,
  list: (filters: string) => [...inventoryKeys.all, 'list', filters] as const,
  analytics: () => [...inventoryKeys.all, 'analytics'] as const,
  alerts: () => [...inventoryKeys.all, 'alerts'] as const,
};

interface InventoryListResult {
  items: InventoryItem[];
  meta: PaginationMeta | undefined;
}

// Backend returns { items, total, page, totalPages } for list endpoints,
// but the axios response type declares data as the item type directly.
// This helper safely extracts the array from either shape.
function extractItems<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && 'items' in payload) {
    return Array.isArray((payload as Record<string, unknown>).items)
      ? ((payload as Record<string, unknown>).items as T[])
      : [];
  }
  return [];
}

function extractMeta(
  payload: unknown,
  fallbackMeta: PaginationMeta | undefined,
): PaginationMeta | undefined {
  if (fallbackMeta) return fallbackMeta;
  if (
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    'totalPages' in payload
  ) {
    const p = payload as Record<string, unknown>;
    return {
      page: (p.page as number) ?? 1,
      total: (p.total as number) ?? 0,
      limit: (p.limit as number) ?? 20,
      totalPages: (p.totalPages as number) ?? 1,
      hasNext: ((p.page as number) ?? 1) < ((p.totalPages as number) ?? 1),
      hasPrev: ((p.page as number) ?? 1) > 1,
    };
  }
  return undefined;
}

function extractAlerts(payload: unknown): InventoryAlert[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && 'alerts' in payload) {
    return Array.isArray((payload as Record<string, unknown>).alerts)
      ? ((payload as Record<string, unknown>).alerts as InventoryAlert[])
      : [];
  }
  return [];
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
      const payload: unknown = response.data.data;
      return {
        items: extractItems<InventoryItem>(payload),
        meta: extractMeta(payload, response.data.meta),
      };
    },
    staleTime: 60 * 1000,
    placeholderData: prev => prev,
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
      const payload: unknown = response.data.data;
      return extractAlerts(payload);
    },
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
