import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsArray,
  ValidateNested,
  Min,
  Max,
  IsDateString,
  IsOptional,
  IsMongoId,
  Matches,
  ArrayMinSize,
  IsEnum,
  Length,
  IsInt,
  IsNumber,
} from 'class-validator';

import {
  SanitizeObjectId,
  SanitizeText,
  SanitizeNumeric,
  SanitizeEnum,
} from '../../common/decorators/sanitize.decorator';
import {
  IsFutureDate,
  IsWithinDays,
  IsMinQuantity,
  IsNotProfane,
} from '../../common/validators/business-constraints.validator';

import type {
  CreateOrderInput,
  ConfirmPickupInput,
  UpdateOrderStatusInput,
  CancelOrderInput,
  OrderQueryInput,
} from '@foodwaste/shared';

/**
 * Business Logic: Order items with sanitization and quantity constraints
 */
class OrderItemDto {
  @SanitizeObjectId() // SECURITY: Sanitize before validation
  @IsNotEmpty()
  @IsMongoId()
  offerId!: string;

  @Type(() => Number)
  @IsMinQuantity(1) // BUSINESS RULE: Minimum 1 item
  @Max(100, { message: 'Cannot order more than 100 units of a single item' })
  quantity!: number;
}

class PickupTimeSlotDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Start time must be in HH:MM format',
  })
  startTime!: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'End time must be in HH:MM format',
  })
  endTime!: string;
}

class DeliveryCoordinatesDto {
  @IsNotEmpty()
  @IsNumber()
  lat!: number;

  @IsNotEmpty()
  @IsNumber()
  lng!: number;
}

class DeliveryAddressDto {
  @IsNotEmpty()
  @IsString()
  city!: string;

  @ValidateNested()
  @Type(() => DeliveryCoordinatesDto)
  coordinates!: DeliveryCoordinatesDto;
}

/**
 * BUSINESS LOGIC: Order creation with comprehensive validation
 *
 * Key constraints addressed (PRODUCTION_READINESS_AUDIT_REPORT.md:246):
 * - Immediate pickups allowed (no minimum delay)
 * - Maximum booking window (30 days)
 * - Input sanitization for all text fields
 * - Profanity filtering for user-generated content
 */
export class CreateOrderDto implements Omit<CreateOrderInput, 'deliveryMode'> {
  @IsArray()
  @ArrayMinSize(1, { message: 'Order must contain at least one item' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @SanitizeObjectId() // SECURITY: Clean ObjectId before validation
  @IsNotEmpty()
  @IsMongoId()
  establishmentId!: string;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => PickupTimeSlotDto)
  pickupTimeSlot!: PickupTimeSlotDto;

  /**
   * BUSINESS RULE: Pickup date must be:
   * 1. In the future (can be immediate)
   * 2. Within 30 days from now (inventory planning constraint)
   *
   * Rationale: Allows immediate pickups while preventing far-future bookings
   * that complicate inventory management
   */
  @IsDateString({}, { message: 'pickupDate must be a valid ISO 8601 date string' })
  @IsFutureDate(0, { message: 'Pickup time must be in the future' }) // BUSINESS RULE: No minimum delay
  @IsWithinDays(30, { message: 'Cannot book pickup more than 30 days in advance' }) // BUSINESS RULE
  pickupDate!: string;

  /**
   * Customer notes: sanitize to prevent XSS and filter profanity
   */
  @IsOptional()
  @SanitizeText() // SECURITY: HTML entity encoding
  @IsNotProfane() // BUSINESS RULE: Content moderation
  @IsString()
  @Length(0, 500)
  customerNotes?: string | undefined;

  /**
   * Payment method: sanitize enum to prevent injection
   * ✅ BUSINESS RULE: Support cash_on_pickup as primary payment method (MVP)
   */
  @SanitizeEnum([
    'cash_on_pickup',
    'pay_on_delivery',
    'stripe',
    'paypal',
    'apple_pay',
    'google_pay',
  ]) // SECURITY
  @IsNotEmpty()
  @IsString()
  @IsEnum(['cash_on_pickup', 'pay_on_delivery', 'stripe', 'paypal', 'apple_pay', 'google_pay'], {
    message:
      'Payment method must be one of: cash_on_pickup, pay_on_delivery, stripe, paypal, apple_pay, google_pay',
  })
  paymentMethod!: CreateOrderInput['paymentMethod'];

  @IsOptional()
  @SanitizeText() // SECURITY
  @IsString()
  @Length(0, 1000)
  pickupInstructions?: string | undefined;

  /**
   * Delivery mode: 'pickup' (default) or 'delivery' (driver-fulfilled).
   * Determines order routing and fee computation at order creation.
   */
  @IsOptional()
  @IsEnum(['pickup', 'delivery'], {
    message: 'deliveryMode must be pickup or delivery',
  })
  deliveryMode?: 'pickup' | 'delivery';

  /**
   * Required when deliveryMode is 'delivery'.
   * Written once at creation — never mutated after.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  deliveryAddress?: CreateOrderInput['deliveryAddress'];
}

/**
 * Pickup confirmation with sanitized numeric code
 */
export class ConfirmPickupDto implements ConfirmPickupInput {
  @SanitizeNumeric() // SECURITY: Remove non-digit characters
  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  pickupCode!: string;

  @IsOptional()
  @IsString()
  qrCode?: string | undefined;

  @IsOptional()
  @SanitizeText() // SECURITY
  @IsString()
  @Length(0, 500)
  notes?: string | undefined;
}

export class UpdateOrderStatusDto implements UpdateOrderStatusInput {
  @IsNotEmpty()
  @IsEnum(['confirmed', 'ready_for_pickup', 'picked_up', 'cancelled', 'expired'], {
    message: 'Invalid order status',
  })
  status!: UpdateOrderStatusInput['status'];

  @IsOptional()
  @IsString()
  @Length(0, 500)
  reason?: string | undefined;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string | undefined;
}

export class CancelOrderDto implements CancelOrderInput {
  @IsNotEmpty()
  @IsString()
  @Length(5, 500)
  reason!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  additionalNotes?: string | undefined;
}

export class OrderQueryDto implements OrderQueryInput {
  @IsOptional()
  @IsString()
  status?: string | undefined;

  @IsOptional()
  @IsString()
  @IsMongoId()
  establishmentId?: string | undefined;

  @IsOptional()
  @IsString()
  @IsDateString()
  fromDate?: string | undefined;

  @IsOptional()
  @IsString()
  @IsDateString()
  toDate?: string | undefined;

  @IsOptional()
  @IsString()
  search?: string | undefined;

  @IsOptional()
  @IsString()
  sortBy?: string | undefined;

  @IsOptional()
  @IsString()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' | undefined;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number | undefined;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number | undefined;
}
