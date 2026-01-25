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
    ValidationPipe,
    Put,
    UseInterceptors,
    UploadedFiles,
    BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user.enum';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './DTO/create-offer.dto';
import { UpdateOfferDto } from './DTO/update-offer.dto';
import { SearchOffersDto } from './DTO/search-offers.dto';
import { OfferStatus } from './schemas/offer.schema';
import { Public } from '../common/decorators/public.decorator';
import { LocalStorageService } from '../common/services/local-storage.service';
import { OfferPresenter } from './presenters/offer.presenter';

@ApiTags('🎯 Offers Management')
@Controller('offers')
export class OffersController {
    constructor(
        private readonly offersService: OffersService,
        private readonly localStorageService: LocalStorageService,
    ) { }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.MERCHANT)
    @UseInterceptors(FilesInterceptor('images', 5))
    @ApiOperation({
        summary: '📝 Create New Food Offer',
        description: 'Create a new surplus food offer with images. Merchants can upload up to 5 images per offer.'
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
                    description: 'Delicious pastries and bread from today\'s batch',
                    images: [
                        'https://storage.googleapis.com/waste-food-d479c.appspot.com/offers/bakery_items_1625097600000_abc123.jpg'
                    ],
                    pricing: {
                        originalPrice: 15.00,
                        discountedPrice: 5.99,
                        discountPercentage: 60
                    },
                    status: 'draft'
                }
            }
        }
    })
    @ApiResponse({ status: 400, description: '❌ Invalid offer data or image upload failed' })
    @ApiResponse({ status: 401, description: '❌ Unauthorized' })
    @ApiResponse({ status: 403, description: '❌ Forbidden - Only merchants can create offers' })
    @HttpCode(HttpStatus.CREATED)
    async create(
        @Body() createOfferDto: CreateOfferDto,
        @UploadedFiles() files: Express.Multer.File[],
        @Request() req,
    ) {
        try {
            let imageUrls: string[] = [];

            // Upload images to local storage if provided
            if (files && files.length > 0) {
                const uploadResults = await this.localStorageService.uploadFiles(files, {
                    folder: 'offers',
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
    @Public()
    async findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
        @Query(new ValidationPipe({ transform: true })) filters: SearchOffersDto,
        @Query('latitude') latitudeStr?: string,
        @Query('longitude') longitudeStr?: string,
    ) {
        // ✅ FIX: Parse lat/lng manually (optional params can't use pipes directly)
        const latitude = latitudeStr ? parseFloat(latitudeStr) : undefined;
        const longitude = longitudeStr ? parseFloat(longitudeStr) : undefined;
        const result = await this.offersService.findAll(page, limit, filters);

        // 🔍 DEBUG: Log what service returned
        console.log('🔍🔍🔍 CONTROLLER findAll: result.offers[0]:', JSON.stringify(result.offers[0]).substring(0, 600));

        // ✅ Calculate distance if user location provided
        const distances = new Map<string, number>();
        if (latitude !== undefined && longitude !== undefined) {
            for (const offer of result.offers) {
                // ✅ Check if distance is already calculated (from aggregation pipeline)
                if ((offer as any).distance !== undefined) {
                    distances.set(offer._id.toString(), (offer as any).distance);
                }
                // ✅ Otherwise, manually calculate if establishment is populated
                else if (offer.establishmentId && typeof offer.establishmentId === 'object') {
                    const establishment = offer.establishmentId as any;
                    if (establishment.address?.coordinates?.coordinates) {
                        const [estLng, estLat] = establishment.address.coordinates.coordinates;
                        const distance = this.offersService.calculateDistance(
                            latitude,
                            longitude,
                            estLat,
                            estLng,
                        );
                        distances.set(offer._id.toString(), distance);
                    }
                }
            }
        }

        // ✅ SECURITY: Use presenter to sanitize data (remove PII and internal metrics)
        const sanitizedOffers = OfferPresenter.toCardDtoArray(result.offers as any, distances);

        // 🔍 DEBUG: Log after presenter
        console.log('🔍🔍🔍 CONTROLLER findAll: sanitizedOffers[0]:', JSON.stringify(sanitizedOffers[0]));

        return {
            message: 'Offers retrieved successfully',
            data: sanitizedOffers,
            meta: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit),
            },
        };
    }

    @Get('pickup-today')
    @Public()
    @ApiOperation({
        summary: '📅 Get Offers Available for Pickup Today',
        description: 'Returns all active offers where pickup window overlaps with today (00:00 - 23:59 Africa/Tunis timezone)'
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
                            originalPrice: 15.00,
                            discountedPrice: 5.99,
                            discountPercentage: 60
                        }
                    }
                ],
                meta: {
                    page: 1,
                    limit: 20,
                    total: 15,
                    totalPages: 1
                }
            }
        }
    })
    async getPickupTodayOffers(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('latitude') latitudeStr?: string,
        @Query('longitude') longitudeStr?: string,
    ) {
        const latitude = latitudeStr ? parseFloat(latitudeStr) : undefined;
        const longitude = longitudeStr ? parseFloat(longitudeStr) : undefined;
        const result = await this.offersService.getPickupTodayOffers(page, limit);

        // ✅ Calculate distance if user location provided
        const distances = new Map<string, number>();
        if (latitude !== undefined && longitude !== undefined) {
            for (const offer of result.offers) {
                // ✅ Check if distance is already calculated (from aggregation pipeline)
                if ((offer as any).distance !== undefined) {
                    distances.set(offer._id.toString(), (offer as any).distance);
                }
                // ✅ Otherwise, manually calculate if establishment is populated
                else if (offer.establishmentId && typeof offer.establishmentId === 'object') {
                    const establishment = offer.establishmentId as any;
                    if (establishment.address?.coordinates?.coordinates) {
                        const [estLng, estLat] = establishment.address.coordinates.coordinates;
                        const distance = this.offersService.calculateDistance(
                            latitude,
                            longitude,
                            estLat,
                            estLng,
                        );
                        distances.set(offer._id.toString(), distance);
                    }
                }
            }
        }

        const sanitizedOffers = OfferPresenter.toCardDtoArray(result.offers as any, distances);

        return {
            message: 'Pickup today offers retrieved successfully',
            data: sanitizedOffers,
            meta: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit),
            },
        };
    }

    @Get('pickup-tomorrow')
    @Public()
    @ApiOperation({
        summary: '📅 Get Offers Available for Pickup Tomorrow',
        description: 'Returns all active offers where pickup window overlaps with tomorrow (00:00 - 23:59 Africa/Tunis timezone)'
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
                            originalPrice: 25.00,
                            discountedPrice: 9.99,
                            discountPercentage: 60
                        }
                    }
                ],
                meta: {
                    page: 1,
                    limit: 20,
                    total: 8,
                    totalPages: 1
                }
            }
        }
    })
    async getPickupTomorrowOffers(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('latitude') latitudeStr?: string,
        @Query('longitude') longitudeStr?: string,
    ) {
        const latitude = latitudeStr ? parseFloat(latitudeStr) : undefined;
        const longitude = longitudeStr ? parseFloat(longitudeStr) : undefined;
        const result = await this.offersService.getPickupTomorrowOffers(page, limit);

        // ✅ Calculate distance if user location provided
        const distances = new Map<string, number>();
        if (latitude !== undefined && longitude !== undefined) {
            for (const offer of result.offers) {
                // ✅ Check if distance is already calculated (from aggregation pipeline)
                if ((offer as any).distance !== undefined) {
                    distances.set(offer._id.toString(), (offer as any).distance);
                }
                // ✅ Otherwise, manually calculate if establishment is populated
                else if (offer.establishmentId && typeof offer.establishmentId === 'object') {
                    const establishment = offer.establishmentId as any;
                    if (establishment.address?.coordinates?.coordinates) {
                        const [estLng, estLat] = establishment.address.coordinates.coordinates;
                        const distance = this.offersService.calculateDistance(
                            latitude,
                            longitude,
                            estLat,
                            estLng,
                        );
                        distances.set(offer._id.toString(), distance);
                    }
                }
            }
        }

        const sanitizedOffers = OfferPresenter.toCardDtoArray(result.offers as any, distances);

        return {
            message: 'Pickup tomorrow offers retrieved successfully',
            data: sanitizedOffers,
            meta: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit),
            },
        };
    }

    @Get('featured')
    @Public()
    async getFeaturedOffers(
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('latitude') latitudeStr?: string,
        @Query('longitude') longitudeStr?: string,
    ) {
        // ✅ FIX: Parse lat/lng manually (optional params can't use pipes directly)
        const latitude = latitudeStr ? parseFloat(latitudeStr) : undefined;
        const longitude = longitudeStr ? parseFloat(longitudeStr) : undefined;
        const result = await this.offersService.getFeaturedOffers(1, limit);

        // 🔍 DEBUG: Log what service returned
        console.log('🔍🔍🔍 CONTROLLER getFeaturedOffers: result.offers[0]:', JSON.stringify(result.offers[0]).substring(0, 600));

        // ✅ Calculate distance if user location provided
        const distances = new Map<string, number>();
        if (latitude !== undefined && longitude !== undefined) {
            for (const offer of result.offers) {
                // ✅ Check if distance is already calculated (from aggregation pipeline)
                if ((offer as any).distance !== undefined) {
                    distances.set(offer._id.toString(), (offer as any).distance);
                }
                // ✅ Otherwise, manually calculate if establishment is populated
                else if (offer.establishmentId && typeof offer.establishmentId === 'object') {
                    const establishment = offer.establishmentId as any;
                    if (establishment.address?.coordinates?.coordinates) {
                        const [estLng, estLat] = establishment.address.coordinates.coordinates;
                        const distance = this.offersService.calculateDistance(
                            latitude,
                            longitude,
                            estLat,
                            estLng,
                        );
                        distances.set(offer._id.toString(), distance);
                    }
                }
            }
        }

        // ✅ SECURITY: Use presenter to sanitize data with distances
        const sanitizedOffers = OfferPresenter.toCardDtoArray(result.offers as any, distances);

        // 🔍 DEBUG: Log after presenter
        console.log('🔍🔍🔍 CONTROLLER getFeaturedOffers: sanitizedOffers[0]:', JSON.stringify(sanitizedOffers[0]));

        return {
            message: 'Featured offers retrieved successfully',
            data: sanitizedOffers,
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
    @Public()
    @ApiOperation({
        summary: '🚨 Get urgent offers (expiring soon)',
        description: 'Returns offers expiring within a specified time window. Sorted by soonest expiring first.',
    })
    @ApiResponse({
        status: 200,
        description: '✅ Urgent offers retrieved successfully',
    })
    async getUrgentOffers(
        @Query('hoursUntilExpiry', new DefaultValuePipe(1), ParseIntPipe) hoursUntilExpiry: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('latitude') latitudeStr?: string,
        @Query('longitude') longitudeStr?: string,
    ) {
        // ✅ Parse lat/lng manually (optional params)
        const latitude = latitudeStr ? parseFloat(latitudeStr) : undefined;
        const longitude = longitudeStr ? parseFloat(longitudeStr) : undefined;

        // ✅ Get urgent offers from service
        const result = await this.offersService.getUrgentOffers(hoursUntilExpiry, 1, limit);

        // ✅ Calculate distance if user location provided
        const distances = new Map<string, number>();
        if (latitude !== undefined && longitude !== undefined) {
            for (const offer of result.offers) {
                if (offer.establishmentId && typeof offer.establishmentId === 'object') {
                    const establishment = offer.establishmentId as any;
                    if (establishment.address?.coordinates?.coordinates) {
                        const [estLng, estLat] = establishment.address.coordinates.coordinates;
                        const distance = this.offersService.calculateDistance(
                            latitude,
                            longitude,
                            estLat,
                            estLng,
                        );
                        distances.set(offer._id.toString(), distance);
                    }
                }
            }
        }

        // ✅ SECURITY: Use presenter to sanitize data with distances
        const sanitizedOffers = OfferPresenter.toCardDtoArray(result.offers as any, distances);

        return {
            message: 'Urgent offers retrieved successfully',
            data: sanitizedOffers,
            meta: {
                total: result.total,
                hoursUntilExpiry,
            },
        };
    }

    @Get('nearby')
    @Public()
    async getNearbyOffers(
        @Query('longitude', ParseFloatPipe) longitude: number,
        @Query('latitude', ParseFloatPipe) latitude: number,
        @Query('maxDistance', new DefaultValuePipe(5000), ParseIntPipe) maxDistance: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    ) {
        const result = await this.offersService.getNearbyOffers(
            longitude,
            latitude,
            maxDistance,
            1,
            limit,
        );

        // ✅ SECURITY: Use presenter to sanitize data (includes distance)
        const sanitizedOffers = result.offers.map((offer: any) =>
            OfferPresenter.toCardDto(offer, offer.distance)
        );

        return {
            message: 'Nearby offers retrieved successfully',
            data: sanitizedOffers,
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
    @UseGuards(JwtAuthGuard)
    @ApiOperation({
        summary: '🎯 Get personalized offer recommendations',
        description: 'Returns personalized offers based on user favorites (establishments + categories). Falls back to featured offers if no favorites exist.'
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
                            averageRating: 4.8
                        },
                        pricing: {
                            originalPrice: 20.00,
                            discountedPrice: 4.00,
                            discountPercentage: 80
                        },
                        category: 'bakery'
                    }
                ],
                count: 15
            }
        }
    })
    @ApiResponse({ status: 401, description: '❌ Unauthorized - Login required' })
    async getRecommendedOffers(
        @Request() req: any,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number
    ) {
        const userId = req.user?.userId || req.user?.sub;
        const offers = await this.offersService.getRecommendedOffers(userId, limit);

        // ✅ SECURITY: Use presenter to sanitize data
        const sanitizedOffers = OfferPresenter.toCardDtoArray(offers as any);

        return {
            message: 'Recommended offers retrieved successfully',
            data: sanitizedOffers,
            count: sanitizedOffers.length
        };
    }

    @Get('my-offers')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.MERCHANT)
    async getMyOffers(
        @Request() req,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ) {
        const result = await this.offersService.findByMerchant(
            req.user.userId,
            page,
            limit,
        );

        return {
            message: 'Your offers retrieved successfully',
            data: result.offers,
            meta: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit),
            },
        };
    }

    @Get('establishment/:establishmentId')
    @Public()
    async getOffersByEstablishment(
        @Param('establishmentId') establishmentId: string,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ) {
        const result = await this.offersService.findByEstablishment(
            establishmentId,
            page,
            limit,
        );

        // ✅ SECURITY: Use presenter to sanitize data
        const sanitizedOffers = OfferPresenter.toCardDtoArray(result.offers as any);

        return {
            message: 'Establishment offers retrieved successfully',
            data: sanitizedOffers,
            meta: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit),
            },
        };
    }

    @Get('expiring')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async getExpiringOffers(
        @Query('hours', new DefaultValuePipe(24), ParseIntPipe) hours: number,
    ) {
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
    async markAsFeatured(@Param('id') id: string, @Request() req: any) {
        const userId = req.user?.userId || req.user?.sub;
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
    async markAsUnfeatured(@Param('id') id: string, @Request() req: any) {
        const userId = req.user?.userId || req.user?.sub;
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
        description: 'Immediately runs the auto-featuring logic without waiting for cron. Useful for testing and debugging.'
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

    @Get(':id')
    @Public()
    async findOne(@Param('id') id: string) {
        const offer = await this.offersService.findById(id);

        return {
            message: 'Offer retrieved successfully',
            data: offer,
        };
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FilesInterceptor('images', 5))
    @ApiOperation({
        summary: '✏️ Update Food Offer',
        description: 'Update an existing offer with optional new images. New images will be added to existing ones.'
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
                        'https://storage.googleapis.com/waste-food-d479c.appspot.com/offers/bakery_items_1625097700000_def456.jpg'
                    ]
                }
            }
        }
    })
    @ApiResponse({ status: 400, description: '❌ Invalid update data' })
    @ApiResponse({ status: 403, description: '❌ Not authorized to update this offer' })
    @ApiResponse({ status: 404, description: '❌ Offer not found' })
    async update(
        @Param('id') id: string,
        @Body() updateOfferDto: UpdateOfferDto,
        @UploadedFiles() files: Express.Multer.File[],
        @Request() req,
    ) {
        try {
            let newImageUrls: string[] = [];

            // Upload new images to local storage if provided
            if (files && files.length > 0) {
                const uploadResults = await this.localStorageService.uploadFiles(files, {
                    folder: 'offers',
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
                    images: [...(updateOfferDto.images || []), ...newImageUrls],
                }),
            };

            const updatedOffer = await this.offersService.update(
                id,
                updateData,
                req.user.userId,
                req.user.role,
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
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FilesInterceptor('images', 5))
    @ApiOperation({
        summary: '🖼️ Update Offer Images Only',
        description: 'Update only the images for an offer. Returns minimal response with just image URLs.'
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
                    images: [
                        'http://10.0.2.2:3000/uploads/offers/bakery_items_1625097600000_abc123.jpg'
                    ]
                }
            }
        }
    })
    @ApiResponse({ status: 400, description: '❌ No images provided or invalid files' })
    @ApiResponse({ status: 403, description: '❌ Not authorized to update this offer' })
    @ApiResponse({ status: 404, description: '❌ Offer not found' })
    async updateImages(
        @Param('id') id: string,
        @UploadedFiles() files: Express.Multer.File[],
        @Request() req,
    ) {
        try {
            if (!files || files.length === 0) {
                throw new BadRequestException('No images provided');
            }

            // Upload images to local storage
            const uploadResults = await this.localStorageService.uploadFiles(files, {
                folder: 'offers',
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
    @Roles(UserRole.ADMIN, UserRole.MERCHANT)
    @ApiOperation({
        summary: 'Update offer status',
        description: 'Merchants: active/draft/cancelled only. Admins: all statuses.',
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
        @Request() req,
    ) {
        if (req.user.role === UserRole.MERCHANT) {
            if (![OfferStatus.ACTIVE, OfferStatus.DRAFT, OfferStatus.CANCELLED].includes(status)) {
                return {
                    message: 'Merchants can only set offers to active, draft, or cancelled',
                    data: null,
                };
            }
        }

        const updatedOffer = await this.offersService.updateStatus(id, status);

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
    @UseGuards(JwtAuthGuard)
    async reserveQuantity(
        @Param('id') id: string,
        @Body('quantity', ParseIntPipe) quantity: number,
    ) {
        const offer = await this.offersService.reserveQuantity(id, quantity);

        return {
            message: 'Quantity reserved successfully',
            data: offer,
        };
    }

    @Patch(':id/confirm-sale')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.MERCHANT, UserRole.ADMIN)
    async confirmSale(
        @Param('id') id: string,
        @Body('quantity', ParseIntPipe) quantity: number,
    ) {
        const offer = await this.offersService.confirmSale(id, quantity);

        return {
            message: 'Sale confirmed successfully',
            data: offer,
        };
    }

    @Patch(':id/cancel-reservation')
    @UseGuards(JwtAuthGuard)
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
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async remove(@Param('id') id: string, @Request() req) {
        await this.offersService.remove(id, req.user.userId, req.user.role);

        return {
            status: 'success',
            message: 'Offer deleted successfully',
            offerId: id,
        };
    }
}