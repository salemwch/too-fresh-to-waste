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
    DefaultValuePipe,
    ValidationPipe,
    Put,
    UseInterceptors,
    UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './DTO/create-offer.dto';
import { UpdateOfferDto } from './DTO/update-offer.dto';
import { SearchOffersDto } from './DTO/search-offers.dto';
import { OfferStatus } from './schemas/offer.schema';
import { Public } from '../auth/decorators/public.decorator';
import { FirebaseStorageService } from '../common/services/firebase-storage.service';

@ApiTags('🎯 Offers Management')
@Controller('offers')
export class OffersController {
    constructor(
        private readonly offersService: OffersService,
        private readonly firebaseStorageService: FirebaseStorageService,
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

            // Upload images to Firebase Storage if provided
            if (files && files.length > 0) {
                const uploadResults = await this.firebaseStorageService.uploadFiles(files, {
                    folder: 'offers',
                    makePublic: true,
                    imageProcessing: {
                        maxWidth: 800,
                        maxHeight: 600,
                        quality: 80,
                        format: 'jpeg',
                    },
                    metadata: {
                        uploadedBy: req.user.userId,
                        category: 'offer-image',
                        establishmentId: createOfferDto.establishmentId,
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
    ) {
        const result = await this.offersService.findAll(page, limit, filters);
        return {
            message: 'Offers retrieved successfully',
            data: result.offers,
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
    ) {
        const result = await this.offersService.getFeaturedOffers(1, limit);

        return {
            message: 'Featured offers retrieved successfully',
            data: result.offers,
        };
    }

    @Get('nearby')
    @Public()
    async getNearbyOffers(
        @Query('longitude', ParseIntPipe) longitude: number,
        @Query('latitude', ParseIntPipe) latitude: number,
        @Query('maxDistance', new DefaultValuePipe(5000), ParseIntPipe) maxDistance: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    ) {
        const offers = await this.offersService.getNearbyOffers(
            longitude,
            latitude,
            maxDistance,
            limit,
        );

        return {
            message: 'Nearby offers retrieved successfully',
            data: offers,
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

        return {
            message: 'Establishment offers retrieved successfully',
            data: result.offers,
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
    @Patch(':id/feature')
    @UseGuards(JwtAuthGuard,RolesGuard)
    @Roles(UserRole.MERCHANT, UserRole.ADMIN)
    async markAsFeatured(@Param('id') id: string) {
        const updatedOffer = await this.offersService.setFeatured(id, true);
        return {
            message: 'Offer marked as featured successfully',
            data: updatedOffer,
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

            // Upload new images to Firebase Storage if provided
            if (files && files.length > 0) {
                const uploadResults = await this.firebaseStorageService.uploadFiles(files, {
                    folder: 'offers',
                    makePublic: true,
                    imageProcessing: {
                        maxWidth: 800,
                        maxHeight: 600,
                        quality: 80,
                        format: 'jpeg',
                    },
                    metadata: {
                        uploadedBy: req.user.userId,
                        category: 'offer-image-update',
                        offerId: id,
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

    @Patch(':id/status')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.MERCHANT)
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
            data: updatedOffer,
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