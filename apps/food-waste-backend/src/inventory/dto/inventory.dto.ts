import type {
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  StockUpdateInput,
  ReserveStockInput,
  ReleaseStockInput,
  BulkUpdateStockInput,
  InventoryFiltersInput,
  AcknowledgeAlertInput,
} from '@foodwaste/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  IsEnum,
  IsArray,
  IsDateString,
  IsMongoId,
} from 'class-validator';

import { InventoryStatus, StockUpdateReason } from '../schemas/inventory-item.schema';

export class CreateInventoryItemDto implements CreateInventoryItemInput {
  @ApiProperty()
  @IsMongoId()
  offerId!: string;

  @ApiProperty()
  @IsMongoId()
  establishmentId!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string | undefined;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  initialStock!: number;

  @ApiProperty({ required: false, default: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  lowStockThreshold?: number | undefined;

  @ApiProperty()
  @IsDateString()
  expiryDate!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  batchNumber?: string | undefined;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  originalPrice!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  discountedPrice!: number;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[] | undefined;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[] | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  location?: string | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  storageConditions?: string | undefined;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  autoUpdateStatus?: boolean | undefined;
}

export class UpdateInventoryItemDto implements UpdateInventoryItemInput {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentStock?: number | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  lowStockThreshold?: number | undefined;

  @ApiProperty({ enum: InventoryStatus, required: false })
  @IsOptional()
  @IsEnum(InventoryStatus)
  status?: InventoryStatus | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expiryDate?: string | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  batchNumber?: string | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  originalPrice?: number | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountedPrice?: number | undefined;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[] | undefined;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[] | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  autoUpdateStatus?: boolean | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  location?: string | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  storageConditions?: string | undefined;
}

export class StockUpdateDto implements StockUpdateInput {
  @ApiProperty()
  @IsNumber()
  quantity!: number;

  @ApiProperty({ enum: StockUpdateReason })
  @IsEnum(StockUpdateReason)
  reason!: StockUpdateReason;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  orderId?: string | undefined;
}

export class ReserveStockDto implements ReserveStockInput {
  @ApiProperty()
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiProperty()
  @IsMongoId()
  orderId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | undefined;
}

export class ReleaseStockDto implements ReleaseStockInput {
  @ApiProperty()
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiProperty({ enum: StockUpdateReason })
  @IsEnum(StockUpdateReason)
  reason!: StockUpdateReason;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string | undefined;
}

export class BulkUpdateStockDto implements BulkUpdateStockInput {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  inventoryItemIds!: string[];

  @ApiProperty()
  @IsNumber()
  quantity!: number;

  @ApiProperty({ enum: StockUpdateReason })
  @IsEnum(StockUpdateReason)
  reason!: StockUpdateReason;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string | undefined;
}

export class InventoryFiltersDto implements InventoryFiltersInput {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  establishmentId?: string | undefined;

  @ApiProperty({ enum: InventoryStatus, required: false })
  @IsOptional()
  @IsEnum(InventoryStatus)
  status?: InventoryStatus | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  lowStock?: boolean | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  expiringSoon?: boolean | undefined;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  expiringInDays?: number | undefined;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page!: number;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit!: number;

  @ApiProperty({ required: false, default: '-createdAt' })
  @IsOptional()
  @IsString()
  sortBy!: string;
}

export class AcknowledgeAlertDto implements AcknowledgeAlertInput {
  @ApiProperty()
  @IsMongoId()
  alertId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string | undefined;
}
