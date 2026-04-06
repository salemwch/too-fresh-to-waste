import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage, FlattenMaps } from 'mongoose';

import {
  ModerationLogDocument,
  LogLevel,
  LogCategory,
  ModerationLog,
} from '../schemas/moderation-log.schema';

export interface LogModerationEventOptions {
  level: LogLevel;
  category: LogCategory;
  action: string;
  description: string;
  performedBy: string;
  targetId?: string | undefined;
  targetType?: string | undefined;
  relatedReportId?: string | undefined;
  relatedActionId?: string | undefined;
  requestContext?:
    | {
        ipAddress?: string | undefined;
        userAgent?: string | undefined;
        endpoint?: string | undefined;
        method?: string | undefined;
        requestId?: string | undefined;
      }
    | undefined;
  beforeState?: Record<string, unknown> | undefined;
  afterState?: Record<string, unknown> | undefined;
  metadata?: Record<string, unknown> | undefined;
  isAutomated?: boolean | undefined;
  automationRule?: string | undefined;
  tags?: string[] | undefined;
}

/** Plain-object shape returned by aggregate pipelines (no Mongoose Document methods). */
export type ModerationLogLean = FlattenMaps<ModerationLog> & { _id: Types.ObjectId };

interface AggregatedCountResult {
  _id: string;
  count: number;
}

interface TopModeratorResult {
  moderator: Record<string, unknown>;
  actionCount: number;
}

interface AutomatedVsManualResult {
  _id: boolean;
  count: number;
}

@Injectable()
export class ModerationLogService {
  private readonly logger = new Logger(ModerationLogService.name);

  constructor(
    @InjectModel(ModerationLog.name)
    private readonly moderationLogModel: Model<ModerationLogDocument>,
  ) {}

  /**
   * Log a moderation event with comprehensive audit information
   */
  async logModerationEvent(options: LogModerationEventOptions): Promise<void> {
    try {
      const logEntry = new this.moderationLogModel({
        level: options.level,
        category: options.category,
        action: options.action,
        description: options.description,
        performedBy: new Types.ObjectId(options.performedBy),
        targetId: options.targetId ? new Types.ObjectId(options.targetId) : undefined,
        targetType: options.targetType,
        relatedReportId: options.relatedReportId
          ? new Types.ObjectId(options.relatedReportId)
          : undefined,
        relatedActionId: options.relatedActionId
          ? new Types.ObjectId(options.relatedActionId)
          : undefined,
        requestContext: options.requestContext,
        beforeState: options.beforeState ?? {},
        afterState: options.afterState ?? {},
        metadata: options.metadata ?? {},
        isAutomated: options.isAutomated ?? false,
        automationRule: options.automationRule,
        tags: options.tags ?? [],
      });

      await logEntry.save();

      // Also log to application logger for immediate visibility
      const logMessage = `[${options.category}] ${options.action}: ${options.description} (by: ${options.performedBy})`;

      switch (options.level) {
        case LogLevel.CRITICAL:
          this.logger.error(logMessage);
          break;
        case LogLevel.ERROR:
          this.logger.error(logMessage);
          break;
        case LogLevel.WARNING:
          this.logger.warn(logMessage);
          break;
        case LogLevel.INFO:
          this.logger.log(logMessage);
          break;
      }
    } catch (error) {
      this.logger.error('Failed to log moderation event', error);
      // Don't throw error to avoid disrupting the main operation
    }
  }

  /**
   * Get moderation logs with filtering and pagination
   */
  async getModerationLogs(
    filters: {
      level?: LogLevel;
      category?: LogCategory;
      performedBy?: string;
      targetId?: string;
      startDate?: Date;
      endDate?: Date;
      tags?: string[];
      isAutomated?: boolean;
    } = {},
    pagination: { page: number; limit: number; sortBy?: string; sortOrder?: 'asc' | 'desc' } = {
      page: 1,
      limit: 20,
    },
  ): Promise<{ logs: ModerationLogLean[]; total: number; totalPages: number }> {
    const matchConditions: Record<string, unknown> = {};

    // Build query filters
    if (filters.level !== undefined) {
      matchConditions['level'] = filters.level;
    }
    if (filters.category !== undefined) {
      matchConditions['category'] = filters.category;
    }
    if (filters.performedBy) {
      matchConditions['performedBy'] = new Types.ObjectId(filters.performedBy);
    }
    if (filters.targetId) {
      matchConditions['targetId'] = new Types.ObjectId(filters.targetId);
    }
    if (filters.isAutomated !== undefined) {
      matchConditions['isAutomated'] = filters.isAutomated;
    }
    if (filters.tags && filters.tags.length > 0) {
      matchConditions['tags'] = { $in: filters.tags };
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
      const createdAtFilter: Record<string, Date> = {};
      if (filters.startDate) {
        createdAtFilter['$gte'] = filters.startDate;
      }
      if (filters.endDate) {
        createdAtFilter['$lte'] = filters.endDate;
      }
      matchConditions['createdAt'] = createdAtFilter;
    }

    const skip = (pagination.page - 1) * pagination.limit;
    const requestedSortBy = pagination.sortBy;
    const sortBy =
      requestedSortBy !== undefined && requestedSortBy.length > 0 ? requestedSortBy : 'createdAt';
    const sortOrder: 1 | -1 = pagination.sortOrder === 'asc' ? 1 : -1;

    // Paginate first, then $lookup on small result set
    const pipeline: PipelineStage[] = [
      { $match: matchConditions },
      { $sort: { [sortBy]: sortOrder } },
      { $skip: skip },
      { $limit: pagination.limit },
      ...this.getPerformedByLookupStages(),
    ];

    const [logs, total] = await Promise.all([
      this.moderationLogModel.aggregate<ModerationLogLean>(pipeline),
      this.moderationLogModel.countDocuments(matchConditions),
    ]);

    return {
      logs,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  /**
   * Get recent activity for a specific user
   */
  async getUserModerationHistory(
    userId: string,
    resultLimit: number = 10,
  ): Promise<ModerationLogLean[]> {
    const userObjId = new Types.ObjectId(userId);

    const result = await this.moderationLogModel.aggregate<ModerationLogLean>([
      {
        $match: {
          $or: [{ targetId: userObjId }, { performedBy: userObjId }],
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: resultLimit },
      ...this.getPerformedByLookupStages(),
    ]);
    return result;
  }

  /**
   * Get moderation statistics for dashboard
   */
  async getModerationStatistics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalActions: number;
    actionsByLevel: Record<string, number>;
    actionsByCategory: Record<string, number>;
    topModerators: Array<{ moderator: Record<string, unknown>; actionCount: number }>;
    automatedVsManual: { automated: number; manual: number };
  }> {
    const dateFilter =
      startDate || endDate
        ? {
            createdAt: {
              ...(startDate && { $gte: startDate }),
              ...(endDate && { $lte: endDate }),
            },
          }
        : {};

    const [totalActions, actionsByLevel, actionsByCategory, topModerators, automatedVsManual] =
      await Promise.all([
        this.moderationLogModel.countDocuments(dateFilter),

        this.moderationLogModel.aggregate<AggregatedCountResult>([
          { $match: dateFilter },
          { $group: { _id: '$level', count: { $sum: 1 } } },
        ]),

        this.moderationLogModel.aggregate<AggregatedCountResult>([
          { $match: dateFilter },
          { $group: { _id: '$category', count: { $sum: 1 } } },
        ]),

        this.moderationLogModel.aggregate<TopModeratorResult>([
          { $match: dateFilter },
          { $group: { _id: '$performedBy', actionCount: { $sum: 1 } } },
          { $sort: { actionCount: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'moderator',
            },
          },
          { $unwind: '$moderator' },
          {
            $project: {
              moderator: {
                _id: '$moderator._id',
                firstName: '$moderator.firstName',
                lastName: '$moderator.lastName',
                email: '$moderator.email',
                role: '$moderator.role',
              },
              actionCount: 1,
            },
          },
        ]),

        this.moderationLogModel.aggregate<AutomatedVsManualResult>([
          { $match: dateFilter },
          { $group: { _id: '$isAutomated', count: { $sum: 1 } } },
        ]),
      ]);

    // Transform aggregation results into more usable format
    const levelStats = actionsByLevel.reduce(
      (acc, item) => {
        acc[item._id] = item.count;
        return acc;
      },
      {} as Record<string, number>,
    );

    const categoryStats = actionsByCategory.reduce(
      (acc, item) => {
        acc[item._id] = item.count;
        return acc;
      },
      {} as Record<string, number>,
    );

    const automatedStats = automatedVsManual.reduce(
      (acc, item) => {
        if (item._id === true) {
          acc.automated = item.count;
        } else {
          acc.manual = item.count;
        }
        return acc;
      },
      { automated: 0, manual: 0 },
    );

    return {
      totalActions,
      actionsByLevel: levelStats,
      actionsByCategory: categoryStats,
      topModerators,
      automatedVsManual: automatedStats,
    };
  }

  /**
   * Reusable $lookup for performedBy → users collection.
   */
  private getPerformedByLookupStages(): PipelineStage[] {
    return [
      {
        $lookup: {
          from: 'users',
          let: { userObjId: '$performedBy' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$userObjId'] } } },
            { $project: { _id: 1, firstName: 1, lastName: 1, email: 1, role: 1 } },
          ],
          as: 'performedBy',
        },
      },
      { $unwind: { path: '$performedBy', preserveNullAndEmptyArrays: true } },
    ];
  }
}
