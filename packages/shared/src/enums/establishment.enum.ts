/**
 * Establishment enums.
 *
 * **This file is the single source of truth**, not a mirror. The backend, web
 * and mobile all import `EstablishmentType` from `@foodwaste/shared` — the
 * backend has no enum of its own (an older header here pointed at
 * `apps/food-waste-backend/src/common/enums/establishment.enum.ts`, which does
 * not exist). Add a member here and rebuild the package; there is nowhere else
 * to keep in step.
 *
 * **Never remove a member.** These values are persisted on establishment
 * documents. Dropping one orphans every merchant already registered under it.
 * To retire a type, stop offering it in the pickers (web merchant signup, the
 * mobile category rail) and leave the enum member in place so stored documents
 * still deserialise.
 */
export enum EstablishmentType {
  RESTAURANT = 'restaurant',
  BAKERY = 'bakery',
  PASTRY_SHOP = 'pastry_shop',
  CAFE = 'cafe',
  FAST_FOOD = 'fast_food',
  BUFFET_RESTAURANT = 'buffet_restaurant',
  SUSHI_RESTAURANT = 'sushi_restaurant',
  TAKEAWAY = 'takeaway',
  GROCERY_STORE = 'grocery_store',
  SUPERMARKET = 'supermarket',
  FRUIT_VEGETABLES = 'fruit_vegetables',
  BUTCHER_SHOP = 'butcher_shop',
  BEVERAGE_SHOP = 'beverage_shop',
  PET_STORE = 'pet_store',
  FLOWER_PLANT = 'flower_plant',
  HOTEL = 'hotel',
  /** Grossiste — bulk supplier selling to businesses and in large quantities. */
  WHOLESALER = 'wholesaler',
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
