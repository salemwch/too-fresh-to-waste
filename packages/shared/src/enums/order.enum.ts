/**
 * Order-related enums — mirrors backend (source of truth: order.schema.ts)
 */
/**
 * Order lifecycle.
 *
 * Pickup mode:   PENDING → RESERVED → CONFIRMED → READY_FOR_PICKUP → PICKED_UP
 * Delivery mode: PENDING → CONFIRMED → DRIVER_ASSIGNED → OUT_FOR_DELIVERY → DELIVERED
 *
 * In delivery mode DRIVER_ASSIGNED means a driver accepted but has not collected
 * the food yet; OUT_FOR_DELIVERY means the food is with the driver, en route to
 * the customer. PICKED_UP is the consumer collecting in person and never occurs
 * in delivery mode.
 */
export enum OrderStatus {
  PENDING = 'pending',
  PENDING_PAYMENT = 'pending_payment',
  RESERVED = 'reserved',
  CONFIRMED = 'confirmed',
  READY_FOR_PICKUP = 'ready_for_pickup',
  PICKED_UP = 'picked_up',
  COMPLETED = 'completed',
  DRIVER_ASSIGNED = 'driver_assigned',
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
  REFUND_PENDING = 'refund_pending',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  ONLINE = 'online',
}
