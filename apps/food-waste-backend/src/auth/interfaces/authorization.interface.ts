import type { Types } from 'mongoose';
import type { UserRole } from 'src/common/enums/user.enum';

/**
 * Authorization Context
 * Contains all information needed for authorization decisions
 */
export interface AuthorizationContext {
  // User Information
  userId: string | Types.ObjectId;
  role: UserRole;
  permissions?: string[]; // Cached user permissions

  // Tenant/Merchant Context
  tenantId?: string | Types.ObjectId; // Merchant's establishment ID or user's tenant
  merchantId?: string | Types.ObjectId;

  // Resource Information
  resource?: {
    type: string;
    id?: string | Types.ObjectId;
    ownerId?: string | Types.ObjectId;
    merchantId?: string | Types.ObjectId;
    establishmentId?: string | Types.ObjectId;
    metadata?: Record<string, unknown>;
  };

  // Request Context
  ipAddress?: string;
  userAgent?: string;
  timestamp?: Date;

  // Additional Attributes for ABAC
  attributes?: Record<string, unknown>;
}

/**
 * Authorization Policy
 * Defines rules for resource access
 */
export interface AuthorizationPolicy {
  name: string;
  description: string;
  effect: 'allow' | 'deny';

  // Conditions (all must match)
  conditions: {
    roles?: UserRole[];
    permissions?: string[];

    // Ownership checks
    requiresOwnership?: boolean;
    allowedOwnerFields?: string[]; // ['ownerId', 'merchantId', 'customerId']

    // Tenant isolation
    requiresTenantMatch?: boolean;
    tenantFields?: string[]; // ['merchantId', 'establishmentId']

    // Time-based
    validFrom?: Date;
    validUntil?: Date;
    allowedHours?: { start: string; end: string };
    allowedDays?: string[];

    // Resource state
    allowedStatuses?: string[];
    forbiddenStatuses?: string[];

    // Custom conditions (evaluated as JavaScript)
    customConditions?: string[];
  };

  priority?: number; // Higher priority policies are evaluated first
}

/**
 * Authorization Result
 */
export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  matchedPolicy?: string;
  missingPermissions?: string[];
  deniedBy?: string;
}

/**
 * Tenant Context
 * Injected into requests for automatic tenant isolation
 */
export interface TenantContext {
  tenantId: string | Types.ObjectId;
  tenantType: 'merchant' | 'establishment' | 'organization';
  userId: string | Types.ObjectId;
  role: UserRole;
  establishmentIds?: (string | Types.ObjectId)[]; // For merchants with multiple establishments
}

/**
 * Resource Ownership Check
 */
export interface OwnershipCheck {
  resourceId: string | Types.ObjectId;
  resourceType: string;
  ownerIdField: string; // Field name to check (e.g., 'ownerId', 'merchantId', 'customerId')
  expectedOwnerId: string | Types.ObjectId;
}

/**
 * Permission Check Request
 */
export interface PermissionCheckRequest {
  userId: string | Types.ObjectId;
  role: UserRole;
  requiredPermissions: string[]; // Format: "resource:action:scope"
  requireAll?: boolean; // If true, user must have ALL permissions; if false, ANY permission
}

/**
 * Audit Log Entry for Authorization
 */
export interface AuthorizationAuditLog {
  userId: string | Types.ObjectId;
  action: string;
  resource: {
    type: string;
    id?: string | Types.ObjectId;
  };
  result: 'allowed' | 'denied';
  reason: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  context?: Record<string, unknown>;
}
