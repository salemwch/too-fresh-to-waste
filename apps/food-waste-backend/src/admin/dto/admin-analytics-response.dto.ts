import { ApiExtraModels, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsDate,
  IsEnum,
  IsArray,
  ValidateNested,
  IsOptional,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

import { AdminAction } from '../interfaces/admin-analytics.interface';

import { AnalyticsPeriodType } from './admin-analytics.dto';

// Base Analytics Period DTO
class AnalyticsPeriodResponseDto {
  @ApiProperty({
    description: 'Start date of the analytics period',
    example: '2024-01-01T00:00:00.000Z',
    type: Date,
  })
  @IsDate()
  @Type(() => Date)
  startDate!: Date;

  @ApiProperty({
    description: 'End date of the analytics period',
    example: '2024-01-31T23:59:59.999Z',
    type: Date,
  })
  @IsDate()
  @Type(() => Date)
  endDate!: Date;

  @ApiProperty({
    description: 'Type of period for analytics',
    enum: AnalyticsPeriodType,
    example: AnalyticsPeriodType.MONTH,
  })
  @IsEnum(AnalyticsPeriodType)
  periodType!: AnalyticsPeriodType;
}

// User Analytics Response DTO
class UserAnalyticsResponseDto {
  @ApiProperty({
    description: 'Total number of registered users',
    example: 15420,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  totalUsers!: number;

  @ApiProperty({
    description: 'Number of active users',
    example: 8750,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  activeUsers!: number;

  @ApiProperty({
    description: 'New users registered today',
    example: 45,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  newUsersToday!: number;

  @ApiProperty({
    description: 'New users registered this week',
    example: 312,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  newUsersThisWeek!: number;

  @ApiProperty({
    description: 'New users registered this month',
    example: 1205,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  newUsersThisMonth!: number;

  @ApiProperty({
    description: 'User distribution by role',
    example: { customer: 14500, establishment_owner: 920 },
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  usersByRole!: Record<string, number>;

  @ApiProperty({
    description: 'User distribution by status',
    example: { active: 14800, suspended: 120, pending: 500 },
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  usersByStatus!: Record<string, number>;

  @ApiProperty({
    description: 'User retention rate as percentage',
    example: 78.5,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  retentionRate!: number;

  @ApiProperty({
    description: 'Average session duration in minutes',
    example: 24.7,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  averageSessionDuration!: number;
}

// Establishment Performance DTO
class EstablishmentPerformanceResponseDto {
  @ApiProperty({
    description: 'Establishment unique identifier',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  id!: string;

  @ApiProperty({
    description: 'Establishment name',
    example: 'Green Bistro Downtown',
  })
  @IsString()
  name!: string;

  @ApiProperty({
    description: 'Type of establishment',
    example: 'restaurant',
  })
  @IsString()
  type!: string;

  @ApiProperty({
    description: 'Total orders completed',
    example: 2456,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  totalOrders!: number;

  @ApiProperty({
    description: 'Total revenue generated in cents',
    example: 245600,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  totalRevenue!: number;

  @ApiProperty({
    description: 'Average customer rating',
    example: 4.7,
    minimum: 0,
    maximum: 5,
  })
  @IsNumber()
  @Min(0)
  @Max(5)
  averageRating!: number;

  @ApiProperty({
    description: 'Order completion rate as percentage',
    example: 96.8,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  completionRate!: number;
}

// Establishment Analytics Response DTO
class EstablishmentAnalyticsResponseDto {
  @ApiProperty({
    description: 'Total number of establishments',
    example: 1250,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  totalEstablishments!: number;

  @ApiProperty({
    description: 'Number of active establishments',
    example: 1180,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  activeEstablishments!: number;

  @ApiProperty({
    description: 'Establishments pending approval',
    example: 45,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  pendingApproval!: number;

  @ApiProperty({
    description: 'Rejected establishments',
    example: 18,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  rejectedEstablishments!: number;

  @ApiProperty({
    description: 'Suspended establishments',
    example: 7,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  suspendedEstablishments!: number;

  @ApiProperty({
    description: 'Establishments by type',
    example: { restaurant: 850, bakery: 200, grocery: 200 },
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  establishmentsByType!: Record<string, number>;

  @ApiProperty({
    description: 'Overall average rating across all establishments',
    example: 4.3,
    minimum: 0,
    maximum: 5,
  })
  @IsNumber()
  @Min(0)
  @Max(5)
  averageRating!: number;

  @ApiProperty({
    description: 'Top performing establishments',
    type: [EstablishmentPerformanceResponseDto],
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EstablishmentPerformanceResponseDto)
  topPerformingEstablishments!: EstablishmentPerformanceResponseDto[];
}

// Order Trend DTO
class OrderTrendResponseDto {
  @ApiProperty({
    description: 'Date in YYYY-MM-DD format',
    example: '2024-01-15',
  })
  @IsString()
  date!: string;

  @ApiProperty({
    description: 'Number of orders on this date',
    example: 156,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  orders!: number;

  @ApiProperty({
    description: 'Revenue generated on this date in cents',
    example: 15600,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  revenue!: number;
}

// Order Analytics Response DTO
class OrderAnalyticsResponseDto {
  @ApiProperty({
    description: 'Total number of orders',
    example: 25680,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  totalOrders!: number;

  @ApiProperty({
    description: 'Number of completed orders',
    example: 24850,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  completedOrders!: number;

  @ApiProperty({
    description: 'Number of cancelled orders',
    example: 520,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  cancelledOrders!: number;

  @ApiProperty({
    description: 'Number of pending orders',
    example: 310,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  pendingOrders!: number;

  @ApiProperty({
    description: 'Orders by status',
    example: { completed: 24850, cancelled: 520, pending: 310 },
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  ordersByStatus!: Record<string, number>;

  @ApiProperty({
    description: 'Average order value in cents',
    example: 1250,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  averageOrderValue!: number;

  @ApiProperty({
    description: 'Order completion rate as percentage',
    example: 96.8,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  orderCompletionRate!: number;

  @ApiProperty({
    description: 'Order trends over time',
    type: [OrderTrendResponseDto],
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderTrendResponseDto)
  orderTrends!: OrderTrendResponseDto[];
}

// Category Stats DTO
class CategoryStatsResponseDto {
  @ApiProperty({
    description: 'Category name',
    example: 'prepared_meals',
  })
  @IsString()
  category!: string;

  @ApiProperty({
    description: 'Number of offers in this category',
    example: 1450,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  count!: number;

  @ApiProperty({
    description: 'Total revenue from this category in cents',
    example: 145000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  totalRevenue!: number;

  @ApiPropertyOptional({
    description: 'Total quantity sold',
    example: 2300,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  soldQuantity?: number;

  @ApiPropertyOptional({
    description: 'Average price in cents',
    example: 1250,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  averagePrice?: number;

  @ApiPropertyOptional({
    description: 'Average discount percentage',
    example: 35.5,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  averageDiscount?: number;
}

// Waste Reduction Metrics DTO
class WasteReductionMetricsResponseDto {
  @ApiProperty({
    description: 'Total kilograms of food saved from waste',
    example: 15420.5,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  totalKgSaved!: number;

  @ApiProperty({
    description: 'Total number of meals saved',
    example: 38550,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  totalMealsSaved!: number;

  @ApiProperty({
    description: 'CO2 reduction in kilograms',
    example: 46260.0,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  co2ReductionKg!: number;

  @ApiProperty({
    description: 'Estimated value of saved food in cents',
    example: 154205,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  estimatedValue!: number;
}

// Offer Analytics Response DTO
class OfferAnalyticsResponseDto {
  @ApiProperty({
    description: 'Total number of offers created',
    example: 8750,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  totalOffers!: number;

  @ApiProperty({
    description: 'Number of currently active offers',
    example: 1250,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  activeOffers!: number;

  @ApiProperty({
    description: 'Number of expired offers',
    example: 5200,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  expiredOffers!: number;

  @ApiProperty({
    description: 'Number of sold offers',
    example: 2300,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  soldOffers!: number;

  @ApiProperty({
    description: 'Average discount percentage across all offers',
    example: 42.5,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  averageDiscount!: number;

  @ApiProperty({
    description: 'Most popular food categories',
    type: [CategoryStatsResponseDto],
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryStatsResponseDto)
  mostPopularCategories!: CategoryStatsResponseDto[];

  @ApiProperty({
    description: 'Environmental impact metrics',
    type: WasteReductionMetricsResponseDto,
  })
  @ValidateNested()
  @Type(() => WasteReductionMetricsResponseDto)
  wasteReductionImpact!: WasteReductionMetricsResponseDto;
}

// Review Analytics Response DTO
class ReviewAnalyticsResponseDto {
  @ApiProperty({
    description: 'Total number of reviews',
    example: 18750,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  totalReviews!: number;

  @ApiProperty({
    description: 'Overall average rating',
    example: 4.3,
    minimum: 0,
    maximum: 5,
  })
  @IsNumber()
  @Min(0)
  @Max(5)
  averageRating!: number;

  @ApiProperty({
    description: 'Rating distribution by star count',
    example: { '5': 8750, '4': 6200, '3': 2800, '2': 750, '1': 250 },
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  ratingDistribution!: Record<string, number>;

  @ApiProperty({
    description: 'Number of flagged reviews requiring moderation',
    example: 45,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  flaggedReviews!: number;

  @ApiProperty({
    description: 'Reviews in moderation queue',
    example: 12,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  reviewsModerationQueue!: number;

  @ApiProperty({
    description: 'Establishment response rate to reviews as percentage',
    example: 87.5,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  responseRate!: number;
}

// Establishment Revenue DTO
class EstablishmentRevenueResponseDto {
  @ApiProperty({
    description: 'Establishment unique identifier',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  establishmentId!: string;

  @ApiProperty({
    description: 'Establishment name',
    example: 'Green Bistro Downtown',
  })
  @IsString()
  establishmentName!: string;

  @ApiProperty({
    description: 'Total revenue in cents',
    example: 245600,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  revenue!: number;

  @ApiProperty({
    description: 'Total number of orders',
    example: 1234,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  orders!: number;

  @ApiProperty({
    description: 'Platform commission in cents',
    example: 24560,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  commission!: number;
}

// Revenue Analytics Response DTO
class RevenueAnalyticsResponseDto {
  @ApiProperty({
    description: 'Total platform revenue in cents',
    example: 2456000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  totalRevenue!: number;

  @ApiProperty({
    description: 'Revenue generated today in cents',
    example: 45600,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  revenueToday!: number;

  @ApiProperty({
    description: 'Revenue generated this week in cents',
    example: 312000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  revenueThisWeek!: number;

  @ApiProperty({
    description: 'Revenue generated this month in cents',
    example: 1205000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  revenueThisMonth!: number;

  @ApiProperty({
    description: 'Revenue generated this year in cents',
    example: 12050000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  revenueThisYear!: number;

  @ApiProperty({
    description: 'Total platform commission in cents',
    example: 245600,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  platformCommission!: number;

  @ApiProperty({
    description: 'Average transaction value in cents',
    example: 1250,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  averageTransactionValue!: number;

  @ApiProperty({
    description: 'Revenue breakdown by establishment',
    type: [EstablishmentRevenueResponseDto],
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EstablishmentRevenueResponseDto)
  revenueByEstablishment!: EstablishmentRevenueResponseDto[];

  @ApiProperty({
    description: 'Revenue growth rate as percentage',
    example: 15.7,
    minimum: -100,
  })
  @IsNumber()
  @Min(-100)
  revenueGrowthRate!: number;
}

// Main Platform Analytics Response DTO
export class PlatformAnalyticsResponseDto {
  @ApiProperty({
    description: 'User analytics data',
    type: UserAnalyticsResponseDto,
  })
  @ValidateNested()
  @Type(() => UserAnalyticsResponseDto)
  users!: UserAnalyticsResponseDto;

  @ApiProperty({
    description: 'Establishment analytics data',
    type: EstablishmentAnalyticsResponseDto,
  })
  @ValidateNested()
  @Type(() => EstablishmentAnalyticsResponseDto)
  establishments!: EstablishmentAnalyticsResponseDto;

  @ApiProperty({
    description: 'Order analytics data',
    type: OrderAnalyticsResponseDto,
  })
  @ValidateNested()
  @Type(() => OrderAnalyticsResponseDto)
  orders!: OrderAnalyticsResponseDto;

  @ApiProperty({
    description: 'Offer analytics data',
    type: OfferAnalyticsResponseDto,
  })
  @ValidateNested()
  @Type(() => OfferAnalyticsResponseDto)
  offers!: OfferAnalyticsResponseDto;

  @ApiProperty({
    description: 'Review analytics data',
    type: ReviewAnalyticsResponseDto,
  })
  @ValidateNested()
  @Type(() => ReviewAnalyticsResponseDto)
  reviews!: ReviewAnalyticsResponseDto;

  @ApiProperty({
    description: 'Revenue analytics data',
    type: RevenueAnalyticsResponseDto,
  })
  @ValidateNested()
  @Type(() => RevenueAnalyticsResponseDto)
  revenue!: RevenueAnalyticsResponseDto;

  @ApiProperty({
    description: 'Analytics period information',
    type: AnalyticsPeriodResponseDto,
  })
  @ValidateNested()
  @Type(() => AnalyticsPeriodResponseDto)
  period!: AnalyticsPeriodResponseDto;
}

// Audit Log Response DTOs
class AdminActivityStatsResponseDto {
  @ApiProperty({
    description: 'Admin user ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  _id!: string;

  @ApiProperty({
    description: 'Admin email address',
    example: 'admin@foodwaste.com',
  })
  @IsString()
  adminEmail!: string;

  @ApiProperty({
    description: 'Number of actions performed',
    example: 245,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  count!: number;
}

class DailyActivityStatsResponseDto {
  @ApiProperty({
    description: 'Date in YYYY-MM-DD format',
    example: '2024-01-15',
  })
  @IsString()
  _id!: string;

  @ApiProperty({
    description: 'Number of activities on this date',
    example: 156,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  count!: number;
}

class AuditStatisticsPeriodResponseDto {
  @ApiProperty({
    description: 'Number of days analyzed',
    example: 30,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  days!: number;

  @ApiProperty({
    description: 'Start date of analysis period',
    example: '2024-01-01T00:00:00.000Z',
    type: Date,
  })
  @IsDate()
  @Type(() => Date)
  startDate!: Date;

  @ApiProperty({
    description: 'End date of analysis period',
    example: '2024-01-31T23:59:59.999Z',
    type: Date,
  })
  @IsDate()
  @Type(() => Date)
  endDate!: Date;
}

export class AuditStatisticsResponseDto {
  @ApiProperty({
    description: 'Total number of admin actions',
    example: 2456,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  totalActions!: number;

  @ApiProperty({
    description: 'Actions grouped by type',
    example: { USER_CREATED: 450, ESTABLISHMENT_APPROVED: 123, ORDER_CANCELLED: 67 },
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  actionsByType!: Record<AdminAction, number>;

  @ApiProperty({
    description: 'Activity statistics by admin user',
    type: [AdminActivityStatsResponseDto],
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminActivityStatsResponseDto)
  activityByAdmin!: AdminActivityStatsResponseDto[];

  @ApiProperty({
    description: 'Targets grouped by type',
    example: { user: 1200, establishment: 450, order: 806 },
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  targetsByType!: Record<string, number>;

  @ApiProperty({
    description: 'Daily activity breakdown',
    type: [DailyActivityStatsResponseDto],
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DailyActivityStatsResponseDto)
  dailyActivity!: DailyActivityStatsResponseDto[];

  @ApiProperty({
    description: 'Analysis period information',
    type: AuditStatisticsPeriodResponseDto,
  })
  @ValidateNested()
  @Type(() => AuditStatisticsPeriodResponseDto)
  period!: AuditStatisticsPeriodResponseDto;
}

export class AuditLogItemResponseDto {
  @ApiProperty({
    description: 'Audit log unique identifier',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  id!: string;

  @ApiProperty({
    description: 'Admin user ID who performed the action',
    example: '507f1f77bcf86cd799439012',
  })
  @IsString()
  adminId!: string;

  @ApiProperty({
    description: 'Admin email address',
    example: 'admin@foodwaste.com',
  })
  @IsString()
  adminEmail!: string;

  @ApiProperty({
    description: 'Action performed',
    enum: AdminAction,
    example: AdminAction.USER_SUSPENDED,
  })
  @IsEnum(AdminAction)
  action!: AdminAction;

  @ApiProperty({
    description: 'Type of target affected',
    enum: ['user', 'establishment', 'order', 'review', 'offer', 'system'],
    example: 'user',
  })
  @IsEnum(['user', 'establishment', 'order', 'review', 'offer', 'system'])
  targetType!: 'user' | 'establishment' | 'order' | 'review' | 'offer' | 'system';

  @ApiPropertyOptional({
    description: 'ID of the target affected',
    example: '507f1f77bcf86cd799439013',
  })
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiPropertyOptional({
    description: 'Previous values before the action',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  previousValue?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'New values after the action',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  newValue?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Reason for the action',
    example: 'Violating community guidelines',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({
    description: 'Timestamp when action was performed',
    example: '2024-01-15T14:30:00.000Z',
    type: Date,
  })
  @IsDate()
  @Type(() => Date)
  timestamp!: Date;

  @ApiProperty({
    description: 'IP address of the admin',
    example: '192.168.1.100',
  })
  @IsString()
  ipAddress!: string;

  @ApiProperty({
    description: 'User agent of the admin browser',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  })
  @IsString()
  userAgent!: string;
}

export class AuditLogResponseDto {
  @ApiProperty({
    description: 'Array of audit log entries',
    type: [AuditLogItemResponseDto],
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AuditLogItemResponseDto)
  logs!: AuditLogItemResponseDto[];

  @ApiProperty({
    description: 'Total number of audit logs matching the query',
    example: 2456,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  total!: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  page!: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  limit!: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 123,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  totalPages!: number;

  @ApiProperty({
    description: 'Whether there is a next page',
    example: true,
  })
  @IsBoolean()
  hasNext!: boolean;

  @ApiProperty({
    description: 'Whether there is a previous page',
    example: false,
  })
  @IsBoolean()
  hasPrev!: boolean;
}

export class RecentActivityResponseDto {
  @ApiProperty({
    description: 'Array of recent admin activities',
    type: [AuditLogItemResponseDto],
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AuditLogItemResponseDto)
  activities!: AuditLogItemResponseDto[];

  @ApiProperty({
    description: 'Number of hours analyzed',
    example: 24,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  hoursAnalyzed!: number;

  @ApiProperty({
    description: 'Maximum number of activities returned',
    example: 100,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  maxActivities!: number;
}

// Export response DTOs for different formats
@ApiExtraModels(AuditLogItemResponseDto)
export class AuditLogExportResponseDto {
  @ApiProperty({
    description: 'Export format used',
    enum: ['json', 'csv'],
    example: 'json',
  })
  @IsEnum(['json', 'csv'])
  format!: 'json' | 'csv';

  @ApiProperty({
    description: 'Exported data (JSON array or CSV string)',
    oneOf: [
      { type: 'array', items: { $ref: '#/components/schemas/AuditLogItemResponseDto' } },
      { type: 'string', description: 'CSV formatted data' },
    ],
  })
  data!: AuditLogItemResponseDto[] | string;

  @ApiProperty({
    description: 'Date range for exported data',
    type: 'object',
    properties: {
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' },
    },
  })
  dateRange!: {
    startDate: Date;
    endDate: Date;
  };

  @ApiProperty({
    description: 'Total number of records exported',
    example: 1456,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  totalRecords!: number;
}
