/**
 * Establishment enums — mirrors backend exactly
 * @see apps/food-waste-backend/src/common/enums/establishment.enum.ts
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

export enum EstablishmentStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  REJECTED = 'rejected',
  INACTIVE = 'inactive',
}

export enum DocumentType {
  BUSINESS_LICENSE = 'business_license',
  FOOD_SAFETY_LICENSE = 'food_safety_license',
  INSURANCE_DOCUMENT = 'insurance_document',
  TAX_CERTIFICATE = 'tax_certificate',
  OWNER_ID_DOCUMENT = 'owner_id_document',
  ADDITIONAL = 'additional',
}
