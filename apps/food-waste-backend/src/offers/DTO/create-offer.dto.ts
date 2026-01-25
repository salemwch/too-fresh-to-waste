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
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { OfferType } from '../schemas/offer.schema';

class PriceInfoDto {
    @IsNumber()
    @Min(0.01)
    @Transform(({ value }) => {
        // ✅ FIX: Convert string to number for multipart/form-data
        if (typeof value === 'string') return parseFloat(value);
        return value;
    })
    originalPrice: number;

    @IsNumber()
    @Min(0.01)
    @Transform(({ value }) => {
        // ✅ FIX: Convert string to number for multipart/form-data
        if (typeof value === 'string') return parseFloat(value);
        return value;
    })
    discountedPrice: number;

    // ✅ SECURITY: discountPercentage is backend-calculated - removed from user input
    // Backend calculates and validates this in offers.service.ts
    // ✅ SECURITY: Currency is system-enforced (TND) - removed from user input
    // Backend automatically sets this in offers.service.ts
}

class PickupTimeSlotDto {
    @IsString()
    @Transform(({ value }) => {
        // ✅ FIX: Handle arrays from multipart/form-data (e.g., ["10:00"] → "10:00")
        if (Array.isArray(value)) {return value[0]?.trim?.() || value[0];}
        return typeof value === 'string' ? value.trim() : value;
    })
    startTime: string;

    @IsString()
    @Transform(({ value }) => {
        // ✅ FIX: Handle arrays from multipart/form-data (e.g., ["23:46"] → "23:46")
        if (Array.isArray(value)) {return value[0]?.trim?.() || value[0];}
        return typeof value === 'string' ? value.trim() : value;
    })
    endTime: string;

    @IsNumber()
    @Min(1)
    @Max(100)
    @Transform(({ value }) => {
        // ✅ FIX: Convert string to number for multipart/form-data
        if (typeof value === 'string') return parseInt(value, 10);
        return value;
    })
    maxOrders: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Transform(({ value }) => {
        // ✅ FIX: Convert string to number for multipart/form-data
        if (typeof value === 'string') return parseInt(value, 10);
        return value;
    })
    currentOrders?: number = 0;
}

class NutritionalInfoDto {
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Transform(({ value }) => {
        // ✅ FIX: Convert string to number for multipart/form-data
        if (typeof value === 'string') return parseFloat(value);
        return value;
    })
    calories?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Transform(({ value }) => {
        // ✅ FIX: Convert string to number for multipart/form-data
        if (typeof value === 'string') return parseFloat(value);
        return value;
    })
    protein?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Transform(({ value }) => {
        // ✅ FIX: Convert string to number for multipart/form-data
        if (typeof value === 'string') return parseFloat(value);
        return value;
    })
    carbs?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Transform(({ value }) => {
        // ✅ FIX: Convert string to number for multipart/form-data
        if (typeof value === 'string') return parseFloat(value);
        return value;
    })
    fat?: number;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    allergens?: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    dietaryInfo?: string[];
}

class RecurringDaysDto {
    @IsBoolean()
    monday: boolean;

    @IsBoolean()
    tuesday: boolean;

    @IsBoolean()
    wednesday: boolean;

    @IsBoolean()
    thursday: boolean;

    @IsBoolean()
    friday: boolean;

    @IsBoolean()
    saturday: boolean;

    @IsBoolean()
    sunday: boolean;
}

export class CreateOfferDto {
    @IsString()
    @MinLength(5)
    @MaxLength(100)
    @Transform(({ value }) => {
        // ✅ FIX: Handle arrays from multipart/form-data
        if (Array.isArray(value)) {return value[0]?.trim?.() || value[0];}
        return typeof value === 'string' ? value.trim() : value;
    })
    title: string;

    @IsString()
    @MinLength(20)
    @MaxLength(1000)
    @Transform(({ value }) => {
        // ✅ FIX: Handle arrays from multipart/form-data
        if (Array.isArray(value)) {return value[0]?.trim?.() || value[0];}
        return typeof value === 'string' ? value.trim() : value;
    })
    description: string;

    @IsString()
    establishmentId: string;

    @IsEnum(OfferType)
    type: OfferType;

    @ValidateNested()
    @Type(() => PriceInfoDto)
    pricing: PriceInfoDto;

    @IsNumber()
    @Min(1)
    @Max(1000)
    @Transform(({ value }) => {
        // ✅ FIX: Convert string to number for multipart/form-data
        if (typeof value === 'string') return parseInt(value, 10);
        return value;
    })
    totalQuantity: number;

    @ApiProperty({
        type: 'array',
        items: { type: 'string', format: 'binary' },
        description: 'Food offer images (up to 5 images, JPEG/PNG/WebP, max 5MB each)',
        required: false,
        maxItems: 5,
        example: ['image1.jpg', 'image2.jpg']
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    images?: string[];

    @IsArray()
    @IsString({ each: true })
    @ArrayMinSize(1)
    @IsOptional()
    categories?: string[];

    @IsOptional()
    @ValidateNested()
    @Type(() => NutritionalInfoDto)
    nutritionalInfo?: NutritionalInfoDto;

    @IsDateString()
    availableFrom: string;

    @IsDateString()
    availableUntil: string;

    @ValidateNested({ each: true })
    @Type(() => PickupTimeSlotDto)
    @ArrayMinSize(1)
    pickupTimeSlots: PickupTimeSlotDto[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];

    @IsOptional()
    @IsString()
    @MaxLength(50)
    estimatedWeight?: string;

    @IsOptional()
    @IsBoolean()
    isRecurring?: boolean;

    @IsOptional()
    @ValidateNested()
    @Type(() => RecurringDaysDto)
    recurringDays?: RecurringDaysDto;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    specialInstructions?: string;

    @IsOptional()
    @IsDateString()
    cancellationDeadline?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({
        description: 'IANA timezone (e.g., "Africa/Tunis", "Europe/Paris"). If not provided, defaults to Africa/Tunis.',
        example: 'Africa/Tunis',
        required: false,
        default: 'Africa/Tunis'
    })
    timezone?: string = 'Africa/Tunis';

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        // ✅ FIX: Handle arrays from multipart/form-data
        if (Array.isArray(value)) {
            const val = value[0];
            if (typeof val === 'string') return val === 'true' || val === '1';
            return Boolean(val);
        }
        // ✅ FIX: Convert string to boolean
        if (typeof value === 'string') {
            return value === 'true' || value === '1';
        }
        // ✅ Already boolean or undefined
        return value !== undefined ? Boolean(value) : false;
    })
    @ApiProperty({
        description: 'Show offer in "Pickup Today" section on mobile app',
        example: false,
        required: false,
        default: false
    })
    isPickupToday?: boolean = false;

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        // ✅ FIX: Handle arrays from multipart/form-data
        if (Array.isArray(value)) {
            const val = value[0];
            if (typeof val === 'string') return val === 'true' || val === '1';
            return Boolean(val);
        }
        // ✅ FIX: Convert string to boolean
        if (typeof value === 'string') {
            return value === 'true' || value === '1';
        }
        // ✅ Already boolean or undefined
        return value !== undefined ? Boolean(value) : false;
    })
    @ApiProperty({
        description: 'Show offer in "Pickup Tomorrow" section on mobile app',
        example: false,
        required: false,
        default: false
    })
    isPickupTomorrow?: boolean = false;
}