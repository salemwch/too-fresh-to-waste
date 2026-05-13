/**
 * Order-related enums — mirrors backend (source of truth: order.schema.ts)
 */
export enum OrderStatus {
  PENDING = 'pending',
  RESERVED = 'reserved',
  CONFIRMED = 'confirmed',
  READY_FOR_PICKUP = 'ready_for_pickup',
  PICKED_UP = 'picked_up',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  REFUNDED = 'refunded',
}

/**
 * Order-level payment status (what frontends display).
 * Mirrors backend order.schema.ts PaymentStatus.
 * For internal payment reconciliation states (PROCESSING, EARNED, DISPUTED etc.)
 * see apps/food-waste-backend/src/payments/schemas/payment.schema.ts
 */
export enum PaymentStatus {
  PENDING = 'pending',
  HELD = 'held',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  ONLINE = 'online',
}
