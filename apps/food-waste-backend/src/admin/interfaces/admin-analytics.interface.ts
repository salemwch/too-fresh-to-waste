import type { AnalyticsPeriodType } from '../dto/admin-analytics.dto';

export interface PlatformAnalytics {
  users: UserAnalytics;
  establishments: EstablishmentAnalytics;
  orders: OrderAnalytics;
  offers: OfferAnalytics;
  reviews: ReviewAnalytics;
  revenue: RevenueAnalytics;
  period: AnalyticsPeriod;
}

export interface UserAnalytics {
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

export interface EstablishmentAnalytics {
  totalEstablishments: number;
  activeEstablishments: number;
  pendingApproval: number;
  rejectedEstablishments: number;
  suspendedEstablishments: number;
  establishmentsByType: Record<string, number>;
  averageRating: number;
  topPerformingEstablishments: EstablishmentPerformance[];
}

export interface EstablishmentPerformance {
  id: string;
  name: string;
  type: string;
  totalOrders: number;
  totalRevenue: number;
  averageRating: number;
  completionRate: number;
}

export interface OrderAnalytics {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  ordersByStatus: Record<string, number>;
  averageOrderValue: number;
  orderCompletionRate: number;
  orderTrends: OrderTrend[];
}

export interface OrderTrend {
  date: string;
  orders: number;
  revenue: number;
}

export interface OfferAnalytics {
  totalOffers: number;
  activeOffers: number;
  expiredOffers: number;
  soldOffers: number;
  averageDiscount: number;
  mostPopularCategories: CategoryStats[];
  wasteReductionImpact: WasteReductionMetrics;
}

/** Raw shape returned by the waste-reduction aggregation (pre-derivation). */
export interface WasteReductionAggregate {
  totalBags: number | null;
  estimatedValue: number | null;
  actualRevenue: number | null;
}

export interface CategoryStats {
  category: string;
  count: number;
  totalRevenue: number;
  soldQuantity?: number;
  averagePrice?: number;
  averageDiscount?: number;
}

export interface WasteReductionMetrics {
  /** Total food weight rescued across ALL merchants, in kg */
  totalKgSaved: number;
  /** Meals equivalent (ADEME: 1 kg ≈ 1.67 meals) */
  totalMealsSaved: number;
  /** CO₂ avoided, in kg (ADEME Scope 3) */
  co2ReductionKg: number;
  /** Water footprint avoided, in litres */
  waterLitersSaved: number;
  /** Retail value of the rescued food (sum of quantity x originalPrice), in TND — the loss avoided */
  estimatedValue: number;
  /** What customers actually paid (sum of quantity x unitPrice), in TND */
  actualRevenue: number;
  /** Surprise bags rescued — the raw unit all other figures derive from */
  totalBagsSaved: number;
}

export interface ReviewAnalytics {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: Record<string, number>;
  flaggedReviews: number;
  reviewsModerationQueue: number;
  responseRate: number;
}

export interface RevenueAnalytics {
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

export interface EstablishmentRevenue {
  establishmentId: string;
  establishmentName: string;
  revenue: number;
  orders: number;
  commission: number;
}

export interface AnalyticsPeriod {
  startDate: Date;
  endDate: Date;
  periodType: AnalyticsPeriodType;
}

// Union type for audit log values to replace 'any'
export type AuditLogValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | Record<string, string | number | boolean | Date | null>
  | Array<string | number | boolean | Date | null>;

export interface AdminAuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: AdminAction;
  targetType: 'user' | 'establishment' | 'order' | 'review' | 'offer' | 'system';
  targetId?: string;
  previousValue?: Record<string, AuditLogValue>;
  newValue?: Record<string, AuditLogValue>;
  reason?: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
}

export enum AdminAction {
  // User Actions
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_SUSPENDED = 'user_suspended',
  USER_BLOCKED = 'user_blocked',
  USER_ACTIVATED = 'user_activated',
  USER_DELETED = 'user_deleted',

  // Establishment Actions
  ESTABLISHMENT_APPROVED = 'establishment_approved',
  ESTABLISHMENT_REJECTED = 'establishment_rejected',
  ESTABLISHMENT_SUSPENDED = 'establishment_suspended',
  ESTABLISHMENT_REACTIVATED = 'establishment_reactivated',
  ESTABLISHMENT_UPDATED = 'establishment_updated',
  ESTABLISHMENT_TRIAL_EXTENDED = 'establishment_trial_extended',
  ESTABLISHMENT_MARKED_AS_PAID = 'establishment_marked_as_paid',

  // Order Actions
  ORDER_CANCELLED = 'order_cancelled',
  ORDER_REFUNDED = 'order_refunded',
  ORDER_UPDATED = 'order_updated',

  // Offer Actions
  OFFER_FEATURED = 'offer_featured',
  OFFER_UNFEATURED = 'offer_unfeatured',
  OFFER_DISABLED = 'offer_disabled',
  OFFER_ENABLED = 'offer_enabled',
  OFFER_DELETED = 'offer_deleted',
  OFFER_RESTORED = 'offer_restored',

  // Review Actions
  REVIEW_FLAGGED = 'review_flagged',
  REVIEW_APPROVED = 'review_approved',
  REVIEW_REJECTED = 'review_rejected',
  REVIEW_DELETED = 'review_deleted',

  // System Actions
  SYSTEM_CONFIG_UPDATED = 'system_config_updated',
  BULK_OPERATION = 'bulk_operation',
  DATA_EXPORT = 'data_export',
  LOGIN = 'login',
  LOGOUT = 'logout',
}

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
