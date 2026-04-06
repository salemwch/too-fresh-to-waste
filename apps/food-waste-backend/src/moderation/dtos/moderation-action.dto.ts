import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsString,
  IsOptional,
  IsMongoId,
  MaxLength,
  IsDateString,
  IsBoolean,
  IsArray,
} from 'class-validator';

import { ModerationActionType, ModerationSeverity } from '../schemas/moderation-action.schema';

function sanitizePlainText(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/<[^>]*>/g, '').trim();
  }

  return value;
}

export class CreateModerationActionDto {
  @IsEnum(ModerationActionType, { message: 'Invalid moderation action type' })
  actionType!: ModerationActionType;

  @IsMongoId({ message: 'Invalid target user ID format' })
  targetUserId!: string;

  @IsOptional()
  @IsMongoId({ message: 'Invalid report ID format' })
  relatedReportId?: string | undefined;

  @IsEnum(ModerationSeverity, { message: 'Invalid severity level' })
  severity!: ModerationSeverity;

  @IsString({ message: 'Reason must be a string' })
  @MaxLength(1000, { message: 'Reason cannot exceed 1000 characters' })
  @Transform(({ value }) => sanitizePlainText(value))
  reason!: string;

  @IsOptional()
  @IsString({ message: 'Details must be a string' })
  @MaxLength(2000, { message: 'Details cannot exceed 2000 characters' })
  @Transform(({ value }) => sanitizePlainText(value))
  details?: string | undefined;

  @IsOptional()
  @IsDateString({}, { message: 'Invalid expiration date format' })
  expiresAt?: string | undefined;

  @IsOptional()
  @IsArray({ message: 'Affected features must be an array' })
  @IsString({ each: true, message: 'Each affected feature must be a string' })
  affectedFeatures?: string[] | undefined;

  @IsOptional()
  @IsBoolean({ message: 'Is appealable must be a boolean' })
  isAppealable?: boolean | undefined;
}

export class UpdateModerationActionDto {
  @IsOptional()
  @IsString({ message: 'Revocation reason must be a string' })
  @MaxLength(500, { message: 'Revocation reason cannot exceed 500 characters' })
  @Transform(({ value }) => sanitizePlainText(value))
  revocationReason?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Invalid expiration date format' })
  expiresAt?: string;

  @IsOptional()
  @IsArray({ message: 'Affected features must be an array' })
  @IsString({ each: true, message: 'Each affected feature must be a string' })
  affectedFeatures?: string[];
}

export class BulkModerationActionDto {
  @IsArray({ message: 'Target user IDs must be an array' })
  @IsMongoId({ each: true, message: 'Each target user ID must be valid' })
  targetUserIds!: string[];

  @IsEnum(ModerationActionType, { message: 'Invalid moderation action type' })
  actionType!: ModerationActionType;

  @IsEnum(ModerationSeverity, { message: 'Invalid severity level' })
  severity!: ModerationSeverity;

  @IsString({ message: 'Reason must be a string' })
  @MaxLength(1000, { message: 'Reason cannot exceed 1000 characters' })
  @Transform(({ value }) => sanitizePlainText(value))
  reason!: string;

  @IsOptional()
  @IsString({ message: 'Details must be a string' })
  @MaxLength(2000, { message: 'Details cannot exceed 2000 characters' })
  @Transform(({ value }) => sanitizePlainText(value))
  details?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Invalid expiration date format' })
  expiresAt?: string;
}
