import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

import { PaymentMethod, PaymentStatus } from '../schemas/payment.schema';

function toOptionalFloat({ value }: { value: unknown }): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = parseFloat(String(value));
  return Number.isNaN(parsed) ? undefined : parsed;
}

export class PaymentQueryDto {
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsString()
  after?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  @IsString()
  establishmentId?: string;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

  @IsOptional()
  @Transform(toOptionalFloat)
  @IsNumber()
  @Min(0.01)
  minAmount?: number;

  @IsOptional()
  @Transform(toOptionalFloat)
  @IsNumber()
  @Min(0.01)
  maxAmount?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
