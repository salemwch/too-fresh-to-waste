import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min, Max, IsBoolean, IsEnum, IsArray, IsDate, IsMongoId} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { InventoryStatus, StockUpdateReason } from '../schemas/inventory-item.schema';

export class CreateInventoryItemDto {
  @ApiProperty()
  @IsMongoId()
  offerId: string;

  @ApiProperty()
  @IsMongoId()
  establishmentId: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  initialStock: number;

  @ApiProperty({ required: false, default: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  lowStockThreshold?: number;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  expiryDate: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  originalPrice: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  discountedPrice: number;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  storageConditions?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  autoUpdateStatus?: boolean;
}

export class UpdateInventoryItemDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentStock?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  lowStockThreshold?: number;

  @ApiProperty({ enum: InventoryStatus, required: false })
  @IsOptional()
  @IsEnum(InventoryStatus)
  status?: InventoryStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiryDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  originalPrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountedPrice?: number;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  autoUpdateStatus?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  storageConditions?: string;
}

export class StockUpdateDto {
  @ApiProperty()
  @IsNumber()
  quantity: number;

  @ApiProperty({ enum: StockUpdateReason })
  @IsEnum(StockUpdateReason)
  reason: StockUpdateReason;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  orderId?: string;
}

export class ReserveStockDto {
  @ApiProperty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty()
  @IsMongoId()
  orderId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date;
}

export class ReleaseStockDto {
  @ApiProperty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ enum: StockUpdateReason })
  @IsEnum(StockUpdateReason)
  reason: StockUpdateReason;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class BulkUpdateStockDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  inventoryItemIds: string[];

  @ApiProperty()
  @IsNumber()
  quantity: number;

  @ApiProperty({ enum: StockUpdateReason })
  @IsEnum(StockUpdateReason)
  reason: StockUpdateReason;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class InventoryFiltersDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  establishmentId?: string;

  @ApiProperty({ enum: InventoryStatus, required: false })
  @IsOptional()
  @IsEnum(InventoryStatus)
  status?: InventoryStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  lowStock?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  expiringSoon?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  expiringInDays?: number;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({ required: false, default: '-createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string;
}

export class AcknowledgeAlertDto {
  @ApiProperty()
  @IsMongoId()
  alertId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}