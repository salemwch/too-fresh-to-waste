import type {
  UserRole,
  UserStatus,
  EstablishmentStatus,
  EstablishmentType,
} from '@foodwaste/shared';

// ─── Enums (string literals mirroring backend) ───────────────────────────────

export type AdminAction =
  | 'user_created'
  | 'user_updated'
  | 'user_suspended'
  | 'user_blocked'
  | 'user_activated'
  | 'user_deleted'
  | 'establishment_approved'
  | 'establishment_rejected'
  | 'establishment_suspended'
  | 'establishment_reactivated'
  | 'establishment_updated'
  | 'order_cancelled'
  | 'order_refunded'
  | 'order_updated'
  | 'review_flagged'
  | 'review_approved'
  | 'review_rejected'
  | 'review_deleted'
  | 'system_config_updated'
  | 'bulk_operation'
  | 'data_export'
  | 'login'
  | 'logout';

type AuditTargetType = 'user' | 'establishment' | 'order' | 'review' | 'offer' | 'system';

export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom';

type ReportType = 'user' | 'establishment' | 'offer' | 'order' | 'review';

type ReportReason =
  | 'spam'
  | 'harassment'
  | 'inappropriate_content'
  | 'fraud'
  | 'fake_profile'
  | 'violation_of_terms'
  | 'health_safety'
  | 'copyright'
  | 'other';

export type ReportStatus = 'pending' | 'in_review' | 'resolved' | 'rejected' | 'escalated';

export type ReportPriority = 'low' | 'medium' | 'high' | 'critical';

export type ModerationActionType =
  | 'warn'
  | 'suspend'
  | 'ban'
  | 'delete_content'
  | 'hide_content'
  | 'restrict_features'
  | 'require_verification'
  | 'demonetize';

export type ModerationSeverity = 'minor' | 'moderate' | 'severe' | 'critical';

type PayoutFrequency = 'daily' | 'weekly' | 'monthly';

// ─── Platform Analytics ───────────────────────────────────────────────────────

export interface PlatformAnalytics {
  users: UserAnalytics;
  establishments: EstablishmentAnalytics;
  orders: OrderAnalytics;
  offers: OfferAnalytics;
  reviews: ReviewAnalytics;
  revenue: RevenueAnalytics;
  period: AnalyticsPeriodInfo;
}

interface UserAnalytics {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  usersByRole: Record<string, number>;
  usersByStatus: Record<string, number>;
  retentionRate: number;
  averageSessionDuration: number;
}

interface EstablishmentAnalytics {
  totalEstablishments: number;
  activeEstablishments: number;
  pendingApproval: number;
  rejectedEstablishments: number;
  suspendedEstablishments: number;
  establishmentsByType: Record<string, number>;
  averageRating: number;
  topPerformingEstablishments: EstablishmentPerformance[];
}

interface EstablishmentPerformance {
  id: string;
  name: string;
  type: string;
  totalOrders: number;
  totalRevenue: number;
  averageRating: number;
  completionRate: number;
}

interface OrderAnalytics {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  ordersByStatus: Record<string, number>;
  averageOrderValue: number;
  orderCompletionRate: number;
  orderTrends: OrderTrend[];
}

interface OrderTrend {
  date: string;
  orders: number;
  revenue: number;
}

interface OfferAnalytics {
  totalOffers: number;
  activeOffers: number;
  expiredOffers: number;
  soldOffers: number;
  averageDiscount: number;
  mostPopularCategories: CategoryStats[];
  wasteReductionImpact: WasteReductionMetrics;
}

interface CategoryStats {
  category: string;
  count: number;
  totalRevenue: number;
  soldQuantity?: number;
  averagePrice?: number;
  averageDiscount?: number;
}

interface WasteReductionMetrics {
  totalKgSaved: number;
  totalMealsSaved: number;
  co2ReductionKg: number;
  /** Litres of water footprint avoided across all merchants (ADEME) */
  waterLitersSaved: number;
  /** Surprise bags rescued — the unit all other impact figures derive from */
  totalBagsSaved: number;
  /** Retail value of the rescued food (quantity x originalPrice) — the loss avoided */
  estimatedValue: number;
  /** What customers actually paid (quantity x unitPrice) */
  actualRevenue: number;
}

interface ReviewAnalytics {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: Record<string, number>;
  flaggedReviews: number;
  reviewsModerationQueue: number;
  responseRate: number;
}

interface RevenueAnalytics {
  totalRevenue: number;
  revenueToday: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
  revenueThisYear: number;
  platformCommission: number;
  averageTransactionValue: number;
  revenueByEstablishment: EstablishmentRevenue[];
  revenueGrowthRate: number;
}

interface EstablishmentRevenue {
  establishmentId: string;
  establishmentName: string;
  revenue: number;
  orders: number;
  commission: number;
}

interface AnalyticsPeriodInfo {
  startDate: string;
  endDate: string;
  periodType: AnalyticsPeriod;
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export interface AuditLogItem {
  id: string;
  adminId: string;
  adminEmail: string;
  adminFirstName: string;
  action: AdminAction;
  targetType: AuditTargetType;
  targetId?: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
}

export interface AuditLogResponse {
  logs: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface RecentActivityResponse {
  activities: AuditLogItem[];
  hoursAnalyzed: number;
  maxActivities: number;
}

// ─── User Management ─────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  phoneNumber?: string;
  avatar?: string;
  profileImage?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  noShowCount?: number;
}

export interface AdminUserListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface UpdateUserStatusPayload {
  status: UserStatus;
  reason: string;
  adminNotes?: string;
  sendNotification?: boolean;
  reactivationDate?: string;
}

export interface BulkUserActionPayload {
  userIds: string[];
  status: UserStatus;
  reason: string;
  sendNotification?: boolean;
}

export interface UserSearchParams {
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  page?: number;
  limit?: number;
}

// ─── Establishment Management ─────────────────────────────────────────────────

export interface AdminEstablishment {
  id: string;
  name: string;
  type: EstablishmentType;
  status: EstablishmentStatus;
  description?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  contactEmail?: string;
  contactPhone?: string;
  rating?: number;
  totalReviews?: number;
  isVerified: boolean;
  isActive: boolean;
  coverImage?: string;
  images?: string[];
  createdAt: string;
  updatedAt: string;
  owner?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  // Activity signals (computed by admin aggregation pipeline)
  lastOrderAt?: string;
  lastOfferCreatedAt?: string;
  ownerLastLoginAt?: string;
  lastActivityAt?: string;
  // Subscription / trial lifecycle
  subscriptionStatus?: 'trial' | 'paid' | 'suspended';
  trialEndsAt?: string;
}

export interface AdminEstablishmentListResponse {
  establishments: AdminEstablishment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface AdminEstablishmentOverview {
  total: number;
  pending: number;
  active: number;
  suspended: number;
  rejected: number;
  activeLastThirtyDays?: number;
}

export interface ApproveEstablishmentPayload {
  approved: boolean;
  reason?: string;
  adminNotes?: string;
  sendNotification?: boolean;
}

export interface UpdateEstablishmentStatusPayload {
  status: EstablishmentStatus;
  reason: string;
  adminNotes?: string;
  sendNotification?: boolean;
  reactivationDate?: string;
}

export interface ExtendTrialPayload {
  /** Absolute ISO date. If omitted, extendByDays must be provided. */
  trialEndsAt?: string;
  /** Relative offset in days. Ignored if trialEndsAt is set. */
  extendByDays?: number;
  adminNotes?: string;
  sendNotification?: boolean;
}

export interface MarkAsPaidPayload {
  adminNotes?: string;
  sendNotification?: boolean;
}

export interface EstablishmentSearchParams {
  search?: string;
  status?: EstablishmentStatus;
  type?: EstablishmentType;
  page?: number;
  limit?: number;
}

// ─── Moderation ───────────────────────────────────────────────────────────────

export interface ModerationReport {
  _id: string;
  type: ReportType;
  targetId: string;
  reporterId: string;
  reason: ReportReason;
  description: string;
  evidence: string[];
  status: ReportStatus;
  priority: ReportPriority;
  assignedToModerator?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
  reporter?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface ModerationDashboardStats {
  totalReports: number;
  pendingReports: number;
  inReviewReports: number;
  resolvedReports: number;
  escalatedReports: number;
  reportsByType: Record<ReportType, number>;
  reportsByPriority: Record<ReportPriority, number>;
}

export interface UpdateReportPayload {
  status?: ReportStatus;
  priority?: ReportPriority;
  resolutionNotes?: string;
}

export interface CreateModerationActionPayload {
  reportId?: string;
  targetUserId: string;
  actionType: ModerationActionType;
  severity: ModerationSeverity;
  reason: string;
  notes?: string;
  expiresAt?: string;
}

export interface ReportSearchParams {
  type?: ReportType;
  status?: ReportStatus;
  priority?: ReportPriority;
  page?: number;
  limit?: number;
}

// ─── System Config ────────────────────────────────────────────────────────────

export interface PlatformSettings {
  maintenanceMode: boolean;
  allowNewRegistrations: boolean;
  requireEstablishmentApproval: boolean;
  maxOffersPerEstablishment: number;
  defaultOfferExpirationHours: number;
  minOrderValue: number;
  maxOrderValue: number;
  platformCommissionRate: number;
  autoRefundTimeoutHours: number;
}

export interface NotificationSettings {
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  adminEmailAlerts: boolean;
  orderConfirmationEnabled: boolean;
  orderReminderEnabled: boolean;
  promotionalEmailsEnabled: boolean;
}

export interface SecuritySettings {
  maxLoginAttempts: number;
  loginAttemptWindow: number;
  accountLockoutDuration: number;
  passwordMinLength: number;
  passwordRequireSpecialChar: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireUppercase: boolean;
  sessionTimeout: number;
  twoFactorAuthRequired: boolean;
}

export interface PaymentSettings {
  stripeEnabled: boolean;
  paypalEnabled: boolean;
  minimumPayoutAmount: number;
  payoutFrequency: PayoutFrequency;
  automaticPayouts: boolean;
  refundProcessingDays: number;
}

export interface SystemConfig {
  id: string;
  version: string;
  isActive: boolean;
  platformSettings: PlatformSettings;
  notificationSettings: NotificationSettings;
  securitySettings: SecuritySettings;
  paymentSettings: PaymentSettings;
  description?: string;
  lastModifiedBy: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateSystemConfigPayload {
  platformSettings?: Partial<PlatformSettings>;
  notificationSettings?: Partial<NotificationSettings>;
  securitySettings?: Partial<SecuritySettings>;
  paymentSettings?: Partial<PaymentSettings>;
  description?: string;
}

export interface AuditLogSearchParams {
  page?: number;
  limit?: number;
  action?: AdminAction;
  targetType?: AuditTargetType;
  adminId?: string;
  startDate?: string;
  endDate?: string;
}

// ─── Health Check ─────────────────────────────────────────────────────────────

export type HealthStatus = 'up' | 'down' | 'unknown';

interface HealthIndicator {
  status: HealthStatus;
  responseTime?: number;
  message?: string;
}

export interface HealthCheckResult {
  status: 'ok' | 'error' | 'shutting_down';
  info: Record<string, HealthIndicator>;
  error: Record<string, HealthIndicator>;
  details: Record<string, HealthIndicator>;
}

export interface LivenessResult {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  environment: string;
}

// ─── Real-Time Analytics ──────────────────────────────────────────────────────

export interface RealTimeMetrics {
  activeUsers: number;
  activeOffers: number;
  ordersLastHour: number;
  revenueLastHour: number;
  pendingApprovals: number;
  openReports: number;
  timestamp: string;
}

// ─── Offer Management (Admin) ─────────────────────────────────────────────────

export interface AdminOfferStats {
  countByStatus: Record<string, number>;
  totalOffers: number;
  totalActiveBags: number;
  totalSoldBags: number;
  totalRevenueSaved: number;
  avgDiscountPercentage: number;
  platformPickupRate: number;
  featuredCount: number;
  topCategories: Array<{ category: string; count: number }>;
  offersByType: Record<string, number>;
}

export interface AdminOfferItem {
  _id: string;
  title: string;
  status: string;
  type: string;
  pricing: {
    originalPrice: number;
    discountedPrice: number;
    discountPercentage: number;
  };
  totalQuantity: number;
  soldQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  pickupRate: number;
  categories: string[];
  isActive: boolean;
  isFeaturedManual: boolean;
  isFeaturedAuto: boolean;
  isFeatured: boolean;
  availableFrom: string;
  availableUntil: string;
  viewCount: number;
  favoriteCount: number;
  createdAt: string;
  expiredAt?: string;
  establishment?: { _id: string; name: string; type: string; city?: string };
  merchant?: { _id: string; name: string; email: string };
}

export interface AdminDeletedOfferItem {
  _id: string;
  title: string;
  status: string;
  pricing: { discountedPrice: number; discountPercentage: number };
  totalQuantity: number;
  soldQuantity: number;
  deletedAt: string;
  deletedBy: string;
  deletionReason?: string;
  establishment?: { _id: string; name: string };
  createdAt: string;
}

export interface AdminOfferQuery {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
  establishmentId?: string;
  merchantId?: string;
  search?: string;
  featured?: boolean;
  minDiscount?: number;
  maxDiscount?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface AdminLowPickupItem {
  _id: string;
  title: string;
  status: string;
  pricing: { discountPercentage: number; discountedPrice: number };
  totalQuantity: number;
  soldQuantity: number;
  pickupRate: number;
  categories: string[];
  availableFrom: string;
  availableUntil: string;
  expiredAt?: string;
  establishment?: { name: string; type: string };
}

export interface AdminPriceViolationItem {
  _id: string;
  title: string;
  status: string;
  pricing: { originalPrice: number; discountedPrice: number; discountPercentage: number };
  availableFrom: string;
  availableUntil: string;
  createdAt: string;
  establishment?: { name: string; type: string };
  merchant?: { name: string; email: string };
}

export type BulkOfferAction = 'disable' | 'enable' | 'feature' | 'unfeature' | 'delete';

export interface BulkOfferActionPayload {
  action: BulkOfferAction;
  offerIds: string[];
  reason?: string;
}

export interface BulkOfferActionResult {
  processed: number;
  failed: string[];
  action: BulkOfferAction;
}

// ─── Admin Orders ────────────────────────────────────────────────────────────

export type AdminOrderStatus =
  | 'pending'
  | 'pending_payment'
  | 'reserved'
  | 'confirmed'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'completed'
  | 'driver_assigned'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'expired'
  | 'refunded';

export type AdminPaymentStatus =
  'pending' | 'held' | 'paid' | 'failed' | 'refund_pending' | 'refunded' | 'partially_refunded';

export interface AdminOrderItem {
  _id: string;
  orderNumber: string;
  status: AdminOrderStatus;
  paymentStatus: AdminPaymentStatus;
  paymentProvider: string;
  pricing: { total: number; currency: string };
  createdAt: string;
  cancellationReason?: string;
  refundReason?: string;
  customer: { name: string; email: string };
  merchant: { name: string; email: string };
  establishment: { name: string };
  deliveryMode?: 'pickup' | 'delivery';
  driver?: { _id: string; name: string } | null;
}

export interface AdminOrderDetail {
  _id: string;
  orderNumber: string;
  status: AdminOrderStatus;
  paymentStatus: AdminPaymentStatus;
  paymentProvider: string;
  // `serviceFee` removed — it was a cash surcharge applied in both delivery and
  // pickup, and is now folded into `deliveryFee`, which depends only on
  // deliveryMode.
  pricing: { total: number; currency: string; deliveryFee?: number };
  items: Array<{ offerId: string; title?: string; quantity: number; unitPrice: number }>;
  pickupCode?: string;
  expiresAt?: string;
  createdAt: string;
  confirmedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  refundReason?: string;
  customer: { _id: string; name: string; email: string; phone?: string };
  merchant: { _id: string; name: string; email: string; phone?: string };
  establishment: { _id: string; name: string; address?: Record<string, unknown> };
  // Delivery — null/absent on pickup orders, which are still the default mode.
  deliveryMode?: 'pickup' | 'delivery';
  driver?: { _id: string; name: string; email?: string; phone?: string } | null;
  driverAssignedAt?: string;
  driverPickedUpAt?: string;
  deliveredAt?: string;
  estimatedDistanceKm?: number;
  driverEarnings?: number;
  deliveryAddress?: { city?: string; coordinates?: { lat: number; lng: number } };
  refundRequests: Array<{
    reason: string;
    status: string;
    amount: number;
    notes?: string;
    createdAt: string;
  }>;
}

export interface AdminOrderStats {
  totalOrders: number;
  activeOrders: number;
  disputeRate: number;
  totalRevenue: number;
  countByStatus: Record<string, number>;
  countByPaymentStatus: Record<string, number>;
  refundTotal: number;
}

export interface AdminOrderQuery {
  page?: number;
  limit?: number;
  status?: AdminOrderStatus;
  paymentStatus?: AdminPaymentStatus;
  paymentProvider?: string;
  customerId?: string;
  merchantId?: string;
  establishmentId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AdminCancelOrderPayload {
  reason: string;
}

export interface AdminRefundOrderPayload {
  reason: string;
  notes?: string;
}

// ─── Establishment Stats ──────────────────────────────────────────────────────

export interface EstablishmentStats {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  orderCompletionRate: number;
  totalOffers: number;
  activeOffers: number;
  soldOutOffers: number;
  expiredOffers: number;
  averageRating: number;
  totalReviews: number;
  pickupRate: number;
  period?: { startDate: string; endDate: string };
}

// ─── Audit Statistics ─────────────────────────────────────────────────────────

export interface AuditStats {
  totalActions: number;
  actionsByType: Record<string, number>;
  actionsByAdmin: Array<{ adminId: string; adminEmail: string; count: number }>;
  targetsByType: Record<string, number>;
  dailyActivity: Array<{ date: string; count: number }>;
  daysAnalyzed: number;
}

// ─── User Overview ────────────────────────────────────────────────────────────

export interface UserOverview {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  pendingUsers: number;
  usersByRole: Record<string, number>;
  usersByStatus: Record<string, number>;
}

// ─── User Activity ────────────────────────────────────────────────────────────

interface UserActivityEvent {
  type: 'login' | 'status_change' | 'profile_update' | 'security_event' | 'admin_action';
  description: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
}

interface UserAuditTrailEvent {
  id: string;
  action: string;
  timestamp: string;
  adminEmail?: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface UserActivityData {
  userId: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    createdAt: string;
    lastLoginAt?: string;
  };
  period: {
    startDate: string;
    endDate: string;
    days: number;
  };
  summary: {
    totalActions: number;
    statusChanges: number;
    loginAttempts: number;
    lastActivity?: string;
    accountAge: number;
    activityScore: number;
  };
  metrics: {
    averageActionsPerDay: number;
    mostActiveDay?: string;
    activityTrend: 'increasing' | 'decreasing' | 'stable';
    riskScore: number;
  };
  recentEvents: UserActivityEvent[];
  auditTrail: UserAuditTrailEvent[];
  totalEvents: number;
}

// ─── Establishment Activity ───────────────────────────────────────────────────

export interface EstablishmentAuditEntry {
  _id?: string;
  id?: string;
  action: string;
  adminEmail?: string;
  reason?: string;
  timestamp?: string;
  createdAt?: string;
}

// ─── Payment Management ─────────────────────────────────────────────────────

export interface AdminPaymentStats {
  totalPayments: number;
  totalAmount: number;
  totalRefunded: number;
  completedPayments: number;
  failedPayments: number;
  pendingPayments: number;
  refundedPayments: number;
  averageAmount: number;
  totalProcessingFees: number;
  paymentMethods: Array<{ method: string; count: number; total: number }>;
}

export interface AdminPayoutSummary {
  _id: string;
  establishmentName: string;
  merchantName: string;
  merchantEmail: string;
  availableBalance: number;
  pendingBalance: number;
  currency: string;
  lastPayoutDate?: string;
}

// ─── Notification Management ────────────────────────────────────────────────

export interface AdminNotificationStats {
  totalSent: number;
  deliveredCount: number;
  failedCount: number;
  pendingCount: number;
  deliveryRate: number;
  channelBreakdown: Array<{ channel: string; count: number }>;
}

export interface AdminBroadcastPayload {
  title: string;
  body: string;
  targetSegment: 'all' | 'consumers' | 'merchants';
  channel: 'push' | 'in_app' | 'both';
}

export interface AdminBroadcastResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
}

// ─── Leaderboard Management ─────────────────────────────────────────────────

export interface AdminLeaderboardStats {
  totalParticipants: number;
  totalPointsDistributed: number;
  averagePoints: number;
  topTier: string;
  tierBreakdown: Array<{ tier: string; count: number }>;
}

export interface AdminLeaderboardEntry {
  _id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  totalPoints: number;
  totalOrdersCount: number;
  totalBagsSaved: number;
  currentTier: string;
  referralCount: number;
  rank: number;
}

export interface AdminTopMerchant {
  rank: number;
  establishmentId: string;
  establishmentName: string;
  merchantId: string;
  bagsSaved: number;
}

// ─── Team Management ─────────────────────────────────────────────────────────

export type AdminPermission =
  | 'users:view'
  | 'users:edit'
  | 'users:suspend'
  | 'users:delete'
  | 'establishments:view'
  | 'establishments:approve'
  | 'establishments:suspend'
  | 'orders:view'
  | 'orders:cancel'
  | 'orders:refund'
  | 'offers:view'
  | 'offers:edit'
  | 'offers:feature'
  | 'offers:delete'
  | 'moderation:view'
  | 'moderation:action'
  | 'analytics:view'
  | 'analytics:export'
  | 'notifications:view'
  | 'notifications:broadcast'
  | 'payments:view'
  | 'payments:refund'
  | 'voting:view'
  | 'voting:manage'
  | 'system:config'
  | 'team:manage'
  | 'audit:view';

export interface TeamMemberRow {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'admin' | 'moderator';
  permissions: AdminPermission[];
  isActive: boolean;
  lastLoginAt: string | null;
  invitedBy: string | null;
  createdAt: string;
}

export interface InviteTeamMemberPayload {
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'moderator';
  permissions?: AdminPermission[];
}

export interface UpdateTeamMemberRolePayload {
  role: 'admin' | 'moderator';
}

export interface UpdateTeamMemberPermissionsPayload {
  permissions: AdminPermission[];
}

export interface TeamSearchParams {
  search?: string;
  role?: 'admin' | 'moderator';
  page?: number;
  limit?: number;
}

// ─── Support Tickets ─────────────────────────────────────────────────────────

export type TicketStatus = 'open' | 'in_progress' | 'awaiting_user' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
type TicketCategory =
  | 'order_issue'
  | 'payment_dispute'
  | 'account_problem'
  | 'establishment_complaint'
  | 'technical_bug'
  | 'feature_request'
  | 'other';

interface TicketReply {
  authorId: string;
  authorRole: 'user' | 'admin' | 'system';
  message: string;
  createdAt: string;
}

export interface SupportTicketRow {
  _id: string;
  userId: { _id: string; firstName: string; lastName: string; email: string } | string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignedTo?: { _id: string; firstName: string; lastName: string; email: string } | string;
  replies: TicketReply[];
  resolvedAt?: string;
  firstResponseAt?: string;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketStats {
  open: number;
  resolved: number;
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byCategory: Record<string, number>;
}

export interface TicketSearchParams {
  search?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assignedTo?: string;
  page?: number;
  limit?: number;
}

export interface UpdateTicketStatusPayload {
  status: TicketStatus;
  resolutionNote?: string;
}

export interface AssignTicketPayload {
  assignedTo: string;
}

export interface UpdateTicketPriorityPayload {
  priority: TicketPriority;
}

export interface ReplyToTicketPayload {
  message: string;
}

// ─── Announcements / CMS ────────────────────────────────────────────────────

export type AnnouncementType = 'banner' | 'maintenance' | 'promotion' | 'update' | 'alert';
type AnnouncementTarget = 'all' | 'consumers' | 'merchants' | 'specific_zone';
export type AnnouncementStatusType = 'draft' | 'scheduled' | 'active' | 'expired' | 'archived';

export interface AnnouncementRow {
  _id: string;
  title: string;
  content: string;
  type: AnnouncementType;
  target: AnnouncementTarget;
  status: AnnouncementStatusType;
  startsAt?: string;
  expiresAt?: string;
  createdBy: { _id: string; firstName: string; lastName: string; email: string } | string;
  dismissible: boolean;
  actionUrl?: string;
  actionLabel?: string;
  zoneId?: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnnouncementPayload {
  title: string;
  content: string;
  type: AnnouncementType;
  target?: AnnouncementTarget;
  startsAt?: string;
  expiresAt?: string;
  dismissible?: boolean;
  actionUrl?: string;
  actionLabel?: string;
  zoneId?: string;
  priority?: number;
}

export interface UpdateAnnouncementPayload {
  title?: string;
  content?: string;
  type?: AnnouncementType;
  target?: AnnouncementTarget;
  status?: AnnouncementStatusType;
  startsAt?: string;
  expiresAt?: string;
  dismissible?: boolean;
  actionUrl?: string;
  actionLabel?: string;
  zoneId?: string;
  priority?: number;
}

export interface AnnouncementSearchParams {
  search?: string;
  type?: AnnouncementType;
  status?: AnnouncementStatusType;
  target?: AnnouncementTarget;
  page?: number;
  limit?: number;
}

// ─── Geozones / Coverage ────────────────────────────────────────────────────

export type GeozoneStatus = 'active' | 'inactive' | 'coming_soon';

export interface GeozoneRow {
  _id: string;
  name: string;
  displayName: string;
  description?: string;
  status: GeozoneStatus;
  boundary: { type: 'Polygon'; coordinates: number[][][] };
  center: { latitude: number; longitude: number };
  deliveryFee: number;
  minimumOrder: number;
  defaultSearchRadius: number;
  timezone: string;
  currency: string;
  establishmentCount: number;
  activeOfferCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GeozoneStats {
  totalZones: number;
  activeZones: number;
  zones: Array<{
    _id: string;
    name: string;
    displayName: string;
    status: GeozoneStatus;
    center: { latitude: number; longitude: number };
    establishmentCount: number;
  }>;
}

export interface CreateGeozonePayload {
  name: string;
  displayName: string;
  description?: string;
  polygonCoordinates: number[][];
  center: { latitude: number; longitude: number };
  deliveryFee?: number;
  minimumOrder?: number;
  defaultSearchRadius?: number;
}

export interface UpdateGeozonePayload {
  displayName?: string;
  description?: string;
  status?: GeozoneStatus;
  polygonCoordinates?: number[][];
  center?: { latitude: number; longitude: number };
  deliveryFee?: number;
  minimumOrder?: number;
  defaultSearchRadius?: number;
}

export interface GeozoneSearchParams {
  search?: string;
  status?: GeozoneStatus;
  page?: number;
  limit?: number;
}

// ─── Auth Security (admin) ──────────────────────────────────────────────────

export interface SecurityStats {
  period: { from: string; to: string };
  totalUsers: number;
  activeUsers: number;
  successfulLogins: number;
  failedLogins: number;
  lockedAccounts: number;
  newRegistrations: number;
  summary: { totalLoginAttempts: number; successRate: string };
}

interface LockedAccount {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  failedLoginAttempts: number;
  accountLockedUntil: string;
  lastLoginAt?: string;
  createdAt: string;
}

export interface LockedAccountsResponse {
  accounts: LockedAccount[];
  total: number;
  page: number;
  limit: number;
}

export interface FailedLoginInfo {
  userId: string;
  failedAttempts: number;
  accountLockedUntil: string | null;
  isLocked: boolean;
}

export interface ClearIpBlocksResult {
  clearedIpBlocks: number;
  clearedLoginAttempts: number;
}

export interface SecurityStatsQuery {
  fromDate?: string;
  toDate?: string;
}

// ─── Organization Management (admin) ────────────────────────────────────────

export type OrganizationStatus = 'pending' | 'active' | 'suspended';

export interface OrganizationRow {
  _id: string;
  name: string;
  logo?: string;
  ownerId: string;
  status: OrganizationStatus;
  establishmentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationQuery {
  page?: number;
  limit?: number;
  status?: OrganizationStatus;
}

// ─── Offer Operations (additional) ──────────────────────────────────────────

export interface ExpiringOfferItem {
  id: string;
  title: string;
  type: string;
  image?: string;
  pricing: {
    originalPrice: number;
    discountedPrice: number;
    discountPercentage: number;
    currency: string;
  };
  availableQuantity: number;
  availableFrom: string;
  availableUntil: string;
  establishment: {
    name: string;
    averageRating?: number;
    totalReviews?: number;
    profileImage?: string;
  };
  status: string;
  isFeatured: boolean;
}

export interface AutoFeaturingResult {
  offersAutoFeatured: number;
  offersAutoUnfeatured: number;
  timestamp: string;
}

// ─── Order Operations (additional) ──────────────────────────────────────────

export interface AdminPendingOrder {
  _id: string;
  orderNumber: string;
  customerId: string | { _id: string; firstName: string; lastName: string; email: string };
  establishmentId: string | { _id: string; name: string };
  merchantId: string;
  status: string;
  paymentStatus: string;
  pricing: { subtotal: number; total: number; currency: string };
  expiresAt: string;
  createdAt: string;
}

// ─── Loyalty (admin add points) ─────────────────────────────────────────────

export interface AddLoyaltyPointsPayload {
  amount: number;
  reason: string;
  orderId?: string;
  offerId?: string;
  bypassMultiplier?: boolean;
}

// ─── Anomaly Detection ──────────────────────────────────────────────────────

export interface AnomalyAlert {
  id: string;
  type: 'high_cancellation' | 'high_expiry' | 'cancellation_spike' | 'unusual_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  merchantEmail?: string;
  value: number;
  threshold: number;
  detectedAt: string;
}

// ─── Drivers ─────────────────────────────────────────────────────────────────

export interface CreateDriverPayload {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  idCardNumber: string;
  address: string;
}

export interface CreateDriverResponse {
  driver: { _id: string; firstName: string; lastName: string; email: string };
  driverProfile: { idCardNumber: string; address: string };
  temporaryPassword: string;
}

/** Last reported position. Backend flips GeoJSON [lng, lat] before sending. */
interface DriverPosition {
  lat: number;
  lng: number;
  at: string | null;
}

interface AdminDriverProfile {
  idCardNumber: string;
  address: string;
  isOnline: boolean;
  lastOnlineAt: string | null;
  lastKnownLocation: DriverPosition | null;
}

/** Lifetime activity, derived from orders — never a stored counter. */
export interface DriverStats {
  totalAssigned: number;
  totalDelivered: number;
  activeCount: number;
  totalEarnings: number;
  avgDeliveryMinutes: number | null;
  lastDeliveredAt: string | null;
  cancellationCount: number;
  autoReleaseCount: number;
}

export interface DriverRow {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  status: UserStatus;
  requiresPasswordChange: boolean;
  createdAt: string;
  driverProfile: AdminDriverProfile | null;
  stats: DriverStats;
}

interface DriverEarnings {
  today: number;
  thisWeek: number;
  thisMonth: number;
  allTime: number;
  deliveriesToday: number;
  deliveriesAllTime: number;
  currency: string;
}

export interface DriverUnassignment {
  orderId: string;
  orderNumber: string;
  reason: string | null;
  auto: boolean;
  at: string;
}

export interface DriverDetail {
  driver: DriverRow & { lastLoginAt: string | null };
  earnings: DriverEarnings;
  unassignments: DriverUnassignment[];
}

export interface DriverOrderRow {
  _id: string;
  orderNumber: string;
  status: AdminOrderStatus;
  deliveryMode: 'pickup' | 'delivery';
  total: number;
  currency: string;
  driverEarnings: number | null;
  estimatedDistanceKm: number | null;
  deliveryCity: string | null;
  createdAt: string;
  driverAssignedAt: string | null;
  driverPickedUpAt: string | null;
  deliveredAt: string | null;
}

export interface DriverOrdersQuery {
  page?: number;
  limit?: number;
  status?: AdminOrderStatus;
}

// ─── Commission ──────────────────────────────────────────────────────────────

/**
 * One merchant's commission position.
 *
 * `commissionDue` is what the merchant **owes** the platform, not a balance
 * they hold. Under the commission-wallet model the merchant is credited the
 * full order price on most orders and the 19% accrues here instead.
 */
export interface CommissionMerchantRow {
  /** Same value as `establishmentId`. AdminDataTable keys its rows on `id`. */
  id: string;
  establishmentId: string;
  establishmentName: string;
  merchantName: string;
  city: string | null;
  commissionDue: number;
  gmv: number;
  accrued: number;
  collected: number;
  /** `collected / gmv`. `null` when the merchant had no sales in the period. */
  effectiveRate: number | null;
  /** Orders that accrued commission in the period. */
  accrualCount: number;
  lastSettlementAt: string | null;
}

export interface CommissionSummary {
  totalDue: number;
  totalAccrued: number;
  totalCollected: number;
  gmv: number;
  effectiveRate: number | null;
  merchantsWithBalance: number;
  /**
   * `accrued - collected - sum(commissionDue)`. Must be 0.
   * Anything else means the ledger and the running balances disagree.
   */
  reconciliationDelta: number;
  reconciled: boolean;
}

export type CommissionLedgerType = 'accrual' | 'settlement' | 'reversal' | 'adjustment';

export interface CommissionLedgerRow {
  id: string;
  type: CommissionLedgerType;
  amount: number;
  balanceAfter: number;
  orderSubtotal: number | null;
  merchantAmount: number | null;
  orderId: string | null;
  reason: string | null;
  /**
   * `null` for rows written outside Mongoose (a migration, the raw driver),
   * which carry no `timestamps` value. The backend returns null rather than
   * throwing so one undated row cannot take down the whole audit trail.
   */
  createdAt: string | null;
}

export type CommissionSortKey =
  'commissionDue' | 'gmv' | 'accrued' | 'collected' | 'effectiveRate' | 'lastSettlementAt';

export interface CommissionQuery {
  page?: number;
  limit?: number;
  search?: string;
  city?: string;
  minDue?: number;
  maxDue?: number;
  rateDriftAbove?: number;
  neverSettled?: boolean;
  sortBy?: CommissionSortKey;
  sortOrder?: 'asc' | 'desc';
}
