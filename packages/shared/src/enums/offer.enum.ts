/**
 * Offer-related enums — mirrors backend (source of truth: offer.schema.ts)
 */
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
  PARCELS_BAG = 'parcels_bag',
}

/** CTA (Call-to-Action) state for offer cards — computed by backend */
export enum CtaState {
  AVAILABLE = 'available',
  LOW_STOCK = 'low_stock',
  SOLD_OUT = 'sold_out',
  NOT_STARTED = 'not_started',
}

/** Sort fields for offer search queries */
export enum OfferSortField {
  CREATED_AT = 'createdAt',
  PRICE = 'pricing.discountedPrice',
  DISCOUNT = 'pricing.discountPercentage',
  EXPIRY = 'availableUntil',
}
