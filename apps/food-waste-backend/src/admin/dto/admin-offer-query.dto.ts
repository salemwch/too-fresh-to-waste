import { OfferStatus, OfferType } from '@foodwaste/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ArrayMaxSize,
  IsMongoId,
  IsBoolean,
} from 'class-validator';

export class AdminOfferQueryDto {
  @ApiPropertyOptional({ enum: OfferStatus })
  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;

  @ApiPropertyOptional({ enum: OfferType })
  @IsOptional()
  @IsEnum(OfferType)
  type?: OfferType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  establishmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  merchantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by featured status (manual or auto)' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  minDiscount?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  maxDiscount?: number;

  @ApiPropertyOptional({ description: 'ISO date string — filter offers created after this date' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'ISO date string — filter offers created before this date' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class AdminOfferDeletedQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  deletedBy?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export type BulkOfferAction = 'disable' | 'enable' | 'feature' | 'unfeature' | 'delete';

export class BulkOfferActionDto {
  @ApiProperty({
    enum: ['disable', 'enable', 'feature', 'unfeature', 'delete'],
    description: 'Action to perform on all selected offers',
  })
  @IsIn(['disable', 'enable', 'feature', 'unfeature', 'delete'])
  action!: BulkOfferAction;

  @ApiProperty({ type: [String], description: 'Array of offer IDs (max 100)' })
  @IsArray()
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  offerIds!: string[];

  @ApiPropertyOptional({ description: 'Reason for this action (required for delete)' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class LowPickupRateQueryDto {
  @ApiPropertyOptional({
    default: 0.2,
    minimum: 0,
    maximum: 1,
    description: 'Pickup rate threshold (0.2 = 20%). Offers below this are returned.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number = 0.2;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class PriceViolationQueryDto {
  @ApiPropertyOptional({
    default: 30,
    minimum: 0,
    maximum: 100,
    description: 'Minimum discount percentage required. Offers below this are returned.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  minDiscount?: number = 30;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class ExportOffersQueryDto extends AdminOfferQueryDto {
  @ApiPropertyOptional({ enum: ['csv', 'json'], default: 'json' })
  @IsOptional()
  @IsIn(['csv', 'json'])
  format?: 'csv' | 'json' = 'json';
}
