import { EstablishmentType, OfferSortField } from '@foodwaste/shared';
import type { SearchOffersInput } from '@foodwaste/shared';
import { Type, Transform } from 'class-transformer';
import { IsOptional, IsEnum, IsString, IsNumber, IsArray, IsInt, Min, Max } from 'class-validator';

import { OfferType, OfferStatus } from '../schemas/offer.schema';

export { OfferSortField };

export class SearchOffersDto implements SearchOffersInput {
  @IsOptional()
  @IsString()
  search?: string | undefined;

  @IsOptional()
  @IsEnum(OfferType)
  type?: OfferType | undefined;

  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus | undefined;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[] | undefined;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[] | undefined;

  @IsOptional()
  @IsArray()
  @IsEnum(EstablishmentType, { each: true })
  establishmentTypes?: EstablishmentType[] | undefined;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cuisineTypes?: string[] | undefined;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | undefined;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | undefined;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(100)
  @Max(50000)
  maxDistance?: number | undefined;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number | undefined;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number | undefined;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(50)
  @Max(90)
  minDiscount?: number | undefined;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : value === 'true'))
  isFeatured?: boolean | undefined;

  // ✅ SECURITY: availableNow removed - backend always enforces time-based filtering
  // Frontend should never control what "now" means

  @IsOptional()
  @IsString()
  establishmentId?: string | undefined;

  @IsOptional()
  @IsString()
  merchantId?: string | undefined;

  @IsOptional()
  @IsEnum(OfferSortField)
  sortBy?: OfferSortField | undefined;

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' | undefined;

  // ✅ PAGINATION: Expose pagination controls to clients
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
