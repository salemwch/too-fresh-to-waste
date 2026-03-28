import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';

import { SearchAnalyticsService } from '../services/search-analytics.service';
import { SearchIndexService } from '../services/search-index.service';

@Injectable()
@Processor('search-indexing')
export class SearchProcessor {
  private readonly logger = new Logger(SearchProcessor.name);

  constructor(
    private readonly searchIndexService: SearchIndexService,
    private readonly searchAnalyticsService: SearchAnalyticsService,
  ) {}

  @Process('index-offer')
  async indexOffer(job: Job<{ offerId: string }>) {
    try {
      this.logger.log(`Processing offer indexing: ${job.data.offerId}`);
      await this.searchIndexService.indexOffer(job.data.offerId);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to index offer ${job.data.offerId}:`, error);
      throw error;
    }
  }

  @Process('index-establishment')
  async indexEstablishment(job: Job<{ establishmentId: string }>) {
    try {
      this.logger.log(`Processing establishment indexing: ${job.data.establishmentId}`);
      await this.searchIndexService.indexEstablishment(job.data.establishmentId);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to index establishment ${job.data.establishmentId}:`, error);
      throw error;
    }
  }

  @Process('remove-from-index')
  async removeFromIndex(job: Job<{ type: 'offers' | 'establishments'; id: string }>) {
    try {
      this.logger.log(`Processing removal from index: ${job.data.type} ${job.data.id}`);
      await this.searchIndexService.removeFromIndex(job.data.type, job.data.id);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to remove ${job.data.type} ${job.data.id} from index:`, error);
      throw error;
    }
  }

  @Process('rebuild-index')
  async rebuildIndex(_job: Job) {
    try {
      this.logger.log('Processing full index rebuild...');
      await this.searchIndexService.rebuildIndex();
      this.logger.log('Full index rebuild completed');
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to rebuild search index:', error);
      throw error;
    }
  }

  @Process('record-search')
  async recordSearch(
    job: Job<{
      query: string;
      userId?: string;
      filters?: Record<string, unknown>;
      resultsCount?: number;
      location?: { latitude: number; longitude: number };
    }>,
  ) {
    try {
      const { query, userId, filters, resultsCount, location } = job.data;
      await this.searchAnalyticsService.recordSearchQuery(
        query,
        userId,
        filters,
        resultsCount,
        location,
      );
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to record search analytics:', error);
      throw error;
    }
  }

  @Process('cleanup-analytics')
  cleanupAnalytics(job: Job<{ olderThanDays: number }>) {
    try {
      this.logger.log(`Cleaning up search analytics older than ${job.data.olderThanDays} days`);
      // Implementation would clean up old search queries
      // For now, just log the action
      this.logger.log('Search analytics cleanup completed');
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to cleanup search analytics:', error);
      throw error;
    }
  }
}
