/**
 * Donation enums — single source of truth
 * Source: apps/food-waste-backend/src/donations/schemas/donation-pool.schema.ts
 */

export enum DonationPoolStatus {
  ACTIVE = 'active',
  FUNDED = 'funded',
  DISTRIBUTED = 'distributed',
  ARCHIVED = 'archived',
}
