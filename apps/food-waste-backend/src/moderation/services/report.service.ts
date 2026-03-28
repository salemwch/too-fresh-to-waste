import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage, FlattenMaps } from 'mongoose';

import { UserRole } from '../../common/enums/user.enum';
import { CreateReportDto } from '../dtos/create-report.dto';
import { ReportQueryDto, ReportUpdateDto } from '../dtos/report-query.dto';
import { LogLevel, LogCategory } from '../schemas/moderation-log.schema';
import { Report, ReportDocument, ReportStatus, ReportPriority } from '../schemas/report.schema';

import { ModerationLogService } from './moderation-log.service';

/** Plain-object shape returned by aggregate pipelines (no Mongoose Document methods). */
export type ReportLean = FlattenMaps<Report> & { _id: Types.ObjectId };

@Injectable()
export class ReportService {
  constructor(
    @InjectModel(Report.name)
    private readonly reportModel: Model<ReportDocument>,
    private readonly moderationLogService: ModerationLogService,
  ) {}

  async createReport(
    createReportDto: CreateReportDto,
    reporterId: string,
    requestContext?:
      | {
          ipAddress?: string | undefined;
          userAgent?: string | undefined;
          endpoint?: string | undefined;
        }
      | undefined,
  ): Promise<ReportDocument> {
    // Check for duplicate reports within 24 hours
    const existingReport = await this.reportModel.findOne({
      reporterId: new Types.ObjectId(reporterId),
      targetId: new Types.ObjectId(createReportDto.targetId),
      type: createReportDto.type,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    if (existingReport) {
      throw new BadRequestException(
        'You have already reported this content within the last 24 hours',
      );
    }

    // Auto-prioritize based on reason
    const priority = this.determinePriority(createReportDto.reason);

    const report = new this.reportModel({
      ...createReportDto,
      reporterId: new Types.ObjectId(reporterId),
      targetId: new Types.ObjectId(createReportDto.targetId),
      priority,
      status: ReportStatus.PENDING,
      moderationHistory: [
        {
          action: 'created',
          performedBy: new Types.ObjectId(reporterId),
          details: 'Report created',
          timestamp: new Date(),
        },
      ],
    });

    const savedReport = await report.save();

    // Log the report creation
    await this.moderationLogService.logModerationEvent({
      level: priority === ReportPriority.CRITICAL ? LogLevel.CRITICAL : LogLevel.INFO,
      category: LogCategory.REPORT_HANDLING,
      action: 'REPORT_CREATED',
      description: `New report created for ${createReportDto.type}: ${createReportDto.reason}`,
      performedBy: reporterId,
      targetId: createReportDto.targetId,
      targetType: createReportDto.type,
      relatedReportId: savedReport._id.toString(),
      requestContext,
      metadata: { priority, reason: createReportDto.reason },
    });

    return savedReport;
  }

  /**
   * Get reports with filtering and pagination, respecting user permissions
   */
  async getReports(
    queryDto: ReportQueryDto,
    currentUserId: string,
    userRole: UserRole,
  ): Promise<{ reports: ReportLean[]; total: number; totalPages: number }> {
    const matchConditions: Record<string, unknown> = {};
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const sortBy = queryDto.sortBy ?? 'createdAt';

    // Build query based on filters
    if (queryDto.type) {
      matchConditions['type'] = queryDto.type;
    }
    if (queryDto.reason) {
      matchConditions['reason'] = queryDto.reason;
    }
    if (queryDto.status) {
      matchConditions['status'] = queryDto.status;
    }
    if (queryDto.priority) {
      matchConditions['priority'] = queryDto.priority;
    }
    if (queryDto.reporterId) {
      matchConditions['reporterId'] = new Types.ObjectId(queryDto.reporterId);
    }

    // Role-based access control
    if (userRole === UserRole.MODERATOR) {
      matchConditions['$or'] = [
        { assignedToModerator: new Types.ObjectId(currentUserId) },
        { assignedToModerator: { $exists: false } },
        { assignedToModerator: null },
      ];
    }

    // Date range filter
    if (queryDto.startDate || queryDto.endDate) {
      const createdAtFilter: Record<string, Date> = {};
      if (queryDto.startDate) {
        createdAtFilter['$gte'] = new Date(queryDto.startDate);
      }
      if (queryDto.endDate) {
        createdAtFilter['$lte'] = new Date(queryDto.endDate);
      }
      matchConditions['createdAt'] = createdAtFilter;
    }

    // Search functionality
    if (queryDto.search) {
      matchConditions['$or'] = [
        { description: { $regex: queryDto.search, $options: 'i' } },
        { resolutionNotes: { $regex: queryDto.search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const sortOrder: 1 | -1 = queryDto.sortOrder === 'asc' ? 1 : -1;

    // Paginate first, then $lookup on small result set
    const pipeline: PipelineStage[] = [
      { $match: matchConditions },
      { $sort: { [sortBy]: sortOrder } },
      { $skip: skip },
      { $limit: limit },
      ...this.getUserLookupStages('reporterId'),
      ...this.getUserLookupStages('assignedToModerator'),
      ...this.getUserLookupStages('resolvedBy'),
    ];

    const [reports, total] = await Promise.all([
      this.reportModel.aggregate<ReportLean>(pipeline),
      this.reportModel.countDocuments(matchConditions),
    ]);

    return {
      reports,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a specific report by ID with permission checks
   */
  /**
   * Get report by ID with all user lookups (for API responses).
   */
  async getReportById(
    reportId: string,
    currentUserId: string,
    userRole: UserRole,
  ): Promise<ReportLean> {
    if (!Types.ObjectId.isValid(reportId)) {
      throw new BadRequestException('Invalid report ID');
    }

    const [report] = await this.reportModel.aggregate<ReportLean>([
      { $match: { _id: new Types.ObjectId(reportId) } },
      { $limit: 1 },
      ...this.getUserLookupStages('reporterId'),
      ...this.getUserLookupStages('assignedToModerator'),
      ...this.getUserLookupStages('resolvedBy'),
      ...this.getModerationHistoryLookupStages(),
    ]);

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    // Permission check for moderators — after $lookup, assignedToModerator is a user object or null
    if (userRole === UserRole.MODERATOR && report.assignedToModerator) {
      const assigned = report.assignedToModerator as unknown as { _id: Types.ObjectId };
      if (assigned._id && String(assigned._id) !== currentUserId) {
        throw new ForbiddenException('You can only access reports assigned to you');
      }
    }

    return report;
  }

  /**
   * Internal: get raw document for mutations (no joins needed).
   */
  private async getReportRaw(
    reportId: string,
    currentUserId: string,
    userRole: UserRole,
  ): Promise<ReportDocument> {
    const report = await this.reportModel.findById(reportId).exec();

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    // Permission check for moderators — assignedToModerator is a raw ObjectId
    if (
      userRole === UserRole.MODERATOR &&
      report.assignedToModerator &&
      !report.assignedToModerator.equals(currentUserId)
    ) {
      throw new ForbiddenException('You can only access reports assigned to you');
    }

    return report;
  }

  /**
   * Update report with audit logging
   */
  async updateReport(
    reportId: string,
    updateDto: ReportUpdateDto,
    currentUserId: string,
    userRole: UserRole,
    requestContext?: { ipAddress?: string | undefined; userAgent?: string | undefined } | undefined,
  ): Promise<ReportLean> {
    const report = await this.getReportRaw(reportId, currentUserId, userRole);

    const beforeState = {
      status: report.status,
      priority: report.priority,
      assignedToModerator: report.assignedToModerator?.toString(),
      resolutionNotes: report.resolutionNotes,
    };

    // Update fields
    if (updateDto.status !== undefined) {
      report.status = updateDto.status;

      if (updateDto.status === ReportStatus.RESOLVED) {
        report.resolvedBy = new Types.ObjectId(currentUserId);
        report.resolvedAt = new Date();
      }
    }

    if (updateDto.priority !== undefined) {
      report.priority = updateDto.priority;
    }

    if (updateDto.assignedToModerator !== undefined) {
      report.assignedToModerator = updateDto.assignedToModerator
        ? new Types.ObjectId(updateDto.assignedToModerator)
        : undefined;
    }

    if (updateDto.resolutionNotes !== undefined) {
      report.resolutionNotes = updateDto.resolutionNotes;
    }

    // Add to moderation history
    report.moderationHistory.push({
      action: 'updated',
      performedBy: new Types.ObjectId(currentUserId),
      details: `Report updated: ${Object.keys(updateDto).join(', ')}`,
      timestamp: new Date(),
    });

    await report.save();

    const afterState = {
      status: report.status,
      priority: report.priority,
      assignedToModerator: report.assignedToModerator?.toString(),
      resolutionNotes: report.resolutionNotes,
    };

    // Log the update
    await this.moderationLogService.logModerationEvent({
      level: LogLevel.INFO,
      category: LogCategory.REPORT_HANDLING,
      action: 'REPORT_UPDATED',
      description: `Report ${reportId} updated`,
      performedBy: currentUserId,
      targetId: report.targetId.toString(),
      targetType: report.type,
      relatedReportId: reportId,
      requestContext,
      beforeState,
      afterState,
      metadata: updateDto as unknown as Record<string, unknown>,
    });

    // Return with lookups for API response
    return this.getReportById(reportId, currentUserId, userRole);
  }

  /**
   * Assign report to moderator (admin only)
   */
  async assignReport(
    reportId: string,
    moderatorId: string,
    assignedBy: string,
    requestContext?: { ipAddress?: string | undefined; userAgent?: string | undefined } | undefined,
  ): Promise<ReportDocument> {
    const report = await this.reportModel.findById(reportId);

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const previousModerator = report.assignedToModerator;
    report.assignedToModerator = new Types.ObjectId(moderatorId);
    report.status = ReportStatus.IN_REVIEW;

    report.moderationHistory.push({
      action: 'assignment',
      performedBy: new Types.ObjectId(assignedBy),
      details: `Assigned to moderator ${moderatorId}`,
      timestamp: new Date(),
    });

    const updatedReport = await report.save();

    // Log the assignment
    await this.moderationLogService.logModerationEvent({
      level: LogLevel.INFO,
      category: LogCategory.REPORT_HANDLING,
      action: 'REPORT_ASSIGNED',
      description: `Report assigned to moderator`,
      performedBy: assignedBy,
      targetId: report.targetId.toString(),
      targetType: report.type,
      relatedReportId: reportId,
      requestContext,
      beforeState: { assignedToModerator: previousModerator?.toString() },
      afterState: { assignedToModerator: moderatorId },
      metadata: { moderatorId },
    });

    return updatedReport;
  }

  /**
   * Get reports assigned to a specific moderator
   */
  async getMyAssignedReports(moderatorId: string, status?: ReportStatus): Promise<ReportLean[]> {
    const matchConditions: Record<string, unknown> = {
      assignedToModerator: new Types.ObjectId(moderatorId),
    };

    if (status) {
      matchConditions['status'] = status;
    }

    const result = await this.reportModel.aggregate<ReportLean>([
      { $match: matchConditions },
      { $sort: { priority: -1, createdAt: -1 } },
      ...this.getUserLookupStages('reporterId'),
    ]);
    return result;
  }

  /**
   * Get dashboard statistics for moderation team
   */
  async getDashboardStats(
    moderatorId?: string,
    userRole?: UserRole,
  ): Promise<{
    total: number;
    pending: number;
    inReview: number;
    resolved: number;
    byPriority: Record<string, number>;
    byType: Record<string, number>;
    assignedToMe?: number;
  }> {
    const baseQuery =
      userRole === UserRole.MODERATOR && moderatorId
        ? { assignedToModerator: new Types.ObjectId(moderatorId) }
        : {};

    const [total, pending, inReview, resolved, byPriority, byType, assignedToMe] =
      await Promise.all([
        this.reportModel.countDocuments(baseQuery),
        this.reportModel.countDocuments({ ...baseQuery, status: ReportStatus.PENDING }),
        this.reportModel.countDocuments({ ...baseQuery, status: ReportStatus.IN_REVIEW }),
        this.reportModel.countDocuments({ ...baseQuery, status: ReportStatus.RESOLVED }),

        this.reportModel.aggregate([
          { $match: baseQuery },
          { $group: { _id: '$priority', count: { $sum: 1 } } },
        ]),

        this.reportModel.aggregate([
          { $match: baseQuery },
          { $group: { _id: '$type', count: { $sum: 1 } } },
        ]),

        moderatorId
          ? this.reportModel.countDocuments({
              assignedToModerator: new Types.ObjectId(moderatorId),
            })
          : Promise.resolve(0),
      ]);

    const priorityStats = byPriority.reduce<Record<string, number>>((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const typeStats = byType.reduce<Record<string, number>>((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const stats: {
      total: number;
      pending: number;
      inReview: number;
      resolved: number;
      byPriority: Record<string, number>;
      byType: Record<string, number>;
      assignedToMe?: number;
    } = {
      total,
      pending,
      inReview,
      resolved,
      byPriority: priorityStats,
      byType: typeStats,
    };

    if (moderatorId) {
      stats.assignedToMe = assignedToMe;
    }

    return stats;
  }

  /**
   * Reusable $lookup for a user ObjectId field → users collection.
   */
  private getUserLookupStages(
    localField: string,
    fields: string[] = ['firstName', 'lastName', 'email'],
  ): PipelineStage[] {
    const projection: Record<string, 1> = { _id: 1 };
    for (const f of fields) {
      projection[f] = 1;
    }

    return [
      {
        $lookup: {
          from: 'users',
          let: { userObjId: `$${localField}` },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$userObjId'] } } },
            { $project: projection },
          ],
          as: localField,
        },
      },
      { $unwind: { path: `$${localField}`, preserveNullAndEmptyArrays: true } },
    ];
  }

  /**
   * $lookup for moderationHistory.performedBy (nested array of ObjectId refs → users).
   * Uses $map + $lookup + $arrayElemAt to resolve each performedBy in the array.
   */
  private getModerationHistoryLookupStages(): PipelineStage[] {
    return [
      // Collect all unique performedBy IDs from the array
      {
        $lookup: {
          from: 'users',
          let: {
            performerIds: {
              $map: {
                input: { $ifNull: ['$moderationHistory', []] },
                as: 'h',
                in: '$$h.performedBy',
              },
            },
          },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', '$$performerIds'] } } },
            { $project: { _id: 1, firstName: 1, lastName: 1, email: 1 } },
          ],
          as: '_historyPerformers',
        },
      },
      // Map each history entry to replace performedBy ObjectId with the looked-up user
      {
        $addFields: {
          moderationHistory: {
            $map: {
              input: { $ifNull: ['$moderationHistory', []] },
              as: 'h',
              in: {
                $mergeObjects: [
                  '$$h',
                  {
                    performedBy: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$_historyPerformers',
                            as: 'u',
                            cond: { $eq: ['$$u._id', '$$h.performedBy'] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
      // Remove temporary lookup field
      { $project: { _historyPerformers: 0 } },
    ];
  }

  /**
   * Auto-determine priority based on report reason
   */
  private determinePriority(reason: string): ReportPriority {
    const criticalReasons = ['health_safety', 'fraud'];
    const highReasons = ['harassment', 'inappropriate_content'];
    const mediumReasons = ['spam', 'fake_profile', 'violation_of_terms'];

    if (criticalReasons.includes(reason)) {
      return ReportPriority.CRITICAL;
    } else if (highReasons.includes(reason)) {
      return ReportPriority.HIGH;
    } else if (mediumReasons.includes(reason)) {
      return ReportPriority.MEDIUM;
    }
    return ReportPriority.LOW;
  }
}
