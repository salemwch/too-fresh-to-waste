import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsBoolean,
  Min,
  Max,
  IsArray,
} from 'class-validator';

import { UserRole, UserStatus } from '../schemas/user.schema';

export class UserQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Search term for email, first name, or last name',
    example: 'john@example.com',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: UserRole,
    description: 'Filter by user role',
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    enum: UserStatus,
    description: 'Filter by user status',
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    description: 'Filter by email verification status',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isEmailVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by phone verification status',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isPhoneVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by MFA enabled status',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  hasMfaEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Include soft-deleted users in results',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  includeDeleted?: boolean = false;

  @ApiPropertyOptional({
    description: 'Filter users created after this date',
    example: '2024-01-01',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  createdAfter?: Date;

  @ApiPropertyOptional({
    description: 'Filter users created before this date',
    example: '2024-12-31',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  createdBefore?: Date;

  @ApiPropertyOptional({
    description: 'Filter users who logged in after this date',
    example: '2024-01-01',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  lastLoginAfter?: Date;

  @ApiPropertyOptional({
    description: 'Filter users who logged in before this date',
    example: '2024-12-31',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  lastLoginBefore?: Date;

  @ApiPropertyOptional({
    enum: ['createdAt', 'lastLoginAt', 'email', 'firstName', 'lastName'],
    description: 'Field to sort by',
    default: 'createdAt',
  })
  @IsOptional()
  @IsEnum(['createdAt', 'lastLoginAt', 'email', 'firstName', 'lastName'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    description: 'Sort order',
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description: 'Filter by specific country in address',
    example: 'Tunisia',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Filter by specific city in address',
    example: 'Tunis',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Filter users with failed login attempts greater than this number',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minFailedAttempts?: number;

  @ApiPropertyOptional({
    description: 'Filter users with account locked status',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isAccountLocked?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'Specific fields to include in response',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fields?: string[];
}

export class UserSearchDto {
  @ApiPropertyOptional({
    description: 'Search query for users',
    example: 'john@example.com or John Doe',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Search in specific field',
    enum: ['email', 'firstName', 'lastName', 'phoneNumber', 'all'],
    default: 'all',
  })
  @IsOptional()
  @IsEnum(['email', 'firstName', 'lastName', 'phoneNumber', 'all'])
  searchIn?: string = 'all';

  @ApiPropertyOptional({
    description: 'Enable fuzzy search (less strict matching)',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  fuzzy?: boolean = false;

  @ApiPropertyOptional({
    description: 'Maximum number of results to return',
    minimum: 1,
    maximum: 50,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  maxResults?: number = 10;
}

export class BulkUserActionDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Array of user IDs to perform action on',
  })
  @IsArray()
  @IsString({ each: true })
  userIds!: string[];

  @ApiPropertyOptional({
    enum: ['activate', 'suspend', 'delete', 'verify_email', 'verify_phone'],
    description: 'Action to perform on selected users',
  })
  @IsEnum(['activate', 'suspend', 'delete', 'verify_email', 'verify_phone'])
  action!: 'activate' | 'suspend' | 'delete' | 'verify_email' | 'verify_phone';

  @ApiPropertyOptional({
    description: 'Reason for performing the bulk action',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Whether to send notification to affected users',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  notifyUsers?: boolean = false;
}
