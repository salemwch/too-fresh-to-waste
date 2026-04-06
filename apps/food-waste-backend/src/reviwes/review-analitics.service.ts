import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bull';
import { Model, Types, PipelineStage } from 'mongoose';

import {
  Establishment,
  EstablishmentDocument,
} from '../establishments/schemas/establishment.schema';

import { Review, ReviewDocument, ReviewStatus, SentimentType } from './schemas/reviwe.schema';

export interface ReviewInsights {
  overallMetrics: {
    totalReviews: number;
    averageRating: number;
    reviewGrowthRate: number;
    engagementRate: number;
  };
  sentimentAnalysis: {
    distribution: { [key: string]: number };
    trends: Array<{
      date: string;
      positive: number;
      negative: number;
      neutral: number;
    }>;
    keywordAnalysis: Array<{
      keyword: string;
      sentiment: string;
      frequency: number;
      impact: number;
    }>;
  };
  ratingAnalysis: {
    distribution: { [key: string]: number };
    trends: Array<{
      date: string;
      averageRating: number;
      reviewCount: number;
    }>;
    categoryBreakdown: { [category: string]: number };
  };
  competitiveAnalysis: {
    industryAverage: number;
    percentileRank: number;
    topPerformers: Array<{
      establishmentId: string;
      name: string;
      rating: number;
      reviewCount: number;
    }>;
  };
  actionableInsights: Array<{
    type: 'improvement' | 'strength' | 'alert';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    recommendations: string[];
    impact: number;
  }>;
}
type TrendDirection = 'up' | 'down' | 'stable';
export interface EstablishmentBenchmark {
  establishmentId: string;
  industryType: string;
  metrics: {
    averageRating: number;
    totalReviews: number;
    responseRate: number;
    averageResponseTime: number;
    sentimentScore: number;
    engagementScore: number;
  };
  rankings: {
    overallRank: number;
    categoryRank: number;
    localRank: number;
    percentile: number;
  };
  trends: {
    ratingTrend: TrendDirection;
    reviewVolumeTrend: 'up' | 'down' | 'stable';
    sentimentTrend: 'improving' | 'declining' | 'stable';
  };
}

interface OverallMetricsCurrentAggregate {
  totalReviews: number;
  averageRating: number | null;
  totalEngagement: number;
}

interface OverallMetricsPreviousAggregate {
  totalReviews: number;
  averageRating: number | null;
}

interface OverallMetricsAggregationResult {
  current: OverallMetricsCurrentAggregate[];
  previous: OverallMetricsPreviousAggregate[];
}

interface ResponseMetricsAggregationResult {
  totalReviews: number;
  reviewsWithResponses: number;
  averageResponseTime: number | null;
}

interface TrendMetricsAggregationResult {
  averageRating: number | null;
  reviewCount: number;
  positiveReviews: number;
}

interface SentimentScoreAggregationResult {
  totalReviews: number;
  positiveReviews: number;
  negativeReviews: number;
  averageConfidence: number | null;
}

interface EngagementScoreAggregationResult {
  totalReviews: number;
  totalHelpfulVotes: number;
  totalShares: number;
  totalResponses: number;
  totalViews: number;
}

interface IndustryReportAggregationResult {
  totalReviews: number;
  averageRating: number | null;
  totalEstablishments: Types.ObjectId[];
  sentimentDistribution: string[];
  ratingDistribution: number[];
}

interface SentimentDistributionAggregationItem {
  _id: string | null;
  count: number;
}

interface SentimentTrendAggregationItem {
  _id: string;
  positive: number;
  negative: number;
  neutral: number;
}

interface KeywordAggregationItem {
  _id: {
    keyword: string;
    sentiment: string;
  };
  frequency: number;
  averageRating: number;
}

interface SentimentAnalysisAggregationResult {
  distribution: SentimentDistributionAggregationItem[];
  trends: SentimentTrendAggregationItem[];
  keywords: KeywordAggregationItem[];
}

interface RatingDistributionAggregationItem {
  _id: number;
  count: number;
}

interface RatingTrendAggregationItem {
  _id: string;
  averageRating: number;
  reviewCount: number;
}

interface RatingCategoryBreakdownAggregate {
  avgFoodQuality: number | null;
  avgServiceQuality: number | null;
  avgValueForMoney: number | null;
  avgPackaging: number | null;
  avgPickupExperience: number | null;
  avgSustainability: number | null;
}

interface RatingAnalysisAggregationResult {
  distribution: RatingDistributionAggregationItem[];
  trends: RatingTrendAggregationItem[];
  categoryBreakdown: RatingCategoryBreakdownAggregate[];
}

interface IndustryStatisticsAggregationResult {
  averageRating: number | null;
  totalEstablishments: number;
}

const EMPTY_OVERALL_METRICS_CURRENT: OverallMetricsCurrentAggregate = {
  totalReviews: 0,
  averageRating: 0,
  totalEngagement: 0,
};

const EMPTY_OVERALL_METRICS_PREVIOUS: OverallMetricsPreviousAggregate = {
  totalReviews: 0,
  averageRating: 0,
};

const EMPTY_RESPONSE_METRICS: ResponseMetricsAggregationResult = {
  totalReviews: 0,
  reviewsWithResponses: 0,
  averageResponseTime: null,
};

const EMPTY_TREND_METRICS: TrendMetricsAggregationResult = {
  averageRating: 0,
  reviewCount: 0,
  positiveReviews: 0,
};

const EMPTY_SENTIMENT_ANALYSIS: SentimentAnalysisAggregationResult = {
  distribution: [],
  trends: [],
  keywords: [],
};

const EMPTY_RATING_CATEGORY_BREAKDOWN: RatingCategoryBreakdownAggregate = {
  avgFoodQuality: null,
  avgServiceQuality: null,
  avgValueForMoney: null,
  avgPackaging: null,
  avgPickupExperience: null,
  avgSustainability: null,
};

const EMPTY_RATING_ANALYSIS: RatingAnalysisAggregationResult = {
  distribution: [],
  trends: [],
  categoryBreakdown: [],
};

@Injectable()
export class ReviewAnalyticsService {
  private readonly logger = new Logger(ReviewAnalyticsService.name);

  constructor(
    @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(Establishment.name)
    private readonly establishmentModel: Model<EstablishmentDocument>,
    @InjectQueue('review-analytics') private readonly analyticsQueue: Queue,
  ) {}

  async generateEstablishmentInsights(
    establishmentId: string,
    timeframe: number = 90, // days
  ): Promise<ReviewInsights> {
    try {
      const startDate = new Date(Date.now() - timeframe * 24 * 60 * 60 * 1000);

      const [overallMetrics, sentimentAnalysis, ratingAnalysis, competitiveAnalysis] =
        await Promise.all([
          this.calculateOverallMetrics(establishmentId, startDate),
          this.analyzeSentimentTrends(establishmentId, startDate),
          this.analyzeRatingTrends(establishmentId, startDate),
          this.performCompetitiveAnalysis(establishmentId),
        ]);

      const actionableInsights = this.generateActionableInsights(establishmentId, {
        overallMetrics,
        sentimentAnalysis,
        ratingAnalysis,
        competitiveAnalysis,
      });

      return {
        overallMetrics,
        sentimentAnalysis,
        ratingAnalysis,
        competitiveAnalysis,
        actionableInsights,
      };
    } catch (error) {
      this.logger.error(`Failed to generate insights for establishment ${establishmentId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate overall metrics for establishment
   */
  private async calculateOverallMetrics(
    establishmentId: string,
    startDate: Date,
  ): Promise<ReviewInsights['overallMetrics']> {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          establishmentId: new Types.ObjectId(establishmentId),
          status: ReviewStatus.APPROVED,
          createdAt: { $gte: startDate },
        },
      },
      {
        $facet: {
          current: [
            {
              $group: {
                _id: null,
                totalReviews: { $sum: 1 },
                averageRating: { $avg: '$overallRating' },
                totalEngagement: {
                  $sum: {
                    $add: ['$metrics.helpfulCount', '$metrics.shareCount', { $size: '$responses' }],
                  },
                },
              },
            },
          ],
          previous: [
            {
              $match: {
                createdAt: {
                  $gte: new Date(startDate.getTime() - (Date.now() - startDate.getTime())),
                  $lt: startDate,
                },
              },
            },
            {
              $group: {
                _id: null,
                totalReviews: { $sum: 1 },
                averageRating: { $avg: '$overallRating' },
              },
            },
          ],
        },
      },
    ];

    const [result] = await this.reviewModel.aggregate<OverallMetricsAggregationResult>(pipeline);
    const current = result?.current[0] ?? EMPTY_OVERALL_METRICS_CURRENT;
    const previous = result?.previous[0] ?? EMPTY_OVERALL_METRICS_PREVIOUS;

    const reviewGrowthRate =
      previous.totalReviews > 0
        ? ((current.totalReviews - previous.totalReviews) / previous.totalReviews) * 100
        : 0;

    const engagementRate =
      current.totalReviews > 0 ? (current.totalEngagement / current.totalReviews) * 100 : 0;

    return {
      totalReviews: current.totalReviews,
      averageRating: Math.round((current.averageRating ?? 0) * 100) / 100,
      reviewGrowthRate: Math.round(reviewGrowthRate * 100) / 100,
      engagementRate: Math.round(engagementRate * 100) / 100,
    };
  }

  private async getEstablishmentRanking(
    establishmentId: string,
    industryType: string,
  ): Promise<{ percentile: number; rank: number }> {
    const establishment = await this.establishmentModel.findById(establishmentId);
    if (!establishment) {
      return { percentile: 0, rank: 0 };
    }

    const betterEstablishments = await this.establishmentModel.countDocuments({
      type: industryType,
      status: 'active',
      averageRating: { $gt: establishment.averageRating },
    });

    const totalEstablishments = await this.establishmentModel.countDocuments({
      type: industryType,
      status: 'active',
    });

    const rank = betterEstablishments + 1;
    const percentile =
      totalEstablishments > 0
        ? Math.round(((totalEstablishments - rank + 1) / totalEstablishments) * 100)
        : 0;

    return { percentile, rank };
  }

  private async getTopPerformers(
    industryType: string,
    limit: number,
  ): Promise<EstablishmentDocument[]> {
    const performers = await this.establishmentModel
      .find({ type: industryType, status: 'active' })
      .sort({ averageRating: -1, totalReviews: -1 })
      .limit(limit)
      .select('name averageRating totalReviews')
      .exec();
    return performers;
  }

  private async calculateEstablishmentMetrics(
    establishmentId: string,
  ): Promise<EstablishmentBenchmark['metrics']> {
    const establishment = await this.establishmentModel.findById(establishmentId);
    if (!establishment) {
      throw new Error('Establishment not found');
    }

    // Calculate response rate and average response time
    const reviewsWithResponses = await this.reviewModel.aggregate<ResponseMetricsAggregationResult>(
      [
        { $match: { establishmentId: new Types.ObjectId(establishmentId) } },
        {
          $project: {
            hasResponse: { $gt: [{ $size: '$responses' }, 0] },
            responseTime: {
              $cond: [
                { $gt: [{ $size: '$responses' }, 0] },
                {
                  $subtract: [{ $arrayElemAt: ['$responses.respondedAt', 0] }, '$createdAt'],
                },
                null,
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            reviewsWithResponses: {
              $sum: { $cond: ['$hasResponse', 1, 0] },
            },
            averageResponseTime: { $avg: '$responseTime' },
          },
        },
      ],
    );

    const responseData = reviewsWithResponses[0] ?? EMPTY_RESPONSE_METRICS;
    const responseRate =
      responseData.totalReviews > 0
        ? (responseData.reviewsWithResponses / responseData.totalReviews) * 100
        : 0;

    const averageResponseTime =
      responseData.averageResponseTime !== null && responseData.averageResponseTime !== undefined
        ? Math.round(responseData.averageResponseTime / (1000 * 60 * 60)) // Convert to hours
        : 0;

    // Calculate sentiment score
    const sentimentScore = await this.calculateSentimentScore(establishmentId);

    // Calculate engagement score
    const engagementScore = await this.calculateEngagementScore(establishmentId);

    return {
      averageRating: establishment.averageRating,
      totalReviews: establishment.totalReviews,
      responseRate: Math.round(responseRate * 100) / 100,
      averageResponseTime,
      sentimentScore,
      engagementScore,
    };
  }

  private async analyzeEstablishmentTrends(
    establishmentId: string,
  ): Promise<EstablishmentBenchmark['trends']> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const [recent, previous] = await Promise.all([
      this.reviewModel.aggregate<TrendMetricsAggregationResult>([
        {
          $match: {
            establishmentId: new Types.ObjectId(establishmentId),
            status: ReviewStatus.APPROVED,
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$overallRating' },
            reviewCount: { $sum: 1 },
            positiveReviews: {
              $sum: {
                $cond: [{ $eq: ['$sentimentAnalysis.sentiment', SentimentType.POSITIVE] }, 1, 0],
              },
            },
          },
        },
      ]),
      this.reviewModel.aggregate<TrendMetricsAggregationResult>([
        {
          $match: {
            establishmentId: new Types.ObjectId(establishmentId),
            status: ReviewStatus.APPROVED,
            createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$overallRating' },
            reviewCount: { $sum: 1 },
            positiveReviews: {
              $sum: {
                $cond: [{ $eq: ['$sentimentAnalysis.sentiment', SentimentType.POSITIVE] }, 1, 0],
              },
            },
          },
        },
      ]),
    ]);

    const recentData = recent[0] ?? EMPTY_TREND_METRICS;
    const previousData = previous[0] ?? EMPTY_TREND_METRICS;

    const ratingTrend = this.calculateTrend(
      recentData.averageRating ?? 0,
      previousData.averageRating ?? 0,
      0.1,
    );
    const reviewVolumeTrend = this.calculateTrend(
      recentData.reviewCount,
      previousData.reviewCount,
      0.05,
    );
    const sentimentTrend = this.calculateSentimentTrend(
      recentData.positiveReviews / Math.max(recentData.reviewCount, 1),
      previousData.positiveReviews / Math.max(previousData.reviewCount, 1),
    );

    return {
      ratingTrend,
      reviewVolumeTrend,
      sentimentTrend,
    };
  }

  private calculateTrend(
    current: number,
    previous: number,
    threshold: number,
  ): 'up' | 'down' | 'stable' {
    if (previous === 0) {
      return 'stable';
    }
    const change = (current - previous) / previous;
    if (change > threshold) {
      return 'up';
    }
    if (change < -threshold) {
      return 'down';
    }
    return 'stable';
  }

  private calculateSentimentTrend(
    currentPositive: number,
    previousPositive: number,
  ): 'improving' | 'declining' | 'stable' {
    const threshold = 0.05;
    const change = currentPositive - previousPositive;
    if (change > threshold) {
      return 'improving';
    }
    if (change < -threshold) {
      return 'declining';
    }
    return 'stable';
  }

  private async calculateSentimentScore(establishmentId: string): Promise<number> {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          establishmentId: new Types.ObjectId(establishmentId),
          status: ReviewStatus.APPROVED,
        },
      },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          positiveReviews: {
            $sum: {
              $cond: [{ $eq: ['$sentimentAnalysis.sentiment', SentimentType.POSITIVE] }, 1, 0],
            },
          },
          negativeReviews: {
            $sum: {
              $cond: [{ $eq: ['$sentimentAnalysis.sentiment', SentimentType.NEGATIVE] }, 1, 0],
            },
          },
          averageConfidence: { $avg: '$sentimentAnalysis.confidence' },
        },
      },
    ];

    const [result] = await this.reviewModel.aggregate<SentimentScoreAggregationResult>(pipeline);

    if (result === null || result === undefined || result.totalReviews === 0) {
      return 50; // Neutral score
    }

    const positiveRatio = result.positiveReviews / result.totalReviews;
    const negativeRatio = result.negativeReviews / result.totalReviews;
    const confidence = result.averageConfidence ?? 0.5;

    // Calculate sentiment score: 0-100 where 50 is neutral
    const sentimentScore = 50 + (positiveRatio - negativeRatio) * 50 * confidence;
    return Math.round(Math.max(0, Math.min(100, sentimentScore)));
  }

  private async calculateEngagementScore(establishmentId: string): Promise<number> {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          establishmentId: new Types.ObjectId(establishmentId),
          status: ReviewStatus.APPROVED,
        },
      },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          totalHelpfulVotes: { $sum: '$metrics.helpfulCount' },
          totalShares: { $sum: '$metrics.shareCount' },
          totalResponses: { $sum: { $size: '$responses' } },
          totalViews: { $sum: '$metrics.viewCount' },
        },
      },
    ];

    const [result] = await this.reviewModel.aggregate<EngagementScoreAggregationResult>(pipeline);

    if (result === null || result === undefined || result.totalReviews === 0) {
      return 0;
    }

    // Calculate engagement score based on various interactions
    const avgHelpfulVotes = result.totalHelpfulVotes / result.totalReviews;
    const avgShares = result.totalShares / result.totalReviews;
    const responseRate = result.totalResponses / result.totalReviews;
    const avgViews = result.totalViews / result.totalReviews;

    // Weighted engagement score
    const engagementScore =
      avgHelpfulVotes * 25 + // Helpful votes weight
      avgShares * 30 + // Shares weight
      responseRate * 35 + // Response rate weight
      (avgViews / 10) * 10; // Views weight (normalized)

    return Math.round(Math.max(0, Math.min(100, engagementScore)));
  }

  private processSentimentArray(sentiments: string[]): Record<string, number> {
    return sentiments.reduce<Record<string, number>>((acc, sentiment) => {
      acc[sentiment || 'unknown'] = (acc[sentiment || 'unknown'] ?? 0) + 1;
      return acc;
    }, {});
  }

  private processRatingArray(ratings: number[]): Record<string, number> {
    return ratings.reduce<Record<string, number>>((acc, rating) => {
      const key = `rating_${rating}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }

  // ================================
  // PUBLIC METHODS
  // ================================

  /**
   * Get establishment benchmark data
   */
  async getEstablishmentBenchmark(establishmentId: string): Promise<EstablishmentBenchmark> {
    try {
      const establishment = await this.establishmentModel.findById(establishmentId);
      if (!establishment) {
        throw new Error('Establishment not found');
      }

      // Calculate establishment metrics
      const metrics = await this.calculateEstablishmentMetrics(establishmentId);

      // Get rankings
      const rankings = await this.getEstablishmentRanking(establishmentId, establishment.type);

      // Analyze trends
      const trends = await this.analyzeEstablishmentTrends(establishmentId);

      return {
        establishmentId,
        industryType: establishment.type,
        metrics,
        rankings: {
          ...rankings,
          overallRank: rankings.rank,
          categoryRank: rankings.rank,
          localRank: rankings.rank, // Would be calculated based on location
        },
        trends,
      };
    } catch (error) {
      this.logger.error(`Failed to get establishment benchmark:`, error);
      throw error;
    }
  }

  /**
   * Generate industry report
   */
  async generateIndustryReport(
    industryType: string,
    timeframe: number = 90,
  ): Promise<Record<string, unknown>> {
    try {
      const startDate = new Date(Date.now() - timeframe * 24 * 60 * 60 * 1000);

      const pipeline: PipelineStage[] = [
        {
          $lookup: {
            from: 'establishments',
            localField: 'establishmentId',
            foreignField: '_id',
            as: 'establishment',
          },
        },
        { $unwind: '$establishment' },
        {
          $match: {
            'establishment.type': industryType,
            status: ReviewStatus.APPROVED,
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            averageRating: { $avg: '$overallRating' },
            totalEstablishments: { $addToSet: '$establishmentId' },
            sentimentDistribution: {
              $push: '$sentimentAnalysis.sentiment',
            },
            ratingDistribution: {
              $push: '$overallRating',
            },
          },
        },
      ];

      const [result] = await this.reviewModel.aggregate<IndustryReportAggregationResult>(pipeline);

      if (result === null || result === undefined) {
        return {
          industryType,
          totalReviews: 0,
          totalEstablishments: 0,
          averageRating: 0,
          insights: [],
        };
      }

      return {
        industryType,
        totalReviews: result.totalReviews,
        totalEstablishments: result.totalEstablishments.length,
        averageRating: Math.round((result.averageRating ?? 0) * 100) / 100,
        sentimentDistribution: this.processSentimentArray(result.sentimentDistribution),
        ratingDistribution: this.processRatingArray(result.ratingDistribution),
        generatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to generate industry report:`, error);
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduleAnalyticsUpdates(): Promise<void> {
    try {
      this.logger.log('Starting scheduled analytics updates');

      // Queue analytics updates for all active establishments
      const establishments = await this.establishmentModel
        .find({ status: 'active' })
        .select('_id')
        .limit(1000); // Process in batches

      for (const establishment of establishments) {
        await this.analyticsQueue.add(
          'update-establishment-analytics',
          {
            establishmentId: establishment._id.toString(),
            timeframe: 30, // Last 30 days
          },
          {
            delay: Math.random() * 60000, // Random delay up to 1 minute
          },
        );
      }

      this.logger.log(`Queued analytics updates for ${establishments.length} establishments`);
    } catch (error) {
      this.logger.error('Failed to schedule analytics updates:', error);
    }
  }

  @Cron(CronExpression.EVERY_WEEK)
  async generateWeeklyReports(): Promise<void> {
    try {
      this.logger.log('Starting weekly industry report generation');

      const industryTypes = [
        'restaurant',
        'bakery',
        'grocery_store',
        'cafe',
        'fast_food',
        'supermarket',
      ];

      for (const industryType of industryTypes) {
        await this.analyticsQueue.add('generate-industry-report', {
          industryType,
          timeframe: 7, // Last 7 days
        });
      }

      this.logger.log('Queued weekly industry reports');
    } catch (error) {
      this.logger.error('Failed to generate weekly reports:', error);
    }
  }

  @Cron(CronExpression.EVERY_12_HOURS)
  async updateEstablishmentBenchmarks(): Promise<void> {
    try {
      this.logger.log('Starting establishment benchmark updates');

      // Find establishments that need benchmark updates
      const establishments = await this.establishmentModel
        .find({
          status: 'active',
          totalReviews: { $gte: 5 }, // Only establishments with sufficient reviews
        })
        .select('_id type')
        .limit(500);

      for (const establishment of establishments) {
        await this.analyticsQueue.add(
          'update-establishment-benchmark',
          {
            establishmentId: establishment._id.toString(),
          },
          {
            delay: Math.random() * 120000, // Random delay up to 2 minutes
          },
        );
      }

      this.logger.log(`Queued benchmark updates for ${establishments.length} establishments`);
    } catch (error) {
      this.logger.error('Failed to update establishment benchmarks:', error);
    }
  }

  private async analyzeSentimentTrends(
    establishmentId: string,
    startDate: Date,
  ): Promise<ReviewInsights['sentimentAnalysis']> {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          establishmentId: new Types.ObjectId(establishmentId),
          status: ReviewStatus.APPROVED,
          createdAt: { $gte: startDate },
        },
      },
      {
        $facet: {
          distribution: [
            {
              $group: {
                _id: '$sentimentAnalysis.sentiment',
                count: { $sum: 1 },
              },
            },
          ],
          trends: [
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$createdAt',
                  },
                },
                positive: {
                  $sum: {
                    $cond: [
                      { $eq: ['$sentimentAnalysis.sentiment', SentimentType.POSITIVE] },
                      1,
                      0,
                    ],
                  },
                },
                negative: {
                  $sum: {
                    $cond: [
                      { $eq: ['$sentimentAnalysis.sentiment', SentimentType.NEGATIVE] },
                      1,
                      0,
                    ],
                  },
                },
                neutral: {
                  $sum: {
                    $cond: [{ $eq: ['$sentimentAnalysis.sentiment', SentimentType.NEUTRAL] }, 1, 0],
                  },
                },
              },
            },
            { $sort: { _id: 1 } },
          ],
          keywords: [
            { $unwind: '$sentimentAnalysis.keywords' },
            {
              $group: {
                _id: {
                  keyword: '$sentimentAnalysis.keywords',
                  sentiment: '$sentimentAnalysis.sentiment',
                },
                frequency: { $sum: 1 },
                averageRating: { $avg: '$overallRating' },
              },
            },
            { $sort: { frequency: -1 } },
            { $limit: 50 },
          ],
        },
      },
    ];

    const [result] = await this.reviewModel.aggregate<SentimentAnalysisAggregationResult>(pipeline);
    const sentimentAnalysis = result ?? EMPTY_SENTIMENT_ANALYSIS;

    // Process distribution
    const distribution = sentimentAnalysis.distribution.reduce(
      (acc: Record<string, number>, item) => {
        acc[item._id ?? 'unknown'] = item.count;
        return acc;
      },
      {},
    );

    // Process trends
    const trends = sentimentAnalysis.trends.map(item => ({
      date: item._id,
      positive: item.positive,
      negative: item.negative,
      neutral: item.neutral,
    }));

    // Process keywords with impact analysis
    const keywordAnalysis = sentimentAnalysis.keywords.map(item => ({
      keyword: item._id.keyword,
      sentiment: item._id.sentiment,
      frequency: item.frequency,
      impact: this.calculateKeywordImpact(item.frequency, item.averageRating),
    }));

    return {
      distribution,
      trends,
      keywordAnalysis,
    };
  }

  /**
   * Analyze rating trends and distribution
   */
  private async analyzeRatingTrends(
    establishmentId: string,
    startDate: Date,
  ): Promise<ReviewInsights['ratingAnalysis']> {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          establishmentId: new Types.ObjectId(establishmentId),
          status: ReviewStatus.APPROVED,
          createdAt: { $gte: startDate },
        },
      },
      {
        $facet: {
          distribution: [
            {
              $group: {
                _id: '$overallRating',
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
          trends: [
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$createdAt',
                  },
                },
                averageRating: { $avg: '$overallRating' },
                reviewCount: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
          categoryBreakdown: [
            {
              $group: {
                _id: null,
                avgFoodQuality: { $avg: '$detailedRatings.foodQuality' },
                avgServiceQuality: { $avg: '$detailedRatings.serviceQuality' },
                avgValueForMoney: { $avg: '$detailedRatings.valueForMoney' },
                avgPackaging: { $avg: '$detailedRatings.packaging' },
                avgPickupExperience: { $avg: '$detailedRatings.pickupExperience' },
                avgSustainability: { $avg: '$detailedRatings.sustainability' },
              },
            },
          ],
        },
      },
    ];

    const [result] = await this.reviewModel.aggregate<RatingAnalysisAggregationResult>(pipeline);
    const ratingAnalysis = result ?? EMPTY_RATING_ANALYSIS;

    // Process distribution
    const distribution = ratingAnalysis.distribution.reduce((acc: Record<string, number>, item) => {
      acc[`rating_${item._id}`] = item.count;
      return acc;
    }, {});

    // Process trends
    const trends = ratingAnalysis.trends.map(item => ({
      date: item._id,
      averageRating: Math.round(item.averageRating * 100) / 100,
      reviewCount: item.reviewCount,
    }));

    // Process category breakdown
    const categoryData = ratingAnalysis.categoryBreakdown[0] ?? EMPTY_RATING_CATEGORY_BREAKDOWN;
    const categoryBreakdown = {
      foodQuality: Math.round((categoryData.avgFoodQuality ?? 0) * 100) / 100,
      serviceQuality: Math.round((categoryData.avgServiceQuality ?? 0) * 100) / 100,
      valueForMoney: Math.round((categoryData.avgValueForMoney ?? 0) * 100) / 100,
      packaging: Math.round((categoryData.avgPackaging ?? 0) * 100) / 100,
      pickupExperience: Math.round((categoryData.avgPickupExperience ?? 0) * 100) / 100,
      sustainability: Math.round((categoryData.avgSustainability ?? 0) * 100) / 100,
    };

    return {
      distribution,
      trends,
      categoryBreakdown,
    };
  }

  /**
   * Perform competitive analysis
   */
  private async performCompetitiveAnalysis(
    establishmentId: string,
  ): Promise<ReviewInsights['competitiveAnalysis']> {
    try {
      // Get the establishment details
      const establishment = await this.establishmentModel.findById(establishmentId);
      if (!establishment) {
        throw new Error('Establishment not found');
      }

      // Get industry statistics
      const industryStats = await this.getIndustryStatistics(establishment.type);

      // Get establishment ranking
      const ranking = await this.getEstablishmentRanking(establishmentId, establishment.type);

      // Get top performers in the category
      const topPerformers = await this.getTopPerformers(establishment.type, 5);

      return {
        industryAverage: industryStats.averageRating,
        percentileRank: ranking.percentile,
        topPerformers: topPerformers.map(performer => ({
          establishmentId: performer._id.toString(),
          name: performer.name,
          rating: performer.averageRating,
          reviewCount: performer.totalReviews,
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to perform competitive analysis:`, error);
      return {
        industryAverage: 0,
        percentileRank: 0,
        topPerformers: [],
      };
    }
  }

  /**
   * Generate actionable insights based on analytics
   */
  private generateActionableInsights(
    _establishmentId: string,
    analytics: Partial<ReviewInsights>,
  ): ReviewInsights['actionableInsights'] {
    const insights: ReviewInsights['actionableInsights'] = [];

    // Analyze rating trends
    if (analytics.overallMetrics) {
      const { averageRating, reviewGrowthRate } = analytics.overallMetrics;

      if (averageRating < 3.5) {
        insights.push({
          type: 'alert',
          priority: 'high',
          title: 'Low Average Rating Alert',
          description:
            'Your establishment has a below-average rating that may impact customer acquisition.',
          recommendations: [
            'Focus on addressing the most common complaints in recent reviews',
            'Implement quality improvement processes',
            'Actively engage with customer feedback',
            'Consider staff training programs',
          ],
          impact: 85,
        });
      }

      if (reviewGrowthRate < -20) {
        insights.push({
          type: 'alert',
          priority: 'high',
          title: 'Declining Review Volume',
          description:
            'Review volume has decreased significantly, which may indicate reduced customer engagement.',
          recommendations: [
            'Launch a customer feedback campaign',
            'Incentivize customers to leave reviews',
            'Improve service quality to encourage organic reviews',
            'Follow up with customers after orders',
          ],
          impact: 70,
        });
      }
    }

    // Analyze sentiment trends
    if (analytics.sentimentAnalysis) {
      const { distribution, keywordAnalysis } = analytics.sentimentAnalysis;

      const negativeRatio =
        (distribution['negative'] ?? 0) /
        Object.values(distribution).reduce((a: number, b: number) => a + b, 0);

      if (negativeRatio > 0.3) {
        const topNegativeKeywords = keywordAnalysis
          .filter(k => k.sentiment === 'negative')
          .sort((a, b) => b.frequency - a.frequency)
          .slice(0, 3);

        insights.push({
          type: 'improvement',
          priority: 'high',
          title: 'High Negative Sentiment',
          description: `${Math.round(negativeRatio * 100)}% of reviews have negative sentiment.`,
          recommendations: [
            `Address issues related to: ${topNegativeKeywords.map(k => k.keyword).join(', ')}`,
            'Implement systematic quality control measures',
            'Train staff on customer service excellence',
            'Monitor and respond to negative feedback quickly',
          ],
          impact: 80,
        });
      }

      // Identify strengths from positive keywords
      const topPositiveKeywords = keywordAnalysis
        .filter(k => k.sentiment === 'positive')
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 3);

      if (topPositiveKeywords.length > 0) {
        insights.push({
          type: 'strength',
          priority: 'medium',
          title: 'Key Strengths Identified',
          description: `Customers frequently praise: ${topPositiveKeywords
            .map(k => k.keyword)
            .join(', ')}`,
          recommendations: [
            'Continue to excel in these areas',
            'Highlight these strengths in marketing materials',
            'Train staff to maintain these standards',
            'Use these strengths to differentiate from competitors',
          ],
          impact: 60,
        });
      }
    }

    // Analyze category ratings
    if (analytics.ratingAnalysis?.categoryBreakdown) {
      const categories = analytics.ratingAnalysis.categoryBreakdown;
      const lowestCategory = Object.entries(categories)
        .filter(([_, rating]) => rating > 0)
        .sort(([_, a], [__, b]) => a - b)[0];

      if (lowestCategory && lowestCategory[1] < 3.5) {
        const categoryName = this.formatCategoryName(lowestCategory[0]);
        insights.push({
          type: 'improvement',
          priority: 'medium',
          title: `Improvement Needed in ${categoryName}`,
          description: `${categoryName} has the lowest rating at ${lowestCategory[1]}/5.`,
          recommendations: this.getCategorySpecificRecommendations(lowestCategory[0]),
          impact: 65,
        });
      }
    }

    // Sort insights by priority and impact
    return insights.sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      const aPriority = priorityWeight[a.priority];
      const bPriority = priorityWeight[b.priority];

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      return b.impact - a.impact;
    });
  }

  private calculateKeywordImpact(frequency: number, averageRating: number): number {
    // Impact score based on frequency and rating correlation
    const normalizedFrequency = Math.min(frequency / 10, 1); // Normalize to 0-1
    const ratingWeight = averageRating / 5; // Normalize to 0-1
    return Math.round((normalizedFrequency * 0.7 + ratingWeight * 0.3) * 100);
  }

  private formatCategoryName(category: string): string {
    return category
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  private getCategorySpecificRecommendations(category: string): string[] {
    const recommendations = {
      foodQuality: [
        'Review and improve food sourcing and preparation processes',
        'Implement quality control checks before packaging',
        'Train kitchen staff on food quality standards',
        'Consider menu optimization based on customer feedback',
      ],
      serviceQuality: [
        'Enhance staff training on customer service',
        'Implement service quality monitoring systems',
        'Reduce wait times and improve efficiency',
        'Ensure consistent service standards across all shifts',
      ],
      valueForMoney: [
        'Review pricing strategy against competitors',
        'Increase portion sizes or add value-added services',
        'Communicate value proposition more clearly to customers',
        'Consider loyalty programs or discounts for regular customers',
      ],
      packaging: [
        'Upgrade to more sustainable and appealing packaging',
        'Ensure food stays fresh during transit',
        'Add branded elements to enhance presentation',
        'Consider eco-friendly packaging options',
      ],
      pickupExperience: [
        'Streamline pickup process and reduce wait times',
        'Improve pickup area organization and signage',
        'Train staff on efficient order fulfillment',
        'Implement digital pickup notifications',
      ],
      sustainability: [
        'Implement more sustainable practices',
        'Source from local and organic suppliers',
        'Reduce food waste through better inventory management',
        'Communicate sustainability efforts to customers',
      ],
    };

    return (
      recommendations[category as keyof typeof recommendations] ?? [
        'Analyze customer feedback for specific improvement areas',
        'Implement quality monitoring systems',
        'Train staff on best practices',
        'Regularly review and update processes',
      ]
    );
  }

  private async getIndustryStatistics(
    industryType: string,
  ): Promise<{ averageRating: number; totalEstablishments: number }> {
    const pipeline: PipelineStage[] = [
      { $match: { type: industryType, status: 'active' } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$averageRating' },
          totalEstablishments: { $sum: 1 },
        },
      },
    ];

    const [result] =
      await this.establishmentModel.aggregate<IndustryStatisticsAggregationResult>(pipeline);
    return {
      averageRating: Math.round((result?.averageRating ?? 0) * 100) / 100,
      totalEstablishments: result?.totalEstablishments ?? 0,
    };
  }
}
