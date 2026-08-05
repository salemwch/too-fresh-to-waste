import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Transform } from 'class-transformer';
import { Document, Model, Types, Query } from 'mongoose';

import { applySoftDeleteFilter } from '../../common/utils/soft-delete-aggregate.util';

// Interface for review metadata
export interface IReviewMetadata {
  // Processing metadata
  processingInfo?: {
    ipAddress?: string;
    userAgent?: string;
    deviceFingerprint?: string;
    sessionId?: string;
    source?: 'web' | 'mobile' | 'api';
    version?: string;
  };

  // Analytics metadata
  analytics?: {
    readTime?: number;
    scrollDepth?: number;
    clickedElements?: string[];
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  };

  // AI processing metadata
  aiProcessing?: {
    languageDetected?: string;
    confidence?: number;
    toxicityScore?: number;
    spamScore?: number;
    emotionScores?: Record<string, number>;
    topicsDetected?: string[];
    processingVersion?: string;
    modelVersion?: string;
  };

  // Review context metadata
  context?: {
    orderValue?: number;
    previousReviews?: number;
    accountAge?: number;
    verificationLevel?: string;
    loyaltyTier?: string;
    reviewIncentive?: boolean;
  };

  // Quality metadata
  quality?: {
    lengthScore?: number;
    readabilityScore?: number;
    originalityScore?: number;
    helpfulnessScore?: number;
    detailScore?: number;
  };

  // Legacy fields for backwards compatibility
  qualityScore?: number;
  predictedHelpfulness?: number;

  // Moderation metadata
  moderation?: {
    autoFlags?: string[];
    riskScore?: number;
    requiresHumanReview?: boolean;
    similarReviews?: string[];
    duplicateScore?: number;
  };

  // Technical metadata
  technical?: {
    imageProcessingResults?: Array<{
      filename: string;
      analysis?: string;
      tags?: string[];
      confidence?: number;
    }>;
    locationVerification?: {
      verified: boolean;
      accuracy?: number;
      source?: string;
    };
    deviceInfo?: {
      type: string;
      os?: string;
      browser?: string;
    };
  };

  // Custom fields for business logic
  custom?: Record<string, string | number | boolean | Date>;
}

export type ReviewDocument = Review & Document;

export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FLAGGED = 'flagged',
  SPAM = 'spam',
  HIDDEN = 'hidden',
}

export enum ReviewType {
  ORDER = 'order',
  ESTABLISHMENT = 'establishment',
  OFFER = 'offer',
}

export enum SentimentType {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  NEUTRAL = 'neutral',
  MIXED = 'mixed',
}

export enum ReviewRating {
  ONE = 1,
  TWO = 2,
  THREE = 3,
  FOUR = 4,
  FIVE = 5,
}

const REVIEW_RATING_LABELS = ['unknown', 'one', 'two', 'three', 'four', 'five'] as const;

export interface ReviewMetrics {
  helpfulCount: number;
  notHelpfulCount: number;
  reportCount: number;
  viewCount: number;
  shareCount: number;
}

export interface ReviewModerationInfo {
  isModerated: boolean;
  moderatedBy?: Types.ObjectId | undefined;
  moderatedAt?: Date | undefined;
  moderationReason?: string | undefined;
  autoModerationFlags?: string[] | undefined;
  manualModerationRequired?: boolean | undefined;
}

export interface ReviewSentimentAnalysis {
  sentiment: SentimentType;
  confidence: number;
  positiveScore: number;
  negativeScore: number;
  neutralScore: number;
  keywords: string[];
  language?: string | undefined;
}

export interface ReviewResponse {
  responseText: string;
  respondedBy: Types.ObjectId;
  respondedAt: Date;
  isOwnerResponse: boolean;
  lastEditedAt?: Date;
}

export interface ReviewImages {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  isVerified?: boolean;
}

@Schema({ timestamps: true, collection: 'reviews' })
export class Review {
  @Transform(({ value }: { value: Types.ObjectId }) => value.toString())
  _id!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  reviewerId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Establishment' })
  establishmentId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  orderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Offer' })
  offerId?: Types.ObjectId;

  @Prop({
    required: true,
    type: String,
    enum: ReviewType,
    default: ReviewType.ESTABLISHMENT,
  })
  type!: ReviewType;
  @Prop({
    required: true,
    type: Number,
    min: 1,
    max: 5,
    enum: ReviewRating,
  })
  overallRating!: number;

  @Prop({
    type: {
      foodQuality: { type: Number, min: 1, max: 5 },
      serviceQuality: { type: Number, min: 1, max: 5 },
      valueForMoney: { type: Number, min: 1, max: 5 },
      packaging: { type: Number, min: 1, max: 5 },
      pickupExperience: { type: Number, min: 1, max: 5 },
      sustainability: { type: Number, min: 1, max: 5 },
    },
  })
  detailedRatings?: {
    foodQuality?: number;
    serviceQuality?: number;
    valueForMoney?: number;
    packaging?: number;
    pickupExperience?: number;
    sustainability?: number;
  };

  @Prop({
    required: true,
    type: String,
    minlength: 10,
    maxlength: 2000,
    trim: true,
  })
  comment!: string;

  @Prop({ type: String, minlength: 3, maxlength: 100, trim: true })
  title?: string;

  @Prop({
    type: [
      {
        url: { type: String, required: true },
        filename: { type: String, required: true },
        size: { type: Number, required: true },
        mimeType: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
        isVerified: { type: Boolean, default: false },
      },
    ],
    default: [],
  })
  @Prop({ type: [String], default: [] })
  images!: ReviewImages[];
  @Prop({
    type: String,
    enum: ReviewStatus,
    default: ReviewStatus.PENDING,
  })
  status!: ReviewStatus;
  @Prop({
    type: {
      isModerated: { type: Boolean, default: false },
      moderatedBy: { type: Types.ObjectId, ref: 'User' },
      moderatedAt: Date,
      moderationReason: String,
      autoModerationFlags: [String],
      manualModerationRequired: { type: Boolean, default: false },
    },
    default: () => ({ isModerated: false }),
  })
  moderationInfo!: ReviewModerationInfo;

  @Prop({
    type: {
      helpfulCount: { type: Number, default: 0, min: 0 },
      notHelpfulCount: { type: Number, default: 0, min: 0 },
      reportCount: { type: Number, default: 0, min: 0 },
      viewCount: { type: Number, default: 0, min: 0 },
      shareCount: { type: Number, default: 0, min: 0 },
    },
    default: () => ({
      helpfulCount: 0,
      notHelpfulCount: 0,
      reportCount: 0,
      viewCount: 0,
      shareCount: 0,
    }),
  })
  metrics!: ReviewMetrics;

  // AI Analysis
  @Prop({
    type: {
      sentiment: { type: String, enum: SentimentType },
      confidence: { type: Number, min: 0, max: 1 },
      positiveScore: { type: Number, min: 0, max: 1 },
      negativeScore: { type: Number, min: 0, max: 1 },
      neutralScore: { type: Number, min: 0, max: 1 },
      keywords: [String],
      language: String,
    },
  })
  sentimentAnalysis?: ReviewSentimentAnalysis;

  @Prop({
    type: [
      {
        responseText: { type: String, required: true, maxlength: 1000 },
        respondedBy: { type: Types.ObjectId, ref: 'User', required: true },
        respondedAt: { type: Date, default: Date.now },
        isOwnerResponse: { type: Boolean, required: true },
        lastEditedAt: Date,
      },
    ],
    default: [],
  })
  responses!: ReviewResponse[];

  // User Interactions
  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  helpfulVoters!: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  notHelpfulVoters!: Types.ObjectId[];

  @Prop({
    type: [
      {
        reportedBy: { type: Types.ObjectId, ref: 'User', required: true },
        reason: { type: String, required: true },
        additionalDetails: { type: String, maxlength: 500 },
        reportedAt: { type: Date, default: Date.now },
        isResolved: { type: Boolean, default: false },
        resolvedBy: { type: Types.ObjectId, ref: 'User' },
        resolvedAt: Date,
        resolutionNote: String,
      },
    ],
    default: [],
  })
  reports!: Array<{
    reportedBy: Types.ObjectId;
    additionalDetails?: string | undefined;
    reason: string;
    reportedAt: Date;
    isResolved: boolean;
    resolvedBy?: Types.ObjectId | undefined;
    resolvedAt?: Date | undefined;
    resolutionNote?: string | undefined;
  }>;

  // Verification and Trust
  @Prop({ default: false })
  isVerifiedPurchase!: boolean;

  @Prop({ default: false })
  isRecommended!: boolean;

  @Prop({ default: false })
  isEdited!: boolean;

  @Prop()
  lastEditedAt?: Date;

  // Metadata
  @Prop({ type: String, lowercase: true })
  reviewerLocation?: string;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: Object })
  metadata?: IReviewMetadata;

  // Soft Delete
  @Prop({ default: false })
  isDeleted!: boolean;

  @Prop()
  deletedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  deletedBy?: Types.ObjectId;

  @Prop()
  deletionReason?: string;

  // createdAt and updatedAt are managed by Mongoose `timestamps: true`
  createdAt?: Date;
  updatedAt?: Date;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

// Indexes — 7 targeted (trimmed from 13)
ReviewSchema.index({ establishmentId: 1, status: 1, createdAt: -1 });
ReviewSchema.index({ reviewerId: 1, createdAt: -1 });
ReviewSchema.index({ orderId: 1 }, { sparse: true });
ReviewSchema.index({ offerId: 1 }, { sparse: true });
ReviewSchema.index({ status: 1, 'moderationInfo.manualModerationRequired': 1 });
ReviewSchema.index({ comment: 'text', title: 'text', 'sentimentAnalysis.keywords': 'text' });
// Covers type+establishment, rating+status, and sorted listing in one compound
ReviewSchema.index({ establishmentId: 1, type: 1, status: 1, overallRating: 1, createdAt: -1 });
ReviewSchema.index({ isDeleted: 1, deletedAt: 1 }, { sparse: true });
// Moderation queue sorted by arrival time (no manual-review-required filter)
ReviewSchema.index({ status: 1, createdAt: -1 });

// Virtual fields
ReviewSchema.virtual('helpfulnessRatio').get(function () {
  const total = this.metrics.helpfulCount + this.metrics.notHelpfulCount;
  return total > 0 ? this.metrics.helpfulCount / total : 0;
});

ReviewSchema.virtual('engagementScore').get(function () {
  return (
    this.metrics.helpfulCount * 3 +
    this.metrics.viewCount * 0.1 +
    this.metrics.shareCount * 2 +
    this.responses.length * 5
  );
});

ReviewSchema.pre('save', function (next) {
  if (this.isModified('comment') || this.isModified('title')) {
    this.isEdited = true;
    this.lastEditedAt = new Date();
  }

  if (!this.title && this.comment) {
    this.title = this.comment.substring(0, 50) + (this.comment.length > 50 ? '...' : '');
  }

  next();
});

ReviewSchema.pre<Query<ReviewDocument[], ReviewDocument>>(/^find/, function (next) {
  if (this.getOptions()?.['includeDeleted'] !== true) {
    this.where({ isDeleted: { $ne: true } });
  }
  next();
});

ReviewSchema.pre('aggregate', function () {
  const options = (this as { options?: Record<string, unknown> }).options ?? {};
  if (options['includeDeleted'] !== true) {
    applySoftDeleteFilter(this);
  }
});

// Static methods
ReviewSchema.statics['findByEstablishment'] = function (
  this: Model<Review>,
  establishmentId: string,
  options: Record<string, unknown> = {},
) {
  return this.find({
    establishmentId,
    status: ReviewStatus.APPROVED,
    ...options,
  }).populate('reviewerId', 'firstName lastName avatar');
};

ReviewSchema.statics['getAverageRating'] = function (establishmentId: string) {
  return this.aggregate([
    {
      $match: {
        establishmentId: new Types.ObjectId(establishmentId),
        status: ReviewStatus.APPROVED,
      },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$overallRating' },
        totalReviews: { $sum: 1 },
        ratingDistribution: {
          $push: {
            $ifNull: [
              {
                $arrayElemAt: [REVIEW_RATING_LABELS, '$overallRating'],
              },
              'unknown',
            ],
          },
        },
      },
    },
  ]);
};
