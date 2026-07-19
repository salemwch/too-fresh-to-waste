import { OrderStatus, PaymentStatus } from '@foodwaste/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminOrderQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ enum: ['cash', 'konnect'] })
  @IsOptional()
  @IsIn(['cash', 'konnect'])
  paymentProvider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  merchantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  establishmentId?: string;

  @ApiPropertyOptional({ description: 'Search by order number, customer name, or merchant name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: 'ISO date — orders created after this date' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'ISO date — orders created before this date' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({
    enum: ['createdAt', 'pricing.total', 'status'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'pricing.total', 'status'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

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

export class AdminCancelOrderDto {
  @ApiProperty({ description: 'Reason for admin cancellation' })
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class AdminRefundOrderDto {
  @ApiProperty({ description: 'Reason for admin-initiated refund' })
  @IsString()
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({ description: 'Internal admin notes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
