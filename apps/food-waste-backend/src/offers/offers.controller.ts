import { UserRole } from '@foodwaste/shared';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  ParseFloatPipe,
  DefaultValuePipe,
  Put,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiQuery } from '@nestjs/swagger';

import { SafeUserResponse } from '../auth/DTO/safe-user-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GetUser, AuthenticatedRequest } from '../common/decorators/get-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SupabaseStorageService } from '../common/services/supabase-storage.service';
import { QueryOptimizer } from '../common/utils/query-optimization.util';

import { CreateOfferDto } from './DTO/create-offer.dto';
import { ReactivateOfferDto } from './DTO/reactivate-offer.dto';
import { SearchOffersDto } from './DTO/search-offers.dto';
import { UpdateOfferDto } from './DTO/update-offer.dto';
import { OffersService } from './offers.service';
import { OfferStatus } from './schemas/offer.schema';
import { strictValidation } from '../common/pipes/validation-pipes';

@ApiTags('Offers Management')
@Controller('offers')
@UseGuards(JwtAuthGuard)
export class OffersController {
  constructor(
    private readonly offersService: OffersService,
    private readonly supabaseStorageService: SupabaseStorageService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.LOCATION_MANAGER)
  @UseInterceptors(FilesInterceptor('images', 5))
  @ApiOperation({
    summary: '📝 Create New Food Offer',
    description:
      'Create a new surplus food offer with images. Merchants can upload up to 5 images per offer.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: '✅ Offer created successfully',
    schema: {
      example: {
        message: 'Offer created successfully',
        data: {
          id: '507f1f77bcf86cd799439011',
          title: 'Fresh Bakery Surprise Bag',
          description: "Delicious pastries and bread from today's batch",
          images: [
            'https://storage.googleapis.com/waste-food-d479c.appspot.com/offers/bakery_items_1625097600000_abc123.jpg',
          ],
          pricing: {
            originalPrice: 15.0,
            discountedPrice: 5.99,
            discountPercentage: 60,
          },
          status: 'draft',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: '❌ Invalid offer data or image upload failed' })
  @ApiResponse({ status: 401, description: '❌ Unauthorized' })
  @ApiResponse({ status: 403, description: '❌ Forbidden - Only merchants can create offers' })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createOfferDto: CreateOfferDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const uploadedFiles = files ?? [];
      let imageUrls: string[] = [];

      // Upload images to Supabase Storage if provided
      if (uploadedFiles.length > 0) {
        const uploadResults = await this.supabaseStorageService.uploadFiles(uploadedFiles, {
          folder: 'offers',
          makePublic: true,
          metadata: { uploadedBy: req.user.userId, category: 'offer-image' },
          imageProcessing: {
            maxWidth: 800,
            maxHeight: 600,
            quality: 80,
            format: 'jpeg',
          },
        });

        imageUrls = uploadResults.map(result => result.downloadURL);
      }

      // Create offer with uploaded image URLs
      const offerData = {
        ...createOfferDto,
        images: imageUrls,
      };

      const offer = await this.offersService.create(
        offerData,
        req.user.userId,
        req.user.role,
        req.user.assignedEstablishmentId,
      );

      return {
        message: 'Offer created successfully',
        data: offer,
      };
    } catch (error) {
      throw error;
    }
  }

  @Get()
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
    @Query(strictValidation()) filters: SearchOffersDto,
    @GetUser() user: SafeUserResponse,
  ) {
    // latitude/longitude are handled by SearchOffersDto (class-transformer)
    // and used by findAll service via filters.latitude / filters.longitude
    const result = await this.offersService.findAll(page, limit, filters, user.userId);

    return {
      message: 'Offers retrieved successfully',
      data: result.data, // ✅ Service now returns { data, total }
      meta: QueryOptimizer.getPaginationMeta(result.total, page, limit),
    };
  }

  @Get('pickup-today')
  @ApiOperation({
    summary: '📅 Get Offers Available for Pickup Today',
    description:
      'Returns all active offers where pickup window overlaps with today (00:00 - 23:59 Africa/Tunis timezone)',
  })
  @ApiResponse({
    status: 200,
    description: '✅ Pickup today offers retrieved successfully',
    schema: {
      example: {
        message: 'Pickup today offers retrieved successfully',
        data: [
          {
            id: '507f1f77bcf86cd799439011',
            title: 'Fresh Bakery Surprise Bag',
            availableFrom: '2026-01-20T06:00:00.000Z',
            availableUntil: '2026-01-20T20:00:00.000Z',
            pricing: {
              originalPrice: 15.0,
              discountedPrice: 5.99,
              discountPercentage: 60,
            },
          },
        ],
        meta: {
          page: 1,
          limit: 20,
          total: 15,
          totalPages: 1,
        },
      },
    },
  })
  async getPickupTodayOffers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @GetUser() user: SafeUserResponse,
    @Query('latitude', new ParseFloatPipe({ optional: true })) latitude?: number,
    @Query('longitude', new ParseFloatPipe({ optional: true })) longitude?: number,
    @Query('maxDistance', new ParseFloatPipe({ optional: true })) maxDistance?: number,
    /*
     * Repeated (`?establishmentTypes=a&establishmentTypes=b`) or comma-joined.
     * Left untyped here on purpose: normalisation, validation and de-duping all
     * happen in one place in the service, via
     * `resolveEstablishmentTypeFilter`. Parsing it twice is how the query and
     * the cache key drift apart.
     */
    @Query('establishmentTypes') establishmentTypes?: string | string[],
  ) {
    const userLocation =
      latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined;

    const result = await this.offersService.getPickupTodayOffers(
      page,
      limit,
      user.userId,
      userLocation,
      maxDistance,
      establishmentTypes,
    );

    return {
      message: 'Pickup today offers retrieved successfully',
      data: result.data, // ✅ Service now returns { data, total }
      meta: QueryOptimizer.getPaginationMeta(result.total, page, limit),
    };
  }

  @Get('pickup-tomorrow')
  @ApiOperation({
    summary: '📅 Get Offers Available for Pickup Tomorrow',
    description:
      'Returns all active offers where pickup window overlaps with tomorrow (00:00 - 23:59 Africa/Tunis timezone)',
  })
  @ApiResponse({
    status: 200,
    description: '✅ Pickup tomorrow offers retrieved successfully',
    schema: {
      example: {
        message: 'Pickup tomorrow offers retrieved successfully',
        data: [
          {
            id: '507f1f77bcf86cd799439012',
            title: 'Restaurant Lunch Bundle',
            availableFrom: '2026-01-21T11:00:00.000Z',
            availableUntil: '2026-01-21T15:00:00.000Z',
            pricing: {
              originalPrice: 25.0,
              discountedPrice: 9.99,
              discountPercentage: 60,
            },
          },
        ],
        meta: {
          page: 1,
          limit: 20,
          total: 8,
          totalPages: 1,
        },
      },
    },
  })
  async getPickupTomorrowOffers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @GetUser() user: SafeUserResponse,
    @Query('latitude', new ParseFloatPipe({ optional: true })) latitude?: number,
    @Query('longitude', new ParseFloatPipe({ optional: true })) longitude?: number,
    @Query('maxDistance', new ParseFloatPipe({ optional: true })) maxDistance?: number,
    /*
     * Repeated (`?establishmentTypes=a&establishmentTypes=b`) or comma-joined.
     * Left untyped here on purpose: normalisation, validation and de-duping all
     * happen in one place in the service, via
     * `resolveEstablishmentTypeFilter`. Parsing it twice is how the query and
     * the cache key drift apart.
     */
    @Query('establishmentTypes') establishmentTypes?: string | string[],
  ) {
    const userLocation =
      latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined;

    const result = await this.offersService.getPickupTomorrowOffers(
      page,
      limit,
      user.userId,
      userLocation,
      maxDistance,
      establishmentTypes,
    );

    return {
      message: 'Pickup tomorrow offers retrieved successfully',
      data: result.data, // ✅ Service now returns { data, total }
      meta: QueryOptimizer.getPaginationMeta(result.total, page, limit),
    };
  }

  @Get('featured')
  async getFeaturedOffers(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @GetUser() user: SafeUserResponse,
  ) {
    const result = await this.offersService.getFeaturedOffers(1, limit, user.userId);

    return {
      message: 'Featured offers retrieved successfully',
      data: result.data, // ✅ Service now returns { data, total }
    };
  }

  /**
   * Get urgent offers (expiring soon)
   *
   * @description Returns offers expiring within a specified time window (default: 1 hour)
   * This endpoint is designed for "Urgent Deals" sections that need to show
   * offers based on actual time remaining, not manual/auto featuring flags.
   *
   * @param hoursUntilExpiry - Maximum hours until expiry (default: 1)
   * @param limit - Maximum number of offers to return (default: 10, max: 100)
   * @param latitude - Optional user latitude for distance calculation
   * @param longitude - Optional user longitude for distance calculation
   *
   * @returns Offers sorted by soonest expiring first
   *
   * @example
   * GET /offers/urgent?hoursUntilExpiry=1&limit=10&latitude=40.7128&longitude=-74.0060
   */
  @Get('urgent')
  @ApiOperation({
    summary: '🚨 Get urgent offers (expiring soon)',
    description:
      'Returns offers expiring within a specified time window. Sorted by soonest expiring first.',
  })
  @ApiResponse({
    status: 200,
    description: '✅ Urgent offers retrieved successfully',
  })
  async getUrgentOffers(
    @Query('hoursUntilExpiry', new DefaultValuePipe(1), ParseIntPipe) hoursUntilExpiry: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @GetUser() user: SafeUserResponse,
    @Query('latitude', new ParseFloatPipe({ optional: true })) latitude?: number,
    @Query('longitude', new ParseFloatPipe({ optional: true })) longitude?: number,
    /*
     * Repeated (`?establishmentTypes=a&establishmentTypes=b`) or comma-joined.
     * Left untyped here on purpose: normalisation, validation and de-duping all
     * happen in one place in the service, via
     * `resolveEstablishmentTypeFilter`. Parsing it twice is how the query and
     * the cache key drift apart.
     */
    @Query('establishmentTypes') establishmentTypes?: string | string[],
  ) {
    const userLocation =
      latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined;

    const result = await this.offersService.getUrgentOffers(
      hoursUntilExpiry,
      1,
      limit,
      user.userId,
      userLocation,
      establishmentTypes,
    );

    return {
      message: 'Urgent offers retrieved successfully',
      data: result.data,
      meta: {
        total: result.total,
        hoursUntilExpiry,
      },
    };
  }

  @Get('nearby')
  async getNearbyOffers(
    @Query('longitude', ParseFloatPipe) longitude: number,
    @Query('latitude', ParseFloatPipe) latitude: number,
    @Query('maxDistance', new DefaultValuePipe(5000), ParseIntPipe) maxDistance: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @GetUser() user: SafeUserResponse,
  ) {
    const result = await this.offersService.getNearbyOffers(
      longitude,
      latitude,
      maxDistance,
      1,
      limit,
      user.userId,
    );

    return {
      message: 'Nearby offers retrieved successfully',
      data: result.data, // ✅ Service now returns { data, total }
    };
  }

  /**
   * Get personalized recommended offers
   * Based on user's favorited establishments and categories
   *
   * Business Logic:
   * - Priority 1: Offers from user's favorited establishments
   * - Priority 2: Offers in user's favorited categories
   * - Fallback: Featured offers (for users with no favorites)
   *
   * Ranking: Priority → Discount → Urgency → CreatedAt
   */
  @Get('recommended')
  @ApiOperation({
    summary: '🎯 Get personalized offer recommendations',
    description:
      'Returns personalized offers based on user favorites (establishments + categories). Falls back to featured offers if no favorites exist.',
  })
  @ApiResponse({
    status: 200,
    description: '✅ Recommended offers retrieved successfully',
    schema: {
      example: {
        message: 'Recommended offers retrieved successfully',
        data: [
          {
            id: '507f1f77bcf86cd799439011',
            title: 'Bakery Surprise Bag',
            establishment: {
              name: 'Le Panier',
              averageRating: 4.8,
            },
            pricing: {
              originalPrice: 20.0,
              discountedPrice: 4.0,
              discountPercentage: 80,
            },
            category: 'bakery',
          },
        ],
        count: 15,
      },
    },
  })
  @ApiResponse({ status: 401, description: '❌ Unauthorized - Login required' })
  async getRecommendedOffers(
    @GetUser() user: SafeUserResponse, // Required: user must be authenticated
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    // ✅ Service returns OfferCardDto[] (already sanitized with isFavorite)
    const offers = await this.offersService.getRecommendedOffers(user.userId, limit);

    return {
      message: 'Recommended offers retrieved successfully',
      data: offers,
      count: offers.length,
    };
  }

  @Get('my-offers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.LOCATION_MANAGER)
  @ApiQuery({
    name: 'status',
    required: false,
    enum: OfferStatus,
    description: 'Filter by offer status',
  })
  @ApiQuery({
    name: 'establishmentId',
    required: false,
    type: String,
    description:
      'Filter by establishment ID (enterprise owners only; ignored for location managers)',
  })
  async getMyOffers(
    @GetUser() user: SafeUserResponse, // Required: merchant must be authenticated
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: OfferStatus,
    @Query('establishmentId') establishmentId?: string,
  ) {
    const isLM = (user as { role?: string }).role === UserRole.LOCATION_MANAGER;

    // LM: scope to their assigned establishment only — ignore merchantId so
    // offers created by the merchant owner are also visible.
    // MERCHANT: scope to their own offers, optionally filtered by establishment.
    const effectiveMerchantId = isLM ? undefined : user.userId;
    const effectiveEstablishmentId = isLM
      ? (user as { assignedEstablishmentId?: string }).assignedEstablishmentId
      : establishmentId;

    const result = await this.offersService.findByMerchant(
      effectiveMerchantId,
      page,
      limit,
      user.userId,
      status,
      effectiveEstablishmentId,
    );

    return {
      message: 'Your offers retrieved successfully',
      data: result.data,
      meta: QueryOptimizer.getPaginationMeta(result.total, page, limit),
    };
  }

  @Get('establishment/:establishmentId')
  async getOffersByEstablishment(
    @Param('establishmentId') establishmentId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @GetUser() user: SafeUserResponse,
  ) {
    const result = await this.offersService.findByEstablishment(
      establishmentId,
      page,
      limit,
      user.userId,
    );

    return {
      message: 'Establishment offers retrieved successfully',
      data: result.data, // ✅ Service now returns { data, total }
      meta: QueryOptimizer.getPaginationMeta(result.total, page, limit),
    };
  }

  @Get('expiring')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getExpiringOffers(@Query('hours', new DefaultValuePipe(24), ParseIntPipe) hours: number) {
    const offers = await this.offersService.getExpiringOffers(hours);

    return {
      message: 'Expiring offers retrieved successfully',
      data: offers,
    };
  }

  @Put('update-expired')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateExpiredOffers() {
    await this.offersService.updateExpiredOffers();
    return {
      message: 'Expired offers updated successfully',
    };
  }
  /**
   * Manually feature an offer (ADMIN ONLY)
   * Sets isFeaturedManual = true
   * Does not affect auto-featuring logic
   */
  @Patch(':id/feature')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN) // ⚠️ ADMIN ONLY - Removed MERCHANT role
  @ApiOperation({ summary: 'Manually feature an offer (Admin only)' })
  @ApiResponse({ status: 200, description: 'Offer manually featured successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async markAsFeatured(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const userId = req.user?.userId;
    const updatedOffer = await this.offersService.setManualFeatured(id, true, userId);
    return {
      message: 'Offer manually featured successfully',
      data: updatedOffer,
    };
  }

  /**
   * Manually unfeature an offer (ADMIN ONLY)
   * Sets isFeaturedManual = false
   * Auto-featured offers can still remain featured via isFeaturedAuto
   */
  @Patch(':id/unfeature')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Manually unfeature an offer (Admin only)' })
  @ApiResponse({ status: 200, description: 'Offer manually unfeatured successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async markAsUnfeatured(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const userId = req.user?.userId;
    const updatedOffer = await this.offersService.setManualFeatured(id, false, userId);
    return {
      message: 'Offer manually unfeatured successfully',
      data: updatedOffer,
    };
  }

  /**
   * Manually trigger auto-featuring logic (ADMIN ONLY)
   * This bypasses the cron schedule for immediate testing/debugging
   * Runs both auto-feature and auto-unfeature operations
   */
  @Post('admin/trigger-auto-featuring')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Manually trigger auto-featuring (Admin only)',
    description:
      'Immediately runs the auto-featuring logic without waiting for cron. Useful for testing and debugging.',
  })
  @ApiResponse({ status: 200, description: 'Auto-featuring triggered successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async triggerAutoFeaturing() {
    const featured = await this.offersService.autoFeatureEligibleOffers();
    const unfeatured = await this.offersService.autoUnfeatureIneligibleOffers();

    return {
      message: 'Auto-featuring triggered successfully',
      data: {
        offersAutoFeatured: featured,
        offersAutoUnfeatured: unfeatured,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // =========================================================================
  // OFFER LIFECYCLE: Reactivate & Toggle (Enable/Disable)
  // =========================================================================

  @Patch(':id/reactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.LOCATION_MANAGER)
  @ApiOperation({
    summary: 'Reactivate an expired/cancelled/sold-out offer with new dates',
    description:
      'Allows the owning merchant to reactivate a terminal-state offer. Resets quantities and sets new availability window.',
  })
  @ApiResponse({ status: 200, description: 'Offer reactivated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid dates or offer cannot be reactivated' })
  @ApiResponse({ status: 403, description: 'Not authorized to reactivate this offer' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async reactivateOffer(
    @Param('id') id: string,
    @Body(strictValidation()) dto: ReactivateOfferDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const offer = await this.offersService.reactivateOffer(
      id,
      dto,
      req.user.userId,
      req.user.role,
      req.user.assignedEstablishmentId,
    );

    return {
      message: 'Offer reactivated successfully',
      data: offer,
    };
  }

  @Patch(':id/enable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.LOCATION_MANAGER)
  @ApiOperation({
    summary: 'Enable an offer (make visible)',
    description:
      'Re-enables a previously disabled offer. The offer becomes visible in public queries again.',
  })
  @ApiResponse({ status: 200, description: 'Offer enabled successfully' })
  @ApiResponse({ status: 400, description: 'Offer is already enabled or cannot be toggled' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async enableOffer(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const offer = await this.offersService.toggleOfferActive(
      id,
      true,
      req.user.userId,
      req.user.role,
      req.user.assignedEstablishmentId,
    );

    return {
      message: 'Offer enabled successfully',
      data: offer,
    };
  }

  @Patch(':id/disable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.LOCATION_MANAGER)
  @ApiOperation({
    summary: 'Disable an offer (hide from public)',
    description:
      'Temporarily hides the offer from public queries without changing its status. Cannot disable offers with active reservations.',
  })
  @ApiResponse({ status: 200, description: 'Offer disabled successfully' })
  @ApiResponse({
    status: 400,
    description: 'Offer is already disabled, has reservations, or cannot be toggled',
  })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async disableOffer(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const offer = await this.offersService.toggleOfferActive(
      id,
      false,
      req.user.userId,
      req.user.role,
      req.user.assignedEstablishmentId,
    );

    return {
      message: 'Offer disabled successfully',
      data: offer,
    };
  }

  @Get('pricing-suggestions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT)
  @ApiOperation({
    summary: 'Smart pricing suggestions for merchant',
    description:
      "Analyzes the merchant's historical offer performance and zone averages to suggest optimal pricing.",
  })
  @ApiResponse({ status: 200, description: 'Pricing suggestions retrieved' })
  async getPricingSuggestions(@Request() req: AuthenticatedRequest) {
    const suggestions = await this.offersService.getPricingSuggestions(req.user.userId);
    return {
      message: 'Pricing suggestions retrieved successfully',
      data: suggestions,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const offer = await this.offersService.findById(id, req.user.userId);

    return {
      message: 'Offer retrieved successfully',
      data: offer,
    };
  }

  @Patch(':id')
  @UseInterceptors(FilesInterceptor('images', 5))
  @ApiOperation({
    summary: '✏️ Update Food Offer',
    description:
      'Update an existing offer with optional new images. New images will be added to existing ones.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: '✅ Offer updated successfully',
    schema: {
      example: {
        message: 'Offer updated successfully',
        data: {
          id: '507f1f77bcf86cd799439011',
          title: 'Updated Bakery Surprise Bag',
          images: [
            'https://storage.googleapis.com/waste-food-d479c.appspot.com/offers/bakery_items_1625097600000_abc123.jpg',
            'https://storage.googleapis.com/waste-food-d479c.appspot.com/offers/bakery_items_1625097700000_def456.jpg',
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: '❌ Invalid update data' })
  @ApiResponse({ status: 403, description: '❌ Not authorized to update this offer' })
  @ApiResponse({ status: 404, description: '❌ Offer not found' })
  async update(
    @Param('id') id: string,
    @Body() updateOfferDto: UpdateOfferDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const uploadedFiles = files ?? [];
      let newImageUrls: string[] = [];

      // Upload new images to Supabase Storage if provided
      if (uploadedFiles.length > 0) {
        const uploadResults = await this.supabaseStorageService.uploadFiles(uploadedFiles, {
          folder: 'offers',
          makePublic: true,
          metadata: { uploadedBy: req.user.userId, category: 'offer-image-update' },
          imageProcessing: {
            maxWidth: 800,
            maxHeight: 600,
            quality: 80,
            format: 'jpeg',
          },
        });

        newImageUrls = uploadResults.map(result => result.downloadURL);
      }

      // Combine existing and new images
      const updateData = {
        ...updateOfferDto,
        ...(newImageUrls.length > 0 && {
          images: [...(updateOfferDto.images ?? []), ...newImageUrls],
        }),
      };

      const updatedOffer = await this.offersService.update(
        id,
        updateData,
        req.user.userId,
        req.user.role,
        req.user.assignedEstablishmentId,
      );

      return {
        message: 'Offer updated successfully',
        data: updatedOffer,
      };
    } catch (error) {
      throw error;
    }
  }

  @Patch(':id/images')
  @UseInterceptors(FilesInterceptor('images', 5))
  @ApiOperation({
    summary: '🖼️ Update Offer Images Only',
    description:
      'Update only the images for an offer. Returns minimal response with just image URLs.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: '✅ Images updated successfully',
    schema: {
      example: {
        message: 'Offer images updated successfully',
        data: {
          id: '507f1f77bcf86cd799439011',
          images: ['http://10.0.2.2:3000/uploads/offers/bakery_items_1625097600000_abc123.jpg'],
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: '❌ No images provided or invalid files' })
  @ApiResponse({ status: 403, description: '❌ Not authorized to update this offer' })
  @ApiResponse({ status: 404, description: '❌ Offer not found' })
  async updateImages(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const uploadedFiles = files ?? [];

      if (uploadedFiles.length === 0) {
        throw new BadRequestException('No images provided');
      }

      // Upload images to Supabase Storage
      const uploadResults = await this.supabaseStorageService.uploadFiles(uploadedFiles, {
        folder: 'offers',
        makePublic: true,
        metadata: { uploadedBy: req.user.userId, category: 'offer-image-replace' },
        imageProcessing: {
          maxWidth: 800,
          maxHeight: 600,
          quality: 80,
          format: 'jpeg',
        },
      });

      const newImageUrls = uploadResults.map(result => result.downloadURL);

      // Update offer with new images
      const updatedOffer = await this.offersService.update(
        id,
        { images: newImageUrls },
        req.user.userId,
        req.user.role,
        req.user.assignedEstablishmentId,
      );

      // ✅ Return minimal response - just ID and images
      return {
        message: 'Offer images updated successfully',
        data: {
          id: updatedOffer._id.toString(),
          images: updatedOffer.images,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MERCHANT, UserRole.LOCATION_MANAGER)
  @ApiOperation({
    summary: 'Update offer status',
    description: 'Merchants: active/draft/cancelled/sold_out. Admins: all statuses.',
  })
  @ApiResponse({
    status: 200,
    description: 'Status updated successfully',
    schema: {
      example: {
        message: 'Offer status updated successfully',
        data: {
          id: '6973fb2e97d8708e5d8a7e41',
          status: 'active',
          publishedAt: '2026-01-23T22:51:58.088Z',
          updatedAt: '2026-01-23T22:51:58.089Z',
        },
      },
    },
  })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: OfferStatus,
    @Request() req: AuthenticatedRequest,
  ) {
    if (req.user.role === UserRole.MERCHANT) {
      if (
        ![
          OfferStatus.ACTIVE,
          OfferStatus.DRAFT,
          OfferStatus.CANCELLED,
          OfferStatus.SOLD_OUT,
        ].includes(status)
      ) {
        return {
          message: 'Merchants can only set offers to active, draft, cancelled, or sold_out',
          data: null,
        };
      }
    }

    const merchantId =
      req.user.role === UserRole.MERCHANT || req.user.role === UserRole.LOCATION_MANAGER
        ? req.user.userId
        : undefined;

    const updatedOffer = await this.offersService.updateStatus(
      id,
      status,
      merchantId,
      req.user.role,
      req.user.assignedEstablishmentId,
    );

    return {
      message: 'Offer status updated successfully',
      data: {
        id: updatedOffer._id.toString(),
        status: updatedOffer.status,
        publishedAt: updatedOffer.publishedAt,
        updatedAt: updatedOffer.updatedAt,
      },
    };
  }

  @Patch(':id/reserve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async reserveQuantity(@Param('id') id: string, @Body('quantity', ParseIntPipe) quantity: number) {
    const offer = await this.offersService.reserveQuantity(id, quantity);

    return {
      message: 'Quantity reserved successfully',
      data: offer,
    };
  }

  @Patch(':id/confirm-sale')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  async confirmSale(@Param('id') id: string, @Body('quantity', ParseIntPipe) quantity: number) {
    const offer = await this.offersService.confirmSale(id, quantity);

    return {
      message: 'Sale confirmed successfully',
      data: offer,
    };
  }

  @Patch(':id/cancel-reservation')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async cancelReservation(
    @Param('id') id: string,
    @Body('quantity', ParseIntPipe) quantity: number,
  ) {
    const offer = await this.offersService.cancelReservation(id, quantity);

    return {
      message: 'Reservation cancelled successfully',
      data: offer,
    };
  }
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    await this.offersService.remove(
      id,
      req.user.userId,
      req.user.role,
      undefined,
      req.user.assignedEstablishmentId,
    );

    return {
      status: 'success',
      message: 'Offer deleted successfully',
      offerId: id,
    };
  }
}
