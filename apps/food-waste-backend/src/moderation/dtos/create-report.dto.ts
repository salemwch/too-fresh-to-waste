import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsString,
  IsOptional,
  IsMongoId,
  MaxLength,
  IsArray,
  ArrayMaxSize,
  IsUrl,
} from 'class-validator';

import { ReportType, ReportReason } from '../schemas/report.schema';

export class CreateReportDto {
  @IsEnum(ReportType, { message: 'Invalid report type' })
  type!: ReportType;

  @IsMongoId({ message: 'Invalid target ID format' })
  targetId!: string;

  @IsEnum(ReportReason, { message: 'Invalid report reason' })
  reason!: ReportReason;

  @IsString({ message: 'Description must be a string' })
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      // Basic XSS sanitization - remove HTML tags and trim whitespace
      return value.replace(/<[^>]*>/g, '').trim();
    }
    return value;
  })
  description!: string;

  @IsOptional()
  @IsArray({ message: 'Evidence must be an array of URLs' })
  @ArrayMaxSize(10, { message: 'Maximum 10 evidence files allowed' })
  @IsUrl({}, { each: true, message: 'Each evidence item must be a valid URL' })
  evidence?: string[];
}
