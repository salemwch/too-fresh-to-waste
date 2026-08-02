/**
 * Driver Orders Hooks
 * TanStack Query hooks for the driver delivery lifecycle.
 *
 * Every mutation invalidates `driverOrdersKeys.all`, which covers the available
 * pool, the active order, history and earnings — a single transition can change
 * all four, and they are cheap to refetch.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Freshness } from '@/lib/react-query/freshness';
import { useQueryWithFocus } from '@/lib/react-query/hooks';
import { Logger } from '@/utils/logger';

import {
  driverService,
  type DriverAvailableOrder,
  type DriverEarningsSummary,
  type DriverOrderHistoryPage,
  type DriverProfile,
} from '../services/driver.service';

/**
 * Query key factory for driver data.
 * All keys nest under ['driver'] so one invalidate refreshes the whole feature.
 */
const driverOrdersKeys = {
  all: ['driver'] as const,
  profile: () => [...driverOrdersKeys.all, 'profile'] as const,
  available: (lat: number, lng: number) =>
    [...driverOrdersKeys.all, 'orders', 'available', lat, lng] as const,
  active: () => [...driverOrdersKeys.all, 'orders', 'active'] as const,
  history: (page: number) => [...driverOrdersKeys.all, 'orders', 'history', page] as const,
  earnings: () => [...driverOrdersKeys.all, 'earnings'] as const,
};

// ── Availability ────────────────────────────────────────────────────────────

/** The driver's profile, including the online flag that gates everything else. */
export function useDriverProfile() {
  return useQueryWithFocus(driverOrdersKeys.profile(), () => driverService.getProfile(), {
    staleTime: Freshness.LIVE,
  });
}

/**
 * Online/offline toggle.
 *
 * Optimistically flips the cached flag so the switch responds instantly, and
 * rolls back if the request fails — a switch that lags a round-trip feels broken.
 */
export function useSetOnlineStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (isOnline: boolean) => driverService.setOnlineStatus(isOnline),

    onMutate: async (isOnline: boolean) => {
      await queryClient.cancelQueries({ queryKey: driverOrdersKeys.profile() });
      const previous = queryClient.getQueryData<DriverProfile>(driverOrdersKeys.profile());

      if (previous) {
        queryClient.setQueryData<DriverProfile>(driverOrdersKeys.profile(), {
          ...previous,
          isOnline,
        });
      }

      return { previous };
    },

    onError: (error, _isOnline, context) => {
      if (context?.previous) {
        queryClient.setQueryData(driverOrdersKeys.profile(), context.previous);
      }
      Logger.error('[useSetOnlineStatus] Failed to change status', undefined, error as Error);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: driverOrdersKeys.all });
    },
  });
}

// ── Order pool ──────────────────────────────────────────────────────────────

/**
 * Available orders near the driver.
 *
 * Auto-refetches every 30s and on screen focus. Returns an empty list when the
 * driver is offline or already carrying an order — the screen renders a banner
 * for those cases rather than an empty-state.
 */
export function useAvailableOrders(lat: number, lng: number, enabled = true) {
  return useQueryWithFocus(
    driverOrdersKeys.available(lat, lng),
    () => driverService.getAvailableOrders(lat, lng),
    {
      enabled,
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
      staleTime: Freshness.REALTIME,
    },
  );
}

/**
 * The driver's in-progress delivery.
 *
 * This is the app-restart recovery path: accepted orders leave the available
 * pool, so without this query a driver who reopens the app mid-delivery would
 * see nothing.
 */
export function useActiveOrder(enabled = true) {
  return useQueryWithFocus(driverOrdersKeys.active(), () => driverService.getActiveOrder(), {
    enabled,
    refetchOnWindowFocus: true,
    staleTime: Freshness.REALTIME,
  });
}

export function useDriverOrderHistory(page = 1) {
  return useQuery<DriverOrderHistoryPage>({
    queryKey: driverOrdersKeys.history(page),
    queryFn: () => driverService.getOrderHistory(page),
    staleTime: Freshness.SHORT,
  });
}

export function useDriverEarnings() {
  return useQueryWithFocus<DriverEarningsSummary>(
    driverOrdersKeys.earnings(),
    () => driverService.getEarnings(),
    { staleTime: Freshness.SHORT },
  );
}

// ── Lifecycle mutations ─────────────────────────────────────────────────────

/**
 * Accept an available order.
 *
 * No AbortController — per mobile rule #2, cleanup would abort the in-flight
 * POST and the driver would think the accept failed while the backend committed it.
 */
export function useAcceptOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string): Promise<DriverAvailableOrder> =>
      driverService.acceptOrder(orderId),

    onSuccess: data => {
      // Seed the active-order cache so the next screen renders without a refetch.
      queryClient.setQueryData(driverOrdersKeys.active(), data);
      void queryClient.invalidateQueries({ queryKey: driverOrdersKeys.all });
    },

    onError: error => {
      Logger.error('[useAcceptOrder] Failed to accept order', undefined, error as Error);
    },
  });
}

/** Confirm collection at the store: driver_assigned → out_for_delivery. */
export function useMarkPickedUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string): Promise<DriverAvailableOrder> =>
      driverService.markPickedUp(orderId),

    onSuccess: data => {
      queryClient.setQueryData(driverOrdersKeys.active(), data);
      void queryClient.invalidateQueries({ queryKey: driverOrdersKeys.all });
    },

    onError: error => {
      Logger.error('[useMarkPickedUp] Failed to mark picked up', undefined, error as Error);
    },
  });
}

/** Complete the delivery: out_for_delivery → delivered. */
export function useMarkDelivered() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string): Promise<DriverAvailableOrder> =>
      driverService.markDelivered(orderId),

    onSuccess: () => {
      queryClient.setQueryData(driverOrdersKeys.active(), null);
      void queryClient.invalidateQueries({ queryKey: driverOrdersKeys.all });
    },

    onError: error => {
      Logger.error('[useMarkDelivered] Failed to mark delivered', undefined, error as Error);
    },
  });
}

/** Drop the order back into the pool. Allowed before and after pickup. */
export function useUnassignOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      reason,
    }: {
      orderId: string;
      reason?: string;
    }): Promise<DriverAvailableOrder> => driverService.unassignOrder(orderId, reason),

    onSuccess: () => {
      queryClient.setQueryData(driverOrdersKeys.active(), null);
      void queryClient.invalidateQueries({ queryKey: driverOrdersKeys.all });
    },

    onError: error => {
      Logger.error('[useUnassignOrder] Failed to unassign', undefined, error as Error);
    },
  });
}
