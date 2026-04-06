import { RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bull';
// plainToClass import removed - not currently used

import { ReviewDocument } from '../reviwes/schemas/reviwe.schema';
import { ReviewCacheService } from '../services/review-cache.service';

// Event payload interfaces for type safety
export interface ReviewCreatedEvent {
  review: ReviewDocument;
  establishmentId: string;
  reviewerId: string;
  isFirstReview?: boolean;
  metadata?: {
    source?: 'web' | 'mobile' | 'api';
    userAgent?: string;
    ipAddress?: string;
    timestamp: Date;
  };
}

export interface ReviewUpdatedEvent {
  review: ReviewDocument;
  previousData: Partial<ReviewDocument>;
  updatedFields: string[];
  updatedBy: string;
  updateReason?: string;
  metadata?: {
    updateType: 'content' | 'status' | 'moderation' | 'admin';
    timestamp: Date;
  };
}

export interface ReviewDeletedEvent {
  reviewId: string;
  establishmentId: string;
  reviewerId: string;
  deletedBy: string;
  deletionReason: string;
  softDelete: boolean;
  metadata?: {
    originalData: Partial<ReviewDocument>;
    cascadeOperations?: string[];
    timestamp: Date;
  };
}

export interface ReviewModeratedEvent {
  reviewId: string;
  status: string;
  reason?: string;
}

export interface ReviewAnalyzedEvent {
  reviewId: string;
  sentiment: string;
  qualityScore: number;
  keywords?: string[];
}

@Injectable()
export class ReviewEventListener {
  private readonly logger = new Logger(ReviewEventListener.name);

  constructor(
    private readonly cacheService: ReviewCacheService,
    @InjectQueue('review-processing') private readonly reviewQueue: Queue,
    @InjectQueue('notification-processing') private readonly notificationQueue: Queue,
    @InjectQueue('review-analytics') private readonly analyticsQueue: Queue,
  ) {}

  // ==================== REVIEW CREATED HANDLERS ====================

  /**
   * RabbitMQ handler for review creation events
   * Deserializes payload and delegates to shared processing logic
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'review.created',
    queue: 'foodwaste.reviews.created',
    queueOptions: {
      durable: true,
      deadLetterExchange: 'foodwaste.events.dlx',
      messageTtl: 86400000, // 24 hours
    },
  })
  async handleReviewCreatedEventRabbitMQ(payload: unknown): Promise<void | Nack> {
    try {
      this.logger.log(
        `[RabbitMQ] Processing review created event for review ${(payload as ReviewCreatedEvent)?.review?._id?.toString() ?? 'unknown'}`,
      );

      // Type cast payload (interfaces can't use plainToClass)
      const typedPayload = payload as ReviewCreatedEvent;

      // Delegate to shared processing logic
      await this.processReviewCreated(typedPayload);
    } catch (error) {
      this.logger.error(`[RabbitMQ] Failed to process review created event:`, error);
      // Critical event: requeue for retry
      return new Nack(true);
    }
  }

  /**
   * Legacy EventEmitter2 handler for review creation events
   * Delegates to shared processing logic
   */
  @OnEvent('review.created')
  async handleReviewCreatedEventLegacy(payload: ReviewCreatedEvent): Promise<void> {
    try {
      this.logger.log(`[Legacy] Processing review created event for review ${payload.review._id}`);
      await this.processReviewCreated(payload);
    } catch (error) {
      this.logger.error(`[Legacy] Failed to process review created event:`, error);
      await this.queueRetryJob('review.created.retry', payload, error);
    }
  }

  /**
   * Shared business logic for review creation
   * Handles: Cache storage, background processing, notifications, analytics
   */
  private async processReviewCreated(payload: ReviewCreatedEvent): Promise<void> {
    const startTime = Date.now();

    // 1. Validate payload
    if (!this.validateReviewCreatedPayload(payload)) {
      this.logger.error('Invalid review created event payload', payload);
      throw new Error('Invalid payload');
    }

    // 2. Cache the new review with extended TTL (new reviews get more traffic)
    await this.cacheService.cacheReview(payload.review, 7200); // 2 hours
    this.logger.debug(`Cached new review ${payload.review._id}`);

    // 3. Queue background processing jobs in parallel for performance
    const processingJobs = [
      // Content analysis and sentiment processing
      this.reviewQueue.add(
        'process',
        {
          reviewId: payload.review._id.toString(),
          action: 'create',
          metadata: {
            priority: 'high',
            source: payload.metadata?.source ?? 'unknown',
          },
        },
        {
          priority: payload.isFirstReview === true ? 1 : 5, // First reviews get higher priority
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      ),

      // Analytics and metrics processing
      this.analyticsQueue.add(
        'review-created',
        {
          reviewId: payload.review._id.toString(),
          establishmentId: payload.establishmentId,
          reviewerId: payload.reviewerId,
          rating: payload.review.overallRating,
          isFirstReview: payload.isFirstReview,
          source: payload.metadata?.source,
          timestamp: payload.metadata?.timestamp ?? new Date(),
        },
        {
          attempts: 2,
          delay: 1000, // Slight delay for analytics
        },
      ),
    ];

    // 4. Queue notification jobs
    const notificationJobs = [
      // Notify establishment owner
      this.notificationQueue.add(
        'establishment-review-notification',
        {
          type: 'new_review',
          establishmentId: payload.establishmentId,
          reviewId: payload.review._id.toString(),
          reviewerName: `${payload.review.reviewerId}`, // Would need to populate user data
          rating: payload.review.overallRating,
          comment: payload.review.comment.substring(0, 100),
          isFirstReview: payload.isFirstReview,
        },
        {
          delay: payload.review.overallRating <= 2 ? 0 : 5000, // Immediate for bad reviews
          attempts: 3,
        },
      ),

      // Thank you message to reviewer (if first review)
      ...(payload.isFirstReview === true
        ? [
            {
              queue: this.notificationQueue.add(
                'reviewer-welcome',
                {
                  type: 'first_review_thanks',
                  reviewerId: payload.reviewerId,
                  reviewId: payload.review._id.toString(),
                  establishmentName: payload.establishmentId, // Would need establishment name
                },
                {
                  delay: 10000, // 10 seconds delay
                  attempts: 2,
                },
              ),
            },
          ]
        : []),
    ];

    // 5. Execute all jobs concurrently for optimal performance
    await Promise.allSettled([...processingJobs, ...notificationJobs]);

    // 6. Handle special cases
    await this.handleSpecialReviewCases(payload);

    // 7. Update cache indexes and warm related data
    await this.updateCacheIndexes(payload);

    const processingTime = Date.now() - startTime;
    this.logger.log(
      `Successfully processed review created event in ${processingTime}ms for review ${payload.review._id}`,
    );
  }

  // ==================== REVIEW UPDATED HANDLERS ====================

  /**
   * RabbitMQ handler for review update events
   * Deserializes payload and delegates to shared processing logic
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'review.updated',
    queue: 'foodwaste.reviews.updated',
    queueOptions: {
      durable: true,
      deadLetterExchange: 'foodwaste.events.dlx',
      messageTtl: 86400000, // 24 hours
    },
  })
  async handleReviewUpdatedEventRabbitMQ(payload: unknown): Promise<void | Nack> {
    try {
      this.logger.log(
        `[RabbitMQ] Processing review updated event for review ${(payload as ReviewUpdatedEvent)?.review?._id?.toString() ?? 'unknown'}`,
      );

      // Type cast payload (interfaces can't use plainToClass)
      const typedPayload = payload as ReviewUpdatedEvent;

      // Delegate to shared processing logic
      await this.processReviewUpdated(typedPayload);
    } catch (error) {
      this.logger.error(`[RabbitMQ] Failed to process review updated event:`, error);
      // Critical event: requeue for retry
      return new Nack(true);
    }
  }

  /**
   * Legacy EventEmitter2 handler for review update events
   * Delegates to shared processing logic
   */
  @OnEvent('review.updated')
  async handleReviewUpdatedEventLegacy(payload: ReviewUpdatedEvent): Promise<void> {
    try {
      this.logger.log(`[Legacy] Processing review updated event for review ${payload.review._id}`);
      await this.processReviewUpdated(payload);
    } catch (error) {
      this.logger.error(`[Legacy] Failed to process review updated event:`, error);
      await this.queueRetryJob('review.updated.retry', payload, error);
    }
  }

  /**
   * Shared business logic for review updates
   * Handles: Cache invalidation/update, re-processing, update notifications
   */
  private async processReviewUpdated(payload: ReviewUpdatedEvent): Promise<void> {
    const startTime = Date.now();

    // 1. Validate payload
    if (!this.validateReviewUpdatedPayload(payload)) {
      this.logger.error('Invalid review updated event payload', payload);
      throw new Error('Invalid payload');
    }

    // 2. Invalidate old cache and update with fresh data
    await this.cacheService.invalidateReviewCache(payload.review._id.toString());
    await this.cacheService.cacheReview(payload.review, 3600); // Standard TTL
    this.logger.debug(`Updated cache for review ${payload.review._id}`);

    // 3. Determine processing requirements based on what was updated
    const needsReprocessing = this.determineReprocessingNeeds(payload.updatedFields);
    const needsRemoderation = this.determineRemoderationNeeds(payload.updatedFields);

    // 4. Queue appropriate processing jobs
    const processingJobs = [];

    if (needsReprocessing) {
      processingJobs.push(
        this.reviewQueue.add(
          'process',
          {
            reviewId: payload.review._id.toString(),
            action: 'update',
            metadata: {
              updatedFields: payload.updatedFields,
              updateType: payload.metadata?.updateType,
            },
          },
          {
            priority: needsRemoderation ? 2 : 7, // Higher priority for moderation
            attempts: 3,
          },
        ),
      );
    }

    // 5. Queue notifications based on update type
    if (this.shouldNotifyUpdate(payload)) {
      processingJobs.push(
        this.notificationQueue.add(
          'review-updated-notification',
          {
            type: 'review_updated',
            reviewId: payload.review._id.toString(),
            establishmentId: payload.review.establishmentId.toString(),
            updateType: payload.metadata?.updateType,
            updatedFields: payload.updatedFields,
            updatedBy: payload.updatedBy,
          },
          {
            delay: 2000,
            attempts: 2,
          },
        ),
      );
    }

    // 6. Analytics for significant updates
    if (this.isSignificantUpdate(payload.updatedFields)) {
      processingJobs.push(
        this.analyticsQueue.add('review-updated', {
          reviewId: payload.review._id.toString(),
          establishmentId: payload.review.establishmentId.toString(),
          updatedFields: payload.updatedFields,
          updateType: payload.metadata?.updateType,
          previousRating: payload.previousData.overallRating,
          newRating: payload.review.overallRating,
          timestamp: payload.metadata?.timestamp ?? new Date(),
        }),
      );
    }

    // 7. Execute all processing jobs
    await Promise.allSettled(processingJobs);

    // 8. Handle establishment-level cache invalidation if rating changed
    if (payload.updatedFields.includes('overallRating')) {
      await this.cacheService.invalidateEstablishmentReviews(
        payload.review.establishmentId.toString(),
      );
      this.logger.debug(`Invalidated establishment cache due to rating change`);
    }

    const processingTime = Date.now() - startTime;
    this.logger.log(
      `Successfully processed review updated event in ${processingTime}ms for review ${payload.review._id}`,
    );
  }

  // ==================== REVIEW DELETED HANDLERS ====================

  /**
   * RabbitMQ handler for review deletion events
   * Deserializes payload and delegates to shared processing logic
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'review.deleted',
    queue: 'foodwaste.reviews.deleted',
    queueOptions: {
      durable: true,
      deadLetterExchange: 'foodwaste.events.dlx',
      messageTtl: 86400000, // 24 hours
    },
  })
  async handleReviewDeletedEventRabbitMQ(payload: unknown): Promise<void | Nack> {
    try {
      this.logger.log(
        `[RabbitMQ] Processing review deleted event for review ${(payload as ReviewDeletedEvent)?.reviewId || 'unknown'}`,
      );

      // Type cast payload (interfaces can't use plainToClass)
      const typedPayload = payload as ReviewDeletedEvent;

      // Delegate to shared processing logic
      await this.processReviewDeleted(typedPayload);
    } catch (error) {
      this.logger.error(`[RabbitMQ] Failed to process review deleted event:`, error);
      // Critical event: requeue for retry
      return new Nack(true);
    }
  }

  /**
   * Legacy EventEmitter2 handler for review deletion events
   * Delegates to shared processing logic
   */
  @OnEvent('review.deleted')
  async handleReviewDeletedEventLegacy(payload: ReviewDeletedEvent): Promise<void> {
    try {
      this.logger.log(`[Legacy] Processing review deleted event for review ${payload.reviewId}`);
      await this.processReviewDeleted(payload);
    } catch (error) {
      this.logger.error(`[Legacy] Failed to process review deleted event:`, error);
      await this.queueRetryJob('review.deleted.retry', payload, error);
    }
  }

  /**
   * Shared business logic for review deletion
   * Handles: Cache cleanup, cascade operations, deletion notifications, analytics
   */
  private async processReviewDeleted(payload: ReviewDeletedEvent): Promise<void> {
    const startTime = Date.now();

    // 1. Validate payload
    if (!this.validateReviewDeletedPayload(payload)) {
      this.logger.error('Invalid review deleted event payload', payload);
      throw new Error('Invalid payload');
    }

    // 2. Immediate cache cleanup
    await this.cacheService.invalidateReviewCache(payload.reviewId);
    this.logger.debug(`Removed review ${payload.reviewId} from cache`);

    // 3. Handle cascade cache invalidation
    await this.handleCascadeCacheOperations(payload);

    // 4. Queue processing jobs for deletion handling
    const processingJobs = [
      // Analytics tracking for deletion
      this.analyticsQueue.add(
        'review-deleted',
        {
          reviewId: payload.reviewId,
          establishmentId: payload.establishmentId,
          reviewerId: payload.reviewerId,
          deletedBy: payload.deletedBy,
          deletionReason: payload.deletionReason,
          softDelete: payload.softDelete,
          originalRating: payload.metadata?.originalData?.overallRating,
          timestamp: payload.metadata?.timestamp ?? new Date(),
        },
        {
          attempts: 2,
        },
      ),

      // Update establishment metrics (remove deleted review impact)
      this.reviewQueue.add(
        'process',
        {
          reviewId: payload.reviewId,
          action: 'delete_cleanup',
          metadata: {
            establishmentId: payload.establishmentId,
            softDelete: payload.softDelete,
            originalData: payload.metadata?.originalData,
          },
        },
        {
          priority: 6,
          attempts: 3,
        },
      ),
    ];

    // 5. Notification jobs based on deletion type
    if (this.shouldNotifyDeletion(payload)) {
      processingJobs.push(
        this.notificationQueue.add(
          'review-deleted-notification',
          {
            type: 'review_deleted',
            reviewId: payload.reviewId,
            establishmentId: payload.establishmentId,
            reviewerId: payload.reviewerId,
            deletedBy: payload.deletedBy,
            deletionReason: payload.deletionReason,
            wasPublic: !payload.softDelete,
          },
          {
            delay: 1000,
            attempts: 2,
          },
        ),
      );
    }

    // 6. Execute all processing jobs
    await Promise.allSettled(processingJobs);

    // 7. Handle special deletion scenarios
    await this.handleSpecialDeletionCases(payload);

    const processingTime = Date.now() - startTime;
    this.logger.log(
      `Successfully processed review deleted event in ${processingTime}ms for review ${payload.reviewId}`,
    );
  }

  // ==================== REVIEW MODERATED HANDLERS ====================

  /**
   * RabbitMQ handler for review moderation completion events
   * Deserializes payload and delegates to shared processing logic
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'review.moderated',
    queue: 'foodwaste.reviews.moderated',
    queueOptions: {
      durable: true,
      deadLetterExchange: 'foodwaste.events.dlx',
      messageTtl: 86400000, // 24 hours
    },
  })
  async handleReviewModeratedEventRabbitMQ(payload: unknown): Promise<void | Nack> {
    try {
      this.logger.log(
        `[RabbitMQ] Processing review moderation event for review ${(payload as ReviewModeratedEvent)?.reviewId || 'unknown'}`,
      );

      // Type cast payload (interfaces can't use plainToClass)
      const typedPayload = payload as ReviewModeratedEvent;

      // Delegate to shared processing logic
      await this.processReviewModerated(typedPayload);
    } catch (error) {
      this.logger.error(`[RabbitMQ] Failed to process review moderation event:`, error);
      // Critical event: requeue for retry
      return new Nack(true);
    }
  }

  /**
   * Legacy EventEmitter2 handler for review moderation completion events
   * Delegates to shared processing logic
   */
  @OnEvent('review.moderated')
  async handleReviewModeratedEventLegacy(payload: ReviewModeratedEvent): Promise<void> {
    try {
      this.logger.log(`[Legacy] Processing review moderation event for review ${payload.reviewId}`);
      await this.processReviewModerated(payload);
    } catch (error) {
      this.logger.error(`[Legacy] Failed to process review moderation event:`, error);
    }
  }

  /**
   * Shared business logic for review moderation completion
   * Handles: Cache update, notifications
   */
  private async processReviewModerated(payload: ReviewModeratedEvent): Promise<void> {
    // Update cache with moderated status
    await this.cacheService.invalidateReviewCache(payload.reviewId);

    // Notify relevant parties
    await this.notificationQueue.add('moderation-completed', {
      reviewId: payload.reviewId,
      status: payload.status,
      reason: payload.reason,
    });

    this.logger.log(
      `Successfully processed review moderation event for review ${payload.reviewId}`,
    );
  }

  // ==================== REVIEW ANALYZED HANDLERS ====================

  /**
   * RabbitMQ handler for review analytics completion events
   * Deserializes payload and delegates to shared processing logic
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'review.analyzed',
    queue: 'foodwaste.reviews.analyzed',
    queueOptions: {
      durable: true,
      deadLetterExchange: 'foodwaste.events.dlx',
      messageTtl: 86400000, // 24 hours
    },
  })
  async handleReviewAnalyzedEventRabbitMQ(payload: unknown): Promise<void | Nack> {
    try {
      this.logger.log(
        `[RabbitMQ] Processing review analysis completion for review ${(payload as ReviewAnalyzedEvent)?.reviewId || 'unknown'}`,
      );

      // Type cast payload (interfaces can't use plainToClass)
      const typedPayload = payload as ReviewAnalyzedEvent;

      // Delegate to shared processing logic
      await this.processReviewAnalyzed(typedPayload);
    } catch (error) {
      this.logger.error(`[RabbitMQ] Failed to process review analysis event:`, error);
      // Critical event: requeue for retry
      return new Nack(true);
    }
  }

  /**
   * Legacy EventEmitter2 handler for review analytics completion events
   * Delegates to shared processing logic
   */
  @OnEvent('review.analyzed')
  async handleReviewAnalyzedEventLegacy(payload: ReviewAnalyzedEvent): Promise<void> {
    try {
      this.logger.log(
        `[Legacy] Processing review analysis completion for review ${payload.reviewId}`,
      );
      await this.processReviewAnalyzed(payload);
    } catch (error) {
      this.logger.error(`[Legacy] Failed to process review analysis event:`, error);
    }
  }

  /**
   * Shared business logic for review analysis completion
   * Handles: Cache update, insights generation for notable reviews
   */
  private async processReviewAnalyzed(payload: ReviewAnalyzedEvent): Promise<void> {
    // Update cache with analysis results
    await this.cacheService.invalidateReviewCache(payload.reviewId);

    // Queue insights generation if sentiment is notable
    if (payload.sentiment === 'negative' && payload.qualityScore > 80) {
      await this.analyticsQueue.add('negative-quality-review-alert', {
        reviewId: payload.reviewId,
        sentiment: payload.sentiment,
        qualityScore: payload.qualityScore,
        keywords: payload.keywords,
      });
    }

    this.logger.log(`Successfully processed review analysis event for review ${payload.reviewId}`);
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private validateReviewCreatedPayload(payload: ReviewCreatedEvent): boolean {
    return (
      payload.review !== null &&
      payload.review !== undefined &&
      payload.establishmentId !== null &&
      payload.establishmentId !== undefined &&
      payload.reviewerId !== null &&
      payload.reviewerId !== undefined &&
      payload.review._id !== null &&
      payload.review._id !== undefined
    );
  }

  private validateReviewUpdatedPayload(payload: ReviewUpdatedEvent): boolean {
    return (
      payload.review !== null &&
      payload.review !== undefined &&
      payload.updatedFields !== null &&
      payload.updatedFields !== undefined &&
      payload.updatedFields.length > 0 &&
      payload.updatedBy !== null &&
      payload.updatedBy !== undefined
    );
  }

  private validateReviewDeletedPayload(payload: ReviewDeletedEvent): boolean {
    return !!(
      payload.reviewId &&
      payload.establishmentId &&
      payload.deletedBy &&
      payload.deletionReason
    );
  }

  private determineReprocessingNeeds(updatedFields: string[]): boolean {
    const reprocessingFields = ['comment', 'title', 'overallRating', 'detailedRatings'];
    return updatedFields.some(field => reprocessingFields.includes(field));
  }

  private determineRemoderationNeeds(updatedFields: string[]): boolean {
    const moderationFields = ['comment', 'title', 'images'];
    return updatedFields.some(field => moderationFields.includes(field));
  }

  private shouldNotifyUpdate(payload: ReviewUpdatedEvent): boolean {
    const notifyFields = ['status', 'overallRating'];
    return (
      payload.updatedFields.some(field => notifyFields.includes(field)) ||
      payload.metadata?.updateType === 'moderation'
    );
  }

  private isSignificantUpdate(updatedFields: string[]): boolean {
    const significantFields = ['overallRating', 'comment', 'status'];
    return updatedFields.some(field => significantFields.includes(field));
  }

  private shouldNotifyDeletion(payload: ReviewDeletedEvent): boolean {
    return !payload.softDelete || payload.deletionReason === 'violation';
  }

  private async handleSpecialReviewCases(payload: ReviewCreatedEvent): Promise<void> {
    try {
      // Handle first review milestone
      if (payload.isFirstReview === true) {
        await this.analyticsQueue.add('first-review-milestone', {
          establishmentId: payload.establishmentId,
          reviewerId: payload.reviewerId,
          rating: payload.review.overallRating,
        });
      }

      // Handle low rating alerts
      if (payload.review.overallRating <= 2) {
        await this.notificationQueue.add(
          'low-rating-alert',
          {
            establishmentId: payload.establishmentId,
            reviewId: payload.review._id.toString(),
            rating: payload.review.overallRating,
            urgent: true,
          },
          {
            priority: 1,
            delay: 0, // Immediate for low ratings
          },
        );
      }
    } catch (error) {
      this.logger.error('Failed to handle special review cases:', error);
    }
  }

  private async updateCacheIndexes(payload: ReviewCreatedEvent): Promise<void> {
    try {
      // Warm establishment cache if this is a recent review
      await this.analyticsQueue.add('warm-establishment-cache', {
        establishmentId: payload.establishmentId,
        reason: 'new_review',
      });
    } catch (error) {
      this.logger.error('Failed to update cache indexes:', error);
    }
  }

  private async handleCascadeCacheOperations(payload: ReviewDeletedEvent): Promise<void> {
    try {
      // Invalidate establishment reviews cache
      await this.cacheService.invalidateEstablishmentReviews(payload.establishmentId);

      // Invalidate user reviews cache
      await this.cacheService.invalidateUserReviews(payload.reviewerId);
    } catch (error) {
      this.logger.error('Failed to handle cascade cache operations:', error);
    }
  }

  private async handleSpecialDeletionCases(payload: ReviewDeletedEvent): Promise<void> {
    try {
      // Handle admin deletions
      if (payload.deletedBy !== payload.reviewerId) {
        await this.analyticsQueue.add('admin-review-deletion', {
          reviewId: payload.reviewId,
          deletedBy: payload.deletedBy,
          reason: payload.deletionReason,
        });
      }
    } catch (error) {
      this.logger.error('Failed to handle special deletion cases:', error);
    }
  }

  private async queueRetryJob(eventType: string, payload: unknown, error: unknown): Promise<void> {
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const payloadObj = payload as Record<string, unknown>;
      const retryCount =
        typeof payloadObj['_retryCount'] === 'number' ? payloadObj['_retryCount'] : 0;
      await this.reviewQueue.add(
        'event-retry',
        {
          eventType,
          payload,
          error: errorMessage,
          retryCount: retryCount + 1,
        },
        {
          delay: Math.min(Math.pow(2, retryCount) * 1000, 30000), // Exponential backoff, max 30s
          attempts: 3,
        },
      );
    } catch (retryError) {
      this.logger.error('Failed to queue retry job:', retryError);
    }
  }
}
