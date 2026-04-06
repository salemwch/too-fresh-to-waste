import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
  IsMongoId,
  Min,
  Max,
  Length,
  ValidateNested,
  IsObject,
  ArrayMaxSize,
  IsIn,
  Matches,
  IsNotEmpty,
  ArrayMinSize,
} from 'class-validator';

import type {
  CreateReviewInput,
  UpdateReviewInput,
  ReviewResponseInput,
  ReviewModerationInput,
  ReviewInteractionInput,
  ReviewReportInput,
  ReviewQueryInput,
  ReviewAnalyticsInput,
  BulkReviewModerationInput,
} from '@foodwaste/shared';

import { ReviewStatus, ReviewType, SentimentType } from '../schemas/reviwe.schema';

function trimTransform({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function parseMetadataTransform({ value }: { value: unknown }): Record<string, unknown> {
  if (value === null || value === undefined) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed !== null &&
        parsed !== undefined &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

class DetailedRatingsDto {
  @ApiPropertyOptional({
    description: 'Food quality rating',
    minimum: 1,
    maximum: 5,
    example: 4,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Food quality must be a number' })
  @Min(1, { message: 'Food quality rating must be at least 1' })
  @Max(5, { message: 'Food quality rating must be at most 5' })
  foodQuality?: number | undefined;

  @ApiPropertyOptional({
    description: 'Service quality rating',
    minimum: 1,
    maximum: 5,
    example: 5,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Service quality must be a number' })
  @Min(1, { message: 'Service quality rating must be at least 1' })
  @Max(5, { message: 'Service quality rating must be at most 5' })
  serviceQuality?: number | undefined;

  @ApiPropertyOptional({
    description: 'Value for money rating',
    minimum: 1,
    maximum: 5,
    example: 4,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Value for money must be a number' })
  @Min(1, { message: 'Value for money rating must be at least 1' })
  @Max(5, { message: 'Value for money rating must be at most 5' })
  valueForMoney?: number | undefined;

  @ApiPropertyOptional({
    description: 'Packaging quality rating',
    minimum: 1,
    maximum: 5,
    example: 3,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Packaging must be a number' })
  @Min(1, { message: 'Packaging rating must be at least 1' })
  @Max(5, { message: 'Packaging rating must be at most 5' })
  packaging?: number | undefined;

  @ApiPropertyOptional({
    description: 'Pickup experience rating',
    minimum: 1,
    maximum: 5,
    example: 5,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Pickup experience must be a number' })
  @Min(1, { message: 'Pickup experience rating must be at least 1' })
  @Max(5, { message: 'Pickup experience rating must be at most 5' })
  pickupExperience?: number | undefined;

  @ApiPropertyOptional({
    description: 'Sustainability rating',
    minimum: 1,
    maximum: 5,
    example: 5,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Sustainability must be a number' })
  @Min(1, { message: 'Sustainability rating must be at least 1' })
  @Max(5, { message: 'Sustainability rating must be at most 5' })
  sustainability?: number | undefined;
}

export class CreateReviewDto implements CreateReviewInput {
  @ApiProperty({
    description: 'ID of the establishment being reviewed',
    example: '507f1f77bcf86cd799439011',
  })
  @IsNotEmpty({ message: 'Establishment ID is required' })
  @IsMongoId({ message: 'Invalid establishment ID format' })
  establishmentId!: string;

  @ApiPropertyOptional({
    description: 'ID of the order (if reviewing based on an order)',
    example: '507f1f77bcf86cd799439012',
  })
  @IsOptional()
  @IsMongoId({ message: 'Invalid order ID format' })
  orderId?: string | undefined;

  @ApiPropertyOptional({
    description: 'ID of the specific offer being reviewed',
    example: '507f1f77bcf86cd799439013',
  })
  @IsOptional()
  @IsMongoId({ message: 'Invalid offer ID format' })
  offerId?: string | undefined;

  @ApiProperty({
    description: 'Type of review',
    enum: ReviewType,
    default: ReviewType.ESTABLISHMENT,
    example: ReviewType.ESTABLISHMENT,
  })
  @IsOptional()
  @IsEnum(ReviewType, { message: 'Invalid review type' })
  type: ReviewType = ReviewType.ESTABLISHMENT;

  @ApiProperty({
    description: 'Overall rating from 1 to 5',
    minimum: 1,
    maximum: 5,
    example: 4,
  })
  @IsNumber({}, { message: 'Overall rating must be a number' })
  @Min(1, { message: 'Rating must be at least 1' })
  @Max(5, { message: 'Rating must be at most 5' })
  @Transform(({ value }) => Number(value))
  overallRating!: number;

  @ApiPropertyOptional({
    description: 'Detailed ratings for different aspects',
    type: DetailedRatingsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DetailedRatingsDto)
  detailedRatings?: DetailedRatingsDto | undefined;

  @ApiProperty({
    description: 'Review comment text',
    minLength: 10,
    maxLength: 2000,
    example: 'Great food, excellent service, and amazing value for money!',
  })
  @IsString({ message: 'Comment must be a string' })
  @Length(10, 2000, { message: 'Comment must be between 10 and 2000 characters' })
  @Transform(trimTransform)
  comment!: string;

  @ApiPropertyOptional({
    description: 'Review title/summary',
    minLength: 3,
    maxLength: 100,
    example: 'Outstanding experience!',
  })
  @IsOptional()
  @IsString({ message: 'Title must be a string' })
  @Length(3, 100, { message: 'Title must be between 3 and 100 characters' })
  @Transform(trimTransform)
  title?: string | undefined;

  @ApiPropertyOptional({
    description: 'Array of image URLs or files',
    type: [String],
    maxItems: 10,
    example: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
  })
  @IsOptional()
  @IsArray({ message: 'Images must be an array' })
  @ArrayMaxSize(10, { message: 'Maximum 10 images allowed' })
  @IsString({ each: true, message: 'Each image must be a string URL' })
  images?: string[] | undefined;

  @ApiPropertyOptional({
    description: 'Location where review was written',
    maxLength: 100,
    example: 'Paris, France',
  })
  @IsOptional()
  @IsString({ message: 'Reviewer location must be a string' })
  @Length(1, 100, { message: 'Reviewer location must be between 1 and 100 characters' })
  reviewerLocation?: string | undefined;

  @ApiPropertyOptional({
    description: 'Tags associated with the review',
    type: [String],
    maxItems: 10,
    example: ['fresh', 'healthy', 'sustainable', 'delicious'],
  })
  @IsOptional()
  @IsArray({ message: 'Tags must be an array' })
  @ArrayMaxSize(10, { message: 'Maximum 10 tags allowed' })
  @IsString({ each: true, message: 'Each tag must be a string' })
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.map((t: string) => t.toLowerCase().trim());
    }
    if (typeof value === 'string') {
      return value.split(',').map((t) => t.toLowerCase().trim());
    }
    return [];
  })
  tags?: string[] | undefined;

  @ApiPropertyOptional({
    description: 'Whether the reviewer recommends this establishment',
    default: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Is recommended must be a boolean' })
  @Transform(({ value }) => value === 'true')
  isRecommended?: boolean | undefined;

  @ApiPropertyOptional({
    description: 'Additional metadata for the review',
    type: Object,
    example: { deviceType: 'mobile', browserType: 'chrome' },
  })
  @IsOptional()
  @IsObject({ message: 'Metadata must be an object' })
  @Transform(parseMetadataTransform)
  metadata?: Record<string, unknown> | undefined;
}

export class UpdateReviewDto extends PartialType(CreateReviewDto) implements UpdateReviewInput {
  @ApiPropertyOptional({
    description: 'Reason for updating the review',
    maxLength: 500,
    example: 'Updated after second visit',
  })
  @IsOptional()
  @IsString({ message: 'Update reason must be a string' })
  @Length(1, 500, { message: 'Update reason must be between 1 and 500 characters' })
  updateReason?: string | undefined;

  /** Backend-only: set by auto-moderation, not part of client input schema. */
  @IsOptional()
  @IsEnum(ReviewStatus, { message: 'Invalid review status' })
  status?: ReviewStatus | undefined;
}

export class ReviewResponseDto implements ReviewResponseInput {
  @ApiProperty({
    description: 'Response text to the review',
    minLength: 5,
    maxLength: 1000,
    example: 'Thank you for your wonderful feedback! We are delighted you enjoyed your experience.',
  })
  @IsString({ message: 'Response text must be a string' })
  @Length(5, 1000, { message: 'Response must be between 5 and 1000 characters' })
  @Transform(trimTransform)
  responseText!: string;
}

export class ReviewModerationDto implements ReviewModerationInput {
  @ApiProperty({
    description: 'New status for the review',
    enum: ReviewStatus,
    example: ReviewStatus.APPROVED,
  })
  @IsEnum(ReviewStatus, { message: 'Invalid review status' })
  status!: ReviewStatus;

  @ApiPropertyOptional({
    description: 'Reason for moderation action',
    maxLength: 500,
    example: 'Approved - meets community guidelines',
  })
  @IsOptional()
  @IsString({ message: 'Moderation reason must be a string' })
  @Length(1, 500, { message: 'Moderation reason must be between 1 and 500 characters' })
  moderationReason?: string | undefined;
}

export class ReviewInteractionDto implements ReviewInteractionInput {
  @ApiProperty({
    description: 'Type of interaction',
    enum: ['helpful', 'not_helpful'],
    example: 'helpful',
  })
  @IsString({ message: 'Interaction type must be a string' })
  @IsIn(['helpful', 'not_helpful'], {
    message: 'Interaction type must be either "helpful" or "not_helpful"',
  })
  interactionType!: 'helpful' | 'not_helpful';
}

export class ReviewReportDto implements ReviewReportInput {
  @ApiProperty({
    description: 'Reason for reporting the review',
    enum: ['spam', 'inappropriate', 'fake', 'offensive', 'irrelevant', 'other'],
    example: 'spam',
  })
  @IsString({ message: 'Report reason must be a string' })
  @IsIn(['spam', 'inappropriate', 'fake', 'offensive', 'irrelevant', 'other'], {
    message: 'Invalid report reason',
  })
  reason!: 'spam' | 'inappropriate' | 'fake' | 'offensive' | 'irrelevant' | 'other';

  @ApiPropertyOptional({
    description: 'Additional details about the report',
    maxLength: 500,
    example: 'This review contains promotional content not related to the actual experience.',
  })
  @IsOptional()
  @IsString({ message: 'Additional details must be a string' })
  @Length(1, 500, { message: 'Additional details must be between 1 and 500 characters' })
  additionalDetails?: string | undefined;
}

export class ReviewQueryDto implements ReviewQueryInput {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Page must be a number' })
  @Min(1, { message: 'Page must be at least 1' })
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Limit must be a number' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit must be at most 100' })
  limit: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by review status',
    enum: ReviewStatus,
    example: ReviewStatus.APPROVED,
  })
  @IsOptional()
  @IsEnum(ReviewStatus, { message: 'Invalid status filter' })
  status?: ReviewStatus | undefined;

  @ApiPropertyOptional({
    description: 'Filter by minimum rating',
    minimum: 1,
    maximum: 5,
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Min rating must be a number' })
  @Min(1, { message: 'Min rating must be at least 1' })
  @Max(5, { message: 'Min rating must be at most 5' })
  minRating?: number | undefined;

  @ApiPropertyOptional({
    description: 'Filter by maximum rating',
    minimum: 1,
    maximum: 5,
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Max rating must be a number' })
  @Min(1, { message: 'Max rating must be at least 1' })
  @Max(5, { message: 'Max rating must be at most 5' })
  maxRating?: number | undefined;

  @ApiPropertyOptional({
    description: 'Filter by review type',
    enum: ReviewType,
    example: ReviewType.ESTABLISHMENT,
  })
  @IsOptional()
  @IsEnum(ReviewType, { message: 'Invalid review type filter' })
  type?: ReviewType | undefined;

  @ApiPropertyOptional({
    description: 'Filter by sentiment',
    enum: SentimentType,
    example: SentimentType.POSITIVE,
  })
  @IsOptional()
  @IsEnum(SentimentType, { message: 'Invalid sentiment filter' })
  sentiment?: SentimentType | undefined;

  @ApiPropertyOptional({
    description: 'Search term for filtering reviews',
    maxLength: 100,
    example: 'delicious',
  })
  @IsOptional()
  @IsString({ message: 'Search term must be a string' })
  @Length(1, 100, { message: 'Search term must be between 1 and 100 characters' })
  search?: string | undefined;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['createdAt', 'overallRating', 'helpfulCount', 'engagementScore'],
    default: 'createdAt',
    example: 'createdAt',
  })
  @IsOptional()
  @IsString({ message: 'Sort by must be a string' })
  @IsIn(['createdAt', 'overallRating', 'helpfulCount', 'engagementScore'], {
    message: 'Invalid sort field',
  })
  sortBy: 'createdAt' | 'overallRating' | 'helpfulCount' | 'engagementScore' = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
    example: 'desc',
  })
  @IsOptional()
  @IsString({ message: 'Sort order must be a string' })
  @IsIn(['asc', 'desc'], { message: 'Sort order must be either "asc" or "desc"' })
  sortOrder: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description: 'Filter by establishment ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId({ message: 'Invalid establishment ID format' })
  establishmentId?: string | undefined;

  @ApiPropertyOptional({
    description: 'Filter by reviewer ID',
    example: '507f1f77bcf86cd799439012',
  })
  @IsOptional()
  @IsMongoId({ message: 'Invalid reviewer ID format' })
  reviewerId?: string | undefined;

  @ApiPropertyOptional({
    description: 'Filter by verified purchase only',
    default: false,
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'Verified purchase filter must be a boolean' })
  verifiedPurchaseOnly?: boolean | undefined;

  @ApiPropertyOptional({
    description: 'Filter by recommended reviews only',
    default: false,
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'Recommended filter must be a boolean' })
  recommendedOnly?: boolean | undefined;

  @ApiPropertyOptional({
    description: 'Filter reviews from date (ISO string)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsString({ message: 'From date must be a string' })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/, {
    message: 'From date must be a valid ISO date string',
  })
  fromDate?: string | undefined;

  @ApiPropertyOptional({
    description: 'Filter reviews to date (ISO string)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsString({ message: 'To date must be a string' })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/, {
    message: 'To date must be a valid ISO date string',
  })
  toDate?: string | undefined;

  @ApiPropertyOptional({
    description: 'Filter by tags (comma-separated)',
    example: 'fresh,healthy,sustainable',
  })
  @IsOptional()
  @IsString({ message: 'Tags filter must be a string' })
  tags?: string | undefined;
}

export class ReviewAnalyticsDto implements ReviewAnalyticsInput {
  @ApiPropertyOptional({
    description: 'Start date for analytics (ISO string)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsString({ message: 'Start date must be a string' })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/, {
    message: 'Start date must be a valid ISO date string',
  })
  startDate?: string | undefined;

  @ApiPropertyOptional({
    description: 'End date for analytics (ISO string)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsString({ message: 'End date must be a string' })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/, {
    message: 'End date must be a valid ISO date string',
  })
  endDate?: string | undefined;

  @ApiPropertyOptional({
    description: 'Group analytics by time period',
    enum: ['day', 'week', 'month', 'year'],
    default: 'month',
    example: 'month',
  })
  @IsOptional()
  @IsString({ message: 'Group by must be a string' })
  @IsIn(['day', 'week', 'month', 'year'], {
    message: 'Group by must be one of: day, week, month, year',
  })
  groupBy: 'day' | 'week' | 'month' | 'year' = 'month';

  @ApiPropertyOptional({
    description: 'Filter analytics by establishment ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId({ message: 'Invalid establishment ID format' })
  establishmentId?: string | undefined;
  @ApiPropertyOptional({
    description: 'Filter analytics by review status',
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    example: 'APPROVED',
  })
  @IsOptional()
  @IsEnum(ReviewStatus, { message: 'Status must be one of: PENDING, APPROVED, REJECTED' })
  status?: ReviewStatus | undefined;
}

export class BulkReviewModerationDto implements BulkReviewModerationInput {
  @ApiProperty({
    description: 'Array of review IDs to moderate',
    type: [String],
    minItems: 1,
    maxItems: 100,
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
  })
  @IsArray({ message: 'Review IDs must be an array' })
  @ArrayMinSize(1, { message: 'At least one review ID is required' })
  @ArrayMaxSize(100, { message: 'Maximum 100 review IDs allowed' })
  @IsMongoId({ each: true, message: 'Each review ID must be a valid MongoDB ObjectId' })
  reviewIds!: string[];

  @ApiProperty({
    description: 'Action to perform on reviews',
    enum: ['approve', 'reject', 'flag', 'spam'],
    example: 'approve',
  })
  @IsString({ message: 'Action must be a string' })
  @IsIn(['approve', 'reject', 'flag', 'spam'], {
    message: 'Action must be one of: approve, reject, flag, spam',
  })
  action!: 'approve' | 'reject' | 'flag' | 'spam';

  @ApiPropertyOptional({
    description: 'Reason for bulk moderation action',
    maxLength: 500,
    example: 'Bulk approval of reviews that meet community guidelines',
  })
  @IsOptional()
  @IsString({ message: 'Reason must be a string' })
  @Length(1, 500, { message: 'Reason must be between 1 and 500 characters' })
  reason?: string | undefined;
}
