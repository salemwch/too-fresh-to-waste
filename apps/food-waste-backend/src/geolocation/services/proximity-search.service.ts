import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage, FilterQuery } from 'mongoose';

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

      // Convert radius from meters to radians for $centerSphere
      // Earth's radius is ~6378.1 km = 6378100 meters
      const radiusInRadians = searchDto.radius / 6378100;

      // Match stage - filter by location and other criteria
      // Using $geoWithin with $centerSphere instead of $near (works in aggregation pipelines)
      const matchConditions: FilterQuery<EstablishmentDocument> = {
        'address.coordinates': {
          $geoWithin: {
            $centerSphere: [
              [centerPoint.coordinates[0], centerPoint.coordinates[1]], // [lng, lat]
              radiusInRadians,
            ],
          },
        },
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
          .filter((id) => Types.ObjectId.isValid(id))
          .map((id) => new Types.ObjectId(id));

        if (excludeObjectIds.length > 0) {
          matchConditions._id = { $nin: excludeObjectIds };
        }
      }

      // Text search on establishment name (reuses RegexSecurityUtil for ReDoS protection)
      if (searchDto.query) {
        const searchFields = this.regexUtil.buildMultiFieldSearch(searchDto.query, ['name']);
        if (searchFields.length > 0) {
          matchConditions.$or = searchFields;
        }
      }

      pipeline.push({ $match: matchConditions });

      // Add calculated distance field
      pipeline.push({
        $addFields: {
          distance: {
            $let: {
              vars: {
                lon1: { $arrayElemAt: ['$address.coordinates.coordinates', 0] },
                lat1: { $arrayElemAt: ['$address.coordinates.coordinates', 1] },
                lon2: centerPoint.coordinates[0],
                lat2: centerPoint.coordinates[1],
              },
              in: {
                $multiply: [
                  6371000, // Earth radius in meters
                  {
                    $acos: {
                      $add: [
                        {
                          $multiply: [
                            { $sin: { $degreesToRadians: '$$lat1' } },
                            { $sin: { $degreesToRadians: '$$lat2' } },
                          ],
                        },
                        {
                          $multiply: [
                            { $cos: { $degreesToRadians: '$$lat1' } },
                            { $cos: { $degreesToRadians: '$$lat2' } },
                            { $cos: { $degreesToRadians: { $subtract: ['$$lon2', '$$lon1'] } } },
                          ],
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      });

      // Sort by distance if requested
      if (searchDto.sortByDistance !== false) {
        pipeline.push({ $sort: { distance: 1 } });
      }

      // Pagination
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
      const results: ProximitySearchResult<EstablishmentGeoData>[] = establishments.map((est) => {
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
          name: est.name,
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

      const establishmentIds = establishmentResults.map((est) => new Types.ObjectId(est.item._id));

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
          .filter((id) => Types.ObjectId.isValid(id))
          .map((id) => new Types.ObjectId(id));

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
                      { $arrayElemAt: ['$ownerData.profileImage', 0] },
                      { $ifNull: [{ $arrayElemAt: ['$ownerData.avatar', 0] }, null] },
                    ],
                  },
                },
              },
            ],
          },
        },

        { $unwind: '$establishment' },

        // Text query filter: match offer title OR establishment name
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
      establishmentResults.forEach((est) => {
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
          establishmentName: offer.establishment.name,
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
      const radiusInRadians = searchDto.radius / 6378100;
      const now = new Date();

      // ── Match: geo + active ────────────────────────────────────────────
      const matchConditions: FilterQuery<EstablishmentDocument> = {
        'address.coordinates': {
          $geoWithin: {
            $centerSphere: [
              [centerPoint.coordinates[0], centerPoint.coordinates[1]],
              radiusInRadians,
            ],
          },
        },
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
          .filter((id) => Types.ObjectId.isValid(id))
          .map((id) => new Types.ObjectId(id));
        if (ids.length) {
          matchConditions._id = { $nin: ids };
        }
      }
      if (searchDto.query) {
        const fields = this.regexUtil.buildMultiFieldSearch(searchDto.query, ['name']);
        if (fields.length) {
          matchConditions.$or = fields;
        }
      }

      const pipeline: PipelineStage[] = [
        { $match: matchConditions },

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
        {
          $addFields: {
            activeOfferCount: { $size: '$activeOffers' },
            distance: {
              $let: {
                vars: {
                  lon1: { $arrayElemAt: ['$address.coordinates.coordinates', 0] },
                  lat1: { $arrayElemAt: ['$address.coordinates.coordinates', 1] },
                  lon2: centerPoint.coordinates[0],
                  lat2: centerPoint.coordinates[1],
                },
                in: {
                  $multiply: [
                    6371000,
                    {
                      $acos: {
                        $add: [
                          {
                            $multiply: [
                              { $sin: { $degreesToRadians: '$$lat1' } },
                              { $sin: { $degreesToRadians: '$$lat2' } },
                            ],
                          },
                          {
                            $multiply: [
                              { $cos: { $degreesToRadians: '$$lat1' } },
                              { $cos: { $degreesToRadians: '$$lat2' } },
                              { $cos: { $degreesToRadians: { $subtract: ['$$lon2', '$$lon1'] } } },
                            ],
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        },

        // ── Sort + paginate ─────────────────────────────────────────────
        ...(searchDto.sortByDistance !== false ? [{ $sort: { distance: 1 as const } }] : []),
        ...(searchDto.skip && searchDto.skip > 0 ? [{ $skip: searchDto.skip }] : []),
        { $limit: searchDto.limit ?? 50 },

        // ── Project ────────────────────────────────────────────────────
        {
          $project: {
            name: 1,
            type: 1,
            address: 1,
            averageRating: 1,
            totalReviews: 1,
            isVerified: 1,
            // Merchant profile image: profileImage → avatar → null
            profileImage: {
              $ifNull: [
                { $arrayElemAt: ['$ownerData.profileImage', 0] },
                { $ifNull: [{ $arrayElemAt: ['$ownerData.avatar', 0] }, null] },
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
      const results: ProximitySearchResult<MapEstablishmentGeoData>[] = establishments.map(
        (est) => {
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
            name: est.name,
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
            offers: (est.activeOffers ?? []).map((o) => ({
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
        },
      );

      this.logger.log(`Found ${results.length} map establishments within radius`);
      return results;
    } catch (error) {
      this.logger.error('Failed to search map establishments:', error);
      throw error;
    }
  }
}
