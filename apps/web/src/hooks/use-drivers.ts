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
