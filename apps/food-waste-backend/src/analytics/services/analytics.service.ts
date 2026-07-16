import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

// Import schemas
import {
  Establishment,
  EstablishmentDocument,
} from '../../establishments/schemas/establishment.schema';
import { Offer, OfferDocument } from '../../offers/schemas/offer.schema';
import { Order, OrderDocument } from '../../orders/schemas/order.schema';
import { Payment, PaymentDocument } from '../../payments/schemas/payment.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import {
  FOOD_IMPACT_COEFFICIENTS,
  OFFER_TYPE_MULTIPLIERS,
  SUSTAINABILITY_FACTORS,
  WEIGHT_ESTIMATION_RULES,
  CALCULATION_THRESHOLDS,
  SUSTAINABILITY_CACHE_TTL,
} from '../constants/sustainability.constants';
import {
  BusinessMetricsRequestDto,
  UserAnalyticsRequestDto,
  AnalyticsFiltersDto,
  AggregationOptionsDto,
} from '../dto/analytics.dto';
import {
  BusinessMetrics,
  UserAnalytics,
  RealTimeMetrics,
  AnalyticsFilters,
  AggregationOptions,
  CacheStatistics,
} from '../interfaces/analytics.interface';
import { CacheService } from '../../common/services/cache.service';
import { AnalyticsCache, AnalyticsCacheDocument } from '../schemas/analytics-cache.schema';
import { AnalyticsUtil } from '../utils/analytics.util';

interface TotalUsersAggregationResult {
  total: number;
}

interface ActiveUsersAggregationResult {
  active: number;
}

interface NewUsersAggregationResult {
  new: number;
}

interface UsersByRoleAggregationResult {
  _id: string;
  count: number;
}

interface UserGrowthAggregationResult {
  _id: string;
  count: number;
}

interface UserLocationAggregationResult {
  _id: {
    city: string;
    country: string;
  };
  count: number;
  coordinates?: number[] | null;
}

interface RevenueTodayAggregationResult {
  total: number;
}

interface RevenueAggregationResult {
  totalRevenue: number;
  count: number;
}

interface OrderMetricsAggregationResult {
  totalOrders: number;
  completedOrders: number;
}

interface SustainabilityAggregationResult {
  totalOrders: number;
  totalFoodSaved: number;
  totalCarbonReduced: number;
  totalWaterSaved: number;
  totalPackagingSaved: number;
  totalEnergySaved: number;
}

interface CacheCategoryAggregationResult {
  _id: string | null;
  count: number;
}

interface CacheHitRatesAggregationResult {
  totalHits: number;
  totalRequests: number;
  avgHitCount: number | null;
}

interface CacheMemoryAggregationResult {
  totalSize: number;
  count: number;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly cacheEnabled: boolean;
  private readonly defaultCacheTTL: number = 15 * 60 * 1000; // 15 minutes

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Establishment.name)
    private readonly _establishmentModel: Model<EstablishmentDocument>,
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(AnalyticsCache.name) private readonly cacheModel: Model<AnalyticsCacheDocument>,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly redisCache: CacheService,
  ) {
    this.cacheEnabled = this.configService.get<boolean>('ANALYTICS_CACHE_ENABLED', true);
    void this._establishmentModel;
    void this._convertAggregationToInterface;
    void this._estimateWeightWithRules;
  }

  // ==================== DTO Conversion Helpers ====================

  private convertFiltersToInterface(filtersDto: AnalyticsFiltersDto): AnalyticsFilters {
    return {
      dateRange: {
        startDate: new Date(filtersDto.dateRange.startDate),
        endDate: new Date(filtersDto.dateRange.endDate),
      },
      granularity: filtersDto.granularity,
      establishmentIds: filtersDto.establishmentIds,
      userIds: filtersDto.userIds,
      categories: filtersDto.categories,
      locations: filtersDto.locations,
      userRoles: filtersDto.userRoles,
      establishmentTypes: filtersDto.establishmentTypes,
      orderStatuses: filtersDto.orderStatuses,
      paymentMethods: filtersDto.paymentMethods,
      minOrderValue: filtersDto.minOrderValue,
      maxOrderValue: filtersDto.maxOrderValue,
    };
  }

  private _convertAggregationToInterface(
    aggregationDto?: AggregationOptionsDto,
  ): AggregationOptions | undefined {
    if (!aggregationDto) {
      return undefined;
    }

    return {
      groupBy: aggregationDto.groupBy,
      sortBy: aggregationDto.sortBy,
      sortOrder: aggregationDto.sortOrder,
      limit: aggregationDto.limit,
      offset: aggregationDto.offset,
      includeProjections: aggregationDto.includeProjections,
      includeComparisons: aggregationDto.includeComparisons,
    };
  }

  async getBusinessMetrics(request: BusinessMetricsRequestDto): Promise<BusinessMetrics> {
    try {
      const cacheKey = this.generateCacheKey('business_metrics', this.serializeForCache(request));

      // Try cache first
      if (this.cacheEnabled) {
        const cached = await this.getFromCache<BusinessMetrics>(cacheKey);
        if (cached) {
          this.logger.log('Returning cached business metrics');
          return cached;
        }
      }

      this.logger.log('Computing business metrics');
      const startTime = Date.now();

      // Convert and validate filters
      const filters = this.convertFiltersToInterface(request.filters);
      const validationErrors = AnalyticsUtil.validateAnalyticsFilters(filters);
      if (validationErrors.length > 0) {
        throw new BadRequestException(`Invalid filters: ${validationErrors.join(', ')}`);
      }

      // Get comparison period if needed
      const comparisonRange =
        request.options?.includeComparisons === true
          ? AnalyticsUtil.getComparisonDateRange(filters.dateRange, filters.granularity)
          : null;

      // Parallel execution of metrics calculations
      const [currentMetrics, previousMetrics, sustainabilityData] = await Promise.all([
        this.calculateCurrentBusinessMetrics(filters),
        comparisonRange
          ? this.calculateCurrentBusinessMetrics({
              ...filters,
              dateRange: comparisonRange,
            })
          : Promise.resolve(null),
        request.includeSustainability === true
          ? this.calculateSustainabilityMetrics(filters)
          : Promise.resolve(null),
      ]);

      // Build result
      const result: BusinessMetrics = {
        totalRevenue: AnalyticsUtil.calculateMetricValue(
          currentMetrics.totalRevenue,
          previousMetrics?.totalRevenue,
        ),
        totalOrders: AnalyticsUtil.calculateMetricValue(
          currentMetrics.totalOrders,
          previousMetrics?.totalOrders,
        ),
        averageOrderValue: AnalyticsUtil.calculateMetricValue(
          currentMetrics.averageOrderValue,
          previousMetrics?.averageOrderValue,
        ),
        conversionRate: AnalyticsUtil.calculateMetricValue(
          currentMetrics.conversionRate,
          previousMetrics?.conversionRate,
        ),
        customerAcquisitionCost: AnalyticsUtil.calculateMetricValue(
          currentMetrics.customerAcquisitionCost,
          previousMetrics?.customerAcquisitionCost,
        ),
        customerLifetimeValue: AnalyticsUtil.calculateMetricValue(
          currentMetrics.customerLifetimeValue,
          previousMetrics?.customerLifetimeValue,
        ),
        foodWasteSaved: AnalyticsUtil.calculateMetricValue(
          sustainabilityData?.foodSaved ?? 0,
          undefined,
        ),
        carbonFootprintReduced: AnalyticsUtil.calculateMetricValue(
          sustainabilityData?.carbonReduced ?? 0,
          undefined,
        ),
        waterSaved: AnalyticsUtil.calculateMetricValue(
          sustainabilityData?.waterSaved ?? 0,
          undefined,
        ),
        packagingSaved: AnalyticsUtil.calculateMetricValue(
          sustainabilityData?.packagingSaved ?? 0,
          undefined,
        ),
        energySaved: AnalyticsUtil.calculateMetricValue(
          sustainabilityData?.energySaved ?? 0,
          undefined,
        ),
      };

      // Cache the result
      if (this.cacheEnabled) {
        await this.saveToCache(cacheKey, result, 'business', Date.now() - startTime);
      }

      // Emit analytics event
      this.eventEmitter.emit('analytics.business_metrics.calculated', {
        filters: request.filters,
        computationTime: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to calculate business metrics:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to calculate business metrics');
    }
  }

  // ==================== User Analytics ====================

  async getUserAnalytics(request: UserAnalyticsRequestDto): Promise<UserAnalytics> {
    try {
      const cacheKey = this.generateCacheKey('user_analytics', this.serializeForCache(request));

      if (this.cacheEnabled) {
        const cached = await this.getFromCache<UserAnalytics>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      this.logger.log('Computing user analytics');
      const startTime = Date.now();

      // Convert and validate filters
      const filters = this.convertFiltersToInterface(request.filters);
      const validationErrors = AnalyticsUtil.validateAnalyticsFilters(filters);
      if (validationErrors.length > 0) {
        throw new BadRequestException(`Invalid filters: ${validationErrors.join(', ')}`);
      }

      const matchPipeline = AnalyticsUtil.createMatchPipeline(filters);
      const dateGroupPipeline = AnalyticsUtil.getDateGroupingPipeline(
        filters.granularity,
        'createdAt',
      );

      // Aggregation pipelines
      const [
        totalUsersResult,
        activeUsersResult,
        newUsersResult,
        usersByRoleResult,
        userGrowthResult,
        locationDataResult,
      ] = await Promise.all([
        // Total users
        this.userModel.aggregate<TotalUsersAggregationResult>([
          ...matchPipeline,
          { $count: 'total' },
        ]),

        // Active users (users with recent orders)
        this.userModel.aggregate<ActiveUsersAggregationResult>([
          ...matchPipeline,
          {
            $lookup: {
              from: 'orders',
              localField: '_id',
              foreignField: 'userId',
              as: 'recentOrders',
              pipeline: [
                {
                  $match: {
                    createdAt: {
                      $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                    },
                  },
                },
              ],
            },
          },
          { $match: { 'recentOrders.0': { $exists: true } } },
          { $count: 'active' },
        ]),

        // New users in period
        this.userModel.aggregate<NewUsersAggregationResult>([...matchPipeline, { $count: 'new' }]),

        // Users by role
        this.userModel.aggregate<UsersByRoleAggregationResult>([
          ...matchPipeline,
          {
            $group: {
              _id: '$role',
              count: { $sum: 1 },
            },
          },
        ]),

        // User growth time series
        this.userModel.aggregate<UserGrowthAggregationResult>([
          ...matchPipeline,
          ...dateGroupPipeline,
          {
            $group: {
              _id: '$dateKey',
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),

        // Location data if requested
        request.includeLocationData === true
          ? this.userModel.aggregate<UserLocationAggregationResult>([
              ...matchPipeline,
              {
                $match: {
                  'address.city': { $exists: true },
                  'address.country': { $exists: true },
                },
              },
              {
                $group: {
                  _id: {
                    city: '$address.city',
                    country: '$address.country',
                  },
                  count: { $sum: 1 },
                  coordinates: { $first: '$address.coordinates.coordinates' },
                },
              },
              { $sort: { count: -1 } },
            ])
          : Promise.resolve<UserLocationAggregationResult[]>([]),
      ]);

      // Process results
      const totalUsers = totalUsersResult[0]?.total ?? 0;
      const activeUsers = activeUsersResult[0]?.active ?? 0;
      const newUsers = newUsersResult[0]?.new ?? 0;

      const usersByRole: Record<string, number> = {};
      usersByRoleResult.forEach(item => {
        usersByRole[item._id] = item.count;
      });

      const usersByLocation = locationDataResult.map(item => ({
        city: item._id.city,
        country: item._id.country,
        count: item.count,
        ...(Array.isArray(item.coordinates) && item.coordinates.length >= 2
          ? { coordinates: [item.coordinates[0], item.coordinates[1]] as [number, number] }
          : {}),
      }));

      const userGrowthSeries = AnalyticsUtil.generateTimeSeries(
        userGrowthResult.map(item => ({
          dateKey: item._id,
          value: item.count,
        })),
        filters.dateRange,
        filters.granularity,
      );

      // Calculate retention and churn (simplified for this example)
      const retentionRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;
      const churnRate = 100 - retentionRate;

      const result: UserAnalytics = {
        totalUsers: AnalyticsUtil.calculateMetricValue(totalUsers),
        activeUsers: AnalyticsUtil.calculateMetricValue(activeUsers),
        newUsers: AnalyticsUtil.calculateMetricValue(newUsers),
        retentionRate: AnalyticsUtil.calculateMetricValue(retentionRate),
        churnRate: AnalyticsUtil.calculateMetricValue(churnRate),
        usersByRole,
        usersByLocation,
        userGrowthSeries,
      };

      // Cache the result
      if (this.cacheEnabled) {
        await this.saveToCache(cacheKey, result, 'user', Date.now() - startTime);
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to calculate user analytics:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to calculate user analytics');
    }
  }

  // ==================== Real-time Metrics ====================

  async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    const result = await this.redisCache.getOrSet(
      'analytics:realtime',
      async () => {
        const metrics = await this.fetchRealTimeMetrics();
        return metrics;
      },
      30,
    );
    return result;
  }

  private async fetchRealTimeMetrics(): Promise<RealTimeMetrics> {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const [
        activeUsersResult,
        ordersTodayResult,
        revenueTodayResult,
        activeOffersResult,
        pendingOrdersResult,
      ] = await Promise.all([
        // Active users (last 15 minutes)
        this.userModel.countDocuments({
          lastLoginAt: {
            $gte: new Date(now.getTime() - 15 * 60 * 1000),
          },
        }),

        // Orders today
        this.orderModel.countDocuments({
          createdAt: { $gte: todayStart },
        }),

        // Revenue today
        this.paymentModel.aggregate<RevenueTodayAggregationResult>([
          {
            $match: {
              createdAt: { $gte: todayStart },
              status: 'paid',
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$amount' },
            },
          },
        ]),

        // Active offers
        this.offerModel.countDocuments({
          status: 'active',
          availableUntil: { $gte: now },
        }),

        // Pending orders
        this.orderModel.countDocuments({
          status: 'pending',
        }),
      ]);

      const revenueToday = revenueTodayResult[0]?.total ?? 0;

      return {
        activeUsers: activeUsersResult,
        ordersToday: ordersTodayResult,
        revenueToday,
        activeOffers: activeOffersResult,
        pendingOrders: pendingOrdersResult,
        systemHealth: {
          responseTime: 50, // This would come from monitoring
          errorRate: 0.1, // This would come from monitoring
          uptime: 99.9, // This would come from monitoring
        },
        lastUpdated: now,
      };
    } catch (error) {
      this.logger.error('Failed to get real-time metrics:', error);
      throw new InternalServerErrorException('Failed to get real-time metrics');
    }
  }

  // ==================== Private Helper Methods ====================

  private async calculateCurrentBusinessMetrics(filters: AnalyticsFilters) {
    const matchPipeline = AnalyticsUtil.createMatchPipeline(filters);

    const [revenueResult, orderResult] = await Promise.all([
      this.paymentModel.aggregate<RevenueAggregationResult>([
        ...matchPipeline,
        { $match: { status: 'paid' } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),

      this.orderModel.aggregate<OrderMetricsAggregationResult>([
        ...matchPipeline,
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            completedOrders: {
              $sum: {
                $cond: [{ $in: ['$status', ['picked_up', 'completed', 'delivered']] }, 1, 0],
              },
            },
          },
        },
      ]),
    ]);

    const totalRevenue = revenueResult[0]?.totalRevenue ?? 0;
    const totalOrders = orderResult[0]?.totalOrders ?? 0;
    const completedOrders = orderResult[0]?.completedOrders ?? 0;

    return {
      totalRevenue,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      conversionRate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0,
      customerAcquisitionCost: 0, // Would require marketing spend data
      customerLifetimeValue: 0, // Would require advanced calculation
    };
  }

  private async calculateSustainabilityMetrics(filters: AnalyticsFilters): Promise<{
    foodSaved: number;
    carbonReduced: number;
    waterSaved: number;
    packagingSaved: number;
    energySaved: number;
    totalOrders: number;
  }> {
    try {
      this.logger.debug('Starting sustainability metrics calculation');
      const startTime = Date.now();

      // Validate calculation thresholds
      const dateRangeDays = Math.ceil(
        (filters.dateRange.endDate.getTime() - filters.dateRange.startDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (dateRangeDays <= 0) {
        this.logger.warn('Invalid date range for sustainability calculation');
        return {
          foodSaved: 0,
          carbonReduced: 0,
          waterSaved: 0,
          packagingSaved: 0,
          energySaved: 0,
          totalOrders: 0,
        };
      }

      // Check cache first
      if (this.cacheEnabled) {
        const cacheKey = this.getSustainabilityCacheKey(filters);
        const cached = await this.getFromCache<{
          foodSaved: number;
          carbonReduced: number;
          waterSaved: number;
          packagingSaved: number;
          energySaved: number;
          totalOrders: number;
        }>(cacheKey);

        if (cached) {
          this.logger.debug('Returning cached sustainability metrics');
          return cached;
        }
      }

      // Create aggregation pipeline for completed orders with offers data
      const matchPipeline = AnalyticsUtil.createMatchPipeline(filters);

      // Build comprehensive aggregation pipeline
      const sustainabilityPipeline = [
        ...matchPipeline,
        {
          $match: {
            status: { $in: ['picked_up', 'completed'] }, // Only completed orders
            paymentStatus: 'paid',
          },
        },
        // Unwind order items to process each item separately
        { $unwind: '$items' },
        // Lookup offer details for each item
        {
          $lookup: {
            from: 'offers',
            localField: 'items.offerId',
            foreignField: '_id',
            as: 'offerDetails',
            pipeline: [
              {
                $project: {
                  categories: 1,
                  type: 1,
                  estimatedWeight: 1,
                  description: 1,
                  title: 1,
                },
              },
            ],
          },
        },
        { $unwind: { path: '$offerDetails', preserveNullAndEmptyArrays: true } },
        // Project calculated fields for sustainability metrics
        {
          $project: {
            orderId: '$_id',
            quantity: '$items.quantity',
            totalPrice: '$items.totalPrice',
            originalPrice: '$items.originalPrice',
            discountAmount: '$items.discountAmount',
            categories: { $ifNull: ['$offerDetails.categories', []] },
            offerType: { $ifNull: ['$offerDetails.type', 'specific_items'] },
            estimatedWeight: { $ifNull: ['$offerDetails.estimatedWeight', ''] },
            description: { $ifNull: ['$offerDetails.description', ''] },
            title: { $ifNull: ['$offerDetails.title', ''] },
            createdAt: 1,
          },
        },
        // Add calculated sustainability fields with enhanced weight estimation
        {
          $addFields: {
            // Calculate estimated weight per item using enhanced estimation rules
            estimatedItemWeight: {
              $let: {
                vars: {
                  // Try to parse weight from estimatedWeight field
                  parsedWeight: {
                    $regexFind: {
                      input: '$estimatedWeight',
                      regex: /(\d+(?:\.\d+)?)\s*(kg|g|gram|grams|kilogram|kilograms)/i,
                    },
                  },
                  // Try to parse weight from description
                  parsedDescriptionWeight: {
                    $regexFind: {
                      input: '$description',
                      regex: /(\d+(?:\.\d+)?)\s*(kg|g|gram|grams|kilogram|kilograms)/i,
                    },
                  },
                  // Try to parse weight from title
                  parsedTitleWeight: {
                    $regexFind: {
                      input: '$title',
                      regex: /(\d+(?:\.\d+)?)\s*(kg|g|gram|grams|kilogram|kilograms)/i,
                    },
                  },
                  // Get category-based weight estimation
                  categoryWeight: {
                    $cond: {
                      if: { $gt: [{ $size: '$categories' }, 0] },
                      then: {
                        $switch: {
                          branches: [
                            {
                              case: {
                                $regexMatch: {
                                  input: { $arrayElemAt: ['$categories', 0] },
                                  regex: /meat|beef|pork|chicken|lamb/i,
                                },
                              },
                              then: FOOD_IMPACT_COEFFICIENTS.meat.avgWeight,
                            },
                            {
                              case: {
                                $regexMatch: {
                                  input: { $arrayElemAt: ['$categories', 0] },
                                  regex: /fish|seafood|salmon|tuna/i,
                                },
                              },
                              then: FOOD_IMPACT_COEFFICIENTS.fish.avgWeight,
                            },
                            {
                              case: {
                                $regexMatch: {
                                  input: { $arrayElemAt: ['$categories', 0] },
                                  regex: /dairy|milk|cheese|yogurt/i,
                                },
                              },
                              then: FOOD_IMPACT_COEFFICIENTS.dairy.avgWeight,
                            },
                            {
                              case: {
                                $regexMatch: {
                                  input: { $arrayElemAt: ['$categories', 0] },
                                  regex: /egg/i,
                                },
                              },
                              then: FOOD_IMPACT_COEFFICIENTS.eggs.avgWeight,
                            },
                            {
                              case: {
                                $regexMatch: {
                                  input: { $arrayElemAt: ['$categories', 0] },
                                  regex: /bread|bakery/i,
                                },
                              },
                              then: FOOD_IMPACT_COEFFICIENTS.bread.avgWeight,
                            },
                            {
                              case: {
                                $regexMatch: {
                                  input: { $arrayElemAt: ['$categories', 0] },
                                  regex: /rice|grain|cereal/i,
                                },
                              },
                              then: FOOD_IMPACT_COEFFICIENTS.rice.avgWeight,
                            },
                            {
                              case: {
                                $regexMatch: {
                                  input: { $arrayElemAt: ['$categories', 0] },
                                  regex: /pasta/i,
                                },
                              },
                              then: FOOD_IMPACT_COEFFICIENTS.pasta.avgWeight,
                            },
                            {
                              case: {
                                $regexMatch: {
                                  input: { $arrayElemAt: ['$categories', 0] },
                                  regex: /vegetable|salad|greens/i,
                                },
                              },
                              then: FOOD_IMPACT_COEFFICIENTS.vegetables.avgWeight,
                            },
                            {
                              case: {
                                $regexMatch: {
                                  input: { $arrayElemAt: ['$categories', 0] },
                                  regex: /fruit|apple|banana|orange/i,
                                },
                              },
                              then: FOOD_IMPACT_COEFFICIENTS.fruits.avgWeight,
                            },
                            {
                              case: {
                                $regexMatch: {
                                  input: { $arrayElemAt: ['$categories', 0] },
                                  regex: /prepared|meal|dinner|lunch/i,
                                },
                              },
                              then: FOOD_IMPACT_COEFFICIENTS.prepared_meals.avgWeight,
                            },
                            {
                              case: {
                                $regexMatch: {
                                  input: { $arrayElemAt: ['$categories', 0] },
                                  regex: /dessert|cake|pastry|sweet/i,
                                },
                              },
                              then: FOOD_IMPACT_COEFFICIENTS.desserts.avgWeight,
                            },
                            {
                              case: {
                                $regexMatch: {
                                  input: { $arrayElemAt: ['$categories', 0] },
                                  regex: /beverage|drink|coffee|tea|juice/i,
                                },
                              },
                              then: FOOD_IMPACT_COEFFICIENTS.beverages.avgWeight,
                            },
                          ],
                          default: FOOD_IMPACT_COEFFICIENTS.default.avgWeight,
                        },
                      },
                      else: FOOD_IMPACT_COEFFICIENTS.default.avgWeight,
                    },
                  },
                },
                in: {
                  // Priority order: estimatedWeight > description > title > category
                  $let: {
                    vars: {
                      weightFromEstimated: {
                        $cond: {
                          if: { $ne: ['$$parsedWeight', null] },
                          then: {
                            $let: {
                              vars: {
                                weightValue: {
                                  $toDouble: { $arrayElemAt: ['$$parsedWeight.captures', 0] },
                                },
                                unit: {
                                  $toLower: { $arrayElemAt: ['$$parsedWeight.captures', 1] },
                                },
                              },
                              in: {
                                $cond: {
                                  if: { $regexMatch: { input: '$$unit', regex: /^g/ } },
                                  then: { $divide: ['$$weightValue', 1000] },
                                  else: '$$weightValue',
                                },
                              },
                            },
                          },
                          else: null,
                        },
                      },
                      weightFromDescription: {
                        $cond: {
                          if: { $ne: ['$$parsedDescriptionWeight', null] },
                          then: {
                            $let: {
                              vars: {
                                weightValue: {
                                  $toDouble: {
                                    $arrayElemAt: ['$$parsedDescriptionWeight.captures', 0],
                                  },
                                },
                                unit: {
                                  $toLower: {
                                    $arrayElemAt: ['$$parsedDescriptionWeight.captures', 1],
                                  },
                                },
                              },
                              in: {
                                $cond: {
                                  if: { $regexMatch: { input: '$$unit', regex: /^g/ } },
                                  then: { $divide: ['$$weightValue', 1000] },
                                  else: '$$weightValue',
                                },
                              },
                            },
                          },
                          else: null,
                        },
                      },
                      weightFromTitle: {
                        $cond: {
                          if: { $ne: ['$$parsedTitleWeight', null] },
                          then: {
                            $let: {
                              vars: {
                                weightValue: {
                                  $toDouble: { $arrayElemAt: ['$$parsedTitleWeight.captures', 0] },
                                },
                                unit: {
                                  $toLower: { $arrayElemAt: ['$$parsedTitleWeight.captures', 1] },
                                },
                              },
                              in: {
                                $cond: {
                                  if: { $regexMatch: { input: '$$unit', regex: /^g/ } },
                                  then: { $divide: ['$$weightValue', 1000] },
                                  else: '$$weightValue',
                                },
                              },
                            },
                          },
                          else: null,
                        },
                      },
                    },
                    in: {
                      // Use first available weight, apply thresholds for sanity checking
                      $let: {
                        vars: {
                          rawWeight: {
                            $cond: {
                              if: { $ne: ['$$weightFromEstimated', null] },
                              then: '$$weightFromEstimated',
                              else: {
                                $cond: {
                                  if: { $ne: ['$$weightFromDescription', null] },
                                  then: '$$weightFromDescription',
                                  else: {
                                    $cond: {
                                      if: { $ne: ['$$weightFromTitle', null] },
                                      then: '$$weightFromTitle',
                                      else: '$$categoryWeight',
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                        in: {
                          // Apply threshold validation
                          $cond: {
                            if: {
                              $and: [
                                {
                                  $gte: [
                                    '$$rawWeight',
                                    CALCULATION_THRESHOLDS.minReasonableWeightPerItem,
                                  ],
                                },
                                {
                                  $lte: [
                                    '$$rawWeight',
                                    CALCULATION_THRESHOLDS.maxReasonableWeightPerItem,
                                  ],
                                },
                              ],
                            },
                            then: '$$rawWeight',
                            else: '$$categoryWeight', // Fallback to category weight if parsed weight is unreasonable
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        // Add offer type multiplier
        {
          $addFields: {
            offerMultiplier: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ['$offerType', 'surprise_bag'] },
                    then: OFFER_TYPE_MULTIPLIERS.surprise_bag,
                  },
                  {
                    case: { $eq: ['$offerType', 'meal_deal'] },
                    then: OFFER_TYPE_MULTIPLIERS.meal_deal,
                  },
                  {
                    case: { $eq: ['$offerType', 'specific_items'] },
                    then: OFFER_TYPE_MULTIPLIERS.specific_items,
                  },
                ],
                default: OFFER_TYPE_MULTIPLIERS.specific_items,
              },
            },
          },
        },
        // Calculate final metrics
        {
          $addFields: {
            totalWeight: {
              $multiply: ['$estimatedItemWeight', '$quantity', '$offerMultiplier'],
            },
            // Get impact coefficients based on primary category
            impactCoefficients: {
              $let: {
                vars: {
                  primaryCategory: { $arrayElemAt: ['$categories', 0] },
                },
                in: {
                  $switch: {
                    branches: [
                      {
                        case: {
                          $regexMatch: {
                            input: '$$primaryCategory',
                            regex: /meat|beef|pork|chicken|lamb/i,
                          },
                        },
                        then: {
                          carbon: FOOD_IMPACT_COEFFICIENTS.meat.carbonFootprint,
                          water: FOOD_IMPACT_COEFFICIENTS.meat.waterFootprint,
                        },
                      },
                      {
                        case: {
                          $regexMatch: { input: '$$primaryCategory', regex: /fish|seafood/i },
                        },
                        then: {
                          carbon: FOOD_IMPACT_COEFFICIENTS.fish.carbonFootprint,
                          water: FOOD_IMPACT_COEFFICIENTS.fish.waterFootprint,
                        },
                      },
                      {
                        case: {
                          $regexMatch: { input: '$$primaryCategory', regex: /dairy|milk|cheese/i },
                        },
                        then: {
                          carbon: FOOD_IMPACT_COEFFICIENTS.dairy.carbonFootprint,
                          water: FOOD_IMPACT_COEFFICIENTS.dairy.waterFootprint,
                        },
                      },
                      {
                        case: {
                          $regexMatch: { input: '$$primaryCategory', regex: /vegetable|salad/i },
                        },
                        then: {
                          carbon: FOOD_IMPACT_COEFFICIENTS.vegetables.carbonFootprint,
                          water: FOOD_IMPACT_COEFFICIENTS.vegetables.waterFootprint,
                        },
                      },
                      {
                        case: { $regexMatch: { input: '$$primaryCategory', regex: /fruit/i } },
                        then: {
                          carbon: FOOD_IMPACT_COEFFICIENTS.fruits.carbonFootprint,
                          water: FOOD_IMPACT_COEFFICIENTS.fruits.waterFootprint,
                        },
                      },
                    ],
                    default: {
                      carbon: FOOD_IMPACT_COEFFICIENTS.default.carbonFootprint,
                      water: FOOD_IMPACT_COEFFICIENTS.default.waterFootprint,
                    },
                  },
                },
              },
            },
          },
        },
        // Calculate individual environmental impacts
        {
          $addFields: {
            carbonImpact: { $multiply: ['$totalWeight', '$impactCoefficients.carbon'] },
            waterImpact: { $multiply: ['$totalWeight', '$impactCoefficients.water'] },
            packagingImpact: {
              $multiply: ['$totalWeight', SUSTAINABILITY_FACTORS.packagingReduction],
            },
            energyImpact: { $multiply: ['$totalWeight', SUSTAINABILITY_FACTORS.energySavings] },
          },
        },
        // Group by order to avoid double counting, then sum all metrics
        {
          $group: {
            _id: '$orderId',
            totalWeight: { $sum: '$totalWeight' },
            carbonImpact: { $sum: '$carbonImpact' },
            waterImpact: { $sum: '$waterImpact' },
            packagingImpact: { $sum: '$packagingImpact' },
            energyImpact: { $sum: '$energyImpact' },
          },
        },
        // Final aggregation
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalFoodSaved: { $sum: '$totalWeight' },
            totalCarbonReduced: { $sum: '$carbonImpact' },
            totalWaterSaved: { $sum: '$waterImpact' },
            totalPackagingSaved: { $sum: '$packagingImpact' },
            totalEnergySaved: { $sum: '$energyImpact' },
          },
        },
      ];

      // Execute the aggregation
      const [result] =
        await this.orderModel.aggregate<SustainabilityAggregationResult>(sustainabilityPipeline);

      // Process results with fallbacks and threshold validation
      const totalOrders = result?.totalOrders ?? 0;

      // Apply minimum calculation thresholds
      if (totalOrders < CALCULATION_THRESHOLDS.minOrdersForCalculation) {
        this.logger.debug(`Insufficient orders for meaningful calculation: ${totalOrders}`);
        return {
          foodSaved: 0,
          carbonReduced: 0,
          waterSaved: 0,
          packagingSaved: 0,
          energySaved: 0,
          totalOrders,
        };
      }

      const foodSaved = Math.max(0, result?.totalFoodSaved ?? 0);
      const carbonReduced = Math.max(0, result?.totalCarbonReduced ?? 0);
      const waterSaved = Math.max(0, result?.totalWaterSaved ?? 0);
      const packagingSaved = Math.max(0, result?.totalPackagingSaved ?? 0);
      const energySaved = Math.max(0, result?.totalEnergySaved ?? 0);

      // Additional environmental calculations
      const disposalEmissionsSaved = foodSaved * SUSTAINABILITY_FACTORS.disposalEmissions;
      const totalCarbonWithDisposal = carbonReduced + disposalEmissionsSaved;

      const computationTime = Date.now() - startTime;
      this.logger.debug(
        `Sustainability metrics calculated in ${computationTime}ms for ${totalOrders} orders`,
      );

      // Log calculation insights for debugging and optimization
      const avgFoodPerOrder = totalOrders > 0 ? foodSaved / totalOrders : 0;
      const avgCarbonPerKg = foodSaved > 0 ? carbonReduced / foodSaved : 0;
      this.logger.debug(
        `Sustainability insights: avg food per order: ${avgFoodPerOrder.toFixed(2)}kg, avg carbon per kg: ${avgCarbonPerKg.toFixed(2)}kg CO2`,
      );

      // Emit sustainability calculation event
      this.eventEmitter.emit('analytics.sustainability.calculated', {
        filters,
        totalOrders,
        foodSaved,
        carbonReduced: totalCarbonWithDisposal,
        waterSaved,
        computationTime,
      });

      const finalResult = {
        foodSaved: Math.round(foodSaved * 100) / 100, // Round to 2 decimal places
        carbonReduced: Math.round(totalCarbonWithDisposal * 100) / 100,
        waterSaved: Math.round(waterSaved),
        packagingSaved: Math.round(packagingSaved * 100) / 100,
        energySaved: Math.round(energySaved * 100) / 100,
        totalOrders,
      };

      // Cache the result with shorter TTL for sustainability calculations
      if (this.cacheEnabled) {
        const cacheKey = this.getSustainabilityCacheKey(filters);
        await this.saveToCache(
          cacheKey,
          finalResult,
          'sustainability',
          computationTime,
          SUSTAINABILITY_CACHE_TTL,
        );
      }

      return finalResult;
    } catch (error) {
      this.logger.error('Failed to calculate sustainability metrics:', error);

      // Return zero values on error but don't throw to avoid breaking business metrics
      return {
        foodSaved: 0,
        carbonReduced: 0,
        waterSaved: 0,
        packagingSaved: 0,
        energySaved: 0,
        totalOrders: 0,
      };
    }
  }

  // ==================== Caching Methods ====================

  private generateCacheKey(endpoint: string, request: Record<string, unknown>): string {
    return AnalyticsUtil.generateCacheKey(endpoint, request, {});
  }

  private getSustainabilityCacheKey(filters: AnalyticsFilters): string {
    const cacheData = {
      dateRange: {
        startDate: filters.dateRange.startDate.toISOString(),
        endDate: filters.dateRange.endDate.toISOString(),
      },
      establishmentIds: filters.establishmentIds?.sort(),
      categories: filters.categories?.sort(),
      granularity: filters.granularity,
    };

    return this.generateCacheKey('sustainability_metrics', cacheData);
  }

  /**
   * Helper method that utilizes WEIGHT_ESTIMATION_RULES for server-side weight estimation
   * Used for validation and debugging purposes
   */
  private _estimateWeightWithRules(
    estimatedWeight: string,
    description: string,
    title: string,
    categories: string[],
  ): number {
    // Try parsing from estimatedWeight field first
    let weight = WEIGHT_ESTIMATION_RULES.parseWeightFromText(estimatedWeight);

    weight ??= WEIGHT_ESTIMATION_RULES.parseWeightFromText(description);
    weight ??= WEIGHT_ESTIMATION_RULES.parseWeightFromText(title);
    weight ??= WEIGHT_ESTIMATION_RULES.getCategoryWeight(categories);

    // Apply threshold validation
    if (
      weight < CALCULATION_THRESHOLDS.minReasonableWeightPerItem ||
      weight > CALCULATION_THRESHOLDS.maxReasonableWeightPerItem
    ) {
      // Return category-based weight if parsed weight is unreasonable
      return WEIGHT_ESTIMATION_RULES.getCategoryWeight(categories);
    }

    return weight;
  }

  private serializeForCache(data: unknown): Record<string, unknown> {
    return JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  }

  private async getFromCache<T>(keyHash: string): Promise<T | null> {
    try {
      const cached = await this.cacheModel.findOne({
        keyHash,
        expiresAt: { $gt: new Date() },
      });

      if (cached) {
        // Update hit count and last accessed
        await this.cacheModel.updateOne(
          { _id: cached._id },
          {
            $inc: { 'metadata.hitCount': 1 },
            $set: { 'metadata.lastAccessed': new Date() },
          },
        );

        return cached.data as T;
      }

      return null;
    } catch (error) {
      this.logger.warn('Cache retrieval failed:', error);
      return null;
    }
  }

  private async saveToCache(
    keyHash: string,
    data: unknown,
    category: string,
    computationTimeMs: number,
    customTTL?: number,
  ): Promise<void> {
    try {
      const now = new Date();
      const ttl = customTTL ?? this.defaultCacheTTL;
      const expiresAt = new Date(now.getTime() + ttl);

      const serializedData = this.serializeForCache(data);

      await this.cacheModel.findOneAndUpdate(
        { keyHash },
        {
          keyHash,
          data: serializedData,
          category,
          expiresAt,
          metadata: {
            generatedAt: now,
            expiresAt,
            dataSize: JSON.stringify(serializedData).length,
            computationTimeMs,
            hitCount: 0,
            lastAccessed: now,
          },
        },
        {
          upsert: true,
          new: true,
        },
      );
    } catch (error) {
      this.logger.warn('Cache save failed:', error);
    }
  }

  // ==================== Cache Management ====================

  async invalidateCache(category?: string, tags?: string[]): Promise<void> {
    try {
      const query: Record<string, unknown> = {};

      if (category) {
        query['category'] = category;
      }

      if (tags?.length) {
        query['tags'] = { $in: tags };
      }

      const result = await this.cacheModel.deleteMany(query);
      this.logger.log(`Invalidated ${result.deletedCount} cache entries`);

      // Emit cache invalidation event
      this.eventEmitter.emit('analytics.cache.invalidated', {
        category,
        tags,
        count: result.deletedCount,
      });
    } catch (error) {
      this.logger.error('Failed to invalidate cache:', error);
    }
  }

  async getCacheStatistics(): Promise<CacheStatistics> {
    try {
      const [totalKeys, categoriesResult, hitRatesResult, memoryResult] = await Promise.all([
        // Total cache keys
        this.cacheModel.countDocuments(),

        // Categories breakdown
        this.cacheModel.aggregate<CacheCategoryAggregationResult>([
          {
            $group: {
              _id: '$category',
              count: { $sum: 1 },
            },
          },
        ]),

        // Hit rate calculations
        this.cacheModel.aggregate<CacheHitRatesAggregationResult>([
          {
            $group: {
              _id: null,
              totalHits: { $sum: '$metadata.hitCount' },
              totalRequests: { $sum: { $add: ['$metadata.hitCount', 1] } }, // Approximate total requests
              avgHitCount: { $avg: '$metadata.hitCount' },
            },
          },
        ]),

        // Memory usage approximation
        this.cacheModel.aggregate<CacheMemoryAggregationResult>([
          {
            $group: {
              _id: null,
              totalSize: { $sum: '$metadata.dataSize' },
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

      // Process categories into key-value pairs
      const keysByCategory: Record<string, number> = {};
      categoriesResult.forEach(item => {
        keysByCategory[item._id ?? 'uncategorized'] = item.count;
      });

      // Calculate hit and miss rates
      const hitStats: CacheHitRatesAggregationResult = hitRatesResult[0] ?? {
        totalHits: 0,
        totalRequests: 0,
        avgHitCount: 0,
      };
      const totalHits = hitStats.totalHits ?? 0;
      const totalRequests = Math.max(hitStats.totalRequests ?? totalKeys, 1); // Avoid division by zero
      const hitRate = (totalHits / totalRequests) * 100;
      const missRate = 100 - hitRate;

      // Memory usage (approximate based on data size)
      const memoryStats: CacheMemoryAggregationResult = memoryResult[0] ?? {
        totalSize: 0,
        count: 0,
      };
      const memoryUsage = memoryStats.totalSize ?? 0;

      return {
        totalKeys,
        memoryUsage,
        hitRate: parseFloat(hitRate.toFixed(2)),
        missRate: parseFloat(missRate.toFixed(2)),
        evictions: 0, // This would require tracking eviction events
        keysByCategory,
        lastUpdated: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get cache statistics:', error);
      throw new InternalServerErrorException('Failed to get cache statistics');
    }
  }
}
