import {
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  IsDateString,
  IsObject,
  ValidateNested,
  Min,
  Max,
  IsIn,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type} from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ==================== Base DTOs ====================

export class TimeRangeDto {
  @ApiProperty({
    description: 'Start date for the analytics period',
    example: '2024-01-01T00:00:00.000Z',
    format: 'date-time'
  })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'End date for the analytics period',
    example: '2024-12-31T23:59:59.999Z',
    format: 'date-time'
  })
  @IsNotEmpty()
  @IsDateString()
  endDate: string;
}

export class DateGranularityDto {
  @ApiProperty({
    description: 'Time period granularity',
    enum: ['hour', 'day', 'week', 'month', 'quarter', 'year'],
    example: 'day'
  })
  @IsNotEmpty()
  @IsEnum(['hour', 'day', 'week', 'month', 'quarter', 'year'])
  period: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';

  @ApiPropertyOptional({
    description: 'Timezone for date calculations',
    example: 'UTC'
  })
  @IsOptional()
  @IsString()
  timezone?: string = 'UTC';
}

export class LocationFilterDto {
  @ApiPropertyOptional({
    description: 'City name',
    example: 'Paris'
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Country name',
    example: 'France'
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Coordinates [longitude, latitude]',
    example: [2.3522, 48.8566],
    type: [Number]
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  coordinates?: [number, number];

  @ApiPropertyOptional({
    description: 'Radius in kilometers',
    example: 10,
    minimum: 0.1,
    maximum: 100
  })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(100)
  radius?: number;
}

// ==================== Analytics Filter DTOs ====================

export class AnalyticsFiltersDto {
  @ApiProperty({
    description: 'Date range for analytics',
    type: TimeRangeDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TimeRangeDto)
  dateRange: TimeRangeDto;

  @ApiPropertyOptional({
    description: 'Filter by specific establishment IDs',
    example: ['64b1c2e5f123456789abcdef'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  establishmentIds?: string[];

  @ApiPropertyOptional({
    description: 'Filter by specific user IDs',
    example: ['64b1c2e5f123456789abcdef'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];

  @ApiPropertyOptional({
    description: 'Filter by categories',
    example: ['breakfast', 'lunch', 'dinner'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({
    description: 'Location filters',
    type: [LocationFilterDto]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LocationFilterDto)
  locations?: LocationFilterDto[];

  @ApiPropertyOptional({
    description: 'Filter by user roles',
    example: ['consumer', 'merchant'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(['consumer', 'merchant', 'admin'], { each: true })
  userRoles?: string[];

  @ApiPropertyOptional({
    description: 'Filter by establishment types',
    example: ['restaurant', 'bakery'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  establishmentTypes?: string[];

  @ApiPropertyOptional({
    description: 'Filter by order statuses',
    example: ['completed', 'pending'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  orderStatuses?: string[];

  @ApiPropertyOptional({
    description: 'Filter by payment methods',
    example: ['card', 'apple_pay'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  paymentMethods?: string[];

  @ApiPropertyOptional({
    description: 'Minimum order value filter',
    example: 5.00,
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderValue?: number;

  @ApiPropertyOptional({
    description: 'Maximum order value filter',
    example: 50.00,
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxOrderValue?: number;

  @ApiProperty({
    description: 'Date granularity for time-based analytics',
    type: DateGranularityDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => DateGranularityDto)
  granularity: DateGranularityDto;
}

// ==================== Aggregation Options DTOs ====================

export class AggregationOptionsDto {
  @ApiPropertyOptional({
    description: 'Fields to group results by',
    example: ['establishment', 'category'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  groupBy?: string[];

  @ApiPropertyOptional({
    description: 'Field to sort results by',
    example: 'revenue'
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    example: 'desc'
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description: 'Maximum number of results',
    example: 100,
    minimum: 1,
    maximum: 1000
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number = 100;

  @ApiPropertyOptional({
    description: 'Number of results to skip',
    example: 0,
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({
    description: 'Include projected future values',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  includeProjections?: boolean = false;

  @ApiPropertyOptional({
    description: 'Include period-over-period comparisons',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  includeComparisons?: boolean = true;
}

// ==================== Request DTOs ====================

export class BusinessMetricsRequestDto {
  @ApiProperty({
    description: 'Analytics filters',
    type: AnalyticsFiltersDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => AnalyticsFiltersDto)
  filters: AnalyticsFiltersDto;

  @ApiPropertyOptional({
    description: 'Aggregation options',
    type: AggregationOptionsDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AggregationOptionsDto)
  options?: AggregationOptionsDto;

  @ApiPropertyOptional({
    description: 'Include sustainability metrics',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  includeSustainability?: boolean = true;
}

export class UserAnalyticsRequestDto {
  @ApiProperty({
    description: 'Analytics filters',
    type: AnalyticsFiltersDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => AnalyticsFiltersDto)
  filters: AnalyticsFiltersDto;

  @ApiPropertyOptional({
    description: 'Include demographic breakdown',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  includeDemographics?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include location analytics',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  includeLocationData?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include user behavior patterns',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  includeBehaviorPatterns?: boolean = true;
}

export class EstablishmentAnalyticsRequestDto {
  @ApiProperty({
    description: 'Analytics filters',
    type: AnalyticsFiltersDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => AnalyticsFiltersDto)
  filters: AnalyticsFiltersDto;

  @ApiPropertyOptional({
    description: 'Include performance rankings',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  includeRankings?: boolean = true;

  @ApiPropertyOptional({
    description: 'Number of top performers to include',
    example: 10,
    minimum: 1,
    maximum: 100
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  topPerformersLimit?: number = 10;
}

export class SustainabilityAnalyticsRequestDto {
  @ApiProperty({
    description: 'Analytics filters',
    type: AnalyticsFiltersDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => AnalyticsFiltersDto)
  filters: AnalyticsFiltersDto;

  @ApiPropertyOptional({
    description: 'Include carbon footprint calculations',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  includeCarbonFootprint?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include water impact calculations',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  includeWaterImpact?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include establishment impact rankings',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  includeEstablishmentRankings?: boolean = true;
}

export class PredictiveAnalyticsRequestDto {
  @ApiProperty({
    description: 'Analytics filters',
    type: AnalyticsFiltersDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => AnalyticsFiltersDto)
  filters: AnalyticsFiltersDto;

  @ApiProperty({
    description: 'Prediction horizon in days',
    example: 30,
    minimum: 1,
    maximum: 365
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(365)
  predictionHorizonDays: number;

  @ApiPropertyOptional({
    description: 'Include demand forecasting',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  includeDemandForecast?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include churn prediction',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  includeChurnPrediction?: boolean = true;

  @ApiPropertyOptional({
    description: 'Confidence level for predictions',
    example: 0.95,
    minimum: 0.5,
    maximum: 0.99
  })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(0.99)
  confidenceLevel?: number = 0.95;
}

// ==================== Dashboard Configuration DTOs ====================

export class WidgetVisualizationDto {
  @ApiPropertyOptional({
    description: 'Chart type',
    enum: ['line', 'bar', 'pie', 'donut', 'area', 'scatter', 'stacked_bar', 'radial_bar', 'heatmap'],
    example: 'line'
  })
  @IsOptional()
  @IsEnum(['line', 'bar', 'pie', 'donut', 'area', 'scatter', 'stacked_bar', 'radial_bar', 'heatmap'])
  chartType?: 'line' | 'bar' | 'pie' | 'donut' | 'area' | 'scatter' | 'stacked_bar' | 'radial_bar' | 'heatmap';

  @ApiPropertyOptional({
    description: 'X-axis field',
    example: 'date'
  })
  @IsOptional()
  @IsString()
  xAxis?: string;

  @ApiPropertyOptional({
    description: 'Y-axis field(s) - can be single field or array for multi-axis charts',
    example: 'revenue',
    oneOf: [
      { type: 'string', example: 'revenue' },
      { type: 'array', items: { type: 'string' }, example: ['revenue', 'orders'] }
    ]
  })
  @IsOptional()
  yAxis?: string | string[];

  @ApiPropertyOptional({
    description: 'Color scheme',
    example: ['#3B82F6', '#EF4444', '#10B981']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  colorScheme?: string[];

  @ApiPropertyOptional({
    description: 'Field to color by (for scatter plots and other charts)',
    example: 'category'
  })
  @IsOptional()
  @IsString()
  colorBy?: string;

  @ApiPropertyOptional({
    description: 'Field for pie/donut charts',
    example: 'payment_method'
  })
  @IsOptional()
  @IsString()
  field?: string;

  @ApiPropertyOptional({
    description: 'Value field for heatmaps',
    example: 'order_count'
  })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional({
    description: 'Metrics array for radial bar charts',
    example: ['metric1', 'metric2', 'metric3']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metrics?: string[];

  @ApiPropertyOptional({
    description: 'Table columns configuration',
    example: ['name', 'value', 'change']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  columns?: string[];

  @ApiPropertyOptional({
    description: 'Sorting configuration for tables',
    example: { column: 'value', direction: 'desc' }
  })
  @IsOptional()
  @IsObject()
  sorting?: {
    column: string;
    direction: 'asc' | 'desc';
  };

  @ApiPropertyOptional({
    description: 'Map type for geographic visualizations',
    enum: ['heat', 'marker', 'cluster'],
    example: 'heat'
  })
  @IsOptional()
  @IsEnum(['heat', 'marker', 'cluster'])
  mapType?: 'heat' | 'marker' | 'cluster';

  @ApiPropertyOptional({
    description: 'Map center latitude',
    example: 40.7128
  })
  @IsOptional()
  @IsNumber()
  centerLat?: number;

  @ApiPropertyOptional({
    description: 'Map center longitude',
    example: -74.0060
  })
  @IsOptional()
  @IsNumber()
  centerLng?: number;

  @ApiPropertyOptional({
    description: 'Map zoom level',
    example: 10,
    minimum: 1,
    maximum: 20
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  zoom?: number;

  @ApiPropertyOptional({
    description: 'Additional display options'
  })
  @IsOptional()
  @IsObject()
  displayOptions?: Record<string, string | number | boolean>;
}

export class WidgetPositionDto {
  @ApiProperty({
    description: 'Row position',
    example: 1,
    minimum: 1
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  row: number;

  @ApiProperty({
    description: 'Column position',
    example: 1,
    minimum: 1
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  column: number;

  @ApiProperty({
    description: 'Widget width',
    example: 2,
    minimum: 1,
    maximum: 12
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(12)
  width: number;

  @ApiProperty({
    description: 'Widget height',
    example: 1,
    minimum: 1,
    maximum: 6
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(6)
  height: number;
}

export class CreateWidgetDto {
  @ApiPropertyOptional({
    description: 'Widget ID (for updates)',
    example: '64b1c2e5f123456789abcdef'
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({
    description: 'Widget type',
    enum: ['metric', 'chart', 'table', 'map', 'heatmap'],
    example: 'chart'
  })
  @IsNotEmpty()
  @IsEnum(['metric', 'chart', 'table', 'map', 'heatmap'])
  type: 'metric' | 'chart' | 'table' | 'map' | 'heatmap';

  @ApiProperty({
    description: 'Widget title',
    example: 'Revenue Trend'
  })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: 'Widget description',
    example: 'Monthly revenue trend over the selected period'
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Data source identifier',
    example: 'revenue_analytics'
  })
  @IsNotEmpty()
  @IsString()
  dataSource: string;

  @ApiProperty({
    description: 'Visualization configuration',
    type: WidgetVisualizationDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => WidgetVisualizationDto)
  visualization: WidgetVisualizationDto;

  @ApiProperty({
    description: 'Widget filters - flexible filters to support various widget types',
    type: 'object',
    additionalProperties: true,
    example: {}
  })
  @IsObject()
  filters: Record<string, string | number | boolean | string[] | number[]>;

  @ApiPropertyOptional({
    description: 'Refresh interval in minutes',
    example: 15,
    minimum: 1,
    maximum: 1440
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1440)
  refreshInterval?: number = 15;

  @ApiProperty({
    description: 'Widget position and size',
    type: WidgetPositionDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => WidgetPositionDto)
  position: WidgetPositionDto;
}

export class DashboardPermissionsDto {
  @ApiProperty({
    description: 'Roles that can view this dashboard',
    example: ['admin', 'merchant'],
    type: [String]
  })
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  viewRoles: string[];

  @ApiProperty({
    description: 'Roles that can edit this dashboard',
    example: ['admin'],
    type: [String]
  })
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  editRoles: string[];
}

export class CreateDashboardDto {
  @ApiProperty({
    description: 'Dashboard name',
    example: 'Business Overview'
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Dashboard description',
    example: 'Key business metrics and trends'
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Dashboard category',
    enum: ['business', 'operations', 'sustainability', 'customer', 'financial'],
    example: 'business'
  })
  @IsNotEmpty()
  @IsEnum(['business', 'operations', 'sustainability', 'customer', 'financial'])
  category: 'business' | 'operations' | 'sustainability' | 'customer' | 'financial';

  @ApiProperty({
    description: 'Dashboard widgets',
    type: [CreateWidgetDto]
  })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWidgetDto)
  widgets: CreateWidgetDto[];

  @ApiPropertyOptional({
    description: 'Set as default dashboard',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean = false;

  @ApiPropertyOptional({
    description: 'Dashboard permissions',
    type: DashboardPermissionsDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DashboardPermissionsDto)
  permissions?: DashboardPermissionsDto;
}

// ==================== Export DTOs ====================

export class ExportOptionsDto {
  @ApiProperty({
    description: 'Export format',
    enum: ['pdf', 'excel', 'csv', 'json'],
    example: 'excel'
  })
  @IsNotEmpty()
  @IsEnum(['pdf', 'excel', 'csv', 'json'])
  format: 'pdf' | 'excel' | 'csv' | 'json';

  @ApiPropertyOptional({
    description: 'Include charts in export',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  includeCharts?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include raw data in export',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  includeRawData?: boolean = false;

  @ApiPropertyOptional({
    description: 'Date format for export',
    example: 'YYYY-MM-DD'
  })
  @IsOptional()
  @IsString()
  dateFormat?: string = 'YYYY-MM-DD';

  @ApiPropertyOptional({
    description: 'Currency for monetary values',
    example: 'EUR'
  })
  @IsOptional()
  @IsString()
  currency?: string = 'EUR';

  @ApiPropertyOptional({
    description: 'Language for export',
    example: 'en'
  })
  @IsOptional()
  @IsString()
  language?: string = 'en';
}

export class ExportRequestDto {
  @ApiProperty({
    description: 'Analytics sections to include',
    example: ['business_metrics', 'user_analytics', 'sustainability'],
    type: [String]
  })
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  sections: string[];

  @ApiProperty({
    description: 'Analytics filters',
    type: AnalyticsFiltersDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => AnalyticsFiltersDto)
  filters: AnalyticsFiltersDto;

  @ApiProperty({
    description: 'Export options',
    type: ExportOptionsDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ExportOptionsDto)
  options: ExportOptionsDto;
}

// ==================== Alert Configuration DTOs ====================

export class CreateAlertRuleDto {
  @ApiProperty({
    description: 'Alert rule name',
    example: 'High Order Volume Alert'
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Alert rule description',
    example: 'Triggers when order volume exceeds threshold'
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Metric to monitor',
    example: 'orders_per_hour'
  })
  @IsNotEmpty()
  @IsString()
  metric: string;

  @ApiProperty({
    description: 'Alert condition',
    enum: ['greater_than', 'less_than', 'equals', 'percent_change'],
    example: 'greater_than'
  })
  @IsNotEmpty()
  @IsEnum(['greater_than', 'less_than', 'equals', 'percent_change'])
  condition: 'greater_than' | 'less_than' | 'equals' | 'percent_change';

  @ApiProperty({
    description: 'Alert threshold value',
    example: 100
  })
  @IsNotEmpty()
  @IsNumber()
  threshold: number;

  @ApiProperty({
    description: 'Time window in minutes',
    example: 60,
    minimum: 1,
    maximum: 1440
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(1440)
  timeWindow: number;

  @ApiProperty({
    description: 'Notification channels',
    example: ['email', 'webhook'],
    type: [String]
  })
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  notificationChannels: string[];
}