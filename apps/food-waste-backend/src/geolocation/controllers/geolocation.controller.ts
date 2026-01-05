import { Controller, Post, Get, Body, Query, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse,  ApiQuery } from '@nestjs/swagger';
import { GeolocationService } from '../services/geolocation.service';
import { ProximitySearchService } from '../services/proximity-search.service';
import {
  DistanceCalculationDto,
  GeocodingDto,
  ReverseGeocodingDto,
  GeofenceCheckDto,
  GeoCoordinateDto
} from '../dto/geolocation.dto';
import {
  Distance,
  GeocodingResult,
  ReverseGeocodingResult,
  GeofenceResult,
  GeoCoordinate,
  DistanceUnit
} from '../interfaces/geolocation.interface';

@ApiTags('Geolocation')
@Controller('geolocation')
export class GeolocationController {
  private readonly logger = new Logger(GeolocationController.name);

  constructor(
    private readonly geolocationService: GeolocationService,
    private readonly proximitySearchService: ProximitySearchService,
  ) {}

  @Post('distance/calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate distance between two coordinates',
    description: 'Calculate the distance between two geographic coordinates using the Haversine formula'
  })
  @ApiResponse({
    status: 200,
    description: 'Distance calculated successfully',
    schema: {
      type: 'object',
      properties: {
        value: { type: 'number', example: 1.25 },
        unit: { type: 'string', example: 'kilometers' },
        formatted: { type: 'string', example: '1.25 km' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid coordinates provided' })
  calculateDistance(@Body() dto: DistanceCalculationDto): Distance {
    this.logger.log(`Calculating distance between coordinates`);
    return this.geolocationService.calculateDistance(dto);
  }

  @Post('distances/calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate distances from one origin to multiple destinations',
    description: 'Calculate distances from a single origin point to multiple destination coordinates'
  })
  @ApiResponse({
    status: 200,
    description: 'Distances calculated successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          value: { type: 'number' },
          unit: { type: 'string' },
          formatted: { type: 'string' }
        }
      }
    }
  })
  calculateDistances(
    @Body() body: {
      origin: GeoCoordinateDto;
      destinations: GeoCoordinateDto[];
      unit?: DistanceUnit;
    }
  ): Distance[] {
    this.logger.log(`Calculating distances from origin to ${body.destinations.length} destinations`);
    return this.geolocationService.calculateDistances(
      body.origin,
      body.destinations,
      body.unit || DistanceUnit.KILOMETERS
    );
  }

  @Post('geofence/check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check if point is within geofence',
    description: 'Determine if a given point is within a circular geofenced area'
  })
  @ApiResponse({
    status: 200,
    description: 'Geofence check completed',
    schema: {
      type: 'object',
      properties: {
        isInside: { type: 'boolean', example: true },
        distance: {
          type: 'object',
          properties: {
            value: { type: 'number' },
            unit: { type: 'string' },
            formatted: { type: 'string' }
          }
        },
        geofence: {
          type: 'object',
          properties: {
            center: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              }
            },
            radius: { type: 'number' },
            name: { type: 'string' },
            description: { type: 'string' }
          }
        }
      }
    }
  })
  checkGeofence(@Body() dto: GeofenceCheckDto): GeofenceResult {
    this.logger.log(`Checking geofence for point`);
    return this.geolocationService.checkGeofence(dto);
  }

  @Post('geocode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Geocode address to coordinates',
    description: 'Convert a text address to geographic coordinates'
  })
  @ApiResponse({
    status: 200,
    description: 'Address geocoded successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          coordinates: {
            type: 'object',
            properties: {
              latitude: { type: 'number' },
              longitude: { type: 'number' }
            }
          },
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' },
              postalCode: { type: 'string' },
              country: { type: 'string' },
              formattedAddress: { type: 'string' }
            }
          },
          accuracy: { type: 'string' },
          provider: { type: 'string' }
        }
      }
    }
  })
  geocodeAddress(@Body() dto: GeocodingDto): Promise<GeocodingResult[]> {
    this.logger.log(`Geocoding address: ${dto.address}`);
    return this.geolocationService.geocodeAddress(dto);
  }

  @Post('reverse-geocode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reverse geocode coordinates to address',
    description: 'Convert geographic coordinates to a text address'
  })
  @ApiResponse({
    status: 200,
    description: 'Coordinates reverse geocoded successfully',
    schema: {
      type: 'object',
      properties: {
        coordinates: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' }
          }
        },
        addresses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' },
              postalCode: { type: 'string' },
              country: { type: 'string' },
              formattedAddress: { type: 'string' }
            }
          }
        },
        primaryAddress: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
            postalCode: { type: 'string' },
            country: { type: 'string' },
            formattedAddress: { type: 'string' }
          }
        }
      }
    }
  })
  reverseGeocode(@Body() dto: ReverseGeocodingDto): Promise<ReverseGeocodingResult> {
    this.logger.log(`Reverse geocoding coordinates`);
    return this.geolocationService.reverseGeocode(dto);
  }

  @Get('bounding-box')
  @ApiOperation({
    summary: 'Get bounding box for circular area',
    description: 'Calculate the bounding box (northeast and southwest coordinates) for a circular area'
  })
  @ApiQuery({ name: 'latitude', type: 'number', description: 'Center latitude' })
  @ApiQuery({ name: 'longitude', type: 'number', description: 'Center longitude' })
  @ApiQuery({ name: 'radius', type: 'number', description: 'Radius value' })
  @ApiQuery({ name: 'unit', enum: DistanceUnit, required: false, description: 'Distance unit' })
  @ApiResponse({
    status: 200,
    description: 'Bounding box calculated successfully',
    schema: {
      type: 'object',
      properties: {
        northeast: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' }
          }
        },
        southwest: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' }
          }
        }
      }
    }
  })
  getBoundingBox(
    @Query('latitude') latitude: number,
    @Query('longitude') longitude: number,
    @Query('radius') radius: number,
    @Query('unit') unit: DistanceUnit = DistanceUnit.KILOMETERS
  ): { northeast: GeoCoordinate; southwest: GeoCoordinate } {
    this.logger.log(`Calculating bounding box for radius ${radius}${unit}`);

    const center: GeoCoordinate = { latitude: +latitude, longitude: +longitude };
    return this.geolocationService.getBoundingBox(center, +radius, unit);
  }

  @Post('center/calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate center point of multiple coordinates',
    description: 'Find the center point (centroid) of multiple geographic coordinates'
  })
  @ApiResponse({
    status: 200,
    description: 'Center point calculated successfully',
    schema: {
      type: 'object',
      properties: {
        latitude: { type: 'number' },
        longitude: { type: 'number' }
      }
    }
  })
  calculateCenter(@Body() body: { coordinates: GeoCoordinateDto[] }): GeoCoordinate {
    this.logger.log(`Calculating center of ${body.coordinates.length} coordinates`);
    return this.geolocationService.calculateCenter(body.coordinates);
  }

  @Post('validate/coordinates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate geographic coordinates',
    description: 'Check if the provided coordinates are valid (latitude: -90 to 90, longitude: -180 to 180)'
  })
  @ApiResponse({
    status: 200,
    description: 'Coordinate validation result',
    schema: {
      type: 'object',
      properties: {
        isValid: { type: 'boolean' },
        coordinate: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' }
          }
        }
      }
    }
  })
  validateCoordinates(@Body() coordinate: GeoCoordinateDto): { isValid: boolean; coordinate: GeoCoordinate } {
    this.logger.log(`Validating coordinates`);

    const isValid = this.geolocationService.validateCoordinates(coordinate);
    return { isValid, coordinate };
  }
}