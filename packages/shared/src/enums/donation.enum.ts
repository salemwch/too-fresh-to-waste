/**
 * Donation enums — single source of truth
 * Source: apps/food-waste-backend/src/donations/schemas/donation-pool.schema.ts
 */

export enum DonationPoolStatus {
  ACTIVE = 'active',
  FUNDED = 'funded',
  DISTRIBUTED = 'distributed',
  ARCHIVED = 'archived',
  SEASON_COMPLETE = 'season_complete',
}

/** Fixed categories for the donation pool goal system. Admin selects from this list only. */
export enum DonationGoalCategory {
  TSHIRTS = 'TSHIRTS',
  PANTS = 'PANTS',
  SHOES = 'SHOES',
  CHILDREN_STUDIES = 'CHILDREN_STUDIES',
  MEDICINE = 'MEDICINE',
}
