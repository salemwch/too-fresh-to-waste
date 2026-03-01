/**
 * Offer Types
 *
 * Type definitions for food waste offers matching backend schema
 * Backend schema: apps/food-waste-backend/src/offers/schemas/offer.schema.ts
 */

import type { ID, Timestamp, Currency } from '@/types';

// ============================================================================
// Enums — single source of truth from shared package
// ============================================================================
export { OfferStatus, OfferType } from '@foodwaste/shared';
import { OfferStatus, OfferType } from '@foodwaste/shared';

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
  maxOrders?: number; // Optional — business decides. No limit if unset.
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
  establishmentId:
  | ID
  | {
    _id?: ID;
    id?: ID;
    name: string;
    address?: any;
    type?: string;
    averageRating?: number;
    totalReviews?: number;
  };
  // Can be either ID string or populated object
  merchantId:
  | ID
  | {
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
  isFavorite?: boolean; // ✅ Backend-computed (only present when user is authenticated)
}

// EstablishmentType — re-exported from shared package (single source of truth)
export { EstablishmentType } from '@foodwaste/shared';
import { EstablishmentType } from '@foodwaste/shared';

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

  // ✅ NEW: Geolocation filter (in meters, backend default: 5000m)
  maxDistance?: number;
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
 * ✅ FIX: Direct UTC comparison (times are already stored in UTC format)
 */
export const isOfferActive = (offer: Offer): boolean => {
  const now = new Date();
  const fromTime = new Date(offer.availableFrom);
  const untilTime = new Date(offer.availableUntil);

  return (
    offer.status === OfferStatus.ACTIVE &&
    offer.isActive &&
    !offer.isExpired &&
    !offer.isSoldOut &&
    now >= fromTime &&
    now <= untilTime
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
    [OfferType.PARCELS_BAG]: 'Parcels Bag',
  };
  return labels[type];
};
