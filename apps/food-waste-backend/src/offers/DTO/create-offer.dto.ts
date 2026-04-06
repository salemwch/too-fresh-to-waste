import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform, type TransformFnParams } from 'class-transformer';
import {
  IsString,
  IsEnum,
  IsNumber,
  IsArray,
  IsOptional,
  IsBoolean,
  IsDateString,
  ValidateNested,
  Min,
  Max,
  MinLength,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';

import type { CreateOfferInput } from '@foodwaste/shared';

import { OfferType } from '../schemas/offer.schema';

function getTransformValue(params: TransformFnParams): unknown {
  return params.value as unknown;
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function trimMultipartStringValue(params: TransformFnParams): unknown {
  const value = getTransformValue(params);

  if (isUnknownArray(value)) {
    const [firstValue] = value;
    return typeof firstValue === 'string' ? firstValue.trim() : firstValue;
  }

  return typeof value === 'string' ? value.trim() : value;
}

function parseFloatValue(params: TransformFnParams): unknown {
  const value = getTransformValue(params);
  return typeof value === 'string' ? Number.parseFloat(value) : value;
}

function parseIntegerValue(params: TransformFnParams): unknown {
  const value = getTransformValue(params);
  return typeof value === 'string' ? Number.parseInt(value, 10) : value;
}

function getRawObjectValue(params: TransformFnParams): unknown {
  const source = params.obj as Record<string, unknown> | null | undefined;
  const key = params.key;

  if (source === null || source === undefined || typeof key !== 'string') {
    return undefined;
  }

  return source[key];
}

function parseBooleanValue(params: TransformFnParams): boolean {
  const rawValue = getRawObjectValue(params) ?? getTransformValue(params);

  if (typeof rawValue === 'boolean') {
    return rawValue;
  }

  if (isUnknownArray(rawValue)) {
    const [firstValue] = rawValue;

    if (typeof firstValue === 'string') {
      return firstValue === 'true' || firstValue === '1';
    }

    return Boolean(firstValue);
  }

  if (typeof rawValue === 'string') {
    return rawValue === 'true' || rawValue === '1';
  }

  return Boolean(rawValue);
}

class PriceInfoDto {
  @IsNumber()
  @Min(0.01)
  @Transform(parseFloatValue)
  originalPrice!: number;

  @IsNumber()
  @Min(0.01)
  @Transform(parseFloatValue)
  discountedPrice!: number;

  // SECURITY: discountPercentage is backend-calculated.
  // SECURITY: Currency is system-enforced (TND).
}

class PickupTimeSlotDto {
  @IsString()
  @Transform(trimMultipartStringValue)
  startTime!: string;

  @IsString()
  @Transform(trimMultipartStringValue)
  endTime!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(parseIntegerValue)
  maxOrders?: number | undefined;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(parseIntegerValue)
  currentOrders?: number | undefined;
}

class NutritionalInfoDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(parseFloatValue)
  calories?: number | undefined;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(parseFloatValue)
  protein?: number | undefined;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(parseFloatValue)
  carbs?: number | undefined;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(parseFloatValue)
  fat?: number | undefined;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergens?: string[] | undefined;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dietaryInfo?: string[] | undefined;
}

class RecurringDaysDto {
  @IsBoolean()
  monday!: boolean;

  @IsBoolean()
  tuesday!: boolean;

  @IsBoolean()
  wednesday!: boolean;

  @IsBoolean()
  thursday!: boolean;

  @IsBoolean()
  friday!: boolean;

  @IsBoolean()
  saturday!: boolean;

  @IsBoolean()
  sunday!: boolean;
}

export class CreateOfferDto implements CreateOfferInput {
  @IsString()
  @MinLength(5)
  @MaxLength(100)
  @Transform(trimMultipartStringValue)
  title!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(1000)
  @Transform(trimMultipartStringValue)
  description!: string;

  @IsString()
  establishmentId!: string;

  @IsEnum(OfferType)
  type!: OfferType;

  @ValidateNested()
  @Type(() => PriceInfoDto)
  pricing!: PriceInfoDto;

  @IsNumber()
  @Min(1)
  @Max(1000)
  @Transform(parseIntegerValue)
  totalQuantity!: number;

  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Food offer images (up to 5 images, JPEG/PNG/WebP, max 5MB each)',
    required: false,
    maxItems: 5,
    example: ['image1.jpg', 'image2.jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[] | undefined;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @IsOptional()
  categories?: string[] | undefined;

  @IsOptional()
  @ValidateNested()
  @Type(() => NutritionalInfoDto)
  nutritionalInfo?: NutritionalInfoDto | undefined;

  @IsDateString()
  availableFrom!: string;

  @IsDateString()
  availableUntil!: string;

  @ValidateNested({ each: true })
  @Type(() => PickupTimeSlotDto)
  @ArrayMinSize(1)
  pickupTimeSlots!: PickupTimeSlotDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[] | undefined;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  estimatedWeight?: string | undefined;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean | undefined;

  @IsOptional()
  @ValidateNested()
  @Type(() => RecurringDaysDto)
  recurringDays?: RecurringDaysDto | undefined;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialInstructions?: string | undefined;

  @IsOptional()
  @IsDateString()
  cancellationDeadline?: string | undefined;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description:
      'IANA timezone (e.g., "Africa/Tunis", "Europe/Paris"). If not provided, defaults to Africa/Tunis.',
    example: 'Africa/Tunis',
    required: false,
    default: 'Africa/Tunis',
  })
  timezone: string = 'Africa/Tunis';

  @IsOptional()
  @IsBoolean()
  @Transform(parseBooleanValue)
  @ApiProperty({
    description: 'Show offer in "Pickup Today" section on mobile app',
    example: false,
    required: false,
    default: false,
  })
  isPickupToday?: boolean | undefined;

  @IsOptional()
  @IsBoolean()
  @Transform(parseBooleanValue)
  @ApiProperty({
    description: 'Show offer in "Pickup Tomorrow" section on mobile app',
    example: false,
    required: false,
    default: false,
  })
  isPickupTomorrow?: boolean | undefined;
}
