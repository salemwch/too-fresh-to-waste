import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';

import { LeanDocument } from '../../common/types/mongoose.types';
import { GetAuditLogsQueryDto } from '../dto/admin-analytics.dto';
import { AdminAction } from '../interfaces/admin-analytics.interface';
import { AdminAuditLog, AdminAuditLogDocument } from '../schemas/admin-audit-log.schema';

// Type definitions for audit data
type AuditableValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | AuditableObject
  | AuditableValue[];

export type AuditableObject = {
  [K in string]?: AuditableValue;
};

type SanitizableValue = unknown;

type TargetType = 'user' | 'establishment' | 'order' | 'review' | 'offer' | 'system';

// Audit filter interface for type safety
interface AuditLogFilter {
  adminId?: Types.ObjectId;
  action?: AdminAction;
  targetType?: TargetType;
  targetId?: string;
  timestamp?: {
    $gte?: Date;
    $lte?: Date;
  };
}

// Statistics interfaces
interface AdminActivityStats {
  _id: Types.ObjectId;
  adminEmail: string;
  count: number;
}

interface DailyActivityStats {
  _id: string; // Date string in YYYY-MM-DD format
  count: number;
}

export interface AuditStatisticsResult {
  totalActions: number;
  actionsByType: Record<AdminAction, number>;
  activityByAdmin: AdminActivityStats[];
  targetsByType: Record<TargetType, number>;
  dailyActivity: DailyActivityStats[];
  period: {
    days: number;
    startDate: Date;
    endDate: Date;
  };
}

// Export format types
type ExportFormat = 'json' | 'csv';
type ExportResult<T extends ExportFormat> = T extends 'csv'
  ? string
  : LeanDocument<AdminAuditLogDocument>[];

// Base interface for audit action parameters
interface BaseAuditActionParams {
  adminId: string;
  adminEmail: string;
  action: AdminAction;
  previousValue?: AuditableObject | undefined;
  newValue?: AuditableObject | undefined;
  reason?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

// User-specific audit action parameters
interface UserAuditActionParams extends BaseAuditActionParams {
  userId: string;
}

// Establishment-specific audit action parameters
interface EstablishmentAuditActionParams extends BaseAuditActionParams {
  establishmentId: string;
}

// System-specific audit action parameters (no additional target required)
interface SystemAuditActionParams extends BaseAuditActionParams {
  // No additional properties needed for system actions
}

export interface CreateAuditLogData {
  adminId: string;
  adminEmail: string;
  action: AdminAction;
  targetType: TargetType;
  targetId?: string | undefined;
  previousValue?: AuditableObject | undefined;
  newValue?: AuditableObject | undefined;
  reason?: string | undefined;
  ipAddress: string;
  userAgent: string;
  metadata?: AuditableObject | undefined;
}

// Export the parameter interfaces for external use
export type {
  BaseAuditActionParams,
  UserAuditActionParams,
  EstablishmentAuditActionParams,
  SystemAuditActionParams,
};

export interface AuditLogResponse {
  logs: LeanDocument<AdminAuditLogDocument>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(
    @InjectModel(AdminAuditLog.name)
    private readonly auditLogModel: Model<AdminAuditLogDocument>,
  ) {}

  async createAuditLog(data: CreateAuditLogData): Promise<AdminAuditLogDocument> {
    try {
      // Sanitize sensitive data before logging
      const sanitizedData = this.sanitizeAuditData(data);

      const auditLog = new this.auditLogModel({
        adminId: new Types.ObjectId(sanitizedData.adminId),
        adminEmail: sanitizedData.adminEmail,
        action: sanitizedData.action,
        targetType: sanitizedData.targetType,
        targetId: sanitizedData.targetId,
        previousValue: sanitizedData.previousValue,
        newValue: sanitizedData.newValue,
        reason: sanitizedData.reason,
        ipAddress: sanitizedData.ipAddress,
        userAgent: sanitizedData.userAgent,
        metadata: sanitizedData.metadata,
        timestamp: new Date(),
      });

      const savedLog = await auditLog.save();

      this.logger.log(
        `Audit log created: ${data.action} by ${data.adminEmail} on ${
          data.targetType
        }${data.targetId ? `:${data.targetId}` : ''}`,
      );

      return savedLog;
    } catch (error) {
      this.logger.error('Failed to create audit log:', error);
      throw error;
    }
  }

  async getAuditLogs(query: GetAuditLogsQueryDto): Promise<AuditLogResponse> {
    try {
      const {
        page = 1,
        limit = 20,
        adminId,
        action,
        targetType,
        targetId,
        startDate,
        endDate,
      } = query;

      // Build filter conditions
      const filter: AuditLogFilter = {};

      if (adminId) {
        filter.adminId = new Types.ObjectId(adminId);
      }

      if (action) {
        filter.action = action as AdminAction;
      }

      if (targetType) {
        filter.targetType = targetType as TargetType;
      }

      if (targetId) {
        filter.targetId = targetId;
      }

      if (startDate || endDate) {
        filter.timestamp = {};
        if (startDate) {
          filter.timestamp.$gte = new Date(startDate);
        }
        if (endDate) {
          filter.timestamp.$lte = new Date(endDate);
        }
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Execute aggregate + count in parallel (single DB round-trip per query)
      const [logs, total] = await Promise.all([
        this.auditLogModel.aggregate<LeanDocument<AdminAuditLogDocument>>([
          { $match: filter },
          { $sort: { timestamp: -1 as const } },
          { $skip: skip },
          { $limit: limit },
          ...this.getAdminLookupStages(),
        ]),
        this.auditLogModel.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        logs,
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };
    } catch (error) {
      this.logger.error('Failed to retrieve audit logs:', error);
      throw error;
    }
  }

  async getAuditLogsByAdmin(
    adminId: string,
    limit: number = 50,
  ): Promise<LeanDocument<AdminAuditLogDocument>[]> {
    try {
      return await this.auditLogModel
        .find({ adminId: new Types.ObjectId(adminId) })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean()
        .exec();
    } catch (error) {
      this.logger.error(`Failed to retrieve audit logs for admin ${adminId}:`, error);
      throw error;
    }
  }

  async getAuditLogsByTarget(
    targetType: string,
    targetId: string,
    limit: number = 20,
  ): Promise<LeanDocument<AdminAuditLogDocument>[]> {
    try {
      return await this.auditLogModel.aggregate<LeanDocument<AdminAuditLogDocument>>([
        { $match: { targetType, targetId } },
        { $sort: { timestamp: -1 as const } },
        { $limit: limit },
        ...this.getAdminLookupStages(),
      ]);
    } catch (error) {
      this.logger.error(`Failed to retrieve audit logs for ${targetType}:${targetId}:`, error);
      throw error;
    }
  }

  async getRecentActivity(
    hours: number = 24,
    limit: number = 100,
  ): Promise<LeanDocument<AdminAuditLogDocument>[]> {
    try {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

      return await this.auditLogModel.aggregate<LeanDocument<AdminAuditLogDocument>>([
        { $match: { timestamp: { $gte: startTime } } },
        { $sort: { timestamp: -1 as const } },
        { $limit: limit },
        ...this.getAdminLookupStages(),
      ]);
    } catch (error) {
      this.logger.error('Failed to retrieve recent activity:', error);
      throw error;
    }
  }

  async getAuditStatistics(days: number = 30): Promise<AuditStatisticsResult> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const pipeline: PipelineStage[] = [
        {
          $match: {
            timestamp: { $gte: startDate },
          },
        },
        {
          $facet: {
            actionsByType: [
              {
                $group: {
                  _id: '$action',
                  count: { $sum: 1 },
                },
              },
              { $sort: { count: -1 } },
            ],

            activityByAdmin: [
              {
                $group: {
                  _id: '$adminId',
                  adminEmail: { $first: '$adminEmail' },
                  count: { $sum: 1 },
                },
              },
              { $sort: { count: -1 } },
              { $limit: 10 },
            ],

            targetsByType: [
              {
                $group: {
                  _id: '$targetType',
                  count: { $sum: 1 },
                },
              },
              { $sort: { count: -1 } },
            ],

            dailyActivity: [
              {
                $group: {
                  _id: {
                    $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
                  },
                  count: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ],

            totalActions: [{ $count: 'total' }],
          },
        },
      ];

      const [result] = await this.auditLogModel.aggregate(pipeline);

      return {
        totalActions: result.totalActions[0]?.total || 0,
        actionsByType: this.formatGroupedResults<AdminAction>(result.actionsByType),
        activityByAdmin: result.activityByAdmin,
        targetsByType: this.formatGroupedResults<TargetType>(result.targetsByType),
        dailyActivity: result.dailyActivity,
        period: {
          days,
          startDate,
          endDate: new Date(),
        },
      };
    } catch (error) {
      this.logger.error('Failed to calculate audit statistics:', error);
      throw error;
    }
  }

  async deleteOldAuditLogs(olderThanDays: number = 730): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

      const result = await this.auditLogModel.deleteMany({
        timestamp: { $lt: cutoffDate },
      });

      this.logger.log(`Deleted ${result.deletedCount} audit logs older than ${olderThanDays} days`);

      return result.deletedCount;
    } catch (error) {
      this.logger.error('Failed to delete old audit logs:', error);
      throw error;
    }
  }

  async exportAuditLogs<T extends ExportFormat>(
    startDate: Date,
    endDate: Date,
    format: T = 'json' as T,
  ): Promise<ExportResult<T>> {
    try {
      const logs = await this.auditLogModel.aggregate<LeanDocument<AdminAuditLogDocument>>([
        { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
        { $sort: { timestamp: -1 as const } },
        ...this.getAdminLookupStages(),
      ]);

      if (format === 'csv') {
        return this.convertLogsToCSV(logs) as ExportResult<T>;
      }

      return logs as unknown as ExportResult<T>;
    } catch (error) {
      this.logger.error('Failed to export audit logs:', error);
      throw error;
    }
  }

  // Helper Methods

  private sanitizeAuditData(data: CreateAuditLogData): CreateAuditLogData {
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'creditCard'];

    const sanitizeObject = (obj: SanitizableValue): AuditableValue => {
      if (!obj || typeof obj !== 'object') {
        return obj as AuditableValue;
      }

      if (Array.isArray(obj)) {
        return obj.map((item) => sanitizeObject(item));
      }

      const sanitized: Record<string, AuditableValue> = {
        ...(obj as Record<string, SanitizableValue>),
      } as Record<string, AuditableValue>;

      for (const [key, value] of Object.entries(sanitized)) {
        if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = sanitizeObject(value);
        }
      }

      return sanitized;
    };

    return {
      ...data,
      previousValue: data.previousValue
        ? (sanitizeObject(data.previousValue) as AuditableObject)
        : undefined,
      newValue: data.newValue ? (sanitizeObject(data.newValue) as AuditableObject) : undefined,
      metadata: data.metadata ? (sanitizeObject(data.metadata) as AuditableObject) : undefined,
    };
  }

  private formatGroupedResults<T extends string>(
    results: Array<{ _id: T; count: number }>,
  ): Record<T, number> {
    return results.reduce(
      (acc, item) => {
        acc[item._id] = item.count;
        return acc;
      },
      {} as Record<T, number>,
    );
  }

  /**
   * Builds $lookup + $unwind stages to join admin user data.
   * Uses the pipeline form of $lookup for field-level projection,
   * reducing network I/O compared to populate().
   * @see https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/#join-conditions-and-subqueries-on-a-joined-collection
   */
  private getAdminLookupStages(): PipelineStage[] {
    return [
      {
        $lookup: {
          from: 'users',
          let: { adminObjId: '$adminId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$adminObjId'] } } },
            { $project: { _id: 1, firstName: 1, lastName: 1, email: 1 } },
          ],
          as: 'adminId',
        },
      },
      {
        $unwind: {
          path: '$adminId',
          preserveNullAndEmptyArrays: true,
        },
      },
    ];
  }

  private convertLogsToCSV(logs: LeanDocument<AdminAuditLogDocument>[]): string {
    if (logs.length === 0) {
      return '';
    }

    const headers = [
      'Timestamp',
      'Admin Email',
      'Action',
      'Target Type',
      'Target ID',
      'Reason',
      'IP Address',
    ];

    const csvRows = [
      headers.join(','),
      ...logs.map((log) =>
        [
          log.timestamp.toISOString(),
          log.adminEmail,
          log.action,
          log.targetType,
          log.targetId || '',
          (log.reason || '').replace(/,/g, ';'), // Escape commas
          log.ipAddress,
        ].join(','),
      ),
    ];

    return csvRows.join('\n');
  }

  async logUserAction(params: UserAuditActionParams): Promise<AdminAuditLogDocument> {
    const {
      adminId,
      adminEmail,
      action,
      userId,
      previousValue,
      newValue,
      reason,
      ipAddress = '0.0.0.0',
      userAgent = 'Unknown',
    } = params;

    const result = await this.createAuditLog({
      adminId,
      adminEmail,
      action,
      targetType: 'user',
      targetId: userId,
      previousValue,
      newValue,
      reason,
      ipAddress,
      userAgent,
    });

    return result;
  }

  async logEstablishmentAction(
    params: EstablishmentAuditActionParams,
  ): Promise<AdminAuditLogDocument> {
    const {
      adminId,
      adminEmail,
      action,
      establishmentId,
      previousValue,
      newValue,
      reason,
      ipAddress = '0.0.0.0',
      userAgent = 'Unknown',
    } = params;

    const result = await this.createAuditLog({
      adminId,
      adminEmail,
      action,
      targetType: 'establishment',
      targetId: establishmentId,
      previousValue,
      newValue,
      reason,
      ipAddress,
      userAgent,
    });

    return result;
  }

  async logSystemAction(params: SystemAuditActionParams): Promise<AdminAuditLogDocument> {
    const {
      adminId,
      adminEmail,
      action,
      previousValue,
      newValue,
      reason,
      ipAddress = '0.0.0.0',
      userAgent = 'Unknown',
    } = params;

    const result = await this.createAuditLog({
      adminId,
      adminEmail,
      action,
      targetType: 'system',
      previousValue,
      newValue,
      reason,
      ipAddress,
      userAgent,
    });

    return result;
  }

  async logBatchActions(actions: CreateAuditLogData[]): Promise<AdminAuditLogDocument[]> {
    try {
      const sanitizedActions = actions.map((action) => this.sanitizeAuditData(action));

      const auditLogs = sanitizedActions.map(
        (data) =>
          new this.auditLogModel({
            adminId: new Types.ObjectId(data.adminId),
            adminEmail: data.adminEmail,
            action: data.action,
            targetType: data.targetType,
            targetId: data.targetId,
            previousValue: data.previousValue,
            newValue: data.newValue,
            reason: data.reason,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            metadata: data.metadata,
            timestamp: new Date(),
          }),
      );

      const savedLogs = await this.auditLogModel.insertMany(auditLogs);

      this.logger.log(`Batch audit log created: ${actions.length} actions`);

      return savedLogs;
    } catch (error) {
      this.logger.error('Failed to create batch audit logs:', error);
      throw error;
    }
  }
}
