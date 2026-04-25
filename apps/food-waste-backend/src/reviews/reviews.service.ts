import { UserRole } from '@foodwaste/shared';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
  Logger,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types, ClientSession, PipelineStage, FilterQuery } from 'mongoose';

import { EventBusService } from '../common/services/event-bus/event-bus.service';
import { AppLoggerService } from '../common/services/logger.service';
import {
  Establishment,
  EstablishmentDocument,
} from '../establishments/schemas/establishment.schema';
import { GamificationService } from '../loyalty/services/gamification.service';
import { Offer, OfferDocument } from '../offers/schemas/offer.schema';
import { Order, OrderDocument, OrderStatus } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

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
} from './dto/create-review.dto';
import {
  Review,
  ReviewDocument,
  ReviewStatus,
  ReviewType,
  SentimentType,
} from './schemas/review.schema';

interface ReviewContentAnalysis {
  sentiment: SentimentType;
  confidence: number;
  positiveScore: number;
  negativeScore: number;
  neutralScore: number;
  keywords: string[];
  language: string;
}

export interface ReviewAnalytics {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: { [key: string]: number };
  sentimentDistribution: { [key: string]: number };
  reviewTrends: Array<{
    date: string;
    count: number;
    averageRating: number;
  }>;
  topKeywords: Array<{
    keyword: string;
    count: number;
  }>;
  engagementMetrics: {
    totalViews: number;
    totalHelpfulVotes: number;
    totalShares: number;
    averageEngagementScore: number;
  };
}

interface ReviewFacetCountResult {
  count: number;
}

interface ReviewListAggregationResult {
  reviews: ReviewDocument[];
  total: ReviewFacetCountResult[];
  analytics: Partial<ReviewAnalytics>[];
}

interface ReviewAnalyticsOverviewAggregationResult {
  totalReviews: number;
  averageRating: number | null;
  totalViews: number;
  totalHelpfulVotes: number;
  totalShares: number;
  averageEngagementScore: number | null;
}

interface ReviewAnalyticsFacetAggregationResult {
  overview: ReviewAnalyticsOverviewAggregationResult[];
  ratingDistribution: Array<{ _id: number; count: number }>;
  sentimentDistribution: Array<{ _id: string | null; count: number }>;
  reviewTrends: Array<{ _id: string; count: number; averageRating: number }>;
  topKeywords: Array<{ _id: string; count: number }>;
}

interface EstablishmentReviewSummaryAggregationResult {
  totalReviews: number;
  averageRating: number | null;
  ratingBreakdown: number[];
  averageDetailedRatings: Array<Record<string, number> | null>;
  sentimentBreakdown: Array<string | null>;
  totalHelpfulVotes: number;
  totalResponses: number;
}

interface UserReviewStatsAggregationResult {
  totalReviews: number;
  averageRating: number;
  totalHelpfulVotes: number;
  totalViews: number;
  verifiedReviews: number;
  statusBreakdown: string[];
  monthlyReviews: string[];
}

interface EstablishmentStatsAggregationResult {
  averageRating: number | null;
  totalReviews: number;
}

interface TrendingKeywordAggregationResult {
  _id: string;
  count: number;
  avgRating: number | null;
}

const EMPTY_REVIEW_LIST_AGGREGATION: ReviewListAggregationResult = {
  reviews: [],
  total: [],
  analytics: [],
};

const EMPTY_REVIEW_ANALYTICS_OVERVIEW: ReviewAnalyticsOverviewAggregationResult = {
  totalReviews: 0,
  averageRating: 0,
  totalViews: 0,
  totalHelpfulVotes: 0,
  totalShares: 0,
  averageEngagementScore: 0,
};

const EMPTY_REVIEW_ANALYTICS_FACET: ReviewAnalyticsFacetAggregationResult = {
  overview: [],
  ratingDistribution: [],
  sentimentDistribution: [],
  reviewTrends: [],
  topKeywords: [],
};

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Establishment.name)
    private readonly establishmentModel: Model<EstablishmentDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
    private readonly configService: ConfigService,
    private readonly eventBus: EventBusService,
    private readonly appLogger: AppLoggerService,
    @Optional()
    @Inject(forwardRef(() => GamificationService))
    private readonly gamificationService?: GamificationService,
  ) {
    void this.configService;
  }

  async create(createReviewDto: CreateReviewDto, reviewerId: string): Promise<ReviewDocument> {
    const session = await this.reviewModel.db.startSession();

    try {
      let review: ReviewDocument | null = null;

      await session.withTransaction(async () => {
        const reviewer = await this.userModel.findById(reviewerId).session(session);
        if (reviewer?.status !== 'active') {
          throw new NotFoundException('Reviewer not found or inactive');
        }
        // 2. Validate establishment exists and is active
        const establishment = await this.establishmentModel
          .findById(createReviewDto.establishmentId)
          .session(session);
        if (!establishment) {
          throw new NotFoundException('Establishment not found');
        }
        if (establishment.status !== 'active') {
          throw new BadRequestException('Cannot review inactive establishment');
        }
        // 3. Prevent self-review
        if (establishment.ownerId.toString() === reviewerId) {
          throw new ForbiddenException('Cannot review your own establishment');
        }

        // 4. Check for duplicate reviews
        const existingReview = await this.findExistingReview(
          reviewerId,
          createReviewDto.establishmentId,
          createReviewDto.orderId,
          session,
        );
        if (existingReview) {
          throw new ConflictException('You have already reviewed this establishment/order');
        }

        // 5. Validate order if provided
        let isVerifiedPurchase = false;
        if (createReviewDto.orderId) {
          const order = await this.orderModel.findById(createReviewDto.orderId).session(session);

          if (!order) {
            throw new NotFoundException('Order not found');
          }

          if (order.customerId.toString() !== reviewerId) {
            throw new ForbiddenException('Can only review your own orders');
          }

          if (order.status !== OrderStatus.PICKED_UP) {
            throw new BadRequestException('Can only review completed orders');
          }

          isVerifiedPurchase = true;
        }

        // 6. Validate offer if provided
        if (createReviewDto.offerId) {
          const offer = await this.offerModel.findById(createReviewDto.offerId).session(session);

          if (!offer) {
            throw new NotFoundException('Offer not found');
          }

          if (offer.establishmentId.toString() !== createReviewDto.establishmentId) {
            throw new BadRequestException('Offer does not belong to the specified establishment');
          }
        }

        // 7. Perform AI content analysis and moderation
        const contentAnalysis = this.analyzeReviewContent(createReviewDto.comment);
        const autoModerationResult = await this.performAutoModeration(createReviewDto);

        const reviewData = {
          ...createReviewDto,
          reviewerId: new Types.ObjectId(reviewerId),
          establishmentId: new Types.ObjectId(createReviewDto.establishmentId),
          orderId: createReviewDto.orderId
            ? new Types.ObjectId(createReviewDto.orderId)
            : undefined,
          offerId: createReviewDto.offerId
            ? new Types.ObjectId(createReviewDto.offerId)
            : undefined,
          isVerifiedPurchase,
          status: autoModerationResult.requiresManualReview
            ? ReviewStatus.PENDING
            : ReviewStatus.APPROVED,
          sentimentAnalysis: contentAnalysis,
          moderationInfo: {
            isModerated: false,
            autoModerationFlags: autoModerationResult.flags,
            manualModerationRequired: autoModerationResult.requiresManualReview,
          },
          metrics: {
            helpfulCount: 0,
            notHelpfulCount: 0,
            reportCount: 0,
            viewCount: 0,
            shareCount: 0,
          },
        };

        review = new this.reviewModel(reviewData);
        await review.save({ session });

        await this.updateEstablishmentStats(createReviewDto.establishmentId, session);

        if (createReviewDto.orderId) {
          await this.orderModel.findByIdAndUpdate(
            createReviewDto.orderId,
            { isRated: true, reviewId: review._id },
            { session },
          );
        }
      });

      const createdReview = review;
      if (createdReview === null) {
        throw new InternalServerErrorException('Review creation failed');
      }
      const createdReviewId = (createdReview as ReviewDocument)._id;

      // 11. Emit events for real-time notifications
      await this.eventBus.emit('review.created', {
        review,
        reviewerId,
        establishmentId: createReviewDto.establishmentId,
      });

      // 12. Award gamification points for review (non-blocking)
      if (this.gamificationService && createReviewDto.orderId && createReviewDto.comment) {
        try {
          const result = await this.gamificationService.awardReviewPoints(
            reviewerId,
            createReviewDto.orderId,
            createReviewDto.comment,
          );

          if (result.awarded) {
            this.appLogger.log(
              `Awarded ${result.pointsAwarded} points for review on order ${createReviewDto.orderId}`,
              'ReviewService.Gamification',
            );
          }
        } catch (gamificationError) {
          // Log error but don't fail the review creation
          this.appLogger.error(
            `Failed to award review points: ${(gamificationError as Error).message}`,
            'ReviewService.Gamification',
          );
        }
      }

      // 13. Return populated review via aggregation (2 populates → 1 round-trip)
      const pipeline: PipelineStage[] = [
        { $match: { _id: createdReviewId } },
        ...this.buildReviewerLookup(),
        ...this.buildEstablishmentLookupForReview(),
      ];
      const populatedReviews = await this.reviewModel.aggregate<ReviewDocument>(pipeline).exec();
      const [populated] = populatedReviews;
      if (!populated) {
        throw new InternalServerErrorException('Failed to load created review');
      }

      return populated;
    } catch (error) {
      this.logger.error('Failed to create review:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create review');
    } finally {
      await session.endSession();
    }
  }

  async findAll(queryDto: ReviewQueryDto): Promise<{
    reviews: ReviewDocument[];
    total: number;
    analytics: Partial<ReviewAnalytics>;
  }> {
    try {
      const { page = 1, limit = 10, ...filters } = queryDto;
      const skip = (page - 1) * limit;

      // Build aggregation pipeline
      const pipeline = this.buildReviewAggregationPipeline(filters, skip, limit);

      // Execute aggregation
      const [results] = await this.reviewModel.aggregate<ReviewListAggregationResult>([
        ...pipeline,
        {
          $facet: {
            reviews: [
              { $skip: skip },
              { $limit: limit },
              {
                $lookup: {
                  from: 'users',
                  localField: 'reviewerId',
                  foreignField: '_id',
                  as: 'reviewerId',
                  pipeline: [{ $project: { firstName: 1, lastName: 1, avatar: 1 } }],
                },
              },
              { $unwind: '$reviewerId' },
              {
                $lookup: {
                  from: 'establishments',
                  localField: 'establishmentId',
                  foreignField: '_id',
                  as: 'establishmentId',
                  pipeline: [{ $project: { name: 1, type: 1, averageRating: 1, totalReviews: 1 } }],
                },
              },
              { $unwind: '$establishmentId' },
            ],
            total: [{ $count: 'count' }],
            analytics: [
              {
                $group: {
                  _id: null,
                  averageRating: { $avg: '$overallRating' },
                  totalReviews: { $sum: 1 },
                  ratingDistribution: {
                    $push: {
                      $switch: {
                        branches: [
                          { case: { $eq: ['$overallRating', 1] }, then: 'one' },
                          { case: { $eq: ['$overallRating', 2] }, then: 'two' },
                          { case: { $eq: ['$overallRating', 3] }, then: 'three' },
                          { case: { $eq: ['$overallRating', 4] }, then: 'four' },
                          { case: { $eq: ['$overallRating', 5] }, then: 'five' },
                        ],
                        default: 'unknown',
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      ]);
      const reviewList = results ?? EMPTY_REVIEW_LIST_AGGREGATION;

      const reviews = reviewList.reviews;
      const total = reviewList.total[0]?.count ?? 0;
      const analytics = reviewList.analytics[0] ?? {};

      return { reviews, total, analytics };
    } catch (error) {
      this.logger.error('Failed to fetch reviews:', error);
      throw new InternalServerErrorException('Failed to fetch reviews');
    }
  }

  async findOne(id: string, userId?: string, userRole?: UserRole): Promise<ReviewDocument> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid review ID');
      }

      // ✅ PERFORMANCE: Single aggregation replaces findById + 4 populates (5 → 1 round-trip)
      const pipeline: PipelineStage[] = [
        { $match: { _id: new Types.ObjectId(id) } },
        ...this.buildReviewerLookup(),
        ...this.buildEstablishmentLookupForReview(true),
        ...this.buildOrderLookupForReview(),
        ...this.buildResponsesRespondedByLookup(),
      ];

      const results = await this.reviewModel.aggregate(pipeline).exec();
      const review = results[0] as ReviewDocument | undefined;

      if (!review) {
        throw new NotFoundException('Review not found');
      }

      // Check access permissions
      if (userId) {
        const effectiveUserRole = userRole ?? UserRole.CONSUMER;
        if (effectiveUserRole !== UserRole.ADMIN) {
          const canAccess = await this.checkReviewAccess(review, userId, effectiveUserRole);
          if (!canAccess) {
            throw new ForbiddenException('Access denied');
          }
        }
      }

      // Increment view count
      if (userId) {
        await this.incrementViewCount(id);
      }

      return review;
    } catch (error) {
      this.logger.error(`Failed to fetch review ${id}:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch review');
    }
  }

  /**
   * Update review with validation and moderation
   */
  async update(
    id: string,
    updateReviewDto: UpdateReviewDto,
    userId: string,
    userRole: UserRole,
  ): Promise<ReviewDocument> {
    const session = await this.reviewModel.db.startSession();

    try {
      let updatedReview: ReviewDocument | null = null;

      await session.withTransaction(async () => {
        const review = await this.reviewModel.findById(id).session(session);
        if (!review) {
          throw new NotFoundException('Review not found');
        }

        // Check permissions
        if (userRole !== UserRole.ADMIN && review.reviewerId.toString() !== userId) {
          throw new ForbiddenException('Can only update your own reviews');
        }

        // Check if review can be edited
        const daysSinceCreation = Math.floor(
          (Date.now() - (review.createdAt?.getTime() ?? Date.now())) / (1000 * 60 * 60 * 24),
        );

        if (daysSinceCreation > 30 && userRole !== UserRole.ADMIN) {
          throw new BadRequestException('Cannot edit reviews older than 30 days');
        }

        // Re-analyze content if comment changed
        let newSentimentAnalysis = review.sentimentAnalysis;
        let newModerationInfo = review.moderationInfo;

        if (updateReviewDto.comment && updateReviewDto.comment !== review.comment) {
          newSentimentAnalysis = this.analyzeReviewContent(updateReviewDto.comment);
          const autoModerationResult = await this.performAutoModeration({
            comment: updateReviewDto.comment,
          });

          newModerationInfo = {
            ...review.moderationInfo,
            autoModerationFlags: autoModerationResult.flags,
            manualModerationRequired: autoModerationResult.requiresManualReview,
          };

          // Re-moderate if content significantly changed
          if (autoModerationResult.requiresManualReview) {
            updateReviewDto.status = ReviewStatus.PENDING;
          }
        }

        // Update the review
        updatedReview = await this.reviewModel.findByIdAndUpdate(
          id,
          {
            ...updateReviewDto,
            sentimentAnalysis: newSentimentAnalysis,
            moderationInfo: newModerationInfo,
            isEdited: true,
            lastEditedAt: new Date(),
          },
          { new: true, session },
        );

        // Update establishment stats if rating changed
        if (
          updateReviewDto.overallRating &&
          updateReviewDto.overallRating !== review.overallRating
        ) {
          await this.updateEstablishmentStats(review.establishmentId.toString(), session);
        }
      });

      if (updatedReview === null) {
        throw new InternalServerErrorException('Review update failed');
      }

      // Emit update event
      await this.eventBus.emit('review.updated', {
        review: updatedReview,
        userId,
        changes: updateReviewDto,
      });

      return this.findOne(id, userId, userRole);
    } catch (error) {
      this.logger.error(`Failed to update review ${id}:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update review');
    } finally {
      await session.endSession();
    }
  }

  /**
   * Add response to review (establishment owner or admin)
   */
  async addResponse(
    reviewId: string,
    responseDto: ReviewResponseDto,
    userId: string,
    userRole: UserRole,
  ): Promise<ReviewDocument> {
    try {
      const review = await this.reviewModel.findById(reviewId);
      if (!review) {
        throw new NotFoundException('Review not found');
      }

      // Check permissions
      if (userRole === UserRole.ADMIN) {
        // Admin can respond to any review
      } else if (userRole === UserRole.MERCHANT) {
        // Check if user owns the establishment
        const establishment = await this.establishmentModel.findById(review.establishmentId);
        if (establishment?.ownerId.toString() !== userId) {
          throw new ForbiddenException('Can only respond to reviews of your establishments');
        }
      } else {
        throw new ForbiddenException('Only establishment owners and admins can respond to reviews');
      }

      // Check if already responded
      const existingResponse = review.responses.find(
        response => response.respondedBy.toString() === userId,
      );
      if (existingResponse) {
        throw new ConflictException('You have already responded to this review');
      }

      // Add response
      const response = {
        responseText: responseDto.responseText,
        respondedBy: new Types.ObjectId(userId),
        respondedAt: new Date(),
        isOwnerResponse: userRole === UserRole.MERCHANT,
      };

      review.responses.push(response);
      await review.save();

      // Emit response event
      await this.eventBus.emit('review.response_added', {
        review,
        response,
        responderId: userId,
      });

      return this.findOne(reviewId, userId, userRole);
    } catch (error) {
      this.logger.error(`Failed to add response to review ${reviewId}:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to add response');
    }
  }

  /**
   * Handle review interactions (helpful/not helpful)
   */
  async handleInteraction(
    reviewId: string,
    interactionDto: ReviewInteractionDto,
    userId: string,
  ): Promise<ReviewDocument> {
    try {
      const review = await this.reviewModel.findById(reviewId);
      if (!review) {
        throw new NotFoundException('Review not found');
      }

      const userObjectId = new Types.ObjectId(userId);

      // Remove any existing interaction from this user
      review.helpfulVoters = review.helpfulVoters.filter(voterId => voterId.toString() !== userId);
      review.notHelpfulVoters = review.notHelpfulVoters.filter(
        voterId => voterId.toString() !== userId,
      );

      // Add new interaction
      if (interactionDto.interactionType === 'helpful') {
        review.helpfulVoters.push(userObjectId);
        review.metrics.helpfulCount = review.helpfulVoters.length;
      } else {
        review.notHelpfulVoters.push(userObjectId);
        review.metrics.notHelpfulCount = review.notHelpfulVoters.length;
      }

      await review.save();

      // Emit interaction event
      await this.eventBus.emit('review.interaction', {
        reviewId,
        userId,
        interactionType: interactionDto.interactionType,
      });

      return review;
    } catch (error) {
      this.logger.error(`Failed to handle review interaction:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to handle interaction');
    }
  }

  async reportReview(
    reviewId: string,
    reportDto: ReviewReportDto,
    userId: string,
  ): Promise<{ message: string }> {
    try {
      const review = await this.reviewModel.findById(reviewId);
      if (!review) {
        throw new NotFoundException('Review not found');
      }
      const existingReport = review.reports.find(report => report.reportedBy.toString() === userId);
      if (existingReport) {
        throw new ConflictException('You have already reported this review');
      }
      const report = {
        reportedBy: new Types.ObjectId(userId),
        reason: reportDto.reason,
        reportedAt: new Date(),
        isResolved: false,
        additionalDetails: reportDto.additionalDetails,
      };

      review.reports.push(report);
      review.metrics.reportCount = review.reports.length;

      // Auto-flag review if it has multiple reports
      if (review.reports.length >= 3 && review.status === ReviewStatus.APPROVED) {
        review.status = ReviewStatus.FLAGGED;
        review.moderationInfo.manualModerationRequired = true;
      }

      await review.save();

      // Emit report event
      await this.eventBus.emit('review.reported', {
        reviewId,
        reporterId: userId,
        reason: reportDto.reason,
        reportCount: review.reports.length,
      });

      return { message: 'Review reported successfully' };
    } catch (error) {
      this.logger.error(`Failed to report review ${reviewId}:`, error);
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to report review');
    }
  }

  async moderateReview(
    reviewId: string,
    moderationDto: ReviewModerationDto,
    moderatorId: string,
  ): Promise<ReviewDocument> {
    try {
      const review = await this.reviewModel.findById(reviewId);
      if (!review) {
        throw new NotFoundException('Review not found');
      }

      const previousStatus = review.status;

      review.status = moderationDto.status;
      review.moderationInfo = {
        ...review.moderationInfo,
        isModerated: true,
        moderatedBy: new Types.ObjectId(moderatorId),
        moderatedAt: new Date(),
        moderationReason: moderationDto.moderationReason,
        manualModerationRequired: false,
      };

      await review.save();

      // Update establishment stats if review was approved/rejected
      if (previousStatus !== moderationDto.status) {
        await this.updateEstablishmentStats(review.establishmentId.toString());
      }

      // Emit moderation event
      await this.eventBus.emit('review.moderated', {
        reviewId,
        moderatorId,
        previousStatus,
        newStatus: moderationDto.status,
        reason: moderationDto.moderationReason,
      });

      return this.findOne(reviewId);
    } catch (error) {
      this.logger.error(`Failed to moderate review ${reviewId}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to moderate review');
    }
  }

  async getAnalytics(analyticsDto: ReviewAnalyticsDto): Promise<ReviewAnalytics> {
    try {
      const pipeline: PipelineStage[] = [];

      // Match stage with filters
      const matchStage: FilterQuery<ReviewDocument> = { isDeleted: { $ne: true } };

      if (analyticsDto.establishmentId) {
        matchStage.establishmentId = new Types.ObjectId(analyticsDto.establishmentId);
      }

      if (analyticsDto.startDate || analyticsDto.endDate) {
        const createdAtFilter: { $gte?: Date; $lte?: Date } = {};
        if (analyticsDto.startDate) {
          createdAtFilter.$gte = new Date(analyticsDto.startDate);
        }
        if (analyticsDto.endDate) {
          createdAtFilter.$lte = new Date(analyticsDto.endDate);
        }

        matchStage.createdAt = createdAtFilter;
      }

      pipeline.push({ $match: matchStage });

      // Facet for multiple analytics
      pipeline.push({
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                totalReviews: { $sum: 1 },
                averageRating: { $avg: '$overallRating' },
                totalViews: { $sum: '$metrics.viewCount' },
                totalHelpfulVotes: { $sum: '$metrics.helpfulCount' },
                totalShares: { $sum: '$metrics.shareCount' },
                averageEngagementScore: { $avg: '$engagementScore' },
              },
            },
          ],
          ratingDistribution: [
            {
              $group: {
                _id: '$overallRating',
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
          sentimentDistribution: [
            {
              $group: {
                _id: '$sentimentAnalysis.sentiment',
                count: { $sum: 1 },
              },
            },
          ],
          reviewTrends: [
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: this.getDateFormat(analyticsDto.groupBy),
                    date: '$createdAt',
                  },
                },
                count: { $sum: 1 },
                averageRating: { $avg: '$overallRating' },
              },
            },
            { $sort: { _id: 1 } },
            { $limit: 50 },
          ],
          topKeywords: [
            { $unwind: '$sentimentAnalysis.keywords' },
            {
              $group: {
                _id: '$sentimentAnalysis.keywords',
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 20 },
          ],
        },
      });

      const [results] =
        await this.reviewModel.aggregate<ReviewAnalyticsFacetAggregationResult>(pipeline);
      const analyticsResult = results ?? EMPTY_REVIEW_ANALYTICS_FACET;

      // Format results
      const overview = analyticsResult.overview[0] ?? EMPTY_REVIEW_ANALYTICS_OVERVIEW;
      const ratingDistribution = analyticsResult.ratingDistribution.reduce(
        (acc: Record<string, number>, item) => {
          acc[`rating_${item._id}`] = item.count;
          return acc;
        },
        {},
      );

      const sentimentDistribution = analyticsResult.sentimentDistribution.reduce(
        (acc: Record<string, number>, item) => {
          acc[item._id ?? 'unknown'] = item.count;
          return acc;
        },
        {},
      );

      const reviewTrends = analyticsResult.reviewTrends.map(item => ({
        date: item._id,
        count: item.count,
        averageRating: Math.round(item.averageRating * 100) / 100,
      }));

      const topKeywords = analyticsResult.topKeywords.map(item => ({
        keyword: item._id,
        count: item.count,
      }));

      return {
        totalReviews: overview.totalReviews ?? 0,
        averageRating: Math.round((overview.averageRating ?? 0) * 100) / 100,
        ratingDistribution,
        sentimentDistribution,
        reviewTrends,
        topKeywords,
        engagementMetrics: {
          totalViews: overview.totalViews ?? 0,
          totalHelpfulVotes: overview.totalHelpfulVotes ?? 0,
          totalShares: overview.totalShares ?? 0,
          averageEngagementScore: Math.round((overview.averageEngagementScore ?? 0) * 100) / 100,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get review analytics:', error);
      throw new InternalServerErrorException('Failed to get analytics');
    }
  }

  async bulkModerationReviews(
    bulkDto: BulkReviewModerationDto,
    moderatorId: string,
  ): Promise<{ processed: number; failed: string[] }> {
    const processed = [];
    const failed = [];

    for (const reviewId of bulkDto.reviewIds) {
      try {
        const statusMap = {
          approve: ReviewStatus.APPROVED,
          reject: ReviewStatus.REJECTED,
          flag: ReviewStatus.FLAGGED,
          spam: ReviewStatus.SPAM,
        };

        await this.moderateReview(
          reviewId,
          {
            status: statusMap[bulkDto.action],
            moderationReason: bulkDto.reason ?? `Bulk ${bulkDto.action}`,
          },
          moderatorId,
        );

        processed.push(reviewId);
      } catch (error) {
        this.logger.error(`Failed to bulk moderate review ${reviewId}:`, error);
        failed.push(reviewId);
      }
    }

    return { processed: processed.length, failed };
  }

  async remove(
    id: string,
    userId: string,
    userRole: UserRole,
    reason?: string,
  ): Promise<{ message: string }> {
    const session = await this.reviewModel.db.startSession();

    try {
      await session.withTransaction(async () => {
        const review = await this.reviewModel.findById(id).session(session);
        if (!review) {
          throw new NotFoundException('Review not found');
        }

        // Check permissions
        if (userRole !== UserRole.ADMIN && review.reviewerId.toString() !== userId) {
          throw new ForbiddenException('Can only delete your own reviews');
        }

        // Soft delete
        await this.reviewModel.findByIdAndUpdate(
          id,
          {
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy: userId,
            deletionReason: reason ?? 'User requested deletion',
          },
          { session },
        );

        // Update establishment stats
        await this.updateEstablishmentStats(review.establishmentId.toString(), session);
      });

      // Emit deletion event
      await this.eventBus.emit('review.deleted', {
        reviewId: id,
        deletedBy: userId,
        reason,
      });

      return { message: 'Review deleted successfully' };
    } catch (error) {
      this.logger.error(`Failed to delete review ${id}:`, error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete review');
    } finally {
      await session.endSession();
    }
  }

  async getMerchantEstablishments(merchantId: string): Promise<EstablishmentDocument[]> {
    try {
      return await this.establishmentModel
        .find({ ownerId: new Types.ObjectId(merchantId) })
        .select('_id name type')
        .exec();
    } catch (error) {
      // log the error for debugging
      this.appLogger.error(
        'Failed to fetch establishments',
        error instanceof Error ? error.stack : String(error),
        'ReviewService',
      );

      throw new Error('Unable to fetch establishments for merchant');
    }
  }

  async getMerchantReviews(
    establishmentIds: string[],
    queryDto: ReviewQueryDto,
  ): Promise<{
    reviews: ReviewDocument[];
    total: number;
    analytics: Partial<ReviewAnalytics>;
  }> {
    try {
      const objectIds = establishmentIds.map(id => new Types.ObjectId(id));

      const { establishmentId: _removedId, ...queryWithoutEstId } = queryDto;
      const modifiedQuery = queryWithoutEstId;
      const pipeline = this.buildReviewAggregationPipeline(modifiedQuery, 0, 0);
      const firstStage = pipeline[0];
      if (firstStage && '$match' in firstStage) {
        firstStage.$match['establishmentId'] = { $in: objectIds };
      }

      const { page = 1, limit = 10 } = queryDto;
      const skip = (page - 1) * limit;

      const [results] = await this.reviewModel.aggregate<ReviewListAggregationResult>([
        ...pipeline,
        {
          $facet: {
            reviews: [
              { $skip: skip },
              { $limit: limit },
              {
                $lookup: {
                  from: 'users',
                  localField: 'reviewerId',
                  foreignField: '_id',
                  as: 'reviewerId',
                  pipeline: [{ $project: { firstName: 1, lastName: 1, avatar: 1 } }],
                },
              },
              { $unwind: '$reviewerId' },
              {
                $lookup: {
                  from: 'establishments',
                  localField: 'establishmentId',
                  foreignField: '_id',
                  as: 'establishmentId',
                  pipeline: [{ $project: { name: 1, type: 1, averageRating: 1, totalReviews: 1 } }],
                },
              },
              { $unwind: '$establishmentId' },
            ],
            total: [{ $count: 'count' }],
            analytics: [
              {
                $group: {
                  _id: null,
                  averageRating: { $avg: '$overallRating' },
                  totalReviews: { $sum: 1 },
                },
              },
            ],
          },
        },
      ]);
      const merchantReviewList = results ?? EMPTY_REVIEW_LIST_AGGREGATION;

      return {
        reviews: merchantReviewList.reviews,
        total: merchantReviewList.total[0]?.count ?? 0,
        analytics: merchantReviewList.analytics[0] ?? {},
      };
    } catch (error) {
      this.logger.error('Failed to get merchant reviews:', error);
      throw new InternalServerErrorException('Failed to get merchant reviews');
    }
  }

  /**
   * Get establishment review summary
   */
  async getEstablishmentReviewSummary(establishmentId: string): Promise<Record<string, unknown>> {
    try {
      const pipeline: PipelineStage[] = [
        {
          $match: {
            establishmentId: new Types.ObjectId(establishmentId),
            status: ReviewStatus.APPROVED,
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            averageRating: { $avg: '$overallRating' },
            ratingBreakdown: {
              $push: '$overallRating',
            },
            averageDetailedRatings: {
              $push: '$detailedRatings',
            },
            sentimentBreakdown: {
              $push: '$sentimentAnalysis.sentiment',
            },
            totalHelpfulVotes: { $sum: '$metrics.helpfulCount' },
            totalResponses: { $sum: { $size: '$responses' } },
          },
        },
      ];

      const [result] =
        await this.reviewModel.aggregate<EstablishmentReviewSummaryAggregationResult>(pipeline);

      if (result === null || result === undefined) {
        return {
          totalReviews: 0,
          averageRating: 0,
          ratingBreakdown: {},
          averageDetailedRatings: {},
          sentimentBreakdown: {},
          responseRate: 0,
          averageHelpfulness: 0,
        };
      }

      // Process rating breakdown
      const ratingCounts = result.ratingBreakdown.reduce(
        (acc: Record<number, number>, rating: number) => {
          acc[rating] = (acc[rating] ?? 0) + 1;
          return acc;
        },
        {},
      );

      // Process sentiment breakdown
      const sentimentCounts = result.sentimentBreakdown.reduce(
        (acc: Record<string, number>, sentiment: string | null) => {
          if (sentiment !== null && sentiment !== undefined) {
            acc[sentiment] = (acc[sentiment] ?? 0) + 1;
          }
          return acc;
        },
        {},
      );

      // Calculate average detailed ratings
      const detailedRatingsSum = result.averageDetailedRatings.reduce(
        (
          acc: Record<string, { sum: number; count: number }>,
          ratings: Record<string, number> | null,
        ) => {
          if (ratings !== null && ratings !== undefined) {
            Object.keys(ratings).forEach(key => {
              const ratingValue = ratings[key];
              if (ratingValue !== null && ratingValue !== undefined) {
                acc[key] = acc[key] ?? { sum: 0, count: 0 };
                acc[key].sum += ratingValue;
                acc[key].count += 1;
              }
            });
          }
          return acc;
        },
        {},
      );

      const averageDetailedRatings = Object.keys(detailedRatingsSum).reduce<Record<string, number>>(
        (acc, key) => {
          const ratingStats = detailedRatingsSum[key];
          if (ratingStats !== null && ratingStats !== undefined) {
            acc[key] = Math.round((ratingStats.sum / ratingStats.count) * 100) / 100;
          }
          return acc;
        },
        {},
      );

      return {
        totalReviews: result.totalReviews,
        averageRating: Math.round((result.averageRating ?? 0) * 100) / 100,
        ratingBreakdown: ratingCounts,
        averageDetailedRatings,
        sentimentBreakdown: sentimentCounts,
        responseRate:
          result.totalReviews > 0
            ? Math.round((result.totalResponses / result.totalReviews) * 100)
            : 0,
        averageHelpfulness:
          result.totalReviews > 0
            ? Math.round((result.totalHelpfulVotes / result.totalReviews) * 100) / 100
            : 0,
      };
    } catch (error) {
      this.logger.error('Failed to get establishment review summary:', error);
      throw new InternalServerErrorException('Failed to get review summary');
    }
  }

  async getUserReviewStats(userId: string): Promise<Record<string, unknown>> {
    try {
      const pipeline: PipelineStage[] = [
        {
          $match: {
            reviewerId: new Types.ObjectId(userId),
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            averageRating: { $avg: '$overallRating' },
            totalHelpfulVotes: { $sum: '$metrics.helpfulCount' },
            totalViews: { $sum: '$metrics.viewCount' },
            verifiedReviews: { $sum: { $cond: ['$isVerifiedPurchase', 1, 0] } },
            statusBreakdown: { $push: '$status' },
            monthlyReviews: {
              $push: {
                $dateToString: { format: '%Y-%m', date: '$createdAt' },
              },
            },
          },
        },
      ];

      const [result] = await this.reviewModel.aggregate<UserReviewStatsAggregationResult>(pipeline);

      if (result === null || result === undefined) {
        return {
          totalReviews: 0,
          averageRating: 0,
          totalHelpfulVotes: 0,
          averageHelpfulness: 0,
          verificationRate: 0,
          statusBreakdown: {},
          monthlyActivity: {},
        };
      }

      // Process status breakdown
      const statusCounts = result.statusBreakdown.reduce(
        (acc: Record<string, number>, status: string) => {
          acc[status] = (acc[status] ?? 0) + 1;
          return acc;
        },
        {},
      );

      // Process monthly activity
      const monthlyActivity = result.monthlyReviews.reduce(
        (acc: Record<string, number>, month: string) => {
          acc[month] = (acc[month] ?? 0) + 1;
          return acc;
        },
        {},
      );

      return {
        totalReviews: result.totalReviews,
        averageRating: Math.round(result.averageRating * 100) / 100,
        totalHelpfulVotes: result.totalHelpfulVotes,
        averageHelpfulness:
          result.totalReviews > 0
            ? Math.round((result.totalHelpfulVotes / result.totalReviews) * 100) / 100
            : 0,
        verificationRate:
          result.totalReviews > 0
            ? Math.round((result.verifiedReviews / result.totalReviews) * 100)
            : 0,
        statusBreakdown: statusCounts,
        monthlyActivity,
      };
    } catch (error) {
      this.logger.error('Failed to get user review stats:', error);
      throw new InternalServerErrorException('Failed to get user stats');
    }
  }

  async getTrendingKeywords(
    establishmentId?: string,
    days: number = 30,
  ): Promise<Array<{ keyword: string; count: number; trend: string }>> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const matchStage: FilterQuery<ReviewDocument> = {
        status: ReviewStatus.APPROVED,
        isDeleted: { $ne: true },
        createdAt: { $gte: startDate },
      };

      if (establishmentId) {
        matchStage.establishmentId = new Types.ObjectId(establishmentId);
      }
      const pipeline: PipelineStage[] = [
        { $match: matchStage },
        {
          $project: {
            keywords: {
              $cond: [
                { $isArray: '$sentimentAnalysis.keywords' },
                '$sentimentAnalysis.keywords',
                [],
              ],
            },
            overallRating: 1,
          },
        },
        { $unwind: { path: '$keywords', preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: '$keywords',
            count: { $sum: 1 },
            avgRating: { $avg: '$overallRating' },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ];

      const results = await this.reviewModel.aggregate<TrendingKeywordAggregationResult>(pipeline);

      return results.map(item => ({
        keyword: item._id,
        count: item.count,
        trend:
          (item.avgRating ?? 0) > 3.5
            ? 'positive'
            : (item.avgRating ?? 0) < 2.5
              ? 'negative'
              : 'neutral',
      }));
    } catch (error) {
      this.logger.error('Failed to get trending keywords:', error);
      return [];
    }
  }

  async incrementShareCount(reviewId: string, platform: string): Promise<void> {
    try {
      await this.reviewModel.findByIdAndUpdate(reviewId, {
        $inc: { 'metrics.shareCount': 1 },
        $push: {
          'metadata.shares': {
            platform,
            sharedAt: new Date(),
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to increment share count for review ${reviewId}:`, error);
    }
  }

  // =========================================================================
  // REUSABLE $lookup PIPELINE BUILDERS (replaces .populate() — 1 round-trip)
  // =========================================================================

  private buildReviewerLookup(): PipelineStage[] {
    return [
      {
        $lookup: {
          from: 'users',
          let: { refId: '$reviewerId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$refId'] } } },
            { $project: { _id: 1, firstName: 1, lastName: 1, avatar: 1 } },
          ],
          as: '_reviewerDoc',
        },
      },
      { $unwind: { path: '$_reviewerDoc', preserveNullAndEmptyArrays: true } },
      { $addFields: { reviewerId: '$_reviewerDoc' } },
      { $project: { _reviewerDoc: 0 } },
    ];
  }

  private buildEstablishmentLookupForReview(includeAddress = false): PipelineStage[] {
    const fields: Record<string, 1> = {
      _id: 1,
      name: 1,
      type: 1,
      averageRating: 1,
      totalReviews: 1,
    };
    if (includeAddress) {
      fields['address'] = 1;
    }

    return [
      {
        $lookup: {
          from: 'establishments',
          let: { refId: '$establishmentId' },
          pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$refId'] } } }, { $project: fields }],
          as: '_establishmentDoc',
        },
      },
      { $unwind: { path: '$_establishmentDoc', preserveNullAndEmptyArrays: true } },
      { $addFields: { establishmentId: '$_establishmentDoc' } },
      { $project: { _establishmentDoc: 0 } },
    ];
  }

  private buildOrderLookupForReview(): PipelineStage[] {
    return [
      {
        $lookup: {
          from: 'orders',
          let: { refId: '$orderId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$refId'] } } },
            { $project: { _id: 1, orderNumber: 1, status: 1, createdAt: 1 } },
          ],
          as: '_orderDoc',
        },
      },
      { $unwind: { path: '$_orderDoc', preserveNullAndEmptyArrays: true } },
      { $addFields: { orderId: '$_orderDoc' } },
      { $project: { _orderDoc: 0 } },
    ];
  }

  /**
   * Populates `responses[].respondedBy` with user details.
   * Uses $map + $lookup pattern for nested array population.
   */
  private buildResponsesRespondedByLookup(): PipelineStage[] {
    return [
      {
        $lookup: {
          from: 'users',
          let: { responderIds: '$responses.respondedBy' },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', { $ifNull: ['$$responderIds', []] }] } } },
            { $project: { _id: 1, firstName: 1, lastName: 1 } },
          ],
          as: '_respondersDoc',
        },
      },
      {
        $addFields: {
          responses: {
            $map: {
              input: '$responses',
              as: 'resp',
              in: {
                $mergeObjects: [
                  '$$resp',
                  {
                    respondedBy: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$_respondersDoc',
                            as: 'u',
                            cond: { $eq: ['$$u._id', '$$resp.respondedBy'] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
      { $project: { _respondersDoc: 0 } },
    ];
  }

  private async checkReviewAccess(
    review: ReviewDocument,
    userId: string,
    userRole: UserRole,
  ): Promise<boolean> {
    if (userRole === UserRole.ADMIN) {
      return true;
    }
    if (review.status === ReviewStatus.APPROVED) {
      return true;
    }
    if (review.reviewerId.toString() === userId) {
      return true;
    }
    if (userRole === UserRole.MERCHANT) {
      const establishment = await this.establishmentModel.findById(review.establishmentId);
      if (establishment?.ownerId.toString() === userId) {
        return true;
      }
    }

    return false;
  }

  private async findExistingReview(
    reviewerId: string,
    establishmentId: string,
    orderId?: string,
    session?: ClientSession,
  ): Promise<ReviewDocument | null> {
    const query: FilterQuery<ReviewDocument> = {
      reviewerId,
      establishmentId,
      isDeleted: { $ne: true },
    };

    if (orderId) {
      query.orderId = orderId;
    } else {
      query.type = ReviewType.ESTABLISHMENT;
      query.orderId = { $exists: false };
    }

    const review = await this.reviewModel.findOne(query).session(session ?? null);
    return review;
  }

  private analyzeReviewContent(comment: string): ReviewContentAnalysis {
    try {
      // This would integrate with actual AI services like:
      // - AWS Comprehend
      // - Google Cloud Natural Language
      // - Azure Text Analytics
      // - OpenAI API

      // Mock implementation - replace with actual AI service
      const words = comment.toLowerCase().split(' ');
      const positiveWords = [
        'great',
        'excellent',
        'amazing',
        'wonderful',
        'fantastic',
        'love',
        'perfect',
        'awesome',
      ];
      const negativeWords = [
        'terrible',
        'awful',
        'bad',
        'horrible',
        'disgusting',
        'hate',
        'worst',
        'disappointing',
      ];

      const positiveCount = words.filter(word => positiveWords.includes(word)).length;
      const negativeCount = words.filter(word => negativeWords.includes(word)).length;

      let sentiment = SentimentType.NEUTRAL;
      let confidence = 0.5;

      if (positiveCount > negativeCount) {
        sentiment = SentimentType.POSITIVE;
        confidence = Math.min(0.9, 0.6 + positiveCount * 0.1);
      } else if (negativeCount > positiveCount) {
        sentiment = SentimentType.NEGATIVE;
        confidence = Math.min(0.9, 0.6 + negativeCount * 0.1);
      }

      return {
        sentiment,
        confidence,
        positiveScore: positiveCount / words.length,
        negativeScore: negativeCount / words.length,
        neutralScore: 1 - (positiveCount + negativeCount) / words.length,
        keywords: [...positiveWords, ...negativeWords].filter(word => words.includes(word)),
        language: 'en', // Would be detected by AI service
      };
    } catch (error) {
      this.logger.error('Failed to analyze review content:', error);
      return {
        sentiment: SentimentType.NEUTRAL,
        confidence: 0.5,
        positiveScore: 0.33,
        negativeScore: 0.33,
        neutralScore: 0.34,
        keywords: [],
        language: 'unknown',
      };
    }
  }

  private async performAutoModeration(reviewData: { comment: string }): Promise<{
    requiresManualReview: boolean;
    flags: string[];
  }> {
    const flags: string[] = [];
    let requiresManualReview = false;
    if (this.detectSpam(reviewData.comment)) {
      flags.push('potential_spam');
      requiresManualReview = true;
    }

    if (this.detectInappropriateContent(reviewData.comment)) {
      flags.push('inappropriate_content');
      requiresManualReview = true;
    }

    if (this.detectFakeReview(reviewData)) {
      flags.push('potential_fake');
      requiresManualReview = true;
    }

    if (reviewData.comment.length < 20) {
      flags.push('low_quality');
    }

    const result = await Promise.resolve({ requiresManualReview, flags });
    return result;
  }

  private detectSpam(comment: string): boolean {
    const spamIndicators = [
      /https?:\/\//gi, // URLs
      /\b(buy|sell|discount|offer|deal)\b/gi,
      /\b(call|contact|phone)\s+\d+/gi,
      /(.)\1{4,}/g, // Repeated characters
    ];

    return spamIndicators.some(pattern => pattern.test(comment));
  }

  /**
   * Detect inappropriate content
   */
  private detectInappropriateContent(comment: string): boolean {
    // This would integrate with content moderation APIs
    const inappropriateWords = [
      // Add your inappropriate words list
      'offensive',
      'inappropriate', // placeholder words
    ];

    const lowerComment = comment.toLowerCase();
    return inappropriateWords.some(word => lowerComment.includes(word));
  }

  /**
   * Detect potentially fake reviews
   */
  private detectFakeReview(_reviewData: unknown): boolean {
    // Check for patterns that indicate fake reviews
    // This could include checking:
    // - Review velocity from same user
    // - Similar content patterns
    // - Unusual rating distributions
    // - Geographic inconsistencies

    return false; // Placeholder implementation
  }

  /**
   * Update establishment statistics
   */
  private async updateEstablishmentStats(
    establishmentId: string,
    session?: ClientSession,
  ): Promise<void> {
    try {
      const stats = await this.reviewModel
        .aggregate<EstablishmentStatsAggregationResult>([
          {
            $match: {
              establishmentId: new Types.ObjectId(establishmentId),
              status: ReviewStatus.APPROVED,
              isDeleted: { $ne: true },
            },
          },
          {
            $group: {
              _id: null,
              averageRating: { $avg: '$overallRating' },
              totalReviews: { $sum: 1 },
            },
          },
        ])
        .session(session ?? null);

      const summary: EstablishmentStatsAggregationResult = stats[0] ?? {
        averageRating: 0,
        totalReviews: 0,
      };

      await this.establishmentModel.findByIdAndUpdate(
        establishmentId,
        {
          averageRating: Math.round((summary.averageRating ?? 0) * 100) / 100,
          totalReviews: summary.totalReviews,
        },
        { session: session ?? null },
      );
    } catch (error) {
      this.logger.error(`Failed to update establishment stats for ${establishmentId}:`, error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  /**
   * Increment view count for review
   */
  private async incrementViewCount(reviewId: string): Promise<void> {
    try {
      await this.reviewModel.findByIdAndUpdate(reviewId, { $inc: { 'metrics.viewCount': 1 } });
    } catch (error) {
      this.logger.error(`Failed to increment view count for review ${reviewId}:`, error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  /**
   * Build aggregation pipeline for reviews
   */
  private buildReviewAggregationPipeline(
    filters: Partial<ReviewQueryDto>,
    _skip: number,
    _limit: number,
  ): PipelineStage[] {
    const pipeline: PipelineStage[] = [];

    // Match stage
    const matchStage: FilterQuery<ReviewDocument> = { isDeleted: { $ne: true } };

    if (filters.status !== null && filters.status !== undefined) {
      matchStage.status = filters.status;
    }

    if (filters.establishmentId) {
      matchStage.establishmentId = new Types.ObjectId(filters.establishmentId);
    }

    if (filters.reviewerId) {
      matchStage.reviewerId = new Types.ObjectId(filters.reviewerId);
    }

    if (filters.type !== null && filters.type !== undefined) {
      matchStage.type = filters.type;
    }

    if (filters.sentiment !== null && filters.sentiment !== undefined) {
      matchStage['sentimentAnalysis.sentiment'] = filters.sentiment;
    }

    if (filters.minRating || filters.maxRating) {
      const overallRatingFilter: { $gte?: number; $lte?: number } = {};
      if (filters.minRating) {
        overallRatingFilter.$gte = filters.minRating;
      }
      if (filters.maxRating) {
        overallRatingFilter.$lte = filters.maxRating;
      }

      matchStage.overallRating = overallRatingFilter;
    }

    if (filters.verifiedPurchaseOnly === true) {
      matchStage.isVerifiedPurchase = true;
    }

    if (filters.recommendedOnly === true) {
      matchStage.isRecommended = true;
    }

    if (filters.fromDate || filters.toDate) {
      const createdAtFilter: { $gte?: Date; $lte?: Date } = {};
      if (filters.fromDate) {
        createdAtFilter.$gte = new Date(filters.fromDate);
      }
      if (filters.toDate) {
        createdAtFilter.$lte = new Date(filters.toDate);
      }

      matchStage.createdAt = createdAtFilter;
    }

    if (filters.tags) {
      const tagArray = filters.tags.split(',').map(tag => tag.trim());
      matchStage.tags = { $in: tagArray };
    }

    if (filters.search) {
      matchStage.$text = { $search: filters.search };
    }

    pipeline.push({ $match: matchStage });

    // Sort stage
    const sortField = filters.sortBy ?? 'createdAt';
    const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;

    if (sortField === 'helpfulCount') {
      pipeline.push({ $sort: { 'metrics.helpfulCount': sortOrder } });
    } else if (sortField === 'engagementScore') {
      pipeline.push({ $sort: { engagementScore: sortOrder } });
    } else {
      pipeline.push({ $sort: { [sortField]: sortOrder } });
    }

    return pipeline;
  }

  /**
   * Get date format for grouping based on period
   */
  private getDateFormat(groupBy: string = 'month'): string {
    const formats: Record<'day' | 'week' | 'month' | 'year', string> = {
      day: '%Y-%m-%d',
      week: '%Y-%U',
      month: '%Y-%m',
      year: '%Y',
    };
    return groupBy in formats ? formats[groupBy as keyof typeof formats] : formats.month;
  }

  // ================================
  // CRON JOBS FOR MAINTENANCE
  // ================================
  // NOTE: cleanupDeletedReviews() removed — replaced by centralized
  // ArchiveModule cron (5 AM) that archives + purges all entities.

  /**
   * Re-calculate establishment ratings periodically
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async recalculateEstablishmentRatings(): Promise<void> {
    try {
      const establishments = await this.establishmentModel
        .find({
          status: 'active',
        })
        .select('_id')
        .lean();

      let updated = 0;
      for (const establishment of establishments) {
        await this.updateEstablishmentStats(establishment._id.toString());
        updated++;
      }

      this.logger.log(`Recalculated ratings for ${updated} establishments`);
    } catch (error) {
      this.logger.error('Failed to recalculate establishment ratings:', error);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async processManualModerationQueue(): Promise<void> {
    try {
      const reviewsToModerate = await this.reviewModel
        .find({
          'moderationInfo.manualModerationRequired': true,
          status: { $in: [ReviewStatus.PENDING, ReviewStatus.FLAGGED] },
        })
        .select('_id status moderationInfo userId establishmentId rating')
        .limit(100)
        .lean();

      if (reviewsToModerate.length > 0) {
        this.logger.log(`Found ${reviewsToModerate.length} reviews requiring manual moderation`);

        // Emit event for admin notification
        await this.eventBus.emit('reviews.moderation_required', {
          count: reviewsToModerate.length,
          reviews: reviewsToModerate.map(r => ({
            id: r._id,
            flags: r.moderationInfo.autoModerationFlags,
            createdAt: r.createdAt,
          })),
        });
      }
    } catch (error) {
      this.logger.error('Failed to process manual moderation queue:', error);
    }
  }
}
