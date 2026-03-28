import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsEnum,
  IsBoolean,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';

export class LocationDto {
  @ApiProperty({ example: 2.3522, description: 'Longitude coordinate' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiProperty({ example: 48.8566, description: 'Latitude coordinate' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiPropertyOptional({
    example: 5000,
    description: 'Search radius in meters',
    minimum: 100,
    maximum: 50000,
  })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(50000)
  radius?: number;

  @ApiPropertyOptional({ example: 50, description: 'Location accuracy in meters' })
  @IsOptional()
  @IsNumber()
  accuracy?: number;

  @ApiPropertyOptional({ enum: ['gps', 'ip', 'manual'], description: 'Location source' })
  @IsOptional()
  @IsString()
  source?: 'gps' | 'ip' | 'manual';
}

class PriceRangeDto {
  @ApiProperty({ example: 0, description: 'Minimum price', minimum: 0 })
  @IsNumber()
  @Min(0)
  min!: number;

  @ApiProperty({ example: 50, description: 'Maximum price', minimum: 0 })
  @IsNumber()
  @Min(0)
  max!: number;
}

class DiscountRangeDto {
  @ApiProperty({
    example: 20,
    description: 'Minimum discount percentage',
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  min!: number;

  @ApiProperty({
    example: 80,
    description: 'Maximum discount percentage',
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  max!: number;
}

class TimeSlotDto {
  @ApiProperty({ example: '16:00', pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' })
  @IsString()
  startTime!: string;

  @ApiProperty({ example: '18:00', pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' })
  @IsString()
  endTime!: string;
}

class SearchDto {
  @ApiProperty({
    example: 'bakery items',
    description: 'Search query text',
    maxLength: 500,
  })
  @IsString()
  @Transform(({ value }) => value?.trim())
  query!: string;

  @ApiPropertyOptional({
    example: ['bakery', 'pastries'],
    description: 'Filter by categories',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({
    description: 'Price range filter',
    type: PriceRangeDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PriceRangeDto)
  priceRange?: PriceRangeDto;

  @ApiPropertyOptional({
    description: 'Discount percentage range filter',
    type: DiscountRangeDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DiscountRangeDto)
  discountRange?: DiscountRangeDto;

  @ApiPropertyOptional({
    description: 'Location-based search',
    type: LocationDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @ApiPropertyOptional({
    example: ['vegetarian', 'vegan', 'gluten-free'],
    description: 'Dietary restrictions filter',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dietaryRestrictions?: string[];

  @ApiPropertyOptional({
    example: ['restaurant', 'bakery', 'grocery_store'],
    description: 'Establishment type filter',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  establishmentTypes?: string[];

  @ApiPropertyOptional({
    description: 'Available pickup time slots',
    type: [TimeSlotDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  pickupTimeSlots?: TimeSlotDto[];

  @ApiPropertyOptional({
    enum: ['relevance', 'price', 'discount', 'distance', 'rating', 'expiration'],
    description: 'Sort criteria',
    default: 'relevance',
  })
  @IsOptional()
  @IsEnum(['relevance', 'price', 'discount', 'distance', 'rating', 'expiration'])
  sortBy?: string;

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    description: 'Sort order',
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({
    example: 1,
    description: 'Page number',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: 20,
    description: 'Items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Include expired offers in results',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  includeExpired?: boolean;

  @ApiPropertyOptional({
    description: 'Include sold out offers in results',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  includeSoldOut?: boolean;
}

export class SuggestionDto {
  @ApiProperty({
    example: 'bake',
    description: 'Partial query for suggestions',
    maxLength: 100,
  })
  @IsString()
  @Transform(({ value }) => value?.trim())
  query!: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Maximum number of suggestions',
    minimum: 1,
    maximum: 50,
    default: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    example: ['query', 'category', 'establishment'],
    description: 'Types of suggestions to include',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  types?: string[];

  @ApiPropertyOptional({
    description: 'User location for location-based suggestions',
    type: LocationDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @ApiPropertyOptional({
    description: 'Include trending suggestions',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeTrending?: boolean;

  @ApiPropertyOptional({
    description: 'Include personalized suggestions (requires authentication)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includePersonalized?: boolean;
}

class SearchFiltersDto {
  @ApiPropertyOptional({
    description: 'Location for filter options',
    type: LocationDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @ApiPropertyOptional({
    example: 'bakery',
    description: 'Category context for related filters',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Include statistical data for filters',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  includeStats?: boolean;
}

class SearchAnalyticsDto {
  @ApiProperty({
    example: 'bakery items',
    description: 'Search query that was clicked',
  })
  @IsString()
  query!: string;

  @ApiProperty({
    example: 'offer_123',
    description: 'ID of the clicked result',
  })
  @IsString()
  resultId!: string;

  @ApiProperty({
    example: 'offer',
    enum: ['offer', 'establishment', 'category'],
    description: 'Type of clicked result',
  })
  @IsString()
  resultType!: string;

  @ApiProperty({
    example: 3,
    description: 'Position of clicked result in search results',
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  position!: number;

  @ApiPropertyOptional({
    example: 'abc123',
    description: 'Search session ID',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}
