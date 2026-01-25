# Admin Module Documentation

## Overview

The Admin module provides comprehensive administrative capabilities for the Too Fresh To Waste platform. It enables privileged users to manage users, establishments, system configurations, analytics, and audit logs through a secure, role-based access control system.

**Base Route:** `/admin/*`

**Authentication:** JWT Bearer Token + AdminOnlyGuard

**Key Features:**
- User and establishment management
- Platform analytics and reporting
- System configuration with versioning
- Comprehensive audit logging
- Bulk operations support
- Export/import capabilities

---

## Module Structure

```
admin/
├── admin.module.ts              # Module definition with all dependencies
├── controllers/
│   ├── admin-analytics.controller.ts
│   ├── establishment-management.controller.ts
│   ├── system-config.controller.ts
│   └── user-management.controller.ts
├── services/
│   ├── admin-analytics.service.ts
│   ├── admin-audit.service.ts
│   ├── establishment-management.service.ts
│   ├── system-config.service.ts
│   └── user-management.service.ts
├── guards/
│   └── admin-only.guard.ts
├── decorators/
│   └── (custom parameter decorators)
├── dto/
│   ├── admin-analytics.dto.ts
│   ├── establishment-management.dto.ts
│   ├── system-config.dto.ts
│   └── user-management.dto.ts
├── schemas/
│   ├── admin-audit-log.schema.ts
│   └── system-config.schema.ts
└── interfaces/
    └── admin-analytics.interface.ts
```

---

## Core Components

### 1. Admin Analytics Service

**Purpose:** Provides comprehensive platform analytics and business intelligence.

**Key Methods:**
- `getPlatformAnalytics(days: number)` - Aggregate platform metrics
- `getUserAnalytics()` - User statistics (total, active, new, retention)
- `getEstablishmentAnalytics()` - Establishment performance metrics
- `getOrderAnalytics()` - Order trends and completion rates
- `getOfferAnalytics()` - Offer performance and waste reduction impact
- `getRevenueAnalytics()` - Financial metrics and growth rates

**Analytics Categories:**
- **User Metrics**: Total users, active users, new signups, retention rates
- **Establishment Metrics**: Approval status, ratings, top performers
- **Order Metrics**: Completion rates, trends, average order value
- **Offer Metrics**: Active/expired/sold offers, discount analysis
- **Revenue Metrics**: Total revenue, commissions, growth rates
- **Waste Reduction**: Kg saved, meals saved, CO2 reduction

**Use Case:**
```typescript
const analytics = await adminAnalyticsService.getPlatformAnalytics(30);
console.log(analytics.revenue.totalRevenue);
console.log(analytics.offers.wasteReductionImpact.totalKgSaved);
```

---

### 2. Admin Audit Service

**Purpose:** Comprehensive audit logging for all administrative actions with automatic sensitive data sanitization.

**Key Methods:**
- `createAuditLog(data: CreateAuditLogData)` - Log single action
- `logUserAction(params)` - Convenience method for user actions
- `logEstablishmentAction(params)` - Log establishment actions
- `logSystemAction(params)` - Log system configuration changes
- `logBatchActions(actions[])` - Bulk audit logging
- `getAuditLogs(query)` - Retrieve logs with pagination and filtering
- `getAuditLogsByAdmin(adminId)` - Admin activity history
- `getAuditLogsByTarget(targetType, targetId)` - Entity change history
- `getRecentActivity(hours)` - Recent administrative activity
- `getAuditStatistics(days)` - Statistical analysis of admin actions
- `exportAuditLogs(startDate, endDate, format)` - Export as JSON or CSV
- `deleteOldAuditLogs(olderThanDays)` - Archive management

**Tracked Actions:**
```typescript
enum AdminAction {
  // User Actions
  USER_CREATED, USER_UPDATED, USER_SUSPENDED,
  USER_BLOCKED, USER_ACTIVATED, USER_DELETED,

  // Establishment Actions
  ESTABLISHMENT_APPROVED, ESTABLISHMENT_REJECTED,
  ESTABLISHMENT_SUSPENDED, ESTABLISHMENT_REACTIVATED,

  // Order Actions
  ORDER_CANCELLED, ORDER_REFUNDED, ORDER_UPDATED,

  // Review Actions
  REVIEW_FLAGGED, REVIEW_APPROVED, REVIEW_DELETED,

  // System Actions
  SYSTEM_CONFIG_UPDATED, BULK_OPERATION, DATA_EXPORT
}
```

**Security Features:**
- Automatic sanitization of sensitive fields (passwords, tokens, keys)
- IP address and user agent tracking
- Immutable audit trail
- Support for rollback via previous/new value tracking

**Use Case:**
```typescript
await adminAuditService.logUserAction({
  adminId: admin.id,
  adminEmail: admin.email,
  action: AdminAction.USER_SUSPENDED,
  userId: targetUser.id,
  previousValue: { status: 'active' },
  newValue: { status: 'suspended' },
  reason: 'Terms of service violation',
  ipAddress: req.ip,
  userAgent: req.headers['user-agent']
});
```

---

### 3. System Config Service

**Purpose:** Manage platform-wide configuration with versioning, validation, and rollback capabilities.

**Configuration Categories:**

#### Platform Settings
- `maintenanceMode` - Enable/disable platform access
- `allowNewRegistrations` - Control user signups
- `requireEstablishmentApproval` - Manual or auto-approval
- `maxOffersPerEstablishment` - Offer creation limits
- `defaultOfferExpirationHours` - Offer lifetime
- `minOrderValue` / `maxOrderValue` - Order constraints
- `platformCommissionRate` - Revenue share (0-50%)
- `autoRefundTimeoutHours` - Automatic refund window

#### Notification Settings
- `emailEnabled` / `smsEnabled` / `pushNotificationsEnabled`
- `adminEmailAlerts` - Alert admins of critical events
- `orderConfirmationEnabled` - Customer order confirmations
- `orderReminderEnabled` - Pickup reminders
- `promotionalEmailsEnabled` - Marketing communications

#### Security Settings
- `maxLoginAttempts` (3-10) - Login attempt limit
- `loginAttemptWindow` (minutes) - Time window for attempts
- `accountLockoutDuration` (minutes) - Lockout period
- `passwordMinLength` (6-128) - Password requirements
- `passwordRequireSpecialChar` / `passwordRequireNumbers` / `passwordRequireUppercase`
- `sessionTimeout` (30-1440 minutes) - Session duration
- `twoFactorAuthRequired` - Enforce 2FA

#### Payment Settings
- `stripeEnabled` / `paypalEnabled` - Payment providers
- `minimumPayoutAmount` - Merchant payout threshold
- `payoutFrequency` - daily / weekly / monthly
- `automaticPayouts` - Auto or manual payouts
- `refundProcessingDays` - Refund processing time

**Key Methods:**
- `getSystemConfig()` - Get active config (cached 5 minutes)
- `updateSystemConfig(dto, adminId, ...)` - Create new config version
- `getConfigHistory(limit)` - View version history
- `rollbackToVersion(version, adminId, ...)` - Revert to previous config
- `exportConfig(version?)` - Export as JSON
- `importConfig(data, adminId, ...)` - Import configuration
- `validateConfigImport(data)` - Pre-import validation

**Validation Rules:**
- Commission rate: 0-50% (warning >25%)
- Min order < max order
- Offer expiration: 1-168 hours (1 week)
- Login attempts: 3-10
- Password length: 6-128 characters (warning <8)
- Session timeout: 30-1440 minutes (24 hours)
- At least one payment provider enabled
- Minimum payout ≥ 1
- Refund processing: 1-30 days

**Versioning:**
- Semantic versioning (major.minor.patch)
- Previous versions retained but marked inactive
- Full audit trail via AdminAuditService
- Rollback creates new version with "-rollback" suffix

**Use Case:**
```typescript
const currentConfig = await systemConfigService.getSystemConfig();

await systemConfigService.updateSystemConfig(
  {
    securitySettings: {
      maxLoginAttempts: 5,
      accountLockoutDuration: 30
    },
    description: 'Increase security after bot attacks'
  },
  adminId,
  adminEmail,
  ipAddress,
  userAgent
);
```

---

### 4. User Management Service

**Purpose:** Administrative user operations including status changes, bulk actions, and user analytics.

**Key Methods:**
- `getUserOverview()` - User statistics dashboard
- `searchUsers(query)` - Search/filter with pagination
- `getUserById(userId)` - Detailed user information
- `getUserActivity(userId)` - User activity history
- `updateUserStatus(userId, status, adminId, ...)` - Change user status
- `suspendUser(userId, reason, adminId, ...)` - Suspend user account
- `activateUser(userId, adminId, ...)` - Reactivate user
- `blockUser(userId, reason, adminId, ...)` - Block user permanently
- `deleteUser(userId, adminId, ...)` - Soft delete user
- `performBulkAction(dto, adminId, ...)` - Bulk operations

**User Status Transitions:**
- `pending` → `active` (email verification)
- `active` → `suspended` (temporary restriction)
- `suspended` → `active` (reactivation)
- `active` → `blocked` (permanent ban)

**Bulk Actions:**
- Suspend multiple users
- Activate multiple users
- Block multiple users
- Reason required for accountability

**Search Filters:**
- Text search (name, email)
- Role filter (consumer, merchant, admin)
- Status filter (pending, active, suspended, blocked)
- Pagination (page, limit)

---

### 5. Establishment Management Service

**Purpose:** Manage merchant establishments including approval workflows, status changes, and performance tracking.

**Key Methods:**
- `getEstablishmentOverview()` - Dashboard statistics
- `searchEstablishments(query)` - Search/filter with pagination
- `getEstablishmentById(id)` - Detailed establishment info
- `approveEstablishment(id, adminId, ...)` - Approve pending establishment
- `rejectEstablishment(id, reason, adminId, ...)` - Reject establishment
- `suspendEstablishment(id, reason, adminId, ...)` - Suspend operations
- `reactivateEstablishment(id, adminId, ...)` - Reactivate suspended
- `updateEstablishmentDetails(id, dto, adminId, ...)` - Modify details
- `performBulkAction(dto, adminId, ...)` - Bulk operations

**Establishment Statuses:**
- `pending` - Awaiting admin approval
- `approved` - Active and operational
- `rejected` - Approval denied
- `suspended` - Temporarily restricted
- `blocked` - Permanently banned

**Search Filters:**
- Text search (name, description)
- Status filter
- Type filter (restaurant, bakery, grocery, etc.)
- Pagination

---

### 6. Admin Only Guard

**Purpose:** Authorization guard ensuring only users with ADMIN role can access admin endpoints.

**Implementation:**
```typescript
@Injectable()
export class AdminOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
```

**Usage:** Always combined with `JwtAuthGuard`
```typescript
@Controller('admin/users')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
export class UserManagementController { ... }
```

---

## API Endpoints

### Analytics
- `GET /admin/analytics/platform` - Platform-wide analytics
- `GET /admin/analytics/users` - User analytics
- `GET /admin/analytics/establishments` - Establishment analytics
- `GET /admin/analytics/orders` - Order analytics
- `GET /admin/analytics/offers` - Offer analytics
- `GET /admin/analytics/revenue` - Revenue analytics

### Audit Logs
- `GET /admin/audit-logs` - List audit logs (paginated, filterable)
- `GET /admin/audit-logs/admin/:adminId` - Admin activity history
- `GET /admin/audit-logs/target/:targetType/:targetId` - Entity history
- `GET /admin/audit-logs/recent` - Recent activity
- `GET /admin/audit-logs/statistics` - Statistical analysis
- `GET /admin/audit-logs/export` - Export logs (JSON/CSV)

### System Configuration
- `GET /admin/system-config` - Get active configuration
- `PATCH /admin/system-config` - Update configuration
- `GET /admin/system-config/history` - Version history
- `POST /admin/system-config/rollback/:version` - Rollback to version
- `GET /admin/system-config/export` - Export config
- `POST /admin/system-config/import` - Import config

### User Management
- `GET /admin/users/overview` - User statistics
- `GET /admin/users/search` - Search users
- `GET /admin/users/:userId` - User details
- `GET /admin/users/:userId/activity` - User activity
- `PATCH /admin/users/:userId/status` - Update status
- `POST /admin/users/:userId/suspend` - Suspend user
- `POST /admin/users/:userId/activate` - Activate user
- `POST /admin/users/:userId/block` - Block user
- `DELETE /admin/users/:userId` - Delete user
- `POST /admin/users/bulk-action` - Bulk operations

### Establishment Management
- `GET /admin/establishments/overview` - Establishment statistics
- `GET /admin/establishments/search` - Search establishments
- `GET /admin/establishments/:id` - Establishment details
- `POST /admin/establishments/:id/approve` - Approve establishment
- `POST /admin/establishments/:id/reject` - Reject establishment
- `POST /admin/establishments/:id/suspend` - Suspend establishment
- `POST /admin/establishments/:id/reactivate` - Reactivate establishment
- `PATCH /admin/establishments/:id` - Update details
- `POST /admin/establishments/bulk-action` - Bulk operations

---

## Database Schemas

### AdminAuditLog
```typescript
{
  adminId: ObjectId,           // Reference to admin user
  adminEmail: string,          // Admin email for readability
  action: AdminAction,         // Enum of admin actions
  targetType: string,          // user | establishment | order | review | offer | system
  targetId?: string,           // ID of affected entity
  previousValue?: Object,      // State before action (sanitized)
  newValue?: Object,           // State after action (sanitized)
  reason?: string,             // Justification for action
  ipAddress: string,           // Request IP
  userAgent: string,           // Request user agent
  metadata?: Object,           // Additional context
  timestamp: Date              // Action timestamp
}
```

**Indexes:**
- `adminId` (ascending)
- `action` (ascending)
- `targetType` + `targetId` (compound)
- `timestamp` (descending) - for time-based queries

### SystemConfig
```typescript
{
  configKey: string,           // 'platform_config' (unique per version)
  version: string,             // Semantic version (1.2.3)
  platformSettings: {
    maintenanceMode: boolean,
    allowNewRegistrations: boolean,
    requireEstablishmentApproval: boolean,
    maxOffersPerEstablishment: number,
    defaultOfferExpirationHours: number,
    minOrderValue: number,
    maxOrderValue: number,
    platformCommissionRate: number,
    autoRefundTimeoutHours: number
  },
  notificationSettings: { ... },
  securitySettings: { ... },
  paymentSettings: { ... },
  description?: string,        // Change description
  isActive: boolean,           // Only one active config at a time
  lastModifiedBy: string,      // Admin email
  createdBy: string,           // Admin email or 'system'
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `configKey` + `isActive` (compound, unique)
- `version` (ascending)
- `createdAt` (descending)

---

## Security Considerations

### Authorization
- All admin endpoints protected by `JwtAuthGuard` + `AdminOnlyGuard`
- User must have `UserRole.ADMIN`
- JWT token validated on every request

### Audit Trail
- Every administrative action logged automatically
- Immutable audit logs for compliance
- IP and user agent tracking for security
- Sensitive data sanitized (passwords, tokens, keys)

### Input Validation
- All DTOs validated with `class-validator`
- System config changes validated before applying
- Bulk operations limited to prevent abuse

### Rate Limiting
- Admin endpoints subject to authenticated rate limits
- 200 requests per minute for authenticated users
- Additional protection against brute force

---

## Usage Examples

### Check User Activity
```typescript
// Get user details and activity
const user = await userManagementService.getUserById(userId);
const activity = await userManagementService.getUserActivity(userId);

// Suspend user with reason
await userManagementService.suspendUser(
  userId,
  'Spam/abusive behavior',
  adminId,
  adminEmail,
  ipAddress,
  userAgent
);
```

### Approve Establishment
```typescript
// Review pending establishment
const establishment = await establishmentManagementService
  .getEstablishmentById(establishmentId);

// Approve
await establishmentManagementService.approveEstablishment(
  establishmentId,
  adminId,
  adminEmail,
  ipAddress,
  userAgent
);
```

### Update System Configuration
```typescript
// Get current config
const config = await systemConfigService.getSystemConfig();

// Update security settings
await systemConfigService.updateSystemConfig(
  {
    securitySettings: {
      maxLoginAttempts: 5,
      accountLockoutDuration: 30
    },
    description: 'Strengthened security after incident'
  },
  adminId,
  adminEmail,
  ipAddress,
  userAgent
);
```

### Export Audit Logs
```typescript
// Get audit logs for compliance report
const startDate = new Date('2024-01-01');
const endDate = new Date('2024-12-31');

const csvData = await adminAuditService.exportAuditLogs(
  startDate,
  endDate,
  'csv'
);

// Save to file or send to admin
```

### Bulk Operations
```typescript
// Suspend multiple spam accounts
await userManagementService.performBulkAction(
  {
    action: 'suspend',
    userIds: ['user1', 'user2', 'user3'],
    reason: 'Coordinated spam campaign'
  },
  adminId,
  adminEmail,
  ipAddress,
  userAgent
);
```

---

## Best Practices

### 1. Always Provide Reasons
When suspending, blocking, or rejecting entities, always provide a clear reason for accountability and transparency.

### 2. Use Audit Logs
Review audit logs regularly to:
- Monitor admin activity
- Investigate suspicious behavior
- Generate compliance reports
- Track configuration changes

### 3. Test Configuration Changes
Before applying system config changes in production:
- Export current configuration
- Test changes in staging environment
- Use rollback if issues occur

### 4. Paginate Large Queries
Always use pagination when retrieving user/establishment lists to avoid performance issues.

### 5. Monitor Analytics
Regularly review platform analytics to:
- Identify growth trends
- Detect anomalies
- Make data-driven decisions
- Track waste reduction impact

---

## Related Modules

- **Auth Module** (`src/auth/`) - JWT authentication, role verification
- **Users Module** (`src/users/`) - User schema and base operations
- **Establishments Module** (`src/establishments/`) - Establishment schema
- **Orders Module** (`src/orders/`) - Order tracking
- **Offers Module** (`src/offers/`) - Offer management
- **Common Module** (`src/common/`) - Shared guards, filters, interceptors

---

## Maintenance & Operations

### Audit Log Retention
Run periodic cleanup to manage database size:
```typescript
// Delete audit logs older than 2 years
const deletedCount = await adminAuditService.deleteOldAuditLogs(730);
```

### Configuration Backups
Regularly export system configuration for disaster recovery:
```bash
# Via API or scheduled job
GET /admin/system-config/export
```

### Performance Monitoring
- Audit log queries indexed on timestamp
- System config cached for 5 minutes
- Analytics aggregations optimized with MongoDB pipelines

---

## Troubleshooting

### Issue: Audit logs not appearing
- Verify AdminAuditService is injected in service
- Check that audit logging methods are called after successful operations
- Review MongoDB connection and indexes

### Issue: Configuration changes not taking effect
- System config is cached (5 min TTL) - wait or restart
- Verify new config version created and marked `isActive`
- Check validation errors in logs

### Issue: AdminOnlyGuard returns 403
- Verify user JWT token is valid
- Check user.role === UserRole.ADMIN
- Ensure JwtAuthGuard runs before AdminOnlyGuard

---

## Future Enhancements

- Real-time admin notification system
- Advanced analytics dashboards
- Scheduled reports via email
- Role-based permissions beyond ADMIN (e.g., MODERATOR)
- Multi-factor authentication for admin operations
- Webhook support for external integrations
- Data retention policy automation

---

## Contact & Support

For issues, questions, or feature requests related to the admin module:
- Review audit logs for debugging
- Check NestJS logs for error details
- Consult main project documentation
- Review related module documentation

---

**Last Updated:** 2026-01-15
**Module Version:** 1.0.0
**Compatible Backend Version:** NestJS 11+ | Node.js 24+
