'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard.service';
import { useAuthStore } from '@/lib/auth';
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
  UpdateOfferPayload,
  EsgTierResponse,
  MonthlyGoalResponse,
  CarbonMetricsResponse,
  PricingSuggestions,
  SocialImpactResponse,
  LeaderboardEntry,
  MerchantRankResponse,
  StreakResponse,
  BusinessMetrics,
  BusinessMetricsRequest,
  CustomerLocationItem,
  MerchantWallet,
  MerchantCommissionStatement,
  TodaySales,
  FundLedgerResponse,
} from '@/types/dashboard';

// ─── Query keys (central, predictable) ─────────────────────────────────────
// startDate is serialised to ISO string so it becomes a stable cache key.

export const dashboardKeys = {
  all: ['merchant-dashboard'] as const,
  todaySales: (estId?: string) => [...dashboardKeys.all, 'today-sales', estId ?? 'all'] as const,
  orderStats: (startDate?: string, estId?: string) =>
    [...dashboardKeys.all, 'order-stats', startDate ?? 'all-time', estId ?? 'all'] as const,
  recentOrders: (page: number, limit: number) =>
    [...dashboardKeys.all, 'recent-orders', page, limit] as const,
  merchantOrders: (page = 1, limit = 50) =>
    [...dashboardKeys.all, 'merchant-orders', page, limit] as const,
  orderDetail: (id: string) => [...dashboardKeys.all, 'order', id] as const,
  offers: (page: number, limit: number, status?: string) =>
    [...dashboardKeys.all, 'offers', page, limit, status] as const,
  offersStatusCount: (status: string, estId?: string) =>
    [...dashboardKeys.all, 'offers-count', status, estId ?? 'all'] as const,
  activeOfferCount: (estId?: string) =>
    [...dashboardKeys.all, 'active-offer-count', estId ?? 'all'] as const,
  donationStats: () => [...dashboardKeys.all, 'donation-stats'] as const,
  monthlyBagGoal: () => [...dashboardKeys.all, 'community-goal'] as const,
  revenueChart: (granularity: ChartGranularity, value: number, estId?: string) =>
    [...dashboardKeys.all, 'revenue-chart', granularity, value, estId ?? 'all'] as const,
  myEstablishment: () => [...dashboardKeys.all, 'my-establishment'] as const,
  esgTier: (estId?: string) => [...dashboardKeys.all, 'esg-tier', estId ?? 'all'] as const,
  monthlyGoal: (estId?: string) => [...dashboardKeys.all, 'monthly-goal', estId ?? 'all'] as const,
  carbonMetrics: (since?: string, estId?: string) =>
    [...dashboardKeys.all, 'carbon-metrics', since ?? 'all', estId ?? 'all'] as const,
  socialImpact: (since?: string, estId?: string) =>
    [...dashboardKeys.all, 'social-impact', since ?? 'all', estId ?? 'all'] as const,
  leaderboard: (limit: number) => [...dashboardKeys.all, 'leaderboard', limit] as const,
  myRank: (estId?: string) => [...dashboardKeys.all, 'my-rank', estId ?? 'all'] as const,
  streak: () => [...dashboardKeys.all, 'streak'] as const,
  businessMetrics: (startDate: string, endDate: string, estId?: string) =>
    [...dashboardKeys.all, 'business-metrics', startDate, endDate, estId ?? 'all'] as const,
  customerLocations: (limit: number, estId?: string) =>
    [...dashboardKeys.all, 'customer-locations', limit, estId ?? 'all'] as const,
  pricingSuggestions: () => [...dashboardKeys.all, 'pricing-suggestions'] as const,
  myWallet: (estId?: string) => [...dashboardKeys.all, 'my-wallet', estId ?? 'all'] as const,
  fundLedger: (establishmentId?: string) =>
    [...dashboardKeys.all, 'fund-ledger', establishmentId ?? 'all'] as const,
  commissionStatement: (estId?: string) =>
    [...dashboardKeys.all, 'commission-statement', estId ?? 'all'] as const,
};

// ─── Result types ───────────────────────────────────────────────────────────

interface MerchantOrdersResult {
  orders: MerchantOrder[];
  meta: PaginationMeta | undefined;
}

interface MerchantOffersResult {
  offers: MerchantOffer[];
  meta: PaginationMeta | undefined;
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Order stats: totals, breakdown by status, revenue summary.
 * Scoped to the given startDate (undefined = all-time).
 * Backend: GET /orders/stats?startDate=
 */
/**
 * Today's sales, cash and online together. The wallet card shows only money
 * TFTW holds; this is the day as the merchant lived it. Refetched every minute
 * while the dashboard is open - a sale lands the moment a pickup is confirmed.
 */
export function useTodaySales() {
  const estId = useAuthStore(s => s.activeEstablishmentId) ?? undefined;
  return useQuery({
    queryKey: dashboardKeys.todaySales(estId),
    queryFn: async (): Promise<TodaySales> => {
      const response = await dashboardService.getTodaySales(estId);
      return response.data.data;
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useOrderStats(startDate?: Date) {
  const estId = useAuthStore(s => s.activeEstablishmentId);
  return useQuery({
    queryKey: dashboardKeys.orderStats(startDate?.toISOString(), estId ?? undefined),
    queryFn: async (): Promise<OrderStatsResponse> => {
      const response = await dashboardService.getOrderStats(startDate, estId ?? undefined);
      return response.data.data;
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
  const estId = useAuthStore(s => s.activeEstablishmentId);
  return useQuery({
    queryKey: dashboardKeys.revenueChart(granularity, value, estId ?? undefined),
    queryFn: async (): Promise<RevenueChartItem[]> => {
      const response = await dashboardService.getRevenueChart(
        granularity,
        value,
        estId ?? undefined,
      );
      return response.data.data;
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
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
 * All establishments owned by the authenticated merchant.
 * Backend: GET /establishments/my-establishment
 * Used by LocationSwitcher for multi-location orgs.
 */
export function useMyEstablishments() {
  return useQuery({
    queryKey: [...dashboardKeys.myEstablishment(), 'all'] as const,
    queryFn: async (): Promise<MyEstablishment[]> => {
      const response = await dashboardService.getMyEstablishment();
      const list = response.data.data;
      return Array.isArray(list) ? list : [];
    },
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Merchant offers with status filter — used by the Offers management page.
 * Backend: GET /offers/my-offers?page=&limit=&status=
 */
export function useMerchantOffersFiltered(page = 1, limit = 10, status?: string) {
  const activeEstablishmentId = useAuthStore(s => s.activeEstablishmentId);
  return useQuery({
    queryKey: [
      ...dashboardKeys.offers(page, limit, status),
      activeEstablishmentId ?? 'all',
    ] as const,
    queryFn: async (): Promise<MerchantOffersResult> => {
      const response = await dashboardService.getMerchantOffers(
        page,
        limit,
        status,
        activeEstablishmentId ?? undefined,
      );
      return {
        offers: response.data.data,
        meta: response.data.meta,
      };
    },
    staleTime: 60 * 1000,
    placeholderData: prev => prev,
  });
}

/**
 * Count of offers for a given status — lightweight (limit=1, reads meta.total).
 * Used by the stats bar on the Offers page.
 */
export function useOfferStatusCount(status: string, enabled = true) {
  const estId = useAuthStore(s => s.activeEstablishmentId);
  return useQuery({
    queryKey: dashboardKeys.offersStatusCount(status, estId ?? undefined),
    queryFn: async (): Promise<number> => {
      const response = await dashboardService.getMerchantOffers(1, 1, status, estId ?? undefined);
      return response.data.meta?.total ?? 0;
    },
    staleTime: 2 * 60 * 1000,
    enabled,
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
    mutationFn: ({
      payload,
      imageFile,
    }: {
      payload: CreateSurpriseBagPayload;
      imageFile?: File | null;
    }) => dashboardService.createSurpriseBag(payload, imageFile),
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

/**
 * Correct an offer that is still running.
 *
 * Shares invalidateOfferCaches with reactivate because an edit moves the same
 * things a reactivation does — price, quantity, pickup window — and the offer
 * appears in the list, the counts and the dashboard alike.
 */
export function useUpdateOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ offerId, payload }: { offerId: string; payload: UpdateOfferPayload }) =>
      dashboardService.updateOffer(offerId, payload),
    onSuccess: () => invalidateOfferCaches(queryClient),
  });
}

// ─── Orders page hooks ───────────────────────────────────────────────────────

/** All status values that belong to the "History" tab. */
/**
 * Terminal states — the Active tab is everything else.
 *
 * `delivered` belongs here for the same reason `picked_up` does: it is where a
 * delivery order finishes. Leaving it out kept completed deliveries in Active
 * forever, so a merchant's Active list only ever grew.
 *
 * `refunded` is deliberately absent, matching the behaviour before this note —
 * a refunded order is usually still being discussed, so it stays visible.
 */
export const HISTORY_STATUSES: OrderStatus[] = [
  'picked_up',
  'delivered',
  'completed',
  'cancelled',
  'expired',
];

/**
 * All merchant orders (up to 50) — used as the source for the orders page.
 * Client-side splits into Active vs History tabs.
 * Backend: GET /orders/merchant-orders?page=1&limit=50
 */
export function useMerchantOrders() {
  const activeEstablishmentId = useAuthStore(s => s.activeEstablishmentId);
  return useQuery({
    queryKey: [...dashboardKeys.merchantOrders(), activeEstablishmentId ?? 'all'] as const,
    queryFn: async (): Promise<MerchantOrdersResult> => {
      const response = await dashboardService.getMerchantOrders(
        1,
        50,
        activeEstablishmentId ?? undefined,
      );
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

// ─── Sustainability hooks ────────────────────────────────────────────────────

export function useEsgTier() {
  const estId = useAuthStore(s => s.activeEstablishmentId);
  return useQuery({
    queryKey: dashboardKeys.esgTier(estId ?? undefined),
    queryFn: async (): Promise<EsgTierResponse> => {
      const response = await dashboardService.getEsgTier(estId ?? undefined);
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useMonthlyGoal() {
  const estId = useAuthStore(s => s.activeEstablishmentId);
  return useQuery({
    queryKey: dashboardKeys.monthlyGoal(estId ?? undefined),
    queryFn: async (): Promise<MonthlyGoalResponse> => {
      const response = await dashboardService.getMonthlyGoal(estId ?? undefined);
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCarbonMetrics(since?: string) {
  const estId = useAuthStore(s => s.activeEstablishmentId);
  return useQuery({
    queryKey: dashboardKeys.carbonMetrics(since, estId ?? undefined),
    queryFn: async (): Promise<CarbonMetricsResponse> => {
      const response = await dashboardService.getCarbonMetrics(since, estId ?? undefined);
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSocialImpact(since?: string) {
  const estId = useAuthStore(s => s.activeEstablishmentId);
  return useQuery({
    queryKey: dashboardKeys.socialImpact(since, estId ?? undefined),
    queryFn: async (): Promise<SocialImpactResponse> => {
      const response = await dashboardService.getSocialImpact(since, estId ?? undefined);
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Charity donation contributions funded by this merchant's completed orders.
 * Backend: GET /sustainability/fund-ledger?establishmentId=
 */
export function useFundLedger() {
  const estId = useAuthStore(s => s.activeEstablishmentId);
  return useQuery({
    queryKey: dashboardKeys.fundLedger(estId ?? undefined),
    queryFn: async (): Promise<FundLedgerResponse> => {
      const response = await dashboardService.getFundLedger(estId ?? undefined);
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
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

export function useLeaderboard(limit = 50) {
  return useQuery({
    queryKey: dashboardKeys.leaderboard(limit),
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      const response = await dashboardService.getLeaderboard(limit);
      return response.data.data;
    },
    staleTime: 0, // always considered stale → refetch on every mount
    gcTime: 0, // purge cache immediately on unmount → next visit always fresh
  });
}

export function useMerchantRank() {
  const estId = useAuthStore(s => s.activeEstablishmentId);
  return useQuery({
    queryKey: dashboardKeys.myRank(estId ?? undefined),
    queryFn: async (): Promise<MerchantRankResponse> => {
      const response = await dashboardService.getMyRank(estId ?? undefined);
      return response.data.data;
    },
    staleTime: 0,
    gcTime: 0,
  });
}

export function useStreakData() {
  return useQuery({
    queryKey: dashboardKeys.streak(),
    queryFn: async (): Promise<StreakResponse> => {
      const response = await dashboardService.getStreakData();
      return response.data.data;
    },
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000, // re-check every 5 min so streakAtRisk flag updates
  });
}

export function useUpdateLeaderboardPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (anonymous: boolean) => dashboardService.updateLeaderboardPreference(anonymous),
    onMutate: async (anonymous: boolean) => {
      await queryClient.cancelQueries({ queryKey: dashboardKeys.leaderboard(50) });
      const prev = queryClient.getQueryData<LeaderboardEntry[]>(dashboardKeys.leaderboard(50));
      const currentUser = useAuthStore.getState().user;
      const prevAnonymous = currentUser?.leaderboardAnonymous;
      if (prev && currentUser) {
        queryClient.setQueryData<LeaderboardEntry[]>(
          dashboardKeys.leaderboard(50),
          prev.map(entry =>
            entry.userId === currentUser.userId
              ? {
                  ...entry,
                  isAnonymous: anonymous,
                  displayName: anonymous ? 'Anonymous' : entry.displayName,
                  profileImage: anonymous ? null : entry.profileImage,
                }
              : entry,
          ),
        );
      }
      // Optimistically close the first-visit dialog
      if (currentUser) {
        useAuthStore.getState().setUser({ ...currentUser, leaderboardAnonymous: anonymous });
      }
      return { prev, prevAnonymous };
    },
    onSuccess: (_data, anonymous) => {
      // Confirm the server-settled value in the auth store
      const current = useAuthStore.getState().user;
      if (current) {
        useAuthStore.getState().setUser({ ...current, leaderboardAnonymous: anonymous });
      }
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.myRank() });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.leaderboard(50) });
    },
    onError: (_err, _anonymous, context) => {
      // Roll back the optimistic cache update
      if (context?.prev !== undefined) {
        queryClient.setQueryData(dashboardKeys.leaderboard(50), context.prev);
      }
      // Roll back the auth store optimistic update
      const current = useAuthStore.getState().user;
      if (current) {
        useAuthStore.getState().setUser({
          ...current,
          ...(context?.prevAnonymous !== undefined
            ? { leaderboardAnonymous: context.prevAnonymous }
            : {}),
        });
      }
    },
  });
}

// ─── Analytics hooks ────────────────────────────────────────────────────────

export function useBusinessMetrics(startDate: string, endDate: string) {
  const estId = useAuthStore(s => s.activeEstablishmentId);
  return useQuery({
    queryKey: dashboardKeys.businessMetrics(startDate, endDate, estId ?? undefined),
    queryFn: async (): Promise<BusinessMetrics> => {
      const request: BusinessMetricsRequest = {
        filters: {
          dateRange: { startDate, endDate },
          granularity: { period: 'day' },
          ...(estId ? { establishmentIds: [estId] } : {}),
        },
        includeSustainability: true,
        options: { includeComparisons: true },
      };
      const response = await dashboardService.getBusinessMetrics(request);
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCustomerLocations(limit = 5) {
  const estId = useAuthStore(s => s.activeEstablishmentId);
  return useQuery({
    queryKey: dashboardKeys.customerLocations(limit, estId ?? undefined),
    queryFn: async (): Promise<CustomerLocationItem[]> => {
      const response = await dashboardService.getCustomerLocations(
        limit,
        undefined,
        estId ?? undefined,
      );
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function usePricingSuggestions() {
  return useQuery({
    queryKey: dashboardKeys.pricingSuggestions(),
    queryFn: async (): Promise<PricingSuggestions> => {
      const response = await dashboardService.getPricingSuggestions();
      return response.data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Merchant's wallet balance (available + pending payout).
 * Backend: GET /payments/my-wallet
 */
export function useMyWallet() {
  const estId = useAuthStore(s => s.activeEstablishmentId);
  return useQuery({
    queryKey: dashboardKeys.myWallet(estId ?? undefined),
    queryFn: async (): Promise<MerchantWallet> => {
      const response = await dashboardService.getMyWallet(estId ?? undefined);
      return response.data.data;
    },
    staleTime: 60 * 1000,
  });
}

/**
 * The merchant's commission statement for the current month.
 *
 * With no establishment selected ("All locations") it asks for the statement
 * across every establishment the merchant owns. It used to be disabled there,
 * because a summed balance hides which location carries it - but a disabled
 * query reads as "loading", so the card showed a skeleton forever. The backend
 * now returns the balance per establishment (`dueByEstablishment`) alongside
 * the total, which answers the original concern without hiding the card.
 */
export function useCommissionStatement() {
  const estId = useAuthStore(s => s.activeEstablishmentId) ?? undefined;

  return useQuery({
    queryKey: dashboardKeys.commissionStatement(estId),
    queryFn: async (): Promise<MerchantCommissionStatement> => {
      const response = await dashboardService.getMyCommission(estId);
      return response.data.data;
    },
    // Moves only when an order completes; a shorter window is wasted requests.
    staleTime: 60 * 1000,
  });
}
