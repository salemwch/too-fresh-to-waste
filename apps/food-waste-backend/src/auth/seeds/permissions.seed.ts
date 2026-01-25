import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
    Permission,
    PermissionDocument,
    PermissionResource,
    PermissionAction,
    PermissionScope,
} from '../schemas/permission.schema';
import { RolePermission, RolePermissionDocument } from '../schemas/role-permission.schema';
import { UserRole } from 'src/common/enums/user.enum';

/**
 * Permissions Seed Service
 * Initializes default permissions and role-permission mappings
 *
 * Run on application startup to ensure permissions are available
 */

@Injectable()
export class PermissionsSeedService implements OnModuleInit {
    private readonly logger = new Logger(PermissionsSeedService.name);

    constructor(
        @InjectModel(Permission.name)
        private readonly permissionModel: Model<PermissionDocument>,
        @InjectModel(RolePermission.name)
        private readonly rolePermissionModel: Model<RolePermissionDocument>,
    ) {}

    async onModuleInit() {
        await this.seedPermissions();
        await this.seedRolePermissions();
    }

    /**
     * Seed default permissions
     */
    async seedPermissions() {
        this.logger.log('Seeding permissions...');

        const permissions = this.getDefaultPermissions();

        for (const perm of permissions) {
            try {
                await this.permissionModel.updateOne(
                    { name: perm.name },
                    { $setOnInsert: perm },
                    { upsert: true },
                );
            } catch (error) {
                this.logger.error(`Failed to seed permission ${perm.name}`, error);
            }
        }

        this.logger.log(`${permissions.length} permissions seeded successfully`);
    }

    /**
     * Seed role-permission mappings
     */
    async seedRolePermissions() {
        this.logger.log('Seeding role permissions...');

        const roleMappings = await this.getDefaultRolePermissions();

        for (const [role, permissionNames] of Object.entries(roleMappings)) {
            try {
                // Get permission IDs
                const permissions = await this.permissionModel.find({
                    name: { $in: permissionNames },
                });

                const permissionIds = permissions.map(p => p._id);

                // Update or create role-permission mapping
                await this.rolePermissionModel.updateOne(
                    { role: role as UserRole },
                    {
                        $set: {
                            role: role as UserRole,
                            permissions: permissionIds,
                            isActive: true,
                        },
                    },
                    { upsert: true },
                );

                this.logger.log(
                    `Role ${role} assigned ${permissionIds.length} permissions`,
                );
            } catch (error) {
                this.logger.error(`Failed to seed role permissions for ${role}`, error);
            }
        }

        this.logger.log('Role permissions seeded successfully');
    }

    /**
     * Get default permissions
     */
    private getDefaultPermissions() {
        return [
            // ===== ORDERS =====
            {
                name: 'orders:read:own',
                description: 'Read own orders',
                resource: PermissionResource.ORDERS,
                action: PermissionAction.READ,
                scope: PermissionScope.OWN,
                isActive: true,
            },
            {
                name: 'orders:read:any',
                description: 'Read all orders (admin)',
                resource: PermissionResource.ORDERS,
                action: PermissionAction.READ,
                scope: PermissionScope.ANY,
                isActive: true,
            },
            {
                name: 'orders:create:own',
                description: 'Create own orders',
                resource: PermissionResource.ORDERS,
                action: PermissionAction.CREATE,
                scope: PermissionScope.OWN,
                isActive: true,
            },
            {
                name: 'orders:update:own',
                description: 'Update own orders',
                resource: PermissionResource.ORDERS,
                action: PermissionAction.UPDATE,
                scope: PermissionScope.OWN,
                isActive: true,
            },
            {
                name: 'orders:update:any',
                description: 'Update any order (admin)',
                resource: PermissionResource.ORDERS,
                action: PermissionAction.UPDATE,
                scope: PermissionScope.ANY,
                isActive: true,
            },
            {
                name: 'orders:delete:own',
                description: 'Delete own orders',
                resource: PermissionResource.ORDERS,
                action: PermissionAction.DELETE,
                scope: PermissionScope.OWN,
                isActive: true,
            },
            {
                name: 'orders:refund:own',
                description: 'Refund own orders',
                resource: PermissionResource.ORDERS,
                action: PermissionAction.REFUND,
                scope: PermissionScope.OWN,
                isActive: true,
            },
            {
                name: 'orders:refund:any',
                description: 'Refund any order (admin)',
                resource: PermissionResource.ORDERS,
                action: PermissionAction.REFUND,
                scope: PermissionScope.ANY,
                isActive: true,
            },

            // ===== OFFERS =====
            {
                name: 'offers:read:own',
                description: 'Read own offers',
                resource: PermissionResource.OFFERS,
                action: PermissionAction.READ,
                scope: PermissionScope.OWN,
                isActive: true,
            },
            {
                name: 'offers:read:any',
                description: 'Read all offers',
                resource: PermissionResource.OFFERS,
                action: PermissionAction.READ,
                scope: PermissionScope.ANY,
                isActive: true,
            },
            {
                name: 'offers:create:own',
                description: 'Create own offers',
                resource: PermissionResource.OFFERS,
                action: PermissionAction.CREATE,
                scope: PermissionScope.OWN,
                isActive: true,
            },
            {
                name: 'offers:update:own',
                description: 'Update own offers',
                resource: PermissionResource.OFFERS,
                action: PermissionAction.UPDATE,
                scope: PermissionScope.OWN,
                isActive: true,
            },
            {
                name: 'offers:update:any',
                description: 'Update any offer (admin)',
                resource: PermissionResource.OFFERS,
                action: PermissionAction.UPDATE,
                scope: PermissionScope.ANY,
                isActive: true,
            },
            {
                name: 'offers:delete:own',
                description: 'Delete own offers',
                resource: PermissionResource.OFFERS,
                action: PermissionAction.DELETE,
                scope: PermissionScope.OWN,
                isActive: true,
            },
            {
                name: 'offers:approve:any',
                description: 'Approve any offer (admin)',
                resource: PermissionResource.OFFERS,
                action: PermissionAction.APPROVE,
                scope: PermissionScope.ANY,
                isActive: true,
            },

            // ===== ESTABLISHMENTS =====
            {
                name: 'establishments:read:own',
                description: 'Read own establishments',
                resource: PermissionResource.ESTABLISHMENTS,
                action: PermissionAction.READ,
                scope: PermissionScope.OWN,
                isActive: true,
            },
            {
                name: 'establishments:read:any',
                description: 'Read all establishments',
                resource: PermissionResource.ESTABLISHMENTS,
                action: PermissionAction.READ,
                scope: PermissionScope.ANY,
                isActive: true,
            },
            {
                name: 'establishments:create:own',
                description: 'Create own establishments',
                resource: PermissionResource.ESTABLISHMENTS,
                action: PermissionAction.CREATE,
                scope: PermissionScope.OWN,
                isActive: true,
            },
            {
                name: 'establishments:update:own',
                description: 'Update own establishments',
                resource: PermissionResource.ESTABLISHMENTS,
                action: PermissionAction.UPDATE,
                scope: PermissionScope.OWN,
                isActive: true,
            },
            {
                name: 'establishments:update:any',
                description: 'Update any establishment (admin)',
                resource: PermissionResource.ESTABLISHMENTS,
                action: PermissionAction.UPDATE,
                scope: PermissionScope.ANY,
                isActive: true,
            },
            {
                name: 'establishments:delete:own',
                description: 'Delete own establishments',
                resource: PermissionResource.ESTABLISHMENTS,
                action: PermissionAction.DELETE,
                scope: PermissionScope.OWN,
                isActive: true,
            },
            {
                name: 'establishments:approve:any',
                description: 'Approve any establishment (admin)',
                resource: PermissionResource.ESTABLISHMENTS,
                action: PermissionAction.APPROVE,
                scope: PermissionScope.ANY,
                isActive: true,
            },

            // ===== ANALYTICS =====
            {
                name: 'analytics:access:own',
                description: 'Access own analytics',
                resource: PermissionResource.ANALYTICS,
                action: PermissionAction.ACCESS,
                scope: PermissionScope.OWN,
                isActive: true,
            },
            {
                name: 'analytics:access:any',
                description: 'Access all analytics (admin)',
                resource: PermissionResource.ANALYTICS,
                action: PermissionAction.ACCESS,
                scope: PermissionScope.ANY,
                isActive: true,
            },
            {
                name: 'analytics:export:own',
                description: 'Export own analytics',
                resource: PermissionResource.ANALYTICS,
                action: PermissionAction.EXPORT,
                scope: PermissionScope.OWN,
                isActive: true,
            },

            // ===== USERS =====
            {
                name: 'users:read:any',
                description: 'Read all users (admin)',
                resource: PermissionResource.USERS,
                action: PermissionAction.READ,
                scope: PermissionScope.ANY,
                isActive: true,
            },
            {
                name: 'users:update:any',
                description: 'Update any user (admin)',
                resource: PermissionResource.USERS,
                action: PermissionAction.UPDATE,
                scope: PermissionScope.ANY,
                isActive: true,
            },
            {
                name: 'users:delete:any',
                description: 'Delete any user (admin)',
                resource: PermissionResource.USERS,
                action: PermissionAction.DELETE,
                scope: PermissionScope.ANY,
                isActive: true,
            },
            {
                name: 'users:manage:any',
                description: 'Manage all users (super admin)',
                resource: PermissionResource.USERS,
                action: PermissionAction.MANAGE,
                scope: PermissionScope.ANY,
                isActive: true,
            },

            // ===== MODERATION =====
            {
                name: 'moderation:access:any',
                description: 'Access moderation tools',
                resource: PermissionResource.MODERATION,
                action: PermissionAction.ACCESS,
                scope: PermissionScope.ANY,
                isActive: true,
            },
            {
                name: 'moderation:manage:any',
                description: 'Manage moderation (admin)',
                resource: PermissionResource.MODERATION,
                action: PermissionAction.MANAGE,
                scope: PermissionScope.ANY,
                isActive: true,
            },

            // ===== REVIEWS =====
            {
                name: 'reviews:read:any',
                description: 'Read all reviews',
                resource: PermissionResource.REVIEWS,
                action: PermissionAction.READ,
                scope: PermissionScope.ANY,
                isActive: true,
            },
            {
                name: 'reviews:create:own',
                description: 'Create own reviews',
                resource: PermissionResource.REVIEWS,
                action: PermissionAction.CREATE,
                scope: PermissionScope.OWN,
                isActive: true,
            },
            {
                name: 'reviews:update:own',
                description: 'Update own reviews',
                resource: PermissionResource.REVIEWS,
                action: PermissionAction.UPDATE,
                scope: PermissionScope.OWN,
                isActive: true,
            },
            {
                name: 'reviews:delete:own',
                description: 'Delete own reviews',
                resource: PermissionResource.REVIEWS,
                action: PermissionAction.DELETE,
                scope: PermissionScope.OWN,
                isActive: true,
            },

            // ===== AUDIT LOGS =====
            {
                name: 'audit_logs:read:any',
                description: 'Read audit logs (admin)',
                resource: PermissionResource.AUDIT_LOGS,
                action: PermissionAction.READ,
                scope: PermissionScope.ANY,
                isActive: true,
            },
        ];
    }

    /**
     * Get default role-permission mappings
     */
    private async getDefaultRolePermissions(): Promise<Record<UserRole, string[]>> {
        return {
            [UserRole.CONSUMER]: [
                'orders:read:own',
                'orders:create:own',
                'offers:read:any',
                'reviews:read:any',
                'reviews:create:own',
                'reviews:update:own',
                'reviews:delete:own',
                'establishments:read:any',
            ],

            [UserRole.MERCHANT]: [
                'orders:read:own',
                'orders:update:own',
                'orders:refund:own',
                'offers:read:own',
                'offers:create:own',
                'offers:update:own',
                'offers:delete:own',
                'establishments:read:own',
                'establishments:create:own',
                'establishments:update:own',
                'establishments:delete:own',
                'analytics:access:own',
                'analytics:export:own',
                'reviews:read:any',
            ],

            [UserRole.MODERATOR]: [
                'orders:read:any',
                'offers:read:any',
                'offers:approve:any',
                'establishments:read:any',
                'establishments:approve:any',
                'reviews:read:any',
                'reviews:update:own',
                'reviews:delete:own',
                'moderation:access:any',
                'users:read:any',
            ],

            [UserRole.ADMIN]: [
                // Full access to all resources
                'orders:read:any',
                'orders:update:any',
                'orders:delete:own',
                'orders:refund:any',
                'offers:read:any',
                'offers:update:any',
                'offers:approve:any',
                'establishments:read:any',
                'establishments:update:any',
                'establishments:approve:any',
                'analytics:access:any',
                'reviews:read:any',
                'users:read:any',
                'users:update:any',
                'users:delete:any',
                'users:manage:any',
                'moderation:access:any',
                'moderation:manage:any',
                'audit_logs:read:any',
            ],
        };
    }
}
