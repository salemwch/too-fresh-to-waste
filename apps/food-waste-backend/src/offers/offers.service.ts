import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Connection, Model, Types, isValidObjectId, PipelineStage, FlattenMaps } from 'mongoose';

import { CacheService } from '../common/services/cache.service';
import { AppLoggerService } from '../common/services/logger.service';
import { TimezoneUtil } from '../common/utils/timezone.util';
import { EstablishmentsService } from '../establishments/establishments.service';
import { StreakService } from '../sustainability/services/streak.service';
import {
  EstablishmentDocument,
  EstablishmentStatus,
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
import { Offer, OfferDocument, OfferStatus, OfferType, Currency } from './schemas/offer.schema';

// OFFER_LIST_FIELDS no longer needed — aggregation pipelines select fields via $project

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
  ) {}

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

  async create(createOfferDto: CreateOfferDto, merchantId: string): Promise<OfferDocument> {
    await this.validateEstablishmentOwnerOnly(createOfferDto.establishmentId, merchantId);
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
    const query: MongoQuery = {};
    const sort: MongoSort = {};

    if (
      (filters.merchantId === null || filters.merchantId === undefined) &&
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

    // ✅ SECURITY: Backend enforces time-based filtering for public queries
    // Users should only see currently available offers (not future or expired)
    // Merchants/admins can see all statuses via status filter
    if (
      (filters.merchantId === null || filters.merchantId === undefined) &&
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
        // Lookup merchant data
        {
          $lookup: {
            from: 'users',
            localField: 'merchantId',
            foreignField: '_id',
            as: 'merchantData',
          },
        },
        { $unwind: { path: '$merchantData', preserveNullAndEmptyArrays: true } },
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
            pickupTimeSlots: 1,
            status: 1,
            createdAt: 1,
            establishment: {
              _id: '$establishment._id',
              name: '$establishment.name',
              address: '$establishment.address',
              type: '$establishment.type',
              averageRating: '$establishment.averageRating',
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
        // ✅ Lookup merchant data for profileImage
        {
          $lookup: {
            from: 'users',
            localField: 'offers.merchantId',
            foreignField: '_id',
            as: 'merchantData',
          },
        },
        { $unwind: { path: '$merchantData', preserveNullAndEmptyArrays: true } },
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
            merchantId: 1, // ✅ Required for merchant profileImage
            pickupTimeSlots: 1, // ✅ Required for time range display
            status: 1,
            createdAt: 1,
            distance: 1,
            establishment: 1,
            isFeaturedManual: 1, // ✅ Required for featuring logic
            isFeaturedAuto: 1, // ✅ Required for featuring logic
            featuredAt: 1, // ✅ Required for featuring logic
            isPickupToday: 1, // ✅ Pickup categorization
            isPickupTomorrow: 1, // ✅ Pickup categorization
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

    // ✅ PERFORMANCE: Single aggregation pipeline replaces .find().populate().populate()
    // Reduces 3 DB round-trips (1 find + 2 populates) → 1 aggregation
    const pipeline: PipelineStage[] = [
      { $match: query },
      ...this.buildEstablishmentLookup(),
      ...this.buildMerchantLookup(),
      { $sort: sort },
      { $skip: skip },
      { $limit: safeLimit },
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
    merchantId: string,
    page: number = 1,
    limit: number = 10,
    userId?: string, // NEW: For isFavorite computation
    status?: OfferStatus,
  ): Promise<{ data: OfferCardDto[]; total: number }> {
    const filters: SearchOffersDto = { merchantId, page, limit };
    if (status !== null && status !== undefined) {
      filters.status = status;
    }
    const result = await this.findAll(page, limit, filters, userId);
    return result;
  }

  async update(
    id: string,
    updateOfferDto: UpdateOfferDto,
    userId: string,
    userRole: string,
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

    if (userRole !== 'admin' && merchantIdString !== userId) {
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

  async updateStatus(id: string, status: OfferStatus, merchantId?: string): Promise<OfferDocument> {
    // When a merchant tries to activate an offer, verify their establishment is approved.
    // Admin users pass no merchantId and bypass this check intentionally.
    if (status === OfferStatus.ACTIVE && merchantId) {
      const offer = await this.offerModel.findById(id).select('establishmentId merchantId').exec();

      if (!offer) {
        throw new NotFoundException('Offer not found');
      }

      if (offer.merchantId.toString() !== merchantId) {
        throw new ForbiddenException('You can only manage your own offers');
      }

      await this.validateEstablishmentOwnership(offer.establishmentId.toString(), merchantId);
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

    // Activating/deactivating an offer changes the featured and urgent lists
    void this.cacheService.delByPrefix('offers:featured:');
    void this.cacheService.delByPrefix('offers:urgent:');

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

    if (userRole !== 'admin' && merchantIdString !== userId) {
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
    void Promise.all([
      this.cacheService.delByPrefix('offers:featured:'),
      this.cacheService.delByPrefix('offers:urgent:'),
    ]);

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
  ): Promise<{ data: OfferCardDto[]; total: number }> {
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;

    const offerQuery = {
      status: OfferStatus.ACTIVE,
      isActive: true,
      isPickupToday: true,
    };

    // ✅ PERFORMANCE: Single aggregation replaces find + 2 populates (3 → 1 round-trip)
    const pipeline: PipelineStage[] = [
      { $match: offerQuery },
      ...this.buildEstablishmentLookup(),
      ...this.buildMerchantLookup(),
      { $sort: { availableUntil: 1 as const, createdAt: -1 as const } },
      { $skip: skip },
      { $limit: safeLimit },
    ];

    const [offers, total] = await Promise.all([
      this.offerModel.aggregate(pipeline).exec(),
      this.offerModel.countDocuments(offerQuery),
    ]);

    // Enrich with distance before DTO mapping
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

    const data = await this.mapOffersToDto(offers as OfferDocument[], userId);
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
  ): Promise<{ data: OfferCardDto[]; total: number }> {
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;

    const offerQuery = {
      status: OfferStatus.ACTIVE,
      isActive: true,
      isPickupTomorrow: true,
    };

    // ✅ PERFORMANCE: Single aggregation replaces find + 2 populates (3 → 1 round-trip)
    const pipeline: PipelineStage[] = [
      { $match: offerQuery },
      ...this.buildEstablishmentLookup(),
      ...this.buildMerchantLookup(),
      { $sort: { availableUntil: 1 as const, createdAt: -1 as const } },
      { $skip: skip },
      { $limit: safeLimit },
    ];

    const [offers, total] = await Promise.all([
      this.offerModel.aggregate(pipeline).exec(),
      this.offerModel.countDocuments(offerQuery),
    ]);

    // Enrich with distance before DTO mapping
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

    const data = await this.mapOffersToDto(offers as OfferDocument[], userId);
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
    userId?: string, // NEW: For isFavorite computation
  ): Promise<{ data: OfferCardDto[]; total: number }> {
    const cacheKey = `offers:featured:${page}:${Math.min(limit, 100)}:${userId ?? 'anon'}`;
    const result = await this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const offers = await this.fetchFeaturedOffers(page, limit, userId);
        return offers;
      },
      OffersService.TTL_FEATURED,
    );
    return result;
  }

  private async fetchFeaturedOffers(
    page: number,
    limit: number,
    userId?: string,
  ): Promise<{ data: OfferCardDto[]; total: number }> {
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

    // ✅ Map to DTOs with isFavorite field
    const data = await this.mapOffersToDto(offers as OfferDocument[], userId);

    return { data, total };
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
      // ✅ Lookup merchant details
      {
        $lookup: {
          from: 'users',
          localField: 'offers.merchantId',
          foreignField: '_id',
          as: 'merchant',
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
                },
                distance: '$distance',
                merchant: { $arrayElemAt: ['$merchant', 0] },
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
          'merchant.profileImage': 1, // ✅ Merchant profile image for OfferCard logo
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
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;

    const now = new Date();
    const expiryTime = new Date(now.getTime() + hoursUntilExpiry * 60 * 60 * 1000);

    const query = {
      status: OfferStatus.ACTIVE,
      availableUntil: { $lte: expiryTime, $gte: now },
    };

    // ✅ PERFORMANCE: Single aggregation replaces find + 2 populates (3 → 1 round-trip)
    // Note: buildMerchantLookup(true) includes email for expiring-offer notifications
    const pipeline: PipelineStage[] = [
      { $match: query },
      ...this.buildEstablishmentLookup(),
      ...this.buildMerchantLookup(true),
      { $sort: { availableUntil: 1 as const } },
      { $skip: skip },
      { $limit: safeLimit },
    ];

    const [offers, total] = await Promise.all([
      this.offerModel.aggregate(pipeline).exec(),
      this.offerModel.countDocuments(query),
    ]);

    // Enrich raw offers with distance before DTO mapping
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

    const data = await this.mapOffersToDto(offers as OfferDocument[], userId);

    return { data, total };
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
  ): Promise<{ data: OfferCardDto[]; total: number }> {
    // Location-based results vary per user — only cache the non-location variant
    if (userLocation) {
      return this.getExpiringOffers(hoursUntilExpiry, page, limit, userId, userLocation);
    }
    const safeLimit = Math.min(limit, 100);
    const cacheKey = `offers:urgent:${hoursUntilExpiry}:${page}:${safeLimit}:${userId ?? 'anon'}`;
    const result = await this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const offers = await this.getExpiringOffers(hoursUntilExpiry, page, limit, userId);
        return offers;
      },
      OffersService.TTL_URGENT,
    );
    return result;
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
      // ✅ Populate merchant details
      {
        $lookup: {
          from: 'users',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchant',
        },
      },
      { $unwind: { path: '$merchant', preserveNullAndEmptyArrays: true } },
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
          'establishment.profileImage': 1,
          // Merchant details
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
          pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$refId'] } } }, { $project: fields }],
          as: '_establishmentDoc',
        },
      },
      { $unwind: { path: '$_establishmentDoc', preserveNullAndEmptyArrays: true } },
      { $addFields: { establishmentId: '$_establishmentDoc' } },
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
      { $addFields: { merchantId: '$_merchantDoc' } },
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
  ): Promise<EstablishmentDocument> {
    const establishment = await this.establishmentsService.findById(establishmentId);

    if (establishment.ownerId.toString() !== merchantId) {
      throw new ForbiddenException('You can only create offers for your own establishment');
    }

    if (establishment.status !== EstablishmentStatus.ACTIVE) {
      throw new ForbiddenException(
        'Your establishment must be approved before you can activate offers. ' +
          `Current status: ${establishment.status}`,
      );
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
  ): Promise<EstablishmentDocument> {
    const establishment = await this.establishmentsService.findById(establishmentId);

    if (establishment.ownerId.toString() !== merchantId) {
      throw new ForbiddenException('You can only create offers for your own establishment');
    }

    // Trial-expiry gate: merchant can still log in and manage existing offers,
    // but cannot create new ones until admin reactivates their subscription.
    if (establishment.subscriptionStatus === 'suspended') {
      throw new ForbiddenException({
        code: 'TRIAL_EXPIRED',
        message:
          'Your free trial has ended. Contact the admin team to reactivate your account before creating new offers.',
      });
    }

    return establishment;
  }

  /**
   * Calculates discount percentage from prices and enforces business rules
   * ✅ SECURITY: Backend-calculated, user has no control over discount percentage
   * ✅ BUSINESS: Enforces 50-90% discount range for food waste reduction legitimacy
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

    // ✅ BUSINESS: Enforce minimum 50% discount
    if (discountPercentage < 50 || discountPercentage > 90) {
      throw new BadRequestException(
        `Discount must be between 50% and 90%. Your prices result in ${discountPercentage}% discount.`,
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

    if (userRole !== 'admin' && merchantIdString !== userId) {
      throw new ForbiddenException('You can only reactivate your own offers');
    }

    // Establishment approval guard — merchants cannot reactivate offers
    // for establishments that have not yet been approved by an admin.
    if (userRole !== 'admin') {
      const populatedEstablishmentId =
        typeof offer.establishmentId === 'object'
          ? (offer.establishmentId as PopulatedEstRef)._id
          : undefined;
      const establishmentId = populatedEstablishmentId
        ? populatedEstablishmentId.toString()
        : offer.establishmentId.toString();

      await this.validateEstablishmentOwnership(establishmentId, userId);
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

    if (userRole !== 'admin' && merchantIdString !== userId) {
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
    void this.cacheService.delByPrefix('offers:featured:');

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
  async handleAutoFeaturing() {
    if (!AUTO_FEATURE_ENABLED) {
      return;
    }

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
  async handleUpdateExpired() {
    const updated = await this.updateExpiredOffers();
    if (updated > 0) {
      this.logger.log(`Expired offers updated: ${updated}`, 'OffersService');
    }
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
}
