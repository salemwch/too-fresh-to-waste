import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { CacheService } from '../../common/services/cache.service';
import { GeoCache } from '../schemas/place-cache.schema';

import {
  GooglePlacesService,
  GoogleAutocompleteSuggestion,
  GoogleLocationResult,
} from './google-places.service';

const REDIS_TTL = 3600; // 1 hour
const MONGO_TTL_AUTOCOMPLETE_MS = 7 * 24 * 3600 * 1000; // 7 days
const MONGO_TTL_DETAILS_MS = 30 * 24 * 3600 * 1000; // 30 days

interface GeoCacheDoc {
  _id: unknown;
  key: string;
  type: string;
  data: Record<string, unknown>;
  expiresAt: Date;
}

@Injectable()
export class GeoCacheService {
  private readonly logger = new Logger(GeoCacheService.name);

  constructor(
    private readonly cacheService: CacheService,
    @InjectModel(GeoCache.name)
    private readonly geoCacheModel: Model<GeoCache>,
    private readonly googlePlacesService: GooglePlacesService,
  ) {}

  async autocomplete(
    query: string,
    sessionToken?: string,
    limit?: number,
  ): Promise<GoogleAutocompleteSuggestion[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const key = this.normalize(query);
    const redisKey = `geo:ac:${key}`;

    const cached = await this.cacheService.get<GoogleAutocompleteSuggestion[]>(redisKey);
    if (cached !== null) {
      return cached;
    }

    const doc = await this.findMongo(key, 'autocomplete');
    if (doc) {
      const suggestions = doc.data as unknown as GoogleAutocompleteSuggestion[];
      await this.cacheService.set(redisKey, suggestions, REDIS_TTL);
      return suggestions;
    }

    const suggestions = await this.googlePlacesService.autocomplete(query, sessionToken, limit);

    if (suggestions.length > 0) {
      await this.storeMongo(key, 'autocomplete', suggestions, MONGO_TTL_AUTOCOMPLETE_MS);
      await this.cacheService.set(redisKey, suggestions, REDIS_TTL);
    }

    return suggestions;
  }

  async getPlaceDetailsById(
    placeId: string,
    sessionToken?: string,
  ): Promise<GoogleLocationResult | null> {
    if (!placeId || placeId.trim().length === 0) {
      return null;
    }

    const redisKey = `geo:pd:${placeId}`;

    const cached = await this.cacheService.get<GoogleLocationResult>(redisKey);
    if (cached !== null) {
      return cached;
    }

    const doc = await this.findMongo(placeId, 'details');
    if (doc) {
      const details = doc.data as unknown as GoogleLocationResult;
      await this.cacheService.set(redisKey, details, REDIS_TTL);
      return details;
    }

    const details = await this.googlePlacesService.getPlaceDetailsById(placeId, sessionToken);

    if (details) {
      await this.storeMongo(placeId, 'details', details, MONGO_TTL_DETAILS_MS);
      await this.cacheService.set(redisKey, details, REDIS_TTL);
    }

    return details;
  }

  private normalize(query: string): string {
    return query.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  private async findMongo(key: string, type: string): Promise<GeoCacheDoc | null> {
    try {
      return await this.geoCacheModel.findOne({ key, type }).lean<GeoCacheDoc>().exec();
    } catch (err) {
      this.logger.warn(`Mongo geo cache lookup failed: ${(err as Error).message}`);
      return null;
    }
  }

  private async storeMongo(key: string, type: string, data: unknown, ttlMs: number): Promise<void> {
    try {
      await this.geoCacheModel.updateOne(
        { key, type },
        { $set: { data, expiresAt: new Date(Date.now() + ttlMs) } },
        { upsert: true },
      );
    } catch (err) {
      this.logger.warn(`Mongo geo cache store failed: ${(err as Error).message}`);
    }
  }
}
