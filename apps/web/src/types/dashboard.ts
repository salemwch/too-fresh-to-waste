// ─── Chart granularity ───────────────────────────────────────────────────────

export type ChartGranularity = 'day' | 'week' | 'month';

// ─── Date filter ────────────────────────────────────────────────────────────

/** All available time-window presets for the dashboard date filter. */
export type DatePreset =
  | '7d'
  | '14d'
  | '30d' // daily granularity
  | '4w'
  | '8w'
  | '12w' // weekly granularity
  | '3m'
  | '6m'
  | '9m'
  | '12m'; // monthly granularity

interface PresetConfig {
  /** Aggregation granularity sent to the backend. */
  granularity: ChartGranularity;
  /** Number of slots (days / weeks / months). */
  value: number;
  /** Short label shown on the filter button. */
  label: string;
}

/** Single source of truth for all preset metadata. */
export const PRESET_CONFIG: Record<DatePreset, PresetConfig> = {
  '7d': { granularity: 'day', value: 7, label: '7D' },
  '14d': { granularity: 'day', value: 14, label: '14D' },
  '30d': { granularity: 'day', value: 30, label: '30D' },
  '4w': { granularity: 'week', value: 4, label: '4W' },
  '8w': { granularity: 'week', value: 8, label: '8W' },
  '12w': { granularity: 'week', value: 12, label: '12W' },
  '3m': { granularity: 'month', value: 3, label: '3M' },
  '6m': { granularity: 'month', value: 6, label: '6M' },
  '9m': { granularity: 'month', value: 9, label: '9M' },
  '12m': { granularity: 'month', value: 12, label: '1Y' },
};

// ─── Backend response envelope ──────────────────────────────────────────────
// The TransformInterceptor wraps all responses in { status, message?, data, meta?, timestamp }

export interface BackendEnvelope<T> {
  status: number;
  message?: string;
  data: T;
  meta?: PaginationMeta;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ─── Order Stats ────────────────────────────────────────────────────────────

/**
 * GET /orders/merchant-today-sales - today (Africa/Tunis) across both ways a
 * customer pays. Mirrors `TodaySalesSummary` in the backend's
 * `orders/utils/today-sales.util.ts`; every money figure comes from each
 * order's frozen commission decision, never a recomputed 19%.
 */
export interface TodaySalesChannel {
  orders: number;
  /** Food sold, delivery fee excluded. */
  sales: number;
}

export interface TodaySales {
  /** YYYY-MM-DD, the merchant's day in Africa/Tunis. */
  date: string;
  currency: string;
  rate: number;
  cash: TodaySalesChannel;
  online: TodaySalesChannel;
  total: TodaySalesChannel & {
    /** Commission recorded today: 19% of today's NORMAL sales. */
    commission: number;
    /** Commission balance paid off today by SETTLEMENT sales. */
    settled: number;
    /** What the merchant was paid for today's sales. */
    received: number;
    /** received - commission: today's profit. */
    kept: number;
  };
  /** Reserved today, not collected yet. */
  toCollect: TodaySalesChannel;
}

export interface OrderStatsResponse {
  totalOrders: number;
  totalRevenue: number;
  totalEarnings: number;
  /** Retail value of food rescued (sum of originalPrice * quantity for completed orders) */
  totalOriginalValue: number;
  pendingOrders: number;
  confirmedOrders: number;
  readyOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  /** Sum of items[].quantity for picked_up orders (actual bag count) */
  bagsSaved: number;
}

// ─── Merchant Orders ────────────────────────────────────────────────────────

export interface PopulatedUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  avatar?: string;
  profileImage?: string;
}

interface PopulatedEstablishment {
  _id: string;
  name: string;
  address?: {
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
  phoneNumber?: string;
  type?: string;
  images?: string[];
  averageRating?: number;
}

interface OrderItem {
  offerId: string;
  offerTitle: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  originalPrice: number;
  discountAmount: number;
}

interface OrderPricing {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  /** Delivery fee in TND. 0 for pickup. Included in `total`. */
  deliveryFee: number;
  total: number;
  currency: string;
}

/**
 * Mirrors `OrderStatus` in packages/shared/src/enums/order.enum.ts.
 *
 * The three delivery states were missing here long after the driver role
 * shipped, so an order the driver had collected arrived with a status this app
 * could not name: the merchant's status badge fell through its lookup table and
 * rendered the raw i18n namespace, and a delivered order matched no tab. The
 * admin type already listed them, which is why only the merchant side broke.
 *
 * Pickup and delivery are separate chains — a delivery order never reaches
 * `ready_for_pickup` or `picked_up`, and a pickup order never reaches
 * `delivered`. Anything switching on this must handle both.
 */
export type OrderStatus =
  | 'pending'
  | 'pending_payment'
  | 'reserved'
  | 'confirmed'
  // Pickup chain
  | 'ready_for_pickup'
  | 'picked_up'
  // Delivery chain: a driver accepted, then collected, then handed over
  | 'driver_assigned'
  | 'out_for_delivery'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'refunded';

interface OrderPaymentDetails {
  method: 'cash' | 'online' | 'pay_on_delivery';
  amount: number;
  currency: string;
}

export interface MerchantOrder {
  _id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: string;
  paymentDetails: OrderPaymentDetails;
  customerId: PopulatedUser;
  establishmentId: PopulatedEstablishment | string;
  items: OrderItem[];
  pricing: OrderPricing;
  pickupDetails: {
    timeSlot?: string;
    scheduledDate?: string;
    pickupCode?: string;
    instructions?: string;
  };
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Business Metrics (Analytics) ───────────────────────────────────────────

interface MetricValue {
  value: number;
  previousValue?: number;
  changePercentage?: number;
  trend: 'up' | 'down' | 'stable';
}

export interface BusinessMetrics {
  totalRevenue: MetricValue;
  totalEarnings: MetricValue;
  totalOrders: MetricValue;
  averageOrderValue: MetricValue;
  conversionRate: MetricValue;
  customerAcquisitionCost: MetricValue;
  customerLifetimeValue: MetricValue;
  foodWasteSaved: MetricValue;
  carbonFootprintReduced: MetricValue;
  waterSaved: MetricValue;
  packagingSaved: MetricValue;
  energySaved: MetricValue;
}

export interface BusinessMetricsRequest {
  filters: {
    dateRange: {
      startDate: string;
      endDate: string;
    };
    granularity: {
      period: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
    };
    categories?: string[];
    establishmentIds?: string[];
  };
  includeSustainability?: boolean;
  options?: {
    includeComparisons?: boolean;
  };
}

// ─── Quick Stats ────────────────────────────────────────────────────────────

export interface QuickStatsResponse {
  revenue: number;
  orders: number;
  averageOrderValue: number;
  sustainability: {
    foodSaved: number;
    carbonReduced: number;
  };
  period: string;
  generatedAt: string;
}

// ─── Revenue Chart ───────────────────────────────────────────────────────────

export interface RevenueChartItem {
  label: string;
  year: number;
  month: number;
  /** ISO week number — only present when granularity is 'week'. */
  week?: number;
  /** Day of month — only present when granularity is 'day'. */
  day?: number;
  revenue: number;
  earnings: number;
  orderCount: number;
  bagCount: number;
}

// ─── Merchant Wallet ──────────────────────────────────────────────────────

export interface MerchantWallet {
  availableBalance: number;
  pendingBalance: number;
  currency: string;
}

// ─── My Establishment ────────────────────────────────────────────────────────

export interface DocumentMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy?: string;
  verified?: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  expiryDate?: string;
  notes?: string;
}

/** @public — used via inline import() type in establishment page */
export interface LegalDocuments {
  siret?: string;
  license?: string;
  vatNumber?: string;
  businessLicenseUrl?: string;
  businessLicenseMetadata?: DocumentMetadata;
  foodSafetyLicenseUrl?: string;
  foodSafetyLicenseMetadata?: DocumentMetadata;
  insuranceDocumentUrl?: string;
  insuranceDocumentMetadata?: DocumentMetadata;
  taxCertificateUrl?: string;
  taxCertificateMetadata?: DocumentMetadata;
  ownerIdDocumentUrl?: string;
  ownerIdDocumentMetadata?: DocumentMetadata;
  additionalDocuments?: Array<{ type: string; url: string; metadata: DocumentMetadata }>;
}

export interface MyEstablishment {
  _id: string;
  name: string;
  description?: string;
  type?: string;
  /** 'pending' | 'active' | 'suspended' | 'rejected' | 'inactive' */
  status?: string;
  address?: {
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    coordinates?: {
      type: string;
      coordinates: [number, number];
    };
  };
  phoneNumber?: string;
  email?: string;
  website?: string;
  images?: string[];
  cuisineTypes?: string[];
  businessHours?: Record<string, { open: string; close: string; closed: boolean }>;
  acceptsReservations?: boolean;
  isVerified?: boolean;
  isActive?: boolean;
  averageRating?: number;
  totalReviews?: number;
  totalOffers?: number;
  completedOrders?: number;
  rejectionReason?: string;
  googlePlaceId?: string;
  profileImage?: string;
  legalDocuments?: LegalDocuments;
  createdAt?: string;
  updatedAt?: string;
  /** Trial / subscription lifecycle */
  subscriptionStatus?: 'trial' | 'paid' | 'suspended';
  trialEndsAt?: string;
  subscriptionTier?: 'standard' | 'pro';
  subscriptionCycle?: 'monthly' | 'yearly';
  subscriptionExpiresAt?: string;
}

// ─── Created offer (response from POST /offers) ──────────────────────────────

export interface CreatedOfferResponse {
  id: string;
}

// ─── Surprise Bag creation ───────────────────────────────────────────────────

interface SurpriseBagPickupSlot {
  startTime: string; // "18:00"
  endTime: string; // "19:00"
}

export type OfferBagType = 'surprise_bag' | 'specific_items' | 'meal_deal';

export interface CreateSurpriseBagPayload {
  title: string;
  description: string;
  establishmentId: string;
  type: OfferBagType;
  pricing: {
    originalPrice: number;
    discountedPrice: number;
  };
  totalQuantity: number;
  availableFrom: string;
  availableUntil: string;
  pickupTimeSlots: SurpriseBagPickupSlot[];
  isPickupToday: boolean;
  isPickupTomorrow: boolean;
  timezone: string;
}

// ─── Merchant Offers ────────────────────────────────────────────────────────

interface OfferPricing {
  originalPrice: number;
  discountedPrice: number;
  discountPercentage: number;
  currency: string;
}

export interface MerchantOffer {
  id: string;
  title: string;
  type: string;
  image?: string;
  images?: string[];
  pricing: OfferPricing;
  /** total bags created (may not be returned by all endpoints) */
  totalQuantity?: number;
  /** bags reserved but not yet sold */
  reservedQuantity?: number;
  /** bags confirmed sold */
  soldQuantity?: number;
  /** totalQuantity - reservedQuantity - soldQuantity */
  availableQuantity: number;
  availableFrom?: string;
  availableUntil: string;
  pickupTimeSlots?: Array<{ startTime: string; endTime: string }>;
  isPickupToday?: boolean;
  isPickupTomorrow?: boolean;
  status: string;
  isActive?: boolean;
  isFeatured: boolean;
  establishment: {
    name: string;
    averageRating?: number;
    totalReviews?: number;
    profileImage?: string;
  };
  ctaState: 'available' | 'low_stock' | 'sold_out';
  createdAt?: string;
}

export interface ReactivateOfferPayload {
  availableFrom: string;
  availableUntil: string;
  pickupTimeSlots: Array<{ startTime: string; endTime: string }>;
  totalQuantity?: number;
  timezone?: string;
  isPickupToday?: boolean;
  isPickupTomorrow?: boolean;
  pricing?: { originalPrice: number; discountedPrice: number };
}

/**
 * Corrections to an offer that is still running.
 *
 * Every field is optional because the backend's UpdateOfferDto extends
 * `PartialType(CreateOfferDto)` — send only what changed. The edit form omits
 * untouched fields rather than echoing them back, so two merchants editing
 * different things cannot overwrite each other's correction.
 */
export interface UpdateOfferPayload {
  title?: string;
  totalQuantity?: number;
  pricing?: { originalPrice: number; discountedPrice: number };
}

// ─── Donation Pool ──────────────────────────────────────────────────────────

export type DonationPoolStatus =
  'active' | 'funded' | 'distributed' | 'archived' | 'season_complete';

export type DonationGoalCategory = 'TSHIRTS' | 'PANTS' | 'SHOES' | 'CHILDREN_STUDIES' | 'MEDICINE';

interface CategoryProgress {
  category: DonationGoalCategory;
  percent: number;
  totalItems: number;
  totalAmount: number;
  targetAmount: number;
  itemPrice: number;
  targetCount: number;
}

export interface CategoryPricingInput {
  category: DonationGoalCategory;
  itemPrice: number;
  targetCount: number;
}

export interface DonationStats {
  totalDonations: number;
  targetAmount: number;
  mealCount: number;
  contributorCount: number;
  progressPercentage: number;
  status: DonationPoolStatus;
  cause: string;
  activeGoalCategory: DonationGoalCategory;
  currency: string;
  targetDate?: string;
  categoryProgress: CategoryProgress[];
  season: number;
  goalIndex: number;
  completedGoals: DonationGoalCategory[];
}

// ─── Fund Ledger ─────────────────────────────────────────────────────────────
// Reuses DonationGoalCategory from the Donation Pool section above.

interface FundedItem {
  category: DonationGoalCategory;
  count: number;
  amountTnd: number;
}

export interface FundLedgerResponse {
  totalTnd: number;
  currency: 'TND';
  contributionCount: number;
  items: FundedItem[];
  totalItems: number;
  firstContributionAt: string | null;
}

// ─── Community Bag Goal ─────────────────────────────────────────────────────

export type MonthlyGoalStatus = 'active' | 'completed' | 'archived';

export interface MonthlyBagGoalStats {
  currentCount: number;
  targetCount: number;
  progressPercentage: number;
  remaining: number;
  cycleNumber: number;
  status: MonthlyGoalStatus;
  lastUpdatedAt: string;
  seasonName?: string;
  endDate?: string;
  participantCount?: number;
}

// ─── Sustainability ──────────────────────────────────────────────────────────

interface EsgTierInfo {
  name: string;
  label: string;
  badge: string | null;
  threshold: number;
  reached: boolean;
}

export interface EsgTierResponse {
  currentTier: string;
  currentLabel: string;
  currentBadge: string | null;
  bagsSaved: number;
  ringProgress: number;
  nextTier: string | null;
  nextMilestoneAt: number | null;
  remaining: number | null;
  allTiers: EsgTierInfo[];
}

export interface MonthlyGoalResponse {
  targetBagsPerMonth: number;
  currentMonthBags: number;
  progressPercentage: number;
  month: string;
  treesEquivalent: number;
}

export interface CarbonMetricsResponse {
  bagsSaved: number;
  foodWeightKg: number;
  carbonKgAvoided: number;
  waterLitersAvoided: number;
  packagingKgSaved: number;
  energyKwhSaved: number;
  carKmEquivalent: number;
  treesEquivalent: number;
  periodLabel: string;
}

export interface SocialImpactResponse {
  bagsSaved: number;
  mealsDistributed: number;
  peopleServedEstimate: number;
  foodWeightKg: number;
  estimatedValueTnd: number;
  periodLabel: string;
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  establishmentId: string;
  displayName: string;
  profileImage: string | null;
  isAnonymous: boolean;
  mealsSaved: number;
}

export interface MerchantRankResponse {
  rank: number;
  mealsSaved: number;
  totalParticipants: number;
  percentile: number;
}

// ─── Streak ───────────────────────────────────────────────────────────────────

export interface StreakResponse {
  currentStreak: number;
  longestStreak: number;
  freezesAvailable: number;
  lastListedDate: string | null;
  streakAtRisk: boolean;
  listedToday: boolean;
  nextFreezeAt: number;
}

// ─── Real-time Metrics (Analytics) ──────────────────────────────────────────

export interface RealTimeMetrics {
  activeUsers: number;
  ordersToday: number;
  revenueToday: number;
  activeOffers: number;
  pendingOrders: number;
  systemHealth: {
    responseTime: number;
    errorRate: number;
    uptime: number;
  };
  lastUpdated: string;
}

// ─── Customer Location (Analytics) ──────────────────────────────────────────

export interface CustomerLocationItem {
  city: string;
  count: number;
  percentage?: number;
}

// ─── Analytics Period ────────────────────────────────────────────────────────

export type AnalyticsPeriod = 'today' | '7d' | '30d' | '90d' | 'custom';

// ─── Smart Pricing Suggestions ──────────────────────────────────────────────

/**
 * Advice keys emitted by the backend pricing engine. No prose crosses the API
 * boundary — the wording for each key lives in `messages/*.json`, so insights
 * render in the merchant's own locale instead of always in English.
 */
export type PricingInsightType =
  | 'price_above_zone'
  | 'price_below_zone'
  | 'low_fill_rate'
  | 'best_day'
  | 'best_hour'
  | 'low_discount';

export interface PricingInsight {
  type: PricingInsightType;
  impact: 'high' | 'medium' | 'low';
  /** Numeric values interpolated into the translated message. */
  params: Record<string, number>;
}

/**
 * Which population the merchant is being compared against.
 * `category_city` — same business type, same city (like-for-like peers)
 * `city`          — same city, all business types (too few like-for-like peers)
 * `none`          — no peers; the comparison is suppressed rather than faked
 */
type PricingZoneScope = 'category_city' | 'city' | 'none';

/** Where the suggested range came from, so the UI can explain itself. */
type PricingRangeBasis = 'own_history' | 'zone';

interface SuggestedPriceRange {
  min: number;
  max: number;
  currency: string;
  basis: PricingRangeBasis;
}

export interface PricingSuggestions {
  merchantStats: {
    avgDiscountedPrice: number;
    avgOriginalPrice: number;
    avgDiscountPercent: number;
    fillRate: number;
    totalOffers: number;
    totalSold: number;
    bestDayOfWeek: number | null;
    bestHour: number | null;
  };
  zoneStats: {
    avgDiscountedPrice: number;
    avgFillRate: number;
    totalMerchants: number;
    scope: PricingZoneScope;
  };
  insights: PricingInsight[];
  /** `null` when there is neither own history nor a peer set to reason from. */
  suggestedPriceRange: SuggestedPriceRange | null;
  /** Lets the UI state how much evidence sits behind the numbers. */
  sample: {
    windowDays: number;
    merchantOffers: number;
    merchantSoldOutOffers: number;
    peerMerchants: number;
  };
}

// ─── Merchant commission ─────────────────────────────────────────────────────

/**
 * The merchant's own commission statement.
 *
 * `sales - commission = received` for the period, which is identical to any
 * ordinary commission arrangement. The per-order lumpiness (full price on most
 * orders, a partial settlement on some) is a payout detail; the month is what
 * reconciles.
 */
export interface MerchantCommissionStatement {
  /** Still to settle. The merchant owes this - it is not money they hold. */
  commissionDue: number;
  /**
   * The same balance per establishment, largest first, zeros omitted. Under
   * "All locations" this is what keeps the total from hiding which location
   * carries it.
   */
  dueByEstablishment: {
    establishmentId: string;
    name: string;
    amount: number;
  }[];
  sales: number;
  commission: number;
  received: number;
  /** The flat rate, so the merchant can check the arithmetic themselves. */
  rate: number;
  fullPriceOrders: number;
  settledOrders: number;
  currency: string;
  recentSettlements: {
    orderId: string | null;
    amount: number;
    merchantAmount: number | null;
    orderSubtotal: number | null;
    createdAt: string;
  }[];
}
