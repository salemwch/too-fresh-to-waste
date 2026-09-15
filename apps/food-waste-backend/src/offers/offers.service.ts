import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Connection, Model, Types, isValidObjectId, PipelineStage, FlattenMaps } from 'mongoose';

import { UserRole } from '@foodwaste/shared';
import { CronLockName, CronLockTtl } from '../common/constants/cron-lock.constant';
import { CacheService } from '../common/services/cache.service';
import { CronLockService } from '../common/services/cron-lock.service';
import { AppLoggerService } from '../common/services/logger.service';
import { TimezoneUtil } from '../common/utils/timezone.util';
import { EstablishmentsService } from '../establishments/establishments.service';
import { StreakService } from '../sustainability/services/streak.service';
import {
  EstablishmentDocument,
  EstablishmentStatus,
  EstablishmentType,
} from '../establishments/schemas/establishment.schema';

import {
  MIN_EXISTENCE_MS,
  URGENCY_THRESHOLD_MS,
  AUTO_FEATURE_ENABLED,
  AUTO_FEATURE_CRON_SCHEDULE,
  MIN_EXISTENCE_HOURS,
  URGENCY_THRESHOLD_HOURS,
} from './config/featuring.config';
import { CreateOfferDto } from './DTO/create-offer.dto';
import { OfferCardDto } from './DTO/offer-list.dto';
import { ReactivateOfferDto } from './DTO/reactivate-offer.dto';
import { SearchOffersDto, OfferSortField } from './DTO/search-offers.dto';
import { UpdateOfferDto } from './DTO/update-offer.dto';
import { OfferPresenter } from './presenters/offer.presenter';
import { resolveEstablishmentTypeFilter } from './utils/establishment-type-filter.util';
import { Offer, OfferDocument, OfferStatus, OfferType, Currency } from './schemas/offer.schema';

// OFFER_LIST_FIELDS no longer needed — aggregation pipelines select fields via $project

/**
 * Advice keys emitted by the pricing engine. The backend never sends prose —
 * each insight is a key plus numeric parameters, and the client owns the
 * wording so it can be rendered in the merchant's locale (en / fr / ar).
 */
export type PricingInsightType =
  | 'price_above_zone'
  | 'price_below_zone'
  | 'low_fill_rate'
  | 'best_day'
  | 'best_hour'
  | 'low_discount';

export interface PricingInsight {
  type: PricingInsightType;
  impact: 'high' | 'medium' | 'low';
  /** Numbers only — formatting and pluralisation belong to the locale layer. */
  params: Record<string, number>;
}

/**
 * Which population the merchant is being compared against.
 * `category_city` — same establishment type, same city (a like-for-like peer set)
 * `city`          — same city, all establishment types (fallback: too few peers)
 * `none`          — no peers at all; the comparison is suppressed rather than faked
 */
export type PricingZoneScope = 'category_city' | 'city' | 'none';

/** Where the suggested range came from, so the UI can explain itself. */
export type PricingRangeBasis = 'own_history' | 'zone';

export interface PricingSuggestions {
  merchantStats: {
    avgDiscountedPrice: number;
    avgOriginalPrice: number;
    avgDiscountPercent: number;
    fillRate: number;
    totalOffers: number;
    totalSold: number;
    bestDayOfWeek: number | null;
    bestHour: number | null;
  };
  zoneStats: {
    avgDiscountedPrice: number;
    avgFillRate: number;
    totalMerchants: number;
    scope: PricingZoneScope;
  };
  insights: PricingInsight[];
  /** `null` when there is neither own history nor a peer set to reason from. */
  suggestedPriceRange: {
    min: number;
    max: number;
    currency: string;
    basis: PricingRangeBasis;
  } | null;
  /** Lets the UI state how much evidence is behind the numbers. */
  sample: {
    windowDays: number;
    merchantOffers: number;
    merchantSoldOutOffers: number;
    peerMerchants: number;
  };
}

/** Internal shape returned by the merchant-side pricing aggregation. */
interface MerchantPricingStats {
  avgDiscountedPrice: number;
  avgOriginalPrice: number;
  avgDiscountPercent: number;
  /** Average price of offers that actually sold through. */
  avgSoldOutPrice: number;
  fillRate: number;
  totalOffers: number;
  totalSold: number;
  /** Offers that finished running (sold out or expired). */
  concludedOffers: number;
  soldOutOffers: number;
  bestDayOfWeek: number | null;
  bestHour: number | null;
}

/** Internal shape returned by the peer-comparison aggregation. */
interface ZonePricingStats {
  avgDiscountedPrice: number;
  avgFillRate: number;
  totalMerchants: number;
  scope: PricingZoneScope;
}
/**
 * Base offer properties required by presenter (minimum interface)
 * Ensures type safety while allowing flexibility for different query types
 *
 * ✅ TYPE SAFETY: Defines minimum required fields without relying on `any`
 */
interface OfferBase {
  _id: unknown;
  title: string;
  type: OfferType;
  images?: string[];
  pricing: {
    originalPrice: number;
    discountedPrice: number;
    discountPercentage: number;
    currency: Currency;
  };
  totalQuantity: number;
  soldQuantity: number;
  reservedQuantity: number;
  availableFrom: Date;
  availableUntil: Date;
  pickupTimeSlots?: Array<{
    startTime: string;
    endTime: string;
  }>;
  status: OfferStatus;
  establishmentId?: unknown;
  merchantId?: unknown;
  isFeaturedManual?: boolean;
  isFeaturedAuto?: boolean;
  featuredAt?: Date;
  isPickupToday?: boolean;
  isPickupTomorrow?: boolean;
}

/**
 * Lean result type for Offer documents
 * Combines Mongoose lean results with optional aggregation fields
 *
 * ✅ TYPE SAFETY: Union of FlattenMaps and OfferBase for maximum compatibility
 */
export type OfferLean = (FlattenMaps<OfferDocument> | OfferBase) & {
  distance?: number;
};

// Core business interfaces for type safety
interface MongoQuery {
  isDeleted?: { $ne: boolean };
  status?: OfferStatus;
  isActive?: boolean;
  $text?: { $search: string };
  type?: string;
  isFeaturedManual?: boolean;
  isFeaturedAuto?: boolean;
  $or?: Array<{ isFeaturedManual?: boolean; isFeaturedAuto?: boolean }>;
  establishmentId?: Types.ObjectId;
  merchantId?: Types.ObjectId;
  categories?: { $in: string[] };
  tags?: { $in: string[] };
  'pricing.discountedPrice'?: {
    $gte?: number;
    $lte?: number;
  };
  'pricing.discountPercentage'?: { $gte: number };
  availableFrom?: { $lte: Date };
  availableUntil?: { $gte: Date } | { $lte: Date; $gte: Date };
  'establishment.address.coordinates'?: {
    $near: {
      $geometry: {
        type: 'Point';
        coordinates: [number, number];
      };
      $maxDistance: number;
    };
  };
}

interface MongoSort {
  [field: string]: 1 | -1;
}

interface AggregateCountResult {
  total: number;
}

interface OfferPricing {
  originalPrice: number;
  discountedPrice: number;
  discountPercentage: number;
  currency: Currency;
}

interface OfferPickupTimeSlot {
  startTime: string;
  endTime: string;
  maxOrders?: number | undefined; // Optional — business decides. No limit if unset.
  currentOrders?: number | undefined;
}

interface StatusUpdateData {
  status: OfferStatus;
  publishedAt?: Date;
}

/** Populated establishment reference returned by aggregation lookups */
interface PopulatedEstRef {
  _id?: Types.ObjectId;
  address?: { coordinates?: { coordinates?: number[] } };
}

interface FavoriteSignalRecord {
  type?: string;
  itemId?: Types.ObjectId | string;
  itemName?: string;
}

/**
 * A discovery page in the shape it is cached: identical for every viewer.
 *
 * ## Why this type exists
 *
 * The featured and urgent lists used to be cached under a key containing the
 * caller's `userId`, because the cards carry `isFavorite`. That made the cache
 * per-user rather than shared, and at 50k users it stops being a cache at all:
 * a session is "open the app, browse, leave", which is over long before the
 * 60–120s TTL can be reused, so nearly every home screen ran the full
 * aggregation — the exact query the cache existed to avoid. It also stored
 * ~50k near-identical copies of the same list, and made each offer mutation's
 * `delByPrefix` SCAN walk all of them.
 *
 * The fix is to cache only what every viewer shares, and compute the two
 * per-viewer fields in process:
 *
 * - `isFavorite` — from the viewer's favourite ids (one indexed query).
 * - `distance`   — pure arithmetic from `coordinates` below.
 *
 * Both are microseconds of CPU against a multi-stage `$lookup` aggregation, so
 * one cache entry now serves every user *and* every location.
 */
interface CachedOfferPage {
  /** Cards with `isFavorite` and `distance` deliberately unset. */
  data: OfferCardDto[];
  total: number;
  /**
   * `offerId -> [lng, lat]`, used only to recompute `distance` per request.
   *
   * Carried alongside the cards rather than on them because `OfferCardDto`
   * intentionally exposes no establishment address — see the privacy note on
   * that DTO. These coordinates never reach a client; they exist so the
   * location-aware variant can share the same cache entry as everyone else,
   * instead of bypassing the cache entirely as it did before.
   */
  coordinates: Record<string, [number, number]>;
}

@Injectable()
export class OffersService {
  // Cache TTL constants (seconds)
  private static readonly TTL_FEATURED = 120; // 2 min — offers change infrequently
  private static readonly TTL_URGENT = 60; // 1 min — expiry-based, time-sensitive

  constructor(
    @InjectModel(Offer.name)
    private readonly offerModel: Model<OfferDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly logger: AppLoggerService,
    private readonly establishmentsService: EstablishmentsService,
    private readonly cacheService: CacheService,
    private readonly streakService: StreakService,
    private readonly cronLock: CronLockService,
  ) {}

  /**
   * Purges cached discovery lists after an offer mutation.
   *
   * Deliberately not awaited: the offer write has already committed, and a
   * Redis hiccup must not turn a successful mutation into a 500. But the
   * rejection is caught and logged here rather than left floating — an
   * unhandled rejection reaches the global handler in `main.ts`, which
   * suppresses it, so a Redis outage would silently serve stale offer lists
   * with nothing in the logs to explain it.
   */
  private invalidateDiscoveryCaches(...prefixes: string[]): void {
    Promise.all(
      prefixes.map(async prefix => {
        await this.cacheService.delByPrefix(prefix);
      }),
    ).catch((err: unknown) => {
      this.logger.warn(
        `Offer cache invalidation failed for [${prefixes.join(', ')}]: ${String(err)}`,
        'OffersService',
      );
    });
  }

  // ============================================================================
  // PRODUCTION-GRADE: Helper for mapping offers with isFavorite field
  // ============================================================================

  /**
   * Map offers to DTOs with isFavorite field (production-grade implementation)
   * Efficiently checks favorite status using Set lookup (O(1) per offer)
   *
   * Performance:
   * - Single favorites query (O(n) where n = user's favorites count)
   * - Set lookup per offer (O(1))
   * - Total: O(n + m) where m = offers count
   *
   * @param offers - Array of offer entities (supports documents, lean results, and aggregations)
   * @param userId - Current user ID (optional, for authenticated requests)
   * @returns Array of OfferCardDto with isFavorite field
   */
  /**
   * Haversine distance in meters between two lat/lng points.
   * O(1) — pure math, no DB calls.
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6_371_000; // Earth radius in meters
    const toRad = (deg: number) => deg * (Math.PI / 180);
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private async getUserFavoriteOfferIds(userId: string): Promise<string[]> {
    const favorites = (await this.connection
      .collection('favorites')
      .find({
        userId: new Types.ObjectId(userId),
        type: 'offer',
        isActive: true,
      })
      .project({ itemId: 1 })
      .toArray()) as Array<{ itemId?: Types.ObjectId | string }>;

    return favorites.flatMap(favorite =>
      favorite.itemId !== undefined ? [favorite.itemId.toString()] : [],
    );
  }

  private async getUserFavoriteSignals(userId: string): Promise<{
    establishmentIds: string[];
    categories: string[];
  }> {
    const favorites = (await this.connection
      .collection('favorites')
      .find({
        userId: new Types.ObjectId(userId),
        isActive: true,
        type: { $in: ['establishment', 'category'] },
      })
      .project({ type: 1, itemId: 1, itemName: 1 })
      .toArray()) as FavoriteSignalRecord[];

    const establishmentIds = favorites
      .filter(favorite => favorite.type === 'establishment' && favorite.itemId !== undefined)
      .map(favorite => favorite.itemId?.toString() ?? '')
      .filter((itemId): itemId is string => itemId.length > 0);

    const categories = favorites
      .filter(favorite => favorite.type === 'category')
      .map(favorite => favorite.itemName ?? '')
      .filter((category): category is string => category.length > 0);

    return { establishmentIds, categories };
  }

  /**
   * The viewer's favourited offer ids, or an empty set.
   *
   * Never throws: a favourites outage must degrade to "no hearts filled in",
   * not to a failed home screen. Mirrors the graceful degradation already in
   * `mapOffersToDto`.
   *
   * Deliberately **not** cached in Redis. The query is served by the
   * `user_favorites_lookup` index on `{ userId, type, isActive }` and returns a
   * handful of ids, so the win would be small — while a stale entry means a
   * user taps the heart and watches it revert, which is exactly the kind of
   * "the app is broken" moment worth one indexed read per request to avoid.
   */
  private async getFavoriteOfferIdSet(userId: string): Promise<Set<string>> {
    try {
      return new Set(await this.getUserFavoriteOfferIds(userId));
    } catch (error) {
      this.logger.warn(
        'Failed to fetch user favorites, serving discovery list without isFavorite',
        'OffersService',
        { userId, error },
      );
      return new Set();
    }
  }

  /**
   * Applies the two per-viewer fields to a shared cached page.
   *
   * Returns new card objects rather than mutating the ones it was given.
   *
   * With today's `CacheService` that is defensive, not load-bearing: a hit
   * arrives as a fresh `JSON.parse`, a miss produces a fresh aggregation
   * result, and `set()` snapshots the value before this method ever sees it —
   * so nothing is shared to corrupt.
   *
   * It stops being merely defensive the moment anything holds a page in
   * process — an LRU in front of Redis, or single-flight coalescing so
   * concurrent misses share one factory call. Both are natural next steps for
   * this exact path, and under either one, personalising in place would write
   * the first user's `isFavorite` into the object handed to everyone else.
   * Copying costs one shallow spread per card and removes the trap in advance.
   * `personalizeOfferPage` leaves its input untouched — asserted directly, since
   * no cache shape available here can demonstrate the consequence.
   */
  private async personalizeOfferPage(
    page: CachedOfferPage,
    userId?: string,
    userLocation?: { latitude: number; longitude: number },
  ): Promise<{ data: OfferCardDto[]; total: number }> {
    const favoriteSet = userId ? await this.getFavoriteOfferIdSet(userId) : undefined;

    // Nothing to personalise — hand back the cards unchanged rather than
    // allocating a parallel array on every anonymous request.
    if (!favoriteSet && !userLocation) {
      return { data: page.data, total: page.total };
    }

    const data = page.data.map(card => {
      const personalized: OfferCardDto = { ...card };

      if (favoriteSet) {
        personalized.isFavorite = favoriteSet.has(card.id);
      }

      if (userLocation) {
        const coordinates = page.coordinates[card.id];
        // Absent for an establishment with no geocoded address. Leaving
        // `distance` unset is correct: the card renders without it, whereas a
        // fabricated 0 would sort that offer to the top as "nearest".
        if (coordinates) {
          const [longitude, latitude] = coordinates;
          personalized.distance = Math.round(
            this.calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              latitude,
              longitude,
            ),
          );
        }
      }

      return personalized;
    });

    return { data, total: page.total };
  }

  /**
   * Extracts `offerId -> [lng, lat]` from populated aggregation results.
   *
   * Only entries with a well-formed coordinate pair are included, so a missing
   * or malformed address simply yields no distance rather than `NaN` — which
   * would serialise as `null` and read to the client as "distance unknown"
   * only by accident.
   */
  private extractOfferCoordinates(
    offers: (OfferDocument | OfferLean)[],
  ): Record<string, [number, number]> {
    const coordinates: Record<string, [number, number]> = {};

    for (const offer of offers) {
      const establishment = (offer as OfferLean).establishmentId as PopulatedEstRef | undefined;
      const pair = establishment?.address?.coordinates?.coordinates;

      if (!Array.isArray(pair) || pair.length !== 2) {
        continue;
      }

      const [longitude, latitude] = pair;
      if (typeof longitude !== 'number' || typeof latitude !== 'number') {
        continue;
      }

      const offerId = typeof offer._id === 'string' ? offer._id : (offer._id?.toString() ?? '');
      if (offerId.length > 0) {
        coordinates[offerId] = [longitude, latitude];
      }
    }

    return coordinates;
  }

  private async mapOffersToDto(
    offers: (OfferDocument | OfferLean)[],
    userId?: string,
    prefetchedFavoriteSet?: Set<string>, // avoids a second DB hit when caller already fetched IDs
  ): Promise<OfferCardDto[]> {
    let favoriteSet: Set<string> = prefetchedFavoriteSet ?? new Set();

    // Only fetch from DB when not pre-supplied by the caller
    if (userId && !prefetchedFavoriteSet) {
      try {
        const favoriteIds = await this.getUserFavoriteOfferIds(userId);
        favoriteSet = new Set(favoriteIds); // O(1) lookup per offer

        this.logger.debug(`Fetched ${favoriteIds.length} favorite IDs for user`, 'OffersService', {
          userId,
          count: favoriteIds.length,
        });
      } catch (error) {
        // Graceful degradation: log warning but continue without isFavorite
        this.logger.warn(
          `Failed to fetch user favorites, continuing without isFavorite field`,
          'OffersService',
          { userId, error },
        );
      }
    }

    // Map offers to DTOs with isFavorite
    return offers.map(offer => {
      // ✅ TYPE SAFETY: Extract distance from lean objects (aggregations)
      const distance = (offer as OfferLean).distance;

      // ✅ TYPE SAFETY: Handle both ObjectId and string _id
      const offerId = typeof offer._id === 'string' ? offer._id : (offer._id?.toString() ?? '');

      return OfferPresenter.toCardDto(
        offer,
        distance,
        userId ? favoriteSet.has(offerId) : undefined,
      );
    });
  }

  async create(
    createOfferDto: CreateOfferDto,
    merchantId: string,
    userRole?: string,
    assignedEstablishmentId?: string,
  ): Promise<OfferDocument> {
    await this.validateEstablishmentOwnerOnly(
      createOfferDto.establishmentId,
      merchantId,
      userRole,
      assignedEstablishmentId,
    );
    // ✅ TIMEZONE: Convert local time (Tunisia) to UTC using proper timezone library
    // User inputs local time (e.g., 23:20 Tunisia) → Backend stores UTC (22:20)
    const timezone = createOfferDto.timezone ?? 'Africa/Tunis';

    const availableFrom = TimezoneUtil.toUTC(createOfferDto.availableFrom, timezone);
    const availableUntil = TimezoneUtil.toUTC(createOfferDto.availableUntil, timezone);
    const now = new Date();

    // 2-minute grace period covers network latency and the "Right Now" use case
    // where the frontend captures the timestamp at submit time (seconds included).
    if (availableFrom < new Date(now.getTime() - 2 * 60 * 1000)) {
      throw new BadRequestException('Available from date cannot be in the past');
    }
    if (availableUntil <= availableFrom) {
      throw new BadRequestException('Available until date must be after available from date');
    }

    // ✅ SECURITY: Calculate discount percentage and enforce TND currency
    const validatedPricing = this.calculateAndValidatePricing(createOfferDto.pricing);
    this.validatePickupTimeSlots(createOfferDto.pickupTimeSlots);
    this.validatePickupSlotsAgainstQuantity(
      createOfferDto.pickupTimeSlots,
      createOfferDto.totalQuantity,
    );

    const offer = new this.offerModel({
      ...createOfferDto,
      pricing: validatedPricing,
      establishmentId: new Types.ObjectId(createOfferDto.establishmentId),
      merchantId: new Types.ObjectId(merchantId),
      availableFrom,
      availableUntil,
      // Explicit override — must come AFTER the spread so the merchant's
      // choice is never overwritten by the DTO's class-field default (false).
      isPickupToday: createOfferDto.isPickupToday === true,
      isPickupTomorrow: createOfferDto.isPickupTomorrow === true,
      cancellationDeadline: createOfferDto.cancellationDeadline
        ? TimezoneUtil.toUTC(createOfferDto.cancellationDeadline, timezone)
        : new Date(availableFrom.getTime() - 2 * 60 * 60 * 1000), // 2 hours before
    });

    const savedOffer = await offer.save();
    return savedOffer;
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    filters: SearchOffersDto = { page: 1, limit: 20 },
    userId?: string, // NEW: For isFavorite computation
  ): Promise<{ data: OfferCardDto[]; total: number }> {
    // ✅ ENTERPRISE: DOS protection - limit max page size
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;
    const query: MongoQuery = { isDeleted: { $ne: true } };
    const sort: MongoSort = {};

    /*
     * Resolved HERE, not just before the default pipeline.
     *
     * The establishment-filter branch below builds its own aggregation and
     * emits `{ $sort: sort }`. While this ran later, that branch always saw
     * `{}` and MongoDB rejected the stage — "$sort stage must have at least
     * one sort key" — so every filtered `/offers` request WITHOUT lat/lng
     * returned HTTP 500. The geo branch was unaffected because `$geoNear`
     * supplies its own ordering.
     *
     * Resolving once also guarantees the two branches order results
     * identically, which is the behaviour callers actually depend on.
     */
    // ✅ SECURITY: Whitelist-based sorting to prevent prototype pollution
    if (filters.sortBy !== null && filters.sortBy !== undefined) {
      const allowedSortFields: Record<OfferSortField, string> = {
        [OfferSortField.CREATED_AT]: 'createdAt',
        [OfferSortField.PRICE]: 'pricing.discountedPrice',
        [OfferSortField.DISCOUNT]: 'pricing.discountPercentage',
        [OfferSortField.EXPIRY]: 'availableUntil',
      };

      const safeField = allowedSortFields[filters.sortBy];
      if (safeField) {
        const order = filters.sortOrder === 'asc' ? 1 : -1;
        sort[safeField] = order;
      }
    } else {
      sort['createdAt'] = -1;
    }

    // Only apply the public "active offers only" filter when there is no
    // merchant/establishment context (i.e. this is a consumer-facing query).
    if (
      (filters.merchantId === null || filters.merchantId === undefined) &&
      (filters.establishmentId === null || filters.establishmentId === undefined) &&
      (filters.status === null || filters.status === undefined)
    ) {
      query.status = OfferStatus.ACTIVE;
      query.isActive = true;
    }
    if (filters.search) {
      query.$text = { $search: filters.search };
    }
    if (filters.type !== null && filters.type !== undefined) {
      query.type = filters.type;
    }
    if (filters.status !== null && filters.status !== undefined) {
      query.status = filters.status;
    }
    // ✅ FIX: Query actual database fields, not virtual field
    // isFeatured is virtual (isFeaturedManual || isFeaturedAuto)
    if (filters.isFeatured !== undefined) {
      if (filters.isFeatured) {
        // When filtering for featured offers, use $or
        query.$or = [{ isFeaturedManual: true }, { isFeaturedAuto: true }];
      } else {
        // When filtering for NON-featured offers
        query.isFeaturedManual = false;
        query.isFeaturedAuto = false;
      }
    }
    if (filters.establishmentId) {
      if (!isValidObjectId(filters.establishmentId)) {
        throw new BadRequestException('Invalid establishmentId format');
      }
      query.establishmentId = new Types.ObjectId(filters.establishmentId);
    }
    if (filters.merchantId) {
      if (!isValidObjectId(filters.merchantId)) {
        throw new BadRequestException('Invalid merchantId format');
      }
      query.merchantId = new Types.ObjectId(filters.merchantId);
    }
    if (filters.categories && filters.categories.length > 0) {
      query.categories = { $in: filters.categories };
    }
    if (filters.tags && filters.tags.length > 0) {
      query.tags = { $in: filters.tags };
    }

    // ✅ NEW: Establishment filters (requires aggregation pipeline)
    const hasEstablishmentFilters =
      (filters.establishmentTypes?.length ?? 0) > 0 || (filters.cuisineTypes?.length ?? 0) > 0;

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      query['pricing.discountedPrice'] = {};
      if (filters.minPrice !== undefined) {
        query['pricing.discountedPrice'].$gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        query['pricing.discountedPrice'].$lte = filters.maxPrice;
      }
    }
    if (filters.minDiscount) {
      query['pricing.discountPercentage'] = { $gte: filters.minDiscount };
    }

    // Time-window filter applies only to public (consumer-facing) queries.
    // Skip when any merchant/establishment context is present.
    if (
      (filters.merchantId === null || filters.merchantId === undefined) &&
      (filters.establishmentId === null || filters.establishmentId === undefined) &&
      (filters.status === null || filters.status === undefined)
    ) {
      const now = new Date();
      query.availableFrom = { $lte: now };
      query.availableUntil = { $gte: now };
    }

    // ✅ NEW: Handle establishment filters with aggregation pipeline
    if (
      hasEstablishmentFilters &&
      filters.longitude === undefined &&
      filters.latitude === undefined
    ) {
      // Use aggregation pipeline for establishment filtering
      const pipeline: PipelineStage[] = [
        // Match offers first
        { $match: query },
        // Lookup establishment details
        {
          $lookup: {
            from: 'establishments',
            localField: 'establishmentId',
            foreignField: '_id',
            as: 'establishment',
          },
        },
        { $unwind: '$establishment' },
        // Apply establishment filters
        {
          $match: {
            ...(filters.establishmentTypes &&
              filters.establishmentTypes.length > 0 && {
                'establishment.type': { $in: filters.establishmentTypes },
              }),
            ...(filters.cuisineTypes &&
              filters.cuisineTypes.length > 0 && {
                'establishment.cuisineTypes': { $in: filters.cuisineTypes },
              }),
          },
        },
        // Lookup merchant data (offer creator — may be location_manager)
        {
          $lookup: {
            from: 'users',
            localField: 'merchantId',
            foreignField: '_id',
            as: 'merchantData',
          },
        },
        { $unwind: { path: '$merchantData', preserveNullAndEmptyArrays: true } },
        // Lookup establishment owner (the actual merchant)
        {
          $lookup: {
            from: 'users',
            localField: 'establishment.ownerId',
            foreignField: '_id',
            pipeline: [{ $project: { profileImage: 1 } }],
            as: '_ownerData',
          },
        },
        // Project required fields
        {
          $project: {
            title: 1,
            description: 1,
            type: 1,
            images: 1,
            pricing: 1,
            totalQuantity: 1,
            soldQuantity: 1,
            reservedQuantity: 1,
            availableFrom: 1,
            availableUntil: 1,
            establishmentId: 1,
            merchantId: {
              _id: '$merchantData._id',
              firstName: '$merchantData.firstName',
              lastName: '$merchantData.lastName',
              profileImage: '$merchantData.profileImage',
            },
            _ownerProfileImage: { $arrayElemAt: ['$_ownerData.profileImage', 0] },
            pickupTimeSlots: 1,
            status: 1,
            createdAt: 1,
            establishment: {
              _id: '$establishment._id',
              name: '$establishment.name',
              address: '$establishment.address',
              type: '$establishment.type',
              averageRating: '$establishment.averageRating',
              profileImage: { $arrayElemAt: ['$establishment.images', 0] },
            },
            isFeaturedManual: 1,
            isFeaturedAuto: 1,
            featuredAt: 1,
            isPickupToday: 1,
            isPickupTomorrow: 1,
          },
        },
        // Apply sorting
        { $sort: sort },
        // Pagination
        { $skip: skip },
        { $limit: safeLimit },
      ];

      const countPipeline: PipelineStage[] = [
        { $match: query },
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
            ...(filters.establishmentTypes &&
              filters.establishmentTypes.length > 0 && {
                'establishment.type': { $in: filters.establishmentTypes },
              }),
            ...(filters.cuisineTypes &&
              filters.cuisineTypes.length > 0 && {
                'establishment.cuisineTypes': { $in: filters.cuisineTypes },
              }),
          },
        },
        { $count: 'total' },
      ];

      const [offers, totalCount] = await Promise.all([
        this.offerModel.aggregate<OfferLean>(pipeline).exec(),
        this.offerModel.aggregate<AggregateCountResult>(countPipeline).exec(),
      ]);

      const total = totalCount[0]?.total ?? 0;

      // ✅ NEW: Map offers to DTOs with isFavorite
      const data = await this.mapOffersToDto(offers as OfferDocument[], userId);
      return { data, total };
    }

    // ✅ ENTERPRISE: Geolocation query with pagination
    // ⚠️ CRITICAL FIX: $geoNear MUST be the first stage in aggregation pipeline
    if (filters.longitude && filters.latitude) {
      const maxDistance = filters.maxDistance ?? 5000;

      // ✅ FIX: Use $geoNear as FIRST stage (MongoDB requirement)
      // Move all offer filters into the 'query' parameter of $geoNear
      const geoNearQuery: {
        isActive: boolean;
        isDeleted: { $ne: boolean };
        type?: { $in: string[] };
        cuisineTypes?: { $in: string[] };
      } = {
        // Establishment must be active (we're querying establishments collection virtually)
        isActive: true,
        isDeleted: { $ne: true },
      };

      // ✅ NEW: Apply establishment filters in geoNear query
      if (filters.establishmentTypes && filters.establishmentTypes.length > 0) {
        geoNearQuery.type = { $in: filters.establishmentTypes };
      }
      if (filters.cuisineTypes && filters.cuisineTypes.length > 0) {
        geoNearQuery.cuisineTypes = { $in: filters.cuisineTypes };
      }

      const pipeline: PipelineStage[] = [
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [filters.longitude, filters.latitude],
            },
            distanceField: 'distance',
            maxDistance,
            spherical: true,
            key: 'address.coordinates', // Geospatial field on establishments
            query: geoNearQuery,
          },
        },
        // ✅ Now lookup offers for these nearby establishments
        {
          $lookup: {
            from: 'offers',
            let: { establishmentId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$establishmentId', '$$establishmentId'] },
                  ...query, // Apply offer filters (status, isActive, dates, etc.)
                },
              },
            ],
            as: 'offers',
          },
        },
        { $unwind: '$offers' },
        // ✅ Lookup merchant data (offer creator — may be location_manager)
        {
          $lookup: {
            from: 'users',
            localField: 'offers.merchantId',
            foreignField: '_id',
            as: 'merchantData',
          },
        },
        { $unwind: { path: '$merchantData', preserveNullAndEmptyArrays: true } },
        // ✅ Lookup establishment owner (the actual merchant)
        {
          $lookup: {
            from: 'users',
            localField: 'ownerId',
            foreignField: '_id',
            pipeline: [{ $project: { profileImage: 1 } }],
            as: '_ownerData',
          },
        },
        // ✅ Restructure to have offer as root document
        {
          $replaceRoot: {
            newRoot: {
              $mergeObjects: [
                '$offers',
                {
                  establishment: {
                    _id: '$_id',
                    name: '$name',
                    address: '$address',
                    type: '$type',
                    averageRating: '$averageRating',
                  },
                  merchantId: {
                    _id: '$merchantData._id',
                    firstName: '$merchantData.firstName',
                    lastName: '$merchantData.lastName',
                    profileImage: '$merchantData.profileImage',
                  },
                  distance: '$distance',
                  _ownerProfileImage: { $arrayElemAt: ['$_ownerData.profileImage', 0] },
                },
              ],
            },
          },
        },
        // ✅ ENTERPRISE: Project only required fields for performance
        {
          $project: {
            title: 1,
            type: 1,
            images: 1,
            pricing: 1,
            totalQuantity: 1,
            soldQuantity: 1,
            reservedQuantity: 1,
            availableFrom: 1,
            availableUntil: 1,
            establishmentId: 1,
            merchantId: 1,
            pickupTimeSlots: 1,
            status: 1,
            createdAt: 1,
            distance: 1,
            establishment: 1,
            _ownerProfileImage: 1,
            isFeaturedManual: 1,
            isFeaturedAuto: 1,
            featuredAt: 1,
            isPickupToday: 1,
            isPickupTomorrow: 1,
          },
        },
        { $sort: { distance: 1 } }, // Sort by distance (nearest first)
        { $skip: skip },
        { $limit: safeLimit },
      ];

      const countPipeline: PipelineStage[] = [
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [filters.longitude, filters.latitude],
            },
            distanceField: 'distance',
            maxDistance,
            spherical: true,
            key: 'address.coordinates',
            query: geoNearQuery,
          },
        },
        {
          $lookup: {
            from: 'offers',
            let: { establishmentId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$establishmentId', '$$establishmentId'] },
                  ...query,
                },
              },
            ],
            as: 'offers',
          },
        },
        { $unwind: '$offers' },
        { $count: 'total' },
      ];

      // ⚠️ CRITICAL: Query establishments collection (not offers) since $geoNear requires 2dsphere index
      const establishmentModel = this.offerModel.db.collection('establishments');

      const [offers, totalCount] = await Promise.all([
        establishmentModel.aggregate<OfferLean>(pipeline).toArray(),
        establishmentModel.aggregate<AggregateCountResult>(countPipeline).toArray(),
      ]);

      const total = totalCount[0]?.total ?? 0;

      // ✅ NEW: Map offers to DTOs with isFavorite
      const data = await this.mapOffersToDto(offers as OfferDocument[], userId);
      return { data, total };
    }

    // ✅ PERFORMANCE: Single aggregation pipeline replaces .find().populate().populate()
    // $sort/$skip/$limit BEFORE $lookup — lookups only run on the page slice,
    // not on every matching document (25x fewer lookups on large result sets).
    const pipeline: PipelineStage[] = [
      { $match: query },
      { $sort: sort },
      { $skip: skip },
      { $limit: safeLimit },
      ...this.buildEstablishmentLookup(),
      ...this.buildMerchantLookup(),
    ];

    const [offers, total] = await Promise.all([
      this.offerModel.aggregate(pipeline).exec(),
      this.offerModel.countDocuments(query),
    ]);

    // ✅ NEW: Map offers to DTOs with isFavorite
    const data = await this.mapOffersToDto(offers as OfferDocument[], userId);
    return { data, total };
  }

  async findById(id: string, viewerUserId?: string): Promise<OfferDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid offer ID');
    }

    // ✅ PERFORMANCE: Single aggregation replaces findById + 2 populates (3 → 1 round-trip)
    const pipeline: PipelineStage[] = [
      { $match: { _id: new Types.ObjectId(id) } },
      { $project: { viewedBy: 0 } }, // internal tracking field — never expose to API consumers
      // Compute availableQuantity so frontend doesn't need to calculate it
      {
        $addFields: {
          id: { $toString: '$_id' }, // ✅ BUGFIX: Transform _id to id for frontend compatibility
          availableQuantity: {
            $subtract: ['$totalQuantity', { $add: ['$soldQuantity', '$reservedQuantity'] }],
          },
        },
      },
      ...this.buildEstablishmentLookup(true),
      ...this.buildMerchantLookup(true),
    ];

    const results = await this.offerModel.aggregate(pipeline).exec();
    const offer = results[0] as OfferDocument | undefined;

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    // Unique-view increment: atomic single op.
    // Filter $ne ensures the update only matches when this user hasn't viewed before.
    // If they have, filter misses → zero writes → viewCount unchanged.
    if (viewerUserId) {
      await this.offerModel.findOneAndUpdate(
        { _id: id, viewedBy: { $ne: viewerUserId } },
        { $inc: { viewCount: 1 }, $addToSet: { viewedBy: viewerUserId } },
      );
    }

    return offer;
  }

  async findByEstablishment(
    establishmentId: string,
    page: number = 1,
    limit: number = 10,
    userId?: string, // NEW: For isFavorite computation
  ): Promise<{ data: OfferCardDto[]; total: number }> {
    const result = await this.findAll(page, limit, { establishmentId, page, limit }, userId);
    return result;
  }

  async findByMerchant(
    merchantId: string | undefined,
    page: number = 1,
    limit: number = 10,
    userId?: string,
    status?: OfferStatus,
    establishmentId?: string,
  ): Promise<{ data: OfferCardDto[]; total: number }> {
    const filters: SearchOffersDto = { page, limit };
    if (merchantId) {
      filters.merchantId = merchantId;
    }
    if (status !== null && status !== undefined) {
      filters.status = status;
    }
    if (establishmentId !== null && establishmentId !== undefined) {
      filters.establishmentId = establishmentId;
    }
    const result = await this.findAll(page, limit, filters, userId);
    return result;
  }

  async update(
    id: string,
    updateOfferDto: UpdateOfferDto,
    userId: string,
    userRole: string,
    assignedEstablishmentId?: string,
  ): Promise<OfferDocument> {
    const offer = await this.findById(id);

    // Check permissions
    // Handle both ObjectId and populated merchantId
    const merchantIdString =
      typeof offer.merchantId === 'object' &&
      offer.merchantId !== null &&
      '_id' in offer.merchantId &&
      offer.merchantId._id !== null &&
      offer.merchantId._id !== undefined
        ? offer.merchantId._id.toString()
        : offer.merchantId.toString();

    if (userRole === UserRole.LOCATION_MANAGER) {
      const estId: unknown = offer.establishmentId;
      const offerEstId =
        typeof estId === 'object' && estId !== null && '_id' in estId
          ? (estId as { _id: Types.ObjectId })._id.toString()
          : String(estId ?? '');
      if (!assignedEstablishmentId || offerEstId !== assignedEstablishmentId) {
        throw new ForbiddenException('You can only update offers for your assigned establishment');
      }
    } else if (userRole !== 'admin' && merchantIdString !== userId) {
      throw new ForbiddenException('You can only update your own offers');
    }

    if (offer.reservedQuantity > 0 && userRole !== 'admin') {
      throw new BadRequestException('Cannot update offer with active reservations');
    }
    if (updateOfferDto.pricing) {
      // ✅ SECURITY: Calculate discount percentage and enforce TND currency
      updateOfferDto.pricing = this.calculateAndValidatePricing(updateOfferDto.pricing);
    }
    if (updateOfferDto.pickupTimeSlots) {
      this.validatePickupTimeSlots(updateOfferDto.pickupTimeSlots);
      // Validate against updated or existing totalQuantity
      const totalQuantity = updateOfferDto.totalQuantity ?? offer.totalQuantity;
      this.validatePickupSlotsAgainstQuantity(updateOfferDto.pickupTimeSlots, totalQuantity);
    }
    // If totalQuantity changed but slots didn't, still validate
    if (updateOfferDto.totalQuantity && !updateOfferDto.pickupTimeSlots) {
      this.validatePickupSlotsAgainstQuantity(offer.pickupTimeSlots, updateOfferDto.totalQuantity);
    }
    if (updateOfferDto.availableFrom || updateOfferDto.availableUntil) {
      const timezone = updateOfferDto.timezone ?? 'Africa/Tunis';
      const availableFrom = updateOfferDto.availableFrom
        ? TimezoneUtil.toUTC(updateOfferDto.availableFrom, timezone)
        : offer.availableFrom;
      const availableUntil = updateOfferDto.availableUntil
        ? TimezoneUtil.toUTC(updateOfferDto.availableUntil, timezone)
        : offer.availableUntil;

      if (availableUntil <= availableFrom) {
        throw new BadRequestException('Available until date must be after available from date');
      }

      updateOfferDto.availableFrom = availableFrom.toISOString();
      updateOfferDto.availableUntil = availableUntil.toISOString();
    }

    // Atomic update (no populate needed here)
    await this.offerModel
      .findByIdAndUpdate(
        id,
        {
          ...updateOfferDto,
          lastModifiedBy: new Types.ObjectId(userId),
        },
        { new: true },
      )
      .exec();

    // Return populated result via aggregation (reuses findById pipeline)
    return this.findById(id);
  }

  async updateStatus(
    id: string,
    status: OfferStatus,
    merchantId?: string,
    userRole?: string,
    assignedEstablishmentId?: string,
  ): Promise<OfferDocument> {
    // When a merchant/LM activates an offer, verify establishment ownership and approval.
    // Admin users pass no merchantId and bypass this check intentionally.
    const isLM = userRole === UserRole.LOCATION_MANAGER;
    if (status === OfferStatus.ACTIVE && (merchantId || isLM)) {
      const offer = await this.offerModel.findById(id).select('establishmentId merchantId').exec();

      if (!offer) {
        throw new NotFoundException('Offer not found');
      }

      if (isLM) {
        const estId: unknown = offer.establishmentId;
        const offerEstId =
          typeof estId === 'object' && estId !== null && '_id' in estId
            ? (estId as { _id: Types.ObjectId })._id.toString()
            : String(estId ?? '');
        if (!assignedEstablishmentId || offerEstId !== assignedEstablishmentId) {
          throw new ForbiddenException(
            'You can only manage offers for your assigned establishment',
          );
        }
      } else if (offer.merchantId.toString() !== merchantId) {
        throw new ForbiddenException('You can only manage your own offers');
      }

      await this.validateEstablishmentOwnership(
        offer.establishmentId.toString(),
        merchantId ?? '',
        userRole,
        assignedEstablishmentId,
      );
    }

    const updateData: StatusUpdateData = { status };

    if (status === OfferStatus.ACTIVE) {
      updateData.publishedAt = new Date();
    }

    const updatedOffer = await this.offerModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .select('_id status publishedAt updatedAt')
      .exec();

    if (!updatedOffer) {
      throw new NotFoundException('Offer not found');
    }

    // Activating/deactivating an offer changes the featured and urgent lists.
    // Not awaited — a cache miss must not fail an offer update that already
    // committed — but the rejection is logged rather than left to the global
    // unhandledRejection handler, which discards it silently.
    this.invalidateDiscoveryCaches('offers:featured:', 'offers:urgent:');

    // Record streak only when a merchant (not admin) publishes an offer
    if (status === OfferStatus.ACTIVE && merchantId) {
      this.streakService.recordListing(merchantId).catch((err: unknown) => {
        this.logger.warn(`Streak record failed for merchant ${merchantId}: ${String(err)}`);
      });
    }

    return updatedOffer;
  }

  async reserveQuantity(
    id: string,
    quantity: number,
  ): Promise<{ offer: OfferDocument; reservedQuantity: number; soldQuantity: number }> {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    const now = new Date();

    // Atomic update: ensure enough quantity + offer still active + not expired
    const updatedOffer = await this.offerModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          status: OfferStatus.ACTIVE,
          isActive: true,
          availableUntil: { $gt: now }, // 🔹 expiry check
          $expr: {
            $gte: [
              { $subtract: ['$totalQuantity', { $add: ['$reservedQuantity', '$soldQuantity'] }] },
              quantity,
            ],
          },
        },
        { $inc: { reservedQuantity: quantity } },
        { new: true, runValidators: true },
      )
      .exec();

    // Handle cases
    if (!updatedOffer) {
      const offer = await this.offerModel.findById(id).exec();

      if (!offer) {
        throw new NotFoundException(`Offer with id ${id} not found`);
      }

      if (offer.status !== OfferStatus.ACTIVE || !offer.isActive) {
        throw new BadRequestException('This offer is not active');
      }

      if (offer.availableUntil <= now) {
        throw new BadRequestException('This offer has expired');
      }

      throw new BadRequestException('Not enough quantity available to reserve');
    }

    return {
      offer: updatedOffer.toObject({ virtuals: true }) as OfferDocument,
      reservedQuantity: updatedOffer.reservedQuantity,
      soldQuantity: updatedOffer.soldQuantity,
    };
  }

  async confirmSale(
    id: string,
    quantity: number,
  ): Promise<{ offer: OfferDocument; reservedQuantity: number; soldQuantity: number }> {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    const updatedOffer = await this.offerModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          reservedQuantity: { $gte: quantity },
          status: OfferStatus.ACTIVE,
          isActive: true,
        },
        {
          $inc: {
            reservedQuantity: -quantity,
            soldQuantity: quantity,
          },
        },
        { new: true, runValidators: true },
      )
      .exec();

    if (!updatedOffer) {
      const exists = await this.offerModel.exists({ _id: id });
      if (!exists) {
        throw new NotFoundException('Offer not found');
      }
      throw new BadRequestException('Not enough reserved quantity to confirm sale');
    }

    return {
      offer: updatedOffer.toObject({ virtuals: true }) as OfferDocument,
      reservedQuantity: updatedOffer.reservedQuantity,
      soldQuantity: updatedOffer.soldQuantity,
    };
  }
  async cancelReservation(id: string, quantity: number): Promise<OfferDocument> {
    const updatedOffer = await this.offerModel
      .findByIdAndUpdate(id, { $inc: { reservedQuantity: -quantity } }, { new: true })
      .exec();

    if (!updatedOffer) {
      throw new NotFoundException('Offer not found');
    }

    return updatedOffer;
  }

  /**
   * Soft delete an offer (admin or merchant only)
   * Prevents referential integrity issues with active orders and reservations
   */
  async remove(
    id: string,
    userId: string,
    userRole: string,
    deletionReason?: string,
    assignedEstablishmentId?: string,
  ): Promise<void> {
    const offer = await this.findById(id);

    // Check permissions
    // Handle both ObjectId and populated merchantId
    const merchantIdString =
      typeof offer.merchantId === 'object' &&
      offer.merchantId !== null &&
      '_id' in offer.merchantId &&
      offer.merchantId._id !== null &&
      offer.merchantId._id !== undefined
        ? offer.merchantId._id.toString()
        : offer.merchantId.toString();

    if (userRole === UserRole.LOCATION_MANAGER) {
      const estId: unknown = offer.establishmentId;
      const offerEstId =
        typeof estId === 'object' && estId !== null && '_id' in estId
          ? (estId as { _id: Types.ObjectId })._id.toString()
          : String(estId ?? '');
      if (!assignedEstablishmentId || offerEstId !== assignedEstablishmentId) {
        throw new ForbiddenException('You can only delete offers for your assigned establishment');
      }
    } else if (userRole !== 'admin' && merchantIdString !== userId) {
      throw new ForbiddenException('You can only delete your own offers');
    }
    if (offer.reservedQuantity > 0) {
      throw new BadRequestException('Cannot delete offer with active reservations');
    }

    // Soft delete: mark as deleted instead of removing from database
    await this.offerModel
      .findByIdAndUpdate(
        id,
        {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userId,
          deletionReason:
            deletionReason ?? (userRole === 'admin' ? 'Admin deletion' : 'Merchant deletion'),
          status: OfferStatus.CANCELLED, // Mark as cancelled
          isActive: false,
        },
        { new: true },
      )
      .exec();

    // Purge from any cached lists — deleted offer must not reappear
    this.invalidateDiscoveryCaches('offers:featured:', 'offers:urgent:');

    this.logger.log(`Offer ${id} soft deleted by user ${userId} (${userRole})`);
  }
  /**
   * Get offers available for pickup TODAY
   *
   * Returns offers where the pickup window overlaps with today (00:00 - 23:59 in Africa/Tunis timezone)
   *
   * @param page - Page number (1-indexed)
   * @param limit - Items per page (max 100)
   * @param userId - User ID for isFavorite computation (optional)
   * @param userLocation - User coordinates for distance calculation (optional)
   * @returns Paginated offers available for pickup today
   */
  async getPickupTodayOffers(
    page: number = 1,
    limit: number = 20,
    userId?: string,
    userLocation?: { latitude: number; longitude: number },
    maxDistanceMeters?: number,
    establishmentTypes?: readonly string[] | string,
  ): Promise<{ data: OfferCardDto[]; total: number }> {
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;

    // Normalised through the same helper the cached urgent endpoint uses, so
    // the two endpoints cannot disagree about what a filter means.
    const { types: typeFilter } = resolveEstablishmentTypeFilter(establishmentTypes);
    const typeMatch: PipelineStage[] =
      typeFilter && typeFilter.length > 0
        ? [{ $match: { 'establishmentId.type': { $in: [...typeFilter] } } }]
        : [];

    const now = new Date();
    const todayStart = TimezoneUtil.getStartOfDay(now);
    const todayEnd = TimezoneUtil.getEndOfDay(now);

    const offerQuery = {
      status: OfferStatus.ACTIVE,
      isActive: true,
      availableFrom: { $lte: todayEnd },
      availableUntil: { $gte: todayStart },
    };

    // ✅ PERFORMANCE: Single aggregation replaces find + 2 populates (3 → 1 round-trip)
    /*
     * The type lives on the looked-up establishment, so the match runs after
     * the lookup and before $skip/$limit — filtering after the page is cut
     * would return fewer than `limit` rows and shorten the carousel.
     *
     * `aggregatePage` keeps the unfiltered path on the cheap index-backed
     * `countDocuments` and collapses the filtered path into a single `$facet`
     * pass rather than repeating the join for the total.
     */
    const { offers, total } = await this.aggregatePage<OfferLean>(
      [{ $match: offerQuery }, ...this.buildEstablishmentLookup(), ...typeMatch],
      [
        ...(this.buildMerchantLookup() as PipelineStage.FacetPipelineStage[]),
        { $sort: { availableUntil: 1 as const, createdAt: -1 as const } },
        { $skip: skip },
        { $limit: safeLimit },
      ],
      () => this.offerModel.countDocuments(offerQuery),
      typeMatch.length > 0,
    );

    // Enrich with distance before DTO mapping; filter by maxDistanceMeters if provided
    if (userLocation) {
      for (const offer of offers) {
        const est = (offer as OfferLean).establishmentId as PopulatedEstRef | undefined;
        const coords = est?.address?.coordinates?.coordinates;
        if (coords && Array.isArray(coords) && coords.length === 2) {
          const [longitude, latitude] = coords;
          if (typeof longitude !== 'number' || typeof latitude !== 'number') {
            continue;
          }
          (offer as OfferLean).distance = Math.round(
            this.calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              latitude,
              longitude,
            ),
          );
        }
      }
    }

    const filteredOffers =
      userLocation && maxDistanceMeters !== undefined
        ? offers.filter(
            o =>
              (o as OfferLean).distance === undefined ||
              (o as OfferLean).distance! <= maxDistanceMeters,
          )
        : offers;

    const data = await this.mapOffersToDto(filteredOffers as OfferDocument[], userId);
    return { data, total };
  }

  /**
   * Get offers available for pickup TOMORROW
   *
   * Returns offers where the pickup window overlaps with tomorrow (00:00 - 23:59 in Africa/Tunis timezone)
   *
   * @param page - Page number (1-indexed)
   * @param limit - Items per page (max 100)
   * @param userId - User ID for isFavorite computation (optional)
   * @param userLocation - User coordinates for distance calculation (optional)
   * @returns Paginated offers available for pickup tomorrow
   */
  async getPickupTomorrowOffers(
    page: number = 1,
    limit: number = 20,
    userId?: string,
    userLocation?: { latitude: number; longitude: number },
    maxDistanceMeters?: number,
    establishmentTypes?: readonly string[] | string,
  ): Promise<{ data: OfferCardDto[]; total: number }> {
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;

    // Normalised through the same helper the cached urgent endpoint uses, so
    // the two endpoints cannot disagree about what a filter means.
    const { types: typeFilter } = resolveEstablishmentTypeFilter(establishmentTypes);
    const typeMatch: PipelineStage[] =
      typeFilter && typeFilter.length > 0
        ? [{ $match: { 'establishmentId.type': { $in: [...typeFilter] } } }]
        : [];

    const now = new Date();
    const todayEnd = TimezoneUtil.getEndOfDay(now);
    const tomorrow = new Date(Date.now() + 86_400_000);
    const tomorrowStart = TimezoneUtil.getStartOfDay(tomorrow);
    const tomorrowEnd = TimezoneUtil.getEndOfDay(tomorrow);

    const offerQuery = {
      status: OfferStatus.ACTIVE,
      isActive: true,
      availableFrom: { $gt: todayEnd, $lte: tomorrowEnd },
      availableUntil: { $gte: tomorrowStart },
    };

    // ✅ PERFORMANCE: Single aggregation replaces find + 2 populates (3 → 1 round-trip)
    /*
     * The type lives on the looked-up establishment, so the match runs after
     * the lookup and before $skip/$limit — filtering after the page is cut
     * would return fewer than `limit` rows and shorten the carousel.
     *
     * `aggregatePage` keeps the unfiltered path on the cheap index-backed
     * `countDocuments` and collapses the filtered path into a single `$facet`
     * pass rather than repeating the join for the total.
     */
    const { offers, total } = await this.aggregatePage<OfferLean>(
      [{ $match: offerQuery }, ...this.buildEstablishmentLookup(), ...typeMatch],
      [
        ...(this.buildMerchantLookup() as PipelineStage.FacetPipelineStage[]),
        { $sort: { availableUntil: 1 as const, createdAt: -1 as const } },
        { $skip: skip },
        { $limit: safeLimit },
      ],
      () => this.offerModel.countDocuments(offerQuery),
      typeMatch.length > 0,
    );

    // Enrich with distance before DTO mapping; filter by maxDistanceMeters if provided
    if (userLocation) {
      for (const offer of offers) {
        const est = (offer as OfferLean).establishmentId as PopulatedEstRef | undefined;
        const coords = est?.address?.coordinates?.coordinates;
        if (coords && Array.isArray(coords) && coords.length === 2) {
          const [longitude, latitude] = coords;
          if (typeof longitude !== 'number' || typeof latitude !== 'number') {
            continue;
          }
          (offer as OfferLean).distance = Math.round(
            this.calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              latitude,
              longitude,
            ),
          );
        }
      }
    }

    const filteredOffers =
      userLocation && maxDistanceMeters !== undefined
        ? offers.filter(
            o =>
              (o as OfferLean).distance === undefined ||
              (o as OfferLean).distance! <= maxDistanceMeters,
          )
        : offers;

    const data = await this.mapOffersToDto(filteredOffers as OfferDocument[], userId);
    return { data, total };
  }

  /**
   * Get featured offers with enterprise-grade pagination
   * ⚠️ CRITICAL FIX: Added pagination to replace hardcoded limit
   *
   * @param page - Page number (1-indexed)
   * @param limit - Items per page (max 100)
   * @returns Paginated featured offers with total count
   */
  async getFeaturedOffers(
    page: number = 1,
    limit: number = 10,
    userId?: string, // For isFavorite computation — applied after the cache, not inside it
  ): Promise<{ data: OfferCardDto[]; total: number }> {
    const safeLimit = Math.min(limit, 100);

    /*
     * Key carries no userId: the featured list is identical for everyone, so
     * one entry serves all of them. See `CachedOfferPage` for what putting the
     * userId here used to cost.
     *
     * The `offers:featured:` prefix is preserved because
     * `invalidateDiscoveryCaches` purges by exactly that prefix.
     */
    const cached = await this.cacheService.getOrSet<CachedOfferPage>(
      `offers:featured:${page}:${safeLimit}`,
      async () => {
        const shared = await this.fetchFeaturedOffers(page, safeLimit);
        return shared;
      },
      OffersService.TTL_FEATURED,
    );

    const personalized = await this.personalizeOfferPage(cached, userId);
    return personalized;
  }

  private async fetchFeaturedOffers(page: number, limit: number): Promise<CachedOfferPage> {
    // ✅ ENTERPRISE: DOS protection - limit max page size
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;

    const now = new Date();

    // ✅ FIX: Query actual database fields, not virtual field
    // isFeatured is virtual (isFeaturedManual || isFeaturedAuto)
    // Must use $or to query the actual stored fields
    const query = {
      status: OfferStatus.ACTIVE,
      isActive: true,
      availableFrom: { $lte: now },
      availableUntil: { $gte: now },
      $or: [{ isFeaturedManual: true }, { isFeaturedAuto: true }],
    };

    // ✅ PERFORMANCE: Single aggregation replaces find + 2 populates (3 → 1 round-trip)
    const pipeline: PipelineStage[] = [
      { $match: query },
      ...this.buildEstablishmentLookup(),
      ...this.buildMerchantLookup(),
      { $sort: { createdAt: -1 as const } },
      { $skip: skip },
      { $limit: safeLimit },
    ];

    const [offers, total] = await Promise.all([
      this.offerModel.aggregate(pipeline).exec(),
      this.offerModel.countDocuments(query),
    ]);

    // Mapped without a userId: this result is shared, so `isFavorite` is left
    // unset here and applied per request by `personalizeOfferPage`.
    const data = await this.mapOffersToDto(offers as OfferDocument[]);

    return { data, total, coordinates: this.extractOfferCoordinates(offers as OfferDocument[]) };
  }
  /**
   * Get nearby offers with enterprise-grade pagination and geolocation
   * ⚠️ CRITICAL FIX: Added pagination and proper geolocation query
   *
   * @param longitude - Longitude coordinate
   * @param latitude - Latitude coordinate
   * @param maxDistance - Maximum distance in meters (default: 5000)
   * @param page - Page number (1-indexed)
   * @param limit - Items per page (max 100)
   * @returns Paginated nearby offers with total count
   */
  async getNearbyOffers(
    longitude: number,
    latitude: number,
    maxDistance: number = 5000,
    page: number = 1,
    limit: number = 20,
    userId?: string, // NEW: For isFavorite computation
  ): Promise<{ data: OfferCardDto[]; total: number }> {
    // ✅ ENTERPRISE: DOS protection - limit max page size
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;
    const now = new Date();

    // ✅ CRITICAL FIX: $geoNear MUST be the FIRST stage in aggregation pipeline
    // MongoDB requirement: https://docs.mongodb.com/manual/reference/operator/aggregation/geoNear/

    // Strategy: Query establishments collection first (has 2dsphere index), then lookup offers
    const basePipeline: PipelineStage[] = [
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          distanceField: 'distance',
          maxDistance,
          spherical: true,
          key: 'address.coordinates', // Geospatial index on establishments collection
          // ✅ Filter establishments
          query: {
            isActive: true,
            isDeleted: { $ne: true },
          },
        },
      },
      // ✅ Lookup active offers for these nearby establishments
      {
        $lookup: {
          from: 'offers',
          let: { establishmentId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$establishmentId', '$$establishmentId'] },
                status: OfferStatus.ACTIVE,
                isActive: true,
                availableFrom: { $lte: now },
                availableUntil: { $gte: now },
                isDeleted: { $ne: true },
              },
            },
          ],
          as: 'offers',
        },
      },
      // ✅ Unwind offers array (one document per offer)
      { $unwind: '$offers' },
      // ✅ Lookup merchant details (offer creator — may be location_manager)
      {
        $lookup: {
          from: 'users',
          localField: 'offers.merchantId',
          foreignField: '_id',
          as: 'merchant',
        },
      },
      // ✅ Lookup establishment owner (the actual merchant)
      {
        $lookup: {
          from: 'users',
          localField: 'ownerId',
          foreignField: '_id',
          pipeline: [{ $project: { profileImage: 1 } }],
          as: '_ownerData',
        },
      },
      // ✅ Restructure to have offer as root document (with establishment and distance)
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              '$offers',
              {
                establishment: {
                  _id: '$_id',
                  name: '$name',
                  address: '$address',
                  type: '$type',
                  averageRating: '$averageRating',
                  profileImage: { $arrayElemAt: ['$images', 0] },
                },
                distance: '$distance',
                merchant: { $arrayElemAt: ['$merchant', 0] },
                _ownerProfileImage: { $arrayElemAt: ['$_ownerData.profileImage', 0] },
              },
            ],
          },
        },
      },
      // ✅ ENTERPRISE: Project only required fields for performance
      {
        $project: {
          title: 1,
          type: 1,
          images: 1,
          pricing: 1,
          totalQuantity: 1,
          soldQuantity: 1,
          reservedQuantity: 1,
          availableFrom: 1,
          availableUntil: 1,
          establishmentId: 1,
          status: 1,
          distance: 1,
          'establishment.name': 1,
          'establishment.address': 1,
          'establishment.type': 1,
          'establishment.averageRating': 1,
          'merchant.firstName': 1,
          'merchant.lastName': 1,
          'merchant.profileImage': 1,
          _ownerProfileImage: 1,
          createdAt: 1,
        },
      },
    ];

    // ⚠️ CRITICAL: Query establishments collection (not offers) since $geoNear requires 2dsphere index
    const establishmentModel = this.offerModel.db.collection('establishments');

    const [offers, totalCount] = await Promise.all([
      establishmentModel
        .aggregate<OfferLean>([
          ...basePipeline,
          { $sort: { distance: 1 } }, // Sort by distance (nearest first)
          { $skip: skip },
          { $limit: safeLimit },
        ])
        .toArray(),
      establishmentModel
        .aggregate<AggregateCountResult>([...basePipeline, { $count: 'total' }])
        .toArray(),
    ]);

    const total = totalCount[0]?.total ?? 0;

    // ✅ Map to DTOs with isFavorite field
    const data = await this.mapOffersToDto(offers as OfferDocument[], userId);

    return { data, total };
  }
  /**
   * Get expiring offers with enterprise-grade pagination
   * ⚠️ CRITICAL FIX: Added pagination to prevent loading 1000s of expiring offers
   *
   * @param hoursUntilExpiry - Hours until expiry threshold (default: 24)
   * @param page - Page number (1-indexed)
   * @param limit - Items per page (max 100)
   * @returns Paginated expiring offers with total count
   */
  async getExpiringOffers(
    hoursUntilExpiry: number = 24,
    page: number = 1,
    limit: number = 20,
    userId?: string,
    userLocation?: { latitude: number; longitude: number },
  ): Promise<{ data: OfferCardDto[]; total: number }> {
    const shared = await this.fetchExpiringOffers(hoursUntilExpiry, page, limit);

    const personalized = await this.personalizeOfferPage(shared, userId, userLocation);
    return personalized;
  }

  /**
   * The shared half of the expiring list — everything that does not depend on
   * who is asking or where they are.
   *
   * Location genuinely does not belong here: the pipeline selects on
   * `availableUntil` and sorts by it, so a viewer's coordinates change neither
   * which offers come back nor their order. Distance was only ever a field
   * decorated onto the results afterwards, which is why it can move out to
   * `personalizeOfferPage` and let every location share one cache entry.
   */

  /**
   * Run a paged aggregation and its total in the fewest round trips.
   *
   * **Unfiltered** keeps the original two cheap calls: the rows pipeline plus
   * `countDocuments`, which answers from an index without touching the
   * `$lookup`. That path is unchanged, so it carries no regression risk.
   *
   * **Filtered** cannot use `countDocuments`: the predicate is
   * `establishmentId.type`, which only exists after the establishment
   * `$lookup`, so a count would have to repeat the whole join. `$facet` runs
   * the shared prefix once and branches, turning two passes into one.
   *
   * @param prefix  $match + lookups + the type filter — shared by both branches
   * @param rowsTail  remaining stages that produce the page (sort/skip/limit)
   * @param countUnfiltered  the cheap index-backed count, used only when the
   *                         type filter is absent
   */
  private async aggregatePage<T>(
    prefix: PipelineStage[],
    rowsTail: PipelineStage.FacetPipelineStage[],
    countUnfiltered: () => Promise<number>,
    isFiltered: boolean,
  ): Promise<{ offers: T[]; total: number }> {
    if (!isFiltered) {
      const [offers, total] = await Promise.all([
        this.offerModel.aggregate([...prefix, ...rowsTail]).exec(),
        countUnfiltered(),
      ]);
      return { offers: offers as T[], total };
    }

    const [faceted] = await this.offerModel
      .aggregate<{
        rows: T[];
        total: { n: number }[];
      }>([...prefix, { $facet: { rows: rowsTail, total: [{ $count: 'n' }] } }])
      .exec();

    return { offers: faceted?.rows ?? [], total: faceted?.total[0]?.n ?? 0 };
  }

  private async fetchExpiringOffers(
    hoursUntilExpiry: number,
    page: number,
    limit: number,
    establishmentTypes?: readonly EstablishmentType[],
  ): Promise<CachedOfferPage> {
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;

    const now = new Date();
    const expiryTime = new Date(now.getTime() + hoursUntilExpiry * 60 * 60 * 1000);

    const query = {
      status: OfferStatus.ACTIVE,
      availableUntil: { $lte: expiryTime, $gte: now },
    };

    /*
     * The establishment type lives on the looked-up document, so the filter has
     * to run AFTER buildEstablishmentLookup and BEFORE $skip/$limit —
     * filtering after the page is cut would return fewer than `limit` rows and
     * silently shorten the carousel.
     */
    const typeMatch: PipelineStage[] =
      establishmentTypes && establishmentTypes.length > 0
        ? [{ $match: { 'establishmentId.type': { $in: [...establishmentTypes] } } }]
        : [];

    const { offers, total } = await this.aggregatePage<OfferDocument>(
      [{ $match: query }, ...this.buildEstablishmentLookup(), ...typeMatch],
      [
        ...(this.buildMerchantLookup(true) as PipelineStage.FacetPipelineStage[]),
        { $sort: { availableUntil: 1 as const } },
        { $skip: skip },
        { $limit: safeLimit },
      ],
      () => this.offerModel.countDocuments(query),
      typeMatch.length > 0,
    );

    const data = await this.mapOffersToDto(offers as OfferDocument[]);

    return { data, total, coordinates: this.extractOfferCoordinates(offers as OfferDocument[]) };
  }

  /**
   * Get urgent offers (public-facing wrapper for expiring offers)
   *
   * @description Returns active offers expiring within a specified time window.
   * Designed for "Urgent Deals" sections that need to show offers based on
   * actual time remaining, not manual/auto featuring flags.
   *
   * Differences from getExpiringOffers:
   * - Public endpoint (no auth required)
   * - Default: 1 hour (vs 24 hours for admin expiring endpoint)
   * - Includes merchant profileImage for card display
   *
   * @param hoursUntilExpiry - Hours until expiry threshold (default: 1)
   * @param page - Page number (1-indexed)
   * @param limit - Items per page (max 100)
   * @returns Paginated urgent offers with total count, sorted by soonest expiring first
   */
  async getUrgentOffers(
    hoursUntilExpiry: number = 1,
    page: number = 1,
    limit: number = 10,
    userId?: string,
    userLocation?: { latitude: number; longitude: number },
    establishmentTypes?: readonly string[] | string,
  ): Promise<{ data: OfferCardDto[]; total: number }> {
    const safeLimit = Math.min(limit, 100);

    /*
     * Normalised once, used for BOTH the key and the query. Deriving them
     * separately is how a request for bakeries ends up served from the cafe
     * page — see `establishment-type-filter.util.ts`.
     */
    const { types: typeFilter, cacheSegment } = resolveEstablishmentTypeFilter(establishmentTypes);

    /*
     * Every caller now shares this entry, including the location-aware ones.
     *
     * The previous version returned early whenever `userLocation` was set,
     * "because location-based results vary per user" — but they do not: the
     * pipeline neither filters nor sorts on location (see
     * `fetchExpiringOffers`), so only the decorated `distance` differed. Since
     * that is the main path the mobile app takes, the hottest discovery query
     * in the product was running uncached on every request.
     *
     * Prefix stays `offers:urgent:` for `invalidateDiscoveryCaches`.
     */
    const cached = await this.cacheService.getOrSet<CachedOfferPage>(
      `offers:urgent:${hoursUntilExpiry}:${page}:${safeLimit}${cacheSegment}`,
      async () => {
        const shared = await this.fetchExpiringOffers(
          hoursUntilExpiry,
          page,
          safeLimit,
          typeFilter,
        );
        return shared;
      },
      OffersService.TTL_URGENT,
    );

    const personalized = await this.personalizeOfferPage(cached, userId, userLocation);
    return personalized;
  }

  /**
   * Get personalized recommended offers for user (MVP)
   *
   * Business Logic:
   * 1. Priority 1: Offers from user's favorited establishments
   * 2. Priority 2: Offers in user's favorited categories
   * 3. Fallback: Featured offers (if no favorites exist)
   *
   * Hard Filters (CRITICAL):
   * - availableQuantity > 0 (not sold out)
   * - availableUntil >= now (not expired, pickup window valid)
   * - isActive = true, status = ACTIVE
   *
   * Ranking (Better than simple discount):
   * - Priority: favorited establishment (1) > favorited category (2)
   * - Discount percentage DESC (highest first)
   * - Expiry ASC (urgent offers first - expiring soon show up)
   * - CreatedAt DESC (tie-breaker)
   *
   * Security:
   * - Uses stable categoryId/slug matching (not itemName - prevents drift/casing issues)
   * - De-duplicates offers matching both establishment + category
   *
   * @param userId - User ID for personalization
   * @param limit - Maximum offers to return (default: 20, max: 100)
   * @returns Recommended offers array
   */
  async getRecommendedOffers(userId: string, limit: number = 20): Promise<OfferCardDto[]> {
    // ✅ ENTERPRISE: DOS protection - limit max page size
    const safeLimit = Math.min(limit, 100);

    // Step 1: Fetch establishment/category signals AND offer IDs in parallel (single round-trip).
    // Both query the favorites collection — running them concurrently halves the DB wait time.
    const [favoriteSignals, favoriteOfferIds] = await Promise.all([
      this.getUserFavoriteSignals(userId),
      this.getUserFavoriteOfferIds(userId),
    ]);
    const favoritedEstablishments = favoriteSignals.establishmentIds;
    const favoritedCategories = favoriteSignals.categories;
    const prefetchedFavoriteSet = new Set(favoriteOfferIds);

    // Step 2: Fallback - If no favorites, return featured offers
    if (favoritedEstablishments.length === 0 && favoritedCategories.length === 0) {
      this.logger.log(
        `User ${userId} has no favorites, returning featured offers`,
        'OffersService',
      );
      const result = await this.getFeaturedOffers(1, safeLimit, userId);
      return result.data;
    }

    const now = new Date();

    // Step 3: Build aggregation pipeline with hard filters and smart ranking
    const pipeline: PipelineStage[] = [
      // ✅ HARD FILTERS (CRITICAL)
      {
        $match: {
          status: OfferStatus.ACTIVE,
          isActive: true,
          availableUntil: { $gte: now }, // Not expired, pickup window valid
          availableFrom: { $lte: now }, // Already started
          $or: [
            { establishmentId: { $in: favoritedEstablishments } }, // From fav establishments
            { categories: { $in: favoritedCategories } }, // From fav categories
          ],
        },
      },
      // ✅ Calculate available quantity and filter sold out
      {
        $addFields: {
          availableQuantity: {
            $subtract: ['$totalQuantity', { $add: ['$reservedQuantity', '$soldQuantity'] }],
          },
        },
      },
      {
        $match: {
          availableQuantity: { $gt: 0 }, // ✅ HARD FILTER: Not sold out
        },
      },
      // ✅ Add priority field for ranking
      {
        $addFields: {
          priority: {
            $cond: {
              if: { $in: ['$establishmentId', favoritedEstablishments] },
              then: 1, // Priority 1: Favorited establishment
              else: 2, // Priority 2: Favorited category only
            },
          },
          // Calculate urgency (ms until expiry) for sorting
          urgencyScore: {
            $subtract: ['$availableUntil', now],
          },
        },
      },
      // ✅ BETTER RANKING: Priority → Discount → Urgency → CreatedAt
      {
        $sort: {
          priority: 1, // Favorited establishments first
          'pricing.discountPercentage': -1, // Highest discount
          urgencyScore: 1, // Expiring soon (ASC - smaller values = more urgent)
          createdAt: -1, // Newest (tie-breaker)
        },
      },
      // ✅ Populate establishment details
      {
        $lookup: {
          from: 'establishments',
          localField: 'establishmentId',
          foreignField: '_id',
          as: 'establishment',
        },
      },
      { $unwind: { path: '$establishment', preserveNullAndEmptyArrays: true } },
      // ✅ Populate merchant details (offer creator — may be location_manager)
      {
        $lookup: {
          from: 'users',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchant',
        },
      },
      { $unwind: { path: '$merchant', preserveNullAndEmptyArrays: true } },
      // ✅ Lookup establishment owner (the actual merchant)
      {
        $lookup: {
          from: 'users',
          localField: 'establishment.ownerId',
          foreignField: '_id',
          pipeline: [{ $project: { profileImage: 1 } }],
          as: '_ownerData',
        },
      },
      // ✅ ENTERPRISE: Project only required fields for performance
      {
        $project: {
          title: 1,
          description: 1,
          type: 1,
          images: 1,
          pricing: 1,
          totalQuantity: 1,
          soldQuantity: 1,
          reservedQuantity: 1,
          availableQuantity: 1,
          availableFrom: 1,
          availableUntil: 1,
          establishmentId: 1,
          merchantId: 1,
          categories: 1,
          tags: 1,
          status: 1,
          pickupTimeSlots: 1,
          viewCount: 1,
          favoriteCount: 1,
          isFeaturedManual: 1,
          isFeaturedAuto: 1,
          createdAt: 1,
          // Establishment details
          'establishment.name': 1,
          'establishment.address': 1,
          'establishment.type': 1,
          'establishment.averageRating': 1,
          'establishment.profileImage': { $arrayElemAt: ['$establishment.images', 0] },
          // Owner (actual merchant) profile image
          _ownerProfileImage: { $arrayElemAt: ['$_ownerData.profileImage', 0] },
          // Merchant details (offer creator)
          'merchant.profileImage': 1,
          // Internal fields for debugging (optional)
          priority: 1,
          urgencyScore: 1,
        },
      },
      { $limit: safeLimit },
    ];

    const offers = await this.offerModel.aggregate(pipeline).exec();

    this.logger.log(
      `Recommended ${offers.length} offers for user ${userId} ` +
        `(${favoritedEstablishments.length} fav establishments, ${favoritedCategories.length} fav categories)`,
      'OffersService',
    );

    // ✅ Map to DTOs — pass pre-fetched favorite set to skip a second DB hit
    return this.mapOffersToDto(offers as OfferDocument[], userId, prefetchedFavoriteSet);
  }

  // =========================================================================
  // REUSABLE $lookup PIPELINE BUILDERS (replaces .populate() — 1 round-trip)
  // =========================================================================

  /**
   * Build $lookup stages for establishment population.
   * Overwrites the `establishmentId` ObjectId with the populated object
   * (identical shape to Mongoose `.populate()`).
   *
   * @param includeContact - Include phoneNumber and email in projection
   * @returns PipelineStage[] to spread into an aggregation pipeline
   */
  private buildEstablishmentLookup(includeContact = false): PipelineStage[] {
    const fields: Record<string, 1> = {
      _id: 1,
      name: 1,
      address: 1,
      type: 1,
      averageRating: 1,
      profileImage: 1,
    };
    if (includeContact) {
      fields['phoneNumber'] = 1;
      fields['email'] = 1;
    }

    return [
      {
        $lookup: {
          from: 'establishments',
          let: { refId: '$establishmentId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$refId'] } } },
            {
              $lookup: {
                from: 'users',
                localField: 'ownerId',
                foreignField: '_id',
                pipeline: [{ $project: { profileImage: 1 } }],
                as: '_ownerData',
              },
            },
            {
              $addFields: {
                profileImage: { $arrayElemAt: ['$images', 0] },
                _ownerProfileImage: { $arrayElemAt: ['$_ownerData.profileImage', 0] },
              },
            },
            { $project: { ...fields, _ownerProfileImage: 1 } },
          ],
          as: '_establishmentDoc',
        },
      },
      { $unwind: { path: '$_establishmentDoc', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          establishmentId: '$_establishmentDoc',
          _ownerProfileImage: '$_establishmentDoc._ownerProfileImage',
        },
      },
      { $project: { _establishmentDoc: 0 } },
    ];
  }

  /**
   * Build $lookup stages for merchant (user) population.
   * Overwrites the `merchantId` ObjectId with the populated object
   * (identical shape to Mongoose `.populate()`).
   *
   * @param includeContact - Include email and phoneNumber in projection
   * @returns PipelineStage[] to spread into an aggregation pipeline
   */
  private buildMerchantLookup(includeContact = false): PipelineStage[] {
    const fields: Record<string, 1> = {
      _id: 1,
      firstName: 1,
      lastName: 1,
      profileImage: 1,
    };
    if (includeContact) {
      fields['email'] = 1;
      fields['phoneNumber'] = 1;
    }

    return [
      {
        $lookup: {
          from: 'users',
          let: { refId: '$merchantId' },
          pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$refId'] } } }, { $project: fields }],
          as: '_merchantDoc',
        },
      },
      { $unwind: { path: '$_merchantDoc', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          merchantId: '$_merchantDoc',
          _merchantProfileImage: '$_merchantDoc.profileImage',
        },
      },
      { $project: { _merchantDoc: 0 } },
    ];
  }

  /**
   * Validates that the merchant owns the establishment AND that it is approved.
   * Used when the merchant activates an existing offer.
   *
   * @throws NotFoundException  - establishment does not exist
   * @throws ForbiddenException - merchant does not own it, or it is not ACTIVE
   */
  private async validateEstablishmentOwnership(
    establishmentId: string,
    merchantId: string,
    userRole?: string,
    assignedEstablishmentId?: string,
  ): Promise<EstablishmentDocument> {
    const establishment = await this.establishmentsService.findById(establishmentId);

    if (userRole === UserRole.LOCATION_MANAGER) {
      if (!assignedEstablishmentId || establishment._id.toString() !== assignedEstablishmentId) {
        throw new ForbiddenException('You can only manage offers for your assigned establishment');
      }
    } else if (establishment.ownerId.toString() !== merchantId) {
      throw new ForbiddenException('You can only create offers for your own establishment');
    }

    if (establishment.status !== EstablishmentStatus.ACTIVE) {
      throw new ForbiddenException(
        'Your establishment must be approved before you can activate offers. ' +
          `Current status: ${establishment.status}`,
      );
    }

    if (establishment.subscriptionStatus === 'suspended') {
      throw new ForbiddenException({
        code: 'TRIAL_EXPIRED',
        message:
          'Your subscription has expired. Please renew your subscription before publishing offers.',
      });
    }

    return establishment;
  }

  /**
   * Validates ownership only — does NOT check establishment approval status.
   * Used when creating a draft offer so unapproved merchants can still prepare offers.
   *
   * @throws NotFoundException  - establishment does not exist
   * @throws ForbiddenException - merchant does not own the establishment
   */
  private async validateEstablishmentOwnerOnly(
    establishmentId: string,
    merchantId: string,
    userRole?: string,
    assignedEstablishmentId?: string,
  ): Promise<EstablishmentDocument> {
    const establishment = await this.establishmentsService.findById(establishmentId);

    if (userRole === UserRole.LOCATION_MANAGER) {
      if (!assignedEstablishmentId || establishment._id.toString() !== assignedEstablishmentId) {
        throw new ForbiddenException('You can only create offers for your assigned establishment');
      }
    } else if (establishment.ownerId.toString() !== merchantId) {
      throw new ForbiddenException('You can only create offers for your own establishment');
    }

    // Trial-expiry gate: merchant can still log in and manage existing offers,
    // but cannot create new ones until admin reactivates their subscription.
    if (establishment.subscriptionStatus === 'suspended') {
      throw new ForbiddenException({
        code: 'TRIAL_EXPIRED',
        message:
          'Your subscription has expired. Please renew your subscription to continue creating offers.',
      });
    }

    return establishment;
  }

  /**
   * Calculates discount percentage from prices and enforces business rules
   * ✅ SECURITY: Backend-calculated, user has no control over discount percentage
   * ✅ BUSINESS: Enforces 40-90% discount range for food waste reduction legitimacy
   * ✅ SECURITY: System-enforces TND currency
   */
  private calculateAndValidatePricing(pricing: Partial<OfferPricing>): OfferPricing {
    if (!pricing.originalPrice || !pricing.discountedPrice) {
      throw new BadRequestException('Original price and discounted price are required');
    }

    if (pricing.discountedPrice >= pricing.originalPrice) {
      throw new BadRequestException('Discounted price must be less than original price');
    }

    // ✅ Calculate discount percentage (backend-only, not user input)
    const discountPercentage = Math.round(
      ((pricing.originalPrice - pricing.discountedPrice) / pricing.originalPrice) * 100,
    );

    // ✅ BUSINESS: Enforce minimum 40% discount
    if (discountPercentage < 40 || discountPercentage > 90) {
      throw new BadRequestException(
        `Discount must be between 40% and 90%. Your prices result in ${discountPercentage}% discount.`,
      );
    }

    return {
      originalPrice: pricing.originalPrice,
      discountedPrice: pricing.discountedPrice,
      discountPercentage,
      currency: Currency.TND, // ✅ SECURITY: System-enforced
    };
  }

  private validatePickupTimeSlots(slots: OfferPickupTimeSlot[]): void {
    if (slots?.length === 0) {
      throw new BadRequestException('At least one pickup time slot is required');
    }

    for (const slot of slots) {
      const [startHour = '0', startMinute = '0'] = slot.startTime.split(':');
      const [endHour = '0', endMinute = '0'] = slot.endTime.split(':');

      const startMinutes = parseInt(startHour, 10) * 60 + parseInt(startMinute, 10);
      // Treat 00:00 end time as midnight (end of day = 1440 minutes)
      const rawEnd = parseInt(endHour, 10) * 60 + parseInt(endMinute, 10);
      const endMinutes = rawEnd === 0 ? 1440 : rawEnd;

      if (startMinutes >= endMinutes) {
        throw new BadRequestException('Pickup slot start time must be before end time');
      }

      if (slot.maxOrders !== null && slot.maxOrders !== undefined && slot.maxOrders < 1) {
        throw new BadRequestException('Maximum orders per slot must be at least 1');
      }
    }
  }

  /**
   * Validates that total pickup slot capacity doesn't exceed available quantity
   * Prevents overbooking scenarios where sum(maxOrders) > totalQuantity
   */
  private validatePickupSlotsAgainstQuantity(
    slots: OfferPickupTimeSlot[],
    totalQuantity: number,
  ): void {
    // Only validate when at least one slot has a limit set
    const slotsWithLimits = slots.filter(
      slot => slot.maxOrders !== null && slot.maxOrders !== undefined,
    );
    if (slotsWithLimits.length === 0) {
      return;
    }

    const totalSlotCapacity = slotsWithLimits.reduce((sum, slot) => sum + (slot.maxOrders ?? 0), 0);

    if (totalSlotCapacity > totalQuantity) {
      throw new BadRequestException(
        `Total pickup slot capacity (${totalSlotCapacity}) exceeds available quantity (${totalQuantity}). ` +
          `Please reduce maxOrders per slot or increase totalQuantity.`,
      );
    }
  }

  // =========================================================================
  // OFFER LIFECYCLE: Reactivate & Toggle
  // =========================================================================

  /**
   * Reactivate an expired/cancelled/sold_out offer with new dates
   * Resets quantities, sets new availability window, and transitions to ACTIVE
   *
   * Business Rules:
   * - Only the owning merchant (or admin) can reactivate
   * - Offer must be in EXPIRED, CANCELLED, or SOLD_OUT status
   * - New dates must be valid (future, from < until)
   * - Pickup time slots are re-validated
   * - Quantities reset: reservedQuantity=0, soldQuantity=0
   *
   * @param offerId - Offer ID to reactivate
   * @param dto - New dates, pickup slots, and optional quantity
   * @param userId - Requesting user ID
   * @param userRole - Requesting user role
   * @returns Reactivated offer document
   */
  async reactivateOffer(
    offerId: string,
    dto: ReactivateOfferDto,
    userId: string,
    userRole: string,
    assignedEstablishmentId?: string,
  ): Promise<OfferDocument> {
    const offer = await this.findById(offerId);

    // Ownership check
    const merchantIdString =
      typeof offer.merchantId === 'object' &&
      offer.merchantId !== null &&
      '_id' in offer.merchantId &&
      offer.merchantId._id !== null &&
      offer.merchantId._id !== undefined
        ? offer.merchantId._id.toString()
        : offer.merchantId.toString();

    // findById() replaces the ObjectId with a populated object via $lookup,
    // so bare .toString() gives "[object Object]". Extract the hex ID safely.
    const estRaw: unknown = offer.establishmentId;
    const offerEstId =
      estRaw && typeof estRaw === 'object' && '_id' in estRaw
        ? String((estRaw as PopulatedEstRef)._id)
        : String(offer.establishmentId);

    if (userRole === UserRole.LOCATION_MANAGER) {
      if (!assignedEstablishmentId || offerEstId !== assignedEstablishmentId) {
        throw new ForbiddenException(
          'You can only reactivate offers for your assigned establishment',
        );
      }
    } else if (userRole !== 'admin' && merchantIdString !== userId) {
      throw new ForbiddenException('You can only reactivate your own offers');
    }

    // Establishment approval guard — merchants/LMs cannot reactivate offers
    // for establishments that have not yet been approved by an admin.
    if (userRole !== 'admin') {
      const establishmentId = offerEstId;

      await this.validateEstablishmentOwnership(
        establishmentId,
        userId,
        userRole,
        assignedEstablishmentId,
      );
    }

    // Status guard — only allow reactivation from terminal states
    const reactivatableStatuses: OfferStatus[] = [
      OfferStatus.EXPIRED,
      OfferStatus.CANCELLED,
      OfferStatus.SOLD_OUT,
    ];

    if (!reactivatableStatuses.includes(offer.status)) {
      throw new BadRequestException(
        `Cannot reactivate an offer with status "${offer.status}". ` +
          `Only expired, cancelled, or sold-out offers can be reactivated.`,
      );
    }

    // Validate new dates
    const timezone = dto.timezone ?? 'Africa/Tunis';
    const availableFrom = TimezoneUtil.toUTC(dto.availableFrom, timezone);
    const availableUntil = TimezoneUtil.toUTC(dto.availableUntil, timezone);
    const now = new Date();

    // 2-minute grace period — consistent with create() for "Right Now" reactivations.
    if (availableFrom < new Date(Date.now() - 2 * 60 * 1000)) {
      throw new BadRequestException('Available from date cannot be in the past');
    }
    if (availableUntil <= availableFrom) {
      throw new BadRequestException('Available until date must be after available from date');
    }

    // Validate pickup time slots
    this.validatePickupTimeSlots(dto.pickupTimeSlots);
    const totalQuantity = dto.totalQuantity ?? offer.totalQuantity;
    this.validatePickupSlotsAgainstQuantity(dto.pickupTimeSlots, totalQuantity);

    // Reset pickup slot counters
    const cleanSlots = dto.pickupTimeSlots.map(slot => ({
      startTime: slot.startTime,
      endTime: slot.endTime,
      maxOrders: slot.maxOrders,
      currentOrders: 0,
    }));

    const pricing = dto.pricing ? this.calculateAndValidatePricing(dto.pricing) : undefined;

    // Atomic update — reset quantities and set new window
    const updated = await this.offerModel
      .findByIdAndUpdate(
        offerId,
        {
          $set: {
            status: OfferStatus.ACTIVE,
            isActive: true,
            availableFrom,
            availableUntil,
            pickupTimeSlots: cleanSlots,
            totalQuantity,
            reservedQuantity: 0,
            soldQuantity: 0,
            publishedAt: now,
            lastModifiedBy: new Types.ObjectId(userId),
            isPickupToday: dto.isPickupToday ?? false,
            isPickupTomorrow: dto.isPickupTomorrow ?? false,
            // Clear expiration metadata
            expiredAt: null,
            // Clear auto-featuring (will be re-evaluated by cron)
            isFeaturedAuto: false,
            ...(pricing && { pricing }),
          },
        },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('Offer not found');
    }

    this.logger.log(
      `Offer ${offerId} reactivated by ${userRole} ${userId} ` +
        `(${availableFrom.toISOString()} → ${availableUntil.toISOString()}, qty: ${totalQuantity})`,
      'OffersService',
    );

    if (userRole !== 'admin') {
      this.streakService.recordListing(userId).catch((err: unknown) => {
        this.logger.warn(`Streak record failed for merchant ${userId}: ${String(err)}`);
      });
    }

    return this.findById(offerId);
  }

  /**
   * Toggle offer visibility (enable/disable)
   * Merchants can temporarily hide their offer without changing its status
   *
   * Business Rules:
   * - Only the owning merchant (or admin) can toggle
   * - Offer must be in ACTIVE or DRAFT status to disable
   * - Disabling sets isActive=false (hidden from public queries)
   * - Enabling sets isActive=true (visible again)
   * - Does NOT affect status field (remains ACTIVE/DRAFT)
   * - Offers with active reservations cannot be disabled
   *
   * @param offerId - Offer ID to toggle
   * @param enable - true to enable, false to disable
   * @param userId - Requesting user ID
   * @param userRole - Requesting user role
   * @returns Updated offer document
   */
  async toggleOfferActive(
    offerId: string,
    enable: boolean,
    userId: string,
    userRole: string,
    assignedEstablishmentId?: string,
  ): Promise<OfferDocument> {
    const offer = await this.findById(offerId);

    // Ownership check
    const merchantIdString =
      typeof offer.merchantId === 'object' &&
      offer.merchantId !== null &&
      '_id' in offer.merchantId &&
      offer.merchantId._id !== null &&
      offer.merchantId._id !== undefined
        ? offer.merchantId._id.toString()
        : offer.merchantId.toString();

    const estRawToggle: unknown = offer.establishmentId;
    const offerEstId =
      estRawToggle && typeof estRawToggle === 'object' && '_id' in estRawToggle
        ? String((estRawToggle as PopulatedEstRef)._id)
        : String(offer.establishmentId);

    if (userRole === UserRole.LOCATION_MANAGER) {
      if (!assignedEstablishmentId || offerEstId !== assignedEstablishmentId) {
        throw new ForbiddenException(
          'You can only enable/disable offers for your assigned establishment',
        );
      }
    } else if (userRole !== 'admin' && merchantIdString !== userId) {
      throw new ForbiddenException('You can only enable/disable your own offers');
    }

    // Cannot disable offers with active reservations
    if (!enable && offer.reservedQuantity > 0) {
      throw new BadRequestException(
        'Cannot disable an offer with active reservations. Wait for reservations to complete or cancel them first.',
      );
    }

    // Status guard — only ACTIVE or DRAFT offers can be toggled
    const togglableStatuses: OfferStatus[] = [OfferStatus.ACTIVE, OfferStatus.DRAFT];
    if (!togglableStatuses.includes(offer.status)) {
      throw new BadRequestException(
        `Cannot toggle an offer with status "${offer.status}". ` +
          `Only active or draft offers can be enabled/disabled.`,
      );
    }

    // Prevent no-op
    if (offer.isActive === enable) {
      throw new BadRequestException(`Offer is already ${enable ? 'enabled' : 'disabled'}.`);
    }

    const updated = await this.offerModel
      .findByIdAndUpdate(
        offerId,
        {
          $set: {
            isActive: enable,
            lastModifiedBy: new Types.ObjectId(userId),
            // When disabling, remove from auto-featuring
            ...(!enable && { isFeaturedAuto: false }),
          },
        },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('Offer not found');
    }

    this.logger.log(
      `Offer ${offerId} ${enable ? 'enabled' : 'disabled'} by ${userRole} ${userId}`,
      'OffersService',
    );

    return this.findById(offerId);
  }

  async updateExpiredOffers(): Promise<number> {
    const result = await this.offerModel.updateMany(
      {
        status: OfferStatus.ACTIVE,
        availableUntil: { $lt: new Date() },
      },
      {
        status: OfferStatus.EXPIRED,
        expiredAt: new Date(),
      },
    );
    return result.modifiedCount;
  }

  // =========================================================================
  // FEATURING MANAGEMENT
  // =========================================================================

  /**
   * Set manual featuring status (ADMIN ONLY)
   * This method should ONLY be called by admin users through controller
   *
   * @param offerId - Offer ID to update
   * @param isFeatured - Featured status
   * @param userId - Admin user ID performing the action
   * @returns Updated offer document
   */
  async setManualFeatured(
    offerId: string,
    isFeatured: boolean,
    userId?: string,
  ): Promise<OfferDocument> {
    const updateData: {
      isFeaturedManual: boolean;
      featuredAt?: Date | null;
      featuredBy?: Types.ObjectId | null;
    } = {
      isFeaturedManual: isFeatured,
    };

    // Set featured timestamp and user when featuring
    if (isFeatured) {
      updateData.featuredAt = new Date();
      if (userId) {
        updateData.featuredBy = new Types.ObjectId(userId);
      }
    } else {
      // Clear featured metadata when unfeaturing
      updateData.featuredAt = null;
      updateData.featuredBy = null;
    }

    const offer = await this.offerModel
      .findByIdAndUpdate(offerId, updateData, { new: true })
      .exec();

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    this.logger.log(
      `Offer ${offerId} manually ${isFeatured ? 'featured' : 'unfeatured'} by admin ${userId ?? 'unknown'}`,
      'OffersService',
    );

    // Invalidate featured cache — featured list changed
    this.invalidateDiscoveryCaches('offers:featured:');

    return offer;
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use setManualFeatured instead
   */
  async setFeatured(offerId: string, isFeatured: boolean): Promise<OfferDocument> {
    const result = await this.setManualFeatured(offerId, isFeatured);
    return result;
  }

  /**
   * Auto-feature eligible offers based on urgency criteria
   * Business Rules:
   * - Offer must have existed for >= 2 hours (configurable)
   * - Offer must have <= 1.5 hours remaining (configurable)
   * - Offer must be ACTIVE status
   * - Offer must have available quantity > 0
   *
   * @returns Number of offers auto-featured
   */
  async autoFeatureEligibleOffers(): Promise<number> {
    if (!AUTO_FEATURE_ENABLED) {
      return 0;
    }

    const now = new Date();
    const existenceCutoff = new Date(now.getTime() - MIN_EXISTENCE_MS);
    const urgencyDeadline = new Date(now.getTime() + URGENCY_THRESHOLD_MS);

    // Find offers eligible for auto-featuring
    const eligibleOffers = await this.offerModel
      .find({
        status: OfferStatus.ACTIVE,
        createdAt: { $lte: existenceCutoff }, // Existed for at least MIN_EXISTENCE_HOURS
        availableUntil: {
          $gte: now, // Not expired
          $lte: urgencyDeadline, // Within urgency window
        },
        isFeaturedAuto: false, // Not already auto-featured
      })
      .select('_id totalQuantity reservedQuantity soldQuantity')
      .exec();

    // Filter out sold-out offers (must check virtual field)
    const offersToFeature = eligibleOffers.filter(offer => {
      const availableQuantity = offer.totalQuantity - offer.reservedQuantity - offer.soldQuantity;
      return availableQuantity > 0;
    });

    if (offersToFeature.length === 0) {
      return 0;
    }

    // Bulk update to auto-feature
    const offerIds = offersToFeature.map(o => o._id);
    const result = await this.offerModel
      .updateMany(
        { _id: { $in: offerIds } },
        {
          isFeaturedAuto: true,
          featuredAt: now,
        },
      )
      .exec();

    this.logger.log(
      `Auto-featured ${result.modifiedCount} offers (existed >= ${MIN_EXISTENCE_HOURS}h, <= ${URGENCY_THRESHOLD_HOURS}h remaining)`,
      'OffersService',
    );

    return result.modifiedCount;
  }

  /**
   * Auto-unfeature offers that no longer meet urgency criteria
   * Offers are unfeatured if:
   * - Status is not ACTIVE
   * - Offer has expired
   * - Offer is no longer urgent (> 1.5 hours remaining)
   * - Offer is sold out
   *
   * Note: Does NOT unfeature manually featured offers (isFeaturedManual = true)
   *
   * @returns Number of offers auto-unfeatured
   */
  async autoUnfeatureIneligibleOffers(): Promise<number> {
    if (!AUTO_FEATURE_ENABLED) {
      return 0;
    }

    const now = new Date();
    const urgencyDeadline = new Date(now.getTime() + URGENCY_THRESHOLD_MS);

    // Find auto-featured offers that are no longer eligible
    // Conditions for unfeaturing:
    // 1. Status is not ACTIVE, OR
    // 2. Expired (availableUntil <= now), OR
    // 3. No longer urgent (availableUntil > urgencyDeadline)
    const result = await this.offerModel
      .updateMany(
        {
          isFeaturedAuto: true,
          isFeaturedManual: false, // Don't touch manually featured offers
          $or: [
            { status: { $ne: OfferStatus.ACTIVE } },
            { availableUntil: { $lte: now } }, // Expired
            { availableUntil: { $gt: urgencyDeadline } }, // No longer urgent
          ],
        },
        {
          isFeaturedAuto: false,
        },
      )
      .exec();

    if (result.modifiedCount > 0) {
      this.logger.log(
        `Auto-unfeatured ${result.modifiedCount} offers (no longer urgent)`,
        'OffersService',
      );
    }

    return result.modifiedCount;
  }

  // =========================================================================
  // CRON JOBS
  // =========================================================================

  /**
   * Cron job: Auto-feature/unfeature offers based on urgency
   * Runs every 5 minutes (configurable via AUTO_FEATURE_CRON_SCHEDULE)
   */
  @Cron(AUTO_FEATURE_CRON_SCHEDULE)
  async handleAutoFeaturing(): Promise<void> {
    if (!AUTO_FEATURE_ENABLED) {
      return;
    }

    await this.cronLock.runExclusive(
      CronLockName.OFFER_AUTO_FEATURE,
      CronLockTtl.STANDARD,
      async () => {
        await this.runAutoFeaturing();
      },
    );
  }

  private async runAutoFeaturing(): Promise<void> {
    try {
      const startTime = Date.now();

      // Auto-feature eligible offers
      const featured = await this.autoFeatureEligibleOffers();

      // Auto-unfeature ineligible offers
      const unfeatured = await this.autoUnfeatureIneligibleOffers();

      const duration = Date.now() - startTime;

      if (featured > 0 || unfeatured > 0) {
        this.logger.log(
          `Auto-featuring completed in ${duration}ms: ${featured} featured, ${unfeatured} unfeatured`,
          'OffersService',
        );
      }
    } catch (error) {
      this.logger.error(
        'Error in auto-featuring cron job',
        error instanceof Error ? error.stack : String(error),
        'OffersService',
      );
    }
  }

  /**
   * Cron job: Update expired offers
   * Runs every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleUpdateExpired(): Promise<void> {
    await this.cronLock.runExclusive(CronLockName.OFFER_EXPIRY, CronLockTtl.STANDARD, async () => {
      const updated = await this.updateExpiredOffers();
      if (updated > 0) {
        this.logger.log(`Expired offers updated: ${updated}`, 'OffersService');
      }
    });
  }

  // =========================================================================
  // ADMIN ESTABLISHMENT EVENT HANDLERS
  // =========================================================================

  /**
   * Deactivate all offers for an establishment (triggered by admin suspension)
   * Used when admin suspends an establishment account
   *
   * @param establishmentId - Establishment ID whose offers should be deactivated
   * @param reason - Reason for deactivation (e.g., "Establishment suspended by admin")
   * @returns Number of offers deactivated
   */
  async deactivateEstablishmentOffers(establishmentId: string, reason: string): Promise<number> {
    try {
      // Find all active offers for this establishment
      const activeOffers = await this.offerModel
        .find({
          establishmentId: new Types.ObjectId(establishmentId),
          status: OfferStatus.ACTIVE,
        })
        .lean();

      if (activeOffers.length === 0) {
        this.logger.debug(
          `No active offers to deactivate for establishment ${establishmentId}`,
          'OffersService',
        );
        return 0;
      }

      // Update offers to suspended status
      const result = await this.offerModel.updateMany(
        {
          establishmentId: new Types.ObjectId(establishmentId),
          status: OfferStatus.ACTIVE,
        },
        {
          $set: {
            status: OfferStatus.SUSPENDED,
            deactivationReason: reason,
            deactivatedAt: new Date(),
            deactivatedBy: 'system',
            // Remove auto-featuring flags when deactivated
            isFeaturedAuto: false,
            isFeaturedManual: false,
          },
        },
      );

      this.logger.log(
        `Deactivated ${result.modifiedCount} active offers for establishment ${establishmentId}. Reason: ${reason}`,
        'OffersService',
      );

      // Log each deactivated offer for audit trail
      for (const offer of activeOffers) {
        this.logger.warn(
          `Offer ${offer._id.toString()} "${offer.title}" deactivated due to establishment suspension`,
          'OffersService.EstablishmentSuspension',
        );
      }

      // TODO: Future enhancement - Emit offer.deactivated events for search index updates
      // TODO: Future enhancement - Cancel any active reservations for these offers

      return result.modifiedCount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to deactivate offers for establishment ${establishmentId}: ${errorMessage}`,
        error instanceof Error ? error.stack : String(error),
        'OffersService',
      );
      throw error;
    }
  }

  // ── Smart Pricing Suggestions ─────────────────────────────────────────────

  /** Rolling window every pricing statistic is computed over. */
  private static readonly PRICING_WINDOW_DAYS = 60;

  /**
   * Minimum number of concluded offers before behavioural advice (fill rate,
   * discount depth, best day, best hour) is worth showing. Below this, one
   * lucky Tuesday reads as a pattern.
   */
  private static readonly PRICING_MIN_SAMPLE = 3;

  /**
   * Minimum distinct peer merchants before an average describes anyone other
   * than the merchant looking at it. Below this we widen the peer set, and if
   * it is still empty we suppress the comparison instead of faking one.
   */
  private static readonly PRICING_MIN_PEERS = 3;

  /** Aggregation timezone — day/hour buckets must be local, not UTC. */
  private static readonly PRICING_TIMEZONE = 'Africa/Tunis';

  /** Offers that were published and are no longer collecting orders. */
  private static readonly PRICING_CONCLUDED_STATUSES = [OfferStatus.SOLD_OUT, OfferStatus.EXPIRED];

  /** Every published offer, whether or not it has finished running. */
  private static readonly PRICING_PUBLISHED_STATUSES = [
    OfferStatus.ACTIVE,
    OfferStatus.SOLD_OUT,
    OfferStatus.EXPIRED,
  ];

  private static roundToTenth(value: number): number {
    return Math.round(value * 10) / 10;
  }

  async getPricingSuggestions(merchantId: string): Promise<PricingSuggestions> {
    const merchantOid = new Types.ObjectId(merchantId);

    const [merchantStats, zoneStats] = await Promise.all([
      this.getMerchantPricingStats(merchantOid),
      this.getZonePricingStats(merchantOid),
    ]);

    const insights = this.buildPricingInsights(merchantStats, zoneStats);

    return {
      merchantStats: {
        avgDiscountedPrice: OffersService.roundToTenth(merchantStats.avgDiscountedPrice),
        avgOriginalPrice: OffersService.roundToTenth(merchantStats.avgOriginalPrice),
        avgDiscountPercent: Math.round(merchantStats.avgDiscountPercent),
        fillRate: Math.round(merchantStats.fillRate),
        totalOffers: merchantStats.totalOffers,
        totalSold: merchantStats.totalSold,
        bestDayOfWeek: merchantStats.bestDayOfWeek,
        bestHour: merchantStats.bestHour,
      },
      zoneStats: {
        avgDiscountedPrice: OffersService.roundToTenth(zoneStats.avgDiscountedPrice),
        avgFillRate: Math.round(zoneStats.avgFillRate),
        totalMerchants: zoneStats.totalMerchants,
        scope: zoneStats.scope,
      },
      insights,
      suggestedPriceRange: this.buildSuggestedRange(merchantStats, zoneStats),
      sample: {
        windowDays: OffersService.PRICING_WINDOW_DAYS,
        merchantOffers: merchantStats.totalOffers,
        merchantSoldOutOffers: merchantStats.soldOutOffers,
        peerMerchants: zoneStats.totalMerchants,
      },
    };
  }

  /**
   * Turns the two stat sets into advice keys. Emits no prose: each insight is
   * a key plus numeric params, rendered by the client in the merchant's locale.
   *
   * Every rule is gated on having enough evidence to support it — advice drawn
   * from a single offer is noise dressed up as insight.
   */
  private buildPricingInsights(
    merchantStats: MerchantPricingStats,
    zoneStats: ZonePricingStats,
  ): PricingInsight[] {
    const insights: PricingInsight[] = [];

    const hasPeers = zoneStats.scope !== 'none' && zoneStats.avgDiscountedPrice > 0;
    const hasConcludedSample = merchantStats.concludedOffers >= OffersService.PRICING_MIN_SAMPLE;
    const hasSoldOutSample = merchantStats.soldOutOffers >= OffersService.PRICING_MIN_SAMPLE;

    if (hasPeers && merchantStats.avgDiscountedPrice > 0) {
      const diffPercent = Math.round(
        ((merchantStats.avgDiscountedPrice - zoneStats.avgDiscountedPrice) /
          zoneStats.avgDiscountedPrice) *
          100,
      );

      const priceParams = {
        yourPrice: OffersService.roundToTenth(merchantStats.avgDiscountedPrice),
        zonePrice: OffersService.roundToTenth(zoneStats.avgDiscountedPrice),
      };

      if (diffPercent > 15) {
        insights.push({
          type: 'price_above_zone',
          impact: 'high',
          params: { ...priceParams, diffPercent },
        });
      } else if (diffPercent < -20) {
        insights.push({
          type: 'price_below_zone',
          impact: 'medium',
          params: { ...priceParams, diffPercent: Math.abs(diffPercent) },
        });
      }
    }

    if (hasConcludedSample && merchantStats.fillRate < 50) {
      insights.push({
        type: 'low_fill_rate',
        impact: 'high',
        params: { fillRate: Math.round(merchantStats.fillRate) },
      });
    }

    if (hasConcludedSample && merchantStats.avgDiscountPercent < 45) {
      insights.push({
        type: 'low_discount',
        impact: 'medium',
        params: { discountPercent: Math.round(merchantStats.avgDiscountPercent) },
      });
    }

    if (hasSoldOutSample && merchantStats.bestDayOfWeek !== null) {
      insights.push({
        type: 'best_day',
        impact: 'medium',
        params: { day: merchantStats.bestDayOfWeek },
      });
    }

    if (hasSoldOutSample && merchantStats.bestHour !== null) {
      insights.push({
        type: 'best_hour',
        impact: 'medium',
        params: { hour: merchantStats.bestHour },
      });
    }

    return insights;
  }

  /**
   * A merchant's own sold-out prices are direct evidence of what their own
   * customers will pay. The peer average is only a proxy, used until that
   * evidence exists — and skipped entirely when there are no peers either,
   * rather than inventing a range out of nothing.
   */
  private buildSuggestedRange(
    merchantStats: MerchantPricingStats,
    zoneStats: ZonePricingStats,
  ): PricingSuggestions['suggestedPriceRange'] {
    const build = (anchor: number, lowerBound: number, basis: PricingRangeBasis) => {
      const min = OffersService.roundToTenth(Math.max(1, anchor * lowerBound));
      const max = OffersService.roundToTenth(anchor * 1.1);
      // The floor can overtake the ceiling on very cheap anchors: a 0.5 TND
      // average floors to 1 while the ceiling lands at 0.6.
      return { min, max: Math.max(min, max), currency: Currency.TND, basis };
    };

    if (
      merchantStats.soldOutOffers >= OffersService.PRICING_MIN_SAMPLE &&
      merchantStats.avgSoldOutPrice > 0
    ) {
      return build(merchantStats.avgSoldOutPrice, 0.9, 'own_history');
    }

    if (zoneStats.scope !== 'none' && zoneStats.avgDiscountedPrice > 0) {
      return build(zoneStats.avgDiscountedPrice, 0.85, 'zone');
    }

    return null;
  }

  private static pricingWindowStart(): Date {
    return new Date(Date.now() - OffersService.PRICING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  }

  private async getMerchantPricingStats(
    merchantOid: Types.ObjectId,
  ): Promise<MerchantPricingStats> {
    const since = OffersService.pricingWindowStart();

    // One round-trip: $facet runs every branch over the same matched set.
    const pipeline: PipelineStage[] = [
      {
        $match: {
          merchantId: merchantOid,
          createdAt: { $gte: since },
          status: { $in: OffersService.PRICING_PUBLISHED_STATUSES },
        },
      },
      {
        $facet: {
          // Price stats span every published offer — price is fixed at creation.
          pricing: [
            {
              $group: {
                _id: null,
                avgDiscountedPrice: { $avg: '$pricing.discountedPrice' },
                avgOriginalPrice: { $avg: '$pricing.originalPrice' },
                avgDiscountPercent: { $avg: '$pricing.discountPercentage' },
                totalOffers: { $sum: 1 },
                totalSold: { $sum: '$soldQuantity' },
              },
            },
          ],
          // Fill rate spans concluded offers only. An offer that is still
          // running has not had its chance yet, and counting it drags the rate
          // down for a reason the merchant cannot act on.
          fill: [
            { $match: { status: { $in: OffersService.PRICING_CONCLUDED_STATUSES } } },
            {
              $group: {
                _id: null,
                totalQuantity: { $sum: '$totalQuantity' },
                soldQuantity: { $sum: '$soldQuantity' },
                offers: { $sum: 1 },
              },
            },
          ],
          soldOut: [
            { $match: { status: OfferStatus.SOLD_OUT } },
            {
              $group: {
                _id: null,
                avgSoldOutPrice: { $avg: '$pricing.discountedPrice' },
                offers: { $sum: 1 },
              },
            },
          ],
          byDay: [
            { $match: { status: OfferStatus.SOLD_OUT } },
            {
              $group: {
                _id: {
                  $dayOfWeek: {
                    date: '$createdAt',
                    timezone: OffersService.PRICING_TIMEZONE,
                  },
                },
                sold: { $sum: '$soldQuantity' },
              },
            },
            { $match: { sold: { $gt: 0 } } },
            { $sort: { sold: -1, _id: 1 } },
            { $limit: 1 },
          ],
          byHour: [
            { $match: { status: OfferStatus.SOLD_OUT } },
            {
              $group: {
                _id: {
                  $hour: {
                    // publishedAt is optional on the schema; older offers carry
                    // only createdAt, and dropping them would bias the result.
                    date: { $ifNull: ['$publishedAt', '$createdAt'] },
                    timezone: OffersService.PRICING_TIMEZONE,
                  },
                },
                sold: { $sum: '$soldQuantity' },
              },
            },
            { $match: { sold: { $gt: 0 } } },
            { $sort: { sold: -1, _id: 1 } },
            { $limit: 1 },
          ],
        },
      },
    ];

    const [facet] = (await this.offerModel.aggregate(pipeline).exec()) as Array<{
      pricing: Array<{
        avgDiscountedPrice: number | null;
        avgOriginalPrice: number | null;
        avgDiscountPercent: number | null;
        totalOffers: number;
        totalSold: number;
      }>;
      fill: Array<{ totalQuantity: number; soldQuantity: number; offers: number }>;
      soldOut: Array<{ avgSoldOutPrice: number | null; offers: number }>;
      byDay: Array<{ _id: number; sold: number }>;
      byHour: Array<{ _id: number; sold: number }>;
    }>;

    const pricing = facet?.pricing[0];
    const fill = facet?.fill[0];
    const soldOut = facet?.soldOut[0];
    const bestDay = facet?.byDay[0];
    const bestHour = facet?.byHour[0];

    return {
      avgDiscountedPrice: pricing?.avgDiscountedPrice ?? 0,
      avgOriginalPrice: pricing?.avgOriginalPrice ?? 0,
      avgDiscountPercent: pricing?.avgDiscountPercent ?? 0,
      avgSoldOutPrice: soldOut?.avgSoldOutPrice ?? 0,
      fillRate: fill && fill.totalQuantity > 0 ? (fill.soldQuantity / fill.totalQuantity) * 100 : 0,
      totalOffers: pricing?.totalOffers ?? 0,
      totalSold: pricing?.totalSold ?? 0,
      concludedOffers: fill?.offers ?? 0,
      soldOutOffers: soldOut?.offers ?? 0,
      // MongoDB $dayOfWeek is 1=Sunday; the client's day table is 0-indexed.
      bestDayOfWeek: bestDay ? bestDay._id - 1 : null,
      bestHour: bestHour?._id ?? null,
    };
  }

  /**
   * Builds the peer population the merchant is compared against.
   *
   * Two things the previous version got wrong and this one does not: the
   * merchant's own offers sat inside their own "zone average" (so a merchant
   * alone in their city was compared against themselves), and a pastry shop was
   * averaged together with restaurants and supermarkets. We narrow to the same
   * establishment type first, widen to the whole city only when that peer set
   * is too thin to mean anything, and report which of the two happened so the
   * UI can say so instead of presenting a number with no provenance.
   */
  private async getZonePricingStats(merchantOid: Types.ObjectId): Promise<ZonePricingStats> {
    const estResult = await this.establishmentsService.findByOwnerId(merchantOid.toString());
    const establishment = estResult?.establishments?.[0];
    const city = establishment?.address?.city;
    const type = establishment?.type;

    // Without a city there is no local population to compare against, and a
    // platform-wide average across every city is not something the merchant can
    // act on.
    if (!city) {
      return { avgDiscountedPrice: 0, avgFillRate: 0, totalMerchants: 0, scope: 'none' };
    }

    const categoryScoped = type
      ? await this.aggregateZoneStats(merchantOid, city, type)
      : { avgDiscountedPrice: 0, avgFillRate: 0, totalMerchants: 0 };

    if (categoryScoped.totalMerchants >= OffersService.PRICING_MIN_PEERS) {
      return { ...categoryScoped, scope: 'category_city' };
    }

    const cityScoped = await this.aggregateZoneStats(merchantOid, city, null);

    if (cityScoped.totalMerchants > 0) {
      return { ...cityScoped, scope: 'city' };
    }

    return { avgDiscountedPrice: 0, avgFillRate: 0, totalMerchants: 0, scope: 'none' };
  }

  private async aggregateZoneStats(
    merchantOid: Types.ObjectId,
    city: string,
    type: EstablishmentType | null,
  ): Promise<Omit<ZonePricingStats, 'scope'>> {
    const since = OffersService.pricingWindowStart();

    const establishmentMatch: Record<string, unknown> = { 'est.address.city': city };
    if (type) {
      establishmentMatch['est.type'] = type;
    }

    const pipeline: PipelineStage[] = [
      {
        $match: {
          // Excluding the merchant's own offers is what makes this a comparison
          // rather than a mirror.
          merchantId: { $ne: merchantOid },
          createdAt: { $gte: since },
          status: { $in: OffersService.PRICING_PUBLISHED_STATUSES },
        },
      },
      {
        $lookup: {
          from: 'establishments',
          localField: 'establishmentId',
          foreignField: '_id',
          as: 'est',
          pipeline: [{ $project: { 'address.city': 1, type: 1 } }],
        },
      },
      { $unwind: { path: '$est', preserveNullAndEmptyArrays: false } },
      { $match: establishmentMatch },
      {
        $group: {
          _id: null,
          avgDiscountedPrice: { $avg: '$pricing.discountedPrice' },
          // Mirrors the merchant-side definition: concluded offers only.
          concludedQuantity: {
            $sum: {
              $cond: [
                { $in: ['$status', OffersService.PRICING_CONCLUDED_STATUSES] },
                '$totalQuantity',
                0,
              ],
            },
          },
          concludedSold: {
            $sum: {
              $cond: [
                { $in: ['$status', OffersService.PRICING_CONCLUDED_STATUSES] },
                '$soldQuantity',
                0,
              ],
            },
          },
          merchants: { $addToSet: '$merchantId' },
        },
      },
      {
        $project: {
          avgDiscountedPrice: 1,
          avgFillRate: {
            $cond: [
              { $gt: ['$concludedQuantity', 0] },
              { $multiply: [{ $divide: ['$concludedSold', '$concludedQuantity'] }, 100] },
              0,
            ],
          },
          totalMerchants: { $size: '$merchants' },
        },
      },
    ];

    const [zone] = (await this.offerModel.aggregate(pipeline).exec()) as Array<{
      avgDiscountedPrice: number | null;
      avgFillRate: number;
      totalMerchants: number;
    }>;

    return {
      avgDiscountedPrice: zone?.avgDiscountedPrice ?? 0,
      avgFillRate: zone?.avgFillRate ?? 0,
      totalMerchants: zone?.totalMerchants ?? 0,
    };
  }
}
