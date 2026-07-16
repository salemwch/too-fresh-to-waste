/**
 * Order Domain Zod Schemas
 *
 * Converted from backend class-validator DTOs (create-order.dto.ts, order-response.dto.ts).
 * Single source of truth for order validation across backend + mobile.
 *
 * @module shared/schemas/order
 */
import { z } from 'zod';

// ============================================================================
// Constants
// ============================================================================

export const PAYMENT_METHODS = [
  'cash_on_pickup',
  'pay_on_delivery',
  'online',
  'stripe',
  'paypal',
  'apple_pay',
  'google_pay',
] as const;

export const UPDATABLE_ORDER_STATUSES = [
  'confirmed',
  'ready_for_pickup',
  'picked_up',
  'completed',
  'pending_payment',
  'cancelled',
  'expired',
] as const;

/** HH:MM time format regex */
const TIME_FORMAT_REGEX = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

// ============================================================================
// Nested schemas
// ============================================================================

export const OrderItemSchema = z.object({
  offerId: z.string().min(1, 'Offer ID is required'),
  quantity: z
    .number()
    .int()
    .min(1, 'Minimum quantity is 1')
    .max(100, 'Cannot order more than 100 units of a single item'),
});

export const PickupTimeSlotSchema = z.object({
  startTime: z
    .string()
    .min(1, 'Start time is required')
    .regex(TIME_FORMAT_REGEX, 'Start time must be in HH:MM format'),
  endTime: z
    .string()
    .min(1, 'End time is required')
    .regex(TIME_FORMAT_REGEX, 'End time must be in HH:MM format'),
});

export const DeliveryAddressSchema = z.object({
  city: z.string(),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
});

// ============================================================================
// Create Order
// ============================================================================

export const CreateOrderSchema = z
  .object({
    items: z.array(OrderItemSchema).min(1, 'Order must contain at least one item'),
    establishmentId: z.string().min(1, 'Establishment ID is required'),
    pickupTimeSlot: PickupTimeSlotSchema,
    pickupDate: z
      .string()
      .datetime({ message: 'pickupDate must be a valid ISO 8601 date string' })
      .refine(val => new Date(val) > new Date(), { message: 'Pickup time must be in the future' })
      .refine(
        val => {
          const maxDate = new Date();
          maxDate.setDate(maxDate.getDate() + 30);
          return new Date(val) <= maxDate;
        },
        { message: 'Cannot book pickup more than 30 days in advance' },
      ),
    customerNotes: z.string().max(500).optional(),
    paymentMethod: z.enum(PAYMENT_METHODS, {
      message:
        'Payment method must be one of: cash_on_pickup, pay_on_delivery, stripe, paypal, apple_pay, google_pay',
    }),
    pickupInstructions: z.string().max(1000).optional(),
    deliveryMode: z.enum(['pickup', 'delivery']).default('pickup'),
    deliveryAddress: DeliveryAddressSchema.optional(),
  })
  .refine(data => data.deliveryMode !== 'delivery' || data.deliveryAddress !== undefined, {
    message: 'deliveryAddress is required when deliveryMode is delivery',
    path: ['deliveryAddress'],
  });

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

// ============================================================================
// Confirm Pickup
// ============================================================================

export const ConfirmPickupSchema = z.object({
  pickupCode: z.string().length(6, 'Pickup code must be exactly 6 characters'),
  qrCode: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export type ConfirmPickupInput = z.infer<typeof ConfirmPickupSchema>;

// ============================================================================
// Update Order Status
// ============================================================================

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(UPDATABLE_ORDER_STATUSES, {
    message: 'Invalid order status',
  }),
  reason: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
});

export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;

// ============================================================================
// Cancel Order
// ============================================================================

export const CancelOrderSchema = z.object({
  reason: z
    .string()
    .min(5, 'Reason must be at least 5 characters')
    .max(500, 'Reason cannot exceed 500 characters'),
  additionalNotes: z.string().max(500).optional(),
});

export type CancelOrderInput = z.infer<typeof CancelOrderSchema>;

// ============================================================================
// Order Query (list/search)
// ============================================================================

export const OrderQuerySchema = z.object({
  status: z.string().optional(),
  establishmentId: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type OrderQueryInput = z.infer<typeof OrderQuerySchema>;

// ============================================================================
// Response schemas (read-only shapes for type inference)
// ============================================================================

export const OrderItemResponseSchema = z.object({
  offerId: z.string(),
  offerTitle: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  totalPrice: z.number(),
  originalPrice: z.number(),
  discountAmount: z.number(),
});

export const PricingResponseSchema = z.object({
  subtotal: z.number(),
  discountAmount: z.number(),
  taxAmount: z.number(),
  serviceFee: z.number(),
  total: z.number(),
  currency: z.string(),
});

export const PaymentDetailsResponseSchema = z.object({
  method: z.string(),
  amount: z.number(),
  currency: z.string(),
});

export const PopulatedUserResponseSchema = z.object({
  _id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phoneNumber: z.string().optional(),
  avatar: z.string().optional(),
});

export const PopulatedEstablishmentResponseSchema = z.object({
  _id: z.string(),
  name: z.string(),
  address: z.record(z.unknown()).optional(),
  phoneNumber: z.string().optional(),
  type: z.string(),
  images: z.array(z.string()).optional(),
  averageRating: z.number().optional(),
});

export type OrderItemResponse = z.infer<typeof OrderItemResponseSchema>;
export type PricingResponse = z.infer<typeof PricingResponseSchema>;
export type PaymentDetailsResponse = z.infer<typeof PaymentDetailsResponseSchema>;
export type PopulatedUserResponse = z.infer<typeof PopulatedUserResponseSchema>;
export type PopulatedEstablishmentResponse = z.infer<typeof PopulatedEstablishmentResponseSchema>;
