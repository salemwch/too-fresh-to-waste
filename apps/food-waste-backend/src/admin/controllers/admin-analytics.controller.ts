import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpStatus,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Types } from 'mongoose';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  PlatformAnalyticsResponseDto,
  AuditLogResponseDto,
  AuditLogItemResponseDto,
  AuditStatisticsResponseDto,
  RecentActivityResponseDto,
  AuditLogExportResponseDto,
} from '../dto/admin-analytics-response.dto';
import {
  AnalyticsPeriodType,
  GetAnalyticsQueryDto,
  GetAuditLogsQueryDto,
} from '../dto/admin-analytics.dto';
import { AdminOnlyGuard } from '../guards/admin-only.guard';
import {
  PlatformAnalytics,
  AdminAction,
  AuditLogValue,
} from '../interfaces/admin-analytics.interface';
import { AdminAnalyticsService } from '../services/admin-analytics.service';
import {
  AdminAuditService,
  AuditLogResponse,
  AuditStatisticsResult,
} from '../services/admin-audit.service';

import { appError } from '../../common/errors';
@ApiTags('Admin Analytics')
@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@ApiBearerAuth()
export class AdminAnalyticsController {
  private readonly logger = new Logger(AdminAnalyticsController.name);

  constructor(
    private readonly analyticsService: AdminAnalyticsService,
    private readonly auditService: AdminAuditService,
  ) {}

  @Get('platform')
  @ApiOperation({
    summary: 'Get platform analytics',
    description:
      'Retrieve comprehensive platform analytics including users, establishments, orders, and revenue data',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Platform analytics retrieved successfully',
    type: PlatformAnalyticsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid query parameters provided',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal server error occurred while generating analytics',
  })
  // Third copy of the same list, also missing `all`. Derived now, like the
  // validator - a documented set that disagrees with the accepted set sends
  // integrators down a dead end.
  @ApiQuery({ name: 'period', required: false, enum: AnalyticsPeriodType })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'includeDetails', required: false, type: Boolean })
  async getPlatformAnalytics(
    @Query() query: GetAnalyticsQueryDto,
  ): Promise<PlatformAnalyticsResponseDto> {
    this.logger.log(`Generating platform analytics with parameters: ${JSON.stringify(query)}`);

    try {
      this.validateAnalyticsQuery(query);
      const analytics = await this.analyticsService.getPlatformAnalytics(query);
      return this.mapToResponseDto(analytics);
    } catch (error) {
      this.logger.error('Failed to retrieve platform analytics:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(appError('ANALYTICS_FAILED'));
    }
  }

  @Get('anomalies')
  @ApiOperation({
    summary: 'Get anomaly detection alerts',
    description:
      'Returns platform anomalies: high cancellation merchants, high expiry rates, cancellation spikes, unusual-hour activity.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Anomalies retrieved successfully' })
  async getAnomalies() {
    const alerts = await this.analyticsService.getAnomalies();
    return {
      status: 'success',
      message: 'Anomalies retrieved successfully',
      data: alerts,
    };
  }

  @Get('audit-logs')
  @ApiOperation({
    summary: 'Get audit logs',
    description: 'Retrieve admin audit logs with filtering and pagination',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit logs retrieved successfully',
    type: AuditLogResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid query parameters provided',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal server error occurred while retrieving audit logs',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'adminId', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'targetType', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getAuditLogs(@Query() query: GetAuditLogsQueryDto): Promise<AuditLogResponseDto> {
    try {
      this.validateAuditLogsQuery(query);
      const auditLogs = await this.auditService.getAuditLogs(query);
      return this.mapAuditLogsToResponseDto(auditLogs);
    } catch (error) {
      this.logger.error('Failed to retrieve audit logs:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(appError('AUDIT_LOGS_FAILED'));
    }
  }

  @Get('audit-stats')
  @ApiOperation({
    summary: 'Get audit statistics',
    description: 'Retrieve audit log statistics and activity summaries',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit statistics retrieved successfully',
    type: AuditStatisticsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid days parameter provided',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal server error occurred while calculating statistics',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days to analyze (default: 30)',
  })
  async getAuditStatistics(@Query('days') days?: number): Promise<AuditStatisticsResponseDto> {
    try {
      this.validateDaysParameter(days);
      const statistics = await this.auditService.getAuditStatistics(days ?? 30);
      return this.mapAuditStatsToResponseDto(statistics);
    } catch (error) {
      this.logger.error('Failed to retrieve audit statistics:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(appError('AUDIT_LOGS_FAILED'));
    }
  }

  @Get('recent-activity')
  @ApiOperation({
    summary: 'Get recent admin activity',
    description: 'Retrieve recent admin activity across the platform',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Recent activity retrieved successfully',
    type: RecentActivityResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid hours or limit parameters provided',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal server error occurred while retrieving recent activity',
  })
  @ApiQuery({
    name: 'hours',
    required: false,
    type: Number,
    description: 'Hours to look back (default: 24)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max number of activities (default: 100)',
  })
  async getRecentActivity(
    @Query('hours') hours?: number,
    @Query('limit') limit?: number,
  ): Promise<RecentActivityResponseDto> {
    try {
      this.validateRecentActivityParams(hours, limit);
      const activities = await this.auditService.getRecentActivity(hours ?? 24, limit ?? 100);
      return this.mapRecentActivityToResponseDto(activities, hours ?? 24, limit ?? 100);
    } catch (error) {
      this.logger.error('Failed to retrieve recent activity:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(appError('ANALYTICS_FAILED'));
    }
  }

  @Get('export/audit-logs')
  @ApiOperation({
    summary: 'Export audit logs',
    description: 'Export audit logs for a specific date range',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit logs exported successfully',
    type: AuditLogExportResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid date range or format parameters provided',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal server error occurred while exporting audit logs',
  })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['json', 'csv'],
    description: 'Export format (default: json)',
  })
  async exportAuditLogs(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('format') format: 'json' | 'csv' = 'json',
  ): Promise<AuditLogExportResponseDto> {
    try {
      this.validateExportParams(startDate, endDate, format);

      const start = new Date(startDate);
      const end = new Date(endDate);

      const exportedData = await this.auditService.exportAuditLogs(start, end, format);

      return this.mapExportToResponseDto(exportedData, format, start, end);
    } catch (error) {
      this.logger.error('Failed to export audit logs:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(appError('AUDIT_LOGS_FAILED'));
    }
  }

  // Private mapping methods for type-safe conversion

  private mapToResponseDto(analytics: PlatformAnalytics): PlatformAnalyticsResponseDto {
    return {
      users: {
        totalUsers: analytics.users.totalUsers,
        activeUsers: analytics.users.activeUsers,
        newUsersToday: analytics.users.newUsersToday,
        newUsersThisWeek: analytics.users.newUsersThisWeek,
        newUsersThisMonth: analytics.users.newUsersThisMonth,
        usersByRole: analytics.users.usersByRole,
        usersByStatus: analytics.users.usersByStatus,
        retentionRate: analytics.users.retentionRate,
        averageSessionDuration: analytics.users.averageSessionDuration,
      },
      establishments: {
        totalEstablishments: analytics.establishments.totalEstablishments,
        activeEstablishments: analytics.establishments.activeEstablishments,
        pendingApproval: analytics.establishments.pendingApproval,
        rejectedEstablishments: analytics.establishments.rejectedEstablishments,
        suspendedEstablishments: analytics.establishments.suspendedEstablishments,
        establishmentsByType: analytics.establishments.establishmentsByType,
        averageRating: analytics.establishments.averageRating,
        topPerformingEstablishments: analytics.establishments.topPerformingEstablishments.map(
          perf => ({
            id: perf.id,
            name: perf.name,
            type: perf.type,
            totalOrders: perf.totalOrders,
            totalRevenue: perf.totalRevenue,
            averageRating: perf.averageRating,
            completionRate: perf.completionRate,
          }),
        ),
      },
      orders: {
        totalOrders: analytics.orders.totalOrders,
        completedOrders: analytics.orders.completedOrders,
        cancelledOrders: analytics.orders.cancelledOrders,
        pendingOrders: analytics.orders.pendingOrders,
        ordersByStatus: analytics.orders.ordersByStatus,
        averageOrderValue: analytics.orders.averageOrderValue,
        orderCompletionRate: analytics.orders.orderCompletionRate,
        orderTrends: analytics.orders.orderTrends.map(trend => ({
          date: trend.date,
          orders: trend.orders,
          revenue: trend.revenue,
        })),
      },
      offers: {
        totalOffers: analytics.offers.totalOffers,
        activeOffers: analytics.offers.activeOffers,
        expiredOffers: analytics.offers.expiredOffers,
        soldOffers: analytics.offers.soldOffers,
        averageDiscount: analytics.offers.averageDiscount,
        mostPopularCategories: analytics.offers.mostPopularCategories.map(cat => ({
          category: cat.category,
          count: cat.count,
          totalRevenue: cat.totalRevenue,
          ...(cat.soldQuantity !== undefined && { soldQuantity: cat.soldQuantity }),
          ...(cat.averagePrice !== undefined && { averagePrice: cat.averagePrice }),
          ...(cat.averageDiscount !== undefined && { averageDiscount: cat.averageDiscount }),
        })),
        wasteReductionImpact: {
          totalKgSaved: analytics.offers.wasteReductionImpact.totalKgSaved,
          totalMealsSaved: analytics.offers.wasteReductionImpact.totalMealsSaved,
          co2ReductionKg: analytics.offers.wasteReductionImpact.co2ReductionKg,
          waterLitersSaved: analytics.offers.wasteReductionImpact.waterLitersSaved,
          totalBagsSaved: analytics.offers.wasteReductionImpact.totalBagsSaved,
          estimatedValue: analytics.offers.wasteReductionImpact.estimatedValue,
          actualRevenue: analytics.offers.wasteReductionImpact.actualRevenue,
        },
      },
      reviews: {
        totalReviews: analytics.reviews.totalReviews,
        averageRating: analytics.reviews.averageRating,
        ratingDistribution: analytics.reviews.ratingDistribution,
        flaggedReviews: analytics.reviews.flaggedReviews,
        reviewsModerationQueue: analytics.reviews.reviewsModerationQueue,
        responseRate: analytics.reviews.responseRate,
      },
      revenue: {
        totalRevenue: analytics.revenue.totalRevenue,
        revenueToday: analytics.revenue.revenueToday,
        revenueThisWeek: analytics.revenue.revenueThisWeek,
        revenueThisMonth: analytics.revenue.revenueThisMonth,
        revenueThisYear: analytics.revenue.revenueThisYear,
        platformCommission: analytics.revenue.platformCommission,
        averageTransactionValue: analytics.revenue.averageTransactionValue,
        revenueByEstablishment: analytics.revenue.revenueByEstablishment.map(rev => ({
          establishmentId: rev.establishmentId,
          establishmentName: rev.establishmentName,
          revenue: rev.revenue,
          orders: rev.orders,
          commission: rev.commission,
        })),
        revenueGrowthRate: analytics.revenue.revenueGrowthRate,
      },
      period: {
        startDate: analytics.period.startDate,
        endDate: analytics.period.endDate,
        periodType: analytics.period.periodType,
      },
    };
  }

  private mapAuditLogsToResponseDto(auditLogs: AuditLogResponse): AuditLogResponseDto {
    return {
      logs: auditLogs.logs.map(log => {
        const populatedAdmin = log.adminId as unknown as
          { _id: Types.ObjectId; firstName?: string } | Types.ObjectId | null;
        const adminFirstName =
          populatedAdmin !== null &&
          typeof populatedAdmin === 'object' &&
          'firstName' in populatedAdmin
            ? (populatedAdmin.firstName ?? '')
            : '';
        const adminId =
          populatedAdmin !== null && typeof populatedAdmin === 'object' && '_id' in populatedAdmin
            ? populatedAdmin._id.toString()
            : String(populatedAdmin ?? '');
        return {
          id: (log._id?.toString() || log.id) as string,
          adminId,
          adminEmail: log.adminEmail,
          adminFirstName,
          action: log.action,
          targetType: log.targetType as
            'user' | 'establishment' | 'order' | 'review' | 'offer' | 'system',
          ...(log.targetId !== undefined && { targetId: log.targetId }),
          ...(log.previousValue !== undefined && { previousValue: log.previousValue }),
          ...(log.newValue !== undefined && { newValue: log.newValue }),
          ...(log.reason !== undefined && { reason: log.reason }),
          timestamp: log.timestamp,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
        };
      }),
      total: auditLogs.total,
      page: auditLogs.page,
      limit: auditLogs.limit,
      totalPages: auditLogs.totalPages,
      hasNext: auditLogs.hasNext,
      hasPrev: auditLogs.hasPrev,
    };
  }

  private mapAuditStatsToResponseDto(
    statistics: AuditStatisticsResult,
  ): AuditStatisticsResponseDto {
    return {
      totalActions: statistics.totalActions,
      actionsByType: statistics.actionsByType,
      activityByAdmin: statistics.activityByAdmin.map(admin => ({
        _id: admin._id.toString(),
        adminEmail: admin.adminEmail,
        count: admin.count,
      })),
      targetsByType: statistics.targetsByType,
      dailyActivity: statistics.dailyActivity.map(daily => ({
        _id: daily._id,
        count: daily.count,
      })),
      period: {
        days: statistics.period.days,
        startDate: statistics.period.startDate,
        endDate: statistics.period.endDate,
      },
    };
  }

  private mapRecentActivityToResponseDto(
    activities: unknown[],
    hoursAnalyzed: number,
    maxActivities: number,
  ): RecentActivityResponseDto {
    return {
      activities: (activities as Record<string, unknown>[]).map(
        (activity: Record<string, unknown>) => {
          const populatedAdmin = activity['adminId'] as
            { _id: Types.ObjectId; firstName?: string } | Types.ObjectId | null;
          const adminFirstName =
            populatedAdmin !== null &&
            typeof populatedAdmin === 'object' &&
            'firstName' in populatedAdmin
              ? (populatedAdmin.firstName ?? '')
              : '';
          const adminId =
            populatedAdmin !== null && typeof populatedAdmin === 'object' && '_id' in populatedAdmin
              ? populatedAdmin._id.toString()
              : String(populatedAdmin ?? '');
          return {
            id: (activity['_id']?.toString() ?? activity['id']) as string,
            adminId,
            adminEmail: activity['adminEmail'] as string,
            adminFirstName,
            action: activity['action'] as AdminAction,
            targetType: activity['targetType'] as
              'user' | 'establishment' | 'order' | 'review' | 'offer' | 'system',
            ...(activity['targetId'] !== undefined && { targetId: activity['targetId'] as string }),
            ...(activity['previousValue'] !== undefined && {
              previousValue: activity['previousValue'] as Record<string, AuditLogValue>,
            }),
            ...(activity['newValue'] !== undefined && {
              newValue: activity['newValue'] as Record<string, AuditLogValue>,
            }),
            ...(activity['reason'] !== undefined && { reason: activity['reason'] as string }),
            timestamp: activity['timestamp'] as Date,
            ipAddress: activity['ipAddress'] as string,
            userAgent: activity['userAgent'] as string,
          };
        },
      ),
      hoursAnalyzed,
      maxActivities,
    };
  }

  private mapExportToResponseDto(
    exportedData: unknown,
    format: 'json' | 'csv',
    startDate: Date,
    endDate: Date,
  ): AuditLogExportResponseDto {
    let data: unknown;
    let totalRecords: number;

    if (format === 'csv') {
      data = exportedData as string;
      // Count lines in CSV (subtract 1 for header)
      totalRecords = Math.max(0, ((data as string).match(/\n/g) ?? []).length - 1);
    } else {
      const jsonData = (exportedData as Record<string, unknown>[]).map(
        (log: Record<string, unknown>) => ({
          id: (log['_id']?.toString() ?? log['id']) as string,
          adminId: (log['adminId'] as Types.ObjectId).toString(),
          adminEmail: log['adminEmail'] as string,
          action: log['action'] as AdminAction,
          targetType: log['targetType'] as
            'user' | 'establishment' | 'order' | 'review' | 'offer' | 'system',
          targetId: log['targetId'] as string,
          previousValue: log['previousValue'] as Record<string, AuditLogValue>,
          newValue: log['newValue'] as Record<string, AuditLogValue>,
          reason: log['reason'] as string,
          timestamp: log['timestamp'] as Date,
          ipAddress: log['ipAddress'] as string,
          userAgent: log['userAgent'] as string,
        }),
      );
      data = jsonData;
      totalRecords = jsonData.length;
    }

    return {
      format,
      data: data as string | AuditLogItemResponseDto[],
      dateRange: {
        startDate,
        endDate,
      },
      totalRecords,
    };
  }

  // Private validation methods for enhanced error handling

  private validateAnalyticsQuery(query: GetAnalyticsQueryDto): void {
    if (query.period === 'custom' && (!query.startDate || !query.endDate)) {
      throw new BadRequestException(appError('DATE_RANGE_REQUIRED'));
    }

    if (query.startDate && query.endDate) {
      const start = new Date(query.startDate);
      const end = new Date(query.endDate);

      if (isNaN(start.getTime())) {
        throw new BadRequestException(appError('INVALID_DATE'));
      }

      if (isNaN(end.getTime())) {
        throw new BadRequestException(appError('INVALID_DATE'));
      }

      if (start >= end) {
        throw new BadRequestException(appError('DATE_RANGE_ORDER'));
      }

      // Limit date range to prevent performance issues
      const maxDays = 365; // 1 year max
      const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > maxDays) {
        throw new BadRequestException(appError('DATE_RANGE_TOO_LONG', { maxDays }));
      }
    }

    /*
     * Derived from the enum, never restated.
     *
     * This was a hand-written array that omitted `all`, so every "All time"
     * request 400'd before it reached the service - `AnalyticsPeriodType`
     * already had ALL_TIME, `calculateAnalyticsPeriod` already handled it, and
     * the DTO's own `@IsEnum` already accepted it. Only this list disagreed,
     * and the error message it produced named the same stale set, so the
     * response looked authoritative.
     *
     * A second list of the same values is a second thing to keep in sync, and
     * this one had already drifted. `Object.values` cannot.
     */
    const allowed = Object.values(AnalyticsPeriodType) as string[];

    if (query.period !== null && query.period !== undefined && !allowed.includes(query.period)) {
      throw new BadRequestException(
        appError('INVALID_PERIOD', { allowed: String(allowed.join(', ')) }),
      );
    }
  }

  private validateAuditLogsQuery(query: GetAuditLogsQueryDto): void {
    if (query.page !== undefined && (query.page < 1 || !Number.isInteger(query.page))) {
      throw new BadRequestException(appError('INVALID_PAGINATION'));
    }

    if (query.limit !== undefined) {
      if (query.limit < 1 || query.limit > 1000 || !Number.isInteger(query.limit)) {
        throw new BadRequestException(appError('INVALID_PAGINATION'));
      }
    }

    if (query.startDate && isNaN(new Date(query.startDate).getTime())) {
      throw new BadRequestException(appError('INVALID_DATE'));
    }

    if (query.endDate && isNaN(new Date(query.endDate).getTime())) {
      throw new BadRequestException(appError('INVALID_DATE'));
    }

    if (query.startDate && query.endDate) {
      const start = new Date(query.startDate);
      const end = new Date(query.endDate);
      if (start >= end) {
        throw new BadRequestException(appError('DATE_RANGE_ORDER'));
      }
    }

    if (query.adminId && !this.isValidObjectId(query.adminId)) {
      throw new BadRequestException(appError('INVALID_ID'));
    }
  }

  private validateDaysParameter(days?: number): void {
    if (days !== undefined) {
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        throw new BadRequestException(appError('DAYS_OUT_OF_RANGE'));
      }
    }
  }

  private validateRecentActivityParams(hours?: number, limit?: number): void {
    if (hours !== undefined) {
      if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
        // Max 1 week
        throw new BadRequestException(appError('HOURS_OUT_OF_RANGE'));
      }
    }

    if (limit !== undefined) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
        throw new BadRequestException(appError('INVALID_PAGINATION'));
      }
    }
  }

  private validateExportParams(startDate: string, endDate: string, format: string): void {
    if (!startDate || !endDate) {
      throw new BadRequestException(appError('DATE_RANGE_REQUIRED'));
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime())) {
      throw new BadRequestException(appError('INVALID_DATE'));
    }

    if (isNaN(end.getTime())) {
      throw new BadRequestException(appError('INVALID_DATE'));
    }

    if (start >= end) {
      throw new BadRequestException(appError('DATE_RANGE_ORDER'));
    }

    // Limit export range to prevent performance issues
    const maxDays = 90; // 3 months max for export
    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > maxDays) {
      throw new BadRequestException(appError('DATE_RANGE_TOO_LONG', { maxDays }));
    }

    if (!['json', 'csv'].includes(format)) {
      throw new BadRequestException(appError('INVALID_EXPORT_FORMAT'));
    }
  }

  private isValidObjectId(id: string): boolean {
    // MongoDB ObjectId validation pattern
    return /^[0-9a-fA-F]{24}$/.test(id);
  }
}
