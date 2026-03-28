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

/**
 * Business Logic: Order items with sanitization and quantity constraints
 */
export class OrderItemDto {
  @SanitizeObjectId() // SECURITY: Sanitize before validation
  @IsNotEmpty()
  @IsMongoId()
  offerId!: string;

  @Type(() => Number)
  @IsMinQuantity(1) // BUSINESS RULE: Minimum 1 item
  @Max(100, { message: 'Cannot order more than 100 units of a single item' })
  quantity!: number;
}

export class PickupTimeSlotDto {
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

/**
 * BUSINESS LOGIC: Order creation with comprehensive validation
 *
 * Key constraints addressed (PRODUCTION_READINESS_AUDIT_REPORT.md:246):
 * - Immediate pickups allowed (no minimum delay)
 * - Maximum booking window (30 days)
 * - Input sanitization for all text fields
 * - Profanity filtering for user-generated content
 */
export class CreateOrderDto {
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
  customerNotes?: string;

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
  paymentMethod!: string;

  @IsOptional()
  @SanitizeText() // SECURITY
  @IsString()
  @Length(0, 1000)
  pickupInstructions?: string;
}

/**
 * Pickup confirmation with sanitized numeric code
 */
export class ConfirmPickupDto {
  @SanitizeNumeric() // SECURITY: Remove non-digit characters
  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  pickupCode!: string;

  @IsOptional()
  @IsString()
  qrCode?: string;

  @IsOptional()
  @SanitizeText() // SECURITY
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class UpdateOrderStatusDto {
  @IsNotEmpty()
  @IsEnum(['confirmed', 'ready_for_pickup', 'picked_up', 'cancelled', 'expired'], {
    message: 'Invalid order status',
  })
  status!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  reason?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class CancelOrderDto {
  @IsNotEmpty()
  @IsString()
  @Length(5, 500)
  reason!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  additionalNotes?: string;
}

export class OrderQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  @IsMongoId()
  establishmentId?: string;

  @IsOptional()
  @IsString()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}
