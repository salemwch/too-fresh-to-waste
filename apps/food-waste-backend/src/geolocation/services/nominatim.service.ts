import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
  HttpException,
  HttpStatus,
  OnModuleInit,
  OnModuleDestroy
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { setTimeout } from 'timers/promises';
import {
  INominatimService,
  INominatimSearchRequest,
  INominatimReverseRequest,
  NominatimGeocodingResult,
  NominatimReverseGeocodingResult,
  NominatimSearchResult,
  NominatimReverseResult,
  NominatimConfig,
  NominatimUsageStats,
  NominatimCacheEntry,
  NominatimSearchParams,
  NominatimReverseParams,
  NominatimError
} from '../interfaces/nominatim.interface';
import { GeocodingAccuracy, GeoCoordinate, AddressInfo } from '../interfaces/geolocation.interface';

@Injectable()
export class NominatimService implements INominatimService, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NominatimService.name);
  private readonly config: NominatimConfig;
  private readonly cache = new Map<string, NominatimCacheEntry>();
  private readonly rateLimitQueue: Array<{ resolve: Function; reject: Function; timestamp: number }> = [];
  private rateLimitTimer?: ReturnType<typeof setInterval>;
  private readonly stats: NominatimUsageStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    rateLimitHits: 0,
    cacheHits: 0,
    cacheMisses: 0,
    healthStatus: 'healthy'
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.config = {
      baseUrl: this.configService.get<string>('NOMINATIM_BASE_URL', 'https://nominatim.openstreetmap.org'),
      userAgent: this.configService.get<string>('NOMINATIM_USER_AGENT', 'RescueEats-App/1.0 (https://rescueeats.com; contact@rescueeats.com)'),
      timeout: this.configService.get<number>('NOMINATIM_TIMEOUT', 10000),
      retryAttempts: this.configService.get<number>('NOMINATIM_RETRY_ATTEMPTS', 3),
      retryDelay: this.configService.get<number>('NOMINATIM_RETRY_DELAY', 1000),
      rateLimit: {
        requestsPerSecond: this.configService.get<number>('NOMINATIM_REQUESTS_PER_SECOND', 1),
        burstSize: this.configService.get<number>('NOMINATIM_BURST_SIZE', 5)
      },
      defaultLanguage: this.configService.get<string>('NOMINATIM_DEFAULT_LANGUAGE', 'en'),
      defaultCountryCodes: this.configService.get<string>('NOMINATIM_DEFAULT_COUNTRIES')?.split(','),
      enableCaching: this.configService.get<boolean>('NOMINATIM_ENABLE_CACHE', true),
      cacheTtl: this.configService.get<number>('NOMINATIM_CACHE_TTL', 3600000) // 1 hour in ms
    };
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing Nominatim service...');
    this.startRateLimitProcessor();
    await this.healthCheck();
  }

  onModuleDestroy(): void {
    try {
      if (this.rateLimitTimer) {
        clearInterval(this.rateLimitTimer);
      }
      this.cache.clear();
      this.logger.log('Nominatim service destroyed');
    } catch (error) {
      this.logger.warn('Error during Nominatim service cleanup:', error);
      // Don't rethrow - we're shutting down anyway
    }
  }

  /**
   * Search for addresses/places using Nominatim
   */
  async search(params: INominatimSearchRequest): Promise<NominatimGeocodingResult[]> {
    const startTime = Date.now();
    try {
      // Validate input parameters
      this.validateSearchParams(params);

      // Generate cache key
      const cacheKey = this.generateCacheKey('search', params);
      // Check cache first
      if (this.config.enableCaching) {
        const cachedResult = this.getFromCache(cacheKey);
        if (cachedResult) {
          this.stats.cacheHits++;
          this.logger.debug(`Cache hit for search: ${cacheKey}`);
          return cachedResult;
        }
        this.stats.cacheMisses++;
      }

      // Build search parameters
      const searchParams = this.buildSearchParams(params);

      // Execute search with rate limiting and retries
      const response = await this.executeRequest<NominatimSearchResult[]>('/search', searchParams);
      // Transform results
      const results = this.transformSearchResults(response);

      // Cache results
      if (this.config.enableCaching && results.length > 0) {
        this.setCache(cacheKey, results);
      }

      // Update stats
      this.updateStats(startTime, true);
      this.logger.log(`Successfully geocoded: ${params.address || 'structured address'} - ${results.length} results`);
      return results;

    } catch (error) {
      this.updateStats(startTime, false);
      this.handleError('search', error, params);
      throw error;
    }
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverse(params: INominatimReverseRequest): Promise<NominatimReverseGeocodingResult> {
    const startTime = Date.now();
    try {
      // Validate coordinates
      this.validateCoordinates(params.coordinates);

      // Generate cache key
      const cacheKey = this.generateCacheKey('reverse', params);
      // Check cache first
      if (this.config.enableCaching) {
        const cachedResult = this.getFromCache(cacheKey);
        if (cachedResult) {
          this.stats.cacheHits++;
          this.logger.debug(`Cache hit for reverse: ${cacheKey}`);
          return cachedResult;
        }
        this.stats.cacheMisses++;
      }

      // Build reverse parameters
      const reverseParams = this.buildReverseParams(params);

      // Execute reverse geocoding
      const response = await this.executeRequest<NominatimReverseResult>('/reverse', reverseParams);

      // Transform result
      const result = this.transformReverseResult(response);

      // Cache result
      if (this.config.enableCaching) {
        this.setCache(cacheKey, result);
      }

      // Update stats
      this.updateStats(startTime, true);
      this.logger.log(`Successfully reverse geocoded: ${params.coordinates.latitude},${params.coordinates.longitude}`);

      return result;

    } catch (error) {
      this.updateStats(startTime, false);
      this.handleError('reverse', error, params);
      throw error;
    }
  }

  /**
   * Check if the Nominatim service is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const testParams: INominatimSearchRequest = {
        city: 'Paris',
        country: 'France',
        limit: 1
      };

      const results = await this.search(testParams);
      const isHealthy = results.length > 0;

      this.stats.healthStatus = isHealthy ? 'healthy' : 'degraded';
      return isHealthy;
    } catch (error) {
      this.stats.healthStatus = 'unhealthy';
      this.logger.error('Nominatim health check failed:', error);
      return false;
    }
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): NominatimUsageStats {
    return { ...this.stats };
  }

  /**
   * Execute HTTP request with rate limiting and retries
   */
  private async executeRequest<T>(endpoint: string, params: Record<string, any>): Promise<T> {
    await this.waitForRateLimit();

    let lastError: any;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const url = `${this.config.baseUrl}${endpoint}`;

        const response = await firstValueFrom(
          this.httpService.get<T>(url, {
            params: {
              ...params,
              format: 'json',
              addressdetails: 1,
              extratags: 0,
              namedetails: 0
            },
            headers: {
              'User-Agent': this.config.userAgent,
              'Accept': 'application/json',
              'Accept-Language': params['accept-language'] || this.config.defaultLanguage
            },
            timeout: this.config.timeout
          })
        );

        this.stats.totalRequests++;
        this.stats.lastRequestTime = new Date();

        // Check for Nominatim-specific errors
        if (this.isNominatimError(response.data)) {
          throw new BadRequestException((response.data as NominatimError).message);
        }

        return response.data;

      } catch (error: any) {
        lastError = error;
        this.logger.warn(`Nominatim request attempt ${attempt} failed:`, error);

        // Don't retry on client errors (4xx)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          break;
        }

        // Wait before retry
        if (attempt < this.config.retryAttempts) {
          await setTimeout(this.config.retryDelay * attempt);
        }
      }
    }

    throw lastError;
  }

  /**
   * Rate limiting implementation
   */
  private waitForRateLimit(): Promise<void> {
    return new Promise((resolve, reject) => {
      const now = Date.now();

      // Clean old requests from queue
      while (this.rateLimitQueue.length > 0 &&
             now - this.rateLimitQueue[0].timestamp > 1000) {
        this.rateLimitQueue.shift();
      }

      // Check if we can process immediately
      if (this.rateLimitQueue.length < this.config.rateLimit.burstSize) {
        this.rateLimitQueue.push({ resolve, reject, timestamp: now });
        resolve();
        return;
      }

      // Add to queue and increment rate limit hits
      this.stats.rateLimitHits++;
      this.rateLimitQueue.push({ resolve, reject, timestamp: now });
    });
  }

  /**
   * Process rate limit queue
   */
  private startRateLimitProcessor(): void {
    const intervalMs = 1000 / this.config.rateLimit.requestsPerSecond;

    this.rateLimitTimer = setInterval(() => {
      if (this.rateLimitQueue.length === 0) {return;}

      const request = this.rateLimitQueue.shift();
      if (request) {
        request.resolve();
      }
    }, intervalMs);
  }

  /**
   * Build search parameters for Nominatim API
   */
  private buildSearchParams(params: INominatimSearchRequest): NominatimSearchParams {
    const searchParams: NominatimSearchParams = {
      limit: Math.min(params.limit || 10, 50),
      'accept-language': params.language || this.config.defaultLanguage,
      addressdetails: 1,
      extratags: params.includeExtraTags ? 1 : 0,
      namedetails: 0,
      dedupe: 1
    };

    // Add country restriction if specified
    if (params.countryCode || this.config.defaultCountryCodes) {
      const codes = params.countryCode ?
        [params.countryCode] :
        this.config.defaultCountryCodes!;
      searchParams.countrycodes = codes.join(',');
    }

    // Use structured search if components are provided
    if (params.street || params.city || params.state || params.country || params.postalCode) {
      if (params.street) {searchParams.street = params.street;}
      if (params.city) {searchParams.city = params.city;}
      if (params.state) {searchParams.state = params.state;}
      if (params.country) {searchParams.country = params.country;}
      if (params.postalCode) {searchParams.postalcode = params.postalCode;}
    } else if (params.address) {
      searchParams.q = params.address;
    }

    // Add bounding box if specified
    if (params.bounds) {
      searchParams.viewbox = params.bounds.viewbox;
      searchParams.bounded = params.bounds.bounded ? 1 : 0;
    }

    // Add polygon information if requested
    if (params.includePolygon) {
      searchParams.polygon_geojson = 1;
    }

    return searchParams;
  }

  /**
   * Build reverse parameters for Nominatim API
   */
  private buildReverseParams(params: INominatimReverseRequest): NominatimReverseParams {
    return {
      lat: params.coordinates.latitude,
      lon: params.coordinates.longitude,
      zoom: params.zoom || 18,
      'accept-language': params.language || this.config.defaultLanguage,
      addressdetails: params.includeAddress !== false ? 1 : 0,
      extratags: params.includeExtraTags ? 1 : 0,
      namedetails: 0
    };
  }

  /**
   * Transform Nominatim search results to standard format
   */
  private transformSearchResults(results: NominatimSearchResult[]): NominatimGeocodingResult[] {
    return results.map(result => ({
      coordinates: {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon)
      },
      address: this.extractAddressInfo(result.address, result.display_name),
      bounds: result.boundingbox ? {
        northeast: {
          latitude: parseFloat(result.boundingbox[1]),
          longitude: parseFloat(result.boundingbox[3])
        },
        southwest: {
          latitude: parseFloat(result.boundingbox[0]),
          longitude: parseFloat(result.boundingbox[2])
        }
      } : undefined,
      accuracy: this.determineAccuracy(result),
      provider: 'nominatim',
      raw: result,
      placeId: result.place_id,
      osmType: result.osm_type,
      osmId: result.osm_id,
      category: result.category,
      type: result.type,
      importance: result.importance,
      displayName: result.display_name
    }));
  }

  /**
   * Transform Nominatim reverse result to standard format
   */
  private transformReverseResult(result: NominatimReverseResult): NominatimReverseGeocodingResult {
    return {
      coordinates: {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon)
      },
      address: this.extractAddressInfo(result.address, result.display_name),
      provider: 'nominatim',
      raw: result,
      placeId: result.place_id,
      osmType: result.osm_type,
      osmId: result.osm_id,
      category: result.category,
      type: result.type,
      importance: result.importance,
      displayName: result.display_name
    };
  }

  /**
   * Extract address information from Nominatim response
   */
  private extractAddressInfo(address: any, displayName: string): AddressInfo {
    if (!address) {
      return {
        city: 'Unknown',
        postalCode: '',
        country: 'Unknown',
        formattedAddress: displayName
      };
    }

    const street = [address.house_number, address.road]
      .filter(Boolean)
      .join(' ') || address.pedestrian || address.footway || '';

    const city = address.city ||
                address.town ||
                address.village ||
                address.hamlet ||
                address.suburb ||
                address.neighbourhood || '';

    return {
      street: street || undefined,
      city: city || 'Unknown',
      postalCode: address.postcode || '',
      country: address.country || 'Unknown',
      formattedAddress: displayName
    };
  }

  /**
   * Determine geocoding accuracy based on Nominatim result
   */
  private determineAccuracy(result: NominatimSearchResult): GeocodingAccuracy {
    // Nominatim uses place_rank to indicate precision
    // Lower values = less precise, higher values = more precise
    if (result.place_rank >= 28) {
      return GeocodingAccuracy.ROOFTOP;
    } else if (result.place_rank >= 26) {
      return GeocodingAccuracy.RANGE_INTERPOLATED;
    } else if (result.place_rank >= 20) {
      return GeocodingAccuracy.GEOMETRIC_CENTER;
    } else {
      return GeocodingAccuracy.APPROXIMATE;
    }
  }

  /**
   * Generate cache key for request parameters
   */
  private generateCacheKey(operation: string, params: any): string {
    const paramsStr = JSON.stringify(params, Object.keys(params).sort());
    return `${operation}:${Buffer.from(paramsStr).toString('base64')}`;
  }

  /**
   * Get item from cache
   */
  private getFromCache(key: string): any {
    const entry = this.cache.get(key);
    if (!entry) {return null;}

    if (entry.expiresAt < new Date()) {
      this.cache.delete(key);
      return null;
    }

    entry.accessCount++;
    entry.lastAccessed = new Date();
    return entry.data;
  }

  /**
   * Set item in cache
   */
  private setCache(key: string, data: any): void {
    const now = new Date();
    const entry: NominatimCacheEntry = {
      key,
      data,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.config.cacheTtl),
      accessCount: 0,
      lastAccessed: now
    };

    this.cache.set(key, entry);

    // Implement simple cache eviction (LRU-like)
    if (this.cache.size > 1000) {
      this.evictOldestCacheEntries();
    }
  }

  /**
   * Evict oldest cache entries
   */
  private evictOldestCacheEntries(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime());

    // Remove oldest 10% of entries
    const toRemove = Math.floor(entries.length * 0.1);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Validate search parameters
   */
  private validateSearchParams(params: INominatimSearchRequest): void {
    if (!params.address && !params.street && !params.city && !params.country) {
      throw new BadRequestException('At least one search parameter must be provided');
    }

    if (params.limit && (params.limit < 1 || params.limit > 50)) {
      throw new BadRequestException('Limit must be between 1 and 50');
    }
  }

  /**
   * Validate coordinates
   */
  private validateCoordinates(coordinates: GeoCoordinate): void {
    if (!coordinates ||
        typeof coordinates.latitude !== 'number' ||
        typeof coordinates.longitude !== 'number') {
      throw new BadRequestException('Invalid coordinates');
    }

    if (coordinates.latitude < -90 || coordinates.latitude > 90) {
      throw new BadRequestException('Latitude must be between -90 and 90');
    }

    if (coordinates.longitude < -180 || coordinates.longitude > 180) {
      throw new BadRequestException('Longitude must be between -180 and 180');
    }
  }

  /**
   * Check if response is a Nominatim error
   */
  private isNominatimError(data: any): data is NominatimError {
    return data && typeof data === 'object' && 'error' in data;
  }

  /**
   * Update usage statistics
   */
  private updateStats(startTime: number, success: boolean): void {
    const responseTime = Date.now() - startTime;

    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }

    // Update average response time
    const totalRequests = this.stats.successfulRequests + this.stats.failedRequests;
    this.stats.averageResponseTime =
      (this.stats.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
  }

  /**
   * Handle errors with proper logging and context
   */
  private handleError(operation: string, error: any, params: any): void {
    const context = {
      operation,
      params: JSON.stringify(params),
      error: error?.message || 'Unknown error'
    };

    if (error?.response?.status === 429) {
      this.logger.warn('Nominatim rate limit exceeded', context);
      throw new ServiceUnavailableException('Geocoding service temporarily unavailable due to rate limiting');
    }

    if (error?.response?.status >= 500) {
      this.logger.error('Nominatim server error', context);
      throw new ServiceUnavailableException('Geocoding service temporarily unavailable');
    }

    if (error?.response?.status >= 400) {
      this.logger.warn('Nominatim client error', context);
      throw new BadRequestException(`Geocoding request failed: ${error?.response?.data?.error || error?.message}`);
    }

    this.logger.error('Nominatim service error', context);
    throw new HttpException(
      'Geocoding service error',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }

  /**
   * Perform health check
   */
  private async healthCheck(): Promise<void> {
    try {
      const isHealthy = await this.isHealthy();
      this.logger.log(`Nominatim service health check: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
    } catch (error) {
      this.logger.error('Nominatim health check failed:', error);
    }
  }
}