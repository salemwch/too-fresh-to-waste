import { IsOptional, IsEnum, IsString, IsNumber, IsArray, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { OfferType, OfferStatus } from '../schemas/offer.schema';

export class SearchOffersDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(OfferType)
    type?: OfferType;

    @IsOptional()
    @IsEnum(OfferStatus)
    status?: OfferStatus;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    categories?: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(-180)
    @Max(180)
    longitude?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(-90)
    @Max(90)
    latitude?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(100)
    @Max(50000)
    maxDistance?: number;
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    minPrice?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    maxPrice?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(5)
    @Max(90)
    minDiscount?: number;

    @IsOptional()
    @Transform(({ value }) => value === 'true')
    isFeatured?: boolean;

    @IsOptional()
    @Transform(({ value }) => value === 'true')
    availableNow?: boolean;

    @IsOptional()
    @IsString()
    establishmentId?: string;

    @IsOptional()
    @IsString()
    merchantId?: string;

    @IsOptional()
    @IsString()
    sortBy?: 'createdAt' | 'pricing.discountedPrice' | 'pricing.discountPercentage' | 'availableUntil';

    @IsOptional()
    @IsString()
    sortOrder?: 'asc' | 'desc';
}