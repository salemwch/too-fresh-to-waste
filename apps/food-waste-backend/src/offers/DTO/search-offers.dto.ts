import { EstablishmentType } from '@foodwaste/shared';
import { Type, Transform } from 'class-transformer';
import { IsOptional, IsEnum, IsString, IsNumber, IsArray, IsInt, Min, Max } from 'class-validator';

import { OfferType, OfferStatus } from '../schemas/offer.schema';

export enum OfferSortField {
  CREATED_AT = 'createdAt',
  PRICE = 'pricing.discountedPrice',
  DISCOUNT = 'pricing.discountPercentage',
  EXPIRY = 'availableUntil',
}

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
  @IsArray()
  @IsEnum(EstablishmentType, { each: true })
  establishmentTypes?: EstablishmentType[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cuisineTypes?: string[];

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
  @Min(50)
  @Max(90)
  minDiscount?: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : value === 'true'))
  isFeatured?: boolean;

  // ✅ SECURITY: availableNow removed - backend always enforces time-based filtering
  // Frontend should never control what "now" means

  @IsOptional()
  @IsString()
  establishmentId?: string;

  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  @IsEnum(OfferSortField)
  sortBy?: OfferSortField;

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  // ✅ PAGINATION: Expose pagination controls to clients
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
