import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';

import { LocationDto, SuggestionDto } from '../dto/search.dto';
import {
  PopularSearch,
  PopularSearchDocument,
  PopularityPeriod,
} from '../schemas/popular-search.schema';
import { SearchQuery, SearchQueryDocument } from '../schemas/search-query.schema';
import {
  SearchSuggestion,
  SearchSuggestionDocument,
  SuggestionType,
  SuggestionSource,
} from '../schemas/search-suggestion.schema';

import { SearchCacheService } from './search-cache.service';

interface SuggestionResult {
  text: string;
  type: SuggestionType;
  source: SuggestionSource;
  score: number;
  metadata?: Record<string, unknown>;
}

interface SuggestionCacheResult {
  suggestions: SuggestionResult[];
  trending: string[];
  personalized: string[];
}

function isSuggestionCacheResult(value: unknown): value is SuggestionCacheResult {
  if (typeof value !== 'object' || value === null || value === undefined) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record['suggestions']) &&
    Array.isArray(record['trending']) &&
    Array.isArray(record['personalized'])
  );
}

@Injectable()
export class SearchSuggestionService {
  private readonly logger = new Logger(SearchSuggestionService.name);

  constructor(
    @InjectModel(SearchSuggestion.name)
    private readonly suggestionModel: Model<SearchSuggestionDocument>,
    @InjectModel(PopularSearch.name)
    private readonly popularSearchModel: Model<PopularSearchDocument>,
    @InjectModel(SearchQuery.name)
    private readonly searchQueryModel: Model<SearchQueryDocument>,
    private readonly cacheService: SearchCacheService,
  ) {}

  /**
   * Get auto-complete suggestions for a partial query
   */
  async getSuggestions(
    suggestionDto: SuggestionDto,
    userId?: string,
  ): Promise<{
    suggestions: SuggestionResult[];
    trending: string[];
    personalized: string[];
  }> {
    const {
      query,
      limit = 10,
      types,
      location,
      includeTrending = true,
      includePersonalized = true,
    } = suggestionDto;

    const cacheKey = `suggestions:${query}:${limit}:${types?.join(',')}:${userId ?? 'anon'}`;
    const cached = await this.cacheService.get(cacheKey);
    if (isSuggestionCacheResult(cached)) {
      return cached;
    }

    try {
      const suggestions: SuggestionResult[] = [];

      // 1. Get text-based suggestions
      const textSuggestions = await this.getTextSuggestions(query, types, limit);
      suggestions.push(...textSuggestions);

      // 2. Get popular search suggestions
      const popularSuggestions = await this.getPopularSuggestions(query, limit / 2);
      suggestions.push(...popularSuggestions);

      // 3. Get location-based suggestions
      if (location) {
        const locationSuggestions = await this.getLocationBasedSuggestions(
          query,
          location,
          limit / 3,
        );
        suggestions.push(...locationSuggestions);
      }

      // 4. Get personalized suggestions for authenticated users
      let personalizedSuggestions: string[] = [];
      if (userId && includePersonalized) {
        personalizedSuggestions = await this.getPersonalizedSuggestions(userId, query, limit / 3);
      }

      // 5. Get trending suggestions
      let trendingSuggestions: string[] = [];
      if (includeTrending) {
        trendingSuggestions = await this.getTrendingSuggestions(limit / 2);
      }

      // Remove duplicates and sort by relevance
      const uniqueSuggestions = this.deduplicateAndRank(suggestions, query);
      const limitedSuggestions = uniqueSuggestions.slice(0, limit);

      const result = {
        suggestions: limitedSuggestions,
        trending: trendingSuggestions,
        personalized: personalizedSuggestions,
      };

      // Cache for 5 minutes
      await this.cacheService.set(cacheKey, result, 300);
      return result;
    } catch (error) {
      this.logger.error('Failed to get suggestions:', error);
      return {
        suggestions: [],
        trending: [],
        personalized: [],
      };
    }
  }

  /**
   * Get text-based suggestions using fuzzy matching
   */
  private async getTextSuggestions(
    query: string,
    types?: string[],
    limit: number = 10,
  ): Promise<SuggestionResult[]> {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          isActive: true,
          $text: { $search: query },
          ...(types && { type: { $in: types } }),
        },
      },
      {
        $addFields: {
          score: {
            $add: [
              { $multiply: [{ $meta: 'textScore' }, 0.6] },
              { $multiply: ['$relevanceScore', 0.3] },
              { $multiply: [{ $log: { $add: ['$frequency', 1] } }, 0.1] },
            ],
          },
        },
      },
      { $sort: { score: -1 } },
      { $limit: limit },
      {
        $project: {
          text: 1,
          type: 1,
          source: 1,
          score: 1,
          metadata: 1,
        },
      },
    ];

    // Also search in aliases
    const aliasResults = await this.suggestionModel.aggregate<SuggestionResult>([
      {
        $match: {
          isActive: true,
          aliases: { $regex: query, $options: 'i' },
          ...(types && { type: { $in: types } }),
        },
      },
      {
        $addFields: {
          score: {
            $add: [
              { $multiply: ['$relevanceScore', 0.5] },
              { $multiply: [{ $log: { $add: ['$frequency', 1] } }, 0.2] },
              0.3, // Bonus for alias match
            ],
          },
        },
      },
      { $sort: { score: -1 } },
      { $limit: Math.floor(limit / 2) },
      {
        $project: {
          text: 1,
          type: 1,
          source: 1,
          score: 1,
          metadata: 1,
        },
      },
    ]);

    const textResults = await this.suggestionModel.aggregate<SuggestionResult>(pipeline);
    return [...textResults, ...aliasResults];
  }

  /**
   * Get suggestions from popular searches
   */
  private async getPopularSuggestions(
    query: string,
    limit: number = 5,
  ): Promise<SuggestionResult[]> {
    const popularResults = await this.popularSearchModel.aggregate<SuggestionResult>([
      {
        $match: {
          isActive: true,
          period: PopularityPeriod.WEEKLY,
          query: { $regex: query, $options: 'i' },
          trendScore: { $gt: 0 },
        },
      },
      {
        $addFields: {
          score: {
            $add: [
              { $multiply: [{ $log: { $add: ['$searchCount', 1] } }, 0.4] },
              { $multiply: ['$trendScore', 0.4] },
              { $multiply: ['$clickThroughRate', 0.2] },
            ],
          },
        },
      },
      { $sort: { score: -1 } },
      { $limit: limit },
      {
        $project: {
          text: '$query',
          type: { $literal: SuggestionType.QUERY },
          source: { $literal: SuggestionSource.POPULAR_SEARCHES },
          score: 1,
          metadata: {
            searchCount: '$searchCount',
            trendScore: '$trendScore',
            trending: true,
          },
        },
      },
    ]);

    return popularResults;
  }

  /**
   * Get location-based suggestions
   */
  private async getLocationBasedSuggestions(
    query: string,
    location: LocationDto,
    limit: number = 5,
  ): Promise<SuggestionResult[]> {
    const { longitude, latitude, radius = 5000 } = location;

    const locationResults = await this.suggestionModel.aggregate<SuggestionResult>([
      {
        $match: {
          isActive: true,
          type: { $in: [SuggestionType.ESTABLISHMENT, SuggestionType.LOCATION] },
          'metadata.location.coordinates': {
            $nearSphere: {
              $geometry: { type: 'Point', coordinates: [longitude, latitude] },
              $maxDistance: radius,
            },
          },
          text: { $regex: query, $options: 'i' },
        },
      },
      {
        $addFields: {
          score: {
            $add: [
              { $multiply: ['$relevanceScore', 0.4] },
              { $multiply: [{ $log: { $add: ['$frequency', 1] } }, 0.3] },
              0.3, // Location bonus
            ],
          },
        },
      },
      { $sort: { score: -1 } },
      { $limit: limit },
      {
        $project: {
          text: 1,
          type: 1,
          source: { $literal: SuggestionSource.LOCATION_BASED },
          score: 1,
          metadata: 1,
        },
      },
    ]);

    return locationResults;
  }

  /**
   * Get personalized suggestions based on user history
   */
  private async getPersonalizedSuggestions(
    userId: string,
    query: string,
    limit: number = 5,
  ): Promise<string[]> {
    const userHistory = await this.searchQueryModel.aggregate<{ _id: string }>([
      {
        $match: {
          userId,
          query: { $regex: query, $options: 'i' },
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
        },
      },
      {
        $group: {
          _id: '$query',
          count: { $sum: 1 },
          lastUsed: { $max: '$createdAt' },
        },
      },
      {
        $addFields: {
          score: {
            $add: [
              { $multiply: [{ $log: { $add: ['$count', 1] } }, 0.6] },
              {
                $multiply: [
                  {
                    $divide: [
                      { $subtract: ['$lastUsed', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                      30 * 24 * 60 * 60 * 1000,
                    ],
                  },
                  0.4,
                ],
              },
            ],
          },
        },
      },
      { $sort: { score: -1 } },
      { $limit: limit },
      { $project: { _id: 1 } },
    ]);

    return userHistory.map((item) => item._id);
  }

  /**
   * Get trending suggestions
   */
  private async getTrendingSuggestions(limit: number = 5): Promise<string[]> {
    const trending = await this.popularSearchModel
      .find({
        isActive: true,
        period: PopularityPeriod.DAILY,
        trendDirection: 'rising',
        trendScore: { $gt: 0.5 },
      })
      .sort({ trendScore: -1 })
      .limit(limit)
      .select('query')
      .lean();

    return trending.map((item) => item.query);
  }

  /**
   * Remove duplicates and rank suggestions by relevance
   */
  private deduplicateAndRank(suggestions: SuggestionResult[], query: string): SuggestionResult[] {
    const seen = new Set<string>();
    const unique: SuggestionResult[] = [];

    for (const suggestion of suggestions) {
      const key = `${suggestion.text.toLowerCase()}_${suggestion.type}`;
      if (!seen.has(key)) {
        seen.add(key);

        // Boost score for exact matches
        if (suggestion.text.toLowerCase().startsWith(query.toLowerCase())) {
          suggestion.score += 0.5;
        }

        unique.push(suggestion);
      }
    }

    return unique.sort((a, b) => b.score - a.score);
  }

  /**
   * Add a new suggestion or update existing one
   */
  async addOrUpdateSuggestion(
    text: string,
    type: SuggestionType,
    source: SuggestionSource,
    metadata?: Record<string, unknown>,
  ): Promise<SearchSuggestionDocument> {
    const existing = await this.suggestionModel.findOne({ text, type });

    if (existing) {
      existing.frequency += 1;
      existing.lastUsed = new Date();
      if (metadata) {
        existing.metadata = { ...existing.metadata, ...metadata };
      }
      return existing.save();
    }

    return this.suggestionModel.create({
      text,
      type,
      source,
      frequency: 1,
      relevanceScore: 0.5,
      metadata,
      lastUsed: new Date(),
    });
  }

  /**
   * Update suggestion popularity metrics
   */
  async updateSuggestionMetrics(text: string, clicked: boolean, converted: boolean): Promise<void> {
    const suggestion = await this.suggestionModel.findOne({ text });
    if (!suggestion) {
      return;
    }

    suggestion.frequency += 1;
    suggestion.lastUsed = new Date();

    if (clicked) {
      const newCtr =
        (suggestion.clickThroughRate * suggestion.frequency + 1) / (suggestion.frequency + 1);
      suggestion.clickThroughRate = newCtr;
    }

    if (converted) {
      const newCr =
        (suggestion.conversionRate * suggestion.frequency + 1) / (suggestion.frequency + 1);
      suggestion.conversionRate = newCr;
    }

    await suggestion.save();
  }

  /**
   * Get popular categories for suggestion filters
   */
  async getPopularCategories(limit: number = 10): Promise<string[]> {
    const categories = await this.suggestionModel.aggregate<{ text: string }>([
      {
        $match: {
          type: SuggestionType.CATEGORY,
          isActive: true,
        },
      },
      { $sort: { frequency: -1 } },
      { $limit: limit },
      { $project: { text: 1 } },
    ]);

    return categories.map((cat) => cat.text);
  }

  /**
   * Clean up expired suggestions
   */
  async cleanupExpiredSuggestions(): Promise<number> {
    const result = await this.suggestionModel.deleteMany({
      $or: [
        { expiresAt: { $lt: new Date() } },
        {
          frequency: { $lt: 5 },
          createdAt: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
      ],
    });

    this.logger.log(`Cleaned up ${result.deletedCount} expired suggestions`);
    return result.deletedCount;
  }
}
