import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsString,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsIP,
  IsMongoId,
  ValidateNested,
  IsArray,
  IsDate,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Types } from 'mongoose';

import { OptOutReason, OptOutScope, OptOutStatus } from '../schemas/opt-out-record.schema';

export interface IOptOutMetadata {
  campaign?: string;
  messageId?: string;
  errorCode?: string;
  carrierResponse?: string;
  adminUserId?: string;
  requestId?: string;
  complianceReference?: string;
  originalMessage?: string;
  [key: string]: string | number | boolean | Date | undefined;
}

interface IOptOutAuditEntry {
  action: 'opt_out' | 'opt_in' | 'status_change' | 'expired' | 'revoked' | 'created' | 'updated';
  timestamp: Date;
  reason?: string;
  userId?: Types.ObjectId;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface IMessageStats {
  lastMessageSent?: Date | undefined;
  lastMessageDelivered?: Date | undefined;
  totalMessagesSent: number;
  totalMessagesDelivered: number;
  totalMessagesFailed: number;
}

export class OptOutRequestDto {
  @ApiProperty({
    description: 'Phone number in E.164 format',
    example: '+1234567890',
  })
  @IsString()
  @IsPhoneNumber(undefined, { message: 'Phone number must be in valid international format' })
  phoneNumber!: string;

  @ApiPropertyOptional({
    description: 'Reason for opting out',
    enum: OptOutReason,
    default: OptOutReason.USER_REQUESTED,
  })
  @IsOptional()
  @IsEnum(OptOutReason)
  reason?: OptOutReason;

  @ApiPropertyOptional({
    description: 'Scope of opt-out',
    enum: OptOutScope,
    default: OptOutScope.ALL_SMS,
  })
  @IsOptional()
  @IsEnum(OptOutScope)
  scope?: OptOutScope;

  @ApiPropertyOptional({
    description: 'User ID if applicable',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Client IP address',
    example: '192.168.1.1',
  })
  @IsOptional()
  @IsIP()
  ipAddress?: string;

  @ApiPropertyOptional({
    description: 'User agent string',
  })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiPropertyOptional({
    description: 'Source of the opt-out request',
    example: 'web_form',
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  metadata?: IOptOutMetadata;
}

export class OptInRequestDto {
  @ApiProperty({
    description: 'Phone number in E.164 format',
    example: '+1234567890',
  })
  @IsString()
  @IsPhoneNumber(undefined, { message: 'Phone number must be in valid international format' })
  phoneNumber!: string;

  @ApiPropertyOptional({
    description: 'User ID if applicable',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Client IP address',
    example: '192.168.1.1',
  })
  @IsOptional()
  @IsIP()
  ipAddress?: string;

  @ApiPropertyOptional({
    description: 'User agent string',
  })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiPropertyOptional({
    description: 'Source of the opt-in request',
    example: 'web_form',
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  metadata?: IOptOutMetadata;
}

export class BulkOptOutCheckDto {
  @ApiProperty({
    description: 'Array of phone numbers to check',
    example: ['+1234567890', '+0987654321'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsPhoneNumber(undefined, {
    each: true,
    message: 'All phone numbers must be in valid international format',
  })
  phoneNumbers!: string[];

  @ApiPropertyOptional({
    description: 'Include detailed audit information',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  includeAuditLog?: boolean;

  @ApiPropertyOptional({
    description: 'Include message statistics',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  includeStats?: boolean;
}

export class OptOutQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by phone number (exact match)',
    example: '+1234567890',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Filter by user ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: OptOutStatus,
  })
  @IsOptional()
  @IsEnum(OptOutStatus)
  status?: OptOutStatus;

  @ApiPropertyOptional({
    description: 'Filter by reason',
    enum: OptOutReason,
  })
  @IsOptional()
  @IsEnum(OptOutReason)
  reason?: OptOutReason;

  @ApiPropertyOptional({
    description: 'Filter by scope',
    enum: OptOutScope,
  })
  @IsOptional()
  @IsEnum(OptOutScope)
  scope?: OptOutScope;

  @ApiPropertyOptional({
    description: 'Filter by opt-out status',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isOptedOut?: boolean;

  @ApiPropertyOptional({
    description: 'Start date for filtering (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional({
    description: 'End date for filtering (ISO 8601)',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of records per page',
    minimum: 1,
    maximum: 1000,
    default: 50,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['createdAt', 'updatedAt', 'optedOutAt', 'phoneNumber'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'updatedAt' | 'optedOutAt' | 'phoneNumber';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({
    description: 'Search term for text search',
    example: '+123',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Include detailed audit information',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeAuditLog?: boolean;

  @ApiPropertyOptional({
    description: 'Include message statistics',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeStats?: boolean;
}

export class OptOutStatusResponseDto {
  @ApiProperty({
    description: 'Masked phone number',
    example: '*******890',
  })
  phoneNumber!: string;

  @ApiProperty({
    description: 'Whether the number is opted out',
  })
  isOptedOut!: boolean;

  @ApiProperty({
    description: 'Current status',
    enum: OptOutStatus,
  })
  status!: OptOutStatus;

  @ApiProperty({
    description: 'Scope of opt-out',
    enum: OptOutScope,
  })
  scope!: OptOutScope;

  @ApiPropertyOptional({
    description: 'Date when opted out',
  })
  optedOutAt?: Date | undefined;

  @ApiPropertyOptional({
    description: 'Date when opted in (if applicable)',
  })
  optedInAt?: Date | undefined;

  @ApiPropertyOptional({
    description: 'Reason for opt-out',
    enum: OptOutReason,
  })
  reason?: OptOutReason | undefined;

  @ApiPropertyOptional({
    description: 'Expiration date of opt-out',
  })
  expiresAt?: Date | undefined;

  @ApiPropertyOptional({
    description: 'Whether the record is expired',
  })
  isExpired?: boolean | undefined;

  @ApiPropertyOptional({
    description: 'User ID if available',
  })
  userId?: string | undefined;

  @ApiPropertyOptional({
    description: 'Source of the opt-out',
  })
  source?: string | undefined;

  @ApiPropertyOptional({
    description: 'Additional metadata',
  })
  metadata?: IOptOutMetadata | undefined;

  @ApiPropertyOptional({
    description: 'Audit log entries',
    type: [Object],
  })
  auditLog?: IOptOutAuditEntry[] | undefined;

  @ApiPropertyOptional({
    description: 'Message statistics',
  })
  messageStats?: IMessageStats | undefined;

  @ApiProperty({
    description: 'Record creation date',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Record last update date',
  })
  updatedAt!: Date;
}

export class BulkOptOutStatusResponseDto {
  @ApiProperty({
    description: 'Map of phone numbers to their opt-out status',
    type: 'object',
    additionalProperties: {
      $ref: '#/components/schemas/OptOutStatusResponseDto',
    },
  })
  results!: Record<string, OptOutStatusResponseDto>;

  @ApiProperty({
    description: 'Total number of phone numbers processed',
  })
  totalProcessed!: number;

  @ApiProperty({
    description: 'Number of opted out phone numbers',
  })
  totalOptedOut!: number;

  @ApiProperty({
    description: 'Number of active phone numbers',
  })
  totalActive!: number;

  @ApiProperty({
    description: 'Number of phone numbers with errors',
  })
  totalErrors!: number;

  @ApiProperty({
    description: 'Processing timestamp',
  })
  processedAt!: Date;

  @ApiPropertyOptional({
    description: 'Processing time in milliseconds',
  })
  processingTimeMs?: number;
}

export class OptOutListResponseDto {
  @ApiProperty({
    description: 'Array of opt-out records',
    type: [OptOutStatusResponseDto],
  })
  data!: OptOutStatusResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
  })
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };

  @ApiProperty({
    description: 'Query metadata',
  })
  query!: {
    filters: Record<string, unknown>;
    sort: { field: string; order: string };
    search?: string | undefined;
  };

  @ApiProperty({
    description: 'Response timestamp',
  })
  timestamp!: Date;
}

export class OptOutOperationResponseDto {
  @ApiProperty({
    description: 'Whether the operation was successful',
  })
  success!: boolean;

  @ApiProperty({
    description: 'Operation result message',
  })
  message!: string;

  @ApiProperty({
    description: 'Masked phone number',
  })
  phoneNumber!: string;

  @ApiPropertyOptional({
    description: 'Operation details',
  })
  details?: {
    previousStatus?: boolean;
    newStatus: boolean;
    reason: string;
    scope: OptOutScope;
    recordId: string;
  };

  @ApiProperty({
    description: 'Operation timestamp',
  })
  timestamp!: Date;

  @ApiPropertyOptional({
    description: 'Operation ID for tracking',
  })
  operationId?: string;
}
