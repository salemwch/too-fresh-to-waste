import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';

import { QueueConcurrency } from '../common/constants/queue-concurrency.constant';
import { AppLoggerService } from '../common/services/logger.service';
import { ReviewAnalyticsService } from '../reviews/review-analytics.service';

@Injectable()
@Processor('review-analytics')
export class ReviewAnalyticsProcessor {
  private readonly logger = new Logger(ReviewAnalyticsProcessor.name);

  constructor(
    private readonly reviewAnalyticsService: ReviewAnalyticsService,
    private readonly appLogger: AppLoggerService,
  ) {}

  @Process({
    name: 'update-establishment-analytics',
    concurrency: QueueConcurrency.REVIEW_ANALYTICS,
  })
  async updateEstablishmentAnalytics(
    job: Job<{ establishmentId: string; timeframe: number }>,
  ): Promise<void> {
    const { establishmentId, timeframe } = job.data;

    try {
      this.logger.log(`Processing establishment analytics update for ${establishmentId}`);

      await this.reviewAnalyticsService.generateEstablishmentInsights(establishmentId, timeframe);

      this.logger.log(`Successfully updated analytics for establishment ${establishmentId}`);
    } catch (error) {
      this.logger.error(`Failed to update analytics for establishment ${establishmentId}:`, error);
      throw error;
    }
  }

  @Process({ name: 'generate-industry-report', concurrency: QueueConcurrency.REVIEW_ANALYTICS })
  async generateIndustryReport(
    job: Job<{ industryType: string; timeframe: number }>,
  ): Promise<void> {
    const { industryType, timeframe } = job.data;

    try {
      this.logger.log(`Generating industry report for ${industryType}`);

      const report = await this.reviewAnalyticsService.generateIndustryReport(
        industryType,
        timeframe,
      );

      this.logger.log(`Successfully generated industry report for ${industryType}`, {
        totalReviews: report['totalReviews'],
        totalEstablishments: report['totalEstablishments'],
        averageRating: report['averageRating'],
      });
    } catch (error) {
      this.logger.error(`Failed to generate industry report for ${industryType}:`, error);
      throw error;
    }
  }

  @Process({
    name: 'update-establishment-benchmark',
    concurrency: QueueConcurrency.REVIEW_ANALYTICS,
  })
  async updateEstablishmentBenchmark(job: Job<{ establishmentId: string }>): Promise<void> {
    const { establishmentId } = job.data;

    try {
      this.logger.log(`Processing establishment benchmark update for ${establishmentId}`);

      const benchmark =
        await this.reviewAnalyticsService.getEstablishmentBenchmark(establishmentId);

      this.logger.log(`Successfully updated benchmark for establishment ${establishmentId}`, {
        overallRank: benchmark.rankings.overallRank,
        percentile: benchmark.rankings.percentile,
        averageRating: benchmark.metrics.averageRating,
      });
    } catch (error) {
      this.logger.error(`Failed to update benchmark for establishment ${establishmentId}:`, error);
      throw error;
    }
  }

  @Process({ name: 'update', concurrency: QueueConcurrency.REVIEW_ANALYTICS })
  updateAnalytics(job: Job<Record<string, unknown>>): void {
    this.logger.warn('Generic update job received - consider using specific job types', job.data);
    this.appLogger.log(
      `Updating analytics: ${JSON.stringify(job.data)}`,
      'ReviewAnalyticsProcessor',
    );
  }
}
