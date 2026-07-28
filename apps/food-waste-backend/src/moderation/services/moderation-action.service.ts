import { UserRole } from '@foodwaste/shared';
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage, FlattenMaps } from 'mongoose';

import {
  CreateModerationActionDto,
  UpdateModerationActionDto,
  BulkModerationActionDto,
} from '../dtos/moderation-action.dto';
import { ModerationActionQueryDto } from '../dtos/report-query.dto';
import {
  ModerationActionAudit,
  ModerationActionAuditDocument,
} from '../schemas/moderation-action-audit.schema';
import {
  ModerationAction,
  ModerationActionDocument,
  ModerationActionStatus,
  ModerationActionType,
} from '../schemas/moderation-action.schema';
import { LogLevel, LogCategory } from '../schemas/moderation-log.schema';

import { ModerationLogService } from './moderation-log.service';

/** Plain-object shape returned by aggregate pipelines (no Mongoose Document methods). */
export type ModerationActionLean = FlattenMaps<ModerationAction> & { _id: Types.ObjectId };

/** One field-level change to record against a moderation action. */
interface AuditChange {
  field: string;
  oldValue?: string | undefined;
  newValue?: string | undefined;
  changedBy: Types.ObjectId;
}

@Injectable()
export class ModerationActionService {
  private readonly logger = new Logger(ModerationActionService.name);

  constructor(
    @InjectModel(ModerationAction.name)
    private readonly moderationActionModel: Model<ModerationActionDocument>,
    @InjectModel(ModerationActionAudit.name)
    private readonly auditModel: Model<ModerationActionAuditDocument>,
    private readonly moderationLogService: ModerationLogService,
  ) {}

  /**
   * Record field changes against an action, one row per change.
   *
   * Always call this **after** the action itself has been saved. The audit rows now
   * live in their own collection, so they are no longer part of the parent's write:
   * auditing first would leave a record of a change that never happened if the save
   * then failed, which is the worse of the two failure modes.
   *
   * A failed audit write is logged and swallowed. Losing the history of a
   * moderation change is bad, but refusing to revoke a ban because its audit row
   * could not be written is worse — and the caller has already committed.
   */
  private async recordAuditChanges(
    actionId: Types.ObjectId,
    changes: AuditChange[],
  ): Promise<void> {
    if (changes.length === 0) {
      return;
    }

    const changedAt = new Date();

    try {
      await this.auditModel.insertMany(
        changes.map(c => ({
          actionId,
          field: c.field,
          ...(c.oldValue !== undefined ? { oldValue: c.oldValue } : {}),
          ...(c.newValue !== undefined ? { newValue: c.newValue } : {}),
          changedBy: c.changedBy,
          changedAt,
        })),
        // Record every change we can rather than aborting the batch on one bad row.
        { ordered: false },
      );
    } catch (error) {
      this.logger.error(
        `Failed to write ${changes.length} audit row(s) for moderation action ${actionId.toString()}: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Create a moderation action with comprehensive logging
   */
  async createModerationAction(
    createActionDto: CreateModerationActionDto,
    moderatorId: string,
    moderatorRole: UserRole,
    requestContext?:
      | {
          ipAddress?: string | undefined;
          userAgent?: string | undefined;
          endpoint?: string | undefined;
          location?:
            | {
                country?: string | undefined;
                region?: string | undefined;
                city?: string | undefined;
              }
            | undefined;
        }
      | undefined,
  ): Promise<ModerationActionDocument> {
    // Verify moderator has permission for this action type
    this.validateActionPermission(createActionDto.actionType, moderatorRole);

    // Check for conflicting active actions
    await this.checkForConflictingActions(createActionDto.targetUserId, createActionDto.actionType);

    // Set expiration date if not provided and action type requires it
    const expiresAt = createActionDto.expiresAt
      ? new Date(createActionDto.expiresAt)
      : this.calculateDefaultExpiration(createActionDto.actionType, createActionDto.severity);

    const moderationAction = new this.moderationActionModel({
      ...createActionDto,
      targetUserId: new Types.ObjectId(createActionDto.targetUserId),
      moderatorId: new Types.ObjectId(moderatorId),
      relatedReportId: createActionDto.relatedReportId
        ? new Types.ObjectId(createActionDto.relatedReportId)
        : undefined,
      expiresAt,
      actionContext: requestContext,
      isSystemAction: false,
    });

    const savedAction = await moderationAction.save();

    // Opening entry of the action's change history — recorded after the save so a
    // failed insert can never leave an audit row for an action that does not exist.
    await this.recordAuditChanges(savedAction._id, [
      {
        field: 'status',
        newValue: ModerationActionStatus.ACTIVE,
        changedBy: new Types.ObjectId(moderatorId),
      },
    ]);

    // Log the action creation
    await this.moderationLogService.logModerationEvent({
      level: this.getLogLevelForAction(createActionDto.actionType, createActionDto.severity),
      category: LogCategory.USER_ACTION,
      action: 'MODERATION_ACTION_CREATED',
      description: `${createActionDto.actionType} action applied to user ${createActionDto.targetUserId}: ${createActionDto.reason}`,
      performedBy: moderatorId,
      targetId: createActionDto.targetUserId,
      targetType: 'user',
      relatedActionId: savedAction._id.toString(),
      relatedReportId: createActionDto.relatedReportId,
      requestContext,
      metadata: {
        actionType: createActionDto.actionType,
        severity: createActionDto.severity,
        expiresAt: expiresAt?.toISOString(),
        affectedFeatures: createActionDto.affectedFeatures,
      },
    });

    return savedAction;
  }

  /**
   * Get moderation actions with filtering and pagination
   */
  async getModerationActions(
    queryDto: ModerationActionQueryDto,
    currentUserId: string,
    userRole: UserRole,
  ): Promise<{ actions: ModerationActionLean[]; total: number; totalPages: number }> {
    const matchConditions: Record<string, unknown> = {};

    // Build query based on filters
    if (queryDto.targetUserId) {
      matchConditions['targetUserId'] = new Types.ObjectId(queryDto.targetUserId);
    }
    if (queryDto.actionType) {
      matchConditions['actionType'] = queryDto.actionType;
    }
    if (queryDto.status) {
      matchConditions['status'] = queryDto.status;
    }

    // Role-based filtering
    if (userRole === UserRole.MODERATOR) {
      matchConditions['moderatorId'] = new Types.ObjectId(currentUserId);
    }

    if (queryDto.moderatorId) {
      matchConditions['moderatorId'] = new Types.ObjectId(queryDto.moderatorId);
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

    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 10;
    const sortBy = queryDto.sortBy ?? 'createdAt';
    const skip = (page - 1) * limit;
    const sortOrder: 1 | -1 = queryDto.sortOrder === 'asc' ? 1 : -1;

    // Paginate first, then $lookup on small result set
    const pipeline: PipelineStage[] = [
      { $match: matchConditions },
      { $sort: { [sortBy]: sortOrder } },
      { $skip: skip },
      { $limit: limit },
      ...this.getUserLookupStages('targetUserId', [
        'firstName',
        'lastName',
        'email',
        'role',
        'status',
      ]),
      ...this.getUserLookupStages('moderatorId', ['firstName', 'lastName', 'email', 'role']),
      ...this.getUserLookupStages('revokedBy', ['firstName', 'lastName', 'email']),
      ...this.getReportLookupStages(),
    ];

    const [actions, total] = await Promise.all([
      this.moderationActionModel.aggregate<ModerationActionLean>(pipeline),
      this.moderationActionModel.countDocuments(matchConditions),
    ]);

    return {
      actions,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Revoke a moderation action
   */
  async revokeModerationAction(
    actionId: string,
    revocationReason: string,
    revokedBy: string,
    userRole: UserRole,
    requestContext?: { ipAddress?: string | undefined; userAgent?: string | undefined } | undefined,
  ): Promise<ModerationActionDocument> {
    const action = await this.moderationActionModel.findById(actionId);

    if (!action) {
      throw new NotFoundException('Moderation action not found');
    }

    if (action.status !== ModerationActionStatus.ACTIVE) {
      throw new BadRequestException('Only active actions can be revoked');
    }

    // Permission check - moderators can only revoke their own actions, admins can revoke any
    if (userRole === UserRole.MODERATOR && !action.moderatorId.equals(revokedBy)) {
      throw new ForbiddenException('You can only revoke actions you created');
    }

    const beforeState = {
      status: action.status,
      revokedAt: action.revokedAt,
      revokedBy: action.revokedBy?.toString(),
    };

    action.status = ModerationActionStatus.REVOKED;
    action.revokedAt = new Date();
    action.revokedBy = new Types.ObjectId(revokedBy);
    action.revocationReason = revocationReason;

    const updatedAction = await action.save();

    await this.recordAuditChanges(action._id, [
      {
        field: 'status',
        oldValue: ModerationActionStatus.ACTIVE,
        newValue: ModerationActionStatus.REVOKED,
        changedBy: new Types.ObjectId(revokedBy),
      },
    ]);

    // Log the revocation
    await this.moderationLogService.logModerationEvent({
      level: LogLevel.INFO,
      category: LogCategory.USER_ACTION,
      action: 'MODERATION_ACTION_REVOKED',
      description: `Moderation action ${actionId} revoked: ${revocationReason}`,
      performedBy: revokedBy,
      targetId: action.targetUserId.toString(),
      targetType: 'user',
      relatedActionId: actionId,
      requestContext,
      beforeState,
      afterState: {
        status: ModerationActionStatus.REVOKED,
        revokedAt: updatedAction.revokedAt?.toISOString(),
        revokedBy,
      },
      metadata: { revocationReason },
    });

    return updatedAction;
  }

  /**
   * Update moderation action expiration or affected features
   */
  async updateModerationAction(
    actionId: string,
    updateDto: UpdateModerationActionDto,
    updatedBy: string,
    userRole: UserRole,
    requestContext?: { ipAddress?: string | undefined; userAgent?: string | undefined } | undefined,
  ): Promise<ModerationActionDocument> {
    const action = await this.moderationActionModel.findById(actionId);

    if (!action) {
      throw new NotFoundException('Moderation action not found');
    }

    // Permission check
    if (userRole === UserRole.MODERATOR && !action.moderatorId.equals(updatedBy)) {
      throw new ForbiddenException('You can only update actions you created');
    }

    const beforeState = {
      expiresAt: action.expiresAt?.toISOString(),
      affectedFeatures: action.affectedFeatures,
      revocationReason: action.revocationReason,
    };

    const changes: Array<{
      field: string;
      oldValue?: string | undefined;
      newValue?: string | undefined;
    }> = [];

    if (updateDto.expiresAt !== undefined) {
      const oldExpiry = action.expiresAt?.toISOString();
      const newExpiry = updateDto.expiresAt;
      action.expiresAt = newExpiry ? new Date(newExpiry) : undefined;
      changes.push({
        field: 'expiresAt',
        oldValue: oldExpiry,
        newValue: newExpiry,
      });
    }

    if (updateDto.affectedFeatures !== undefined) {
      changes.push({
        field: 'affectedFeatures',
        oldValue: JSON.stringify(action.affectedFeatures),
        newValue: JSON.stringify(updateDto.affectedFeatures),
      });
      action.affectedFeatures = updateDto.affectedFeatures;
    }

    const updatedAction = await action.save();

    // One audit row per changed field, in a single insertMany.
    await this.recordAuditChanges(
      action._id,
      changes.map(change => ({
        field: change.field,
        ...(change.oldValue !== undefined ? { oldValue: change.oldValue } : {}),
        ...(change.newValue !== undefined ? { newValue: change.newValue } : {}),
        changedBy: new Types.ObjectId(updatedBy),
      })),
    );

    const afterState = {
      expiresAt: updatedAction.expiresAt?.toISOString(),
      affectedFeatures: updatedAction.affectedFeatures,
      revocationReason: updatedAction.revocationReason,
    };

    // Log the update
    await this.moderationLogService.logModerationEvent({
      level: LogLevel.INFO,
      category: LogCategory.USER_ACTION,
      action: 'MODERATION_ACTION_UPDATED',
      description: `Moderation action ${actionId} updated`,
      performedBy: updatedBy,
      targetId: action.targetUserId.toString(),
      targetType: 'user',
      relatedActionId: actionId,
      requestContext,
      beforeState,
      afterState,
      metadata: updateDto as unknown as Record<string, unknown>,
    });

    return updatedAction;
  }

  /**
   * Apply bulk moderation actions (admin only)
   */
  async createBulkModerationActions(
    bulkActionDto: BulkModerationActionDto,
    moderatorId: string,
    moderatorRole: UserRole,
    requestContext?: { ipAddress?: string | undefined; userAgent?: string | undefined } | undefined,
  ): Promise<{
    successful: ModerationActionDocument[];
    failed: Array<{ userId: string; error: string }>;
  }> {
    if (moderatorRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Bulk actions are only available to administrators');
    }

    const successful: ModerationActionDocument[] = [];
    const failed: Array<{ userId: string; error: string }> = [];

    for (const userId of bulkActionDto.targetUserIds) {
      try {
        const actionDto: CreateModerationActionDto = {
          actionType: bulkActionDto.actionType,
          targetUserId: userId,
          severity: bulkActionDto.severity,
          reason: bulkActionDto.reason,
          details: bulkActionDto.details,
          expiresAt: bulkActionDto.expiresAt,
          isAppealable: true,
        };

        const action = await this.createModerationAction(
          actionDto,
          moderatorId,
          moderatorRole,
          requestContext,
        );

        successful.push(action);
      } catch (error) {
        failed.push({
          userId,
          error: (error as Error).message || 'Unknown error occurred',
        });
      }
    }

    // Log bulk action summary
    await this.moderationLogService.logModerationEvent({
      level: LogLevel.INFO,
      category: LogCategory.BULK_ACTION,
      action: 'BULK_MODERATION_ACTION',
      description: `Bulk ${bulkActionDto.actionType} applied to ${successful.length}/${bulkActionDto.targetUserIds.length} users`,
      performedBy: moderatorId,
      requestContext,
      metadata: {
        actionType: bulkActionDto.actionType,
        totalTargets: bulkActionDto.targetUserIds.length,
        successful: successful.length,
        failed: failed.length,
        reason: bulkActionDto.reason,
      },
    });

    return { successful, failed };
  }

  /**
   * Get active actions for a user
   */
  async getUserActiveActions(userId: string): Promise<ModerationActionLean[]> {
    const result = await this.moderationActionModel.aggregate<ModerationActionLean>([
      {
        $match: {
          targetUserId: new Types.ObjectId(userId),
          status: ModerationActionStatus.ACTIVE,
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } },
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      ...this.getUserLookupStages('moderatorId', ['firstName', 'lastName', 'email', 'role']),
    ]);
    return result;
  }

  /**
   * Check and update expired actions
   */
  async processExpiredActions(): Promise<number> {
    const expiredActions = await this.moderationActionModel
      .find({
        status: ModerationActionStatus.ACTIVE,
        expiresAt: { $lte: new Date() },
      })
      .exec();

    let processedCount = 0;

    for (const action of expiredActions) {
      action.status = ModerationActionStatus.EXPIRED;

      await action.save();

      await this.recordAuditChanges(action._id, [
        {
          field: 'status',
          oldValue: ModerationActionStatus.ACTIVE,
          newValue: ModerationActionStatus.EXPIRED,
          // Automated change; attributed to the original moderator, as before —
          // there is no system user to attribute it to.
          changedBy: action.moderatorId,
        },
      ]);

      // Log expiration
      await this.moderationLogService.logModerationEvent({
        level: LogLevel.INFO,
        category: LogCategory.SYSTEM_EVENT,
        action: 'ACTION_EXPIRED',
        description: `Moderation action ${action._id} expired automatically`,
        performedBy: action.moderatorId.toString(),
        targetId: action.targetUserId.toString(),
        targetType: 'user',
        relatedActionId: action._id.toString(),
        isAutomated: true,
        automationRule: 'expiration_check',
      });

      processedCount++;
    }

    return processedCount;
  }

  /**
   * Reusable $lookup for a user ObjectId field → users collection.
   */
  private getUserLookupStages(
    localField: string,
    fields: string[] = ['firstName', 'lastName', 'email', 'role'],
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
   * $lookup for relatedReportId → reports collection (full document).
   */
  private getReportLookupStages(): PipelineStage[] {
    return [
      {
        $lookup: {
          from: 'reports',
          let: { reportObjId: '$relatedReportId' },
          pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$reportObjId'] } } }],
          as: 'relatedReportId',
        },
      },
      { $unwind: { path: '$relatedReportId', preserveNullAndEmptyArrays: true } },
    ];
  }

  /**
   * Validate if moderator has permission for action type
   */
  private validateActionPermission(
    actionType: ModerationActionType,
    moderatorRole: UserRole,
  ): void {
    const adminOnlyActions = [ModerationActionType.BAN, ModerationActionType.DEMONETIZE];

    if (adminOnlyActions.includes(actionType) && moderatorRole !== UserRole.ADMIN) {
      throw new ForbiddenException(`Action type ${actionType} requires admin privileges`);
    }
  }

  /**
   * Check for conflicting active actions
   */
  private async checkForConflictingActions(
    targetUserId: string,
    actionType: ModerationActionType,
  ): Promise<void> {
    const conflictingTypes: Partial<Record<ModerationActionType, ModerationActionType[]>> = {
      [ModerationActionType.BAN]: [ModerationActionType.SUSPEND],
      [ModerationActionType.SUSPEND]: [ModerationActionType.BAN],
    };

    if (conflictingTypes[actionType]) {
      const existingAction = await this.moderationActionModel.findOne({
        targetUserId: new Types.ObjectId(targetUserId),
        actionType: { $in: conflictingTypes[actionType] },
        status: ModerationActionStatus.ACTIVE,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } },
        ],
      });

      if (existingAction) {
        throw new BadRequestException(
          `Cannot apply ${actionType}. User has conflicting ${existingAction.actionType} action`,
        );
      }
    }
  }

  /**
   * Calculate default expiration for action types
   */
  private calculateDefaultExpiration(
    actionType: ModerationActionType,
    severity: string,
  ): Date | null {
    const severityMultiplier: Record<string, number> = {
      minor: 1,
      moderate: 2,
      severe: 4,
      critical: 8,
    };

    const baseDurations = {
      [ModerationActionType.WARN]: null, // Warnings don't expire
      [ModerationActionType.SUSPEND]: 7 * 24 * 60 * 60 * 1000, // 7 days
      [ModerationActionType.BAN]: null, // Permanent unless revoked
      [ModerationActionType.RESTRICT_FEATURES]: 3 * 24 * 60 * 60 * 1000, // 3 days
      [ModerationActionType.REQUIRE_VERIFICATION]: null, // Until verified
      [ModerationActionType.HIDE_CONTENT]: null, // Permanent unless revoked
      [ModerationActionType.DELETE_CONTENT]: null, // Immediate and permanent
      [ModerationActionType.DEMONETIZE]: 30 * 24 * 60 * 60 * 1000, // 30 days
    };

    const baseDuration = baseDurations[actionType];

    if (!baseDuration) {
      return null;
    }

    const multiplier = severityMultiplier[severity] ?? 1;
    return new Date(Date.now() + baseDuration * multiplier);
  }

  /**
   * Get appropriate log level for action type and severity
   */
  private getLogLevelForAction(actionType: ModerationActionType, severity: string): LogLevel {
    if (severity === 'critical' || actionType === ModerationActionType.BAN) {
      return LogLevel.CRITICAL;
    } else if (severity === 'severe' || actionType === ModerationActionType.SUSPEND) {
      return LogLevel.WARNING;
    }
    return LogLevel.INFO;
  }
}
