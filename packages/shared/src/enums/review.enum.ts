/**
 * Review enums — single source of truth
 * Source: apps/food-waste-backend/src/reviwes/schemas/reviwe.schema.ts
 */

export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FLAGGED = 'flagged',
  SPAM = 'spam',
  HIDDEN = 'hidden',
}

export enum ReviewType {
  ORDER = 'order',
  ESTABLISHMENT = 'establishment',
  OFFER = 'offer',
}

export enum SentimentType {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  NEUTRAL = 'neutral',
  MIXED = 'mixed',
}
