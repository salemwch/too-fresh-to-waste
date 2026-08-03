'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '@/services/admin.service';
import { dashboardService } from '@/services/dashboard.service';
import type { DonationStats, MonthlyBagGoalStats } from '@/types/dashboard';
import type {
  AnalyticsPeriod,
  UserSearchParams,
  EstablishmentSearchParams,
  ReportSearchParams,
  UpdateUserStatusPayload,
  ApproveEstablishmentPayload,
  UpdateEstablishmentStatusPayload,
  ExtendTrialPayload,
  MarkAsPaidPayload,
  UpdateReportPayload,
  CreateModerationActionPayload,
  UpdateSystemConfigPayload,
  AuditLogSearchParams,
  AdminOfferQuery,
  BulkOfferActionPayload,
  HealthCheckResult,
  AdminOrderQuery,
  AdminCancelOrderPayload,
  AdminRefundOrderPayload,
  TeamSearchParams,
  InviteTeamMemberPayload,
  UpdateTeamMemberRolePayload,
  UpdateTeamMemberPermissionsPayload,
  TicketSearchParams,
  UpdateTicketStatusPayload,
  AssignTicketPayload,
  UpdateTicketPriorityPayload,
  ReplyToTicketPayload,
  AnnouncementSearchParams,
  CreateAnnouncementPayload,
  UpdateAnnouncementPayload,
  GeozoneSearchParams,
  CreateGeozonePayload,
  UpdateGeozonePayload,
  SecurityStatsQuery,
  OrganizationQuery,
  OrganizationStatus,
  AddLoyaltyPointsPayload,
  DriverOrdersQuery,
} from '@/types/admin';

// ─── Query key factory ────────────────────────────────────────────────────────

export const adminKeys = {
  all: ['admin'] as const,

  // Analytics
  platformAnalytics: (period: AnalyticsPeriod) =>
    [...adminKeys.all, 'platform-analytics', period] as const,
  recentActivity: (hours: number) => [...adminKeys.all, 'recent-activity', hours] as const,
  auditLogs: (params: AuditLogSearchParams) => [...adminKeys.all, 'audit-logs', params] as const,

  // Users
  userOverview: () => [...adminKeys.all, 'user-overview'] as const,
  userSearch: (params: UserSearchParams) => [...adminKeys.all, 'user-search', params] as const,
  userDetail: (userId: string) => [...adminKeys.all, 'user', userId] as const,
  userActivity: (userId: string, days: number) =>
    [...adminKeys.all, 'user-activity', userId, days] as const,

  // Establishments
  establishmentActivity: (id: string, days: number) =>
    [...adminKeys.all, 'establishment-activity', id, days] as const,
  establishmentOverview: () => [...adminKeys.all, 'establishment-overview'] as const,
  pendingApprovals: () => [...adminKeys.all, 'pending-approvals'] as const,
  establishmentSearch: (params: EstablishmentSearchParams) =>
    [...adminKeys.all, 'establishment-search', params] as const,
  establishmentDetail: (id: string) => [...adminKeys.all, 'establishment', id] as const,

  // Moderation
  moderationStats: () => [...adminKeys.all, 'moderation-stats'] as const,
  reports: (params: ReportSearchParams) => [...adminKeys.all, 'reports', params] as const,
  reportDetail: (id: string) => [...adminKeys.all, 'report', id] as const,

  // Config
  systemConfig: () => [...adminKeys.all, 'system-config'] as const,
  configHistory: () => [...adminKeys.all, 'config-history'] as const,

  // Health
  health: () => [...adminKeys.all, 'health'] as const,
  liveness: () => [...adminKeys.all, 'liveness'] as const,

  // Real-time
  realTime: () => [...adminKeys.all, 'real-time'] as const,

  // Orders
  orderStats: () => [...adminKeys.all, 'order-stats'] as const,
  orderList: (params: AdminOrderQuery) => [...adminKeys.all, 'order-list', params] as const,
  orderDetail: (id: string) => [...adminKeys.all, 'order-detail', id] as const,

  // Payments
  paymentStats: () => [...adminKeys.all, 'payment-stats'] as const,
  payoutList: (page: number) => [...adminKeys.all, 'payout-list', page] as const,

  // Notifications
  notificationStats: () => [...adminKeys.all, 'notification-stats'] as const,

  // Leaderboards
  leaderboardStats: () => [...adminKeys.all, 'leaderboard-stats'] as const,
  topUsers: (page: number) => [...adminKeys.all, 'top-users', page] as const,
  topMerchants: () => [...adminKeys.all, 'top-merchants'] as const,

  // Team
  teamMembers: (params: TeamSearchParams) => [...adminKeys.all, 'team-members', params] as const,
  teamMember: (id: string) => [...adminKeys.all, 'team-member', id] as const,
  teamPermissions: () => [...adminKeys.all, 'team-permissions'] as const,

  // Support Tickets
  tickets: (params: TicketSearchParams) => [...adminKeys.all, 'tickets', params] as const,
  ticketStats: () => [...adminKeys.all, 'ticket-stats'] as const,
  ticketDetail: (id: string) => [...adminKeys.all, 'ticket', id] as const,

  // Announcements
  announcements: (params: AnnouncementSearchParams) =>
    [...adminKeys.all, 'announcements', params] as const,
  announcementDetail: (id: string) => [...adminKeys.all, 'announcement', id] as const,

  // Geozones
  geozones: (params: GeozoneSearchParams) => [...adminKeys.all, 'geozones', params] as const,
  geozoneStats: () => [...adminKeys.all, 'geozone-stats'] as const,
  geozoneDetail: (id: string) => [...adminKeys.all, 'geozone', id] as const,

  // Offers
  offerStats: () => [...adminKeys.all, 'offer-stats'] as const,
  offerList: (params: AdminOfferQuery) => [...adminKeys.all, 'offer-list', params] as const,
  lowPickupOffers: (threshold: number, page: number) =>
    [...adminKeys.all, 'low-pickup', threshold, page] as const,
  priceViolations: (minDiscount: number, page: number) =>
    [...adminKeys.all, 'price-violations', minDiscount, page] as const,
  deletedOffers: (page: number) => [...adminKeys.all, 'deleted-offers', page] as const,

  // Security
  securityStats: (params: SecurityStatsQuery) =>
    [...adminKeys.all, 'security-stats', params] as const,
  lockedAccounts: (page: number) => [...adminKeys.all, 'locked-accounts', page] as const,

  // Organizations
  organizations: (params: OrganizationQuery) =>
    [...adminKeys.all, 'organizations', params] as const,
  organizationDetail: (id: string) => [...adminKeys.all, 'organization', id] as const,

  // Offer ops
  expiringOffers: (hours: number) => [...adminKeys.all, 'expiring-offers', hours] as const,

  // Order ops
  pendingOrders: (page: number) => [...adminKeys.all, 'pending-orders', page] as const,

  // Drivers
  drivers: () => [...adminKeys.all, 'drivers'] as const,
  driverDetail: (id: string) => [...adminKeys.all, 'driver', id] as const,
  driverOrders: (id: string, params: DriverOrdersQuery) =>
    [...adminKeys.all, 'driver-orders', id, params] as const,
};

// ─── Analytics hooks ──────────────────────────────────────────────────────────

export function usePlatformAnalytics(period: AnalyticsPeriod = 'week') {
  return useQuery({
    queryKey: adminKeys.platformAnalytics(period),
    queryFn: () => adminService.getPlatformAnalytics(period).then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecentActivity(hours = 24, limit = 20) {
  return useQuery({
    queryKey: adminKeys.recentActivity(hours),
    queryFn: () => adminService.getRecentActivity(hours, limit).then(r => r.data.data),
    staleTime: 2 * 60 * 1000,
  });
}

// ─── User hooks ───────────────────────────────────────────────────────────────

export function useUserSearch(params: UserSearchParams) {
  return useQuery({
    queryKey: adminKeys.userSearch(params),
    queryFn: () => adminService.searchUsers(params).then(r => r.data.data),
    staleTime: 60 * 1000,
    placeholderData: prev => prev,
  });
}

export function useUserDetail(userId: string | null) {
  return useQuery({
    queryKey: adminKeys.userDetail(userId ?? ''),
    queryFn: () => adminService.getUserById(userId!).then(r => r.data.data),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useUpdateUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdateUserStatusPayload }) =>
      adminService.updateUserStatus(userId, payload).then(r => r.data.data),
    onSuccess: (_, { userId }) => {
      void qc.invalidateQueries({ queryKey: adminKeys.userDetail(userId) });
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'user-search'] });
      void qc.invalidateQueries({ queryKey: adminKeys.platformAnalytics('week') });
    },
  });
}

export function useUserOverview() {
  return useQuery({
    queryKey: adminKeys.userOverview(),
    queryFn: () => adminService.getUserOverview().then(r => r.data.data),
    staleTime: 2 * 60 * 1000,
  });
}

export function useUserActivity(userId: string | null, days = 30) {
  return useQuery({
    queryKey: adminKeys.userActivity(userId ?? '', days),
    queryFn: () => adminService.getUserActivity(userId!, days).then(r => r.data.data),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason, hard }: { userId: string; reason: string; hard?: boolean }) =>
      adminService.deleteUser(userId, reason, hard).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'user-search'] });
      void qc.invalidateQueries({ queryKey: adminKeys.userOverview() });
      void qc.invalidateQueries({ queryKey: adminKeys.platformAnalytics('week') });
    },
  });
}

// ─── Establishment hooks ──────────────────────────────────────────────────────

export function useEstablishmentOverview() {
  return useQuery({
    queryKey: adminKeys.establishmentOverview(),
    queryFn: () => adminService.getEstablishmentOverview().then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePendingApprovals(limit = 50) {
  return useQuery({
    queryKey: adminKeys.pendingApprovals(),
    queryFn: () => adminService.getPendingApprovals(limit).then(r => r.data.data),
    staleTime: 2 * 60 * 1000,
  });
}

export function useEstablishmentSearch(params: EstablishmentSearchParams) {
  return useQuery({
    queryKey: adminKeys.establishmentSearch(params),
    queryFn: () => adminService.searchEstablishments(params).then(r => r.data.data),
    staleTime: 60 * 1000,
    placeholderData: prev => prev,
  });
}

export function useEstablishmentDetail(id: string | null) {
  return useQuery({
    queryKey: adminKeys.establishmentDetail(id ?? ''),
    queryFn: () => adminService.getEstablishmentById(id!).then(r => r.data.data),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}

export function useApproveEstablishment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ApproveEstablishmentPayload }) =>
      adminService.approveEstablishment(id, payload).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.pendingApprovals() });
      void qc.invalidateQueries({ queryKey: adminKeys.establishmentOverview() });
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'establishment-search'] });
      void qc.invalidateQueries({ queryKey: adminKeys.platformAnalytics('week') });
    },
  });
}

export function useUpdateEstablishmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateEstablishmentStatusPayload }) =>
      adminService.updateEstablishmentStatus(id, payload).then(r => r.data.data),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: adminKeys.establishmentDetail(id) });
      void qc.invalidateQueries({ queryKey: adminKeys.establishmentOverview() });
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'establishment-search'] });
    },
  });
}

export function useExtendEstablishmentTrial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ExtendTrialPayload }) =>
      adminService.extendEstablishmentTrial(id, payload).then(r => r.data.data),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: adminKeys.establishmentDetail(id) });
      void qc.invalidateQueries({ queryKey: adminKeys.establishmentOverview() });
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'establishment-search'] });
    },
  });
}

export function useMarkEstablishmentAsPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: MarkAsPaidPayload }) =>
      adminService.markEstablishmentAsPaid(id, payload).then(r => r.data.data),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: adminKeys.establishmentDetail(id) });
      void qc.invalidateQueries({ queryKey: adminKeys.establishmentOverview() });
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'establishment-search'] });
    },
  });
}

// ─── Moderation hooks ─────────────────────────────────────────────────────────

export function useModerationStats() {
  return useQuery({
    queryKey: adminKeys.moderationStats(),
    queryFn: () => adminService.getModerationStats().then(r => r.data.data),
    staleTime: 2 * 60 * 1000,
  });
}

export function useReports(params: ReportSearchParams) {
  return useQuery({
    queryKey: adminKeys.reports(params),
    queryFn: () => adminService.getReports(params).then(r => r.data.data),
    staleTime: 60 * 1000,
    placeholderData: prev => prev,
  });
}

export function useReportDetail(id: string | null) {
  return useQuery({
    queryKey: adminKeys.reportDetail(id ?? ''),
    queryFn: () => adminService.getReportById(id!).then(r => r.data.data),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}

export function useUpdateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateReportPayload }) =>
      adminService.updateReport(id, payload).then(r => r.data.data),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: adminKeys.reportDetail(id) });
      void qc.invalidateQueries({ queryKey: adminKeys.moderationStats() });
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'reports'] });
    },
  });
}

export function useCreateModerationAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateModerationActionPayload) =>
      adminService.createModerationAction(payload).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.moderationStats() });
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'reports'] });
    },
  });
}

// ─── System config hooks ──────────────────────────────────────────────────────

export function useSystemConfig() {
  return useQuery({
    queryKey: adminKeys.systemConfig(),
    queryFn: () => adminService.getSystemConfig().then(r => r.data.data),
    staleTime: 10 * 60 * 1000,
  });
}

export function useConfigHistory() {
  return useQuery({
    queryKey: adminKeys.configHistory(),
    queryFn: () => adminService.getConfigHistory().then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateSystemConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateSystemConfigPayload) =>
      adminService.updateSystemConfig(payload).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.systemConfig() });
      void qc.invalidateQueries({ queryKey: adminKeys.configHistory() });
    },
  });
}

export function useRollbackConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (version: string) => adminService.rollbackConfig(version).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.systemConfig() });
      void qc.invalidateQueries({ queryKey: adminKeys.configHistory() });
    },
  });
}

// ─── Health hooks ─────────────────────────────────────────────────────────────

export function useHealth(refetchInterval?: number) {
  return useQuery({
    queryKey: adminKeys.health(),
    queryFn: async (): Promise<HealthCheckResult> => {
      const r = await adminService.getHealth();

      if (r.status === 200) {
        // TransformInterceptor envelope: { status, data: HealthCheckResult, timestamp }
        return r.data.data;
      }

      // 503: GlobalExceptionFilter places the Terminus result in `message`.
      // The type is BackendEnvelope<HealthCheckResult> but message holds the raw health object.
      const msg = (r.data as unknown as Record<string, unknown>)['message'];
      if (msg && typeof msg === 'object' && 'status' in (msg as object)) {
        return msg as HealthCheckResult;
      }

      return { status: 'error', info: {}, error: {}, details: {} } as unknown as HealthCheckResult;
    },
    staleTime: 15 * 1000,
    refetchInterval: refetchInterval ?? 30 * 1000,
    retry: 0,
  });
}

export function useLiveness() {
  return useQuery({
    queryKey: adminKeys.liveness(),
    queryFn: () =>
      // TransformInterceptor envelope: { status, data: LivenessResult, timestamp }
      adminService.getLiveness().then(r => r.data.data),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    retry: 1,
  });
}

// ─── Real-time hooks ──────────────────────────────────────────────────────────

export function useRealTimeMetrics() {
  return useQuery({
    queryKey: adminKeys.realTime(),
    queryFn: () => adminService.getRealTimeMetrics().then(r => r.data.data),
    staleTime: 0,
    refetchInterval: 60 * 1000,
    retry: 1,
  });
}

// ─── Offer management hooks ───────────────────────────────────────────────────

export function useOfferStats() {
  return useQuery({
    queryKey: adminKeys.offerStats(),
    queryFn: () => adminService.getOfferStats().then(r => r.data.data),
    staleTime: 2 * 60 * 1000,
  });
}

export function useAdminOffers(params: AdminOfferQuery) {
  return useQuery({
    queryKey: adminKeys.offerList(params),
    queryFn: () =>
      adminService.listAdminOffers(params).then(r => ({
        data: r.data.data,
        meta: r.data.meta,
      })),
    staleTime: 60 * 1000,
    placeholderData: prev => prev,
  });
}

export function useLowPickupOffers(threshold = 0.2, page = 1) {
  return useQuery({
    queryKey: adminKeys.lowPickupOffers(threshold, page),
    queryFn: () => adminService.getLowPickupOffers(threshold, page).then(r => r.data.data),
    staleTime: 2 * 60 * 1000,
    placeholderData: prev => prev,
  });
}

export function usePriceViolations(minDiscount = 30, page = 1) {
  return useQuery({
    queryKey: adminKeys.priceViolations(minDiscount, page),
    queryFn: () => adminService.getPriceViolations(minDiscount, page).then(r => r.data.data),
    staleTime: 2 * 60 * 1000,
    placeholderData: prev => prev,
  });
}

export function useDeletedOffers(page = 1) {
  return useQuery({
    queryKey: adminKeys.deletedOffers(page),
    queryFn: () => adminService.getDeletedOffers(page).then(r => r.data.data),
    staleTime: 60 * 1000,
    placeholderData: prev => prev,
  });
}

export function useBulkOfferAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BulkOfferActionPayload) =>
      adminService.bulkOfferAction(payload).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'offer-list'] });
      void qc.invalidateQueries({ queryKey: adminKeys.offerStats() });
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'low-pickup'] });
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'deleted-offers'] });
    },
  });
}

export function useRestoreOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.restoreOffer(id).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'deleted-offers'] });
      void qc.invalidateQueries({ queryKey: adminKeys.offerStats() });
    },
  });
}

export function useOfferDetail(id: string | null) {
  return useQuery({
    queryKey: [...adminKeys.all, 'offer-detail', id ?? ''],
    queryFn: () => adminService.getOfferById(id!).then(r => r.data.data),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}

// ─── Establishment stats & actions ───────────────────────────────────────────

export function useEstablishmentStats(
  id: string | null,
  params: { startDate?: string; endDate?: string; includeDetails?: boolean } = {},
) {
  return useQuery({
    queryKey: [...adminKeys.all, 'establishment-stats', id ?? '', params],
    queryFn: () => adminService.getEstablishmentStats(id!, params).then(r => r.data.data),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useVerifyEstablishmentDocuments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminService.verifyEstablishmentDocuments(id).then(r => r.data.data),
    onSuccess: (_, id) => {
      void qc.invalidateQueries({ queryKey: adminKeys.establishmentDetail(id) });
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'establishment-search'] });
    },
  });
}

export function useEstablishmentActivity(id: string | null, days = 30) {
  return useQuery({
    queryKey: adminKeys.establishmentActivity(id ?? '', days),
    queryFn: () => adminService.getEstablishmentActivity(id!, days).then(r => r.data.data),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}

// ─── Order management hooks ──────────────────────────────────────────────────

export function useAdminOrderStats() {
  return useQuery({
    queryKey: adminKeys.orderStats(),
    queryFn: () => adminService.getOrderStats().then(r => r.data.data),
    staleTime: 2 * 60 * 1000,
  });
}

export function useAdminOrders(params: AdminOrderQuery) {
  return useQuery({
    queryKey: adminKeys.orderList(params),
    queryFn: () =>
      adminService.listOrders(params).then(r => ({
        data: r.data.data,
        meta: r.data.meta,
      })),
    staleTime: 60 * 1000,
    placeholderData: prev => prev,
  });
}

export function useAdminOrderDetail(id: string | null) {
  return useQuery({
    queryKey: adminKeys.orderDetail(id ?? ''),
    queryFn: () => adminService.getOrderDetail(id!).then(r => r.data.data),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}

export function useAdminCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, payload }: { orderId: string; payload: AdminCancelOrderPayload }) =>
      adminService.cancelOrder(orderId, payload).then(r => r.data.data),
    onSuccess: (_, { orderId }) => {
      void qc.invalidateQueries({ queryKey: adminKeys.orderDetail(orderId) });
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'order-list'] });
      void qc.invalidateQueries({ queryKey: adminKeys.orderStats() });
    },
  });
}

export function useAdminRefundOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, payload }: { orderId: string; payload: AdminRefundOrderPayload }) =>
      adminService.refundOrder(orderId, payload).then(r => r.data.data),
    onSuccess: (_, { orderId }) => {
      void qc.invalidateQueries({ queryKey: adminKeys.orderDetail(orderId) });
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'order-list'] });
      void qc.invalidateQueries({ queryKey: adminKeys.orderStats() });
    },
  });
}

// ─── Audit stats & export ────────────────────────────────────────────────────

export function useAuditLogs(params: AuditLogSearchParams) {
  return useQuery({
    queryKey: adminKeys.auditLogs(params),
    queryFn: () => adminService.getAuditLogs(params).then(r => r.data.data),
    staleTime: 60 * 1000,
    placeholderData: prev => prev,
  });
}

export function useAuditStats(days = 30) {
  return useQuery({
    queryKey: [...adminKeys.all, 'audit-stats', days],
    queryFn: () => adminService.getAuditStats(days).then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Config import/export ────────────────────────────────────────────────────

export function useImportConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      adminService.importConfig(data).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.systemConfig() });
      void qc.invalidateQueries({ queryKey: adminKeys.configHistory() });
    },
  });
}

export function useValidateConfigImport() {
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      adminService.validateConfigImport(data).then(r => r.data.data),
  });
}

// ─── Report assignment ───────────────────────────────────────────────────────

export function useAssignReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, moderatorId }: { id: string; moderatorId: string }) =>
      adminService.assignReport(id, moderatorId).then(r => r.data.data),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: adminKeys.reportDetail(id) });
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'reports'] });
    },
  });
}

// ─── Donation Pool ────────────────────────────────────────────────────────────

const DONATION_POOL_KEY = ['admin', 'donation-pool'] as const;

export function useAdminDonationPool() {
  return useQuery({
    queryKey: DONATION_POOL_KEY,
    queryFn: async (): Promise<DonationStats> => {
      const res = await dashboardService.getAdminDonationPool();
      return res.data.data;
    },
    staleTime: 30 * 1000,
  });
}

export function useUpdateDonationPool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      targetAmount?: number;
      cause?: string;
      activeGoalCategory?: string;
      targetDate?: string | null;
      categoryPricing?: Array<{ category: string; itemPrice: number; targetCount: number }>;
    }) => dashboardService.updateAdminDonationPool(payload).then(r => r.data.data),
    onSuccess: data => {
      qc.setQueryData<DonationStats>(DONATION_POOL_KEY, data);
    },
  });
}

export function useResetDonationPool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => dashboardService.resetAdminDonationPool().then(r => r.data.data),
    onSuccess: data => {
      qc.setQueryData<DonationStats>(DONATION_POOL_KEY, data);
    },
  });
}

export function useStartDonationSeason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => dashboardService.startAdminDonationSeason().then(r => r.data.data),
    onSuccess: data => {
      qc.setQueryData<DonationStats>(DONATION_POOL_KEY, data);
      void qc.invalidateQueries({ queryKey: DONATION_HISTORY_KEY });
    },
  });
}

const DONATION_HISTORY_KEY = ['admin', 'donation-history'] as const;

export function useAdminDonationHistory() {
  return useQuery({
    queryKey: DONATION_HISTORY_KEY,
    queryFn: async () => {
      const res = await dashboardService.getAdminDonationHistory();
      return res.data.data;
    },
    staleTime: 60 * 1000,
  });
}

// ─── Payment hooks ───────────────────────────────────────────────────────────

export function useAdminPaymentStats() {
  return useQuery({
    queryKey: adminKeys.paymentStats(),
    queryFn: () => adminService.getPaymentStats().then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminPayouts(page = 1, limit = 20) {
  return useQuery({
    queryKey: adminKeys.payoutList(page),
    queryFn: () => adminService.getPayoutSummaries(page, limit).then(r => r.data),
    staleTime: 2 * 60 * 1000,
    placeholderData: prev => prev,
  });
}

// ─── Notification hooks ─────────────────────────────────────────────────────

export function useAdminNotificationStats() {
  return useQuery({
    queryKey: adminKeys.notificationStats(),
    queryFn: () => adminService.getNotificationStats().then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      title: string;
      body: string;
      targetSegment: 'all' | 'consumers' | 'merchants';
      channel: 'push' | 'in_app' | 'both';
    }) => adminService.sendBroadcast(payload).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.notificationStats() });
    },
  });
}

// ─── Leaderboard hooks ──────────────────────────────────────────────────────

export function useAdminLeaderboardStats() {
  return useQuery({
    queryKey: adminKeys.leaderboardStats(),
    queryFn: () => adminService.getLeaderboardStats().then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminTopUsers(page = 1, limit = 20) {
  return useQuery({
    queryKey: adminKeys.topUsers(page),
    queryFn: () => adminService.getTopUsers(page, limit).then(r => r.data),
    staleTime: 2 * 60 * 1000,
    placeholderData: prev => prev,
  });
}

export function useAdminTopMerchants(limit = 3) {
  return useQuery({
    queryKey: adminKeys.topMerchants(),
    queryFn: () => adminService.getTopMerchants(limit).then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Monthly Bag Goal ───────────────────────────────────────────────────────

const MONTHLY_BAG_GOAL_KEY = ['admin', 'community-goal'] as const;

export function useAdminMonthlyBagGoal() {
  return useQuery({
    queryKey: MONTHLY_BAG_GOAL_KEY,
    queryFn: async (): Promise<MonthlyBagGoalStats> => {
      const res = await dashboardService.getAdminMonthlyBagGoal();
      return res.data.data;
    },
    staleTime: 30 * 1000,
  });
}

export function useUpdateMonthlyBagGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      targetCount: number;
      rewardPoints?: number;
      seasonName?: string;
      endDate?: string;
    }) => dashboardService.updateAdminMonthlyBagGoal(payload).then(r => r.data.data),
    onSuccess: data => {
      qc.setQueryData<MonthlyBagGoalStats>(MONTHLY_BAG_GOAL_KEY, data);
    },
  });
}

export function useResetMonthlyBagGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => dashboardService.resetAdminMonthlyBagGoal().then(r => r.data.data),
    onSuccess: data => {
      qc.setQueryData<MonthlyBagGoalStats>(MONTHLY_BAG_GOAL_KEY, data);
    },
  });
}

// ─── Team Management hooks ───────────────────────────────────────────────────

export function useTeamMembers(params: TeamSearchParams = {}) {
  return useQuery({
    queryKey: adminKeys.teamMembers(params),
    queryFn: () => adminService.getTeamMembers(params).then(r => r.data.data),
    staleTime: 60 * 1000,
    placeholderData: prev => prev,
  });
}

export function useTeamMember(id: string | null) {
  return useQuery({
    queryKey: adminKeys.teamMember(id ?? ''),
    queryFn: () => adminService.getTeamMember(id!).then(r => r.data.data),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}

export function useAvailablePermissions() {
  return useQuery({
    queryKey: adminKeys.teamPermissions(),
    queryFn: () => adminService.getAvailablePermissions().then(r => r.data.data),
    staleTime: 30 * 60 * 1000,
  });
}

export function useInviteTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: InviteTeamMemberPayload) =>
      adminService.inviteTeamMember(payload).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'team-members'] });
    },
  });
}

export function useUpdateTeamMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateTeamMemberRolePayload }) =>
      adminService.updateTeamMemberRole(id, payload).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'team-members'] });
    },
  });
}

export function useUpdateTeamMemberPermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateTeamMemberPermissionsPayload }) =>
      adminService.updateTeamMemberPermissions(id, payload).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'team-members'] });
    },
  });
}

export function useRemoveTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.removeTeamMember(id).then(r => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'team-members'] });
    },
  });
}

// ─── Support Ticket hooks ────────────────────────────────────────────────────

export function useTickets(params: TicketSearchParams = {}) {
  return useQuery({
    queryKey: adminKeys.tickets(params),
    queryFn: () => adminService.getTickets(params).then(r => r.data.data),
    staleTime: 30 * 1000,
    placeholderData: prev => prev,
  });
}

export function useTicketStats() {
  return useQuery({
    queryKey: adminKeys.ticketStats(),
    queryFn: () => adminService.getTicketStats().then(r => r.data.data),
    staleTime: 60 * 1000,
  });
}

export function useTicketDetail(id: string | null) {
  return useQuery({
    queryKey: adminKeys.ticketDetail(id ?? ''),
    queryFn: () => adminService.getTicket(id!).then(r => r.data.data),
    enabled: !!id,
  });
}

export function useUpdateTicketStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateTicketStatusPayload }) =>
      adminService.updateTicketStatus(id, payload).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'tickets'] });
      void qc.invalidateQueries({ queryKey: adminKeys.ticketStats() });
    },
  });
}

export function useAssignTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AssignTicketPayload }) =>
      adminService.assignTicket(id, payload).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'tickets'] });
    },
  });
}

export function useUpdateTicketPriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateTicketPriorityPayload }) =>
      adminService.updateTicketPriority(id, payload).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'tickets'] });
    },
  });
}

export function useReplyToTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReplyToTicketPayload }) =>
      adminService.replyToTicket(id, payload).then(r => r.data.data),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: adminKeys.ticketDetail(id) });
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'tickets'] });
    },
  });
}

// ─── Announcement hooks ──────────────────────────────────────────────────────

export function useAnnouncements(params: AnnouncementSearchParams = {}) {
  return useQuery({
    queryKey: adminKeys.announcements(params),
    queryFn: () => adminService.getAnnouncements(params).then(r => r.data.data),
    staleTime: 60 * 1000,
    placeholderData: prev => prev,
  });
}

export function useAnnouncementDetail(id: string | null) {
  return useQuery({
    queryKey: adminKeys.announcementDetail(id ?? ''),
    queryFn: () => adminService.getAnnouncement(id!).then(r => r.data.data),
    enabled: !!id,
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAnnouncementPayload) =>
      adminService.createAnnouncement(payload).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'announcements'] });
    },
  });
}

export function useUpdateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAnnouncementPayload }) =>
      adminService.updateAnnouncement(id, payload).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'announcements'] });
    },
  });
}

export function usePublishAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.publishAnnouncement(id).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'announcements'] });
    },
  });
}

export function useArchiveAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.archiveAnnouncement(id).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'announcements'] });
    },
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.deleteAnnouncement(id).then(r => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'announcements'] });
    },
  });
}

// ─── Geozone hooks ───────────────────────────────────────────────────────────

export function useGeozones(params: GeozoneSearchParams = {}) {
  return useQuery({
    queryKey: adminKeys.geozones(params),
    queryFn: () => adminService.getGeozones(params).then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: prev => prev,
  });
}

export function useGeozoneStats() {
  return useQuery({
    queryKey: adminKeys.geozoneStats(),
    queryFn: () => adminService.getGeozoneStats().then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useGeozoneDetail(id: string | null) {
  return useQuery({
    queryKey: adminKeys.geozoneDetail(id ?? ''),
    queryFn: () => adminService.getGeozone(id!).then(r => r.data.data),
    enabled: !!id,
  });
}

export function useCreateGeozone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateGeozonePayload) =>
      adminService.createGeozone(payload).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'geozones'] });
      void qc.invalidateQueries({ queryKey: adminKeys.geozoneStats() });
    },
  });
}

export function useUpdateGeozone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateGeozonePayload }) =>
      adminService.updateGeozone(id, payload).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'geozones'] });
      void qc.invalidateQueries({ queryKey: adminKeys.geozoneStats() });
    },
  });
}

export function useDeleteGeozone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.deleteGeozone(id).then(r => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'geozones'] });
      void qc.invalidateQueries({ queryKey: adminKeys.geozoneStats() });
    },
  });
}

// ─── Security hooks ─────────────────────────────────────────────────────────

export function useSecurityStats(params: SecurityStatsQuery = {}) {
  return useQuery({
    queryKey: adminKeys.securityStats(params),
    queryFn: () => adminService.getSecurityStats(params).then(r => r.data.data),
    staleTime: 60 * 1000,
  });
}

export function useLockedAccounts(page = 1, limit = 20) {
  return useQuery({
    queryKey: adminKeys.lockedAccounts(page),
    queryFn: () =>
      adminService.getLockedAccounts(page, limit).then(r => ({
        data: r.data.data,
        meta: r.data.meta,
      })),
    staleTime: 30 * 1000,
    placeholderData: prev => prev,
  });
}

export function useUnlockAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) =>
      adminService.unlockAccount(userId, reason).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'locked-accounts'] });
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'security-stats'] });
    },
  });
}

export function useClearIpBlocks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => adminService.clearIpBlocks().then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'security-stats'] });
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'locked-accounts'] });
    },
  });
}

export function useFailedLoginAttempts(userId: string | null) {
  return useQuery({
    queryKey: [...adminKeys.all, 'failed-login-attempts', userId],
    queryFn: () => adminService.getFailedLoginAttempts(userId!).then(r => r.data.data),
    enabled: !!userId,
  });
}

// ─── Organization hooks ─────────────────────────────────────────────────────

export function useOrganizations(params: OrganizationQuery = {}) {
  return useQuery({
    queryKey: adminKeys.organizations(params),
    queryFn: () =>
      adminService.getOrganizations(params).then(r => ({
        data: r.data.data,
        meta: r.data.meta,
      })),
    staleTime: 60 * 1000,
    placeholderData: prev => prev,
  });
}

export function useOrganizationDetail(id: string | null) {
  return useQuery({
    queryKey: adminKeys.organizationDetail(id ?? ''),
    queryFn: () => adminService.getOrganization(id!).then(r => r.data.data),
    enabled: !!id,
  });
}

export function useUpdateOrganizationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrganizationStatus }) =>
      adminService.updateOrganizationStatus(id, status).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'organizations'] });
    },
  });
}

// ─── Offer operation hooks ──────────────────────────────────────────────────

export function useExpiringOffers(hours = 24) {
  return useQuery({
    queryKey: adminKeys.expiringOffers(hours),
    queryFn: () => adminService.getExpiringOffers(hours).then(r => r.data.data),
    staleTime: 2 * 60 * 1000,
  });
}

export function useTriggerAutoFeaturing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => adminService.triggerAutoFeaturing().then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'offer-list'] });
      void qc.invalidateQueries({ queryKey: adminKeys.offerStats() });
    },
  });
}

export function useReserveOfferQuantity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      adminService.reserveOfferQuantity(id, quantity).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'offer-list'] });
    },
  });
}

export function useCancelOfferReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      adminService.cancelOfferReservation(id, quantity).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'offer-list'] });
    },
  });
}

export function useUpdateExpiredOffers() {
  return useMutation({
    mutationFn: () => adminService.updateExpiredOffers().then(r => r.data),
  });
}

// ─── Order operation hooks ──────────────────────────────────────────────────

export function usePendingOrders(page = 1, limit = 20) {
  return useQuery({
    queryKey: adminKeys.pendingOrders(page),
    queryFn: () =>
      adminService.getPendingOrders(page, limit).then(r => ({
        data: r.data.data,
        meta: r.data.meta,
      })),
    staleTime: 30 * 1000,
    placeholderData: prev => prev,
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.deleteOrder(id).then(r => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'order-list'] });
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'pending-orders'] });
      void qc.invalidateQueries({ queryKey: adminKeys.orderStats() });
    },
  });
}

export function useUpdateExpiredOrders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => adminService.updateExpiredOrders().then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'order-list'] });
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'pending-orders'] });
      void qc.invalidateQueries({ queryKey: adminKeys.orderStats() });
    },
  });
}

// ─── Loyalty hooks ──────────────────────────────────────────────────────────

export function useAddLoyaltyPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: AddLoyaltyPointsPayload }) =>
      adminService.addLoyaltyPoints(userId, payload).then(r => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'top-users'] });
      void qc.invalidateQueries({ queryKey: adminKeys.leaderboardStats() });
    },
  });
}

// ─── Anomaly Detection ──────────────────────────────────────────────────────

export function useAnomalies() {
  return useQuery({
    queryKey: [...adminKeys.all, 'anomalies'] as const,
    queryFn: () => adminService.getAnomalies().then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
