import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * Enterprise-Grade Permission Schema
 * Defines fine-grained, resource-level permissions
 *
 * Permission Naming Convention: `resource:action:scope`
 * - resource: orders, offers, establishments, users, analytics, etc.
 * - action: read, create, update, delete, approve, etc.
 * - scope: own (own resources), any (all resources), team, etc.
 *
 * Examples:
 * - "orders:read:own" - Read own orders
 * - "orders:read:any" - Read all orders (admin)
 * - "orders:update:own" - Update own orders
 * - "establishments:approve:any" - Approve any establishment (admin)
 * - "analytics:access:own" - Access own analytics
 * - "users:manage:any" - Manage all users (super admin)
 */

export type PermissionDocument = Permission & Document;

export enum PermissionResource {
    // Core Resources
    ORDERS = 'orders',
    OFFERS = 'offers',
    ESTABLISHMENTS = 'establishments',
    USERS = 'users',
    REVIEWS = 'reviews',
    PAYMENTS = 'payments',

    // Analytics & Reporting
    ANALYTICS = 'analytics',
    REPORTS = 'reports',
    DASHBOARD = 'dashboard',

    // System & Admin
    SETTINGS = 'settings',
    PERMISSIONS = 'permissions',
    ROLES = 'roles',
    AUDIT_LOGS = 'audit_logs',
    MODERATION = 'moderation',

    // Social & Communication
    NOTIFICATIONS = 'notifications',
    MESSAGES = 'messages',
    SOCIAL_FEED = 'social_feed',

    // Business Operations
    INVENTORY = 'inventory',
    LOYALTY = 'loyalty',
    DONATIONS = 'donations',
}

export enum PermissionAction {
    // CRUD Operations
    CREATE = 'create',
    READ = 'read',
    UPDATE = 'update',
    DELETE = 'delete',

    // Special Actions
    APPROVE = 'approve',
    REJECT = 'reject',
    SUSPEND = 'suspend',
    RESTORE = 'restore',
    EXPORT = 'export',
    IMPORT = 'import',

    // Management Actions
    MANAGE = 'manage',
    CONFIGURE = 'configure',
    ACCESS = 'access',
    ASSIGN = 'assign',

    // Financial Actions
    REFUND = 'refund',
    PROCESS_PAYMENT = 'process_payment',
}

export enum PermissionScope {
    OWN = 'own',           // Only own resources
    TEAM = 'team',         // Team/organization resources
    ANY = 'any',           // All resources (admin)
    TENANT = 'tenant',     // Within tenant boundary (merchant's establishment)
}

@Schema({ timestamps: true })
export class Permission {
    @Prop({ required: true, unique: true, index: true })
    name: string; // Format: "resource:action:scope"

    @Prop({ required: true })
    description: string;

    @Prop({ type: String, enum: PermissionResource, required: true })
    resource: PermissionResource;

    @Prop({ type: String, enum: PermissionAction, required: true })
    action: PermissionAction;

    @Prop({ type: String, enum: PermissionScope, required: true })
    scope: PermissionScope;

    @Prop({ default: true })
    isActive: boolean;

    @Prop({ type: [String], default: [] })
    conditions: string[]; // Optional conditions (JSON rules)

    @Prop({ type: Object })
    metadata?: Record<string, any>;

    createdAt?: Date;
    updatedAt?: Date;
}

export const PermissionSchema = SchemaFactory.createForClass(Permission);

// Compound index for efficient permission lookups
PermissionSchema.index({ resource: 1, action: 1, scope: 1 });
PermissionSchema.index({ isActive: 1 });
