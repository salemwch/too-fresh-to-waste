'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminService } from '@/services/admin.service';
import { adminKeys } from '@/hooks/use-admin';
import type { CreateDriverPayload, DriverOrdersQuery } from '@/types/admin';

/**
 * Fleet list. 30s rather than the 2min used elsewhere in the admin panel:
 * the row carries `isOnline` and a last-known position, and stale availability
 * is worse than a slightly chattier query.
 */
const FLEET_STALE_TIME = 30 * 1000;

/** Identity and lifetime totals move slowly — no reason to refetch on focus. */
const DETAIL_STALE_TIME = 60 * 1000;

export function useDrivers() {
  return useQuery({
    queryKey: adminKeys.drivers(),
    queryFn: () => adminService.getDrivers().then(r => r.data.data),
    staleTime: FLEET_STALE_TIME,
  });
}

/**
 * How often the dispatch map asks for new positions.
 *
 * Matched to the server's staleness threshold (5 min in
 * `DRIVER_POSITION_STALE_MS`) divided by ten, so a driver's fix is never shown
 * as fresh for long after it stops being so, without hammering the endpoint.
 */
const LIVE_FLEET_POLL_MS = 30 * 1000;

/**
 * Live positions for the dispatch map.
 *
 * Polls while the tab is visible and stops when it is not:
 * `refetchIntervalInBackground` defaults to false, so a forgotten tab does not
 * keep the endpoint warm all night. On return the stale data refetches
 * immediately.
 *
 * `enabled` lets the page stop polling entirely - the map is one tab among
 * several on the drivers screen, and a hidden map should cost nothing.
 */
export function useLiveFleet(enabled = true) {
  return useQuery({
    queryKey: adminKeys.liveFleet(),
    queryFn: () => adminService.getLiveFleet().then(r => r.data.data),
    // Anything older than one poll interval is worth replacing on this screen.
    staleTime: LIVE_FLEET_POLL_MS,
    refetchInterval: enabled ? LIVE_FLEET_POLL_MS : false,
    // Keeps the previous markers on screen through a refetch, so the map does
    // not blank out every thirty seconds.
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useDriverDetail(driverId: string | null) {
  return useQuery({
    queryKey: adminKeys.driverDetail(driverId ?? ''),
    queryFn: () => adminService.getDriverDetail(driverId as string).then(r => r.data.data),
    enabled: !!driverId,
    staleTime: DETAIL_STALE_TIME,
  });
}

export function useDriverOrders(driverId: string | null, params: DriverOrdersQuery = {}) {
  return useQuery({
    queryKey: adminKeys.driverOrders(driverId ?? '', params),
    queryFn: async () => {
      const res = await adminService.getDriverOrders(driverId as string, params);
      return { orders: res.data.data, total: res.data.meta?.total ?? 0 };
    },
    enabled: !!driverId,
    staleTime: DETAIL_STALE_TIME,
    // Keeps the table rendered while the next page loads instead of collapsing
    // it back to skeletons.
    placeholderData: keepPreviousData,
  });
}

export function useCreateDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDriverPayload) =>
      adminService.createDriver(payload).then(r => r.data.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.drivers() });
    },
  });
}
