import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ProximitySearchDto, ComprehensiveSearchDto } from '../dto/geolocation.dto';
import {
  ProximitySearchResult,
  EstablishmentGeoData,
  OfferGeoData,
  MapEstablishmentGeoData,
  GeoCoordinate,
} from '../interfaces/geolocation.interface';
import {
  ProximitySearchService,
  ProximitySearchOptions,
} from '../services/proximity-search.service';

@ApiTags('Proximity Search')
@Controller('proximity-search')
export class ProximitySearchController {
  private readonly logger = new Logger(ProximitySearchController.name);

  constructor(private readonly proximitySearchService: ProximitySearchService) {}

  @Post('establishments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search establishments within proximity',
    description:
      'Find establishments (restaurants, stores) within a specified radius of given coordinates',
  })
  @ApiResponse({
    status: 200,
    description: 'Establishments found successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              name: { type: 'string' },
              type: { type: 'string' },
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
              coordinates: {
                type: 'object',
                properties: {
                  latitude: { type: 'number' },
                  longitude: { type: 'number' },
                },
              },
              averageRating: { type: 'number' },
              totalOffers: { type: 'number' },
              isActive: { type: 'boolean' },
              isVerified: { type: 'boolean' },
            },
          },
          distance: {
            type: 'object',
            properties: {
              value: { type: 'number' },
              unit: { type: 'string' },
              formatted: { type: 'string' },
            },
          },
          geoData: {
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
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid search parameters' })
  async searchEstablishments(
    @Body() searchDto: ProximitySearchDto,
    @Query('establishmentTypes') establishmentTypes?: string[],
    @Query('minRating') minRating?: number,
    @Query('onlyActive') onlyActive?: boolean,
  ): Promise<ProximitySearchResult<EstablishmentGeoData>[]> {
    this.logger.log(`Searching establishments within ${searchDto.radius}m radius`);

    const options: ProximitySearchOptions = {
      establishmentTypes: establishmentTypes?.length ? establishmentTypes : undefined,
      minRating: minRating ? +minRating : undefined,
      onlyActive: onlyActive !== false,
    };

    const result = await this.proximitySearchService.searchEstablishments(searchDto, options);
    return result;
  }

  @Post('map-establishments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search establishments with active offers for map view',
    description:
      'Returns establishments within radius, each enriched with their active offers. Public endpoint for map markers.',
  })
  @ApiResponse({
    status: 200,
    description: 'Map establishments found successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid search parameters' })
  async searchMapEstablishments(
    @Body() searchDto: ProximitySearchDto,
    @Query('establishmentTypes') establishmentTypes?: string[],
    @Query('minRating') minRating?: number,
  ): Promise<ProximitySearchResult<MapEstablishmentGeoData>[]> {
    this.logger.log(`Searching map establishments within ${searchDto.radius}m radius`);

    const options: ProximitySearchOptions = {
      establishmentTypes: establishmentTypes?.length ? establishmentTypes : undefined,
      minRating: minRating ? +minRating : undefined,
      onlyActive: true,
    };

    const result = await this.proximitySearchService.searchMapEstablishments(searchDto, options);
    return result;
  }

  @Post('offers')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Search offers within proximity',
    description: 'Find available food offers within a specified radius of given coordinates',
  })
  @ApiResponse({
    status: 200,
    description: 'Offers found successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              title: { type: 'string' },
              establishmentId: { type: 'string' },
              establishmentName: { type: 'string' },
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
              pricing: {
                type: 'object',
                properties: {
                  originalPrice: { type: 'number' },
                  discountedPrice: { type: 'number' },
                  discountPercentage: { type: 'number' },
                  currency: { type: 'string' },
                },
              },
              availableUntil: { type: 'string', format: 'date-time' },
              availableQuantity: { type: 'number' },
              categories: { type: 'array', items: { type: 'string' } },
              images: { type: 'array', items: { type: 'string' } },
            },
          },
          distance: {
            type: 'object',
            properties: {
              value: { type: 'number' },
              unit: { type: 'string' },
              formatted: { type: 'string' },
            },
          },
          geoData: {
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
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid search parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async searchOffers(
    @Body() searchDto: ProximitySearchDto,
    @Query('offerCategories') offerCategories?: string[],
    @Query('maxPrice') maxPrice?: number,
    @Query('onlyActive') onlyActive?: boolean,
  ): Promise<ProximitySearchResult<OfferGeoData>[]> {
    this.logger.log(`Searching offers within ${searchDto.radius}m radius`);

    const options: ProximitySearchOptions = {
      offerCategories: offerCategories?.length ? offerCategories : undefined,
      maxPrice: maxPrice ? +maxPrice : undefined,
      onlyActive: onlyActive !== false,
    };

    const result = await this.proximitySearchService.searchOffers(searchDto, options);
    return result;
  }

  @Post('all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Search both establishments and offers within proximity',
    description:
      'Find both establishments and offers within a specified radius for comprehensive results',
  })
  @ApiResponse({
    status: 200,
    description: 'Combined search results',
    schema: {
      type: 'object',
      properties: {
        establishments: {
          type: 'array',
          items: {
            type: 'object',
            description: 'Establishment search result',
          },
        },
        offers: {
          type: 'array',
          items: {
            type: 'object',
            description: 'Offer search result',
          },
        },
        totalResults: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid search parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async searchAll(@Body() searchRequest: ComprehensiveSearchDto): Promise<{
    establishments: ProximitySearchResult<EstablishmentGeoData>[];
    offers: ProximitySearchResult<OfferGeoData>[];
    totalResults: number;
  }> {
    this.logger.log(`Comprehensive search within ${searchRequest.searchParams.radius}m radius`);

    const options: ProximitySearchOptions = {
      includeEstablishments: searchRequest.options.includeEstablishments,
      includeOffers: searchRequest.options.includeOffers,
      establishmentTypes: searchRequest.options.establishmentTypes?.length
        ? searchRequest.options.establishmentTypes
        : undefined,
      offerCategories: searchRequest.options.offerCategories?.length
        ? searchRequest.options.offerCategories
        : undefined,
      minRating: searchRequest.options.minRating,
      maxPrice: searchRequest.options.maxPrice,
      onlyActive: searchRequest.options.onlyActive,
    };

    const result = await this.proximitySearchService.searchAll(searchRequest.searchParams, options);
    return result;
  }

  @Get('nearby-establishments/:offerId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get nearby establishments for a specific offer',
    description: 'Find establishments near a specific offer location for recommendations',
  })
  @ApiQuery({
    name: 'radius',
    type: 'number',
    required: false,
    description: 'Search radius in meters (default: 2000)',
  })
  @ApiResponse({
    status: 200,
    description: 'Nearby establishments found',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        description: 'Establishment search result',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid offer ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async getNearbyEstablishments(
    @Query('offerId') offerId: string,
    @Query('radius') radius?: number,
  ): Promise<ProximitySearchResult<EstablishmentGeoData>[]> {
    this.logger.log(`Finding establishments near offer ${offerId}`);

    const result = await this.proximitySearchService.getNearbyEstablishments(
      offerId,
      radius ? +radius : 2000,
    );
    return result;
  }

  @Post('delivery-radius')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get establishments within delivery radius',
    description: 'Find establishments that can deliver to or be picked up from user location',
  })
  @ApiResponse({
    status: 200,
    description: 'Establishments within delivery radius',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        description: 'Establishment search result with delivery information',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid user location' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getEstablishmentsInDeliveryRadius(
    @Body() body: { userLocation: { latitude: number; longitude: number }; maxRadius?: number },
  ): Promise<ProximitySearchResult<EstablishmentGeoData>[]> {
    this.logger.log(`Finding establishments in delivery radius`);

    const userLocation: GeoCoordinate = {
      latitude: body.userLocation.latitude,
      longitude: body.userLocation.longitude,
    };

    const result = await this.proximitySearchService.getEstablishmentsInDeliveryRadius(
      userLocation,
      body.maxRadius || 10000,
    );
    return result;
  }

  @Get('quick-search')
  @ApiOperation({
    summary: 'Quick proximity search with query parameters',
    description: 'Quick search for establishments using query parameters instead of request body',
  })
  @ApiQuery({ name: 'latitude', type: 'number', description: 'Search center latitude' })
  @ApiQuery({ name: 'longitude', type: 'number', description: 'Search center longitude' })
  @ApiQuery({ name: 'radius', type: 'number', description: 'Search radius in meters' })
  @ApiQuery({
    name: 'limit',
    type: 'number',
    required: false,
    description: 'Max results (default: 20)',
  })
  @ApiQuery({
    name: 'categories',
    type: 'string',
    required: false,
    description: 'Comma-separated categories',
  })
  @ApiQuery({
    name: 'onlyActive',
    type: 'boolean',
    required: false,
    description: 'Only active establishments',
  })
  @ApiResponse({
    status: 200,
    description: 'Quick search results',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        description: 'Establishment search result',
      },
    },
  })
  async quickSearch(
    @Query('latitude', ParseIntPipe) latitude: number,
    @Query('longitude', ParseIntPipe) longitude: number,
    @Query('radius', ParseIntPipe) radius: number,
    @Query('limit') limit?: number,
    @Query('categories') categories?: string,
    @Query('onlyActive') onlyActive?: boolean,
  ): Promise<ProximitySearchResult<EstablishmentGeoData>[]> {
    this.logger.log(`Quick search at ${latitude},${longitude} within ${radius}m`);

    const searchDto: ProximitySearchDto = {
      center: { latitude, longitude },
      radius,
      limit: limit ? +limit : 20,
      categories: categories ? categories.split(',').map((c) => c.trim()) : undefined,
    };

    const options: ProximitySearchOptions = {
      onlyActive: onlyActive !== false,
    };

    const result = await this.proximitySearchService.searchEstablishments(searchDto, options);
    return result;
  }
}
