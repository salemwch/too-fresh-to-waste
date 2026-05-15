/**
 * Establishment enums — mirrors backend exactly
 * @see apps/food-waste-backend/src/common/enums/establishment.enum.ts
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
