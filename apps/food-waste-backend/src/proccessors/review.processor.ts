import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bull';
import { Model, Types } from 'mongoose';

import {
  Establishment,
  EstablishmentDocument,
} from '../establishments/schemas/establishment.schema';
import {
  Review,
  ReviewDocument,
  ReviewStatus,
  SentimentType,
  ReviewSentimentAnalysis,
} from '../reviwes/schemas/reviwe.schema';
import { ReviewModerationService } from '../services/review-moderation.service';
import { User, UserDocument } from '../users/schemas/user.schema';

export interface ReviewJobData {
  reviewId: string;
  action: 'create' | 'update' | 'moderate' | 'analyze' | 'notify';
  metadata?: Record<string, unknown>;
}

@Injectable()
@Processor('review-processing')
export class ReviewProcessor {
  private readonly logger = new Logger(ReviewProcessor.name);

  constructor(
    @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(Establishment.name)
    private readonly establishmentModel: Model<EstablishmentDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly moderationService: ReviewModerationService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    void this.userModel;
  }

  @Process('process')
  async handleReview(job: Job<ReviewJobData>): Promise<void> {
    try {
      const { reviewId, action, metadata } = job.data;

      this.logger.log(`Processing review ${reviewId} with action: ${action}`);

      const review = await this.reviewModel
        .findById(reviewId)
        .populate('reviewerId', 'firstName lastName email')
        .populate('establishmentId', 'name ownerId')
        .exec();

      if (!review) {
        this.logger.error(`Review ${reviewId} not found`);
        throw new Error(`Review ${reviewId} not found`);
      }

      switch (action) {
        case 'create':
          await this.processNewReview(review);
          break;
        case 'update':
          await this.processUpdatedReview(review);
          break;
        case 'moderate':
          await this.processReviewModeration(review);
          break;
        case 'analyze':
          await this.processReviewAnalysis(review);
          break;
        case 'notify':
          this.processReviewNotifications(review, metadata);
          break;
        default:
          this.logger.warn(`Unknown action: ${action}`);
      }

      this.logger.log(`Successfully processed review ${reviewId}`);
    } catch (error) {
      this.logger.error(`Failed to process review job:`, error);
      throw error;
    }
  }

  private async processNewReview(review: ReviewDocument): Promise<void> {
    try {
      // 1. Perform content analysis and moderation
      const moderationResult = this.moderationService.moderateReview({
        content: review.comment,
        title: review.title,
        rating: review.overallRating,
      });

      // 2. Update review with moderation results
      if (moderationResult.status === 'REJECTED') {
        review.status = ReviewStatus.REJECTED;
        review.moderationInfo.isModerated = true;
        review.moderationInfo.moderationReason = 'Content violated community guidelines';
        review.moderationInfo.autoModerationFlags = ['inappropriate_content'];
      }

      // 3. Perform sentiment analysis
      const sentimentAnalysis = this.analyzeSentiment(review.comment);
      review.sentimentAnalysis = sentimentAnalysis;

      // 4. Extract and process keywords
      const keywords = this.extractKeywords(review.comment);
      review.sentimentAnalysis.keywords = keywords;

      // 5. Update establishment metrics
      await this.updateEstablishmentMetrics(review.establishmentId.toString());

      // 6. Save updated review
      await review.save();

      // 7. Send notifications
      this.sendNewReviewNotifications(review);

      // 8. Emit analytics events
      this.eventEmitter.emit('review.processed', {
        reviewId: review._id,
        sentiment: review.sentimentAnalysis?.sentiment,
        rating: review.overallRating,
        establishmentId: review.establishmentId,
      });
    } catch (error) {
      this.logger.error('Failed to process new review:', error);
      throw error;
    }
  }

  private async processUpdatedReview(review: ReviewDocument): Promise<void> {
    try {
      // Re-analyze sentiment if content changed
      const sentimentAnalysis = this.analyzeSentiment(review.comment);
      review.sentimentAnalysis = sentimentAnalysis;

      // Re-extract keywords
      const keywords = this.extractKeywords(review.comment);
      review.sentimentAnalysis.keywords = keywords;

      // Re-check moderation
      const moderationResult = this.moderationService.moderateReview({
        content: review.comment,
        title: review.title,
        rating: review.overallRating,
      });

      if (moderationResult.status === 'REJECTED') {
        review.status = ReviewStatus.PENDING;
        review.moderationInfo.manualModerationRequired = true;
      }

      await review.save();

      // Update establishment metrics
      await this.updateEstablishmentMetrics(review.establishmentId.toString());

      this.eventEmitter.emit('review.updated.processed', {
        reviewId: review._id,
        establishmentId: review.establishmentId,
      });
    } catch (error) {
      this.logger.error('Failed to process updated review:', error);
      throw error;
    }
  }

  private async processReviewModeration(review: ReviewDocument): Promise<void> {
    try {
      // Perform comprehensive moderation check
      const moderationResult = this.moderationService.moderateReview({
        content: review.comment,
        title: review.title,
        rating: review.overallRating,
        images: review.images,
      });

      // Update moderation status
      review.moderationInfo.isModerated = true;
      review.moderationInfo.moderatedAt = new Date();

      if (moderationResult.status === 'APPROVED') {
        review.status = ReviewStatus.APPROVED;
      } else if (moderationResult.status === 'REJECTED') {
        review.status = ReviewStatus.REJECTED;
        review.moderationInfo.moderationReason = moderationResult.reason;
      }

      await review.save();

      // Update establishment metrics after moderation
      await this.updateEstablishmentMetrics(review.establishmentId.toString());

      // Notify reviewer of moderation result
      this.sendModerationNotification(review, moderationResult.status);

      this.eventEmitter.emit('review.moderated', {
        reviewId: review._id,
        status: review.status,
        establishmentId: review.establishmentId,
      });
    } catch (error) {
      this.logger.error('Failed to process review moderation:', error);
      throw error;
    }
  }

  private async processReviewAnalysis(review: ReviewDocument): Promise<void> {
    try {
      // Deep sentiment analysis
      const sentimentAnalysis = this.analyzeSentiment(review.comment);
      review.sentimentAnalysis = sentimentAnalysis;

      // Keyword extraction and topic modeling
      const keywords = this.extractKeywords(review.comment);
      const topics = this.extractTopics(review.comment);

      review.sentimentAnalysis.keywords = keywords;

      // Quality score calculation
      const qualityScore = this.calculateReviewQuality(review);
      review.metadata ??= {};
      review.metadata.qualityScore = qualityScore;

      // Helpfulness prediction
      const helpfulnessScore = this.predictHelpfulness(review);
      review.metadata.predictedHelpfulness = helpfulnessScore;

      await review.save();

      this.eventEmitter.emit('review.analyzed', {
        reviewId: review._id,
        sentiment: sentimentAnalysis.sentiment,
        qualityScore,
        keywords,
        topics,
      });
    } catch (error) {
      this.logger.error('Failed to process review analysis:', error);
      throw error;
    }
  }

  private processReviewNotifications(
    review: ReviewDocument,
    metadata: Record<string, unknown> = {},
  ): void {
    try {
      const establishment = review.establishmentId as unknown as EstablishmentDocument;

      // Notify establishment owner
      if (establishment?.ownerId !== null && establishment?.ownerId !== undefined) {
        this.sendEstablishmentOwnerNotification(review, establishment);
      }
      this.sendFollowerNotifications(review);

      // Send response recommendations to establishment
      if (review.overallRating <= 3) {
        this.sendResponseRecommendations(review, establishment);
      }

      // Analytics notification for insights team
      if (metadata['includeAnalytics'] === true) {
        this.eventEmitter.emit('review.analytics_ready', {
          reviewId: review._id,
          establishmentId: review.establishmentId,
          sentiment: review.sentimentAnalysis?.sentiment,
          rating: review.overallRating,
        });
      }
    } catch (error) {
      this.logger.error('Failed to process review notifications:', error);
      throw error;
    }
  }

  private analyzeSentiment(comment: string): ReviewSentimentAnalysis {
    try {
      // Enhanced sentiment analysis logic
      const words = comment.toLowerCase().split(/\s+/);

      const positiveWords = [
        'excellent',
        'amazing',
        'wonderful',
        'fantastic',
        'perfect',
        'love',
        'awesome',
        'great',
        'good',
        'nice',
        'delicious',
        'fresh',
        'quality',
        'recommend',
        'friendly',
        'quick',
        'clean',
        'value',
        'satisfied',
        'impressed',
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
        'poor',
        'slow',
        'dirty',
        'expensive',
        'rude',
        'cold',
        'stale',
        'overpriced',
        'waste',
        'never',
        'avoid',
        'regret',
      ];

      const positiveCount = words.filter((word) => positiveWords.includes(word)).length;
      const negativeCount = words.filter((word) => negativeWords.includes(word)).length;
      const totalWords = words.length;

      let sentiment = SentimentType.NEUTRAL;
      let confidence = 0.5;

      if (positiveCount > negativeCount && positiveCount > 0) {
        sentiment = SentimentType.POSITIVE;
        confidence = Math.min(0.95, 0.6 + (positiveCount / totalWords) * 2);
      } else if (negativeCount > positiveCount && negativeCount > 0) {
        sentiment = SentimentType.NEGATIVE;
        confidence = Math.min(0.95, 0.6 + (negativeCount / totalWords) * 2);
      } else if (positiveCount > 0 && negativeCount > 0) {
        sentiment = SentimentType.MIXED;
        confidence = Math.min(0.85, 0.7 + Math.abs(positiveCount - negativeCount) / totalWords);
      }

      return {
        sentiment,
        confidence,
        positiveScore: positiveCount / totalWords,
        negativeScore: negativeCount / totalWords,
        neutralScore: 1 - (positiveCount + negativeCount) / totalWords,
        keywords: [...positiveWords, ...negativeWords].filter((word) => words.includes(word)),
        language: 'en',
      };
    } catch (error) {
      this.logger.error('Failed to analyze sentiment:', error);
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

  private extractKeywords(comment: string): string[] {
    try {
      const words = comment
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 3);

      const stopWords = [
        'this',
        'that',
        'with',
        'have',
        'will',
        'from',
        'they',
        'been',
        'were',
        'said',
      ];
      const keywords = words.filter((word) => !stopWords.includes(word));

      // Return top 10 most relevant keywords
      const keywordCounts: Record<string, number> = keywords.reduce(
        (acc, word) => {
          acc[word] = (acc[word] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      return Object.entries(keywordCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([word]) => word);
    } catch (error) {
      this.logger.error('Failed to extract keywords:', error);
      return [];
    }
  }

  private extractTopics(comment: string): string[] {
    const foodTopics = ['food', 'meal', 'dish', 'flavor', 'taste', 'fresh', 'quality'];
    const serviceTopics = ['service', 'staff', 'waiter', 'friendly', 'quick', 'slow'];
    const valueTopics = ['price', 'value', 'money', 'expensive', 'cheap', 'worth'];
    const ambienceTopics = ['atmosphere', 'clean', 'dirty', 'noise', 'space', 'location'];

    const words = comment.toLowerCase().split(/\s+/);
    const topics = [];

    if (words.some((word) => foodTopics.includes(word))) {
      topics.push('food_quality');
    }
    if (words.some((word) => serviceTopics.includes(word))) {
      topics.push('service');
    }
    if (words.some((word) => valueTopics.includes(word))) {
      topics.push('value');
    }
    if (words.some((word) => ambienceTopics.includes(word))) {
      topics.push('ambience');
    }

    return topics;
  }

  private calculateReviewQuality(review: ReviewDocument): number {
    let score = 0;

    // Length factor (optimal length 50-500 characters)
    const length = review.comment.length;
    if (length >= 50 && length <= 500) {
      score += 20;
    } else if (length > 20) {
      score += 10;
    }

    // Detail factor (if detailed ratings provided)
    if (review.detailedRatings) {
      const detailCount = Object.keys(review.detailedRatings).length;
      score += detailCount * 5;
    }

    // Verification factor
    if (review.isVerifiedPurchase) {
      score += 15;
    }

    // Image factor
    if ((review.images?.length ?? 0) > 0) {
      score += 10;
    }

    // Sentiment confidence factor
    if (review.sentimentAnalysis) {
      score += review.sentimentAnalysis.confidence * 20;
    }

    // Helpfulness factor
    const helpfulnessRatio =
      review.metrics.helpfulCount /
      (review.metrics.helpfulCount + review.metrics.notHelpfulCount + 1);
    score += helpfulnessRatio * 15;

    return Math.min(100, Math.max(0, score));
  }

  private predictHelpfulness(review: ReviewDocument): number {
    let score = 0;

    // Quality score contribution
    const qualityScore = review.metadata?.qualityScore ?? 0;
    score += qualityScore * 0.3;

    // Length factor
    const optimalLength = review.comment.length >= 50 && review.comment.length <= 300;
    if (optimalLength) {
      score += 20;
    }

    // Detail factor
    if (review.detailedRatings) {
      score += 15;
    }

    // Verification factor
    if (review.isVerifiedPurchase) {
      score += 20;
    }

    // Rating extremes tend to be less helpful
    if (review.overallRating === 3) {
      score += 10;
    } // Balanced reviews
    else if (review.overallRating === 1 || review.overallRating === 5) {
      score -= 5;
    }

    return Math.min(100, Math.max(0, score));
  }

  private async updateEstablishmentMetrics(establishmentId: string): Promise<void> {
    try {
      const stats = await this.reviewModel.aggregate<{
        _id: null;
        averageRating: number;
        totalReviews: number;
        totalHelpfulVotes: number;
        sentimentBreakdown: string[];
      }>([
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
            totalHelpfulVotes: { $sum: '$metrics.helpfulCount' },
            sentimentBreakdown: { $push: '$sentimentAnalysis.sentiment' },
          },
        },
      ]);

      const statsEntry = stats[0];
      if (statsEntry) {
        const { averageRating, totalReviews, totalHelpfulVotes } = statsEntry;

        await this.establishmentModel.findByIdAndUpdate(establishmentId, {
          averageRating: Math.round(averageRating * 100) / 100,
          totalReviews,
          totalHelpfulVotes,
          lastReviewAt: new Date(),
        });
      }
    } catch (error) {
      this.logger.error(`Failed to update establishment metrics:`, error);
    }
  }

  private sendNewReviewNotifications(review: ReviewDocument): void {
    const establishment = review.establishmentId as unknown as EstablishmentDocument;
    const reviewer = review.reviewerId as unknown as UserDocument;

    this.eventEmitter.emit('notification.new_review', {
      type: 'new_review',
      recipientId: establishment.ownerId,
      reviewId: review._id,
      reviewerName: `${reviewer.firstName} ${reviewer.lastName}`,
      establishmentName: establishment.name,
      rating: review.overallRating,
      comment: `${review.comment.substring(0, 100)}...`,
    });
  }

  private sendModerationNotification(review: ReviewDocument, status: string): void {
    const reviewer = review.reviewerId as unknown as UserDocument;

    this.eventEmitter.emit('notification.review_moderated', {
      type: 'review_moderated',
      recipientId: reviewer._id,
      reviewId: review._id,
      status,
      reason: review.moderationInfo.moderationReason,
    });
  }

  private sendEstablishmentOwnerNotification(
    review: ReviewDocument,
    establishment: EstablishmentDocument,
  ): void {
    this.eventEmitter.emit('notification.establishment_review', {
      type: 'establishment_review',
      recipientId: establishment.ownerId,
      reviewId: review._id,
      establishmentId: establishment._id,
      establishmentName: establishment.name,
      rating: review.overallRating,
      sentiment: review.sentimentAnalysis?.sentiment,
    });
  }

  private sendFollowerNotifications(review: ReviewDocument): void {
    // Implementation would depend on follower system
    this.eventEmitter.emit('notification.follower_review', {
      type: 'follower_review',
      reviewId: review._id,
      reviewerId: review.reviewerId,
      establishmentId: review.establishmentId,
    });
  }

  private sendResponseRecommendations(
    review: ReviewDocument,
    establishment: EstablishmentDocument,
  ): void {
    if (review.overallRating <= 2) {
      this.eventEmitter.emit('recommendation.urgent_response', {
        type: 'urgent_response_needed',
        recipientId: establishment.ownerId,
        reviewId: review._id,
        rating: review.overallRating,
        sentiment: review.sentimentAnalysis?.sentiment,
      });
    }
  }
}
