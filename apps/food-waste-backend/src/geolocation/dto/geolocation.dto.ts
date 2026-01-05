import { IsNotEmpty, IsNumber, IsString, IsOptional, IsEnum, IsBoolean, IsArray, ValidateNested, Min, Max, IsLatitude, IsLongitude } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DistanceUnit, LocationCategory} from '../interfaces/geolocation.interface';

export class GeoCoordinateDto {
  @ApiProperty({
    description: 'Latitude coordinate',
    example: 48.8566,
    minimum: -90,
    maximum: 90
  })
  @IsNotEmpty()
  @IsNumber()
  @IsLatitude()
  latitude: number;

  @ApiProperty({
    description: 'Longitude coordinate',
    example: 2.3522,
    minimum: -180,
    maximum: 180
  })
  @IsNotEmpty()
  @IsNumber()
  @IsLongitude()
  longitude: number;
}

export class GeoPointDto {
  @ApiProperty({
    description: 'GeoJSON type',
    example: 'Point',
    enum: ['Point']
  })
  @IsNotEmpty()
  @IsString()
  type: 'Point';

  @ApiProperty({
    description: 'GeoJSON coordinates [longitude, latitude]',
    example: [2.3522, 48.8566],
    type: [Number]
  })
  @IsNotEmpty()
  @IsArray()
  @IsNumber({}, { each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value) && value.length === 2) {
      return [parseFloat(value[0]), parseFloat(value[1])];
    }
    return value;
  })
  coordinates: [number, number];
}

export class ProximitySearchDto {
  @ApiProperty({
    description: 'Search center coordinates',
    type: GeoCoordinateDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => GeoCoordinateDto)
  center: GeoCoordinateDto;

  @ApiProperty({
    description: 'Search radius in meters',
    example: 5000,
    minimum: 100,
    maximum: 50000
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(100)
  @Max(50000)
  radius: number;

  @ApiPropertyOptional({
    description: 'Maximum number of results',
    example: 20,
    minimum: 1,
    maximum: 100
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Skip number of results for pagination',
    example: 0,
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({
    description: 'Filter by categories',
    example: ['restaurant', 'bakery'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({
    description: 'Filter by tags',
    example: ['organic', 'vegan'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'IDs to exclude from results',
    example: ['507f1f77bcf86cd799439011'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeIds?: string[];

  @ApiPropertyOptional({
    description: 'Sort by distance (default: true)',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  sortByDistance?: boolean = true;
}

export class DistanceCalculationDto {
  @ApiProperty({
    description: 'Origin coordinates',
    type: GeoCoordinateDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => GeoCoordinateDto)
  origin: GeoCoordinateDto;

  @ApiProperty({
    description: 'Destination coordinates',
    type: GeoCoordinateDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => GeoCoordinateDto)
  destination: GeoCoordinateDto;

  @ApiPropertyOptional({
    description: 'Unit for distance calculation',
    example: DistanceUnit.KILOMETERS,
    enum: DistanceUnit
  })
  @IsOptional()
  @IsEnum(DistanceUnit)
  unit?: DistanceUnit = DistanceUnit.KILOMETERS;
}

export class GeoBoundsDto {
  @ApiProperty({
    description: 'Northeast corner coordinates',
    type: GeoCoordinateDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => GeoCoordinateDto)
  northeast: GeoCoordinateDto;

  @ApiProperty({
    description: 'Southwest corner coordinates',
    type: GeoCoordinateDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => GeoCoordinateDto)
  southwest: GeoCoordinateDto;
}

export class GeocodingDto {
  @ApiProperty({
    description: 'Address to geocode',
    example: 'Tour Eiffel, Paris, France'
  })
  @IsNotEmpty()
  @IsString()
  address: string;

  @ApiPropertyOptional({
    description: 'Country code for better accuracy',
    example: 'FR'
  })
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiPropertyOptional({
    description: 'Language for results',
    example: 'fr'
  })
  @IsOptional()
  @IsString()
  language?: string = 'en';

  @ApiPropertyOptional({
    description: 'Maximum number of results',
    example: 5,
    minimum: 1,
    maximum: 10
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  limit?: number = 1;

  @ApiPropertyOptional({
    description: 'Bounding box to restrict search area',
    type: GeoBoundsDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoBoundsDto)
  bounds?: GeoBoundsDto;

  @ApiPropertyOptional({
    description: 'Restrict results to bounding box area only',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  bounded?: boolean = false;
}

export class ReverseGeocodingDto {
  @ApiProperty({
    description: 'Coordinates to reverse geocode',
    type: GeoCoordinateDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => GeoCoordinateDto)
  coordinates: GeoCoordinateDto;

  @ApiPropertyOptional({
    description: 'Language for results',
    example: 'fr'
  })
  @IsOptional()
  @IsString()
  language?: string = 'en';

  @ApiPropertyOptional({
    description: 'Include detailed address components',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  includeDetails?: boolean = true;

  @ApiPropertyOptional({
    description: 'Zoom level for precision (3-18, higher = more precise)',
    example: 18,
    minimum: 3,
    maximum: 18
  })
  @IsOptional()
  @IsNumber()
  @Min(3)
  @Max(18)
  zoom?: number = 18;
}

export class GeofenceDto {
  @ApiProperty({
    description: 'Geofence name',
    example: 'Restaurant pickup zone'
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Center coordinates of the geofence',
    type: GeoCoordinateDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => GeoCoordinateDto)
  center: GeoCoordinateDto;

  @ApiProperty({
    description: 'Radius in meters',
    example: 100,
    minimum: 10,
    maximum: 10000
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(10)
  @Max(10000)
  radius: number;

  @ApiPropertyOptional({
    description: 'Geofence description',
    example: 'Area where customers can pick up orders'
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class GeofenceCheckDto {
  @ApiProperty({
    description: 'Point to check',
    type: GeoCoordinateDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => GeoCoordinateDto)
  point: GeoCoordinateDto;

  @ApiProperty({
    description: 'Geofence configuration',
    type: GeofenceDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => GeofenceDto)
  geofence: GeofenceDto;
}

export class SaveLocationDto {
  @ApiProperty({
    description: 'Location name',
    example: 'My Home'
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Location coordinates',
    type: GeoCoordinateDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => GeoCoordinateDto)
  coordinates: GeoCoordinateDto;

  @ApiProperty({
    description: 'Location category',
    example: LocationCategory.HOME,
    enum: LocationCategory
  })
  @IsNotEmpty()
  @IsEnum(LocationCategory)
  category: LocationCategory;

  @ApiPropertyOptional({
    description: 'Street address',
    example: '123 Main Street'
  })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional({
    description: 'City',
    example: 'Paris'
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Postal code',
    example: '75001'
  })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Country',
    example: 'France'
  })
  @IsOptional()
  @IsString()
  country?: string;
}

export class UpdateLocationPreferencesDto {
  @ApiPropertyOptional({
    description: 'Default search radius in meters',
    example: 5000,
    minimum: 500,
    maximum: 50000
  })
  @IsOptional()
  @IsNumber()
  @Min(500)
  @Max(50000)
  searchRadius?: number;

  @ApiPropertyOptional({
    description: 'Enable automatic location detection',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  autoDetectLocation?: boolean;

  @ApiPropertyOptional({
    description: 'Allow sharing location with establishments',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  shareLocation?: boolean;

  @ApiPropertyOptional({
    description: 'Default location coordinates',
    type: GeoCoordinateDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoCoordinateDto)
  defaultLocation?: GeoCoordinateDto;
}

export class ComprehensiveSearchOptionsDto {
  @ApiPropertyOptional({
    description: 'Include establishments in search results',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  includeEstablishments?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include offers in search results',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  includeOffers?: boolean = true;

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
    description: 'Filter by offer categories',
    example: ['breakfast', 'lunch'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  offerCategories?: string[];

  @ApiPropertyOptional({
    description: 'Minimum rating filter',
    example: 4.0,
    minimum: 0,
    maximum: 5
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({
    description: 'Maximum price filter',
    example: 15.99,
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    description: 'Only include active entries',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  onlyActive?: boolean = true;
}

export class ComprehensiveSearchDto {
  @ApiProperty({
    description: 'Search parameters (location, radius, etc.)',
    type: ProximitySearchDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ProximitySearchDto)
  searchParams: ProximitySearchDto;

  @ApiProperty({
    description: 'Search filter options',
    type: ComprehensiveSearchOptionsDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ComprehensiveSearchOptionsDto)
  options: ComprehensiveSearchOptionsDto;
}

export class RouteCalculationDto {
  @ApiProperty({
    description: 'Origin coordinates',
    type: GeoCoordinateDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => GeoCoordinateDto)
  origin: GeoCoordinateDto;

  @ApiProperty({
    description: 'Destination coordinates',
    type: GeoCoordinateDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => GeoCoordinateDto)
  destination: GeoCoordinateDto;

  @ApiPropertyOptional({
    description: 'Travel mode',
    example: 'walking',
    enum: ['driving', 'walking', 'transit', 'bicycling']
  })
  @IsOptional()
  @IsEnum(['driving', 'walking', 'transit', 'bicycling'])
  mode?: 'driving' | 'walking' | 'transit' | 'bicycling' = 'walking';

  @ApiPropertyOptional({
    description: 'Include turn-by-turn directions',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  includeSteps?: boolean = false;

  @ApiPropertyOptional({
    description: 'Optimize route for traffic',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  avoidTraffic?: boolean = false;
}