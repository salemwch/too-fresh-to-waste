/**
 * Driver Orders Hooks
 * TanStack Query hooks for driver order operations with focus refetch
 *
 * Features:
 * - useAvailableOrders: Fetches nearby available orders with 30s auto-refetch
 * - useAcceptOrder: Accept an available order
 * - useMarkDelivered: Mark an accepted order as delivered
 * - useUnassignOrder: Unassign from a delivery (driver cancellation)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useQueryWithFocus } from '@/lib/react-query/hooks';
import { Logger } from '@/utils/logger';

import { driverService, type DriverAvailableOrder } from '../services/driver.service';

/**
 * Query key factory for driver orders
 * Ensures consistent cache invalidation and refetch patterns
 */
const driverOrdersKeys = {
  all: ['driver', 'orders'] as const,
  available: (lat: number, lng: number) =>
    [...driverOrdersKeys.all, 'available', lat, lng] as const,
};

/**
 * Fetch available orders near driver's current location
 *
 * Auto-refetches every 30 seconds to keep order list fresh
 * Also refetches when screen gains focus (via useQueryWithFocus)
 *
 * @param lat - Driver's latitude
 * @param lng - Driver's longitude
 * @param enabled - Optional flag to enable/disable the query (default: true)
 */
export function useAvailableOrders(lat: number, lng: number, enabled = true) {
  return useQueryWithFocus(
    driverOrdersKeys.available(lat, lng),
    () => driverService.getAvailableOrders(lat, lng),
    {
      enabled,
      refetchInterval: 30_000, // Auto-refetch every 30 seconds
      refetchOnWindowFocus: true,
      staleTime: 10_000, // Consider data stale after 10 seconds
    },
  );
}

/**
 * Accept an available order
 *
 * Invalidates available orders cache on success to ensure UI reflects reality
 * No AbortController used (fire-and-forget POST per mobile rule #2)
 *
 * @returns Mutation hook with mutationFn(orderId: string)
 */
export function useAcceptOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string): Promise<DriverAvailableOrder> => {
      Logger.debug('[useAcceptOrder] Accepting order', { orderId });
      return driverService.acceptOrder(orderId);
    },
    onSuccess: data => {
      Logger.debug('[useAcceptOrder] Order accepted successfully', {
        orderId: data._id,
        status: data.status,
      });
      // Invalidate available orders list so it removes accepted order
      void queryClient.invalidateQueries({ queryKey: driverOrdersKeys.all });
    },
    onError: error => {
      Logger.error('[useAcceptOrder] Failed to accept order', undefined, error as Error);
    },
  });
}

/**
 * Mark an accepted order as delivered
 *
 * Invalidates available orders cache on success
 * No AbortController used (fire-and-forget POST per mobile rule #2)
 *
 * @returns Mutation hook with mutationFn(orderId: string)
 */
export function useMarkDelivered() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string): Promise<DriverAvailableOrder> => {
      Logger.debug('[useMarkDelivered] Marking order as delivered', { orderId });
      return driverService.markDelivered(orderId);
    },
    onSuccess: data => {
      Logger.debug('[useMarkDelivered] Order marked as delivered', {
        orderId: data._id,
        status: data.status,
      });
      // Invalidate available orders list
      void queryClient.invalidateQueries({ queryKey: driverOrdersKeys.all });
    },
    onError: error => {
      Logger.error(
        '[useMarkDelivered] Failed to mark order as delivered',
        undefined,
        error as Error,
      );
    },
  });
}

/**
 * Unassign from a delivery (driver cancellation)
 *
 * Invalidates available orders cache on success
 * No AbortController used (fire-and-forget POST per mobile rule #2)
 *
 * @returns Mutation hook with mutationFn({ orderId, reason? })
 */
export function useUnassignOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      reason,
    }: {
      orderId: string;
      reason?: string;
    }): Promise<DriverAvailableOrder> => {
      Logger.debug('[useUnassignOrder] Unassigning from order', { orderId, reason });
      return driverService.unassignOrder(orderId, reason);
    },
    onSuccess: data => {
      Logger.debug('[useUnassignOrder] Order unassigned successfully', {
        orderId: data._id,
        status: data.status,
      });
      // Invalidate available orders list
      void queryClient.invalidateQueries({ queryKey: driverOrdersKeys.all });
    },
    onError: error => {
      Logger.error('[useUnassignOrder] Failed to unassign from order', undefined, error as Error);
    },
  });
}
