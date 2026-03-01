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
