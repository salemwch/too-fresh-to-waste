// ─── Chart granularity ───────────────────────────────────────────────────────

export type ChartGranularity = 'day' | 'week' | 'month';

// ─── Date filter ────────────────────────────────────────────────────────────

/** All available time-window presets for the dashboard date filter. */
export type DatePreset =
  | '7d' | '14d' | '30d'       // daily granularity
  | '4w' | '8w'  | '12w'       // weekly granularity
  | '3m' | '6m'  | '9m' | '12m'; // monthly granularity

export interface PresetConfig {
  /** Aggregation granularity sent to the backend. */
  granularity: ChartGranularity;
  /** Number of slots (days / weeks / months). */
  value: number;
  /** Short label shown on the filter button. */
  label: string;
}

/** Single source of truth for all preset metadata. */
export const PRESET_CONFIG: Record<DatePreset, PresetConfig> = {
  '7d':  { granularity: 'day',   value: 7,  label: '7D'  },
  '14d': { granularity: 'day',   value: 14, label: '14D' },
  '30d': { granularity: 'day',   value: 30, label: '30D' },
  '4w':  { granularity: 'week',  value: 4,  label: '4W'  },
  '8w':  { granularity: 'week',  value: 8,  label: '8W'  },
  '12w': { granularity: 'week',  value: 12, label: '12W' },
  '3m':  { granularity: 'month', value: 3,  label: '3M'  },
  '6m':  { granularity: 'month', value: 6,  label: '6M'  },
  '9m':  { granularity: 'month', value: 9,  label: '9M'  },
  '12m': { granularity: 'month', value: 12, label: '1Y'  },
};

/** Presets grouped by granularity — drives the two-level date-filter UI. */
export const PRESETS_BY_GRANULARITY: Record<ChartGranularity, DatePreset[]> = {
  day:   ['7d', '14d', '30d'],
  week:  ['4w', '8w', '12w'],
  month: ['3m', '6m', '9m', '12m'],
};

/** Which preset to select automatically when the user switches granularity tabs. */
export const GRANULARITY_DEFAULT_PRESET: Record<ChartGranularity, DatePreset> = {
  day:   '14d',
  week:  '8w',
  month: '9m',
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
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ─── Order Stats ────────────────────────────────────────────────────────────

export interface OrderStatsResponse {
  totalOrders: number;
  totalRevenue: number;
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

export interface PopulatedEstablishment {
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

export interface OrderItem {
  offerId: string;
  offerTitle: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  originalPrice: number;
  discountAmount: number;
}

export interface OrderPricing {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  serviceFee: number;
  total: number;
  currency: string;
}

export type OrderStatus =
  | 'pending'
  | 'reserved'
  | 'confirmed'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'cancelled'
  | 'expired'
  | 'refunded';

export interface MerchantOrder {
  _id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: string;
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

export interface MetricValue {
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
}

/** @deprecated Renamed to RevenueChartItem. */
export type MonthlyRevenueItem = RevenueChartItem;

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
}

// ─── Created offer (response from POST /offers) ──────────────────────────────

export interface CreatedOfferResponse {
  id: string;
}

// ─── Surprise Bag creation ───────────────────────────────────────────────────

export interface SurpriseBagPickupSlot {
  startTime: string; // "18:00"
  endTime: string;   // "19:00"
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

export type OfferStatusValue =
  | 'draft'
  | 'active'
  | 'sold_out'
  | 'expired'
  | 'cancelled'
  | 'suspended';

export interface OfferPricing {
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
}

// ─── Donation Pool ──────────────────────────────────────────────────────────

export type DonationPoolStatus = 'active' | 'funded' | 'distributed' | 'archived';

export interface DonationStats {
  totalDonations: number;
  targetAmount: number;
  mealCount: number;
  contributorCount: number;
  progressPercentage: number;
  status: DonationPoolStatus;
  cause: string;
  currency: string;
  targetDate?: string;
}

// ─── Community Bag Goal ─────────────────────────────────────────────────────

export type CommunityGoalStatus = 'active' | 'completed' | 'archived';

export interface CommunityBagGoalStats {
  currentCount: number;
  targetCount: number;
  progressPercentage: number;
  remaining: number;
  cycleNumber: number;
  status: CommunityGoalStatus;
  lastUpdatedAt: string;
}
