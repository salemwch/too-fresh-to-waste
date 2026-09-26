import { UserStatus } from '@foodwaste/shared';
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  AdminUserStatusChangedEvent,
  AdminUserActivatedEvent,
  AdminUserSuspendedEvent,
  AdminUserBlockedEvent,
  AdminUserDeletedEvent,
  AdminBulkUserActionEvent,
} from '../../common/events/admin-user.events';
import { IUser } from '../../common/interfaces/user.interface';
import { UserMapper } from '../../common/mappers/user.mapper';
import { EventBusService } from '../../common/services/event-bus/event-bus.service';
import { LeanDocument } from '../../common/types/mongoose.types';
import { RegexSecurityUtil } from '../../common/utils/regex-security.util';
import { ISendNotificationRequest } from '../../notifications/interfaces/notification.interfaces';
import { NotificationService } from '../../notifications/services/notification.service';
import { Order, OrderDocument, OrderStatus } from '../../orders/schemas/order.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { UsersService } from '../../users/user.service';
import { UpdateUserStatusDto, BulkUserActionDto, UserSearchDto } from '../dto/user-management.dto';
import { AdminAction } from '../interfaces/admin-analytics.interface';

import { AdminAuditService, AuditableObject } from './admin-audit.service';

import { appError } from '../../common/errors';
export interface UserListResponse {
  users: IUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface UserOverview {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  pendingUsers: number;
  usersByRole: Record<string, number>;
  usersByStatus: Record<string, number>;
  recentRegistrations: LeanDocument<UserDocument>[];
  topActiveUsers: Array<Record<string, unknown>>;
}

export interface BulkActionResult {
  success: boolean;
  processedCount: number;
  successCount: number;
  failureCount: number;
  failures: Array<{
    userId: string;
    error: string;
  }>;
}

export interface UserActivityData {
  userId: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    createdAt: Date;
    lastLoginAt?: Date | undefined;
  };
  period: {
    startDate: Date;
    endDate: Date;
    days: number;
  };
  summary: {
    totalActions: number;
    statusChanges: number;
    loginAttempts: number;
    lastActivity?: Date | undefined;
    accountAge: number;
    activityScore: number;
  };
  metrics: {
    averageActionsPerDay: number;
    mostActiveDay?: string | undefined;
    activityTrend: 'increasing' | 'decreasing' | 'stable';
    riskScore: number;
  };
  recentEvents: ActivityEvent[];
  auditTrail: ProcessedAuditEvent[];
  totalEvents: number;
}

export interface ActivityEvent {
  type: 'login' | 'status_change' | 'profile_update' | 'security_event' | 'admin_action';
  description: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
}

// Interface for audit change tracking
export interface AuditChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface ProcessedAuditEvent {
  id: string;
  action: string;
  timestamp: Date;
  adminEmail?: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  changes?: AuditChange[];
}

interface StatusNotificationContent {
  title: string;
  body: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

interface AuditLogEntry {
  _id?: string;
  action?: string;
  timestamp?: Date;
  createdAt?: Date;
  adminEmail?: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}

interface GroupedUserCountResult {
  _id: string;
  count: number;
}

interface UserOverviewAggregationResult {
  usersByRole: GroupedUserCountResult[];
  usersByStatus: GroupedUserCountResult[];
  activeUsers: Array<{ count: number }>;
}

const EMPTY_USER_OVERVIEW_AGGREGATION: UserOverviewAggregationResult = {
  usersByRole: [],
  usersByStatus: [],
  activeUsers: [],
};

@Injectable()
export class UserManagementService {
  private readonly logger = new Logger(UserManagementService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly auditService: AdminAuditService,
    private readonly eventBus: EventBusService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly regexSecurityUtil: RegexSecurityUtil,
    @Optional() private readonly notificationService?: NotificationService,
  ) {}

  async getUserOverview(): Promise<UserOverview> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [totalUsers, userStats, recentRegistrations, topActiveUsers] = await Promise.all([
        this.userModel.countDocuments(),

        this.userModel.aggregate<UserOverviewAggregationResult>([
          {
            $facet: {
              usersByRole: [{ $group: { _id: '$role', count: { $sum: 1 } } }],
              usersByStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
              activeUsers: [
                { $match: { lastLoginAt: { $gte: thirtyDaysAgo } } },
                { $count: 'count' },
              ],
            },
          },
        ]),

        this.userModel
          .find({ createdAt: { $gte: thirtyDaysAgo } })
          .sort({ createdAt: -1 })
          .limit(10)
          .select('firstName lastName email role status createdAt')
          .lean(),

        this.userModel
          .find({
            lastLoginAt: { $gte: thirtyDaysAgo },
            status: UserStatus.ACTIVE,
          })
          .sort({ lastLoginAt: -1 })
          .limit(10)
          .select('firstName lastName email lastLoginAt')
          .lean(),
      ]);

      const stats = userStats[0] ?? EMPTY_USER_OVERVIEW_AGGREGATION;
      const usersByRole = this.formatGroupedResults(stats.usersByRole);
      const usersByStatus = this.formatGroupedResults(stats.usersByStatus);

      return {
        totalUsers,
        activeUsers: stats.activeUsers[0]?.count ?? 0,
        suspendedUsers: usersByStatus[UserStatus.SUSPENDED] ?? 0,
        pendingUsers: usersByStatus[UserStatus.PENDING] ?? 0,
        usersByRole,
        usersByStatus,
        recentRegistrations,
        topActiveUsers: topActiveUsers as Array<Record<string, unknown>>,
      };
    } catch (error) {
      this.logger.error('Failed to get user overview:', error);
      throw error;
    }
  }

  async searchUsers(query: UserSearchDto): Promise<UserListResponse> {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        role,
        status,
        isEmailVerified,
        isPhoneVerified,
        city,
        country,
        registeredAfter,
        registeredBefore,
        lastLoginAfter,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = query;

      // Build filter conditions
      const filter: Record<string, unknown> = {};

      if (search) {
        const escaped = this.regexSecurityUtil.escapeRegexPattern(search);
        filter['$or'] = [
          { firstName: { $regex: escaped, $options: 'i' } },
          { lastName: { $regex: escaped, $options: 'i' } },
          { email: { $regex: escaped, $options: 'i' } },
        ];
      }

      if (role !== null && role !== undefined) {
        filter['role'] = role;
      }

      if (status !== null && status !== undefined) {
        filter['status'] = status;
      }

      if (isEmailVerified !== undefined) {
        filter['isEmailVerified'] = isEmailVerified;
      }

      if (isPhoneVerified !== undefined) {
        filter['isPhoneVerified'] = isPhoneVerified;
      }

      if (city) {
        filter['address.city'] = { $regex: city, $options: 'i' };
      }

      if (country) {
        filter['address.country'] = { $regex: country, $options: 'i' };
      }

      if (registeredAfter || registeredBefore) {
        const createdAtFilter: Record<string, Date> = {};
        if (registeredAfter) {
          createdAtFilter['$gte'] = new Date(registeredAfter);
        }
        if (registeredBefore) {
          createdAtFilter['$lte'] = new Date(registeredBefore);
        }
        filter['createdAt'] = createdAtFilter;
      }

      if (lastLoginAfter) {
        filter['lastLoginAt'] = { $gte: new Date(lastLoginAfter) };
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Sort configuration
      const sort: Record<string, 1 | -1> = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute queries in parallel
      const [users, total] = await Promise.all([
        this.userModel
          .find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .select('-password -emailVerificationToken -phoneVerificationCode -passwordResetToken')
          .lean()
          .exec(),
        this.userModel.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(total / limit);

      // Count EXPIRED orders per user for this page — the "no-show" metric.
      // Scoped to the current page's IDs so the aggregation touches a small set.
      const userObjectIds = users.map(u => u._id);
      const noShowAgg = await this.orderModel.aggregate<{ _id: string; count: number }>([
        { $match: { customerId: { $in: userObjectIds }, status: OrderStatus.EXPIRED } },
        { $group: { _id: '$customerId', count: { $sum: 1 } } },
      ]);
      const noShowMap = new Map(noShowAgg.map(r => [r._id.toString(), r.count]));

      const usersWithNoShow = users.map(u => ({
        ...u,
        noShowCount: noShowMap.get(u._id.toString()) ?? 0,
      }));

      return {
        // Map lean docs so each user has `id` (string) instead of raw `_id` (ObjectId).
        // Without this the frontend receives `_id` only, making setSelectedUserId(user.id)
        // a no-op and preventing the detail sheet from opening.
        users: UserMapper.toInterfaceArray(
          usersWithNoShow as unknown as Parameters<typeof UserMapper.toInterfaceArray>[0],
        ),
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };
    } catch (error) {
      this.logger.error('Failed to search users:', error);
      throw error;
    }
  }

  async getUserById(userId: string): Promise<IUser> {
    try {
      const user = await this.userModel
        .findById(userId)
        .select('-password -emailVerificationToken -phoneVerificationCode -passwordResetToken')
        .lean()
        .exec();

      if (!user) {
        throw new NotFoundException(appError('USER_NOT_FOUND'));
      }

      return UserMapper.toInterface(
        user as unknown as Parameters<typeof UserMapper.toInterface>[0],
      );
    } catch (error) {
      this.logger.error(`Failed to get user ${userId}:`, error);
      throw error;
    }
  }

  async updateUserStatus(
    userId: string,
    updateDto: UpdateUserStatusDto,
    adminId: string,
    adminEmail: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<IUser> {
    try {
      const user = await this.userModel.findById(userId);

      if (!user) {
        throw new NotFoundException(appError('USER_NOT_FOUND'));
      }

      const previousStatus = user.status;
      const previousValue = {
        status: user.status,
        updatedAt: user.updatedAt,
      };

      // Update user status
      user.status = updateDto.status;

      const updatedUser = await user.save();

      // Log the action
      await this.auditService.logUserAction({
        adminId,
        adminEmail,
        action: this.getActionForStatusChange(updateDto.status),
        userId,
        previousValue,
        newValue: {
          status: updateDto.status,
          reason: updateDto.reason,
          adminNotes: updateDto.adminNotes,
          updatedAt: new Date(),
        },
        reason: updateDto.reason,
        ipAddress,
        userAgent,
      });

      this.logger.log(
        `User ${userId} status changed from ${previousStatus} to ${updateDto.status} by admin ${adminEmail}. Reason: ${updateDto.reason}`,
      );

      // Emit domain event for cross-module reactions
      await this.emitUserStatusEvent(userId, adminId, adminEmail, previousStatus, updateDto);

      if (updateDto.sendNotification === true) {
        await this.sendStatusChangeNotification(user, updateDto, previousStatus);
      }

      return UserMapper.toInterface(
        updatedUser as unknown as Parameters<typeof UserMapper.toInterface>[0],
      );
    } catch (error) {
      this.logger.error(`Failed to update user ${userId} status:`, error);
      throw error;
    }
  }

  async bulkUpdateUserStatus(
    bulkActionDto: BulkUserActionDto,
    adminId: string,
    adminEmail: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<BulkActionResult> {
    const result: BulkActionResult = {
      success: false,
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
      failures: [],
    };

    try {
      if (!adminId || !adminEmail) {
        throw new BadRequestException(appError('ADMIN_CONTEXT_MISSING'));
      }

      const { userIds, status, reason, sendNotification } = bulkActionDto;

      this.logger.log(
        `Starting bulk user status update: ${userIds.length} users to ${status} by admin ${adminEmail}`,
      );

      for (const userId of userIds) {
        result.processedCount++;

        try {
          await this.updateUserStatus(
            userId,
            {
              status,
              reason,
              ...(sendNotification !== undefined ? { sendNotification } : {}),
            },
            adminId,
            adminEmail,
            ipAddress,
            userAgent,
          );

          result.successCount++;
        } catch (error) {
          result.failureCount++;
          result.failures.push({
            userId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          this.logger.warn(`Failed to update user ${userId} in bulk operation:`, error);
        }
      }

      result.success = result.failureCount === 0;

      // Log bulk operation
      await this.auditService.logSystemAction({
        adminId,
        adminEmail,
        action: AdminAction.BULK_OPERATION,
        previousValue: undefined,
        newValue: {
          operation: 'bulk_user_status_update',
          targetStatus: status,
          reason,
          processedCount: result.processedCount,
          successCount: result.successCount,
          failureCount: result.failureCount,
        },
        reason: `Bulk user status update: ${result.successCount}/${result.processedCount} successful`,
        ipAddress,
        userAgent,
      });

      this.logger.log(
        `Bulk user status update completed: ${result.successCount}/${result.processedCount} successful`,
      );

      // Emit bulk operation event for async processing when the status maps to a bulk action
      const bulkActionType = this.getBulkActionType(status);
      if (result.successCount > 0 && bulkActionType !== null) {
        await this.eventBus.emit(
          'admin.user.bulk_action',
          new AdminBulkUserActionEvent(adminId, adminEmail, userIds, bulkActionType, reason),
        );
      }

      return result;
    } catch (error) {
      this.logger.error('Bulk user status update failed:', error);
      throw error;
    }
  }

  async deleteUser(
    userId: string,
    reason: string,
    adminId: string,
    adminEmail: string,
    ipAddress: string,
    userAgent: string,
    hardDelete: boolean = false,
  ): Promise<boolean> {
    try {
      // Validate admin information first to avoid unnecessary DB calls
      if (!adminId || !adminEmail) {
        throw new BadRequestException(appError('ADMIN_CONTEXT_MISSING'));
      }

      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException(appError('USER_NOT_FOUND'));
      }

      const previousValue = user.toObject();

      if (hardDelete) {
        // Permanently delete user — handled directly here
        await this.userModel.findByIdAndDelete(userId);

        // Emit deletion event for cascade cleanup (hard-delete path only)
        await this.eventBus.emit(
          'admin.user.deleted',
          new AdminUserDeletedEvent(userId, adminId, adminEmail, true, reason),
        );
      } else {
        // Delegate to UsersService.softDelete() — single source of truth
        // softDelete() handles: status, tokens, audit log, event emission
        await this.usersService.softDelete(
          userId,
          reason,
          { ipAddress, userAgent },
          { adminId, adminEmail },
        );
      }

      // Log admin audit trail (always, for both paths)
      await this.auditService.logUserAction({
        adminId,
        adminEmail,
        action: AdminAction.USER_DELETED,
        userId,
        previousValue: previousValue as unknown as AuditableObject,
        newValue: { deleted: true, hardDelete, reason },
        reason,
        ipAddress,
        userAgent,
      });

      this.logger.log(
        `User ${userId} ${hardDelete ? 'permanently deleted' : 'soft deleted'} by admin ${adminEmail}. Reason: ${reason}`,
      );

      return true;
    } catch (error) {
      this.logger.error(`Failed to delete user ${userId}:`, error);
      throw error;
    }
  }

  async getUserActivity(userId: string, days: number = 30): Promise<UserActivityData> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      this.logger.log(
        `Fetching activity for user ${userId} from ${startDate.toISOString()} to ${endDate.toISOString()}`,
      );

      // Execute all activity queries in parallel for performance
      const [auditLogs, user] = await Promise.all([
        this.auditService.getAuditLogsByTarget('user', userId, 100),
        this.userModel
          .findById(userId)
          .select('firstName lastName email createdAt lastLoginAt')
          .lean()
          .exec(),
      ]);

      if (!user) {
        throw new NotFoundException(appError('USER_NOT_FOUND'));
      }

      // Process audit logs to extract meaningful activity
      const processedActivity = this.processAuditLogsForActivity(
        auditLogs as unknown as Array<AuditLogEntry>,
        startDate,
        endDate,
      );

      // Build comprehensive activity summary
      const activitySummary = this.buildActivitySummary(
        processedActivity,
        user as unknown as UserDocument & { createdAt: Date },
        days,
      );

      // Calculate activity metrics
      const metrics = this.calculateActivityMetrics(processedActivity, days);

      // Get recent critical events
      const recentEvents = this.extractRecentEvents(processedActivity, 10);

      const result: UserActivityData = {
        userId,
        user: {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          createdAt: (user as unknown as { createdAt: Date }).createdAt,
          lastLoginAt: (user as unknown as { lastLoginAt?: Date }).lastLoginAt,
        },
        period: {
          startDate,
          endDate,
          days,
        },
        summary: activitySummary,
        metrics,
        recentEvents,
        auditTrail: processedActivity.slice(0, 20), // Most recent 20 events
        totalEvents: processedActivity.length,
      };

      this.logger.log(
        `Successfully compiled activity data for user ${userId}: ${result.totalEvents} events`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Failed to get activity for user ${userId}:`, error);
      throw error;
    }
  }
  private async sendStatusChangeNotification(
    user: UserDocument,
    updateDto: UpdateUserStatusDto,
    previousStatus: UserStatus,
  ): Promise<void> {
    try {
      const { status, reason, adminNotes } = updateDto;
      const notificationReason = reason ?? 'No reason provided';
      const notificationAdminNotes = adminNotes ?? '';

      this.logger.log(
        `Sending status change notification to user ${user._id}: ${previousStatus} -> ${status}`,
      );

      // Determine notification content based on status change
      const notificationContent = this.getStatusChangeNotificationContent(
        status,
        reason,
        adminNotes,
      );

      if (!notificationContent) {
        this.logger.warn(`No notification content configured for status change to ${status}`);
        return;
      }

      // Validate user data
      if (user._id === null || user._id === undefined) {
        this.logger.warn(`Cannot send notification: user._id is null or undefined`);
        return;
      }

      const userIdString = user._id.toString();

      // Prepare notification request
      const notificationRequest: ISendNotificationRequest = {
        type: 'email',
        trigger: `user_status_${status.toLowerCase()}`,
        target: {
          userId: userIdString,
        },
        payload: {
          title: notificationContent.title,
          body: notificationContent.body,
          data: {
            userId: userIdString,
            previousStatus,
            newStatus: status,
            reason: notificationReason,
            adminNotes: notificationAdminNotes,
            timestamp: new Date().toISOString(),
          },
        },
        priority: this.getNotificationPriority(status),
        templateId: `user_status_${status.toLowerCase()}`,
        templateVariables: {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          previousStatus: this.getStatusDisplayName(previousStatus),
          newStatus: this.getStatusDisplayName(status),
          reason: notificationReason,
          adminNotes: notificationAdminNotes,
          supportEmail: this.configService.get<string>('SUPPORT_EMAIL', 'support@foodwaste.com'),
          appName: this.configService.get<string>('APP_NAME', 'Food Waste Management'),
          timestamp: new Date().toLocaleString(),
        },
        metadata: {
          source: 'admin_user_management',
          adminAction: 'status_change',
          statusChange: [`from:${previousStatus}`, `to:${status}`],
        },
      };

      // Send notification using the notification service
      if (!this.notificationService) {
        this.logger.warn('NotificationService not available, skipping notification');
        return;
      }

      const result = await this.notificationService.sendNotification(notificationRequest);

      if (result.success) {
        this.logger.log(
          `Status change notification sent successfully to user ${user._id}. Message ID: ${result.messageId}`,
        );
      } else {
        this.logger.error(
          `Failed to send status change notification to user ${user._id}: ${result.error}`,
        );
      }

      // For critical status changes, also send push notification if available
      if (this.isCriticalStatusChange(status)) {
        await this.sendCriticalStatusPushNotification(user, status, reason);
      }
    } catch (error) {
      this.logger.error(`Failed to send status change notification for user ${user._id}:`, error);
      // Don't throw error - notification failure shouldn't block status update
    }
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
  private getActionForStatusChange(status: UserStatus): AdminAction {
    switch (status) {
      case UserStatus.ACTIVE:
        return AdminAction.USER_ACTIVATED;
      case UserStatus.SUSPENDED:
        return AdminAction.USER_SUSPENDED;
      case UserStatus.BLOCKED:
        return AdminAction.USER_BLOCKED;
      case UserStatus.DELETED:
        return AdminAction.USER_DELETED;
      case UserStatus.PENDING:
      case UserStatus.ANONYMIZED:
        return AdminAction.USER_UPDATED;
    }
  }
  private processAuditLogsForActivity(
    auditLogs: Array<AuditLogEntry>,
    startDate: Date,
    endDate: Date,
  ): ProcessedAuditEvent[] {
    return auditLogs
      .filter(log => {
        const logDate = new Date(log.timestamp ?? log.createdAt ?? 0);
        return logDate >= startDate && logDate <= endDate;
      })
      .map(log => {
        const changes = this.extractChanges(log);
        const action = log.action ?? 'UNKNOWN_ACTION';
        return {
          id: log._id?.toString() ?? Math.random().toString(36),
          action,
          timestamp: new Date(log.timestamp ?? log.createdAt ?? 0),
          ...(log.adminEmail !== undefined ? { adminEmail: log.adminEmail } : {}),
          description: this.generateActivityDescription(log),
          severity: this.determineEventSeverity(action),
          ...(changes !== undefined ? { changes } : {}),
        };
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private buildActivitySummary(
    events: ProcessedAuditEvent[],
    user: UserDocument & { createdAt: Date },
    days: number,
  ): UserActivityData['summary'] {
    const statusChanges = events.filter(
      e =>
        e.action.includes('STATUS') ||
        e.action.includes('SUSPENDED') ||
        e.action.includes('ACTIVATED'),
    ).length;
    const loginAttempts = events.filter(
      e => e.action.includes('LOGIN') || e.action.includes('AUTH'),
    ).length;
    const lastActivity = events[0]?.timestamp;
    const accountAge = Math.floor(
      (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );

    // Calculate activity score based on events and account age
    const activityScore = this.calculateActivityScore(
      events.length,
      statusChanges,
      accountAge,
      days,
    );

    return {
      totalActions: events.length,
      statusChanges,
      loginAttempts,
      lastActivity,
      accountAge,
      activityScore,
    };
  }
  private calculateActivityMetrics(
    events: ProcessedAuditEvent[],
    days: number,
  ): UserActivityData['metrics'] {
    const averageActionsPerDay = events.length / Math.max(days, 1);

    // Group events by day to find most active day
    const eventsByDay = events.reduce(
      (acc, event) => {
        const day = event.timestamp.toDateString();
        acc[day] = (acc[day] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Fix: Safely handle empty events array
    const keys = Object.keys(eventsByDay);
    const mostActiveDay =
      keys.length > 0
        ? keys.reduce((a, b) => ((eventsByDay[a] ?? 0) > (eventsByDay[b] ?? 0) ? a : b))
        : undefined;

    // Calculate trend (simplified)
    // Note: events should be sorted by timestamp descending for this to work correctly
    let activityTrend: 'increasing' | 'decreasing' | 'stable';

    if (events.length < 2) {
      // Not enough data to determine trend
      activityTrend = 'stable';
    } else {
      const halfPoint = Math.floor(events.length / 2);
      const recentHalf = events.slice(0, halfPoint).length;
      const olderHalf = events.slice(halfPoint).length;

      if (olderHalf === 0) {
        activityTrend = 'stable';
      } else if (recentHalf > olderHalf * 1.2) {
        activityTrend = 'increasing';
      } else if (recentHalf < olderHalf * 0.8) {
        activityTrend = 'decreasing';
      } else {
        activityTrend = 'stable';
      }
    }

    // Risk score based on suspicious activities
    const riskScore = this.calculateRiskScore(events);

    return {
      averageActionsPerDay,
      mostActiveDay,
      activityTrend,
      riskScore,
    };
  }
  private extractRecentEvents(events: ProcessedAuditEvent[], limit: number): ActivityEvent[] {
    return events.slice(0, limit).map(event => ({
      type: this.categorizeEventType(event.action),
      description: event.description,
      timestamp: event.timestamp,
      severity: event.severity,
      metadata: {
        adminEmail: event.adminEmail,
        changes: event.changes,
      },
    }));
  }

  private generateActivityDescription(log: AuditLogEntry): string {
    const action = log.action ?? 'UNKNOWN_ACTION';
    const adminEmail = log.adminEmail;

    // Helper function to format admin attribution
    const formatAdminAttribution = (baseMessage: string): string =>
      adminEmail ? `${baseMessage} by ${adminEmail}` : baseMessage;

    switch (action) {
      case 'USER_ACTIVATED':
        return formatAdminAttribution('Account activated');
      case 'USER_SUSPENDED':
        return formatAdminAttribution('Account suspended');
      case 'USER_UPDATED':
        return formatAdminAttribution('Profile updated');
      case 'USER_DELETED':
        return formatAdminAttribution('Account deleted');
      default: {
        const actionDescription = action.toLowerCase().replace(/_/g, ' ');
        return formatAdminAttribution(actionDescription);
      }
    }
  }

  private formatStatusChangeMessage(status: UserStatus, reason?: string): string {
    const baseMessage = `Your account has been ${status.toLowerCase()}.`;
    const additionalInfo = reason?.trim() ? `Reason: ${reason}` : 'Check your email for details.';
    return `${baseMessage} ${additionalInfo}`;
  }

  private determineEventSeverity(action: string): 'low' | 'medium' | 'high' | 'critical' {
    const criticalActions = ['user_deleted', 'user_suspended', 'security_breach'];
    const highActions = ['user_updated', 'status_changed', 'role_changed'];
    const mediumActions = ['user_activated', 'login_attempt'];

    // Normalize action to lowercase for comparison
    const normalizedAction = action.toLowerCase();

    if (criticalActions.some(a => normalizedAction.includes(a))) {
      return 'critical';
    }
    if (highActions.some(a => normalizedAction.includes(a))) {
      return 'high';
    }
    if (mediumActions.some(a => normalizedAction.includes(a))) {
      return 'medium';
    }
    return 'low';
  }

  private extractChanges(log: AuditLogEntry): ProcessedAuditEvent['changes'] {
    if (!log.previousValue || !log.newValue) {
      return undefined;
    }

    const changes: AuditChange[] = [];

    // Extract meaningful changes from audit log
    Object.keys(log.newValue).forEach(key => {
      const oldValue = log.previousValue?.[key];
      const newValue = log.newValue?.[key];

      if (oldValue !== newValue) {
        changes.push({
          field: key,
          oldValue,
          newValue,
        });
      }
    });

    return changes.length > 0 ? changes : undefined;
  }

  private calculateActivityScore(
    totalEvents: number,
    statusChanges: number,
    accountAge: number,
    days: number,
  ): number {
    // Base score from activity frequency
    let score = Math.min((totalEvents / days) * 10, 50);

    // Penalty for frequent status changes (suspicious)
    if (statusChanges > 3) {
      score -= statusChanges * 5;
    }

    // Bonus for account age stability
    if (accountAge > 365 && statusChanges < 2) {
      score += 20;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private calculateRiskScore(events: ProcessedAuditEvent[]): number {
    // Handle null, undefined, or invalid input
    if (!Array.isArray(events)) {
      return 0;
    }

    let riskScore = 0;

    // Count critical and high severity events
    const criticalEvents = events.filter(e => e?.severity === 'critical').length;
    const highEvents = events.filter(e => e?.severity === 'high').length;

    riskScore += criticalEvents * 30;
    riskScore += highEvents * 15;

    // Check for rapid status changes (suspicious pattern) - case insensitive
    const statusEvents = events.filter(e => {
      if (typeof e?.action !== 'string') {
        return false;
      }

      const upperAction = e.action.toUpperCase();
      return upperAction.includes('STATUS') || upperAction.includes('SUSPENDED');
    });

    if (statusEvents.length > 2) {
      riskScore += 25;
    }

    return Math.min(100, Math.round(riskScore));
  }

  private categorizeEventType(action: string): ActivityEvent['type'] {
    const upperAction = action.toUpperCase();

    if (upperAction.includes('LOGIN') || upperAction.includes('AUTH')) {
      return 'login';
    }
    if (
      upperAction.includes('STATUS') ||
      upperAction.includes('SUSPENDED') ||
      upperAction.includes('ACTIVATED')
    ) {
      return 'status_change';
    }
    if (
      upperAction.includes('UPDATED') ||
      upperAction.includes('PROFILE') ||
      upperAction.includes('UPDATE')
    ) {
      return 'profile_update';
    }
    if (upperAction.includes('SECURITY') || upperAction.includes('BREACH')) {
      return 'security_event';
    }
    return 'admin_action';
  }

  // Helper methods for sendStatusChangeNotification
  private getStatusChangeNotificationContent(
    status: UserStatus,
    reason?: string,
    adminNotes?: string,
  ): StatusNotificationContent | null {
    // Helper function to format additional notes
    const formatAdditionalInfo = (): string => {
      const parts: string[] = [];
      if (reason?.trim()) {
        parts.push(`Reason: ${reason}`);
      }
      if (adminNotes?.trim()) {
        parts.push(`Admin Notes: ${adminNotes}`);
      }
      return parts.length > 0 ? ` ${parts.join('. ')}.` : '';
    };

    const additionalInfo = formatAdditionalInfo();

    switch (status) {
      case UserStatus.ACTIVE:
        return {
          title: 'Account Activated',
          body: `Your account has been activated and you can now access all platform features.${additionalInfo}`,
          urgency: 'medium',
        };
      case UserStatus.SUSPENDED:
        return {
          title: 'Account Suspended',
          body: `Your account has been temporarily suspended.${additionalInfo || ' Please contact support for more information.'}`,
          urgency: 'critical',
        };
      case UserStatus.BLOCKED:
        return {
          title: 'Account Blocked',
          body: `Your account has been blocked.${additionalInfo || ' Please contact support for assistance.'}`,
          urgency: 'critical',
        };
      case UserStatus.PENDING:
        return {
          title: 'Account Under Review',
          body: `Your account status has been changed to pending review.${additionalInfo || ' We will notify you once the review is complete.'}`,
          urgency: 'medium',
        };
      case UserStatus.DELETED:
      case UserStatus.ANONYMIZED:
        return null;
    }
  }

  private getNotificationPriority(status: UserStatus): 'low' | 'medium' | 'high' | 'critical' {
    switch (status) {
      case UserStatus.BLOCKED:
      case UserStatus.SUSPENDED:
        return 'critical';
      case UserStatus.ACTIVE:
      case UserStatus.PENDING:
        return 'medium';
      case UserStatus.DELETED:
      case UserStatus.ANONYMIZED:
        return 'low';
    }
  }
  private getStatusDisplayName(status: UserStatus): string {
    switch (status) {
      case UserStatus.ACTIVE:
        return 'Active';
      case UserStatus.SUSPENDED:
        return 'Suspended';
      case UserStatus.BLOCKED:
        return 'Blocked';
      case UserStatus.PENDING:
        return 'Pending Review';
      case UserStatus.DELETED:
        return 'Deleted';
      case UserStatus.ANONYMIZED:
        return 'Anonymized';
    }
  }
  private isCriticalStatusChange(status: UserStatus): boolean {
    return status === UserStatus.BLOCKED || status === UserStatus.SUSPENDED;
  }

  private async sendCriticalStatusPushNotification(
    user: UserDocument,
    status: UserStatus,
    reason?: string,
  ): Promise<void> {
    if (!this.notificationService) {
      this.logger.warn('NotificationService not available for push notification');
      return;
    }

    try {
      // Validate user data
      if (user._id === null || user._id === undefined) {
        this.logger.warn('Cannot send push notification: user._id is null or undefined');
        return;
      }

      const pushRequest: ISendNotificationRequest = {
        type: 'push',
        trigger: `user_status_${status.toLowerCase()}_critical`,
        target: {
          userId: user._id.toString(),
        },
        payload: {
          title: 'Important Account Update',
          body: this.formatStatusChangeMessage(status, reason),
          sound: 'default',
          badge: 1,
        },
        priority: 'critical',
        metadata: {
          critical: true,
          statusChange: status,
        },
      };

      const result = await this.notificationService.sendNotification(pushRequest);

      if (result?.success) {
        this.logger.log(
          `Critical push notification sent to user ${user._id} for status change to ${status}`,
        );
      } else if (result !== null && result !== undefined) {
        this.logger.error(`Failed to send critical push notification: ${result.error}`);
      } else {
        this.logger.warn(
          'Notification service returned null/undefined result for critical push notification',
        );
      }
    } catch (error) {
      this.logger.error(`Error sending critical push notification:`, error);
    }
  }

  /**
   * Emit appropriate user status change event based on the new status
   * Allows different services to react to specific status changes
   */
  private async emitUserStatusEvent(
    userId: string,
    adminId: string,
    adminEmail: string,
    previousStatus: UserStatus,
    updateDto: UpdateUserStatusDto,
  ): Promise<void> {
    try {
      // Emit generic status changed event
      await this.eventBus.emit(
        'admin.user.status_changed',
        new AdminUserStatusChangedEvent(
          userId,
          adminId,
          adminEmail,
          previousStatus,
          updateDto.status,
          updateDto.reason,
        ),
      );

      // Emit specific status events for targeted reactions
      const eventReason = updateDto.reason ?? 'No reason provided';

      switch (updateDto.status) {
        case UserStatus.ACTIVE:
          await this.eventBus.emit(
            'admin.user.activated',
            new AdminUserActivatedEvent(userId, adminId, adminEmail, updateDto.reason),
          );
          break;

        case UserStatus.SUSPENDED:
          await this.eventBus.emit(
            'admin.user.suspended',
            new AdminUserSuspendedEvent(
              userId,
              adminId,
              adminEmail,
              eventReason,
              updateDto.adminNotes,
            ),
          );
          break;

        case UserStatus.BLOCKED:
          await this.eventBus.emit(
            'admin.user.blocked',
            new AdminUserBlockedEvent(
              userId,
              adminId,
              adminEmail,
              eventReason,
              updateDto.adminNotes,
            ),
          );
          break;
        case UserStatus.PENDING:
        case UserStatus.DELETED:
        case UserStatus.ANONYMIZED:
          break;
      }

      this.logger.debug(
        `Emitted status change events for user ${userId}: ${previousStatus} → ${updateDto.status}`,
      );
    } catch (error) {
      // Don't fail the operation if event emission fails
      this.logger.error(`Failed to emit user status events for ${userId}:`, error);
    }
  }

  /**
   * Convert UserStatus to bulk action type
   */
  private getBulkActionType(status: UserStatus): 'activate' | 'suspend' | 'block' | null {
    switch (status) {
      case UserStatus.ACTIVE:
        return 'activate';
      case UserStatus.SUSPENDED:
        return 'suspend';
      case UserStatus.BLOCKED:
        return 'block';
      case UserStatus.PENDING:
      case UserStatus.DELETED:
      case UserStatus.ANONYMIZED:
        return null;
    }
  }
}
