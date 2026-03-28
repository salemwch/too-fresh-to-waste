import { InjectQueue } from '@nestjs/bull';
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bull';
import { Model, Types, PipelineStage } from 'mongoose';

import {
  AdminEstablishmentApprovedEvent,
  AdminEstablishmentRejectedEvent,
  AdminEstablishmentStatusChangedEvent,
  AdminEstablishmentSuspendedEvent,
  AdminEstablishmentReactivatedEvent,
  AdminEstablishmentVerifiedEvent,
  AdminEstablishmentReactivationScheduledEvent,
} from '../../common/events/admin-establishment.events';
import {
  IEstablishment,
  IEstablishmentOverview,
  IEstablishmentStats,
  IEstablishmentListResponse,
} from '../../common/interfaces/establishment.interface';
import { EstablishmentMapper } from '../../common/mappers/establishment.mapper';
import { EventBusService } from '../../common/services/event-bus/event-bus.service';
import { LeanDocument } from '../../common/types/mongoose.types';
import {
  Establishment,
  EstablishmentDocument,
  EstablishmentStatus,
  EstablishmentType,
} from '../../establishments/schemas/establishment.schema';
import { ISendNotificationRequest } from '../../notifications/interfaces/notification.interfaces';
import { NotificationService } from '../../notifications/services/notification.service';
import {
  NotificationTrigger,
  NotificationPriority,
} from '../../notifications/types/notification.types';
import { Offer, OfferDocument, OfferStatus } from '../../offers/schemas/offer.schema';
import { Order, OrderDocument, OrderStatus } from '../../orders/schemas/order.schema';
import {
  ApproveEstablishmentDto,
  UpdateEstablishmentStatusDto,
  EstablishmentSearchDto,
  EstablishmentStatsDto,
} from '../dto/establishment-management.dto';
import { AdminAction } from '../interfaces/admin-analytics.interface';
import { IEstablishmentManagementService } from '../interfaces/establishment-management.service.interface';
import { AdminAuditLogDocument } from '../schemas/admin-audit-log.schema';

import { AdminAuditService } from './admin-audit.service';

interface EstablishmentReactivationJob {
  establishmentId: string;
  reactivationDate: Date;
  adminId?: string;
  reason?: string;
}

// MongoDB aggregation result interfaces
interface EstablishmentAggregationGroup {
  _id: string;
  count: number;
}

interface EstablishmentAggregationResult {
  establishmentsByType: EstablishmentAggregationGroup[];
  establishmentsByStatus: EstablishmentAggregationGroup[];
}

interface TopRatedEstablishment {
  _id: string;
  name: string;
  type: EstablishmentType;
  averageRating: number;
  totalReviews: number;
  address: {
    city: string;
  };
}

interface PopularOffer {
  _id: string;
  title: string;
  originalPrice: number;
  discountPrice: number;
  totalOrders: number;
  averageRating: number;
}

interface MonthlyRevenueData {
  month: string;
  revenue: number;
  orders: number;
}

// Production-grade aggregation result interfaces
interface OrderStatsAggregation {
  _id: null;
  totalOrders: number;
  totalRevenue: number;
  completedOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
}

interface OfferStatsAggregation {
  _id: null;
  totalOffers: number;
  activeOffers: number;
  avgRating: number;
}

interface MonthlyRevenueAggregation {
  _id: {
    year: number;
    month: number;
  };
  revenue: number;
  orders: number;
}

interface CustomerRetentionAggregation {
  _id: null;
  totalCustomers: number;
  returningCustomers: number;
  retentionRate: number;
}

// Professional MongoDB aggregation filter interfaces
interface OrderMatchFilter extends Record<string, unknown> {
  establishmentId?: Types.ObjectId;
  createdAt?: DateFilter;
  status?: OrderStatus | { $in: OrderStatus[] } | { $nin: OrderStatus[] };
}

interface OfferMatchFilter extends Record<string, unknown> {
  establishmentId?: Types.ObjectId;
  createdAt?: DateFilter;
  status?: OfferStatus | { $in: OfferStatus[] } | { $nin: OfferStatus[] };
}

// Utility type for creating professional aggregation pipelines
type EstablishmentPipeline = PipelineStage[];

// Pipeline stage builder functions for reusability
interface PipelineBuilder {
  buildMatchStage(filter: Record<string, unknown>): PipelineStage.Match;
  buildGroupStage(groupSpec: Record<string, unknown>): PipelineStage.Group;
  buildSortStage(sortSpec: Record<string, 1 | -1>): PipelineStage.Sort;
  buildLimitStage(limit: number): PipelineStage.Limit;
  buildProjectStage(projection: Record<string, unknown>): PipelineStage.Project;
  buildLookupStage(lookup: {
    from: string;
    localField: string;
    foreignField: string;
    as: string;
  }): PipelineStage.Lookup;
}

// Search filter interface for MongoDB queries
interface EstablishmentSearchFilter {
  $or?: Array<{
    name?: { $regex: string; $options: string };
    description?: { $regex: string; $options: string };
    email?: { $regex: string; $options: string };
  }>;
  status?: EstablishmentStatus;
  type?: EstablishmentType;
  'address.city'?: { $regex: string; $options: string };
  isVerified?: boolean;
  isActive?: boolean;
}

// Sort configuration interface
interface EstablishmentSortConfig {
  [key: string]: 1 | -1;
}

// Date filter interface for statistics
interface DateFilter {
  $gte?: Date;
  $lte?: Date;
}

// Populated owner interface
interface PopulatedOwner {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}

// Type guards for runtime validation
function isPopulatedOwner(owner: unknown): owner is PopulatedOwner {
  if (typeof owner !== 'object' || owner === null) {
    return false;
  }
  const o = owner as Record<string, unknown>;
  return (
    typeof o['_id'] === 'string' &&
    typeof o['email'] === 'string' &&
    (o['firstName'] === undefined || typeof o['firstName'] === 'string') &&
    (o['lastName'] === undefined || typeof o['lastName'] === 'string') &&
    (o['phoneNumber'] === undefined || typeof o['phoneNumber'] === 'string')
  );
}

function isEstablishmentAggregationResult(
  result: unknown,
): result is EstablishmentAggregationResult {
  if (!Array.isArray(result) || result.length === 0) {
    return false;
  }
  const first = result[0];
  if (typeof first !== 'object' || first === null) {
    return false;
  }
  const r = first as Record<string, unknown>;
  return Array.isArray(r['establishmentsByType']) && Array.isArray(r['establishmentsByStatus']);
}

export interface EstablishmentListResponse {
  establishments: EstablishmentDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface EstablishmentOverview {
  totalEstablishments: number;
  pendingApproval: number;
  activeEstablishments: number;
  suspendedEstablishments: number;
  rejectedEstablishments: number;
  establishmentsByType: Record<string, number>;
  establishmentsByStatus: Record<string, number>;
  recentSubmissions: EstablishmentDocument[];
  topRatedEstablishments: TopRatedEstablishment[];
}

export interface EstablishmentStats {
  totalOrders: number;
  totalRevenue: number;
  totalOffers: number;
  averageRating: number;
  completedOrders: number;
  cancelledOrders: number;
  completionRate: number;
  monthlyRevenue: MonthlyRevenueData[];
  popularOffers: PopularOffer[];
  customerRetention: number;
}

class ProfessionalPipelineBuilder implements PipelineBuilder {
  buildMatchStage(filter: Record<string, unknown>): PipelineStage.Match {
    return { $match: filter };
  }

  buildGroupStage(groupSpec: Record<string, unknown> & { _id: unknown }): PipelineStage.Group {
    return { $group: groupSpec };
  }

  buildSortStage(sortSpec: Record<string, 1 | -1>): PipelineStage.Sort {
    return { $sort: sortSpec };
  }

  buildLimitStage(limit: number): PipelineStage.Limit {
    return { $limit: limit };
  }

  buildProjectStage(projection: Record<string, unknown>): PipelineStage.Project {
    return { $project: projection };
  }

  buildLookupStage(lookup: {
    from: string;
    localField: string;
    foreignField: string;
    as: string;
  }): PipelineStage.Lookup {
    return { $lookup: lookup };
  }

  buildUnwindStage(path: string, preserveNullAndEmptyArrays = false): PipelineStage.Unwind {
    return {
      $unwind: {
        path,
        preserveNullAndEmptyArrays,
      },
    };
  }

  buildAddFieldsStage(fields: Record<string, unknown>): PipelineStage.AddFields {
    return { $addFields: fields };
  }

  buildFacetStage(facets: Record<string, PipelineStage.FacetPipelineStage[]>): PipelineStage.Facet {
    return { $facet: facets };
  }
}

@Injectable()
export class EstablishmentManagementService implements IEstablishmentManagementService {
  private readonly logger = new Logger(EstablishmentManagementService.name);
  private readonly pipelineBuilder = new ProfessionalPipelineBuilder();

  constructor(
    @InjectModel(Establishment.name)
    private readonly establishmentModel: Model<EstablishmentDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
    private readonly auditService: AdminAuditService,
    private readonly eventBus: EventBusService,
    @Optional() private readonly notificationService?: NotificationService,
    @Optional()
    @InjectQueue('establishment-management')
    private readonly establishmentQueue?: Queue,
  ) {}

  async getEstablishmentOverview(): Promise<IEstablishmentOverview> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [totalEstablishments, establishmentStats, recentSubmissions] = await Promise.all([
        this.establishmentModel.countDocuments(),

        this.establishmentModel.aggregate<EstablishmentAggregationResult>([
          {
            $facet: {
              establishmentsByType: [{ $group: { _id: '$type', count: { $sum: 1 } } }],
              establishmentsByStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
            },
          },
        ]),

        this.establishmentModel.aggregate([
          { $match: { createdAt: { $gte: thirtyDaysAgo } } },
          { $sort: { createdAt: -1 as const } },
          { $limit: 10 },
          ...this.getOwnerLookupStages(),
        ]),

        this.getTopRatedEstablishments(),
      ]);

      if (!isEstablishmentAggregationResult(establishmentStats)) {
        throw new Error('Invalid aggregation result format');
      }
      const stats = establishmentStats[0]!;
      const establishmentsByStatus = this.formatGroupedResults(stats.establishmentsByStatus);

      const overviewData = {
        total: totalEstablishments,
        pending: establishmentsByStatus[EstablishmentStatus.PENDING] || 0,
        active: establishmentsByStatus[EstablishmentStatus.ACTIVE] || 0,
        suspended: establishmentsByStatus[EstablishmentStatus.SUSPENDED] || 0,
        rejected: establishmentsByStatus[EstablishmentStatus.REJECTED] || 0,
        recentApprovals: recentSubmissions?.length || 0,
        avgApprovalTime: 24, // Calculate actual average approval time later
      };

      return EstablishmentMapper.toOverviewInterface(overviewData);
    } catch (error) {
      this.logger.error('Failed to get establishment overview:', error);
      throw error;
    }
  }

  async searchEstablishments(query: EstablishmentSearchDto): Promise<IEstablishmentListResponse> {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        status,
        type,
        city,
        isVerified,
        isActive,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = query;

      // Build filter conditions
      const filter: EstablishmentSearchFilter = {};

      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ];
      }

      if (status) {
        filter.status = status;
      }

      if (type) {
        filter.type = type;
      }

      if (city) {
        filter['address.city'] = { $regex: city, $options: 'i' };
      }

      if (isVerified !== undefined) {
        filter.isVerified = isVerified;
      }

      if (isActive !== undefined) {
        filter.isActive = isActive;
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Sort configuration
      const sort: EstablishmentSortConfig = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute aggregate + count in parallel (single DB round-trip per query)
      const [establishments, total] = await Promise.all([
        this.establishmentModel.aggregate([
          { $match: filter },
          { $sort: sort },
          { $skip: skip },
          { $limit: limit },
          ...this.getOwnerLookupStages(),
        ]),
        this.establishmentModel.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(total / limit);

      const listData = {
        establishments,
        total,
        page,
        limit,
        totalPages,
      };

      return EstablishmentMapper.toListResponse(listData);
    } catch (error) {
      this.logger.error('Failed to search establishments:', error);
      throw error;
    }
  }

  async getEstablishmentById(establishmentId: string): Promise<IEstablishment> {
    try {
      const results = await this.establishmentModel.aggregate([
        { $match: { _id: new Types.ObjectId(establishmentId) } },
        ...this.getOwnerLookupStages(['firstName', 'lastName', 'email', 'phoneNumber']),
        { $limit: 1 },
      ]);

      const establishment = results[0] || null;

      if (!establishment) {
        throw new NotFoundException(`Establishment with ID ${establishmentId} not found`);
      }

      return EstablishmentMapper.toInterface(establishment);
    } catch (error) {
      this.logger.error(`Failed to get establishment ${establishmentId}:`, error);
      throw error;
    }
  }

  async approveEstablishment(
    establishmentId: string,
    approveDto: ApproveEstablishmentDto,
    adminId: string,
    adminEmail: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<IEstablishment> {
    try {
      const establishment = await this.establishmentModel.findById(establishmentId);

      if (!establishment) {
        throw new NotFoundException(`Establishment with ID ${establishmentId} not found`);
      }

      if (establishment.status !== EstablishmentStatus.PENDING) {
        throw new BadRequestException('Only pending establishments can be approved or rejected');
      }

      const previousValue = {
        status: establishment.status,
        rejectionReason: establishment.rejectionReason,
        verifiedAt: establishment.verifiedAt,
      };

      // Update establishment status
      if (approveDto.approved) {
        establishment.status = EstablishmentStatus.ACTIVE;
        establishment.isVerified = true;
        establishment.verifiedAt = new Date();
        delete (establishment as { rejectionReason?: string }).rejectionReason;
      } else {
        establishment.status = EstablishmentStatus.REJECTED;
        if (approveDto.reason !== undefined) {
          establishment.rejectionReason = approveDto.reason;
        }
        establishment.isVerified = false;
      }

      const updatedEstablishment = await establishment.save();

      // Log the action
      await this.auditService.logEstablishmentAction({
        adminId,
        adminEmail,
        action: approveDto.approved
          ? AdminAction.ESTABLISHMENT_APPROVED
          : AdminAction.ESTABLISHMENT_REJECTED,
        establishmentId,
        previousValue,
        newValue: {
          status: establishment.status,
          isVerified: establishment.isVerified,
          reason: approveDto.reason,
          adminNotes: approveDto.adminNotes,
          verifiedAt: establishment.verifiedAt,
        },
        reason: approveDto.reason,
        ipAddress,
        userAgent,
      });

      this.logger.log(
        `Establishment ${establishmentId} ${approveDto.approved ? 'approved' : 'rejected'} by admin ${adminEmail}. Reason: ${approveDto.reason}`,
      );

      // Emit domain event for cross-module reactions
      await this.emitApprovalEvent(establishment, approveDto, adminId, adminEmail);

      // Send notification if required
      if (approveDto.sendNotification) {
        await this.sendApprovalNotification(establishment, approveDto);
      }

      return EstablishmentMapper.toInterface(
        updatedEstablishment as unknown as Parameters<typeof EstablishmentMapper.toInterface>[0],
      );
    } catch (error) {
      this.logger.error(
        `Failed to ${approveDto.approved ? 'approve' : 'reject'} establishment ${establishmentId}:`,
        error,
      );
      throw error;
    }
  }

  async updateEstablishmentStatus(
    establishmentId: string,
    updateDto: UpdateEstablishmentStatusDto,
    adminId: string,
    adminEmail: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<IEstablishment> {
    try {
      const establishment = await this.establishmentModel.findById(establishmentId);

      if (!establishment) {
        throw new NotFoundException(`Establishment with ID ${establishmentId} not found`);
      }

      const previousStatus = establishment.status;
      const previousValue = {
        status: establishment.status,
        rejectionReason: establishment.rejectionReason,
        lastActiveAt: establishment.lastActiveAt,
      };

      // Update establishment status
      establishment.status = updateDto.status;

      if (updateDto.status === EstablishmentStatus.SUSPENDED) {
        establishment.isActive = false;
      } else if (updateDto.status === EstablishmentStatus.ACTIVE) {
        establishment.isActive = true;
        establishment.lastActiveAt = new Date();
        delete (establishment as { rejectionReason?: string }).rejectionReason;
      } else if (updateDto.status === EstablishmentStatus.REJECTED) {
        establishment.isActive = false;
        establishment.rejectionReason = updateDto.reason;
      }

      const updatedEstablishment = await establishment.save();

      // Log the action
      await this.auditService.logEstablishmentAction({
        adminId,
        adminEmail,
        action: this.getActionForStatusChange(updateDto.status),
        establishmentId,
        previousValue,
        newValue: {
          status: establishment.status,
          isActive: establishment.isActive,
          reason: updateDto.reason,
          adminNotes: updateDto.adminNotes,
          reactivationDate: updateDto.reactivationDate,
        },
        reason: updateDto.reason,
        ipAddress,
        userAgent,
      });

      this.logger.log(
        `Establishment ${establishmentId} status changed from ${previousStatus} to ${updateDto.status} by admin ${adminEmail}. Reason: ${updateDto.reason}`,
      );

      // Emit domain event for cross-module reactions
      await this.emitStatusChangeEvent(
        establishment,
        previousStatus,
        updateDto,
        adminId,
        adminEmail,
      );

      // Send notification if required
      if (updateDto.sendNotification) {
        await this.sendStatusChangeNotification(establishment, updateDto);
      }

      // Schedule reactivation if specified
      if (updateDto.reactivationDate && updateDto.status === EstablishmentStatus.SUSPENDED) {
        await this.scheduleReactivation(
          establishmentId,
          updateDto.reactivationDate,
          adminId,
          adminEmail,
        );
      }

      // Cancel any existing scheduled reactivation if status is not suspended
      if (updateDto.status !== EstablishmentStatus.SUSPENDED) {
        await this.cancelScheduledReactivation(establishmentId);
      }

      return EstablishmentMapper.toInterface(
        updatedEstablishment as unknown as Parameters<typeof EstablishmentMapper.toInterface>[0],
      );
    } catch (error) {
      this.logger.error(`Failed to update establishment ${establishmentId} status:`, error);
      throw error;
    }
  }
  async verifyEstablishmentDocuments(
    establishmentId: string,
    adminId: string,
    adminEmail: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<IEstablishment> {
    try {
      const establishment = await this.establishmentModel.findById(establishmentId);

      if (!establishment) {
        throw new NotFoundException(`Establishment with ID ${establishmentId} not found`);
      }

      establishment.isVerified = true;
      establishment.verifiedAt = new Date();

      const updatedEstablishment = await establishment.save();

      // Log the action
      await this.auditService.logEstablishmentAction({
        adminId,
        adminEmail,
        action: AdminAction.ESTABLISHMENT_UPDATED,
        establishmentId,
        previousValue: { isVerified: false },
        newValue: { isVerified: true, verifiedAt: new Date() },
        reason: 'Documents manually verified by admin',
        ipAddress,
        userAgent,
      });

      this.logger.log(`Establishment ${establishmentId} documents verified by admin ${adminEmail}`);

      // Emit verification event
      await this.eventBus.emit(
        'admin.establishment.verified',
        new AdminEstablishmentVerifiedEvent(
          establishmentId,
          adminId,
          adminEmail,
          establishment.name,
          establishment.ownerId.toString(),
        ),
      );

      return EstablishmentMapper.toInterface(
        updatedEstablishment as unknown as Parameters<typeof EstablishmentMapper.toInterface>[0],
      );
    } catch (error) {
      this.logger.error(`Failed to verify documents for establishment ${establishmentId}:`, error);
      throw error;
    }
  }
  async getEstablishmentStats(
    establishmentId: string,
    statsDto: EstablishmentStatsDto,
  ): Promise<IEstablishmentStats> {
    try {
      const establishment = await this.establishmentModel.findById(establishmentId);

      if (!establishment) {
        throw new NotFoundException(`Establishment with ID ${establishmentId} not found`);
      }

      // Build date filter for aggregations
      const dateFilter: DateFilter = {};
      const periodStart = statsDto.startDate
        ? new Date(statsDto.startDate)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: 30 days ago
      const periodEnd = statsDto.endDate ? new Date(statsDto.endDate) : new Date();

      dateFilter.$gte = periodStart;
      dateFilter.$lte = periodEnd;

      const establishmentObjectId = new Types.ObjectId(establishmentId);

      // Execute all aggregations in parallel for optimal performance
      const [orderStats, offerStats, monthlyRevenue, popularOffers, customerRetention] =
        await Promise.all([
          this.getOrderStatistics(establishmentObjectId, dateFilter),
          this.getOfferStatistics(establishmentObjectId, dateFilter),
          this.getMonthlyRevenue(establishmentObjectId, dateFilter),
          this.getPopularOffers(establishmentObjectId, dateFilter),
          this.getCustomerRetention(establishmentObjectId, dateFilter),
        ]);

      // Calculate completion rate
      const completionRate =
        orderStats.totalOrders > 0
          ? (orderStats.completedOrders / orderStats.totalOrders) * 100
          : 0;

      // Prepare stats response
      const stats = {
        totalOrders: orderStats.totalOrders,
        totalRevenue: orderStats.totalRevenue,
        totalOffers: offerStats.totalOffers,
        averageRating: offerStats.avgRating,
        completedOrders: orderStats.completedOrders,
        cancelledOrders: orderStats.cancelledOrders,
        completionRate: Math.round(completionRate * 100) / 100, // Round to 2 decimal places
        monthlyRevenue,
        popularOffers,
        customerRetention: customerRetention.retentionRate,
        periodStart,
        periodEnd,
        activeOffers: offerStats.activeOffers,
        averageOrderValue: orderStats.averageOrderValue,
      };

      return EstablishmentMapper.toStatsInterface(stats);
    } catch (error) {
      this.logger.error(`Failed to get stats for establishment ${establishmentId}:`, error);
      throw error;
    }
  }

  /**
   * Get top-rated establishments using professional aggregation
   */
  private async getTopRatedEstablishments(): Promise<TopRatedEstablishment[]> {
    try {
      const pipeline: EstablishmentPipeline = [
        this.pipelineBuilder.buildMatchStage({
          status: EstablishmentStatus.ACTIVE,
          averageRating: { $gte: 4.0 },
        }),
        this.pipelineBuilder.buildSortStage({
          averageRating: -1,
          totalReviews: -1,
        }),
        this.pipelineBuilder.buildLimitStage(10),
        this.pipelineBuilder.buildProjectStage({
          name: 1,
          type: 1,
          averageRating: 1,
          totalReviews: 1,
          'address.city': 1,
        }),
      ];

      return await this.establishmentModel.aggregate<TopRatedEstablishment>(pipeline);
    } catch (error) {
      this.logger.error('Failed to get top-rated establishments:', error);
      return [];
    }
  }

  /**
   * Get order statistics for the establishment using professional pipelines
   */
  private async getOrderStatistics(
    establishmentId: Types.ObjectId,
    dateFilter: DateFilter,
  ): Promise<OrderStatsAggregation> {
    try {
      const matchFilter: OrderMatchFilter = {
        establishmentId,
        createdAt: dateFilter,
      };

      const pipeline: EstablishmentPipeline = [
        this.pipelineBuilder.buildMatchStage(matchFilter),
        this.pipelineBuilder.buildGroupStage({
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$pricing.total' },
          completedOrders: {
            $sum: {
              $cond: [{ $eq: ['$status', OrderStatus.PICKED_UP] }, 1, 0],
            },
          },
          cancelledOrders: {
            $sum: {
              $cond: [{ $eq: ['$status', OrderStatus.CANCELLED] }, 1, 0],
            },
          },
          averageOrderValue: { $avg: '$pricing.total' },
        }),
      ];

      const result = await this.orderModel.aggregate<OrderStatsAggregation>(pipeline);

      return (
        result[0] || {
          _id: null,
          totalOrders: 0,
          totalRevenue: 0,
          completedOrders: 0,
          cancelledOrders: 0,
          averageOrderValue: 0,
        }
      );
    } catch (error) {
      this.logger.error('Failed to get order statistics:', error);
      throw error;
    }
  }

  /**
   * Get offer statistics for the establishment using professional pipelines
   */
  private async getOfferStatistics(
    establishmentId: Types.ObjectId,
    dateFilter: DateFilter,
  ): Promise<OfferStatsAggregation> {
    try {
      const matchFilter: OfferMatchFilter = {
        establishmentId,
        createdAt: dateFilter,
      };

      const pipeline: EstablishmentPipeline = [
        this.pipelineBuilder.buildMatchStage(matchFilter),
        this.pipelineBuilder.buildGroupStage({
          _id: null,
          totalOffers: { $sum: 1 },
          activeOffers: {
            $sum: {
              $cond: [{ $eq: ['$status', OfferStatus.ACTIVE] }, 1, 0],
            },
          },
          avgRating: { $avg: '$averageRating' },
        }),
      ];

      const result = await this.offerModel.aggregate<OfferStatsAggregation>(pipeline);

      return (
        result[0] || {
          _id: null,
          totalOffers: 0,
          activeOffers: 0,
          avgRating: 0,
        }
      );
    } catch (error) {
      this.logger.error('Failed to get offer statistics:', error);
      throw error;
    }
  }

  /**
   * Get monthly revenue trends using professional pipelines with $nin instead of $ne
   */
  private async getMonthlyRevenue(
    establishmentId: Types.ObjectId,
    dateFilter: DateFilter,
  ): Promise<MonthlyRevenueData[]> {
    try {
      const matchFilter: OrderMatchFilter = {
        establishmentId,
        createdAt: dateFilter,
        status: { $in: [OrderStatus.PICKED_UP, OrderStatus.CONFIRMED] },
      };

      const pipeline: EstablishmentPipeline = [
        this.pipelineBuilder.buildMatchStage(matchFilter),
        this.pipelineBuilder.buildGroupStage({
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          revenue: { $sum: '$pricing.total' },
          orders: { $sum: 1 },
        }),
        this.pipelineBuilder.buildSortStage({
          '_id.year': 1,
          '_id.month': 1,
        }),
        this.pipelineBuilder.buildLimitStage(12),
      ];

      const result = await this.orderModel.aggregate<MonthlyRevenueAggregation>(pipeline);

      return result.map((item) => ({
        month: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
        revenue: Math.round(item.revenue * 100) / 100,
        orders: item.orders,
      }));
    } catch (error) {
      this.logger.error('Failed to get monthly revenue:', error);
      return [];
    }
  }

  /**
   * Get popular offers using professional aggregation pipelines
   */
  private async getPopularOffers(
    establishmentId: Types.ObjectId,
    dateFilter: DateFilter,
  ): Promise<PopularOffer[]> {
    try {
      const matchFilter: OrderMatchFilter = {
        establishmentId,
        createdAt: dateFilter,
        status: { $in: [OrderStatus.PICKED_UP, OrderStatus.CONFIRMED] },
      };

      const pipeline: EstablishmentPipeline = [
        this.pipelineBuilder.buildMatchStage(matchFilter),
        this.pipelineBuilder.buildUnwindStage('$items'),
        this.pipelineBuilder.buildGroupStage({
          _id: '$items.offerId',
          title: { $first: '$items.offerTitle' },
          originalPrice: { $first: '$items.originalPrice' },
          discountedPrice: { $first: '$items.unitPrice' },
          totalOrders: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.totalPrice' },
        }),
        this.pipelineBuilder.buildLookupStage({
          from: 'offers',
          localField: '_id',
          foreignField: '_id',
          as: 'offerDetails',
        }),
        this.pipelineBuilder.buildUnwindStage('$offerDetails', true),
        this.pipelineBuilder.buildAddFieldsStage({
          averageRating: { $ifNull: ['$offerDetails.averageRating', 0] },
        }),
        this.pipelineBuilder.buildSortStage({
          totalOrders: -1,
          totalRevenue: -1,
        }),
        this.pipelineBuilder.buildLimitStage(10),
        this.pipelineBuilder.buildProjectStage({
          _id: { $toString: '$_id' },
          title: 1,
          originalPrice: 1,
          discountPrice: '$discountedPrice',
          totalOrders: 1,
          averageRating: 1,
        }),
      ];

      const result = await this.orderModel.aggregate<PopularOffer>(pipeline);
      return result;
    } catch (error) {
      this.logger.error('Failed to get popular offers:', error);
      return [];
    }
  }

  /**
   * Calculate customer retention rate using professional pipelines
   */
  private async getCustomerRetention(
    establishmentId: Types.ObjectId,
    dateFilter: DateFilter,
  ): Promise<CustomerRetentionAggregation> {
    try {
      const matchFilter: OrderMatchFilter = {
        establishmentId,
        createdAt: dateFilter,
        status: OrderStatus.PICKED_UP,
      };

      const pipeline: EstablishmentPipeline = [
        this.pipelineBuilder.buildMatchStage(matchFilter),
        this.pipelineBuilder.buildGroupStage({
          _id: '$customerId',
          orderCount: { $sum: 1 },
          firstOrder: { $min: '$createdAt' },
          lastOrder: { $max: '$createdAt' },
        }),
        this.pipelineBuilder.buildGroupStage({
          _id: null,
          totalCustomers: { $sum: 1 },
          returningCustomers: {
            $sum: {
              $cond: [{ $gt: ['$orderCount', 1] }, 1, 0],
            },
          },
        }),
        this.pipelineBuilder.buildAddFieldsStage({
          retentionRate: {
            $cond: [
              { $gt: ['$totalCustomers', 0] },
              { $multiply: [{ $divide: ['$returningCustomers', '$totalCustomers'] }, 100] },
              0,
            ],
          },
        }),
      ];

      const result = await this.orderModel.aggregate<CustomerRetentionAggregation>(pipeline);

      return (
        result[0] || {
          _id: null,
          totalCustomers: 0,
          returningCustomers: 0,
          retentionRate: 0,
        }
      );
    } catch (error) {
      this.logger.error('Failed to get customer retention:', error);
      return {
        _id: null,
        totalCustomers: 0,
        returningCustomers: 0,
        retentionRate: 0,
      };
    }
  }

  async getPendingApprovals(limit: number = 50): Promise<IEstablishment[]> {
    try {
      const establishments = await this.establishmentModel.aggregate([
        { $match: { status: EstablishmentStatus.PENDING } },
        { $sort: { createdAt: 1 as const } }, // Oldest first
        { $limit: limit },
        ...this.getOwnerLookupStages(['firstName', 'lastName', 'email', 'phoneNumber']),
      ]);

      return EstablishmentMapper.toInterfaceArray(establishments);
    } catch (error) {
      this.logger.error('Failed to get pending approvals:', error);
      throw error;
    }
  }

  async getEstablishmentActivity(
    establishmentId: string,
    _days: number = 30,
  ): Promise<LeanDocument<AdminAuditLogDocument>[]> {
    try {
      // Get audit logs related to this establishment
      return await this.auditService.getAuditLogsByTarget('establishment', establishmentId, 50);
    } catch (error) {
      this.logger.error(`Failed to get activity for establishment ${establishmentId}:`, error);
      throw error;
    }
  }
  // Helper Methods

  /**
   * Builds $lookup + $unwind stages to join owner (user) data.
   * Uses the pipeline form of $lookup for field-level projection,
   * reducing network I/O compared to populate().
   * @param fields - Owner fields to project (default: firstName, lastName, email)
   * @see https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/#join-conditions-and-subqueries-on-a-joined-collection
   */
  private getOwnerLookupStages(
    fields: string[] = ['firstName', 'lastName', 'email'],
  ): PipelineStage[] {
    const projection: Record<string, 1> = { _id: 1 };
    for (const field of fields) {
      projection[field] = 1;
    }

    return [
      {
        $lookup: {
          from: 'users',
          let: { ownerObjId: '$ownerId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$ownerObjId'] } } },
            { $project: projection },
          ],
          as: 'ownerId',
        },
      },
      {
        $unwind: {
          path: '$ownerId',
          preserveNullAndEmptyArrays: true,
        },
      },
    ];
  }

  private formatGroupedResults(
    results: Array<{ _id: string; count: number }>,
  ): Record<string, number> {
    return results.reduce(
      (acc, item) => {
        acc[item._id] = item.count;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  private getActionForStatusChange(status: EstablishmentStatus): AdminAction {
    switch (status) {
      case EstablishmentStatus.ACTIVE:
        return AdminAction.ESTABLISHMENT_REACTIVATED;
      case EstablishmentStatus.SUSPENDED:
        return AdminAction.ESTABLISHMENT_SUSPENDED;
      case EstablishmentStatus.REJECTED:
        return AdminAction.ESTABLISHMENT_REJECTED;
      default:
        return AdminAction.ESTABLISHMENT_UPDATED;
    }
  }

  private async sendApprovalNotification(
    establishment: EstablishmentDocument,
    approveDto: ApproveEstablishmentDto,
  ): Promise<void> {
    try {
      if (!this.notificationService) {
        this.logger.warn('Notification service not available');
        return;
      }

      const owner = establishment.ownerId;
      if (!isPopulatedOwner(owner)) {
        this.logger.error(
          `No valid owner information found for establishment ${establishment._id.toString()}`,
        );
        return;
      }

      const ownerEmail = owner.email;
      if (!ownerEmail) {
        this.logger.error(`No owner email found for establishment ${establishment._id.toString()}`);
        return;
      }

      const isApproved = approveDto.approved;
      const notificationData: ISendNotificationRequest = {
        type: 'email',
        trigger: isApproved
          ? NotificationTrigger.ESTABLISHMENT_APPROVED
          : NotificationTrigger.ESTABLISHMENT_REJECTED,
        target: {
          userId: owner._id,
          establishmentId: establishment._id.toString(),
        },
        payload: {
          title: isApproved
            ? `🎉 Your establishment "${establishment.name}" has been approved!`
            : `❌ Your establishment "${establishment.name}" application was not approved`,
          body: isApproved
            ? `Congratulations! Your establishment has been approved and is now active on our platform. You can start creating offers immediately.`
            : `We regret to inform you that your establishment application was not approved. Reason: ${approveDto.reason || 'Not specified'}`,
          data: {
            establishmentId: establishment._id.toString(),
            establishmentName: establishment.name,
            status: establishment.status,
            approved: isApproved,
            reason: approveDto.reason,
            adminNotes: approveDto.adminNotes,
          },
        },
        priority: NotificationPriority.HIGH,
        templateVariables: {
          establishmentName: establishment.name,
          ownerName: `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'Owner',
          status: establishment.status,
          reason: approveDto.reason || 'Not specified',
          adminNotes: approveDto.adminNotes || '',
          supportEmail: process.env['SUPPORT_EMAIL'] || 'support@foodwaste.com',
          dashboardUrl: `${process.env['FRONTEND_URL'] || 'https://app.foodwaste.com'}/establishment/dashboard`,
        },
      };

      // Send the notification
      const result = await this.notificationService.sendNotification(notificationData);

      if (result.success) {
        this.logger.log(
          `${isApproved ? 'Approval' : 'Rejection'} notification sent successfully to ${ownerEmail} for establishment ${establishment._id.toString()}`,
        );
      } else {
        this.logger.error(
          `Failed to send ${isApproved ? 'approval' : 'rejection'} notification: ${result.error}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error sending approval notification for establishment ${establishment._id.toString()}:`,
        error,
      );
    }
  }

  private async sendStatusChangeNotification(
    establishment: EstablishmentDocument,
    updateDto: UpdateEstablishmentStatusDto,
  ): Promise<void> {
    try {
      if (!this.notificationService) {
        this.logger.warn('Notification service not available');
        return;
      }

      // Get establishment owner information with type guard
      const owner = establishment.ownerId;
      if (!isPopulatedOwner(owner)) {
        this.logger.error(
          `No valid owner information found for establishment ${establishment._id.toString()}`,
        );
        return;
      }

      const ownerEmail = owner.email;
      if (!ownerEmail) {
        this.logger.error(`No owner email found for establishment ${establishment._id.toString()}`);
        return;
      }

      // Determine notification content based on status
      let title: string;
      let body: string;
      let priority = NotificationPriority.MEDIUM;

      switch (updateDto.status) {
        case EstablishmentStatus.ACTIVE:
          title = `✅ Your establishment "${establishment.name}" is now active`;
          body = `Great news! Your establishment has been reactivated and is now live on our platform.`;
          priority = NotificationPriority.HIGH;
          break;
        case EstablishmentStatus.SUSPENDED:
          title = `⚠️ Your establishment "${establishment.name}" has been suspended`;
          body = `Your establishment has been temporarily suspended. ${updateDto.reason ? `Reason: ${updateDto.reason}` : ''}`;
          priority = NotificationPriority.HIGH;
          break;
        case EstablishmentStatus.REJECTED:
          title = `❌ Your establishment "${establishment.name}" has been rejected`;
          body = `Your establishment status has been changed to rejected. ${updateDto.reason ? `Reason: ${updateDto.reason}` : ''}`;
          priority = NotificationPriority.HIGH;
          break;
        default:
          title = `📢 Status update for "${establishment.name}"`;
          body = `Your establishment status has been updated to ${updateDto.status}.`;
      }

      const notificationData: ISendNotificationRequest = {
        type: 'email',
        trigger: 'establishment_status_changed',
        target: {
          userId: owner._id,
          establishmentId: establishment._id.toString(),
        },
        payload: {
          title,
          body: updateDto.reason
            ? `${body} Please contact support if you have any questions.`
            : body,
          data: {
            establishmentId: establishment._id.toString(),
            establishmentName: establishment.name,
            previousStatus: establishment.status,
            newStatus: updateDto.status,
            reason: updateDto.reason,
            adminNotes: updateDto.adminNotes,
            reactivationDate: updateDto.reactivationDate,
          },
        },
        priority,
        templateVariables: {
          establishmentName: establishment.name,
          ownerName: `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'Owner',
          newStatus: updateDto.status,
          reason: updateDto.reason || 'Not specified',
          adminNotes: updateDto.adminNotes || '',
          reactivationDate: updateDto.reactivationDate?.toLocaleDateString() || 'Not specified',
          supportEmail: process.env['SUPPORT_EMAIL'] || 'support@foodwaste.com',
          dashboardUrl: `${process.env['FRONTEND_URL'] || 'https://app.foodwaste.com'}/establishment/dashboard`,
        },
      };

      // Send the notification
      const result = await this.notificationService.sendNotification(notificationData);

      if (result.success) {
        this.logger.log(
          `Status change notification sent successfully to ${ownerEmail} for establishment ${establishment._id.toString()}`,
        );
      } else {
        this.logger.error(`Failed to send status change notification: ${result.error}`);
      }
    } catch (error) {
      this.logger.error(
        `Error sending status change notification for establishment ${establishment._id.toString()}:`,
        error,
      );
    }
  }

  private async scheduleReactivation(
    establishmentId: string,
    reactivationDate: Date,
    adminId: string,
    adminEmail: string,
  ): Promise<void> {
    try {
      if (!this.establishmentQueue) {
        this.logger.warn('Establishment queue not available, scheduling via fallback method');
        // Fallback: Log the scheduling for manual processing
        this.logger.log(
          `MANUAL REACTIVATION REQUIRED: Establishment ${establishmentId} should be reactivated on ${reactivationDate.toISOString()}`,
        );
        return;
      }

      // Calculate delay in milliseconds
      const now = new Date();
      const delay = reactivationDate.getTime() - now.getTime();

      if (delay <= 0) {
        this.logger.warn(
          `Reactivation date ${reactivationDate.toISOString()} is in the past for establishment ${establishmentId}`,
        );
        return;
      }

      // Prepare job data
      const jobData: EstablishmentReactivationJob = {
        establishmentId,
        reactivationDate,
        reason: 'Scheduled reactivation after suspension',
      };

      // Add job to queue with delay
      const job = await this.establishmentQueue.add('reactivate-establishment', jobData, {
        delay,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 10,
        removeOnFail: 5,
        jobId: `reactivation-${establishmentId}-${reactivationDate.getTime()}`,
      });

      this.logger.log(
        `Reactivation job scheduled for establishment ${establishmentId} on ${reactivationDate.toISOString()} (Job ID: ${job.id})`,
      );

      // Store job reference for potential cancellation
      await this.storeReactivationJobReference(establishmentId, job.id as string, reactivationDate);

      // Emit reactivation scheduled event
      await this.eventBus.emit(
        'admin.establishment.reactivation_scheduled',
        new AdminEstablishmentReactivationScheduledEvent(
          establishmentId,
          adminId,
          adminEmail,
          reactivationDate,
        ),
      );
    } catch (error) {
      this.logger.error(
        `Failed to schedule reactivation for establishment ${establishmentId}:`,
        error,
      );
      throw error;
    }
  }

  private async storeReactivationJobReference(
    establishmentId: string,
    jobId: string,
    reactivationDate: Date,
  ): Promise<void> {
    try {
      // Update establishment document with job reference
      await this.establishmentModel.findByIdAndUpdate(establishmentId, {
        $set: {
          'metadata.scheduledReactivation': {
            jobId,
            scheduledFor: reactivationDate,
            scheduledAt: new Date(),
            status: 'pending',
          },
        },
      });

      this.logger.debug(`Stored reactivation job reference for establishment ${establishmentId}`);
    } catch (error) {
      this.logger.error(
        `Failed to store reactivation job reference for establishment ${establishmentId}:`,
        error,
      );
    }
  }

  async cancelScheduledReactivation(establishmentId: string): Promise<void> {
    try {
      if (!this.establishmentQueue) {
        this.logger.warn('Establishment queue not available');
        return;
      }

      const establishment = await this.establishmentModel.findById(establishmentId);
      const jobRef = establishment?.metadata?.scheduledReactivation;

      if (jobRef?.jobId && jobRef.status === 'pending') {
        const job = await this.establishmentQueue.getJob(jobRef.jobId);
        if (job) {
          await job.remove();
          this.logger.log(
            `Cancelled reactivation job ${jobRef.jobId} for establishment ${establishmentId}`,
          );
        }

        // Update job status
        await this.establishmentModel.findByIdAndUpdate(establishmentId, {
          $set: {
            'metadata.scheduledReactivation.status': 'cancelled',
            'metadata.scheduledReactivation.cancelledAt': new Date(),
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to cancel scheduled reactivation for establishment ${establishmentId}:`,
        error,
      );
    }
  }

  /**
   * Emit approval/rejection event for establishment
   * Triggers search indexing, merchant onboarding, analytics
   */
  private async emitApprovalEvent(
    establishment: EstablishmentDocument,
    approveDto: ApproveEstablishmentDto,
    adminId: string,
    adminEmail: string,
  ): Promise<void> {
    try {
      const ownerId = establishment.ownerId.toString();

      if (approveDto.approved) {
        await this.eventBus.emit(
          'admin.establishment.approved',
          new AdminEstablishmentApprovedEvent(
            establishment._id.toString(),
            adminId,
            adminEmail,
            establishment.name,
            ownerId,
            approveDto.adminNotes,
          ),
        );
      } else {
        await this.eventBus.emit(
          'admin.establishment.rejected',
          new AdminEstablishmentRejectedEvent(
            establishment._id.toString(),
            adminId,
            adminEmail,
            establishment.name,
            ownerId,
            approveDto.reason || 'No reason provided',
            approveDto.adminNotes,
          ),
        );
      }

      this.logger.debug(
        `Emitted ${approveDto.approved ? 'approval' : 'rejection'} event for establishment ${establishment._id.toString()}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to emit approval event for establishment ${establishment._id.toString()}:`,
        error,
      );
    }
  }

  /**
   * Emit status change event for establishment
   * Triggers offer deactivation, search updates, notifications
   */
  private async emitStatusChangeEvent(
    establishment: EstablishmentDocument,
    previousStatus: EstablishmentStatus,
    updateDto: UpdateEstablishmentStatusDto,
    adminId: string,
    adminEmail: string,
  ): Promise<void> {
    try {
      const establishmentId = establishment._id.toString();
      const ownerId = establishment.ownerId.toString();

      // Emit generic status change event
      await this.eventBus.emit(
        'admin.establishment.status_changed',
        new AdminEstablishmentStatusChangedEvent(
          establishmentId,
          adminId,
          adminEmail,
          previousStatus,
          updateDto.status,
          updateDto.reason,
        ),
      );

      // Emit specific status events for targeted reactions
      if (updateDto.status === EstablishmentStatus.SUSPENDED) {
        await this.eventBus.emit(
          'admin.establishment.suspended',
          new AdminEstablishmentSuspendedEvent(
            establishmentId,
            adminId,
            adminEmail,
            establishment.name,
            ownerId,
            updateDto.reason || 'No reason provided',
            updateDto.reactivationDate,
            updateDto.adminNotes,
          ),
        );
      } else if (
        updateDto.status === EstablishmentStatus.ACTIVE &&
        previousStatus === EstablishmentStatus.SUSPENDED
      ) {
        await this.eventBus.emit(
          'admin.establishment.reactivated',
          new AdminEstablishmentReactivatedEvent(
            establishmentId,
            adminId,
            adminEmail,
            establishment.name,
            ownerId,
            updateDto.reason,
          ),
        );
      }

      this.logger.debug(
        `Emitted status change events for establishment ${establishmentId}: ${previousStatus} → ${updateDto.status}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to emit status change events for establishment ${establishment._id.toString()}:`,
        error,
      );
    }
  }
}
