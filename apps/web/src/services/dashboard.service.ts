import { apiClient } from '@/lib/api-client';
import type {
  BackendEnvelope,
  OrderStatsResponse,
  MerchantOrder,
  BusinessMetrics,
  BusinessMetricsRequest,
  QuickStatsResponse,
  MerchantOffer,
  RevenueChartItem,
  ChartGranularity,
  MyEstablishment,
  CreateSurpriseBagPayload,
  CreatedOfferResponse,
  ReactivateOfferPayload,
  DonationStats,
  CommunityBagGoalStats,
  EsgTierResponse,
  MonthlyGoalResponse,
  CarbonMetricsResponse,
  SocialImpactResponse,
  LeaderboardEntry,
  MerchantRankResponse,
  StreakResponse,
} from '@/types/dashboard';

const ORDERS_BASE = '/orders';
const OFFERS_BASE = '/offers';
const ANALYTICS_BASE = '/analytics';
const ESTABLISHMENTS_BASE = '/establishments';
const DONATIONS_BASE = '/donations';
const COMMUNITY_GOAL_BASE = '/community-goal';
const SUSTAINABILITY_BASE = '/sustainability';
const LEADERBOARD_BASE = '/leaderboard';

export const dashboardService = {
  /**
   * GET /orders/stats?startDate=
   * Merchant/Admin order statistics (totals, breakdown by status, revenue)
   * Pass startDate to restrict results to a specific time window.
   */
  getOrderStats(startDate?: Date) {
    return apiClient.get<BackendEnvelope<OrderStatsResponse>>(`${ORDERS_BASE}/stats`, {
      params: startDate ? { startDate: startDate.toISOString() } : undefined,
    });
  },

  /**
   * GET /orders/merchant-orders?page=&limit=
   * Paginated list of orders for the authenticated merchant
   */
  getMerchantOrders(page = 1, limit = 10, establishmentId?: string) {
    return apiClient.get<BackendEnvelope<MerchantOrder[]>>(`${ORDERS_BASE}/merchant-orders`, {
      params: {
        page,
        limit,
        ...(establishmentId && establishmentId !== 'all' ? { establishmentId } : {}),
      },
    });
  },

  /**
   * GET /orders/:id
   * Single order detail for merchant (includes pickupCode).
   */
  getOrderById(id: string) {
    return apiClient.get<BackendEnvelope<MerchantOrder>>(`${ORDERS_BASE}/${id}`);
  },

  /**
   * PATCH /orders/:id/cancel
   * Merchant cancels an active order with a reason.
   */
  cancelOrder(id: string, reason: string) {
    return apiClient.patch<BackendEnvelope<MerchantOrder>>(`${ORDERS_BASE}/${id}/cancel`, {
      reason,
    });
  },

  /**
   * GET /offers/my-offers?page=&limit=
   * Paginated list of offers owned by the authenticated merchant
   */
  getMerchantOffers(page = 1, limit = 10, status?: string, establishmentId?: string) {
    return apiClient.get<BackendEnvelope<MerchantOffer[]>>(`${OFFERS_BASE}/my-offers`, {
      params: {
        page,
        limit,
        ...(status ? { status } : {}),
        ...(establishmentId && establishmentId !== 'all' ? { establishmentId } : {}),
      },
    });
  },

  /**
   * POST /analytics/business-metrics
   * Comprehensive business KPIs (revenue, orders, sustainability)
   */
  getBusinessMetrics(request: BusinessMetricsRequest) {
    return apiClient.post<BackendEnvelope<BusinessMetrics>>(
      `${ANALYTICS_BASE}/business-metrics`,
      request,
    );
  },

  /**
   * GET /analytics/quick-stats?period=
   * Lightweight KPI snapshot for a given period
   */
  getQuickStats(period: 'today' | 'week' | 'month' | 'quarter' = 'month') {
    return apiClient.get<BackendEnvelope<QuickStatsResponse>>(`${ANALYTICS_BASE}/quick-stats`, {
      params: { period },
    });
  },

  /**
   * GET /orders/merchant-revenue-chart?granularity=&value=
   * Revenue breakdown per day / week / month for the merchant chart.
   */
  getRevenueChart(granularity: ChartGranularity, value: number) {
    return apiClient.get<BackendEnvelope<RevenueChartItem[]>>(
      `${ORDERS_BASE}/merchant-revenue-chart`,
      { params: { granularity, value } },
    );
  },

  /**
   * GET /establishments/my-establishment
   * Returns the list of establishments owned by the authenticated merchant.
   */
  getMyEstablishment() {
    return apiClient.get<BackendEnvelope<MyEstablishment[]>>(
      `${ESTABLISHMENTS_BASE}/my-establishment`,
    );
  },

  /**
   * POST /offers (multipart/form-data when image provided, JSON otherwise)
   * Sends offer data + image in a single request so the offer is created
   * with its image atomically — no second upload step needed.
   */
  createSurpriseBag(payload: CreateSurpriseBagPayload, imageFile?: File | null) {
    if (!imageFile) {
      return apiClient.post<BackendEnvelope<CreatedOfferResponse>>(`${OFFERS_BASE}`, payload);
    }

    const formData = new FormData();
    formData.append('images', imageFile, imageFile.name);
    for (const [key, value] of Object.entries(payload)) {
      if (key === 'pricing' && typeof value === 'object' && value !== null) {
        const pricing = value as Record<string, unknown>;
        for (const [pk, pv] of Object.entries(pricing)) {
          formData.append(`pricing[${pk}]`, String(pv));
        }
      } else if (key === 'pickupTimeSlots' && Array.isArray(value)) {
        value.forEach((slot: Record<string, string>, i: number) => {
          formData.append(`pickupTimeSlots[${i}][startTime]`, slot.startTime);
          formData.append(`pickupTimeSlots[${i}][endTime]`, slot.endTime);
        });
      } else if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    }

    return apiClient.post<BackendEnvelope<CreatedOfferResponse>>(`${OFFERS_BASE}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /**
   * PATCH /offers/:id  (multipart/form-data)
   * Upload a single image to an existing offer after creation.
   * The field name 'images' matches FilesInterceptor('images', 5) in the controller.
   */
  uploadOfferImage(offerId: string, imageFile: File) {
    const formData = new FormData();
    formData.append('images', imageFile, imageFile.name);
    return apiClient.patch<BackendEnvelope<unknown>>(`${OFFERS_BASE}/${offerId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /**
   * PATCH /offers/:id/status
   * Merchant can set: active | draft | cancelled
   * Admin can set all statuses including suspended.
   */
  updateOfferStatus(offerId: string, status: string) {
    return apiClient.patch<BackendEnvelope<{ id: string; status: string }>>(
      `${OFFERS_BASE}/${offerId}/status`,
      { status },
    );
  },

  /**
   * DELETE /offers/:id
   * Soft-delete — sets isDeleted=true, status=cancelled.
   * Fails if offer has active reservations (reservedQuantity > 0).
   */
  deleteOffer(offerId: string) {
    return apiClient.delete<BackendEnvelope<{ offerId: string }>>(`${OFFERS_BASE}/${offerId}`);
  },

  /**
   * PATCH /offers/:id/enable
   * Sets isActive = true (offer becomes visible to customers again).
   */
  enableOffer(offerId: string) {
    return apiClient.patch<BackendEnvelope<unknown>>(`${OFFERS_BASE}/${offerId}/enable`);
  },

  /**
   * PATCH /offers/:id/disable
   * Sets isActive = false (hides from listings without cancelling).
   * Fails if reservedQuantity > 0.
   */
  disableOffer(offerId: string) {
    return apiClient.patch<BackendEnvelope<unknown>>(`${OFFERS_BASE}/${offerId}/disable`);
  },

  /**
   * PATCH /offers/:id/reactivate
   * Reactivates an expired / cancelled offer with new availability window.
   */
  reactivateOffer(offerId: string, payload: ReactivateOfferPayload) {
    return apiClient.patch<BackendEnvelope<MerchantOffer>>(
      `${OFFERS_BASE}/${offerId}/reactivate`,
      payload,
    );
  },

  // ── Donation Pool ──────────────────────────────────────────────────────

  /**
   * GET /donations/stats
   * Public donation pool statistics (no auth required).
   */
  getDonationStats() {
    return apiClient.get<BackendEnvelope<DonationStats>>(`${DONATIONS_BASE}/stats`);
  },

  // ── Admin donation pool ───────────────────────────────────────────────
  getAdminDonationPool() {
    return apiClient.get<BackendEnvelope<DonationStats>>('/admin/donations/pool');
  },

  updateAdminDonationPool(payload: {
    targetAmount?: number;
    cause?: string;
    activeGoalCategory?: string;
    targetDate?: string | null;
    categoryPricing?: Array<{ category: string; itemPrice: number; targetCount: number }>;
  }) {
    return apiClient.patch<BackendEnvelope<DonationStats>>('/admin/donations/pool', payload);
  },

  resetAdminDonationPool() {
    return apiClient.post<BackendEnvelope<DonationStats>>('/admin/donations/pool/reset');
  },

  // ── Community Bag Goal ─────────────────────────────────────────────────

  /**
   * GET /community-goal/stats
   * Public community bag goal progress (no auth required).
   */
  getCommunityGoalStats() {
    return apiClient.get<BackendEnvelope<CommunityBagGoalStats>>(`${COMMUNITY_GOAL_BASE}/stats`);
  },

  // ── Sustainability ─────────────────────────────────────────────────────

  getEsgTier() {
    return apiClient.get<BackendEnvelope<EsgTierResponse>>(`${SUSTAINABILITY_BASE}/tier`);
  },

  getMonthlyGoal() {
    return apiClient.get<BackendEnvelope<MonthlyGoalResponse>>(
      `${SUSTAINABILITY_BASE}/monthly-goal`,
    );
  },

  updateMonthlyGoal(targetBagsPerMonth: number) {
    return apiClient.patch<BackendEnvelope<MonthlyGoalResponse>>(
      `${SUSTAINABILITY_BASE}/monthly-goal`,
      { targetBagsPerMonth },
    );
  },

  getCarbonMetrics(since?: string) {
    return apiClient.get<BackendEnvelope<CarbonMetricsResponse>>(
      `${SUSTAINABILITY_BASE}/carbon-metrics`,
      { params: since ? { since } : undefined },
    );
  },

  getSocialImpact(since?: string) {
    return apiClient.get<BackendEnvelope<SocialImpactResponse>>(
      `${SUSTAINABILITY_BASE}/social-impact`,
      { params: since ? { since } : undefined },
    );
  },

  downloadCarbonBalanceReport() {
    return apiClient.get(`${SUSTAINABILITY_BASE}/reports/carbon-balance`, {
      responseType: 'blob',
    });
  },

  // ── Leaderboard ────────────────────────────────────────────────────────────

  getLeaderboard(limit = 50) {
    return apiClient.get<BackendEnvelope<LeaderboardEntry[]>>(LEADERBOARD_BASE, {
      params: { limit },
    });
  },

  getMyRank() {
    return apiClient.get<BackendEnvelope<MerchantRankResponse>>(`${LEADERBOARD_BASE}/my-rank`);
  },

  updateLeaderboardPreference(anonymous: boolean) {
    return apiClient.patch<BackendEnvelope<{ message: string }>>(`${LEADERBOARD_BASE}/preference`, {
      anonymous,
    });
  },

  getStreakData() {
    return apiClient.get<BackendEnvelope<StreakResponse>>(`${SUSTAINABILITY_BASE}/streak`);
  },
};
