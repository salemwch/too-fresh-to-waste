/**
 * Voting enums — single source of truth
 * Used by voting feature across backend, mobile, and web
 */

export enum CycleStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  BALLOT_OPEN = 'BALLOT_OPEN',
  TALLYING = 'TALLYING',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  ARCHIVED = 'ARCHIVED',
}

export enum PrizeCategory {
  PHONE = 'PHONE',
  HOTEL_STAY = 'HOTEL_STAY',
  SHOPPING_VOUCHER = 'SHOPPING_VOUCHER',
  GYM_MEMBERSHIP = 'GYM_MEMBERSHIP',
  ELECTRIC_SCOOTER = 'ELECTRIC_SCOOTER',
  CUSTOM = 'CUSTOM',
}
