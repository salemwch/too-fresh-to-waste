import { Controller, Post, Get, Body, Query, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

import {
  DistanceCalculationDto,
  GeocodingDto,
  ReverseGeocodingDto,
  GeofenceCheckDto,
  GeoCoordinateDto,
} from '../dto/geolocation.dto';
import {
  Distance,
  GeocodingResult,
  ReverseGeocodingResult,
  GeofenceResult,
  GeoCoordinate,
  DistanceUnit,
} from '../interfaces/geolocation.interface';
import { GeolocationService } from '../services/geolocation.service';
import { GooglePlacesService } from '../services/google-places.service';
import { ProximitySearchService } from '../services/proximity-search.service';

import type {
  GoogleAutocompleteSuggestion,
  GoogleLocationResult,
} from '../services/google-places.service';

@ApiTags('Geolocation')
@Controller('geolocation')
export class GeolocationController {
  private readonly logger = new Logger(GeolocationController.name);

  constructor(
    private readonly geolocationService: GeolocationService,
    private readonly _proximitySearchService: ProximitySearchService,
    private readonly googlePlacesService: GooglePlacesService,
  ) {
    void this._proximitySearchService;
  }

  @Post('distance/calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate distance between two coordinates',
    description:
      'Calculate the distance between two geographic coordinates using the Haversine formula',
  })
  @ApiResponse({
    status: 200,
    description: 'Distance calculated successfully',
    schema: {
      type: 'object',
      properties: {
        value: { type: 'number', example: 1.25 },
        unit: { type: 'string', example: 'kilometers' },
        formatted: { type: 'string', example: '1.25 km' },
      },
    },
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
    description:
      'Calculate distances from a single origin point to multiple destination coordinates',
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
          formatted: { type: 'string' },
        },
      },
    },
  })
  calculateDistances(
    @Body()
    body: {
      origin: GeoCoordinateDto;
      destinations: GeoCoordinateDto[];
      unit?: DistanceUnit;
    },
  ): Distance[] {
    this.logger.log(
      `Calculating distances from origin to ${body.destinations.length} destinations`,
    );
    return this.geolocationService.calculateDistances(
      body.origin,
      body.destinations,
      body.unit || DistanceUnit.KILOMETERS,
    );
  }

  @Post('geofence/check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check if point is within geofence',
    description: 'Determine if a given point is within a circular geofenced area',
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
            formatted: { type: 'string' },
          },
        },
        geofence: {
          type: 'object',
          properties: {
            center: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' },
              },
            },
            radius: { type: 'number' },
            name: { type: 'string' },
            description: { type: 'string' },
          },
        },
      },
    },
  })
  checkGeofence(@Body() dto: GeofenceCheckDto): GeofenceResult {
    this.logger.log(`Checking geofence for point`);
    return this.geolocationService.checkGeofence(dto);
  }

  @Post('geocode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Geocode address to coordinates',
    description: 'Convert a text address to geographic coordinates',
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
              longitude: { type: 'number' },
            },
          },
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' },
              postalCode: { type: 'string' },
              country: { type: 'string' },
              formattedAddress: { type: 'string' },
            },
          },
          accuracy: { type: 'string' },
          provider: { type: 'string' },
        },
      },
    },
  })
  async geocodeAddress(@Body() dto: GeocodingDto): Promise<GeocodingResult[]> {
    this.logger.log(`Geocoding address: ${dto.address}`);
    const result = await this.geolocationService.geocodeAddress(dto);
    return result;
  }

  @Post('reverse-geocode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reverse geocode coordinates to address',
    description: 'Convert geographic coordinates to a text address',
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
            longitude: { type: 'number' },
          },
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
              formattedAddress: { type: 'string' },
            },
          },
        },
        primaryAddress: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
            postalCode: { type: 'string' },
            country: { type: 'string' },
            formattedAddress: { type: 'string' },
          },
        },
      },
    },
  })
  async reverseGeocode(@Body() dto: ReverseGeocodingDto): Promise<ReverseGeocodingResult> {
    this.logger.log(`Reverse geocoding coordinates`);
    const result = await this.geolocationService.reverseGeocode(dto);
    return result;
  }

  @Get('bounding-box')
  @ApiOperation({
    summary: 'Get bounding box for circular area',
    description:
      'Calculate the bounding box (northeast and southwest coordinates) for a circular area',
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
            longitude: { type: 'number' },
          },
        },
        southwest: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
          },
        },
      },
    },
  })
  getBoundingBox(
    @Query('latitude') latitude: number,
    @Query('longitude') longitude: number,
    @Query('radius') radius: number,
    @Query('unit') unit: DistanceUnit = DistanceUnit.KILOMETERS,
  ): { northeast: GeoCoordinate; southwest: GeoCoordinate } {
    this.logger.log(`Calculating bounding box for radius ${radius}${unit}`);

    const center: GeoCoordinate = { latitude: +latitude, longitude: +longitude };
    return this.geolocationService.getBoundingBox(center, +radius, unit);
  }

  @Post('center/calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate center point of multiple coordinates',
    description: 'Find the center point (centroid) of multiple geographic coordinates',
  })
  @ApiResponse({
    status: 200,
    description: 'Center point calculated successfully',
    schema: {
      type: 'object',
      properties: {
        latitude: { type: 'number' },
        longitude: { type: 'number' },
      },
    },
  })
  calculateCenter(@Body() body: { coordinates: GeoCoordinateDto[] }): GeoCoordinate {
    this.logger.log(`Calculating center of ${body.coordinates.length} coordinates`);
    return this.geolocationService.calculateCenter(body.coordinates);
  }

  @Post('validate/coordinates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate geographic coordinates',
    description:
      'Check if the provided coordinates are valid (latitude: -90 to 90, longitude: -180 to 180)',
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
            longitude: { type: 'number' },
          },
        },
      },
    },
  })
  validateCoordinates(@Body() coordinate: GeoCoordinateDto): {
    isValid: boolean;
    coordinate: GeoCoordinate;
  } {
    this.logger.log(`Validating coordinates`);

    const isValid = this.geolocationService.validateCoordinates(coordinate);
    return { isValid, coordinate };
  }

  @Get('location/autocomplete')
  @ApiOperation({
    summary: 'Autocomplete locations using Google Places API with session token (Tunisia only)',
    description:
      'Cost-optimized autocomplete endpoint. Returns suggestions WITHOUT coordinates. ' +
      'Use with a session token: all autocomplete requests in a session are FREE. ' +
      'Call GET /location/details with the same session token to get coordinates when user selects a place. ' +
      'The Place Details call concludes the session and is the only billed request.',
  })
  @ApiQuery({
    name: 'query',
    type: 'string',
    description: 'Search query (e.g., "Tunis", "Sousse")',
    required: true,
    example: 'Tunis',
  })
  @ApiQuery({
    name: 'sessionToken',
    type: 'string',
    description: 'Session token (UUID) to group autocomplete requests for billing optimization',
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    type: 'number',
    description: 'Maximum number of results to return',
    required: false,
    example: 5,
  })
  @ApiResponse({
    status: 200,
    description: 'Autocomplete suggestions returned successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'GOOGLE_ChIJZa7pLMDy4RIRkHFwgn4ruUc' },
          name: { type: 'string', example: 'Tunis' },
          nameAr: { type: 'string', example: 'Tunis' },
          subtext: { type: 'string', example: 'Tunis, Tunisia' },
          source: { type: 'string', example: 'GOOGLE' },
          googlePlaceId: { type: 'string', example: 'ChIJZa7pLMDy4RIRkHFwgn4ruUc' },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameter' })
  @ApiResponse({ status: 502, description: 'Google Places API error' })
  async autocompleteLocations(
    @Query('query') query: string,
    @Query('sessionToken') sessionToken?: string,
    @Query('limit') limit?: number,
  ): Promise<GoogleAutocompleteSuggestion[]> {
    this.logger.log(
      `Autocomplete: "${query}" (session: ${sessionToken ? 'active' : 'none'}, limit: ${limit || 'default'})`,
    );

    if (!query || query.trim().length < 2) {
      this.logger.warn('Invalid autocomplete query - too short');
      return [];
    }

    const result = await this.googlePlacesService.autocomplete(query, sessionToken, limit);
    return result;
  }

  @Get('location/details')
  @ApiOperation({
    summary: 'Get place details by Google Place ID (concludes session)',
    description:
      'Fetches full place details including coordinates for a specific Google Place ID. ' +
      'This call concludes the session token billing session. ' +
      'After this call, generate a new session token for the next search session.',
  })
  @ApiQuery({
    name: 'placeId',
    type: 'string',
    description: 'Google Place ID from autocomplete results',
    required: true,
    example: 'ChIJZa7pLMDy4RIRkHFwgn4ruUc',
  })
  @ApiQuery({
    name: 'sessionToken',
    type: 'string',
    description: 'Same session token used in autocomplete requests (concludes the session)',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Place details returned successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'GOOGLE_ChIJZa7pLMDy4RIRkHFwgn4ruUc' },
        name: { type: 'string', example: 'Tunis' },
        nameAr: { type: 'string', example: 'Tunis' },
        subtext: { type: 'string', example: 'Tunis, Tunisia' },
        coords: {
          type: 'object',
          properties: {
            lat: { type: 'number', example: 36.8065 },
            lng: { type: 'number', example: 10.1815 },
          },
        },
        source: { type: 'string', example: 'GOOGLE' },
        formattedAddress: { type: 'string', example: 'Tunis, Tunisia' },
        googlePlaceId: { type: 'string', example: 'ChIJZa7pLMDy4RIRkHFwgn4ruUc' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid placeId parameter' })
  @ApiResponse({ status: 404, description: 'Place not found' })
  @ApiResponse({ status: 502, description: 'Google Places API error' })
  async getPlaceDetails(
    @Query('placeId') placeId: string,
    @Query('sessionToken') sessionToken?: string,
  ): Promise<GoogleLocationResult | null> {
    this.logger.log(`Place Details: ${placeId} (session: ${sessionToken ? 'concluding' : 'none'})`);

    if (!placeId || placeId.trim().length === 0) {
      this.logger.warn('Invalid placeId - empty');
      return null;
    }

    const result = await this.googlePlacesService.getPlaceDetailsById(placeId, sessionToken);
    return result;
  }
}
