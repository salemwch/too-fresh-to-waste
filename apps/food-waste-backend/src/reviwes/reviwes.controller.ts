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
  ValidationPipe,
  UseInterceptors,
  UploadedFiles,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
  Logger,
  UseFilters,
  InternalServerErrorException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedRequest } from '../common/decorators/get-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { GlobalExceptionFilter } from '../common/filters/http-exception.filter';
import { AppLoggerService } from '../common/services/logger.service';
import { SupabaseStorageService } from '../common/services/supabase-storage.service';
import { RateLimitGuard } from '../common/validators/RateLimitGuard';

import {
  CreateReviewDto,
  UpdateReviewDto,
  ReviewResponseDto,
  ReviewModerationDto,
  ReviewInteractionDto,
  ReviewReportDto,
  ReviewQueryDto,
  ReviewAnalyticsDto,
  BulkReviewModerationDto,
} from './dto/create-reviwe.dto';
import { ReviewsService } from './reviwes.service';
import { ReviewImages, ReviewStatus } from './schemas/reviwe.schema';

@ApiTags('Reviews')
@Controller('reviews')
@UseGuards(JwtAuthGuard)
@UseFilters(GlobalExceptionFilter)
export class ReviewsController {
  private readonly logger = new Logger(ReviewsController.name);

  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly appLogger: AppLoggerService,
    private readonly supabaseStorageService: SupabaseStorageService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.CONSUMER)
  @UseGuards(RateLimitGuard)
  @UseInterceptors(FilesInterceptor('images', 10))
  @ApiOperation({ summary: 'Create a new review' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'Review created successfully',
    schema: {
      example: {
        success: true,
        message: 'Review created successfully',
        data: {
          id: '507f1f77bcf86cd799439011',
          overallRating: 5,
          comment: 'Excellent food and service!',
          status: 'approved',
          createdAt: '2024-08-30T10:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid review data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Review already exists' })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(ValidationPipe) createReviewDto: CreateReviewDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!req.user.userId) {
      throw new BadRequestException(` userId is : ${req.user.userId} is required`);
    }
    try {
      const uploadedFiles = files ?? [];
      let processedImages: ReviewImages[] = [];

      // Upload images to Supabase Storage if provided
      if (uploadedFiles.length > 0) {
        const uploadResults = await this.supabaseStorageService.uploadFiles(uploadedFiles, {
          folder: 'reviews',
          makePublic: true,
          imageProcessing: {
            maxWidth: 1200,
            maxHeight: 800,
            quality: 85,
            format: 'jpeg',
          },
          metadata: {
            uploadedBy: req.user.userId,
            category: 'review-image',
            reviewId: 'pending', // Will be updated after review creation
          },
        });

        processedImages = uploadResults.map(result => ({
          url: result.downloadURL,
          filename: result.fileName,
          size: result.size,
          mimeType: result.mimeType,
          uploadedAt: result.uploadedAt,
          isVerified: false,
        }));
      }

      const reviewData = {
        ...createReviewDto,
        images: processedImages as unknown as string[],
      };

      const review = await this.reviewsService.create(reviewData, req.user.userId);

      return {
        success: true,
        message: 'Review created successfully',
        data: review,
      };
    } catch (error) {
      this.appLogger.error(
        'Failed to create review',
        error instanceof Error ? error.stack : String(error),
        'ReviewController',
      );
      throw new InternalServerErrorException('Failed to create review');
    }
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all reviews with filtering and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Reviews retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Reviews retrieved successfully',
        data: [],
        meta: {
          page: 1,
          limit: 10,
          total: 100,
          totalPages: 10,
        },
        analytics: {
          averageRating: 4.2,
          totalReviews: 100,
        },
      },
    },
  })
  async findAll(@Query(ValidationPipe) queryDto: ReviewQueryDto) {
    try {
      const result = await this.reviewsService.findAll(queryDto);
      const page = queryDto.page ?? 1;
      const limit = queryDto.limit ?? 10;

      return {
        success: true,
        message: 'Reviews retrieved successfully',
        data: result.reviews,
        meta: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
          hasNextPage: page < Math.ceil(result.total / limit),
          hasPrevPage: page > 1,
        },
        analytics: result.analytics,
      };
    } catch (error) {
      this.logger.error('Failed to fetch reviews:', error);
      throw error;
    }
  }

  @Get('my-reviews')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CONSUMER)
  @ApiOperation({ summary: 'Get current user reviews' })
  @ApiResponse({ status: 200, description: 'User reviews retrieved successfully' })
  async getMyReviews(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Request() req: AuthenticatedRequest,
    @Query('status') status?: string,
  ) {
    if (!req.user.userId) {
      throw new BadRequestException(` userId is : ${req.user.userId} is required`);
    }
    try {
      const queryDto: ReviewQueryDto = {
        page,
        limit,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        reviewerId: req.user.userId,
        ...(status && { status: status as ReviewStatus }),
      };

      const result = await this.reviewsService.findAll(queryDto);

      return {
        success: true,
        message: 'Your reviews retrieved successfully',
        data: result.reviews,
        meta: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch user reviews:', error);
      throw error;
    }
  }

  @Get('establishment/:establishmentId')
  @Public()
  @ApiOperation({ summary: 'Get reviews for a specific establishment' })
  @ApiResponse({ status: 200, description: 'Establishment reviews retrieved successfully' })
  async getEstablishmentReviews(
    @Param('establishmentId') establishmentId: string,
    @Query(ValidationPipe) queryDto: ReviewQueryDto,
  ) {
    try {
      const result = await this.reviewsService.findAll({
        ...queryDto,
        establishmentId,
        status: ReviewStatus.APPROVED,
      });
      const page = queryDto.page ?? 1;
      const limit = queryDto.limit ?? 10;

      return {
        success: true,
        message: 'Establishment reviews retrieved successfully',
        data: result.reviews,
        meta: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
        analytics: result.analytics,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch establishment reviews:`, error);
      throw error;
    }
  }

  @Get('merchant/reviews')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT)
  @ApiOperation({ summary: 'Get reviews for merchant establishments' })
  @ApiResponse({ status: 200, description: 'Merchant reviews retrieved successfully' })
  async getMerchantReviews(
    @Query(ValidationPipe) queryDto: ReviewQueryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!req.user.userId) {
      throw new BadRequestException(`userId is required`);
    }
    try {
      const getIdString = (id: unknown) =>
        id !== null && id !== undefined && typeof id === 'object' ? id.toString() : String(id);

      const establishments = await this.reviewsService.getMerchantEstablishments(req.user.userId);
      const establishmentIds = establishments.map(est => getIdString(est._id));

      if (establishmentIds.length === 0) {
        const limit = queryDto.limit ?? 10;

        return {
          success: true,
          message: 'No reviews found',
          data: [],
          meta: { page: 1, limit, total: 0, totalPages: 0 },
          analytics: {},
        };
      }

      const result = await this.reviewsService.getMerchantReviews(establishmentIds, queryDto);
      const message =
        result.total === 0 ? 'No reviews found' : 'Merchant reviews retrieved successfully';
      const page = queryDto.page ?? 1;
      const limit = queryDto.limit ?? 10;

      return {
        success: true,
        message,
        data: result.reviews,
        meta: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
        analytics: result.analytics,
      };
    } catch (error) {
      this.logger.error('Failed to fetch merchant reviews:', error);
      throw error;
    }
  }

  @Get('analytics')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @ApiOperation({ summary: 'Get comprehensive review analytics' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  async getAnalytics(
    @Query(ValidationPipe) analyticsDto: ReviewAnalyticsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!req.user.userId) {
      throw new BadRequestException(` userId is : ${req.user.userId} is required `);
    }
    try {
      const getIdString = (id: unknown) =>
        id !== null && id !== undefined && typeof id === 'object' ? id.toString() : String(id);
      if (req.user.role === UserRole.MERCHANT && !analyticsDto.establishmentId) {
        const establishments = await this.reviewsService.getMerchantEstablishments(req.user.userId);
        if (establishments.length === 1) {
          const establishment = establishments[0];
          if (establishment) {
            analyticsDto.establishmentId = getIdString(establishment._id);
          }
        }
      }

      const analytics = await this.reviewsService.getAnalytics(analyticsDto);

      return {
        success: true,
        message: 'Analytics retrieved successfully',
        data: analytics,
      };
    } catch (error) {
      this.logger.error('Failed to fetch analytics:', error);
      throw error;
    }
  }

  @Get('moderation/pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get reviews pending moderation (Admin only)' })
  @ApiResponse({ status: 200, description: 'Pending reviews retrieved successfully' })
  async getPendingReviews(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    try {
      const result = await this.reviewsService.findAll({
        page,
        limit,
        status: ReviewStatus.PENDING,
        sortBy: 'createdAt',
        sortOrder: 'asc', // Oldest first for moderation
      });

      return {
        success: true,
        message: 'Pending reviews retrieved successfully',
        data: result.reviews,
        meta: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch pending reviews:', error);
      throw error;
    }
  }

  @Get('moderation/flagged')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get flagged reviews (Admin only)' })
  @ApiResponse({ status: 200, description: 'Flagged reviews retrieved successfully' })
  async getFlaggedReviews(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    try {
      const result = await this.reviewsService.findAll({
        page,
        limit,
        status: ReviewStatus.FLAGGED,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      return {
        success: true,
        message: 'Flagged reviews retrieved successfully',
        data: result.reviews,
        meta: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch flagged reviews:', error);
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific review by ID' })
  @ApiResponse({ status: 200, description: 'Review retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    if (!req.user.userId) {
      throw new BadRequestException(
        ` user Id is : ${req.user.userId} and user Role is : ${req.user.role} are required`,
      );
    }
    try {
      const review = await this.reviewsService.findOne(id, req.user?.userId, req.user?.role);

      return {
        success: true,
        message: 'Review retrieved successfully',
        data: review,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch review ${id}:`, error);
      throw error;
    }
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CONSUMER, UserRole.ADMIN)
  @UseInterceptors(FilesInterceptor('images', 10))
  @ApiOperation({ summary: 'Update a review' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Review updated successfully' })
  @ApiResponse({ status: 403, description: 'Can only update your own reviews' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateReviewDto: UpdateReviewDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!req.user.userId) {
      throw new BadRequestException(
        ` user Id is : ${req.user.userId} and user Role is : ${req.user.role} are required`,
      );
    }
    try {
      const uploadedFiles = files ?? [];
      let newImages: ReviewImages[] = [];

      // Upload new images to Supabase Storage if provided
      if (uploadedFiles.length > 0) {
        const uploadResults = await this.supabaseStorageService.uploadFiles(uploadedFiles, {
          folder: 'reviews',
          makePublic: true,
          imageProcessing: {
            maxWidth: 1200,
            maxHeight: 800,
            quality: 85,
            format: 'jpeg',
          },
          metadata: {
            uploadedBy: req.user.userId,
            category: 'review-image-update',
            reviewId: id,
          },
        });

        newImages = uploadResults.map(result => ({
          url: result.downloadURL,
          filename: result.fileName,
          size: result.size,
          mimeType: result.mimeType,
          uploadedAt: result.uploadedAt,
          isVerified: false,
        }));
      }

      const reviewData: UpdateReviewDto = {
        ...updateReviewDto,
        ...(newImages.length > 0 && {
          images: [...(updateReviewDto.images ?? []), ...(newImages as unknown as string[])],
        }),
      };

      const updatedReview = await this.reviewsService.update(
        id,
        reviewData,
        req.user.userId,
        req.user.role,
      );

      return {
        success: true,
        message: 'Review updated successfully',
        data: updatedReview,
      };
    } catch (error) {
      this.logger.error(`Failed to update review ${id}:`, error);
      throw error;
    }
  }

  @Post(':id/response')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Add response to a review (Merchant/Admin only)' })
  @ApiResponse({ status: 201, description: 'Response added successfully' })
  @ApiResponse({ status: 403, description: 'Can only respond to reviews of your establishments' })
  @ApiResponse({ status: 409, description: 'You have already responded to this review' })
  @HttpCode(HttpStatus.CREATED)
  async addResponse(
    @Param('id') reviewId: string,
    @Body(ValidationPipe) responseDto: ReviewResponseDto,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!req.user.userId) {
      throw new BadRequestException(
        `userId is : ${req.user.userId}  and user Role is : ${req.user.role} are required`,
      );
    }
    try {
      const review = await this.reviewsService.addResponse(
        reviewId,
        responseDto,
        req.user.userId,
        req.user.role,
      );

      return {
        success: true,
        message: 'Response added successfully',
        data: review,
      };
    } catch (error) {
      this.logger.error(`Failed to add response to review ${reviewId}:`, error);
      throw error;
    }
  }

  @Post(':id/interact')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CONSUMER, UserRole.MERCHANT)
  @UseGuards(RateLimitGuard)
  @ApiOperation({ summary: 'Interact with a review (helpful/not helpful)' })
  @ApiResponse({ status: 200, description: 'Interaction recorded successfully' })
  @HttpCode(HttpStatus.OK)
  async handleInteraction(
    @Param('id') reviewId: string,
    @Body(ValidationPipe) interactionDto: ReviewInteractionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!req.user.userId) {
      throw new BadRequestException(`userId is : ${req.user.userId} is required  `);
    }
    try {
      const review = await this.reviewsService.handleInteraction(
        reviewId,
        interactionDto,
        req.user.userId,
      );

      return {
        success: true,
        message: 'Interaction recorded successfully',
        data: {
          reviewId,
          interactionType: interactionDto.interactionType,
          helpfulCount: review.metrics.helpfulCount,
          notHelpfulCount: review.metrics.notHelpfulCount,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to handle review interaction:`, error);
      throw error;
    }
  }

  @Post(':id/report')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CONSUMER, UserRole.MERCHANT)
  @UseGuards(RateLimitGuard)
  @ApiOperation({ summary: 'Report a review for violations' })
  @ApiResponse({ status: 200, description: 'Review reported successfully' })
  @ApiResponse({ status: 409, description: 'You have already reported this review' })
  @HttpCode(HttpStatus.OK)
  async reportReview(
    @Param('id') reviewId: string,
    @Body(ValidationPipe) reportDto: ReviewReportDto,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!req.user.userId) {
      throw new BadRequestException(` user Id is : ${req.user.userId} is required`);
    }
    try {
      const result = await this.reviewsService.reportReview(reviewId, reportDto, req.user.userId);

      return {
        success: true,
        message: result.message,
      };
    } catch (error) {
      this.logger.error(`Failed to report review ${reviewId}:`, error);
      throw error;
    }
  }

  @Patch(':id/moderate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Moderate a review (Admin only)' })
  @ApiResponse({ status: 200, description: 'Review moderated successfully' })
  async moderateReview(
    @Param('id') reviewId: string,
    @Body(ValidationPipe) moderationDto: ReviewModerationDto,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!req.user.userId) {
      throw new BadRequestException(`user Id is : ${req.user.userId} is required`);
    }
    try {
      const review = await this.reviewsService.moderateReview(
        reviewId,
        moderationDto,
        req.user.userId,
      );

      return {
        success: true,
        message: 'Review moderated successfully',
        data: review,
      };
    } catch (error) {
      this.logger.error(`Failed to moderate review ${reviewId}:`, error);
      throw error;
    }
  }

  @Post('bulk/moderate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Bulk moderate multiple reviews (Admin only)' })
  @ApiResponse({ status: 200, description: 'Bulk moderation completed' })
  @HttpCode(HttpStatus.OK)
  async bulkModerateReviews(
    @Body(ValidationPipe) bulkDto: BulkReviewModerationDto,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!req.user.userId) {
      throw new BadRequestException(`userId is ${req.user.userId} is required`);
    }
    try {
      const result = await this.reviewsService.bulkModerationReviews(bulkDto, req.user.userId);

      return {
        success: true,
        message: 'Bulk moderation completed',
        data: {
          processed: result.processed,
          failed: result.failed.length,
          failedIds: result.failed,
        },
      };
    } catch (error) {
      this.logger.error('Failed to bulk moderate reviews:', error);
      throw error;
    }
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CONSUMER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a review (soft delete)' })
  @ApiResponse({ status: 200, description: 'Review deleted successfully' })
  @ApiResponse({ status: 403, description: 'Can only delete your own reviews' })
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body('reason') reason?: string,
  ) {
    if (!req.user.userId) {
      throw new BadRequestException(
        `user Id is : ${req.user.userId} and user Role is : ${req.user.role} are required`,
      );
    }
    try {
      const result = await this.reviewsService.remove(id, req.user.userId, req.user.role, reason);
      return {
        success: true,
        message: result.message,
      };
    } catch (error) {
      this.logger.error(`Failed to delete review ${id}:`, error);
      throw error;
    }
  }

  @Get('establishment/:establishmentId/summary')
  @Public()
  @ApiOperation({ summary: 'Get review summary for establishment' })
  @ApiResponse({ status: 200, description: 'Review summary retrieved successfully' })
  async getEstablishmentReviewSummary(@Param('establishmentId') establishmentId: string) {
    try {
      return await this.reviewsService.getEstablishmentReviewSummary(establishmentId);
    } catch (error) {
      this.logger.error(`Failed to fetch establishment review summary:`, error);
      throw error;
    }
  }

  @Get('user/:userId/stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user review statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'User review stats retrieved successfully' })
  async getUserReviewStats(@Param('userId') userId: string) {
    try {
      const stats = await this.reviewsService.getUserReviewStats(userId);

      return {
        success: true,
        message: 'User review stats retrieved successfully',
        data: stats,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch user review stats:`, error);
      throw error;
    }
  }

  @Get('trending/keywords')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @ApiOperation({ summary: 'Get trending keywords from reviews' })
  @ApiResponse({ status: 200, description: 'Trending keywords retrieved successfully' })
  async getTrendingKeywords(
    @Query('establishmentId') establishmentId?: string,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days?: number,
  ) {
    try {
      const keywords = await this.reviewsService.getTrendingKeywords(establishmentId, days);

      return {
        success: true,
        message: 'Trending keywords retrieved successfully',
        data: keywords,
      };
    } catch (error) {
      this.logger.error('Failed to fetch trending keywords:', error);
      throw error;
    }
  }

  @Post(':id/share')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CONSUMER, UserRole.MERCHANT)
  @ApiOperation({ summary: 'Share a review (increments share count)' })
  @ApiResponse({ status: 200, description: 'Review shared successfully' })
  @HttpCode(HttpStatus.OK)
  async shareReview(@Param('id') reviewId: string, @Body('platform') platform: string) {
    try {
      await this.reviewsService.incrementShareCount(reviewId, platform);

      return {
        success: true,
        message: 'Review shared successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to share review ${reviewId}:`, error);
      throw error;
    }
  }
}
