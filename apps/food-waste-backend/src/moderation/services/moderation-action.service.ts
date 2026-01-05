import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ModerationAction, ModerationActionDocument, ModerationActionStatus, ModerationActionType } from '../schemas/moderation-action.schema';
import { CreateModerationActionDto, UpdateModerationActionDto, BulkModerationActionDto } from '../dtos/moderation-action.dto';
import { ModerationActionQueryDto } from '../dtos/report-query.dto';
import { ModerationLogService } from './moderation-log.service';
import { LogLevel, LogCategory } from '../schemas/moderation-log.schema';
import { UserRole } from '../../users/schemas/user.schema';

@Injectable()
export class ModerationActionService {
    constructor(
        @InjectModel(ModerationAction.name)
        private readonly moderationActionModel: Model<ModerationActionDocument>,
        private readonly moderationLogService: ModerationLogService
    ) { }

    /**
     * Create a moderation action with comprehensive logging
     */
    async createModerationAction(
        createActionDto: CreateModerationActionDto,
        moderatorId: string,
        moderatorRole: UserRole,
        requestContext?: {
            ipAddress?: string;
            userAgent?: string;
            endpoint?: string;
            location?: { country?: string; region?: string; city?: string };
        }
    ): Promise<ModerationActionDocument> {
        // Verify moderator has permission for this action type
        this.validateActionPermission(createActionDto.actionType, moderatorRole);

        // Check for conflicting active actions
        await this.checkForConflictingActions(createActionDto.targetUserId, createActionDto.actionType);

        // Set expiration date if not provided and action type requires it
        const expiresAt = createActionDto.expiresAt ?
            new Date(createActionDto.expiresAt) :
            this.calculateDefaultExpiration(createActionDto.actionType, createActionDto.severity);

        const moderationAction = new this.moderationActionModel({
            ...createActionDto,
            targetUserId: new Types.ObjectId(createActionDto.targetUserId),
            moderatorId: new Types.ObjectId(moderatorId),
            relatedReportId: createActionDto.relatedReportId ?
                new Types.ObjectId(createActionDto.relatedReportId) : undefined,
            expiresAt,
            actionContext: requestContext,
            isSystemAction: false,
            auditTrail: [{
                field: 'status',
                newValue: ModerationActionStatus.ACTIVE,
                changedBy: new Types.ObjectId(moderatorId),
                changedAt: new Date()
            }]
        });

        const savedAction = await moderationAction.save();

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
                affectedFeatures: createActionDto.affectedFeatures
            }
        });

        return savedAction;
    }

    /**
     * Get moderation actions with filtering and pagination
     */
    async getModerationActions(
        queryDto: ModerationActionQueryDto,
        currentUserId: string,
        userRole: UserRole
    ): Promise<{ actions: ModerationActionDocument[]; total: number; totalPages: number }> {
        const query: any = {};

        // Build query based on filters
        if (queryDto.targetUserId) { query.targetUserId = new Types.ObjectId(queryDto.targetUserId); }
        if (queryDto.actionType) { query.actionType = queryDto.actionType; }
        if (queryDto.status) { query.status = queryDto.status; }

        // Role-based filtering
        if (userRole === UserRole.MODERATOR) {
            // Moderators can only see actions they created
            query.moderatorId = new Types.ObjectId(currentUserId);
        }

        if (queryDto.moderatorId) { query.moderatorId = new Types.ObjectId(queryDto.moderatorId); }

        // Date range filter
        if (queryDto.startDate || queryDto.endDate) {
            query.createdAt = {};
            if (queryDto.startDate) { query.createdAt.$gte = new Date(queryDto.startDate); }
            if (queryDto.endDate) { query.createdAt.$lte = new Date(queryDto.endDate); }
        }

        const skip = (queryDto.page - 1) * queryDto.limit;
        const sortOrder: 1 | -1 = queryDto.sortOrder === 'asc' ? 1 : -1;
        const sort = { [queryDto.sortBy]: sortOrder };

        const [actions, total] = await Promise.all([
            this.moderationActionModel
                .find(query)
                .populate('targetUserId', 'firstName lastName email role status')
                .populate('moderatorId', 'firstName lastName email role')
                .populate('revokedBy', 'firstName lastName email')
                .populate('relatedReportId')
                .sort(sort)
                .skip(skip)
                .limit(queryDto.limit)
                .exec(),
            this.moderationActionModel.countDocuments(query)
        ]);

        return {
            actions,
            total,
            totalPages: Math.ceil(total / queryDto.limit)
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
        requestContext?: { ipAddress?: string; userAgent?: string }
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
            revokedBy: action.revokedBy?.toString()
        };

        action.status = ModerationActionStatus.REVOKED;
        action.revokedAt = new Date();
        action.revokedBy = new Types.ObjectId(revokedBy);
        action.revocationReason = revocationReason;

        action.auditTrail.push({
            field: 'status',
            oldValue: ModerationActionStatus.ACTIVE,
            newValue: ModerationActionStatus.REVOKED,
            changedBy: new Types.ObjectId(revokedBy),
            changedAt: new Date()
        });

        const updatedAction = await action.save();

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
                revokedBy: revokedBy
            },
            metadata: { revocationReason }
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
        requestContext?: { ipAddress?: string; userAgent?: string }
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
            revocationReason: action.revocationReason
        };

        const changes: Array<{ field: string; oldValue?: string; newValue?: string }> = [];

        if (updateDto.expiresAt !== undefined) {
            const oldExpiry = action.expiresAt?.toISOString();
            const newExpiry = updateDto.expiresAt;
            action.expiresAt = newExpiry ? new Date(newExpiry) : null;
            changes.push({
                field: 'expiresAt',
                oldValue: oldExpiry,
                newValue: newExpiry
            });
        }

        if (updateDto.affectedFeatures !== undefined) {
            changes.push({
                field: 'affectedFeatures',
                oldValue: JSON.stringify(action.affectedFeatures),
                newValue: JSON.stringify(updateDto.affectedFeatures)
            });
            action.affectedFeatures = updateDto.affectedFeatures;
        }

        // Add audit trail entries
        changes.forEach(change => {
            action.auditTrail.push({
                field: change.field,
                oldValue: change.oldValue,
                newValue: change.newValue,
                changedBy: new Types.ObjectId(updatedBy),
                changedAt: new Date()
            });
        });

        const updatedAction = await action.save();

        const afterState = {
            expiresAt: updatedAction.expiresAt?.toISOString(),
            affectedFeatures: updatedAction.affectedFeatures,
            revocationReason: updatedAction.revocationReason
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
            metadata: updateDto
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
        requestContext?: { ipAddress?: string; userAgent?: string }
    ): Promise<{ successful: ModerationActionDocument[]; failed: Array<{ userId: string; error: string }> }> {
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
                    isAppealable: true
                };

                const action = await this.createModerationAction(
                    actionDto,
                    moderatorId,
                    moderatorRole,
                    requestContext
                );

                successful.push(action);
            } catch (error) {
                failed.push({
                    userId,
                    error: (error as Error).message || 'Unknown error occurred'
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
                reason: bulkActionDto.reason
            }
        });

        return { successful, failed };
    }

    /**
     * Get active actions for a user
     */
    getUserActiveActions(userId: string): Promise<ModerationActionDocument[]> {
        return this.moderationActionModel
            .find({
                targetUserId: new Types.ObjectId(userId),
                status: ModerationActionStatus.ACTIVE,
                $or: [
                    { expiresAt: { $exists: false } },
                    { expiresAt: null },
                    { expiresAt: { $gt: new Date() } }
                ]
            })
            .populate('moderatorId', 'firstName lastName email role')
            .sort({ createdAt: -1 })
            .exec();
    }

    /**
     * Check and update expired actions
     */
    async processExpiredActions(): Promise<number> {
        const expiredActions = await this.moderationActionModel
            .find({
                status: ModerationActionStatus.ACTIVE,
                expiresAt: { $lte: new Date() }
            })
            .exec();

        let processedCount = 0;

        for (const action of expiredActions) {
            action.status = ModerationActionStatus.EXPIRED;
            action.auditTrail.push({
                field: 'status',
                oldValue: ModerationActionStatus.ACTIVE,
                newValue: ModerationActionStatus.EXPIRED,
                changedBy: action.moderatorId, // System change, attribute to original moderator
                changedAt: new Date()
            });

            await action.save();

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
                automationRule: 'expiration_check'
            });

            processedCount++;
        }

        return processedCount;
    }

    /**
     * Validate if moderator has permission for action type
     */
    private validateActionPermission(actionType: ModerationActionType, moderatorRole: UserRole): void {
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
        actionType: ModerationActionType
    ): Promise<void> {
        const conflictingTypes = {
            [ModerationActionType.BAN]: [ModerationActionType.SUSPEND],
            [ModerationActionType.SUSPEND]: [ModerationActionType.BAN]
        };

        if (conflictingTypes[actionType]) {
            const existingAction = await this.moderationActionModel.findOne({
                targetUserId: new Types.ObjectId(targetUserId),
                actionType: { $in: conflictingTypes[actionType] },
                status: ModerationActionStatus.ACTIVE,
                $or: [
                    { expiresAt: { $exists: false } },
                    { expiresAt: null },
                    { expiresAt: { $gt: new Date() } }
                ]
            });

            if (existingAction) {
                throw new BadRequestException(`Cannot apply ${actionType}. User has conflicting ${existingAction.actionType} action`);
            }
        }
    }

    /**
     * Calculate default expiration for action types
     */
    private calculateDefaultExpiration(
        actionType: ModerationActionType,
        severity: string
    ): Date | null {
        const severityMultiplier = {
            'minor': 1,
            'moderate': 2,
            'severe': 4,
            'critical': 8
        };

        const baseDurations = {
            [ModerationActionType.WARN]: null, // Warnings don't expire
            [ModerationActionType.SUSPEND]: 7 * 24 * 60 * 60 * 1000, // 7 days
            [ModerationActionType.BAN]: null, // Permanent unless revoked
            [ModerationActionType.RESTRICT_FEATURES]: 3 * 24 * 60 * 60 * 1000, // 3 days
            [ModerationActionType.REQUIRE_VERIFICATION]: null, // Until verified
            [ModerationActionType.HIDE_CONTENT]: null, // Permanent unless revoked
            [ModerationActionType.DELETE_CONTENT]: null, // Immediate and permanent
            [ModerationActionType.DEMONETIZE]: 30 * 24 * 60 * 60 * 1000 // 30 days
        };

        const baseDuration = baseDurations[actionType];

        if (!baseDuration) {
            return null;
        }

        const multiplier = severityMultiplier[severity] || 1;
        return new Date(Date.now() + (baseDuration * multiplier));
    }

    /**
     * Get appropriate log level for action type and severity
     */
    private getLogLevelForAction(actionType: ModerationActionType, severity: string): LogLevel {
        if (severity === 'critical' || actionType === ModerationActionType.BAN) {
            return LogLevel.CRITICAL;
        } else if (severity === 'severe' || actionType === ModerationActionType.SUSPEND) {
            return LogLevel.WARNING;
        } else {
            return LogLevel.INFO;
        }
    }
}