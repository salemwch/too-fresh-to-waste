import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { IsOptional, IsEnum, IsDateString, IsNumber, Min, Max } from 'class-validator';

export enum AnalyticsPeriodType {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
  CUSTOM = 'custom',
}

export class GetAnalyticsQueryDto {
  @ApiPropertyOptional({
    enum: AnalyticsPeriodType,
    description: 'Period type for analytics',
    example: AnalyticsPeriodType.WEEK,
  })
  @IsOptional()
  @IsEnum(AnalyticsPeriodType)
  period?: AnalyticsPeriodType = AnalyticsPeriodType.WEEK;

  @ApiPropertyOptional({
    description: 'Start date for custom period (ISO string)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for custom period (ISO string)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Include detailed breakdown',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeDetails?: boolean = false;

  @ApiPropertyOptional({
    description: 'Timezone for date calculations',
    example: 'UTC',
  })
  @IsOptional()
  timezone?: string = 'UTC';
}

export class GetAuditLogsQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by admin ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  adminId?: string;

  @ApiPropertyOptional({
    description: 'Filter by action type',
    example: 'establishment_approved',
  })
  @IsOptional()
  action?: string;

  @ApiPropertyOptional({
    description: 'Filter by target type',
    example: 'establishment',
  })
  @IsOptional()
  targetType?: string;

  @ApiPropertyOptional({
    description: 'Filter by target ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  targetId?: string;

  @ApiPropertyOptional({
    description: 'Start date for filtering (ISO string)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for filtering (ISO string)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
