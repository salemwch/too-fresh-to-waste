import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

import { ReviewCacheService } from '../services/review-cache.service';
import { ReviewDocument } from '../reviwes/schemas/reviwe.schema';

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

@Injectable()
export class ReviewEventListener {
    private readonly logger = new Logger(ReviewEventListener.name);

    constructor(
        private readonly cacheService: ReviewCacheService,
        @InjectQueue('review-processing') private readonly reviewQueue: Queue,
        @InjectQueue('notification-processing') private readonly notificationQueue: Queue,
        @InjectQueue('review-analytics') private readonly analyticsQueue: Queue,
    ) {}

    /**
     * Handle review creation events
     * Triggers: Cache storage, background processing, notifications, analytics
     */
    @OnEvent('review.created')
    async handleReviewCreatedEvent(payload: ReviewCreatedEvent): Promise<void> {
        const startTime = Date.now();

        try {
            this.logger.log(`Processing review created event for review ${payload.review._id}`);

            // 1. Validate payload
            if (!this.validateReviewCreatedPayload(payload)) {
                this.logger.error('Invalid review created event payload', payload);
                return;
            }

            // 2. Cache the new review with extended TTL (new reviews get more traffic)
            await this.cacheService.cacheReview(payload.review, 7200); // 2 hours
            this.logger.debug(`Cached new review ${payload.review._id}`);

            // 3. Queue background processing jobs in parallel for performance
            const processingJobs = [
                // Content analysis and sentiment processing
                this.reviewQueue.add('process', {
                    reviewId: payload.review._id.toString(),
                    action: 'create',
                    metadata: {
                        priority: 'high',
                        source: payload.metadata?.source || 'unknown'
                    }
                }, {
                    priority: payload.isFirstReview ? 1 : 5, // First reviews get higher priority
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 2000 }
                }),

                // Analytics and metrics processing
                this.analyticsQueue.add('review-created', {
                    reviewId: payload.review._id.toString(),
                    establishmentId: payload.establishmentId,
                    reviewerId: payload.reviewerId,
                    rating: payload.review.overallRating,
                    isFirstReview: payload.isFirstReview,
                    source: payload.metadata?.source,
                    timestamp: payload.metadata?.timestamp || new Date()
                }, {
                    attempts: 2,
                    delay: 1000 // Slight delay for analytics
                })
            ];

            // 4. Queue notification jobs
            const notificationJobs = [
                // Notify establishment owner
                this.notificationQueue.add('establishment-review-notification', {
                    type: 'new_review',
                    establishmentId: payload.establishmentId,
                    reviewId: payload.review._id.toString(),
                    reviewerName: `${payload.review.reviewerId}`, // Would need to populate user data
                    rating: payload.review.overallRating,
                    comment: payload.review.comment.substring(0, 100),
                    isFirstReview: payload.isFirstReview
                }, {
                    delay: payload.review.overallRating <= 2 ? 0 : 5000, // Immediate for bad reviews
                    attempts: 3
                }),

                // Thank you message to reviewer (if first review)
                ...(payload.isFirstReview ? [{
                    queue: this.notificationQueue.add('reviewer-welcome', {
                        type: 'first_review_thanks',
                        reviewerId: payload.reviewerId,
                        reviewId: payload.review._id.toString(),
                        establishmentName: payload.establishmentId // Would need establishment name
                    }, {
                        delay: 10000, // 10 seconds delay
                        attempts: 2
                    })
                }] : [])
            ];

            // 5. Execute all jobs concurrently for optimal performance
            await Promise.allSettled([
                ...processingJobs,
                ...notificationJobs
            ]);

            // 6. Handle special cases
            await this.handleSpecialReviewCases(payload);

            // 7. Update cache indexes and warm related data
            await this.updateCacheIndexes(payload);

            const processingTime = Date.now() - startTime;
            this.logger.log(`Successfully processed review created event in ${processingTime}ms for review ${payload.review._id}`);

        } catch (error) {
            this.logger.error(`Failed to process review created event for review ${payload.review._id}:`, error);

            // Queue retry job with exponential backoff
            await this.queueRetryJob('review.created.retry', payload, error);
        }
    }

    /**
     * Handle review update events
     * Triggers: Cache invalidation/update, re-processing, update notifications
     */
    @OnEvent('review.updated')
    async handleReviewUpdatedEvent(payload: ReviewUpdatedEvent): Promise<void> {
        const startTime = Date.now();

        try {
            this.logger.log(`Processing review updated event for review ${payload.review._id}`);

            // 1. Validate payload
            if (!this.validateReviewUpdatedPayload(payload)) {
                this.logger.error('Invalid review updated event payload', payload);
                return;
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
                    this.reviewQueue.add('process', {
                        reviewId: payload.review._id.toString(),
                        action: 'update',
                        metadata: {
                            updatedFields: payload.updatedFields,
                            updateType: payload.metadata?.updateType
                        }
                    }, {
                        priority: needsRemoderation ? 2 : 7, // Higher priority for moderation
                        attempts: 3
                    })
                );
            }

            // 5. Queue notifications based on update type
            if (this.shouldNotifyUpdate(payload)) {
                processingJobs.push(
                    this.notificationQueue.add('review-updated-notification', {
                        type: 'review_updated',
                        reviewId: payload.review._id.toString(),
                        establishmentId: payload.review.establishmentId.toString(),
                        updateType: payload.metadata?.updateType,
                        updatedFields: payload.updatedFields,
                        updatedBy: payload.updatedBy
                    }, {
                        delay: 2000,
                        attempts: 2
                    })
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
                        timestamp: payload.metadata?.timestamp || new Date()
                    })
                );
            }

            // 7. Execute all processing jobs
            await Promise.allSettled(processingJobs);

            // 8. Handle establishment-level cache invalidation if rating changed
            if (payload.updatedFields.includes('overallRating')) {
                await this.cacheService.invalidateEstablishmentReviews(
                    payload.review.establishmentId.toString()
                );
                this.logger.debug(`Invalidated establishment cache due to rating change`);
            }

            const processingTime = Date.now() - startTime;
            this.logger.log(`Successfully processed review updated event in ${processingTime}ms for review ${payload.review._id}`);

        } catch (error) {
            this.logger.error(`Failed to process review updated event for review ${payload.review._id}:`, error);
            await this.queueRetryJob('review.updated.retry', payload, error);
        }
    }

    /**
     * Handle review deletion events
     * Triggers: Cache cleanup, cascade operations, deletion notifications, analytics
     */
    @OnEvent('review.deleted')
    async handleReviewDeletedEvent(payload: ReviewDeletedEvent): Promise<void> {
        const startTime = Date.now();

        try {
            this.logger.log(`Processing review deleted event for review ${payload.reviewId}`);

            // 1. Validate payload
            if (!this.validateReviewDeletedPayload(payload)) {
                this.logger.error('Invalid review deleted event payload', payload);
                return;
            }

            // 2. Immediate cache cleanup
            await this.cacheService.invalidateReviewCache(payload.reviewId);
            this.logger.debug(`Removed review ${payload.reviewId} from cache`);

            // 3. Handle cascade cache invalidation
            await this.handleCascadeCacheOperations(payload);

            // 4. Queue processing jobs for deletion handling
            const processingJobs = [
                // Analytics tracking for deletion
                this.analyticsQueue.add('review-deleted', {
                    reviewId: payload.reviewId,
                    establishmentId: payload.establishmentId,
                    reviewerId: payload.reviewerId,
                    deletedBy: payload.deletedBy,
                    deletionReason: payload.deletionReason,
                    softDelete: payload.softDelete,
                    originalRating: payload.metadata?.originalData?.overallRating,
                    timestamp: payload.metadata?.timestamp || new Date()
                }, {
                    attempts: 2
                }),

                // Update establishment metrics (remove deleted review impact)
                this.reviewQueue.add('process', {
                    reviewId: payload.reviewId,
                    action: 'delete_cleanup',
                    metadata: {
                        establishmentId: payload.establishmentId,
                        softDelete: payload.softDelete,
                        originalData: payload.metadata?.originalData
                    }
                }, {
                    priority: 6,
                    attempts: 3
                })
            ];

            // 5. Notification jobs based on deletion type
            if (this.shouldNotifyDeletion(payload)) {
                processingJobs.push(
                    this.notificationQueue.add('review-deleted-notification', {
                        type: 'review_deleted',
                        reviewId: payload.reviewId,
                        establishmentId: payload.establishmentId,
                        reviewerId: payload.reviewerId,
                        deletedBy: payload.deletedBy,
                        deletionReason: payload.deletionReason,
                        wasPublic: !payload.softDelete
                    }, {
                        delay: 1000,
                        attempts: 2
                    })
                );
            }

            // 6. Execute all processing jobs
            await Promise.allSettled(processingJobs);

            // 7. Handle special deletion scenarios
            await this.handleSpecialDeletionCases(payload);

            const processingTime = Date.now() - startTime;
            this.logger.log(`Successfully processed review deleted event in ${processingTime}ms for review ${payload.reviewId}`);

        } catch (error) {
            this.logger.error(`Failed to process review deleted event for review ${payload.reviewId}:`, error);
            await this.queueRetryJob('review.deleted.retry', payload, error);
        }
    }

    // Additional event handlers for comprehensive review lifecycle

    /**
     * Handle review moderation completion events
     */
    @OnEvent('review.moderated')
    async handleReviewModeratedEvent(payload: any): Promise<void> {
        try {
            this.logger.log(`Processing review moderation event for review ${payload.reviewId}`);

            // Update cache with moderated status
            await this.cacheService.invalidateReviewCache(payload.reviewId);

            // Notify relevant parties
            await this.notificationQueue.add('moderation-completed', {
                reviewId: payload.reviewId,
                status: payload.status,
                reason: payload.reason
            });

        } catch (error) {
            this.logger.error(`Failed to process review moderation event:`, error);
        }
    }

    /**
     * Handle review analytics completion events
     */
    @OnEvent('review.analyzed')
    async handleReviewAnalyzedEvent(payload: any): Promise<void> {
        try {
            this.logger.log(`Processing review analysis completion for review ${payload.reviewId}`);

            // Update cache with analysis results
            await this.cacheService.invalidateReviewCache(payload.reviewId);

            // Queue insights generation if sentiment is notable
            if (payload.sentiment === 'negative' && payload.qualityScore > 80) {
                await this.analyticsQueue.add('negative-quality-review-alert', {
                    reviewId: payload.reviewId,
                    sentiment: payload.sentiment,
                    qualityScore: payload.qualityScore,
                    keywords: payload.keywords
                });
            }

        } catch (error) {
            this.logger.error(`Failed to process review analysis event:`, error);
        }
    }

    // Private helper methods

    private validateReviewCreatedPayload(payload: ReviewCreatedEvent): boolean {
        return !!(payload.review &&
                  payload.establishmentId &&
                  payload.reviewerId &&
                  payload.review._id);
    }

    private validateReviewUpdatedPayload(payload: ReviewUpdatedEvent): boolean {
        return !!(payload.review &&
                  payload.updatedFields &&
                  payload.updatedFields.length > 0 &&
                  payload.updatedBy);
    }

    private validateReviewDeletedPayload(payload: ReviewDeletedEvent): boolean {
        return !!(payload.reviewId &&
                  payload.establishmentId &&
                  payload.deletedBy &&
                  payload.deletionReason);
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
        return payload.updatedFields.some(field => notifyFields.includes(field)) ||
               payload.metadata?.updateType === 'moderation';
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
            if (payload.isFirstReview) {
                await this.analyticsQueue.add('first-review-milestone', {
                    establishmentId: payload.establishmentId,
                    reviewerId: payload.reviewerId,
                    rating: payload.review.overallRating
                });
            }

            // Handle low rating alerts
            if (payload.review.overallRating <= 2) {
                await this.notificationQueue.add('low-rating-alert', {
                    establishmentId: payload.establishmentId,
                    reviewId: payload.review._id.toString(),
                    rating: payload.review.overallRating,
                    urgent: true
                }, {
                    priority: 1,
                    delay: 0 // Immediate for low ratings
                });
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
                reason: 'new_review'
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
                    reason: payload.deletionReason
                });
            }

        } catch (error) {
            this.logger.error('Failed to handle special deletion cases:', error);
        }
    }

    private async queueRetryJob(eventType: string, payload: any, error: any): Promise<void> {
        try {
            await this.reviewQueue.add('event-retry', {
                eventType,
                payload,
                error: error.message,
                retryCount: (payload._retryCount || 0) + 1
            }, {
                delay: Math.min(Math.pow(2, payload._retryCount || 0) * 1000, 30000), // Exponential backoff, max 30s
                attempts: 3
            });

        } catch (retryError) {
            this.logger.error('Failed to queue retry job:', retryError);
        }
    }
}