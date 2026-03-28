import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsEnum, IsString, MaxLength, IsBoolean } from 'class-validator';

import {
  EstablishmentStatus,
  EstablishmentType,
} from '../../common/interfaces/establishment.interface';

export class ApproveEstablishmentDto {
  @ApiProperty({
    description: 'Approval decision',
    example: true,
  })
  @IsNotEmpty()
  @IsBoolean()
  approved!: boolean;

  @ApiPropertyOptional({
    description: 'Reason for approval or rejection',
    example: 'All documents verified and business license is valid',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    description: 'Internal admin notes',
    example: 'Verified SIRET number with INSEE database',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNotes?: string;

  @ApiPropertyOptional({
    description: 'Send notification to establishment owner',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  sendNotification?: boolean = true;
}

export class UpdateEstablishmentStatusDto {
  @ApiProperty({
    enum: EstablishmentStatus,
    description: 'New establishment status',
    example: EstablishmentStatus.SUSPENDED,
  })
  @IsNotEmpty()
  @IsEnum(EstablishmentStatus)
  status!: EstablishmentStatus;

  @ApiProperty({
    description: 'Reason for status change',
    example: 'Multiple customer complaints about food quality',
    maxLength: 500,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({
    description: 'Internal admin notes',
    example: 'Requires re-inspection before reactivation',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNotes?: string;

  @ApiPropertyOptional({
    description: 'Send notification to establishment owner',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  sendNotification?: boolean = true;

  @ApiPropertyOptional({
    description: 'Automatic reactivation date (for temporary suspensions)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  reactivationDate?: Date;
}

export class EstablishmentSearchDto {
  @ApiPropertyOptional({
    description: 'Search term for name or description',
    example: 'Pizza Restaurant',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: EstablishmentStatus,
    description: 'Filter by establishment status',
    example: EstablishmentStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(EstablishmentStatus)
  status?: EstablishmentStatus;

  @ApiPropertyOptional({
    enum: EstablishmentType,
    description: 'Filter by establishment type',
    example: EstablishmentType.RESTAURANT,
  })
  @IsOptional()
  @IsEnum(EstablishmentType)
  type?: EstablishmentType;

  @ApiPropertyOptional({
    description: 'Filter by city',
    example: 'Paris',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Filter by verification status',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Sort field',
    example: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}

export class EstablishmentStatsDto {
  @ApiPropertyOptional({
    description: 'Start date for statistics (ISO string)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for statistics (ISO string)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Include detailed breakdown',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  includeDetails?: boolean = false;
}
