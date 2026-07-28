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

export interface OrderStatsResponse {
  totalOrders: number;
  totalRevenue: number;
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
  serviceFee: number;
  total: number;
  currency: string;
}

export type OrderStatus =
  | 'pending'
  | 'pending_payment'
  | 'reserved'
  | 'confirmed'
  | 'ready_for_pickup'
  | 'picked_up'
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
  orderCount: number;
  bagCount: number;
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

// ─── Donation Pool ──────────────────────────────────────────────────────────

export type DonationPoolStatus = 'active' | 'funded' | 'distributed' | 'archived';

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
  rewardPoints?: number;
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

export interface PricingInsight {
  type: string;
  message: string;
  impact: 'high' | 'medium' | 'low';
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
  };
  insights: PricingInsight[];
  suggestedPriceRange: {
    min: number;
    max: number;
    currency: string;
  };
}
