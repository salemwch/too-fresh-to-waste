import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ProximitySearchResult,
  EstablishmentGeoData,
  OfferGeoData,
  GeoCoordinate,
  DistanceUnit
} from '../interfaces/geolocation.interface';
import { ProximitySearchDto } from '../dto/geolocation.dto';
import { DistanceCalculator } from '../utils/distance.util';
import { Establishment, EstablishmentDocument, EstablishmentStatus } from '../../establishments/schemas/establishment.schema';
import { Offer, OfferDocument, OfferStatus } from '../../offers/schemas/offer.schema';

export interface ProximitySearchOptions {
  includeEstablishments?: boolean;
  includeOffers?: boolean;
  establishmentTypes?: string[];
  offerCategories?: string[];
  minRating?: number;
  maxPrice?: number;
  onlyActive?: boolean;
}

@Injectable()
export class ProximitySearchService {
  private readonly logger = new Logger(ProximitySearchService.name);

  constructor(
    @InjectModel(Establishment.name) private readonly establishmentModel: Model<EstablishmentDocument>,
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
  ) {}

  /**
   * Search establishments within proximity
   */
  async searchEstablishments(
    searchDto: ProximitySearchDto,
    options: ProximitySearchOptions = {}
  ): Promise<ProximitySearchResult<EstablishmentGeoData>[]> {
    try {
      if (!DistanceCalculator.isValidCoordinate(searchDto.center)) {
        throw new BadRequestException('Invalid search center coordinates');
      }

      this.logger.log(`Searching establishments within ${searchDto.radius}m of ${searchDto.center.latitude}, ${searchDto.center.longitude}`);

      // Convert center to GeoJSON point for MongoDB query
      const centerPoint = DistanceCalculator.coordinateToPoint(searchDto.center);

      // Build MongoDB aggregation pipeline
      const pipeline: any[] = [];

      // Convert radius from meters to radians for $centerSphere
      // Earth's radius is ~6378.1 km = 6378100 meters
      const radiusInRadians = searchDto.radius / 6378100;

      // Match stage - filter by location and other criteria
      // Using $geoWithin with $centerSphere instead of $near (works in aggregation pipelines)
      const matchConditions: any = {
        'address.coordinates': {
          $geoWithin: {
            $centerSphere: [
              [centerPoint.coordinates[0], centerPoint.coordinates[1]], // [lng, lat]
              radiusInRadians
            ]
          }
        },
        status: options.onlyActive !== false ? EstablishmentStatus.ACTIVE : { $ne: EstablishmentStatus.REJECTED },
        isActive: true
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
                lat2: centerPoint.coordinates[1]
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
                            { $sin: { $degreesToRadians: '$$lat2' } }
                          ]
                        },
                        {
                          $multiply: [
                            { $cos: { $degreesToRadians: '$$lat1' } },
                            { $cos: { $degreesToRadians: '$$lat2' } },
                            { $cos: { $degreesToRadians: { $subtract: ['$$lon2', '$$lon1'] } } }
                          ]
                        }
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      });

      // Sort by distance if requested
      if (searchDto.sortByDistance !== false) {
        pipeline.push({ $sort: { distance: 1 } });
      }

      // Pagination
      if (searchDto.skip && searchDto.skip > 0) {
        pipeline.push({ $skip: searchDto.skip });
      }

      pipeline.push({ $limit: searchDto.limit || 20 });

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
          coordinates: '$address.coordinates.coordinates'
        }
      });

      const establishments = await this.establishmentModel.aggregate(pipeline);

      // Transform results to ProximitySearchResult format
      const results: ProximitySearchResult<EstablishmentGeoData>[] = establishments.map(est => {
        const coordinates: GeoCoordinate = {
          longitude: est.coordinates[0],
          latitude: est.coordinates[1]
        };

        const distance = DistanceCalculator.calculateDistance(
          searchDto.center,
          coordinates,
          DistanceUnit.METERS
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
            formattedAddress: `${est.address.street}, ${est.address.city} ${est.address.postalCode}`
          },
          coordinates,
          averageRating: est.averageRating,
          totalOffers: est.totalOffers,
          isActive: est.isActive,
          isVerified: est.isVerified
        };

        return {
          item: establishmentData,
          distance,
          geoData: {
            coordinates,
            address: establishmentData.address
          }
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
    options: ProximitySearchOptions = {}
  ): Promise<ProximitySearchResult<OfferGeoData>[]> {
    try {
      if (!DistanceCalculator.isValidCoordinate(searchDto.center)) {
        throw new BadRequestException('Invalid search center coordinates');
      }

      this.logger.log(`Searching offers within ${searchDto.radius}m of ${searchDto.center.latitude}, ${searchDto.center.longitude}`);

      // First, get establishments within the search radius
      const establishmentResults = await this.searchEstablishments(searchDto, {
        ...options,
        onlyActive: true
      });

      if (establishmentResults.length === 0) {
        return [];
      }

      const establishmentIds = establishmentResults.map(est => new Types.ObjectId(est.item._id));

      // Build offer query
      const offerMatchConditions: any = {
        establishmentId: { $in: establishmentIds },
        status: OfferStatus.ACTIVE,
        isActive: true,
        availableUntil: { $gte: new Date() }
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
      const offerPipeline: any[] = [
        { $match: offerMatchConditions },

        // Lookup establishment data
        {
          $lookup: {
            from: 'establishments',
            localField: 'establishmentId',
            foreignField: '_id',
            as: 'establishment',
            pipeline: [
              {
                $project: {
                  name: 1,
                  type: 1,
                  address: 1,
                  averageRating: 1
                }
              }
            ]
          }
        },

        { $unwind: '$establishment' },

        // Add virtual fields for available quantity
        {
          $addFields: {
            availableQuantity: {
              $subtract: [
                '$totalQuantity',
                { $add: ['$reservedQuantity', '$soldQuantity'] }
              ]
            }
          }
        },

        // Filter out sold out offers
        {
          $match: {
            availableQuantity: { $gt: 0 }
          }
        },

        // Project needed fields
        {
          $project: {
            title: 1,
            description: 1,
            establishmentId: 1,
            pricing: 1,
            availableUntil: 1,
            availableQuantity: 1,
            categories: 1,
            tags: 1,
            images: { $slice: ['$images', 3] },
            pickupTimeSlots: 1,
            'establishment.name': 1,
            'establishment.address': 1,
            'establishment.averageRating': 1
          }
        }
      ];

      // Apply pagination
      if (searchDto.skip && searchDto.skip > 0) {
        offerPipeline.push({ $skip: searchDto.skip });
      }
      offerPipeline.push({ $limit: searchDto.limit || 20 });

      const offers = await this.offerModel.aggregate(offerPipeline);

      // Create a map of establishment coordinates for quick lookup
      const establishmentCoordMap = new Map<string, { coordinates: GeoCoordinate; address: any }>();
      establishmentResults.forEach(est => {
        establishmentCoordMap.set(est.item._id, {
          coordinates: est.item.coordinates,
          address: est.item.address
        });
      });

      // Transform results to ProximitySearchResult format
      const results: ProximitySearchResult<OfferGeoData>[] = [];

      for (const offer of offers) {
        const establishmentGeoData = establishmentCoordMap.get(offer.establishmentId.toString());
        if (!establishmentGeoData) {continue;}

        const distance = DistanceCalculator.calculateDistance(
          searchDto.center,
          establishmentGeoData.coordinates,
          DistanceUnit.METERS
        );

        const offerData: OfferGeoData = {
          _id: offer._id.toString(),
          title: offer.title,
          establishmentId: offer.establishmentId.toString(),
          establishmentName: offer.establishment.name,
          coordinates: establishmentGeoData.coordinates,
          address: establishmentGeoData.address,
          pricing: offer.pricing,
          availableUntil: offer.availableUntil,
          availableQuantity: offer.availableQuantity,
          categories: offer.categories,
          images: offer.images
        };

        results.push({
          item: offerData,
          distance,
          geoData: {
            coordinates: establishmentGeoData.coordinates,
            address: establishmentGeoData.address
          }
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
    options: ProximitySearchOptions = {}
  ): Promise<{
    establishments: ProximitySearchResult<EstablishmentGeoData>[];
    offers: ProximitySearchResult<OfferGeoData>[];
    totalResults: number;
  }> {
    try {
      const [establishments, offers] = await Promise.all([
        options.includeEstablishments !== false ? this.searchEstablishments(searchDto, options) : [],
        options.includeOffers !== false ? this.searchOffers(searchDto, options) : []
      ]);

      return {
        establishments,
        offers,
        totalResults: establishments.length + offers.length
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
    radius: number = 2000 // 2km default
  ): Promise<ProximitySearchResult<EstablishmentGeoData>[]> {
    try {
      // First get the offer and its establishment location
      const offer = await this.offerModel
        .findById(offerId)
        .populate('establishmentId')
        .exec();

      if (!offer) {
        throw new BadRequestException('Offer not found');
      }

      const establishment = offer.establishmentId as any;
      if (!establishment?.address?.coordinates) {
        throw new BadRequestException('Establishment coordinates not found');
      }

      const centerCoordinates: GeoCoordinate = {
        longitude: establishment.address.coordinates.coordinates[0],
        latitude: establishment.address.coordinates.coordinates[1]
      };

      // Search nearby establishments excluding the current one
      const searchDto: ProximitySearchDto = {
        center: centerCoordinates,
        radius,
        excludeIds: [establishment._id.toString()],
        limit: 10
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
    maxRadius: number = 10000 // 10km default
  ): Promise<ProximitySearchResult<EstablishmentGeoData>[]> {
    try {
      const searchDto: ProximitySearchDto = {
        center: userLocation,
        radius: maxRadius,
        sortByDistance: true,
        limit: 50
      };

      return await this.searchEstablishments(searchDto, {
        onlyActive: true,
        includeEstablishments: true
      });

    } catch (error) {
      this.logger.error('Failed to get establishments in delivery radius:', error);
      throw error;
    }
  }
}