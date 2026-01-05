import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SearchQuery, SearchQueryDocument } from '../schemas/search-query.schema';
import { PopularSearch, PopularSearchDocument } from '../schemas/popular-search.schema';

@Injectable()
export class SearchAnalyticsService {
  private readonly logger = new Logger(SearchAnalyticsService.name);

  constructor(
    @InjectModel(SearchQuery.name) private searchQueryModel: Model<SearchQueryDocument>,
    @InjectModel(PopularSearch.name) private popularSearchModel: Model<PopularSearchDocument>,
  ) {}

  async recordSearchQuery(
    query: string,
    userId?: string,
    filters?: any,
    resultsCount?: number,
    location?: { latitude: number; longitude: number },
  ): Promise<void> {
    try {
      await this.searchQueryModel.create({
        query: query.toLowerCase().trim(),
        userId,
        filters,
        resultsCount: resultsCount || 0,
        location: location ? {
          type: 'Point',
          coordinates: [location.longitude, location.latitude],
        } : undefined,
        timestamp: new Date(),
      });

      // Update popular searches
      await this.updatePopularSearches(query);
    } catch (error) {
      this.logger.error('Error recording search query:', error);
    }
  }

  async getSearchAnalytics(period: 'day' | 'week' | 'month' = 'day'): Promise<any> {
    try {
      const startDate = this.getStartDate(period);

      const analytics = await this.searchQueryModel.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: null,
            totalSearches: { $sum: 1 },
            uniqueQueries: { $addToSet: '$query' },
            averageResults: { $avg: '$resultsCount' },
            zeroResultQueries: {
              $sum: { $cond: [{ $eq: ['$resultsCount', 0] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            totalSearches: 1,
            uniqueQueryCount: { $size: '$uniqueQueries' },
            averageResults: { $round: ['$averageResults', 2] },
            zeroResultQueries: 1,
            zeroResultRate: {
              $round: [
                { $multiply: [{ $divide: ['$zeroResultQueries', '$totalSearches'] }, 100] },
                2,
              ],
            },
          },
        },
      ]);

      return analytics[0] || {
        totalSearches: 0,
        uniqueQueryCount: 0,
        averageResults: 0,
        zeroResultQueries: 0,
        zeroResultRate: 0,
      };
    } catch (error) {
      this.logger.error('Error getting search analytics:', error);
      throw error;
    }
  }

  async getTopSearchQueries(limit: number = 10): Promise<any[]> {
    try {
      return await this.popularSearchModel
        .find()
        .sort({ searchCount: -1, lastSearched: -1 })
        .limit(limit)
        .exec();
    } catch (error) {
      this.logger.error('Error getting top search queries:', error);
      return [];
    }
  }

  async getSearchTrends(period: 'day' | 'week' | 'month' = 'week'): Promise<any[]> {
    try {
      const startDate = this.getStartDate(period);

      return await this.searchQueryModel.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              query: '$query',
              date: {
                $dateToString: {
                  format: period === 'day' ? '%Y-%m-%d-%H' : '%Y-%m-%d',
                  date: '$timestamp',
                },
              },
            },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: '$_id.query',
            trend: {
              $push: {
                date: '$_id.date',
                count: '$count',
              },
            },
            totalCount: { $sum: '$count' },
          },
        },
        {
          $sort: { totalCount: -1 },
        },
        {
          $limit: 20,
        },
      ]);
    } catch (error) {
      this.logger.error('Error getting search trends:', error);
      return [];
    }
  }

  private async updatePopularSearches(query: string): Promise<void> {
    try {
      const normalizedQuery = query.toLowerCase().trim();

      await this.popularSearchModel.findOneAndUpdate(
        { query: normalizedQuery },
        {
          $inc: { searchCount: 1 },
          $set: { lastSearched: new Date() },
        },
        { upsert: true, new: true },
      );
    } catch (error) {
      this.logger.error('Error updating popular searches:', error);
    }
  }

  private getStartDate(period: 'day' | 'week' | 'month'): Date {
    const now = new Date();
    switch (period) {
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }
}