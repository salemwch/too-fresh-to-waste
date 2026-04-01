/**
 * Payment Domain Zod Schemas
 *
 * Converted from backend class-validator DTOs (create-payment, payment-query).
 *
 * @module shared/schemas/payment
 */
import { z } from 'zod';

import { PaymentGatewayStatus, PaymentGatewayMethod, PaymentCurrency } from '../enums';

// ============================================================================
// Create Payment
// ============================================================================

const CardDetailsSchema = z.object({
  cardNumber: z.string().min(1),
  expiryMonth: z.string().min(1),
  expiryYear: z.string().min(1),
  cvv: z.string().min(1),
  cardholderName: z.string().optional(),
});

export const CreatePaymentSchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().min(0.1).max(10000),
  currency: z.nativeEnum(PaymentCurrency).optional().default(PaymentCurrency.TND),
  paymentMethod: z.nativeEnum(PaymentGatewayMethod),
  cardDetails: CardDetailsSchema,
  description: z.string().optional(),
  returnUrl: z.string().optional(),
  cancelUrl: z.string().optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;

// ============================================================================
// Payment Query
// ============================================================================

export const PaymentQuerySchema = z.object({
  status: z.nativeEnum(PaymentGatewayStatus).optional(),
  after: z.string().optional(),
  limit: z.coerce.number().int().min(1).optional().default(10),
  paymentMethod: z.nativeEnum(PaymentGatewayMethod).optional(),
  customerId: z.string().optional(),
  merchantId: z.string().optional(),
  establishmentId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  minAmount: z.coerce.number().min(0.01).optional(),
  maxAmount: z.coerce.number().min(0.01).optional(),
  search: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type PaymentQueryInput = z.infer<typeof PaymentQuerySchema>;

// ============================================================================
// Sub-exports
// ============================================================================

export { CardDetailsSchema };
