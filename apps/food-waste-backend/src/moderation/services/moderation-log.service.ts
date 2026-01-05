import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ModerationLogDocument, LogLevel, LogCategory, ModerationLog } from '../schemas/moderation-log.schema';

export interface LogModerationEventOptions {
    level: LogLevel;
    category: LogCategory;
    action: string;
    description: string;
    performedBy: string;
    targetId?: string;
    targetType?: string;
    relatedReportId?: string;
    relatedActionId?: string;
    requestContext?: {
        ipAddress?: string;
        userAgent?: string;
        endpoint?: string;
        method?: string;
        requestId?: string;
    };
    beforeState?: Record<string, any>;
    afterState?: Record<string, any>;
    metadata?: Record<string, any>;
    isAutomated?: boolean;
    automationRule?: string;
    tags?: string[];
}

@Injectable()
export class ModerationLogService {
    private readonly logger = new Logger(ModerationLogService.name);

    constructor(
        @InjectModel(ModerationLog.name)
        private readonly moderationLogModel: Model<ModerationLogDocument>
    ) { }

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
                relatedReportId: options.relatedReportId ? new Types.ObjectId(options.relatedReportId) : undefined,
                relatedActionId: options.relatedActionId ? new Types.ObjectId(options.relatedActionId) : undefined,
                requestContext: options.requestContext,
                beforeState: options.beforeState || {},
                afterState: options.afterState || {},
                metadata: options.metadata || {},
                isAutomated: options.isAutomated || false,
                automationRule: options.automationRule,
                tags: options.tags || [],
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
                default:
                    this.logger.log(logMessage);
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
        pagination: { page: number; limit: number; sortBy?: string; sortOrder?: 'asc' | 'desc' } = { page: 1, limit: 20 }
    ): Promise<{ logs: ModerationLogDocument[]; total: number; totalPages: number }> {
        const query: any = {};

        // Build query filters
        if (filters.level) { query.level = filters.level; }
        if (filters.category) { query.category = filters.category; }
        if (filters.performedBy) { query.performedBy = new Types.ObjectId(filters.performedBy); }
        if (filters.targetId) { query.targetId = new Types.ObjectId(filters.targetId); }
        if (filters.isAutomated !== undefined) { query.isAutomated = filters.isAutomated; }
        if (filters.tags && filters.tags.length > 0) { query.tags = { $in: filters.tags }; }

        // Date range filter
        if (filters.startDate || filters.endDate) {
            query.createdAt = {};
            if (filters.startDate) { query.createdAt.$gte = filters.startDate; }
            if (filters.endDate) { query.createdAt.$lte = filters.endDate; }
        }

        const skip = (pagination.page - 1) * pagination.limit;
        const sortBy = pagination.sortBy || 'createdAt';
        const sortOrder = pagination.sortOrder === 'asc' ? 1 : -1;

        const [logs, total] = await Promise.all([
            this.moderationLogModel
                .find(query)
                .populate('performedBy', 'firstName lastName email role')
                .sort({ [sortBy]: sortOrder })
                .skip(skip)
                .limit(pagination.limit)
                .exec(),
            this.moderationLogModel.countDocuments(query)
        ]);

        return {
            logs,
            total,
            totalPages: Math.ceil(total / pagination.limit)
        };
    }

    /**
     * Get recent activity for a specific user
     */
    getUserModerationHistory(
        userId: string,
        limit: number = 10
    ): Promise<ModerationLogDocument[]> {
        return this.moderationLogModel
            .find({
                $or: [
                    { targetId: new Types.ObjectId(userId) },
                    { performedBy: new Types.ObjectId(userId) }
                ]
            })
            .populate('performedBy', 'firstName lastName email role')
            .sort({ createdAt: -1 })
            .limit(limit)
            .exec();
    }

    /**
     * Get moderation statistics for dashboard
     */
    async getModerationStatistics(
        startDate?: Date,
        endDate?: Date
    ): Promise<{
        totalActions: number;
        actionsByLevel: Record<string, number>;
        actionsByCategory: Record<string, number>;
        topModerators: Array<{ moderator: any; actionCount: number }>;
        automatedVsManual: { automated: number; manual: number };
    }> {
        const dateFilter = startDate || endDate ? {
            createdAt: {
                ...(startDate && { $gte: startDate }),
                ...(endDate && { $lte: endDate })
            }
        } : {};

        const [
            totalActions,
            actionsByLevel,
            actionsByCategory,
            topModerators,
            automatedVsManual
        ] = await Promise.all([
            this.moderationLogModel.countDocuments(dateFilter),

            this.moderationLogModel.aggregate([
                { $match: dateFilter },
                { $group: { _id: '$level', count: { $sum: 1 } } }
            ]),

            this.moderationLogModel.aggregate([
                { $match: dateFilter },
                { $group: { _id: '$category', count: { $sum: 1 } } }
            ]),

            this.moderationLogModel.aggregate([
                { $match: dateFilter },
                { $group: { _id: '$performedBy', actionCount: { $sum: 1 } } },
                { $sort: { actionCount: -1 } },
                { $limit: 10 },
                {
                    $lookup: {
                        from: 'users',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'moderator'
                    }
                },
                { $unwind: '$moderator' },
                {
                    $project: {
                        moderator: {
                            _id: '$moderator._id',
                            firstName: '$moderator.firstName',
                            lastName: '$moderator.lastName',
                            email: '$moderator.email',
                            role: '$moderator.role'
                        },
                        actionCount: 1
                    }
                }
            ]),

            this.moderationLogModel.aggregate([
                { $match: dateFilter },
                { $group: { _id: '$isAutomated', count: { $sum: 1 } } }
            ])
        ]);

        // Transform aggregation results into more usable format
        const levelStats = actionsByLevel.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {});

        const categoryStats = actionsByCategory.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {});

        const automatedStats = automatedVsManual.reduce((acc, item) => {
            if (item._id) {
                acc.automated = item.count;
            } else {
                acc.manual = item.count;
            }
            return acc;
        }, { automated: 0, manual: 0 });

        return {
            totalActions,
            actionsByLevel: levelStats,
            actionsByCategory: categoryStats,
            topModerators,
            automatedVsManual: automatedStats
        };
    }
}