import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage, FilterQuery } from 'mongoose';

import { decodeHtmlEntities } from '../../common/utils/decode-html-entities.util';
import { RegexSecurityUtil } from '../../common/utils/regex-security.util';
import {
  Establishment,
  EstablishmentDocument,
  EstablishmentStatus,
} from '../../establishments/schemas/establishment.schema';
import { Offer, OfferDocument, OfferStatus } from '../../offers/schemas/offer.schema';
import { ProximitySearchDto } from '../dto/geolocation.dto';
import {
  ProximitySearchResult,
  EstablishmentGeoData,
  OfferGeoData,
  MapEstablishmentGeoData,
  MapOfferSummary,
  GeoCoordinate,
  DistanceUnit,
  AddressInfo,
} from '../interfaces/geolocation.interface';
// EARTH_RADIUS is no longer needed here: it existed to convert the radius into
// radians for $centerSphere. $geoNear takes `maxDistance` in metres directly,
// which also removes the risk of that constant drifting from the one
// DistanceCalculator uses and quietly misaligning the filter boundary with the
// distance shown to the user.
import { DistanceCalculator } from '../utils/distance.util';

export interface ProximitySearchOptions {
  includeEstablishments?: boolean | undefined;
  includeOffers?: boolean | undefined;
  establishmentTypes?: string[] | undefined;
  offerCategories?: string[] | undefined;
  minRating?: number | undefined;
  maxPrice?: number | undefined;
  onlyActive?: boolean | undefined;
}

interface OfferEstablishmentLookupResult {
  establishmentId?: {
    _id: Types.ObjectId;
    address?: {
      coordinates?: {
        coordinates?: [number, number];
      };
    };
  };
}

interface AggregatedAddress extends AddressInfo {
  street?: string | undefined;
}

interface EstablishmentSearchAggregate {
  _id: Types.ObjectId;
  name: string;
  type: string;
  address: AggregatedAddress;
  averageRating?: number;
  totalOffers?: number;
  isActive: boolean;
  isVerified: boolean;
  coordinates: [number, number];
}

interface OfferLookupEstablishmentAggregate {
  name: string;
  address: AggregatedAddress;
  averageRating?: number;
  profileImage?: string | null | undefined;
}

interface OfferSearchAggregate {
  _id: Types.ObjectId;
  title: string;
  establishmentId: Types.ObjectId;
  establishment: OfferLookupEstablishmentAggregate;
  pricing: OfferGeoData['pricing'];
  availableFrom: Date;
  availableUntil: Date;
  availableQuantity: number;
  categories: string[];
  images: string[];
}

interface MapOfferAggregate {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  pricing: MapOfferSummary['pricing'];
  availableFrom: Date;
  availableUntil: Date;
  availableQuantity: number;
  categories?: string[];
  images?: string[];
}

interface MapEstablishmentAggregate {
  _id: Types.ObjectId;
  name: string;
  type: string;
  profileImage?: string | null | undefined;
  address: AggregatedAddress;
  averageRating?: number;
  totalReviews?: number;
  isVerified?: boolean;
  activeOfferCount: number;
  activeOffers?: MapOfferAggregate[];
  coordinates: [number, number];
}

@Injectable()
export class ProximitySearchService {
  private readonly logger = new Logger(ProximitySearchService.name);
  private readonly regexUtil = new RegexSecurityUtil();

  constructor(
    @InjectModel(Establishment.name)
    private readonly establishmentModel: Model<EstablishmentDocument>,
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
  ) {}

  /**
   * Search establishments within proximity
   */
  async searchEstablishments(
    searchDto: ProximitySearchDto,
    options: ProximitySearchOptions = {},
  ): Promise<ProximitySearchResult<EstablishmentGeoData>[]> {
    try {
      if (!DistanceCalculator.isValidCoordinate(searchDto.center)) {
        throw new BadRequestException('Invalid search center coordinates');
      }

      this.logger.log(
        `Searching establishments within ${searchDto.radius}m of ${searchDto.center.latitude}, ${searchDto.center.longitude}`,
      );

      // Convert center to GeoJSON point for MongoDB query
      const centerPoint = DistanceCalculator.coordinateToPoint(searchDto.center);

      // Build MongoDB aggregation pipeline
      const pipeline: PipelineStage[] = [];

      /*
       * Non-geo filters. These go into $geoNear's `query` option rather than a
       * separate $match, so MongoDB applies them *during* the index walk and
       * can stop as soon as $limit is satisfied. A trailing $match would force
       * the index to yield every document in the radius first.
       *
       * The geo predicate itself is NOT here — $geoNear owns it.
       */
      const matchConditions: FilterQuery<EstablishmentDocument> = {
        status:
          options.onlyActive !== false
            ? EstablishmentStatus.ACTIVE
            : { $ne: EstablishmentStatus.REJECTED },
        isActive: true,
      };

      // Add category filters
      if (searchDto.categories && searchDto.categories.length > 0) {
        matchConditions.type = { $in: searchDto.categories };
      }

      if (options.establishmentTypes && options.establishmentTypes.length > 0) {
        matchConditions.type = { $in: options.establishmentTypes };
      }

      // Add rating filter
      if (options.minRating) {
        matchConditions.averageRating = { $gte: options.minRating };
      }

      // Exclude specific IDs
      if (searchDto.excludeIds && searchDto.excludeIds.length > 0) {
        const excludeObjectIds = searchDto.excludeIds
          .filter(id => Types.ObjectId.isValid(id))
          .map(id => new Types.ObjectId(id));

        if (excludeObjectIds.length > 0) {
          matchConditions._id = { $nin: excludeObjectIds };
        }
      }

      // Text search on name, city, and street; address.street has no index — set is already narrowed by $geoWithin
      if (searchDto.query) {
        const searchFields = this.regexUtil.buildMultiFieldSearch(searchDto.query, [
          'name',
          'address.city',
          'address.street',
        ]);
        if (searchFields.length > 0) {
          matchConditions.$or = searchFields;
        }
      }

      /*
       * $geoNear replaces three stages that used to follow a $geoWithin match:
       * an $addFields computing haversine in aggregation trigonometry, a $sort
       * on that computed field, and the implicit cost of both.
       *
       * Why that mattered: $geoWithin uses the 2dsphere index to *filter* but
       * returns documents unordered, so the $sort was a blocking in-memory sort
       * over every establishment in the radius — with no index to satisfy it and
       * no allowDiskUse. MongoDB caps blocking sorts at 100 MB and then fails
       * the query outright, so a dense enough neighbourhood did not merely get
       * slow, it errored. Computing trigonometry for 10,000 establishments to
       * return 20 was the cheaper half of the problem.
       *
       * $geoNear walks the 2dsphere index in ascending distance order and emits
       * documents already sorted, writing the distance into `distanceField`
       * itself. $limit can then short-circuit the walk.
       *
       * It must be the FIRST stage in the pipeline — hence the non-geo filters
       * moving into `query` above.
       */
      pipeline.push({
        $geoNear: {
          near: { type: 'Point', coordinates: centerPoint.coordinates },
          distanceField: 'distance',
          maxDistance: searchDto.radius,
          spherical: true,
          key: 'address.coordinates',
          query: matchConditions,
        },
      });

      /*
       * No $sort: $geoNear already emits in ascending distance order.
       *
       * `sortByDistance: false` asks for an unspecified order, and the cheapest
       * correct way to honour that is to leave the index order alone — imposing
       * a different one would reintroduce exactly the blocking sort this change
       * removes. Distance-ascending is a valid answer to "any order".
       */
      if (searchDto.skip && searchDto.skip > 0) {
        pipeline.push({ $skip: searchDto.skip });
      }

      pipeline.push({ $limit: searchDto.limit ?? 20 });

      // Project only needed fields
      pipeline.push({
        $project: {
          name: 1,
          type: 1,
          address: 1,
          averageRating: 1,
          totalOffers: 1,
          totalReviews: 1,
          isActive: 1,
          isVerified: 1,
          images: { $slice: ['$images', 3] }, // First 3 images only
          distance: 1,
          coordinates: '$address.coordinates.coordinates',
        },
      });

      const establishments =
        await this.establishmentModel.aggregate<EstablishmentSearchAggregate>(pipeline);

      // Transform results to ProximitySearchResult format
      const results: ProximitySearchResult<EstablishmentGeoData>[] = establishments.map(est => {
        const coordinates: GeoCoordinate = {
          longitude: est.coordinates[0],
          latitude: est.coordinates[1],
        };

        const distance = DistanceCalculator.calculateDistance(
          searchDto.center,
          coordinates,
          DistanceUnit.METERS,
        );

        const establishmentData: EstablishmentGeoData = {
          _id: est._id.toString(),
          name: decodeHtmlEntities(est.name),
          type: est.type,
          address: {
            street: est.address.street,
            city: est.address.city,
            postalCode: est.address.postalCode,
            country: est.address.country,
            formattedAddress: `${est.address.street}, ${est.address.city} ${est.address.postalCode}`,
          },
          coordinates,
          ...(est.averageRating !== undefined ? { averageRating: est.averageRating } : {}),
          ...(est.totalOffers !== undefined ? { totalOffers: est.totalOffers } : {}),
          isActive: est.isActive,
          isVerified: est.isVerified,
        };

        return {
          item: establishmentData,
          distance,
          geoData: {
            coordinates,
            address: establishmentData.address,
          },
        };
      });

      this.logger.log(`Found ${results.length} establishments within radius`);
      return results;
    } catch (error) {
      this.logger.error('Failed to search establishments:', error);
      throw error;
    }
  }

  /**
   * Search offers within proximity
   */
  async searchOffers(
    searchDto: ProximitySearchDto,
    options: ProximitySearchOptions = {},
  ): Promise<ProximitySearchResult<OfferGeoData>[]> {
    try {
      if (!DistanceCalculator.isValidCoordinate(searchDto.center)) {
        throw new BadRequestException('Invalid search center coordinates');
      }

      this.logger.log(
        `Searching offers within ${searchDto.radius}m of ${searchDto.center.latitude}, ${searchDto.center.longitude}`,
      );

      // First, get establishments within the search radius
      const establishmentResults = await this.searchEstablishments(searchDto, {
        ...options,
        onlyActive: true,
      });

      if (establishmentResults.length === 0) {
        return [];
      }

      const establishmentIds = establishmentResults.map(est => new Types.ObjectId(est.item._id));

      // Build offer query
      const offerMatchConditions: FilterQuery<OfferDocument> = {
        establishmentId: { $in: establishmentIds },
        status: OfferStatus.ACTIVE,
        isActive: true,
        availableUntil: { $gte: new Date() },
      };

      // Add category filters
      if (searchDto.categories && searchDto.categories.length > 0) {
        offerMatchConditions.categories = { $in: searchDto.categories };
      }

      if (options.offerCategories && options.offerCategories.length > 0) {
        offerMatchConditions.categories = { $in: options.offerCategories };
      }

      // Add price filter
      if (options.maxPrice) {
        offerMatchConditions['pricing.discountedPrice'] = { $lte: options.maxPrice };
      }

      // Add tags filter
      if (searchDto.tags && searchDto.tags.length > 0) {
        offerMatchConditions.tags = { $in: searchDto.tags };
      }

      // Exclude specific IDs
      if (searchDto.excludeIds && searchDto.excludeIds.length > 0) {
        const excludeObjectIds = searchDto.excludeIds
          .filter(id => Types.ObjectId.isValid(id))
          .map(id => new Types.ObjectId(id));

        if (excludeObjectIds.length > 0) {
          offerMatchConditions._id = { $nin: excludeObjectIds };
        }
      }

      // Execute offer query with establishment lookup
      const offerPipeline: PipelineStage[] = [
        { $match: offerMatchConditions },

        // Lookup establishment data (with merchant profile image via ownerId → users)
        {
          $lookup: {
            from: 'establishments',
            localField: 'establishmentId',
            foreignField: '_id',
            as: 'establishment',
            pipeline: [
              {
                $lookup: {
                  from: 'users',
                  localField: 'ownerId',
                  foreignField: '_id',
                  pipeline: [{ $project: { profileImage: 1, avatar: 1 } }],
                  as: 'ownerData',
                },
              },
              {
                $project: {
                  name: 1,
                  type: 1,
                  address: 1,
                  averageRating: 1,
                  profileImage: {
                    $ifNull: [
                      { $arrayElemAt: ['$images', 0] },
                      { $arrayElemAt: ['$ownerData.profileImage', 0] },
                      { $arrayElemAt: ['$ownerData.avatar', 0] },
                      null,
                    ],
                  },
                },
              },
            ],
          },
        },

        { $unwind: '$establishment' },

        // Offer text search — establishment address fields not applicable here
        ...(searchDto.query
          ? (() => {
              const searchFields = this.regexUtil.buildMultiFieldSearch(searchDto.query, [
                'title',
                'description',
                'establishment.name',
              ]);
              return searchFields.length > 0 ? [{ $match: { $or: searchFields } }] : [];
            })()
          : []),

        // Add virtual fields for available quantity
        {
          $addFields: {
            availableQuantity: {
              $subtract: ['$totalQuantity', { $add: ['$reservedQuantity', '$soldQuantity'] }],
            },
          },
        },

        // Filter out sold out offers
        {
          $match: {
            availableQuantity: { $gt: 0 },
          },
        },

        // Project needed fields
        {
          $project: {
            title: 1,
            description: 1,
            establishmentId: 1,
            pricing: 1,
            availableFrom: 1,
            availableUntil: 1,
            availableQuantity: 1,
            categories: 1,
            tags: 1,
            images: { $slice: ['$images', 3] },
            pickupTimeSlots: 1,
            'establishment.name': 1,
            'establishment.address': 1,
            'establishment.averageRating': 1,
            'establishment.profileImage': 1,
          },
        },
      ];

      // Apply pagination
      if (searchDto.skip && searchDto.skip > 0) {
        offerPipeline.push({ $skip: searchDto.skip });
      }
      offerPipeline.push({ $limit: searchDto.limit ?? 20 });

      const offers = await this.offerModel.aggregate<OfferSearchAggregate>(offerPipeline);

      // Create a map of establishment coordinates for quick lookup
      const establishmentCoordMap = new Map<
        string,
        { coordinates: GeoCoordinate; address: EstablishmentGeoData['address'] }
      >();
      establishmentResults.forEach(est => {
        establishmentCoordMap.set(est.item._id, {
          coordinates: est.item.coordinates,
          address: est.item.address,
        });
      });

      // Transform results to ProximitySearchResult format
      const results: ProximitySearchResult<OfferGeoData>[] = [];

      for (const offer of offers) {
        const establishmentGeoData = establishmentCoordMap.get(offer.establishmentId.toString());
        if (!establishmentGeoData) {
          continue;
        }

        const distance = DistanceCalculator.calculateDistance(
          searchDto.center,
          establishmentGeoData.coordinates,
          DistanceUnit.METERS,
        );

        const offerData: OfferGeoData = {
          _id: offer._id.toString(),
          title: offer.title,
          establishmentId: offer.establishmentId.toString(),
          establishmentName: decodeHtmlEntities(offer.establishment.name),
          establishmentLogo: offer.establishment.profileImage ?? null,
          coordinates: establishmentGeoData.coordinates,
          address: establishmentGeoData.address,
          pricing: offer.pricing,
          availableFrom: offer.availableFrom,
          availableUntil: offer.availableUntil,
          availableQuantity: offer.availableQuantity,
          categories: offer.categories,
          images: offer.images,
        };

        results.push({
          item: offerData,
          distance,
          geoData: {
            coordinates: establishmentGeoData.coordinates,
            address: establishmentGeoData.address,
          },
        });
      }

      // Sort by distance if requested
      if (searchDto.sortByDistance !== false) {
        results.sort((a, b) => a.distance.value - b.distance.value);
      }

      this.logger.log(`Found ${results.length} offers within radius`);
      return results;
    } catch (error) {
      this.logger.error('Failed to search offers:', error);
      throw error;
    }
  }

  /**
   * Search both establishments and offers within proximity
   */
  async searchAll(
    searchDto: ProximitySearchDto,
    options: ProximitySearchOptions = {},
  ): Promise<{
    establishments: ProximitySearchResult<EstablishmentGeoData>[];
    offers: ProximitySearchResult<OfferGeoData>[];
    totalResults: number;
  }> {
    try {
      const [establishments, offers] = await Promise.all([
        options.includeEstablishments !== false
          ? this.searchEstablishments(searchDto, options)
          : [],
        options.includeOffers !== false ? this.searchOffers(searchDto, options) : [],
      ]);

      return {
        establishments,
        offers,
        totalResults: establishments.length + offers.length,
      };
    } catch (error) {
      this.logger.error('Failed to search all:', error);
      throw error;
    }
  }

  /**
   * Get nearby establishments for a specific offer (for recommendations)
   */
  async getNearbyEstablishments(
    offerId: string,
    radius: number = 2000, // 2km default
  ): Promise<ProximitySearchResult<EstablishmentGeoData>[]> {
    try {
      // Fetch offer with establishment data via $lookup (single round-trip)
      const pipeline: PipelineStage[] = [
        { $match: { _id: new Types.ObjectId(offerId) } },
        { $limit: 1 },
        {
          $lookup: {
            from: 'establishments',
            let: { estId: '$establishmentId' },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$estId'] } } },
              { $project: { _id: 1, address: 1 } },
            ],
            as: 'establishmentId',
          },
        },
        { $unwind: { path: '$establishmentId', preserveNullAndEmptyArrays: true } },
      ];

      const [offer] = await this.offerModel.aggregate<OfferEstablishmentLookupResult>(pipeline);

      if (offer === undefined) {
        throw new BadRequestException('Offer not found');
      }

      const establishment = offer.establishmentId;
      const coordinates = establishment?.address?.coordinates?.coordinates;
      if (establishment === null || establishment === undefined || coordinates?.length !== 2) {
        throw new BadRequestException('Establishment coordinates not found');
      }

      const centerCoordinates: GeoCoordinate = {
        longitude: coordinates[0],
        latitude: coordinates[1],
      };

      // Search nearby establishments excluding the current one
      const searchDto: ProximitySearchDto = {
        center: centerCoordinates,
        radius,
        excludeIds: [establishment._id.toString()],
        limit: 10,
      };

      return await this.searchEstablishments(searchDto, { onlyActive: true });
    } catch (error) {
      this.logger.error('Failed to get nearby establishments:', error);
      throw error;
    }
  }

  /**
   * Get establishments within delivery/pickup radius for user location
   */
  async getEstablishmentsInDeliveryRadius(
    userLocation: GeoCoordinate,
    maxRadius: number = 10000, // 10km default
  ): Promise<ProximitySearchResult<EstablishmentGeoData>[]> {
    try {
      const searchDto: ProximitySearchDto = {
        center: userLocation,
        radius: maxRadius,
        sortByDistance: true,
        limit: 50,
      };

      return await this.searchEstablishments(searchDto, {
        onlyActive: true,
        includeEstablishments: true,
      });
    } catch (error) {
      this.logger.error('Failed to get establishments in delivery radius:', error);
      throw error;
    }
  }

  /**
   * Search establishments with their active offers for the map view.
   * Single aggregation pipeline: geo-filter → $lookup offers → project.
   */
  async searchMapEstablishments(
    searchDto: ProximitySearchDto,
    options: ProximitySearchOptions = {},
  ): Promise<ProximitySearchResult<MapEstablishmentGeoData>[]> {
    try {
      if (!DistanceCalculator.isValidCoordinate(searchDto.center)) {
        throw new BadRequestException('Invalid search center coordinates');
      }

      this.logger.log(
        `Searching map establishments within ${searchDto.radius}m of ${searchDto.center.latitude}, ${searchDto.center.longitude}`,
      );

      const centerPoint = DistanceCalculator.coordinateToPoint(searchDto.center);
      const now = new Date();

      // ── Non-geo filters (passed to $geoNear's `query`, see pipeline) ────
      const matchConditions: FilterQuery<EstablishmentDocument> = {
        status:
          options.onlyActive !== false
            ? EstablishmentStatus.ACTIVE
            : { $ne: EstablishmentStatus.REJECTED },
        isActive: true,
      };

      if (options.establishmentTypes?.length) {
        matchConditions.type = { $in: options.establishmentTypes };
      }
      if (options.minRating) {
        matchConditions.averageRating = { $gte: options.minRating };
      }
      if (searchDto.excludeIds?.length) {
        const ids = searchDto.excludeIds
          .filter(id => Types.ObjectId.isValid(id))
          .map(id => new Types.ObjectId(id));
        if (ids.length) {
          matchConditions._id = { $nin: ids };
        }
      }
      if (searchDto.query) {
        const fields = this.regexUtil.buildMultiFieldSearch(searchDto.query, [
          'name',
          'address.city',
          'address.street',
        ]);
        if (fields.length) {
          matchConditions.$or = fields;
        }
      }

      const pipeline: PipelineStage[] = [
        /*
         * $geoNear first — it must be, and it wants to be.
         *
         * It walks the 2dsphere index in ascending distance order, applies the
         * non-geo filters during that walk, and writes the distance into
         * `distance` itself. That removes the blocking in-memory $sort that used
         * to run after a $geoWithin match (unindexed, capped at 100 MB, so a
         * dense enough area errored rather than merely slowed) and the
         * aggregation-trigonometry $addFields that fed it.
         */
        {
          $geoNear: {
            near: { type: 'Point', coordinates: centerPoint.coordinates },
            distanceField: 'distance',
            maxDistance: searchDto.radius,
            spherical: true,
            key: 'address.coordinates',
            query: matchConditions,
          },
        },

        /*
         * Paginate BEFORE the lookups.
         *
         * This is the larger win on this endpoint. Both $lookups below used to
         * run for every establishment inside the radius — a users join and an
         * offers sub-pipeline each — and only then did $limit discard all but
         * 50. In a dense area that is thousands of joins performed to throw
         * away. Nothing after the lookups filters on their output, so limiting
         * first is behaviour-preserving: at most `limit` establishments are
         * ever enriched.
         *
         * Safe only because $geoNear has already ordered the stream. Against an
         * unordered source, an early $limit would pick arbitrary rows.
         */
        ...(searchDto.skip && searchDto.skip > 0 ? [{ $skip: searchDto.skip }] : []),
        { $limit: searchDto.limit ?? 50 },

        // ── Lookup merchant profile image from users ───────────────────
        {
          $lookup: {
            from: 'users',
            localField: 'ownerId',
            foreignField: '_id',
            pipeline: [{ $project: { profileImage: 1, avatar: 1 } }],
            as: 'ownerData',
          },
        },

        // ── Lookup active offers per establishment ─────────────────────
        {
          $lookup: {
            from: 'offers',
            let: { estId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$establishmentId', '$$estId'] },
                  status: OfferStatus.ACTIVE,
                  isActive: true,
                  availableUntil: { $gte: now },
                },
              },
              {
                $addFields: {
                  availableQuantity: {
                    $subtract: ['$totalQuantity', { $add: ['$reservedQuantity', '$soldQuantity'] }],
                  },
                },
              },
              { $match: { availableQuantity: { $gt: 0 } } },
              {
                $project: {
                  title: 1,
                  description: 1,
                  pricing: 1,
                  availableFrom: 1,
                  availableUntil: 1,
                  availableQuantity: 1,
                  categories: 1,
                  images: { $slice: ['$images', 3] },
                },
              },
              { $limit: 20 },
            ],
            as: 'activeOffers',
          },
        },

        // ── Computed fields ────────────────────────────────────────────
        // `distance` is supplied by $geoNear; only the offer count is derived.
        // Cheap here: it runs on at most `limit` documents, not the whole radius.
        {
          $addFields: {
            activeOfferCount: { $size: '$activeOffers' },
          },
        },

        // Sorting and pagination already happened — $geoNear ordered the stream
        // and $skip/$limit ran before the lookups.

        // ── Project ────────────────────────────────────────────────────
        {
          $project: {
            name: 1,
            type: 1,
            address: 1,
            averageRating: 1,
            totalReviews: 1,
            isVerified: 1,
            profileImage: {
              $ifNull: [
                { $arrayElemAt: ['$images', 0] },
                { $arrayElemAt: ['$ownerData.profileImage', 0] },
                { $arrayElemAt: ['$ownerData.avatar', 0] },
                null,
              ],
            },
            activeOfferCount: 1,
            activeOffers: 1,
            distance: 1,
            coordinates: '$address.coordinates.coordinates',
          },
        },
      ];

      const establishments =
        await this.establishmentModel.aggregate<MapEstablishmentAggregate>(pipeline);

      // ── Transform to ProximitySearchResult ──────────────────────────
      const results: ProximitySearchResult<MapEstablishmentGeoData>[] = establishments.map(est => {
        const coordinates: GeoCoordinate = {
          longitude: est.coordinates[0],
          latitude: est.coordinates[1],
        };

        const distance = DistanceCalculator.calculateDistance(
          searchDto.center,
          coordinates,
          DistanceUnit.METERS,
        );

        const itemData: MapEstablishmentGeoData = {
          _id: est._id.toString(),
          name: decodeHtmlEntities(est.name),
          type: est.type,
          profileImage: est.profileImage ?? null,
          coordinates,
          address: {
            street: est.address.street,
            city: est.address.city,
            postalCode: est.address.postalCode,
            country: est.address.country,
            formattedAddress: `${est.address.street}, ${est.address.city} ${est.address.postalCode}`,
          },
          averageRating: est.averageRating ?? 0,
          totalReviews: est.totalReviews ?? 0,
          isVerified: est.isVerified ?? false,
          activeOfferCount: est.activeOfferCount,
          offers: (est.activeOffers ?? []).map(o => ({
            _id: o._id.toString(),
            title: o.title,
            description: o.description ?? '',
            pricing: o.pricing,
            availableFrom: o.availableFrom,
            availableUntil: o.availableUntil,
            availableQuantity: o.availableQuantity,
            categories: o.categories ?? [],
            images: o.images ?? [],
          })),
        };

        return {
          item: itemData,
          distance,
          geoData: { coordinates, address: itemData.address },
        };
      });

      this.logger.log(`Found ${results.length} map establishments within radius`);
      return results;
    } catch (error) {
      this.logger.error('Failed to search map establishments:', error);
      throw error;
    }
  }
}
