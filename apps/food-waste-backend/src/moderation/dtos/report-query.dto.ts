import { Transform, Type } from 'class-transformer';
import {
  IsOptional,
  IsEnum,
  IsMongoId,
  IsString,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';

import { ReportType, ReportReason, ReportStatus, ReportPriority } from '../schemas/report.schema';

function sanitizePlainText(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/<[^>]*>/g, '').trim();
  }

  return value;
}

export class ReportQueryDto {
  @IsOptional()
  @IsEnum(ReportType, { message: 'Invalid report type' })
  type?: ReportType;

  @IsOptional()
  @IsEnum(ReportReason, { message: 'Invalid report reason' })
  reason?: ReportReason;

  @IsOptional()
  @IsEnum(ReportStatus, { message: 'Invalid report status' })
  status?: ReportStatus;

  @IsOptional()
  @IsEnum(ReportPriority, { message: 'Invalid report priority' })
  priority?: ReportPriority;

  @IsOptional()
  @IsMongoId({ message: 'Invalid assigned moderator ID format' })
  assignedToModerator?: string;

  @IsOptional()
  @IsMongoId({ message: 'Invalid reporter ID format' })
  reporterId?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Invalid start date format' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Invalid end date format' })
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  limit?: number = 20;

  @IsOptional()
  @IsString({ message: 'Sort field must be a string' })
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'], { message: 'Sort order must be asc or desc' })
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsString({ message: 'Search term must be a string' })
  @Transform(({ value }) => sanitizePlainText(value))
  search?: string;
}

export class ModerationActionQueryDto {
  @IsOptional()
  @IsMongoId({ message: 'Invalid target user ID format' })
  targetUserId?: string;

  @IsOptional()
  @IsMongoId({ message: 'Invalid moderator ID format' })
  moderatorId?: string;

  @IsOptional()
  @IsString({ message: 'Action type must be a string' })
  actionType?: string;

  @IsOptional()
  @IsString({ message: 'Status must be a string' })
  status?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Invalid start date format' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Invalid end date format' })
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  limit?: number = 20;

  @IsOptional()
  @IsString({ message: 'Sort field must be a string' })
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'], { message: 'Sort order must be asc or desc' })
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class ReportUpdateDto {
  @IsOptional()
  @IsEnum(ReportStatus, { message: 'Invalid report status' })
  status?: ReportStatus;

  @IsOptional()
  @IsEnum(ReportPriority, { message: 'Invalid report priority' })
  priority?: ReportPriority;

  @IsOptional()
  @IsMongoId({ message: 'Invalid moderator ID format' })
  assignedToModerator?: string;

  @IsOptional()
  @IsString({ message: 'Resolution notes must be a string' })
  @Transform(({ value }) => sanitizePlainText(value))
  resolutionNotes?: string;
}
