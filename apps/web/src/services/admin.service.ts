import { apiClient } from '@/lib/api-client';
import type { BackendEnvelope } from '@/types/dashboard';
import type {
  PlatformAnalytics,
  AuditLogResponse,
  RecentActivityResponse,
  AdminUser,
  AdminUserListResponse,
  UpdateUserStatusPayload,
  BulkUserActionPayload,
  UserSearchParams,
  UserOverview,
  UserActivityData,
  AdminEstablishment,
  AdminEstablishmentListResponse,
  AdminEstablishmentOverview,
  ApproveEstablishmentPayload,
  UpdateEstablishmentStatusPayload,
  ExtendTrialPayload,
  MarkAsPaidPayload,
  EstablishmentSearchParams,
  EstablishmentStats,
  EstablishmentAuditEntry,
  ModerationReport,
  ModerationDashboardStats,
  UpdateReportPayload,
  CreateModerationActionPayload,
  ReportSearchParams,
  SystemConfig,
  UpdateSystemConfigPayload,
  AuditLogSearchParams,
  AuditStats,
  AnalyticsPeriod,
  HealthCheckResult,
  LivenessResult,
  RealTimeMetrics,
  AdminOfferStats,
  AdminOfferItem,
  AdminOfferListResponse,
  AdminOfferQuery,
  AdminLowPickupItem,
  AdminPriceViolationItem,
  AdminDeletedOfferItem,
  BulkOfferActionPayload,
  BulkOfferActionResult,
  AdminOrderItem,
  AdminOrderDetail,
  AdminOrderStats,
  AdminOrderQuery,
  AdminCancelOrderPayload,
  AdminRefundOrderPayload,
  AdminPaymentStats,
  AdminPayoutSummary,
  AdminNotificationStats,
  AdminBroadcastPayload,
  AdminBroadcastResult,
  AdminLeaderboardStats,
  AdminLeaderboardEntry,
  AdminTopMerchant,
} from '@/types/admin';

const ADMIN = '/admin';
const MOD = '/moderation';

// ── Driver types ───────────────────────────────────────────────────────────────

export interface CreateDriverPayload {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  idCardNumber: string;
  address: string;
}

export interface DriverRow {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  requiresPasswordChange: boolean;
  createdAt: string;
  driverProfile: { idCardNumber: string; address: string } | null;
}

export interface CreateDriverResponse {
  driver: { _id: string; firstName: string; lastName: string; email: string };
  driverProfile: { idCardNumber: string; address: string };
  temporaryPassword: string;
}

// Health controller uses VERSION_NEUTRAL — it's at /health, NOT /api/v1/health.
// Use NEXT_PUBLIC_WS_URL (always the real backend origin) so this works in both
// direct mode and proxy mode (where NEXT_PUBLIC_API_URL is a relative path /api/v1).
const BACKEND_ROOT = process.env['NEXT_PUBLIC_WS_URL'] ?? 'http://localhost:3000';

export const adminService = {
  // ── Analytics ──────────────────────────────────────────────────────────────

  /**
   * GET /admin/analytics/platform?period=
   * Full platform KPIs: users, establishments, orders, offers, revenue, waste.
   */
  getPlatformAnalytics(period: AnalyticsPeriod = 'week') {
    return apiClient.get<BackendEnvelope<PlatformAnalytics>>(`${ADMIN}/analytics/platform`, {
      params: { period },
    });
  },

  /**
   * GET /admin/analytics/audit-stats?days=
   * Aggregated audit statistics: total actions, by type, by admin, daily trend.
   */
  getAuditStats(days = 30) {
    return apiClient.get<BackendEnvelope<AuditStats>>(`${ADMIN}/analytics/audit-stats`, {
      params: { days },
    });
  },

  /**
   * GET /admin/analytics/export/audit-logs?startDate=&endDate=&format=
   * Download audit logs as CSV or JSON.
   */
  exportAuditLogs(params: { startDate?: string; endDate?: string; format?: 'csv' | 'json' } = {}) {
    return apiClient.get<Blob>(`${ADMIN}/analytics/export/audit-logs`, {
      params,
      responseType: 'blob',
    });
  },

  /**
   * GET /admin/analytics/recent-activity?hours=&limit=
   * Recent admin actions for the activity feed.
   */
  getRecentActivity(hours = 24, limit = 20) {
    return apiClient.get<BackendEnvelope<RecentActivityResponse>>(
      `${ADMIN}/analytics/recent-activity`,
      { params: { hours, limit } },
    );
  },

  /**
   * GET /admin/analytics/audit-logs?page=&limit=&action=&targetType=...
   * Paginated admin audit log with optional filtering.
   */
  getAuditLogs(params: AuditLogSearchParams = {}) {
    return apiClient.get<BackendEnvelope<AuditLogResponse>>(`${ADMIN}/analytics/audit-logs`, {
      params,
    });
  },

  // ── User Management ────────────────────────────────────────────────────────

  /**
   * GET /admin/users/search?search=&role=&status=&page=&limit=
   * Searchable, filterable, paginated user list.
   */
  searchUsers(params: UserSearchParams = {}) {
    return apiClient.get<BackendEnvelope<AdminUserListResponse>>(`${ADMIN}/users/search`, {
      params: { limit: 20, ...params },
    });
  },

  /**
   * GET /admin/users/:userId
   * Full user detail by ID.
   */
  getUserById(userId: string) {
    return apiClient.get<BackendEnvelope<AdminUser>>(`${ADMIN}/users/${userId}`);
  },

  /**
   * PATCH /admin/users/:userId/status
   * Change user status (suspend, activate, block).
   */
  updateUserStatus(userId: string, payload: UpdateUserStatusPayload) {
    return apiClient.patch<BackendEnvelope<AdminUser>>(`${ADMIN}/users/${userId}/status`, payload);
  },

  /**
   * POST /admin/users/bulk-action
   * Apply status change to multiple users at once.
   */
  bulkUserAction(payload: BulkUserActionPayload) {
    return apiClient.post<BackendEnvelope<{ affected: number }>>(
      `${ADMIN}/users/bulk-action`,
      payload,
    );
  },

  /**
   * GET /admin/users/overview
   * Aggregate counts: total, active, suspended, pending, by role.
   */
  getUserOverview() {
    return apiClient.get<BackendEnvelope<UserOverview>>(`${ADMIN}/users/overview`);
  },

  /**
   * GET /admin/users/:userId/activity?days=
   * Full activity timeline for a single user.
   */
  getUserActivity(userId: string, days = 30) {
    return apiClient.get<BackendEnvelope<UserActivityData>>(`${ADMIN}/users/${userId}/activity`, {
      params: { days },
    });
  },

  /**
   * DELETE /admin/users/:userId?reason=&hard=
   * Soft-delete (default) or hard-delete a user.
   */
  deleteUser(userId: string, reason: string, hard = false) {
    return apiClient.delete<BackendEnvelope<{ success: boolean }>>(`${ADMIN}/users/${userId}`, {
      params: { reason, ...(hard ? { hard: true } : {}) },
    });
  },

  // ── Establishment Management ───────────────────────────────────────────────

  /**
   * GET /admin/establishments/overview
   * Overview counts: total, pending, active, suspended, rejected.
   */
  getEstablishmentOverview() {
    return apiClient.get<BackendEnvelope<AdminEstablishmentOverview>>(
      `${ADMIN}/establishments/overview`,
    );
  },

  /**
   * GET /admin/establishments/pending-approvals?limit=
   * Establishments awaiting approval (priority queue).
   */
  getPendingApprovals(limit = 50) {
    return apiClient.get<BackendEnvelope<AdminEstablishment[]>>(
      `${ADMIN}/establishments/pending-approvals`,
      { params: { limit } },
    );
  },

  /**
   * GET /admin/establishments/search?search=&status=&type=&page=&limit=
   * Searchable, filterable, paginated establishment list.
   */
  searchEstablishments(params: EstablishmentSearchParams = {}) {
    return apiClient.get<BackendEnvelope<AdminEstablishmentListResponse>>(
      `${ADMIN}/establishments/search`,
      { params: { limit: 20, ...params } },
    );
  },

  /**
   * GET /admin/establishments/:id
   * Full establishment detail by ID.
   */
  getEstablishmentById(id: string) {
    return apiClient.get<BackendEnvelope<AdminEstablishment>>(`${ADMIN}/establishments/${id}`);
  },

  /**
   * GET /admin/establishments/:id/stats?startDate=&endDate=&includeDetails=
   * Performance stats for a single establishment.
   */
  getEstablishmentStats(
    id: string,
    params: { startDate?: string; endDate?: string; includeDetails?: boolean } = {},
  ) {
    return apiClient.get<BackendEnvelope<EstablishmentStats>>(
      `${ADMIN}/establishments/${id}/stats`,
      { params },
    );
  },

  /**
   * GET /admin/establishments/:id/activity?days=
   * Audit log entries for a single establishment.
   */
  getEstablishmentActivity(id: string, days = 30) {
    return apiClient.get<BackendEnvelope<EstablishmentAuditEntry[]>>(
      `${ADMIN}/establishments/${id}/activity`,
      { params: { days } },
    );
  },

  /**
   * POST /admin/establishments/:id/verify-documents
   * Manually mark documents as verified.
   */
  verifyEstablishmentDocuments(id: string) {
    return apiClient.post<BackendEnvelope<AdminEstablishment>>(
      `${ADMIN}/establishments/${id}/verify-documents`,
    );
  },

  /**
   * POST /admin/establishments/:id/approve
   * Approve or reject an establishment application.
   */
  approveEstablishment(id: string, payload: ApproveEstablishmentPayload) {
    return apiClient.post<BackendEnvelope<AdminEstablishment>>(
      `${ADMIN}/establishments/${id}/approve`,
      payload,
    );
  },

  /**
   * PATCH /admin/establishments/:id/status
   * Update establishment status (suspend, reactivate, etc.).
   */
  updateEstablishmentStatus(id: string, payload: UpdateEstablishmentStatusPayload) {
    return apiClient.patch<BackendEnvelope<AdminEstablishment>>(
      `${ADMIN}/establishments/${id}/status`,
      payload,
    );
  },

  /**
   * PATCH /admin/establishments/:id/trial
   * Extend the free trial. Auto-reactivates suspended merchants.
   */
  extendEstablishmentTrial(id: string, payload: ExtendTrialPayload) {
    return apiClient.patch<BackendEnvelope<AdminEstablishment>>(
      `${ADMIN}/establishments/${id}/trial`,
      payload,
    );
  },

  /**
   * PATCH /admin/establishments/:id/subscription/mark-as-paid
   * Bypass the trial-expiry scan and mark the merchant as paid.
   */
  markEstablishmentAsPaid(id: string, payload: MarkAsPaidPayload) {
    return apiClient.patch<BackendEnvelope<AdminEstablishment>>(
      `${ADMIN}/establishments/${id}/subscription/mark-as-paid`,
      payload,
    );
  },

  // ── Moderation ─────────────────────────────────────────────────────────────

  /**
   * GET /moderation/reports/dashboard/stats
   * Counts by status and priority for the moderation overview cards.
   */
  getModerationStats() {
    return apiClient.get<BackendEnvelope<ModerationDashboardStats>>(
      `${MOD}/reports/dashboard/stats`,
    );
  },

  /**
   * GET /moderation/reports?type=&status=&priority=&page=&limit=
   * Paginated report queue. Note: pagination info returned in response.data.pagination
   * (not in meta — backend limitation tracked for future fix).
   */
  getReports(params: ReportSearchParams = {}) {
    return apiClient.get<BackendEnvelope<ModerationReport[]>>(`${MOD}/reports`, {
      params: { limit: 20, page: 1, ...params },
    });
  },

  /**
   * GET /moderation/reports/:id
   * Full report detail.
   */
  getReportById(id: string) {
    return apiClient.get<BackendEnvelope<ModerationReport>>(`${MOD}/reports/${id}`);
  },

  /**
   * PATCH /moderation/reports/:id
   * Update report status, priority, or resolution notes.
   */
  updateReport(id: string, payload: UpdateReportPayload) {
    return apiClient.patch<BackendEnvelope<ModerationReport>>(`${MOD}/reports/${id}`, payload);
  },

  /**
   * POST /moderation/reports/:id/assign
   * Assign report to a moderator.
   */
  assignReport(id: string, moderatorId: string) {
    return apiClient.post<BackendEnvelope<ModerationReport>>(`${MOD}/reports/${id}/assign`, {
      moderatorId,
    });
  },

  /**
   * POST /moderation/actions
   * Create a moderation action (warn, suspend, ban, etc.) against a user.
   */
  createModerationAction(payload: CreateModerationActionPayload) {
    return apiClient.post<BackendEnvelope<{ _id: string; actionType: string }>>(
      `${MOD}/actions`,
      payload,
    );
  },

  // ── System Config ──────────────────────────────────────────────────────────

  /**
   * GET /admin/config
   * Current active system configuration.
   */
  getSystemConfig() {
    return apiClient.get<BackendEnvelope<SystemConfig>>(`${ADMIN}/config`);
  },

  /**
   * PUT /admin/config
   * Update system config — creates a new version.
   */
  updateSystemConfig(payload: UpdateSystemConfigPayload) {
    return apiClient.put<BackendEnvelope<SystemConfig>>(`${ADMIN}/config`, payload);
  },

  /**
   * GET /admin/config/history?limit=
   * All previous config versions.
   */
  getConfigHistory(limit = 10) {
    return apiClient.get<BackendEnvelope<SystemConfig[]>>(`${ADMIN}/config/history`, {
      params: { limit },
    });
  },

  /**
   * POST /admin/config/rollback/:version
   * Rollback to a previous config version.
   */
  rollbackConfig(version: string) {
    return apiClient.post<BackendEnvelope<SystemConfig>>(`${ADMIN}/config/rollback/${version}`);
  },

  /**
   * GET /admin/config/export?version=
   * Download config as JSON blob.
   */
  exportConfig(version?: string) {
    return apiClient.get<Blob>(`${ADMIN}/config/export`, {
      params: version ? { version } : {},
      responseType: 'blob',
    });
  },

  /**
   * POST /admin/config/validate-import
   * Validate a config JSON without applying it.
   */
  validateConfigImport(data: Record<string, unknown>) {
    return apiClient.post<BackendEnvelope<{ valid: boolean; errors?: string[] }>>(
      `${ADMIN}/config/validate-import`,
      data,
    );
  },

  /**
   * POST /admin/config/import
   * Import and apply a config JSON.
   */
  importConfig(data: Record<string, unknown>) {
    return apiClient.post<BackendEnvelope<SystemConfig>>(`${ADMIN}/config/import`, data);
  },

  // ── Health ─────────────────────────────────────────────────────────────────

  /**
   * GET /health — Terminus full health check (DB, Redis, memory).
   * Uses absolute URL (VERSION_NEUTRAL — not under /api/v1).
   * validateStatus accepts 503: Terminus returns 503 when any check fails but the body
   * still contains the full health result; we extract it in useHealth().
   */
  getHealth() {
    // validateStatus: always resolve so 503 (degraded) doesn't throw.
    // Response is BackendEnvelope<HealthCheckResult> on 200, or the raw
    // GlobalExceptionFilter shape { statusCode, message: HealthCheckResult } on 503.
    // The hook (useHealth) handles both cases.
    return apiClient.get<BackendEnvelope<HealthCheckResult>>(`${BACKEND_ROOT}/health`, {
      validateStatus: () => true,
    });
  },

  /** GET /health/liveness — uptime, environment, timestamp. */
  getLiveness() {
    return apiClient.get<BackendEnvelope<LivenessResult>>(`${BACKEND_ROOT}/health/liveness`);
  },

  // ── Real-Time Analytics ────────────────────────────────────────────────────

  /**
   * GET /analytics/real-time
   * Live platform counters: active users, orders in last hour, revenue, etc.
   */
  getRealTimeMetrics() {
    return apiClient.get<BackendEnvelope<RealTimeMetrics>>('/analytics/real-time');
  },

  // ── Offer Management ───────────────────────────────────────────────────────

  /** GET /admin/offers/:id — single offer detail. */
  getOfferById(id: string) {
    return apiClient.get<BackendEnvelope<AdminOfferItem>>(`${ADMIN}/offers/${id}`);
  },

  /** GET /admin/offers/stats — platform-wide offer aggregates. */
  getOfferStats() {
    return apiClient.get<BackendEnvelope<AdminOfferStats>>(`${ADMIN}/offers/stats`);
  },

  /** GET /admin/offers — all offers with filters. */
  listAdminOffers(params: AdminOfferQuery = {}) {
    return apiClient.get<BackendEnvelope<AdminOfferListResponse>>(`${ADMIN}/offers`, { params });
  },

  /** GET /admin/offers/low-pickup-rate?threshold=&page=&limit= */
  getLowPickupOffers(threshold = 0.2, page = 1, limit = 20) {
    return apiClient.get<BackendEnvelope<{ data: AdminLowPickupItem[]; total: number }>>(
      `${ADMIN}/offers/low-pickup-rate`,
      { params: { threshold, page, limit } },
    );
  },

  /** GET /admin/offers/price-violations?minDiscount=&page=&limit= */
  getPriceViolations(minDiscount = 30, page = 1, limit = 20) {
    return apiClient.get<BackendEnvelope<{ data: AdminPriceViolationItem[]; total: number }>>(
      `${ADMIN}/offers/price-violations`,
      { params: { minDiscount, page, limit } },
    );
  },

  /** GET /admin/offers/deleted?page=&limit= */
  getDeletedOffers(page = 1, limit = 20) {
    return apiClient.get<BackendEnvelope<{ data: AdminDeletedOfferItem[]; total: number }>>(
      `${ADMIN}/offers/deleted`,
      { params: { page, limit } },
    );
  },

  /** POST /admin/offers/bulk-action */
  bulkOfferAction(payload: BulkOfferActionPayload) {
    return apiClient.post<BackendEnvelope<BulkOfferActionResult>>(
      `${ADMIN}/offers/bulk-action`,
      payload,
    );
  },

  /** POST /admin/offers/:id/restore */
  restoreOffer(id: string) {
    return apiClient.post<BackendEnvelope<AdminDeletedOfferItem>>(`${ADMIN}/offers/${id}/restore`);
  },

  /**
   * GET /admin/offers/export?format=csv|json
   * Download offers as CSV or JSON blob.
   */
  exportOffers(format: 'csv' | 'json' = 'csv') {
    return apiClient.get<Blob>(`${ADMIN}/offers/export`, {
      params: { format },
      responseType: 'blob',
    });
  },

  // ── Order Management ───────────────────────────────────────────────────────

  listOrders(params: AdminOrderQuery = {}) {
    return apiClient.get<BackendEnvelope<AdminOrderItem[]>>(`${ADMIN}/orders`, {
      params: { limit: 20, ...params },
    });
  },

  getOrderStats() {
    return apiClient.get<BackendEnvelope<AdminOrderStats>>(`${ADMIN}/orders/stats`);
  },

  getOrderDetail(orderId: string) {
    return apiClient.get<BackendEnvelope<AdminOrderDetail>>(`${ADMIN}/orders/${orderId}`);
  },

  cancelOrder(orderId: string, payload: AdminCancelOrderPayload) {
    return apiClient.post<BackendEnvelope<AdminOrderDetail>>(
      `${ADMIN}/orders/${orderId}/cancel`,
      payload,
    );
  },

  refundOrder(orderId: string, payload: AdminRefundOrderPayload) {
    return apiClient.post<BackendEnvelope<AdminOrderDetail>>(
      `${ADMIN}/orders/${orderId}/refund`,
      payload,
    );
  },

  // ── Payment Management ──────────────────────────────────────────────────────

  getPaymentStats() {
    return apiClient.get<BackendEnvelope<AdminPaymentStats>>(`${ADMIN}/payments/stats`);
  },

  getPayoutSummaries(page = 1, limit = 20) {
    return apiClient.get<BackendEnvelope<AdminPayoutSummary[]>>(`${ADMIN}/payments/payouts`, {
      params: { page, limit },
    });
  },

  getNotificationStats() {
    return apiClient.get<BackendEnvelope<AdminNotificationStats>>(`${ADMIN}/notifications/stats`);
  },

  sendBroadcast(payload: AdminBroadcastPayload) {
    return apiClient.post<BackendEnvelope<AdminBroadcastResult>>(
      `${ADMIN}/notifications/broadcast`,
      payload,
    );
  },

  // ── Leaderboard Management ─────────────────────────────────────────────────

  getLeaderboardStats() {
    return apiClient.get<BackendEnvelope<AdminLeaderboardStats>>(`${ADMIN}/leaderboards/stats`);
  },

  getTopUsers(page = 1, limit = 20) {
    return apiClient.get<BackendEnvelope<AdminLeaderboardEntry[]>>(
      `${ADMIN}/leaderboards/top-users`,
      {
        params: { page, limit },
      },
    );
  },

  getTopMerchants(limit = 3) {
    return apiClient.get<BackendEnvelope<AdminTopMerchant[]>>(
      `${ADMIN}/leaderboards/top-merchants`,
      { params: { limit } },
    );
  },

  //── Driver Management ──────────────────────────────────────────────────────

  /**
   * POST /admin/drivers
   * Create a driver account. Returns driver, driverProfile, and a one-time temporaryPassword.
   */
  createDriver(payload: CreateDriverPayload) {
    return apiClient.post<BackendEnvelope<CreateDriverResponse>>(`${ADMIN}/drivers`, payload);
  },

  /**
   * GET /admin/drivers
   * List all driver accounts with their driverProfile joined.
   */
  getDrivers() {
    return apiClient.get<BackendEnvelope<DriverRow[]>>(`${ADMIN}/drivers`);
  },
};
