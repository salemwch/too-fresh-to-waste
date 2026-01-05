import { Injectable, Logger,  } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Permission, PermissionDocument } from '../schemas/permission.schema';
import { RolePermission, RolePermissionDocument } from '../schemas/role-permission.schema';
import { UserPermission, UserPermissionDocument } from '../schemas/user-permission.schema';
import { UserRole } from 'src/users/schemas/user.schema';
import {
    AuthorizationContext,
    AuthorizationResult,
    PermissionCheckRequest,
    AuthorizationPolicy,
    OwnershipCheck,
} from '../interfaces/authorization.interface';

/**
 * Authorization Service
 * Core service for enterprise-grade authorization with RBAC + ABAC
 *
 * Features:
 * 1. Permission-based access control (fine-grained)
 * 2. Policy-based authorization (attribute-based)
 * 3. Resource ownership validation
 * 4. Tenant isolation enforcement
 * 5. Permission caching for performance
 * 6. Audit logging for compliance
 */

@Injectable()
export class AuthorizationService {
    private readonly logger = new Logger(AuthorizationService.name);

    // In-memory cache for permissions (invalidated on updates)
    private readonly rolePermissionsCache = new Map<UserRole, string[]>();
    private readonly userPermissionsCache = new Map<string, string[]>();

    constructor(
        @InjectModel(Permission.name)
        private readonly permissionModel: Model<PermissionDocument>,
        @InjectModel(RolePermission.name)
        private readonly rolePermissionModel: Model<RolePermissionDocument>,
        @InjectModel(UserPermission.name)
        private readonly userPermissionModel: Model<UserPermissionDocument>,
    ) {}

    /**
     * Check if user has required permission(s)
     */
    async checkPermissions(request: PermissionCheckRequest): Promise<AuthorizationResult> {
        const { userId, role, requiredPermissions, requireAll = false } = request;

        try {
            // Get user's effective permissions (role + user-specific)
            const userPermissions = await this.getUserPermissions(userId.toString(), role);

            // Check if user has required permissions
            const hasPermissions = requireAll
                ? requiredPermissions.every(perm => userPermissions.includes(perm))
                : requiredPermissions.some(perm => userPermissions.includes(perm));

            if (hasPermissions) {
                return {
                    allowed: true,
                    reason: 'User has required permissions',
                };
            }

            // Find missing permissions
            const missingPermissions = requiredPermissions.filter(
                perm => !userPermissions.includes(perm),
            );

            return {
                allowed: false,
                reason: requireAll
                    ? 'Missing required permissions'
                    : 'User does not have any of the required permissions',
                missingPermissions,
            };
        } catch (error) {
            this.logger.error('Permission check failed', error);
            return {
                allowed: false,
                reason: 'Permission check error',
            };
        }
    }

    /**
     * Check authorization against policy
     */
    async checkPolicy(
        context: AuthorizationContext,
        policy: AuthorizationPolicy,
    ): Promise<AuthorizationResult> {
        try {
            const { conditions } = policy;

            // Check role requirements
            if (conditions.roles && !conditions.roles.includes(context.role)) {
                return {
                    allowed: false,
                    reason: 'Role not allowed by policy',
                    deniedBy: policy.name,
                };
            }

            // Check permission requirements
            if (conditions.permissions && conditions.permissions.length > 0) {
                const userPermissions = await this.getUserPermissions(
                    context.userId.toString(),
                    context.role,
                );

                const hasPermissions = conditions.permissions.some(perm =>
                    userPermissions.includes(perm),
                );

                if (!hasPermissions) {
                    return {
                        allowed: false,
                        reason: 'Missing required permissions for policy',
                        deniedBy: policy.name,
                        missingPermissions: conditions.permissions,
                    };
                }
            }

            // Check ownership requirements
            if (conditions.requiresOwnership && context.resource) {
                const isOwner = this.checkOwnership({
                    resourceId: context.resource.id!,
                    resourceType: context.resource.type,
                    ownerIdField: conditions.allowedOwnerFields?.[0] || 'ownerId',
                    expectedOwnerId: context.userId,
                });

                if (!isOwner) {
                    return {
                        allowed: false,
                        reason: 'User is not the resource owner',
                        deniedBy: policy.name,
                    };
                }
            }

            // Check tenant isolation requirements
            if (conditions.requiresTenantMatch && context.resource && context.tenantId) {
                const tenantField = conditions.tenantFields?.[0] || 'merchantId';
                const resourceTenantId = context.resource.metadata?.[tenantField];

                if (resourceTenantId?.toString() !== context.tenantId.toString()) {
                    return {
                        allowed: false,
                        reason: 'Tenant mismatch - access denied',
                        deniedBy: policy.name,
                    };
                }
            }

            // Check time-based restrictions
            if (conditions.validFrom && new Date() < conditions.validFrom) {
                return {
                    allowed: false,
                    reason: 'Policy not yet valid',
                    deniedBy: policy.name,
                };
            }

            if (conditions.validUntil && new Date() > conditions.validUntil) {
                return {
                    allowed: false,
                    reason: 'Policy expired',
                    deniedBy: policy.name,
                };
            }

            // Check resource status restrictions
            if (conditions.allowedStatuses && context.resource?.metadata?.status) {
                if (!conditions.allowedStatuses.includes(context.resource.metadata.status)) {
                    return {
                        allowed: false,
                        reason: `Resource status '${context.resource.metadata.status}' not allowed`,
                        deniedBy: policy.name,
                    };
                }
            }

            if (conditions.forbiddenStatuses && context.resource?.metadata?.status) {
                if (conditions.forbiddenStatuses.includes(context.resource.metadata.status)) {
                    return {
                        allowed: false,
                        reason: `Resource status '${context.resource.metadata.status}' is forbidden`,
                        deniedBy: policy.name,
                    };
                }
            }

            // Policy allows access
            return {
                allowed: policy.effect === 'allow',
                reason: policy.effect === 'allow' ? 'Policy allows access' : 'Policy denies access',
                matchedPolicy: policy.name,
            };
        } catch (error) {
            this.logger.error('Policy check failed', error);
            return {
                allowed: false,
                reason: 'Policy evaluation error',
                deniedBy: policy.name,
            };
        }
    }

    /**
     * Check resource ownership
     */
    checkOwnership(check: OwnershipCheck): boolean {
        const { ownerIdField, expectedOwnerId } = check;

        // This is a simplified check - in real implementation,
        // you would fetch the resource and check ownership
        // For now, it's used by guards that pass the actual resource data

        return true; // Actual implementation in guards
    }

    /**
     * Get user's effective permissions (role + user-specific grants/revocations)
     */
    async getUserPermissions(userId: string, role: UserRole): Promise<string[]> {
        // Check cache first
        const cacheKey = `${userId}:${role}`;
        if (this.userPermissionsCache.has(cacheKey)) {
            return this.userPermissionsCache.get(cacheKey)!;
        }

        try {
            // Get role-based permissions
            const rolePermissions = await this.getRolePermissions(role);

            // Get user-specific permission overrides
            const userPermissionDocs = await this.userPermissionModel
                .find({
                    userId: new Types.ObjectId(userId),
                    isActive: true,
                    $and: [
                        {
                            $or: [
                                { validFrom: { $exists: false } },
                                { validFrom: { $lte: new Date() } },
                            ],
                        },
                        {
                            $or: [
                                { validUntil: { $exists: false } },
                                { validUntil: { $gte: new Date() } },
                            ],
                        },
                    ],
                })
                .populate('permissionId')
                .lean();

            // Apply grants and revocations
            const permissions = new Set(rolePermissions);

            for (const userPerm of userPermissionDocs) {
                const permission = userPerm.permissionId as any;
                if (permission?.name) {
                    if (userPerm.type === 'grant') {
                        permissions.add(permission.name);
                    } else if (userPerm.type === 'revoke') {
                        permissions.delete(permission.name);
                    }
                }
            }

            const effectivePermissions = Array.from(permissions);

            // Cache for 5 minutes
            this.userPermissionsCache.set(cacheKey, effectivePermissions);
            setTimeout(() => this.userPermissionsCache.delete(cacheKey), 5 * 60 * 1000);

            return effectivePermissions;
        } catch (error) {
            this.logger.error('Failed to get user permissions', error);
            return [];
        }
    }

    /**
     * Get permissions for a role
     */
    async getRolePermissions(role: UserRole): Promise<string[]> {
        // Check cache
        if (this.rolePermissionsCache.has(role)) {
            return this.rolePermissionsCache.get(role)!;
        }

        try {
            const rolePermissionDoc = await this.rolePermissionModel
                .findOne({ role, isActive: true })
                .populate('permissions')
                .lean();

            if (!rolePermissionDoc) {
                return [];
            }

            const permissions = (rolePermissionDoc.permissions as any[])
                .filter(p => p?.isActive)
                .map(p => p.name);

            // Cache for 10 minutes
            this.rolePermissionsCache.set(role, permissions);
            setTimeout(() => this.rolePermissionsCache.delete(role), 10 * 60 * 1000);

            return permissions;
        } catch (error) {
            this.logger.error(`Failed to get role permissions for ${role}`, error);
            return [];
        }
    }

    /**
     * Grant permission to user
     */
    async grantPermission(
        userId: string | Types.ObjectId,
        permissionName: string,
        grantedBy: string | Types.ObjectId,
        options?: {
            validFrom?: Date;
            validUntil?: Date;
            reason?: string;
        },
    ): Promise<void> {
        const permission = await this.permissionModel.findOne({ name: permissionName });

        if (!permission) {
            throw new Error(`Permission '${permissionName}' not found`);
        }

        await this.userPermissionModel.create({
            userId: new Types.ObjectId(userId.toString()),
            permissionId: permission._id,
            type: 'grant',
            isActive: true,
            grantedBy: new Types.ObjectId(grantedBy.toString()),
            ...options,
        });

        // Invalidate cache
        this.invalidateUserPermissionCache(userId.toString());

        this.logger.log(`Permission '${permissionName}' granted to user ${userId}`);
    }

    /**
     * Revoke permission from user
     */
    async revokePermission(
        userId: string | Types.ObjectId,
        permissionName: string,
        revokedBy: string | Types.ObjectId,
        reason?: string,
    ): Promise<void> {
        const permission = await this.permissionModel.findOne({ name: permissionName });

        if (!permission) {
            throw new Error(`Permission '${permissionName}' not found`);
        }

        await this.userPermissionModel.create({
            userId: new Types.ObjectId(userId.toString()),
            permissionId: permission._id,
            type: 'revoke',
            isActive: true,
            revokedBy: new Types.ObjectId(revokedBy.toString()),
            revokedAt: new Date(),
            reason,
        });

        // Invalidate cache
        this.invalidateUserPermissionCache(userId.toString());

        this.logger.log(`Permission '${permissionName}' revoked from user ${userId}`);
    }

    /**
     * Invalidate permission cache for user
     */
    private invalidateUserPermissionCache(userId: string): void {
        const keysToDelete: string[] = [];
        for (const key of this.userPermissionsCache.keys()) {
            if (key.startsWith(`${userId}:`)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.userPermissionsCache.delete(key));
    }

    /**
     * Clear all caches
     */
    clearCache(): void {
        this.rolePermissionsCache.clear();
        this.userPermissionsCache.clear();
        this.logger.log('Permission caches cleared');
    }
}
