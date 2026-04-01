import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
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
