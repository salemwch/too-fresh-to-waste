import { UserRole, UserStatus } from '@foodwaste/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsString,
  MaxLength,
  IsBoolean,
  IsDateString,
  IsArray,
} from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({
    enum: UserStatus,
    description: 'New user status',
    example: UserStatus.SUSPENDED,
  })
  @IsNotEmpty()
  @IsEnum(UserStatus)
  status!: UserStatus;

  @ApiProperty({
    description: 'Reason for status change',
    example: 'Violation of community guidelines',
    maxLength: 500,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({
    description: 'Internal admin notes',
    example: 'User reported multiple times for inappropriate behavior',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNotes?: string;

  @ApiPropertyOptional({
    description: 'Send notification to user',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  sendNotification?: boolean | undefined;

  @ApiPropertyOptional({
    description: 'Automatic reactivation date (for temporary suspensions)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  reactivationDate?: string | undefined;
}

export class BulkUserActionDto {
  @ApiProperty({
    description: 'Array of user IDs to perform action on',
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
  })
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  userIds!: string[];

  @ApiProperty({
    enum: UserStatus,
    description: 'Status to apply to all users',
    example: UserStatus.SUSPENDED,
  })
  @IsNotEmpty()
  @IsEnum(UserStatus)
  status!: UserStatus;

  @ApiProperty({
    description: 'Reason for bulk action',
    example: 'Bulk suspension due to policy violation',
    maxLength: 500,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({
    description: 'Send notification to all affected users',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  sendNotification?: boolean | undefined;
}

export class UserSearchDto {
  @ApiPropertyOptional({
    description: 'Search term for name or email',
    example: 'john.doe@example.com',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: UserRole,
    description: 'Filter by user role',
    example: UserRole.MERCHANT,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    enum: UserStatus,
    description: 'Filter by user status',
    example: UserStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    description: 'Filter by email verification status',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isEmailVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by phone verification status',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPhoneVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by city',
    example: 'Paris',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Filter by country',
    example: 'France',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Registration date from (ISO string)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  registeredAfter?: string;

  @ApiPropertyOptional({
    description: 'Registration date to (ISO string)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  registeredBefore?: string;

  @ApiPropertyOptional({
    description: 'Last login date from (ISO string)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  lastLoginAfter?: string;

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
