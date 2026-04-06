import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import {
  SaveLocationDto,
  UpdateLocationPreferencesDto,
  GeoCoordinateDto,
} from '../dto/geolocation.dto';
import {
  UserLocationPreferences,
  SavedLocation,
  LocationHistoryEntry,
  LocationCategory,
  LocationSource,
  GeoCoordinate,
} from '../interfaces/geolocation.interface';
import { UserLocationService } from '../services/user-location.service';

@ApiTags('User Locations')
@Controller('user-locations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserLocationController {
  private readonly logger = new Logger(UserLocationController.name);

  constructor(private readonly userLocationService: UserLocationService) {}

  @Get('preferences')
  @ApiOperation({
    summary: 'Get user location preferences',
    description: "Retrieve the current user's location preferences and settings",
  })
  @ApiResponse({
    status: 200,
    description: 'Location preferences retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        defaultLocation: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
          },
        },
        searchRadius: { type: 'number', example: 5000 },
        savedLocations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
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
              category: { type: 'string', enum: Object.values(LocationCategory) },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        locationHistory: {
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
              timestamp: { type: 'string', format: 'date-time' },
              accuracy: { type: 'number' },
              source: { type: 'string', enum: Object.values(LocationSource) },
            },
          },
        },
        autoDetectLocation: { type: 'boolean' },
        shareLocation: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getLocationPreferences(@GetUser('id') userId: string): Promise<UserLocationPreferences> {
    this.logger.log(`Getting location preferences for user ${userId}`);
    const result = await this.userLocationService.getUserLocationPreferences(userId);
    return result;
  }

  @Put('preferences')
  @ApiOperation({
    summary: 'Update user location preferences',
    description: "Update the current user's location preferences and settings",
  })
  @ApiResponse({
    status: 200,
    description: 'Location preferences updated successfully',
    schema: {
      type: 'object',
      description: 'Updated location preferences',
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid preferences data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateLocationPreferences(
    @GetUser('id') userId: string,
    @Body() dto: UpdateLocationPreferencesDto,
  ): Promise<UserLocationPreferences> {
    this.logger.log(`Updating location preferences for user ${userId}`);
    const result = await this.userLocationService.updateLocationPreferences(userId, dto);
    return result;
  }

  @Get('current')
  @ApiOperation({
    summary: 'Get user current location',
    description: "Get the user's current or last known location",
  })
  @ApiResponse({
    status: 200,
    description: 'Current location retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        latitude: { type: 'number' },
        longitude: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'No location found' })
  async getCurrentLocation(@GetUser('id') userId: string): Promise<GeoCoordinate | null> {
    this.logger.log(`Getting current location for user ${userId}`);
    const result = await this.userLocationService.getUserCurrentLocation(userId);
    return result;
  }

  @Get('saved')
  @ApiOperation({
    summary: 'Get user saved locations',
    description: 'Retrieve all saved locations for the current user',
  })
  @ApiQuery({
    name: 'category',
    enum: LocationCategory,
    required: false,
    description: 'Filter by location category',
  })
  @ApiResponse({
    status: 200,
    description: 'Saved locations retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        description: 'Saved location object',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSavedLocations(
    @GetUser('id') userId: string,
    @Query('category') category?: LocationCategory,
  ): Promise<SavedLocation[]> {
    this.logger.log(
      `Getting saved locations for user ${userId}${category !== undefined ? ` with category ${category}` : ''}`,
    );

    if (category !== undefined) {
      const categoryResult = await this.userLocationService.getSavedLocationsByCategory(
        userId,
        category,
      );
      return categoryResult;
    }

    const result = await this.userLocationService.getSavedLocations(userId);
    return result;
  }

  @Post('saved')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Save a new location',
    description: "Save a new location to the user's saved locations list",
  })
  @ApiResponse({
    status: 201,
    description: 'Location saved successfully',
    schema: {
      type: 'object',
      description: 'Saved location object',
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid location data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async saveLocation(
    @GetUser('id') userId: string,
    @Body() dto: SaveLocationDto,
  ): Promise<SavedLocation> {
    this.logger.log(`Saving location "${dto.name}" for user ${userId}`);
    const result = await this.userLocationService.saveUserLocation(userId, dto);
    return result;
  }

  @Put('saved/:locationId')
  @ApiOperation({
    summary: 'Update saved location',
    description: 'Update an existing saved location',
  })
  @ApiParam({ name: 'locationId', description: 'Saved location ID' })
  @ApiResponse({
    status: 200,
    description: 'Location updated successfully',
    schema: {
      type: 'object',
      description: 'Updated location object',
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid location data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Location not found' })
  async updateSavedLocation(
    @GetUser('id') userId: string,
    @Param('locationId') locationId: string,
    @Body() updates: Partial<SaveLocationDto>,
  ): Promise<SavedLocation> {
    this.logger.log(`Updating saved location ${locationId} for user ${userId}`);
    const result = await this.userLocationService.updateSavedLocation(userId, locationId, updates);
    return result;
  }

  @Delete('saved/:locationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete saved location',
    description: "Remove a saved location from user's list",
  })
  @ApiParam({ name: 'locationId', description: 'Saved location ID' })
  @ApiResponse({ status: 204, description: 'Location deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Location not found' })
  async deleteSavedLocation(
    @GetUser('id') userId: string,
    @Param('locationId') locationId: string,
  ): Promise<void> {
    this.logger.log(`Deleting saved location ${locationId} for user ${userId}`);
    await this.userLocationService.deleteSavedLocation(userId, locationId);
  }

  @Post('history')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record location in history',
    description: "Add a location entry to the user's location history",
  })
  @ApiResponse({ status: 201, description: 'Location recorded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid location data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async recordLocationHistory(
    @GetUser('id') userId: string,
    @Body()
    body: {
      coordinates: GeoCoordinateDto;
      accuracy?: number;
      source?: LocationSource;
    },
  ): Promise<void> {
    this.logger.log(`Recording location history for user ${userId}`);
    await this.userLocationService.recordLocationHistory(
      userId,
      body.coordinates,
      body.accuracy,
      body.source,
    );
  }

  @Get('history')
  @ApiOperation({
    summary: 'Get location history',
    description: "Retrieve user's location history with optional limit",
  })
  @ApiQuery({
    name: 'limit',
    type: 'number',
    required: false,
    description: 'Maximum number of history entries (default: 50)',
  })
  @ApiResponse({
    status: 200,
    description: 'Location history retrieved successfully',
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
          timestamp: { type: 'string', format: 'date-time' },
          accuracy: { type: 'number' },
          source: { type: 'string', enum: Object.values(LocationSource) },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getLocationHistory(
    @GetUser('id') userId: string,
    @Query('limit') limit?: number,
  ): Promise<LocationHistoryEntry[]> {
    this.logger.log(`Getting location history for user ${userId}`);
    const result = await this.userLocationService.getLocationHistory(userId, limit ? +limit : 50);
    return result;
  }

  @Delete('history')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Clear location history',
    description: 'Clear all location history entries for the user',
  })
  @ApiResponse({ status: 204, description: 'Location history cleared successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async clearLocationHistory(@GetUser('id') userId: string): Promise<void> {
    this.logger.log(`Clearing location history for user ${userId}`);
    await this.userLocationService.clearLocationHistory(userId);
  }

  @Get('nearby-saved')
  @ApiOperation({
    summary: 'Find nearby saved locations',
    description: "Find user's saved locations near a specific coordinate",
  })
  @ApiQuery({ name: 'latitude', type: 'number', description: 'Search center latitude' })
  @ApiQuery({ name: 'longitude', type: 'number', description: 'Search center longitude' })
  @ApiQuery({
    name: 'radius',
    type: 'number',
    required: false,
    description: 'Search radius in meters (default: 1000)',
  })
  @ApiResponse({
    status: 200,
    description: 'Nearby saved locations found',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
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
          category: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          distance: { type: 'number', description: 'Distance in meters' },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid coordinates' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findNearbySavedLocations(
    @GetUser('id') userId: string,
    @Query('latitude') latitude: number,
    @Query('longitude') longitude: number,
    @Query('radius') radius?: number,
  ): Promise<Array<SavedLocation & { distance: number }>> {
    this.logger.log(`Finding nearby saved locations for user ${userId}`);

    const center: GeoCoordinate = {
      latitude: +latitude,
      longitude: +longitude,
    };

    const result = await this.userLocationService.findNearbySavedLocations(
      userId,
      center,
      radius ? +radius : 1000,
    );
    return result;
  }
}
