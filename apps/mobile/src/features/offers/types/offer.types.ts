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
 */
export interface Offer {
  _id: ID;
  title: string;
  description: string;
  establishmentId: ID;
  merchantId: ID;
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
 * Offer list item (simplified for list views)
 */
export interface OfferListItem {
  _id: ID;
  title: string;
  type: OfferType;
  images: string[];
  pricing: PriceInfo;
  totalQuantity: number;
  soldQuantity: number;
  reservedQuantity: number;
  availableFrom: Timestamp;
  availableUntil: Timestamp;
  establishmentId: ID;
  establishmentName?: string;
  establishmentAddress?: unknown;
  status: OfferStatus;
  distance?: number; // In meters (for nearby searches)
  merchantFirstName?: string;
  merchantLastName?: string;
  createdAt: Timestamp;
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
  minPrice?: number;
  maxPrice?: number;
  minDiscount?: number;
  establishmentId?: ID;
  isFeatured?: boolean;
  search?: string; // Full-text search
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
 * Create offer payload (for merchants)
 */
export interface CreateOfferPayload {
  title: string;
  description: string;
  establishmentId: ID;
  type: OfferType;
  pricing: {
    originalPrice: number;
    discountedPrice: number;
    discountPercentage: number;
    currency: Currency;
  };
  totalQuantity: number;
  images?: string[];
  categories?: string[];
  tags?: string[];
  nutritionalInfo?: NutritionalInfo;
  availableFrom: string;
  availableUntil: string;
  pickupTimeSlots: PickupTimeSlot[];
  estimatedWeight?: string;
  isRecurring?: boolean;
  recurringDays?: RecurringDays;
  specialInstructions?: string;
}

/**
 * Update offer payload
 */
export type UpdateOfferPayload = Partial<CreateOfferPayload>;

/**
 * Reserve quantity request
 */
export interface ReserveQuantityRequest {
  quantity: number;
}

/**
 * Update status request
 */
export interface UpdateStatusRequest {
  status: OfferStatus;
}

// ============================================================================
// Type Guards
// ============================================================================

export const isOfferActive = (offer: Offer): boolean => {
  return (
    offer.status === OfferStatus.ACTIVE &&
    offer.isActive &&
    !offer.isExpired &&
    !offer.isSoldOut &&
    new Date(offer.availableFrom) <= new Date() &&
    new Date(offer.availableUntil) >= new Date()
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
