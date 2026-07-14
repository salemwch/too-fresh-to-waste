import { BullModule } from '@nestjs/bull';
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

// Note: ScheduleModule.forRoot() and EventEmitterModule.forRoot() are already called in AppModule

import { OrdersModule } from 'src/orders/order.module';

import { CommonModule } from '../common/common.module';
import { GlobalExceptionFilter } from '../common/filters/http-exception.filter';
import { ProSubscriptionGuard } from '../common/guards/pro-subscription.guard';
import { LoggingInterceptor } from '../common/interceptors/loggin.interceptor';
import { RateLimitGuard } from '../common/validators/RateLimitGuard';
import { EmailModule } from '../email/email.module';
import { EstablishmentsModule } from '../establishments/establishments.module';
import { Establishment, EstablishmentSchema } from '../establishments/schemas/establishment.schema';
import { ReviewEventListener } from '../listeners/review-event.listener';
import { AdminUserEventsListener } from './listeners/admin-user-events.listener';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { OffersModule } from '../offers/offers.module';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { ReviewAnalyticsProcessor } from '../processors/review-analytics.processor';
import { ReviewModerationProcessor } from '../processors/review-moderation.processor';
import { ReviewProcessor } from '../processors/review.processor';
import { ReviewCacheService } from '../services/review-cache.service';
import { ReviewModerationService } from '../services/review-moderation.service';
import { User, UserSchema } from '../users/schemas/user.schema';

import { ReviewAnalyticsService } from './review-analytics.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { Review, ReviewSchema } from './schemas/review.schema';

@Module({
  imports: [
    CommonModule,
    ConfigModule,
    // ScheduleModule and EventEmitterModule are initialized in AppModule
    MongooseModule.forFeature([
      { name: Review.name, schema: ReviewSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Establishment.name, schema: EstablishmentSchema },
      { name: User.name, schema: UserSchema },
      { name: Offer.name, schema: OfferSchema },
    ]),
    // Background job queues
    BullModule.registerQueue(
      {
        name: 'review-processing',
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      },
      {
        name: 'review-analytics',
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 25,
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      },
      {
        name: 'review-moderation',
        defaultJobOptions: {
          removeOnComplete: 200,
          removeOnFail: 100,
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 3000,
          },
        },
      },
      {
        name: 'notification-processing',
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 25,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      },
    ),
    forwardRef(() => EstablishmentsModule),
    forwardRef(() => OrdersModule),
    forwardRef(() => OffersModule),
    forwardRef(() => EmailModule),
    forwardRef(() => LoyaltyModule),
  ],
  controllers: [ReviewsController],
  providers: [
    ReviewsService,
    ReviewAnalyticsService,
    ReviewModerationService,
    ReviewCacheService,
    ReviewProcessor,
    ReviewAnalyticsProcessor,
    ReviewModerationProcessor,
    ReviewEventListener,
    AdminUserEventsListener,
    // Guards and interceptors
    ProSubscriptionGuard,
    RateLimitGuard,
    GlobalExceptionFilter,
    LoggingInterceptor,
    // Custom providers for advanced features
    {
      provide: 'REVIEW_CONFIG',
      useFactory: () => ({
        maxImagesPerReview: 10,
        maxImageSize: 10 * 1024 * 1024, // 10MB
        allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
        autoModerationEnabled: true,
        sentimentAnalysisEnabled: true,
        maxReviewsPerDay: 10,
        maxResponsesPerReview: 3,
        reviewEditTimeLimit: 30 * 24 * 60 * 60 * 1000, // 30 days
        minimumReviewLength: 10,
        maximumReviewLength: 2000,
      }),
    },
    {
      provide: 'AI_SENTIMENT_SERVICE',
      useFactory: () =>
        // This would be replaced with actual AI service integration
        ({
          analyzeSentiment: (text: string) => {
            // Mock implementation - replace with actual AI service
            const words = text.toLowerCase().split(' ');
            const positiveWords = ['great', 'excellent', 'amazing', 'wonderful', 'fantastic'];
            const negativeWords = ['terrible', 'awful', 'bad', 'horrible', 'disgusting'];

            const positiveCount = words.filter(word => positiveWords.includes(word)).length;
            const negativeCount = words.filter(word => negativeWords.includes(word)).length;

            let sentiment: string;
            if (positiveCount > negativeCount) {
              sentiment = 'positive';
            } else if (negativeCount > positiveCount) {
              sentiment = 'negative';
            } else {
              sentiment = 'neutral';
            }

            return {
              sentiment,
              confidence: Math.random() * 0.4 + 0.6, // Mock confidence 0.6-1.0
              scores: {
                positive: positiveCount / words.length,
                negative: negativeCount / words.length,
                neutral: 1 - (positiveCount + negativeCount) / words.length,
              },
            };
          },
        }),
    },
    {
      provide: 'CONTENT_MODERATION_SERVICE',
      useFactory: () => ({
        moderateContent: (content: string) => {
          // This would integrate with content moderation APIs
          // like AWS Rekognition, Google Cloud Vision, etc.
          const inappropriatePatterns = [
            /\b(spam|fake|advertisement)\b/gi,
            /https?:\/\/[^\s]+/gi, // URLs
            /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // Phone numbers
          ];

          const flags: string[] = [];
          inappropriatePatterns.forEach((pattern, index) => {
            if (pattern.test(content)) {
              flags.push(`inappropriate_content_${index}`);
            }
          });

          return {
            isAppropriate: flags.length === 0,
            flags,
            confidence: Math.random() * 0.3 + 0.7, // Mock confidence
          };
        },
      }),
    },
  ],

  exports: [
    ReviewsService,
    ReviewAnalyticsService,
    ReviewModerationService,
    ReviewCacheService,
    MongooseModule,
  ],
})
export class ReviewsModule {}
