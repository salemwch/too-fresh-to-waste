import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsBoolean,
  IsNumber,
  ValidateNested,
  ArrayMinSize,
  Min,
  Max,
  IsString,
  IsObject,
} from 'class-validator';

import type { ReactivateOfferInput } from '@foodwaste/shared';

function getFirstTransformValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function trimTransformValue(value: unknown): unknown {
  const firstValue = getFirstTransformValue(value);
  return typeof firstValue === 'string' ? firstValue.trim() : firstValue;
}

function parseIntegerTransformValue(value: unknown): unknown {
  const firstValue = getFirstTransformValue(value);
  return typeof firstValue === 'string' ? Number.parseInt(firstValue, 10) : firstValue;
}

class ReactivatePickupTimeSlotDto {
  @IsString()
  @Transform(({ value }) => trimTransformValue(value))
  startTime!: string;

  @IsString()
  @Transform(({ value }) => trimTransformValue(value))
  endTime!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseIntegerTransformValue(value))
  maxOrders?: number | undefined;
}

class ReactivatePricingDto {
  @IsNumber()
  @Min(0.01)
  @Transform(({ value }) => (typeof value === 'string' ? parseFloat(value) : value))
  originalPrice!: number;

  @IsNumber()
  @Min(0.01)
  @Transform(({ value }) => (typeof value === 'string' ? parseFloat(value) : value))
  discountedPrice!: number;
}

export class ReactivateOfferDto implements ReactivateOfferInput {
  @IsDateString()
  @ApiProperty({
    description: 'New availability start date (ISO 8601)',
    example: '2026-02-11T08:00:00.000Z',
  })
  availableFrom!: string;

  @IsDateString()
  @ApiProperty({
    description: 'New availability end date (ISO 8601)',
    example: '2026-02-11T20:00:00.000Z',
  })
  availableUntil!: string;

  @ValidateNested({ each: true })
  @Type(() => ReactivatePickupTimeSlotDto)
  @ArrayMinSize(1)
  @ApiProperty({
    description: 'New pickup time slots',
    type: [ReactivatePickupTimeSlotDto],
  })
  pickupTimeSlots!: ReactivatePickupTimeSlotDto[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  @Transform(({ value }) => parseIntegerTransformValue(value))
  @ApiProperty({
    description: 'New total quantity (optional, keeps original if not provided)',
    example: 10,
    required: false,
  })
  totalQuantity?: number | undefined;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'IANA timezone (e.g., "Africa/Tunis")',
    example: 'Africa/Tunis',
    required: false,
    default: 'Africa/Tunis',
  })
  timezone: string = 'Africa/Tunis';

  @IsOptional()
  @IsBoolean()
  @ApiProperty({
    description: 'True if the merchant scheduled this offer for today',
    required: false,
    default: false,
  })
  isPickupToday: boolean = false;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({
    description: 'True if the merchant scheduled this offer for tomorrow',
    required: false,
    default: false,
  })
  isPickupTomorrow: boolean = false;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ReactivatePricingDto)
  @ApiProperty({
    description: 'Updated pricing (optional — keeps original pricing if not provided)',
    required: false,
    example: { originalPrice: 25, discountedPrice: 9 },
  })
  pricing?: ReactivatePricingDto | undefined;
}
