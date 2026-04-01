/**
 * Payment gateway enums — single source of truth
 * Source: apps/food-waste-backend/src/payments/schemas/payment.schema.ts
 *
 * Note: These are PAYMENT GATEWAY enums (Visa, Mastercard, etc.)
 * The order-level PaymentMethod/PaymentStatus are in order.enum.ts
 */

export enum PaymentGatewayStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  HELD = 'held',
  EARNED = 'earned',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
  EXPIRED = 'expired',
  DISPUTED = 'disputed',
}

export enum PaymentGatewayMethod {
  VISA = 'visa',
  MASTERCARD = 'mastercard',
  EDAHABIA = 'edahabia',
  LOCAL_BANK_CARD = 'local_bank_card',
  MOBILE_PAYMENT = 'mobile_payment',
}

export enum PaymentCurrency {
  TND = 'TND',
  EUR = 'EUR',
  USD = 'USD',
}
