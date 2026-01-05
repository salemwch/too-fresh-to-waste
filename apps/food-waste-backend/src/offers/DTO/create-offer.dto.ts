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
    originalPrice: number;

    @IsNumber()
    @Min(0.01)
    discountedPrice: number;

    @IsNumber()
    @Min(5)
    @Max(90)
    discountPercentage: number;

    @IsOptional()
    @IsString()
    currency?: string = 'EUR';
}

class PickupTimeSlotDto {
    @IsString()
    @Transform(({ value }) => value?.trim())
    startTime: string;

    @IsString()
    @Transform(({ value }) => value?.trim())
    endTime: string;

    @IsNumber()
    @Min(1)
    @Max(100)
    maxOrders: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    currentOrders?: number = 0;
}

class NutritionalInfoDto {
    @IsOptional()
    @IsNumber()
    @Min(0)
    calories?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    protein?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    carbs?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
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
    @Transform(({ value }) => value?.trim())
    title: string;

    @IsString()
    @MinLength(20)
    @MaxLength(1000)
    @Transform(({ value }) => value?.trim())
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
}