'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard.service';
import type {
  OrderStatsResponse,
  MerchantOrder,
  OrderStatus,
  MerchantOffer,
  RevenueChartItem,
  PaginationMeta,
  ChartGranularity,
  MyEstablishment,
  CreateSurpriseBagPayload,
  ReactivateOfferPayload,
  DonationStats,
  CommunityBagGoalStats,
} from '@/types/dashboard';

// ─── Query keys (central, predictable) ─────────────────────────────────────
// startDate is serialised to ISO string so it becomes a stable cache key.

export const dashboardKeys = {
  all: ['merchant-dashboard'] as const,
  orderStats: (startDate?: string) =>
    [...dashboardKeys.all, 'order-stats', startDate ?? 'all-time'] as const,
  recentOrders: (page: number, limit: number) =>
    [...dashboardKeys.all, 'recent-orders', page, limit] as const,
  merchantOrders: (page = 1, limit = 50) =>
    [...dashboardKeys.all, 'merchant-orders', page, limit] as const,
  orderDetail: (id: string) =>
    [...dashboardKeys.all, 'order', id] as const,
  offers: (page: number, limit: number, status?: string) =>
    [...dashboardKeys.all, 'offers', page, limit, status] as const,
  offersStatusCount: (status: string) =>
    [...dashboardKeys.all, 'offers-count', status] as const,
  activeOfferCount: () => [...dashboardKeys.all, 'active-offer-count'] as const,
  donationStats: () => [...dashboardKeys.all, 'donation-stats'] as const,
  communityGoal: () => [...dashboardKeys.all, 'community-goal'] as const,
  revenueChart: (granularity: ChartGranularity, value: number) =>
    [...dashboardKeys.all, 'revenue-chart', granularity, value] as const,
  myEstablishment: () => [...dashboardKeys.all, 'my-establishment'] as const,
};

// ─── Result types ───────────────────────────────────────────────────────────

export interface MerchantOrdersResult {
  orders: MerchantOrder[];
  meta: PaginationMeta | undefined;
}

export interface MerchantOffersResult {
  offers: MerchantOffer[];
  meta: PaginationMeta | undefined;
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Order stats: totals, breakdown by status, revenue summary.
 * Scoped to the given startDate (undefined = all-time).
 * Backend: GET /orders/stats?startDate=
 */
export function useOrderStats(startDate?: Date) {
  return useQuery({
    queryKey: dashboardKeys.orderStats(startDate?.toISOString()),
    queryFn: async (): Promise<OrderStatsResponse> => {
      const response = await dashboardService.getOrderStats(startDate);
      return response.data.data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Recent merchant orders (paginated) — not date-scoped (always shows latest).
 * Backend: GET /orders/merchant-orders
 */
export function useMerchantRecentOrders(page = 1, limit = 6) {
  return useQuery({
    queryKey: dashboardKeys.recentOrders(page, limit),
    queryFn: async (): Promise<MerchantOrdersResult> => {
      const response = await dashboardService.getMerchantOrders(page, limit);
      return {
        orders: response.data.data,
        meta: response.data.meta,
      };
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Merchant's offers (paginated) — not date-scoped (shows active/all offers).
 * Backend: GET /offers/my-offers
 */
export function useMerchantOffers(page = 1, limit = 8) {
  return useQuery({
    queryKey: dashboardKeys.offers(page, limit),
    queryFn: async (): Promise<MerchantOffersResult> => {
      const response = await dashboardService.getMerchantOffers(page, limit);
      return {
        offers: response.data.data,
        meta: response.data.meta,
      };
    },
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Count of ACTIVE offers only — for the KPI stat card.
 * Backend: GET /offers/my-offers?status=active&limit=1
 */
export function useActiveOfferCount() {
  return useQuery({
    queryKey: dashboardKeys.activeOfferCount(),
    queryFn: async (): Promise<number> => {
      const response = await dashboardService.getMerchantOffers(1, 1, 'active');
      return response.data.meta?.total ?? 0;
    },
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Revenue chart data for day / week / month granularity.
 * `granularity` and `value` are derived from the selected DatePreset via PRESET_CONFIG.
 * Backend: GET /orders/merchant-revenue-chart?granularity=&value=
 */
export function useRevenueChart(granularity: ChartGranularity, value: number) {
  return useQuery({
    queryKey: dashboardKeys.revenueChart(granularity, value),
    queryFn: async (): Promise<RevenueChartItem[]> => {
      const response = await dashboardService.getRevenueChart(granularity, value);
      return response.data.data;
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000, // live chart — re-fetch every 30 s
  });
}

/**
 * The first establishment owned by the authenticated merchant.
 * Backend: GET /establishments/my-establishment
 * Stale for 10 min — establishments rarely change.
 */
export function useMyEstablishment() {
  return useQuery({
    queryKey: dashboardKeys.myEstablishment(),
    queryFn: async (): Promise<MyEstablishment | null> => {
      const response = await dashboardService.getMyEstablishment();
      const list = response.data.data;
      return Array.isArray(list) && list.length > 0 ? (list[0] ?? null) : null;
    },
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Community donation pool statistics (public endpoint).
 * Backend: GET /donations/stats
 */
export function useDonationStats() {
  return useQuery({
    queryKey: dashboardKeys.donationStats(),
    queryFn: async (): Promise<DonationStats> => {
      const response = await dashboardService.getDonationStats();
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Community bag goal progress (public endpoint).
 * Backend: GET /community-goal/stats
 */
export function useCommunityGoalStats() {
  return useQuery({
    queryKey: dashboardKeys.communityGoal(),
    queryFn: async (): Promise<CommunityBagGoalStats> => {
      const response = await dashboardService.getCommunityGoalStats();
      return response.data.data;
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Merchant offers with status filter — used by the Offers management page.
 * Backend: GET /offers/my-offers?page=&limit=&status=
 */
export function useMerchantOffersFiltered(page = 1, limit = 10, status?: string) {
  return useQuery({
    queryKey: dashboardKeys.offers(page, limit, status),
    queryFn: async (): Promise<MerchantOffersResult> => {
      const response = await dashboardService.getMerchantOffers(page, limit, status);
      return {
        offers: response.data.data,
        meta: response.data.meta,
      };
    },
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  });
}

/**
 * Count of offers for a given status — lightweight (limit=1, reads meta.total).
 * Used by the stats bar on the Offers page.
 */
export function useOfferStatusCount(status: string) {
  return useQuery({
    queryKey: dashboardKeys.offersStatusCount(status),
    queryFn: async (): Promise<number> => {
      const response = await dashboardService.getMerchantOffers(1, 1, status);
      return response.data.meta?.total ?? 0;
    },
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Create a new surprise bag offer.
 * On success, invalidates offers and active-offer-count caches.
 * Backend: POST /offers
 */
export function useCreateSurpriseBag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSurpriseBagPayload) =>
      dashboardService.createSurpriseBag(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

/** Invalidates all offer-related cache keys. */
function invalidateOfferCaches(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
}

/**
 * Update offer status: active | draft | cancelled | sold_out (merchant-allowed).
 * Backend: PATCH /offers/:id/status
 */
export function useUpdateOfferStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ offerId, status }: { offerId: string; status: string }) =>
      dashboardService.updateOfferStatus(offerId, status),
    onSuccess: () => invalidateOfferCaches(queryClient),
  });
}

/**
 * Soft-delete an offer.
 * Backend: DELETE /offers/:id
 */
export function useDeleteOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (offerId: string) => dashboardService.deleteOffer(offerId),
    onSuccess: () => invalidateOfferCaches(queryClient),
  });
}

/**
 * Reactivate an expired / cancelled offer with new availability window.
 * Backend: PATCH /offers/:id/reactivate
 */
export function useReactivateOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ offerId, payload }: { offerId: string; payload: ReactivateOfferPayload }) =>
      dashboardService.reactivateOffer(offerId, payload),
    onSuccess: () => invalidateOfferCaches(queryClient),
  });
}

// ─── Orders page hooks ───────────────────────────────────────────────────────

/** All status values that belong to the "History" tab. */
export const HISTORY_STATUSES: OrderStatus[] = ['picked_up', 'cancelled', 'expired'];

/**
 * All merchant orders (up to 50) — used as the source for the orders page.
 * Client-side splits into Active vs History tabs.
 * Backend: GET /orders/merchant-orders?page=1&limit=50
 */
export function useMerchantOrders() {
  return useQuery({
    queryKey: dashboardKeys.merchantOrders(),
    queryFn: async (): Promise<MerchantOrdersResult> => {
      const response = await dashboardService.getMerchantOrders(1, 50);
      return {
        orders: response.data.data,
        meta: response.data.meta,
      };
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // soft poll — WebSocket handles instant updates
  });
}

/**
 * Single order detail — used for the split-panel right side.
 * Backend: GET /orders/:id
 */
export function useOrderDetail(orderId: string | null) {
  return useQuery({
    queryKey: dashboardKeys.orderDetail(orderId ?? ''),
    queryFn: async (): Promise<MerchantOrder> => {
      const response = await dashboardService.getOrderById(orderId!);
      return response.data.data;
    },
    enabled: !!orderId,
    staleTime: 30 * 1000,
  });
}

/**
 * Cancel an active order.
 * Backend: PATCH /orders/:id/cancel
 */
export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      dashboardService.cancelOrder(orderId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.merchantOrders() });
    },
  });
}
