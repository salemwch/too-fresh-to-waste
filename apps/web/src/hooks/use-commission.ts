'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { adminKeys } from '@/hooks/use-admin';
import { adminService } from '@/services/admin.service';
import type { CommissionQuery } from '@/types/admin';

/**
 * Balances move only when an order completes, so a short window is wasted
 * requests. Long enough to survive tab-switching, short enough that an admin
 * watching a settlement land sees it without a manual refresh.
 */
const BALANCE_STALE_TIME = 60 * 1000;

/**
 * The reconciliation identity is the one number on this screen that must never
 * be stale — a drift means the ledger has lost money. Refetched more eagerly
 * than the rows it summarises.
 */
const SUMMARY_STALE_TIME = 30 * 1000;

/** Cities change when a merchant is onboarded. Effectively static per session. */
const CITIES_STALE_TIME = 10 * 60 * 1000;

export function useCommissionSummary() {
  return useQuery({
    queryKey: adminKeys.commissionSummary(),
    queryFn: () => adminService.getCommissionSummary().then(r => r.data.data),
    staleTime: SUMMARY_STALE_TIME,
  });
}

export function useCommissionMerchants(params: CommissionQuery) {
  return useQuery({
    queryKey: adminKeys.commissionMerchants(params),
    queryFn: async () => {
      const res = await adminService.getCommissionMerchants(params);
      return {
        rows: res.data.data,
        total: res.data.meta?.total ?? 0,
        totalPages: res.data.meta?.totalPages ?? 1,
      };
    },
    staleTime: BALANCE_STALE_TIME,
    /*
     * Keeps the previous page rendered while the next loads. Without it the
     * table collapses to skeletons on every filter keystroke, which reads as a
     * flicker rather than as progress.
     */
    placeholderData: keepPreviousData,
  });
}

export function useCommissionCities() {
  return useQuery({
    queryKey: adminKeys.commissionCities(),
    queryFn: () => adminService.getCommissionCities().then(r => r.data.data),
    staleTime: CITIES_STALE_TIME,
  });
}

export function useCommissionLedger(establishmentId: string | null, page = 1) {
  return useQuery({
    queryKey: adminKeys.commissionLedger(establishmentId ?? '', page),
    queryFn: async () => {
      const res = await adminService.getCommissionLedger(establishmentId as string, page);
      return {
        ...res.data.data,
        total: res.data.meta?.total ?? 0,
        totalPages: res.data.meta?.totalPages ?? 1,
      };
    },
    enabled: !!establishmentId,
    staleTime: BALANCE_STALE_TIME,
    placeholderData: keepPreviousData,
  });
}
