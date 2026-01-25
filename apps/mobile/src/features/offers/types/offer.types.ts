/**
 * Offer Types
 *
 * Type definitions for food waste offers matching backend schema
 * Backend schema: apps/food-waste-backend/src/offers/schemas/offer.schema.ts
 */

import type { ID, Timestamp, Currency } from '@/types';

// ============================================================================
// Enums (must match backend exactly)
// ============================================================================

export enum OfferStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  SOLD_OUT = 'sold_out',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  SUSPENDED = 'suspended',
}

export enum OfferType {
  SURPRISE_BAG = 'surprise_bag',
  SPECIFIC_ITEMS = 'specific_items',
  MEAL_DEAL = 'meal_deal',
}

/**
 * CTA (Call-to-Action) State for UI
 * Matches backend: apps/food-waste-backend/src/offers/DTO/offer-list.dto.ts
 */
export enum CtaState {
  AVAILABLE = 'available',
  LOW_STOCK = 'low_stock',
  SOLD_OUT = 'sold_out',
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Pickup time slot for order collection
 */
export interface PickupTimeSlot {
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  maxOrders: number;
  currentOrders: number;
}

/**
 * Nutritional information for the offer
 */
export interface NutritionalInfo {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  allergens?: string[];
  dietaryInfo?: string[]; // ['vegetarian', 'vegan', 'gluten-free', etc.]
}

/**
 * Pricing information
 */
export interface PriceInfo {
  originalPrice: number;
  discountedPrice: number;
  discountPercentage: number;
  currency: Currency;
}

/**
 * Recurring days configuration
 */
export interface RecurringDays {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

/**
 * Complete Offer data structure
 * Backend API uses 'id' not '_id' in responses
 *
 * Note: When fetching single offers via GET /offers/:id, the backend populates
 * establishmentId and merchantId with full objects for better UX
 */
export interface Offer {
  id: ID; // Backend DTO uses 'id' not '_id'
  title: string;
  description: string;
  // Can be either ID string or populated object
  establishmentId: ID | {
    _id?: ID;
    id?: ID;
    name: string;
    address?: any;
    type?: string;
    averageRating?: number;
    totalReviews?: number;
  };
  // Can be either ID string or populated object
  merchantId: ID | {
    _id?: ID;
    id?: ID;
    firstName?: string;
    lastName?: string;
    profileImage?: string;
  };
  type: OfferType;
  status: OfferStatus;
  pricing: PriceInfo;

  // Quantity management
  totalQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  availableQuantity?: number; // Virtual field computed by backend

  // Media
  images: string[];

  // Categories & Tags
  categories: string[];
  tags: string[];

  // Nutritional
  nutritionalInfo?: NutritionalInfo;

  // Availability
  availableFrom: Timestamp;
  availableUntil: Timestamp;
  pickupTimeSlots: PickupTimeSlot[];

  // Additional info
  estimatedWeight?: string;

  // Metrics
  viewCount: number;
  favoriteCount: number;

  // Flags
  isActive: boolean;
  isFeatured: boolean;
  isRecurring: boolean;
  isExpired?: boolean; // Virtual field
  isSoldOut?: boolean; // Virtual field

  // Recurring configuration
  recurringDays?: RecurringDays;

  // Additional fields
  specialInstructions?: string;
  cancellationDeadline?: Timestamp;
  lastModifiedBy?: ID;
  publishedAt?: Timestamp;
  expiredAt?: Timestamp;

  // Soft delete fields
  isDeleted: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
  deletionReason?: string;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Offer list item (card view)
 * ✅ SECURITY: Matches backend OfferCardDto (no PII, no internal metrics)
 * ✅ Backend calculates availableQuantity (totalQuantity - sold - reserved)
 * ✅ Backend calculates ctaState (available/low_stock/sold_out)
 * Backend: apps/food-waste-backend/src/offers/DTO/offer-list.dto.ts
 * Backend: apps/food-waste-backend/src/offers/presenters/offer.presenter.ts
 */
export interface OfferListItem {
  id: string; // Backend uses 'id' not '_id' in DTOs
  title: string;
  type: OfferType;
  image?: string | undefined; // Single image (first image only)
  pricing: {
    originalPrice: number; // Backend provides for strikethrough display
    discountedPrice: number;
    discountPercentage: number;
    currency: Currency;
  };
  availableQuantity: number; // ✅ Backend-computed (totalQuantity - soldQuantity - reservedQuantity)
  availableUntil: Timestamp;
  pickupTimeSlots?: Array<{
    startTime: string; // HH:mm format (e.g., "12:15")
    endTime: string; // HH:mm format (e.g., "13:00")
  }>;
  establishment: {
    name: string;
    averageRating?: number; // 0-5 rating from reviews
    totalReviews?: number; // Number of reviews
    profileImage?: string; // Merchant profile image/logo
    // ✅ PRIVACY: No full address in list view
  };
  distance?: number; // In meters (for geolocation queries)
  ctaState: CtaState; // ✅ Backend-computed UI state (available/low_stock/sold_out)
  status: OfferStatus;
}

/**
 * Establishment Type Enum (must match backend)
 * Backend: apps/food-waste-backend/src/common/enums/establishment.enum.ts
 */
export enum EstablishmentType {
  RESTAURANT = 'restaurant',
  BAKERY = 'bakery',
  GROCERY_STORE = 'grocery_store',
  CAFE = 'cafe',
  FAST_FOOD = 'fast_food',
  SUPERMARKET = 'supermarket',
  HOTEL = 'hotel',
  OTHER = 'other',
}

/**
 * Search/filter parameters for offers
 */
export interface OfferSearchParams {
  page?: number;
  limit?: number;
  status?: OfferStatus;
  type?: OfferType;
  categories?: string[];
  tags?: string[];
  minPrice?: number;
  maxPrice?: number;
  minDiscount?: number;
  establishmentId?: ID;
  isFeatured?: boolean;
  search?: string; // Full-text search

  // ✅ NEW: Establishment filters
  establishmentTypes?: EstablishmentType[];
  cuisineTypes?: string[];
}

/**
 * Paginated offers response
 */
export interface OffersResponse {
  data: OfferListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Single offer response
 */
export interface OfferResponse {
  data: Offer;
  message: string;
}

/**
 * Featured offers response
 */
export interface FeaturedOffersResponse {
  data: OfferListItem[];
  message: string;
}

/**
 * Reserve quantity request (Consumer action)
 */
export interface ReserveQuantityRequest {
  quantity: number;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if an offer is currently active.
 *
 * IMPORTANT: Stored times are treated as "display times" (Tunisia local),
 * NOT actual UTC. We compare using Tunisia local time (Africa/Tunis).
 */
export const isOfferActive = (offer: Offer): boolean => {
  // Get current time in Tunisia timezone
  const nowTunisia = new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' });

  // Stored times are "display times" - extract UTC components as if they're Tunisia local
  // e.g., "2026-01-11T21:55:00.000Z" means 21:55 Tunisia time
  const availableFrom = new Date(offer.availableFrom);
  const availableUntil = new Date(offer.availableUntil);

  // Extract UTC time components (which represent Tunisia display time)
  const fromTime = Date.UTC(
    availableFrom.getUTCFullYear(),
    availableFrom.getUTCMonth(),
    availableFrom.getUTCDate(),
    availableFrom.getUTCHours(),
    availableFrom.getUTCMinutes(),
    availableFrom.getUTCSeconds()
  );
  const untilTime = Date.UTC(
    availableUntil.getUTCFullYear(),
    availableUntil.getUTCMonth(),
    availableUntil.getUTCDate(),
    availableUntil.getUTCHours(),
    availableUntil.getUTCMinutes(),
    availableUntil.getUTCSeconds()
  );

  // Get current Tunisia time as comparable timestamp
  const nowDate = new Date(nowTunisia);
  const nowTime = Date.UTC(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate(),
    nowDate.getHours(),
    nowDate.getMinutes(),
    nowDate.getSeconds()
  );

  return (
    offer.status === OfferStatus.ACTIVE &&
    offer.isActive &&
    !offer.isExpired &&
    !offer.isSoldOut &&
    fromTime <= nowTime &&
    untilTime >= nowTime
  );
};

export const canReserveOffer = (offer: Offer, requestedQuantity: number): boolean => {
  const available = offer.availableQuantity ?? 0;
  return isOfferActive(offer) && available >= requestedQuantity && requestedQuantity > 0;
};

export const getOfferStatusLabel = (status: OfferStatus): string => {
  const labels: Record<OfferStatus, string> = {
    [OfferStatus.DRAFT]: 'Draft',
    [OfferStatus.ACTIVE]: 'Active',
    [OfferStatus.SOLD_OUT]: 'Sold Out',
    [OfferStatus.EXPIRED]: 'Expired',
    [OfferStatus.CANCELLED]: 'Cancelled',
    [OfferStatus.SUSPENDED]: 'Suspended',
  };
  return labels[status];
};

export const getOfferTypeLabel = (type: OfferType): string => {
  const labels: Record<OfferType, string> = {
    [OfferType.SURPRISE_BAG]: 'Surprise Bag',
    [OfferType.SPECIFIC_ITEMS]: 'Specific Items',
    [OfferType.MEAL_DEAL]: 'Meal Deal',
  };
  return labels[type];
};
