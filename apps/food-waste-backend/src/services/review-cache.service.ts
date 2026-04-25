import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisService } from '../redis/redis.service';
import { ReviewDocument, ReviewSentimentAnalysis } from '../reviews/schemas/review.schema';

type RedisClient = Awaited<ReturnType<RedisService['getClient']>>;

export interface CachedReview {
  id: string;
  establishmentId: string;
  reviewerId: string;
  overallRating: number;
  comment: string;
  title?: string | undefined;
  status: string;
  sentimentAnalysis?: ReviewSentimentAnalysis | undefined;
  metrics: {
    helpfulCount: number;
    notHelpfulCount: number;
    viewCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
  cachedAt: Date;
  expiresAt: Date;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
  hitRate: number;
}

export interface RedisConfiguration {
  host?: string;
  port?: number;
  tlsPort?: number;
  password?: string;
  username: string;
  database: number;
  // SSL/TLS Configuration
  tls: boolean;
  tlsRejectUnauthorized: boolean;
  tlsCheckServerIdentity: boolean;
  tlsMinVersion: string;
  // Certificate paths
  tlsCertFile?: string;
  tlsKeyFile?: string;
  tlsCaFile?: string;
  // Connection settings
  connectTimeout: number;
  commandTimeout: number;
  maxRetries: number;
}

export interface ConnectionStrategy {
  useTLS: boolean;
  port: number;
  label: string;
}

@Injectable()
export class ReviewCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReviewCacheService.name);
  private readonly fallbackCache = new Map<string, CacheItem>();
  private cleanupInterval?: NodeJS.Timeout | undefined;
  private readonly stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
  };

  // Configuration
  private readonly DEFAULT_TTL = 3600; // 1 hour
  private readonly MAX_MEMORY_CACHE_SIZE = 1000;
  private readonly CACHE_KEY_PREFIX = 'review:';
  private readonly ESTABLISHMENT_KEY_PREFIX = 'establishment:reviews:';
  private readonly USER_KEY_PREFIX = 'user:reviews:';

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    void this.configService;
    this.logger.log('✅ ReviewCacheService initialized with shared RedisService');
  }

  onModuleInit(): void {
    this.startCleanupInterval();
  }

  onModuleDestroy(): void {
    try {
      // Clear cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = undefined;
      }
    } catch (error) {
      this.logger.warn('Error during cleanup:', error);
    } finally {
      this.fallbackCache.clear();
    }
  }

  /**
   * Get Redis client from shared service
   */
  private async getRedisClient(): Promise<RedisClient | null> {
    try {
      if (!this.redisService.isConnected()) {
        return null;
      }
      return await this.redisService.getClient();
    } catch {
      this.logger.warn('Failed to get Redis client, using in-memory fallback');
      return null;
    }
  }

  /**
   * Cache a review with optional TTL
   */
  async cacheReview(review: ReviewDocument, ttl: number = this.DEFAULT_TTL): Promise<void> {
    try {
      const cachedReview = this.serializeReview(review, ttl);
      const key = this.getReviewKey(review._id.toString());
      const redisClient = await this.getRedisClient();

      if (redisClient) {
        await this.cacheInRedis(key, cachedReview, ttl);
      } else {
        this.cacheInMemory(key, cachedReview, ttl);
      }

      // Cache additional indexes for fast lookups
      await this.updateCacheIndexes(review);

      this.stats.sets++;
      this.logger.debug(`Cached review ${review._id} with TTL ${ttl}s`);
    } catch (error) {
      this.logger.error(`Failed to cache review ${review._id}:`, error);
      throw error;
    }
  }

  /**
   * Get cached review by ID
   */
  async getCachedReview(id: string): Promise<CachedReview | null> {
    try {
      const key = this.getReviewKey(id);
      let cachedData: string | null = null;
      const redisClient = await this.getRedisClient();

      if (redisClient) {
        cachedData = await redisClient.get(key);
      } else {
        const item = this.fallbackCache.get(key);
        if (item && !this.isExpired(item)) {
          cachedData = item.data;
        } else if (item) {
          this.fallbackCache.delete(key); // Clean up expired item
        }
      }

      if (cachedData) {
        this.stats.hits++;
        const review = JSON.parse(cachedData) as CachedReview;

        // Update view metrics if needed
        await this.incrementViewCount(id);

        this.logger.debug(`Cache hit for review ${id}`);
        return review;
      }
      this.stats.misses++;
      this.logger.debug(`Cache miss for review ${id}`);
      return null;
    } catch (error) {
      this.logger.error(`Failed to get cached review ${id}:`, error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Invalidate specific review cache
   */
  async invalidateReviewCache(id: string): Promise<void> {
    try {
      const key = this.getReviewKey(id);

      const redisClient = await this.getRedisClient();
      if (redisClient) {
        await redisClient.del(key);
      } else {
        this.fallbackCache.delete(key);
      }

      this.stats.deletes++;
      this.logger.debug(`Invalidated cache for review ${id}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate cache for review ${id}:`, error);
    }
  }

  /**
   * Invalidate all reviews for an establishment
   */
  async invalidateEstablishmentReviews(establishmentId: string): Promise<void> {
    try {
      const pattern = `${this.ESTABLISHMENT_KEY_PREFIX}${establishmentId}:*`;

      const redisClient = await this.getRedisClient();
      if (redisClient) {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.del(keys);
        }
      } else {
        // For in-memory cache, we need to iterate and find matching keys
        const keysToDelete: string[] = [];
        this.fallbackCache.forEach((_value, key) => {
          if (key.includes(`establishment:${establishmentId}`)) {
            keysToDelete.push(key);
          }
        });
        keysToDelete.forEach(key => this.fallbackCache.delete(key));
      }

      this.logger.debug(`Invalidated all cached reviews for establishment ${establishmentId}`);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate establishment reviews for ${establishmentId}:`,
        error,
      );
    }
  }

  /**
   * Invalidate all reviews by a user
   */
  async invalidateUserReviews(userId: string): Promise<void> {
    try {
      const pattern = `${this.USER_KEY_PREFIX}${userId}:*`;

      const redisClient = await this.getRedisClient();
      if (redisClient) {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.del(keys);
        }
      } else {
        const keysToDelete: string[] = [];
        this.fallbackCache.forEach((_value, key) => {
          if (key.includes(`user:${userId}`)) {
            keysToDelete.push(key);
          }
        });
        keysToDelete.forEach(key => this.fallbackCache.delete(key));
      }

      this.logger.debug(`Invalidated all cached reviews for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate user reviews for ${userId}:`, error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    const size = this.redisService.isConnected() ? 0 : this.fallbackCache.size; // Redis size would need separate tracking
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      deletes: this.stats.deletes,
      size,
      hitRate: Math.round(hitRate * 100) / 100,
    };
  }

  /**
   * Warm up cache with frequently accessed reviews
   */
  async warmUpCache(reviews: ReviewDocument[]): Promise<void> {
    try {
      const cachePromises = reviews.map(async review => {
        await this.cacheReview(review, this.DEFAULT_TTL * 2); // Longer TTL for warmed cache
      });

      await Promise.allSettled(cachePromises);
      this.logger.log(`Warmed up cache with ${reviews.length} reviews`);
    } catch (error) {
      this.logger.error('Failed to warm up cache:', error);
    }
  }

  /**
   * Clear all cache entries
   */
  async clearCache(): Promise<void> {
    try {
      const redisClient = await this.getRedisClient();
      if (redisClient) {
        const keys = await redisClient.keys(`${this.CACHE_KEY_PREFIX}*`);
        if (keys.length > 0) {
          await redisClient.del(keys);
        }
      } else {
        this.fallbackCache.clear();
      }

      // Reset stats
      this.stats.hits = 0;
      this.stats.misses = 0;
      this.stats.sets = 0;
      this.stats.deletes = 0;

      this.logger.log('Cache cleared successfully');
    } catch (error) {
      this.logger.error('Failed to clear cache:', error);
    }
  }

  // Private helper methods

  private serializeReview(review: ReviewDocument, ttl: number): CachedReview {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    return {
      id: review._id.toString(),
      establishmentId: review.establishmentId.toString(),
      reviewerId: review.reviewerId.toString(),
      overallRating: review.overallRating,
      comment: review.comment,
      title: review.title,
      status: review.status,
      sentimentAnalysis: review.sentimentAnalysis,
      metrics: {
        helpfulCount: review.metrics.helpfulCount,
        notHelpfulCount: review.metrics.notHelpfulCount,
        viewCount: review.metrics.viewCount,
      },
      createdAt: review.createdAt ?? now,
      updatedAt: review.updatedAt ?? now,
      cachedAt: now,
      expiresAt,
    };
  }

  private async cacheInRedis(key: string, review: CachedReview, ttl: number): Promise<void> {
    const redisClient = await this.getRedisClient();
    if (redisClient) {
      await redisClient.setEx(key, ttl, JSON.stringify(review));
    }
  }

  private cacheInMemory(key: string, review: CachedReview, _ttl: number): void {
    // Implement LRU eviction if cache is full
    if (this.fallbackCache.size >= this.MAX_MEMORY_CACHE_SIZE) {
      this.evictOldestEntries();
    }

    const item: CacheItem = {
      data: JSON.stringify(review),
      expiresAt: review.expiresAt.getTime(),
      createdAt: Date.now(),
    };

    this.fallbackCache.set(key, item);
  }

  private async updateCacheIndexes(review: ReviewDocument): Promise<void> {
    try {
      const reviewId = review._id.toString();
      const establishmentId = review.establishmentId.toString();
      const reviewerId = review.reviewerId.toString();

      // Create index keys for fast lookups
      const establishmentKey = `${this.ESTABLISHMENT_KEY_PREFIX}${establishmentId}`;
      const userKey = `${this.USER_KEY_PREFIX}${reviewerId}`;
      const ratingKey = `rating:${review.overallRating}:reviews`;
      const statusKey = `status:${review.status}:reviews`;

      const redisClient = await this.getRedisClient();
      if (redisClient) {
        // Use Redis pipeline for atomic operations
        const pipeline = redisClient.multi();

        // Add review to establishment's review set
        pipeline.sAdd(establishmentKey, reviewId);
        pipeline.expire(establishmentKey, this.DEFAULT_TTL * 2); // Longer TTL for indexes

        // Add review to user's review set
        pipeline.sAdd(userKey, reviewId);
        pipeline.expire(userKey, this.DEFAULT_TTL * 2);

        // Add review to rating-based index
        pipeline.sAdd(ratingKey, reviewId);
        pipeline.expire(ratingKey, this.DEFAULT_TTL * 2);

        // Add review to status-based index
        pipeline.sAdd(statusKey, reviewId);
        pipeline.expire(statusKey, this.DEFAULT_TTL * 2);

        // Add metadata for quick stats
        const statsKey = `stats:establishment:${establishmentId}`;
        pipeline.hIncrBy(statsKey, 'total_reviews', 1);
        pipeline.hIncrBy(statsKey, `rating_${review.overallRating}`, 1);
        pipeline.expire(statsKey, this.DEFAULT_TTL * 2);

        // Execute all operations atomically
        await pipeline.exec();

        this.logger.debug(
          `Updated cache indexes for review ${reviewId}: establishment=${establishmentId}, user=${reviewerId}`,
        );
      } else {
        // Fallback for in-memory cache - store index mappings
        const establishmentIndexKey = `index:${establishmentKey}`;
        const userIndexKey = `index:${userKey}`;

        this.fallbackCache.set(establishmentIndexKey, {
          data: JSON.stringify([reviewId]),
          expiresAt: Date.now() + this.DEFAULT_TTL * 2 * 1000,
          createdAt: Date.now(),
        });

        this.fallbackCache.set(userIndexKey, {
          data: JSON.stringify([reviewId]),
          expiresAt: Date.now() + this.DEFAULT_TTL * 2 * 1000,
          createdAt: Date.now(),
        });

        this.logger.debug(`Updated fallback cache indexes for review ${reviewId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to update cache indexes for review ${review._id}:`, error);
      // Don't throw - indexing failure shouldn't break the main cache operation
    }
  }

  private async incrementViewCount(reviewId: string): Promise<void> {
    try {
      const viewCountKey = `view_count:${reviewId}`;
      const dailyViewKey = `daily_views:${reviewId}:${this.getDayKey()}`;
      const cacheKey = this.getReviewKey(reviewId);

      const redisClient = await this.getRedisClient();
      if (redisClient) {
        // Use Redis pipeline for atomic operations
        const pipeline = redisClient.multi();

        // Increment total view count
        pipeline.hIncrBy(viewCountKey, 'total', 1);
        pipeline.expire(viewCountKey, this.DEFAULT_TTL * 7); // Week-long retention

        // Track daily views for analytics
        pipeline.incr(dailyViewKey);
        pipeline.expire(dailyViewKey, 86400); // 24 hours

        // Update the cached review's view count if it exists
        const cachedReview = await redisClient.get(cacheKey);
        if (cachedReview && typeof cachedReview === 'string') {
          try {
            const review = JSON.parse(cachedReview) as unknown as CachedReview;
            review.metrics.viewCount += 1;

            // Update the cached review with new view count
            const ttl = await redisClient.ttl(cacheKey);
            pipeline.setEx(cacheKey, ttl > 0 ? ttl : this.DEFAULT_TTL, JSON.stringify(review));
          } catch (parseError) {
            this.logger.warn(
              `Failed to parse cached review for view count update: ${reviewId}`,
              parseError,
            );
          }
        }

        // Execute all operations atomically
        await pipeline.exec();

        this.logger.debug(`Incremented view count for review ${reviewId} (Redis)`);
      } else {
        // Fallback for in-memory cache
        const viewCountItem = this.fallbackCache.get(viewCountKey);
        let totalViews = 1;

        if (viewCountItem && !this.isExpired(viewCountItem)) {
          try {
            const viewData: unknown = JSON.parse(viewCountItem.data);
            const parsedTotal =
              typeof viewData === 'object' &&
              viewData !== null &&
              typeof (viewData as Record<string, unknown>)['total'] === 'number'
                ? ((viewData as Record<string, unknown>)['total'] as number)
                : 0;
            totalViews = parsedTotal + 1;
          } catch (parseError) {
            this.logger.warn(`Failed to parse view count data for review ${reviewId}`, parseError);
          }
        }

        // Store updated view count
        this.fallbackCache.set(viewCountKey, {
          data: JSON.stringify({ total: totalViews }),
          expiresAt: Date.now() + this.DEFAULT_TTL * 7 * 1000,
          createdAt: Date.now(),
        });

        // Update cached review if it exists
        const cachedItem = this.fallbackCache.get(cacheKey);
        if (cachedItem && !this.isExpired(cachedItem)) {
          try {
            const review = JSON.parse(cachedItem.data) as unknown as CachedReview;
            review.metrics.viewCount += 1;

            // Update the cached review
            this.fallbackCache.set(cacheKey, {
              ...cachedItem,
              data: JSON.stringify(review),
            });
          } catch (parseError) {
            this.logger.warn(`Failed to update cached review view count: ${reviewId}`, parseError);
          }
        }

        this.logger.debug(`Incremented view count for review ${reviewId} (Memory fallback)`);
      }
    } catch (error) {
      this.logger.error(`Failed to increment view count for review ${reviewId}:`, error);
      // Don't throw - view count failure shouldn't break the cache retrieval
    }
  }

  /**
   * Get current day key for daily analytics
   */
  private getDayKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  private getReviewKey(id: string): string {
    return `${this.CACHE_KEY_PREFIX}${id}`;
  }

  private isExpired(item: CacheItem): boolean {
    return Date.now() > item.expiresAt;
  }

  private evictOldestEntries(): void {
    // Simple LRU eviction - remove 10% of oldest entries
    const entries = Array.from(this.fallbackCache.entries()).sort(
      ([, a], [, b]) => a.createdAt - b.createdAt,
    );

    const toEvict = Math.floor(entries.length * 0.1);
    for (let i = 0; i < toEvict; i++) {
      const entry = entries[i];
      if (entry) {
        this.fallbackCache.delete(entry[0]);
      }
    }

    this.logger.debug(`Evicted ${toEvict} old cache entries`);
  }

  private startCleanupInterval(): void {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        if (!this.redisService.isConnected()) {
          // Redis handles TTL automatically
          this.cleanupExpiredEntries();
        }
      },
      5 * 60 * 1000,
    );
  }

  private cleanupExpiredEntries(): void {
    let cleanedCount = 0;
    for (const [key, item] of Array.from(this.fallbackCache.entries())) {
      if (this.isExpired(item)) {
        this.fallbackCache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired cache entries`);
    }
  }
}

interface CacheItem {
  data: string;
  expiresAt: number;
  createdAt: number;
}
