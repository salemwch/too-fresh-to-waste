# Moderation Module

## Overview

The Moderation module provides a comprehensive content moderation system for the Too Fresh To Waste platform. It enables users to report inappropriate content, moderators to review and take action on reports, and admins to manage the entire moderation workflow with full audit trails.

**Primary responsibilities:**
- User-generated content reporting (users, establishments, offers, orders, reviews)
- Moderation action management (warnings, suspensions, bans, content removal)
- Comprehensive audit logging with 1-year TTL
- Automated task processing (expired actions, daily summaries)
- Role-based access control (Admin, Moderator)

**Key features:**
- Duplicate report prevention (24-hour window)
- Auto-prioritization based on report reason
- Rate limiting to prevent abuse
- Moderation dashboard with statistics
- Audit trail for all actions
- Scheduled tasks for cleanup and reporting

---

## Architecture

### Module Structure

```
src/moderation/
├── controllers/
│   ├── report.controller.ts                    # Report management endpoints
│   ├── moderation-action.controller.ts          # Moderation action endpoints
│   └── moderation-log.controller.ts             # Audit log endpoints
├── services/
│   ├── report.service.ts                        # Report business logic
│   ├── moderation-action.service.ts             # Action enforcement logic
│   └── moderation-log.service.ts                # Logging and statistics
├── schemas/
│   ├── report.schema.ts                         # Report data model
│   ├── moderation-action.schema.ts              # Action data model
│   └── moderation-log.schema.ts                 # Audit log data model
├── dtos/
│   ├── create-report.dto.ts                     # Report creation validation
│   ├── moderation-action.dto.ts                 # Action creation/update validation
│   └── report-query.dto.ts                      # Query parameter validation
├── guards/
│   ├── moderation-access.guard.ts               # Role-based access control
│   └── moderation-rate-limit.guard.ts           # Rate limiting guards
├── processors/
│   └── moderation-task.processor.ts             # Scheduled tasks (cron jobs)
├── index.ts                                      # Public exports
└── moderation.module.ts                          # Module definition
```

### Dependencies

- **MongoDB** (Mongoose) - Primary data store with compound indexes
- **Throttler** - Rate limiting (20 requests/minute for moderation actions)
- **Schedule** - Cron jobs for automated tasks
- **Winston** (via AppLoggerService) - Structured logging

---

## Data Models

### 1. Report Schema

Stores user-submitted reports of content violations.

**Enums:**
- `ReportType`: `user`, `establishment`, `offer`, `order`, `review`
- `ReportReason`: `spam`, `harassment`, `inappropriate_content`, `fraud`, `fake_profile`, `violation_of_terms`, `health_safety`, `copyright`, `other`
- `ReportStatus`: `pending`, `in_review`, `resolved`, `rejected`, `escalated`
- `ReportPriority`: `low`, `medium`, `high`, `critical`

**Key Fields:**
```typescript
{
  type: ReportType,                      // What is being reported
  targetId: ObjectId,                    // ID of reported entity
  reporterId: ObjectId,                  // User who submitted report
  reason: ReportReason,                  // Violation category
  description: string,                   // Detailed explanation (max 1000 chars)
  evidence: string[],                    // URLs to evidence (max 10)
  status: ReportStatus,                  // Current processing state
  priority: ReportPriority,              // Auto-assigned based on reason
  assignedToModerator?: ObjectId,        // Assigned moderator
  resolvedBy?: ObjectId,                 // Moderator who resolved
  resolvedAt?: Date,                     // Resolution timestamp
  resolutionNotes?: string,              // Resolution explanation
  moderationHistory: [{                  // Full audit trail
    action: string,
    performedBy: ObjectId,
    details?: string,
    timestamp: Date
  }],
  isAutoFlagged: boolean,                // System-detected vs user-reported
  autoFlaggedReason?: string,            // ML/rule reason
  metadata: object                       // Extensible data
}
```

**Indexes:**
- `{ status: 1, priority: -1, createdAt: -1 }` - Priority queue
- `{ assignedToModerator: 1, status: 1 }` - Moderator workload
- `{ targetId: 1, type: 1 }` - Entity lookup
- `{ reporterId: 1, createdAt: -1 }` - Reporter history

**File:** `schemas/report.schema.ts:1`

---

### 2. ModerationAction Schema

Tracks enforcement actions taken against users/content.

**Enums:**
- `ModerationActionType`: `warn`, `suspend`, `ban`, `delete_content`, `hide_content`, `restrict_features`, `require_verification`, `demonetize`
- `ModerationActionStatus`: `active`, `expired`, `revoked`, `appealed`
- `ModerationSeverity`: `minor`, `moderate`, `severe`, `critical`

**Key Fields:**
```typescript
{
  actionType: ModerationActionType,      // Enforcement action
  targetUserId: ObjectId,                // User affected
  moderatorId: ObjectId,                 // Moderator who took action
  relatedReportId?: ObjectId,            // Optional linked report
  severity: ModerationSeverity,          // Impact level
  reason: string,                        // Justification (max 1000 chars)
  details?: string,                      // Additional context
  status: ModerationActionStatus,        // Current state
  expiresAt?: Date,                      // Auto-expiry for temporary actions
  revokedAt?: Date,                      // Manual revocation timestamp
  revokedBy?: ObjectId,                  // Who revoked
  revocationReason?: string,             // Why revoked
  affectedFeatures: string[],            // Specific feature restrictions
  actionContext: {                       // Request metadata
    ipAddress?: string,
    userAgent?: string,
    location?: {
      country?: string,
      region?: string,
      city?: string
    }
  },
  isAppealable: boolean,                 // Can user appeal?
  isSystemAction: boolean,               // Automated vs manual
  auditTrail: [{                         // Change history
    field: string,
    oldValue?: string,
    newValue?: string,
    changedBy: ObjectId,
    changedAt: Date
  }],
  metadata: object
}
```

**Indexes:**
- `{ targetUserId: 1, status: 1, createdAt: -1 }` - User action history
- `{ moderatorId: 1, createdAt: -1 }` - Moderator activity
- `{ actionType: 1, severity: 1, status: 1 }` - Action analytics
- `{ relatedReportId: 1 }` - Report linkage (sparse)

**File:** `schemas/moderation-action.schema.ts:1`

---

### 3. ModerationLog Schema

Comprehensive audit log for all moderation activities (TTL: 1 year).

**Enums:**
- `LogLevel`: `DEBUG`, `INFO`, `WARN`, `ERROR`, `CRITICAL`
- `LogCategory`: `REPORT_HANDLING`, `ACTION_ENFORCEMENT`, `USER_MANAGEMENT`, `CONTENT_MODERATION`, `SYSTEM_EVENT`, `AUDIT_TRAIL`

**Key Fields:**
```typescript
{
  level: LogLevel,                       // Severity
  category: LogCategory,                 // Activity type
  action: string,                        // Action identifier
  description: string,                   // Human-readable description
  performedBy: string,                   // User ID or "system"
  targetId?: string,                     // Affected entity
  targetType?: string,                   // Entity type
  relatedReportId?: string,              // Linked report
  relatedActionId?: string,              // Linked action
  isAutomated: boolean,                  // Manual vs automated
  automationRule?: string,               // Rule/cron identifier
  requestContext?: {                     // Request metadata
    ipAddress?: string,
    userAgent?: string,
    endpoint?: string,
    method?: string
  },
  metadata: object,                      // Additional data
  tags: string[],                        // Searchable tags
  expiresAt: Date                        // TTL index (1 year)
}
```

**Indexes:**
- `{ level: 1, createdAt: -1 }` - Log filtering
- `{ performedBy: 1, createdAt: -1 }` - User activity
- `{ category: 1, action: 1, createdAt: -1 }` - Action tracking
- `{ relatedReportId: 1 }` - Report audit trail (sparse)
- `{ expiresAt: 1 }` - TTL automatic cleanup

**File:** `schemas/moderation-log.schema.ts:1`

---

## API Endpoints

All endpoints require JWT authentication (`@UseGuards(JwtAuthGuard)`).

### Reports API (`/api/v1/moderation/reports`)

#### 1. Create Report
```
POST /api/v1/moderation/reports
```
**Access:** All authenticated users
**Rate Limit:** `ModerationReportRateLimitGuard`
**Body:**
```json
{
  "type": "offer",
  "targetId": "507f1f77bcf86cd799439011",
  "reason": "fraud",
  "description": "This offer appears to be a scam...",
  "evidence": ["https://example.com/screenshot1.jpg"]
}
```
**Response:**
```json
{
  "success": true,
  "message": "Report submitted successfully",
  "data": {
    "id": "...",
    "type": "offer",
    "status": "pending",
    "priority": "high",
    "createdAt": "2026-01-15T10:30:00Z"
  }
}
```
**Business Rules:**
- Prevents duplicate reports within 24 hours
- Auto-assigns priority based on reason (fraud → high/critical)
- Logs creation with correlation ID

**File:** `controllers/report.controller.ts:47`

---

#### 2. Get Reports (Filtered)
```
GET /api/v1/moderation/reports?status=pending&priority=high&page=1&limit=20
```
**Access:** Admin, Moderator (`@UseGuards(ModerationAccessGuard)`)
**Query Parameters:**
- `type` - Filter by report type
- `status` - Filter by status
- `priority` - Filter by priority
- `reason` - Filter by reason
- `reporterId` - Filter by reporter
- `page` - Pagination (default: 1)
- `limit` - Items per page (default: 10)

**Response:**
```json
{
  "success": true,
  "message": "Reports retrieved successfully",
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```
**Authorization:**
- Moderators: See unassigned reports + own assigned reports
- Admins: See all reports

**File:** `controllers/report.controller.ts:90`

---

#### 3. Get Dashboard Statistics
```
GET /api/v1/moderation/reports/dashboard/stats
```
**Access:** Admin, Moderator
**Response:**
```json
{
  "success": true,
  "data": {
    "totalReports": 1200,
    "pendingReports": 45,
    "inReviewReports": 23,
    "resolvedReports": 1100,
    "priorityBreakdown": {
      "critical": 5,
      "high": 15,
      "medium": 20,
      "low": 5
    },
    "moderatorWorkload": {...},
    "averageResolutionTime": "2.5 hours"
  }
}
```

**File:** `controllers/report.controller.ts:120`

---

#### 4. Get Assigned Reports
```
GET /api/v1/moderation/reports/assigned-to-me?status=in_review
```
**Access:** Moderator, Admin
**Returns:** Reports assigned to current user

**File:** `controllers/report.controller.ts:137`

---

#### 5. Get Report by ID
```
GET /api/v1/moderation/reports/:id
```
**Access:** Report owner (reporter) OR Admin OR assigned Moderator
**Guard:** `ReportOwnershipGuard`

**File:** `controllers/report.controller.ts:154`

---

#### 6. Update Report
```
PATCH /api/v1/moderation/reports/:id
```
**Access:** Admin OR assigned Moderator
**Body:**
```json
{
  "status": "resolved",
  "resolutionNotes": "Verified and removed fraudulent offer",
  "priority": "critical"
}
```
**Audit:** All changes logged to `moderationHistory`

**File:** `controllers/report.controller.ts:179`

---

#### 7. Assign Report to Moderator
```
POST /api/v1/moderation/reports/:id/assign
```
**Access:** Admin only (`@UseGuards(AdminOnlyModerationGuard)`)
**Body:**
```json
{
  "moderatorId": "507f1f77bcf86cd799439011"
}
```

**File:** `controllers/report.controller.ts:218`

---

### Moderation Actions API (`/api/v1/moderation/actions`)

**Controllers:** `moderation-action.controller.ts`
**Endpoints:**
- `POST /actions` - Create moderation action (warn, suspend, ban, etc.)
- `GET /actions` - List actions with filters
- `GET /actions/:id` - Get action details
- `PATCH /actions/:id` - Update action (revoke, extend)
- `POST /actions/bulk` - Bulk actions (admin only)

**Rate Limit:** `ModerationActionRateLimitGuard`

---

### Moderation Logs API (`/api/v1/moderation/logs`)

**Controller:** `moderation-log.controller.ts`
**Endpoints:**
- `GET /logs` - Query audit logs
- `GET /logs/statistics` - Aggregated statistics
- `GET /logs/export` - Export logs (CSV/JSON)

---

## Security & Guards

### 1. ModerationAccessGuard

**Purpose:** Ensures only Admins and Moderators can access moderation endpoints.

**Logic:**
```typescript
allowedRoles = [UserRole.ADMIN, UserRole.MODERATOR];
if (!allowedRoles.includes(user.role)) {
  throw ForbiddenException('Admin or Moderator privileges required');
}
```

**File:** `guards/moderation-access.guard.ts:7`

---

### 2. AdminOnlyModerationGuard

**Purpose:** Restricts sensitive operations to Admins only.

**Used for:**
- Assigning reports to moderators
- Bulk moderation actions
- Revoking other moderators' actions

**File:** `guards/moderation-access.guard.ts:34`

---

### 3. ReportOwnershipGuard

**Purpose:** Ensures moderators can only access their assigned reports.

**Authorization Flow:**
1. Admins → Full access
2. Moderators → Own assigned reports + unassigned reports
3. Other roles → Reject

**Note:** Detailed ownership check happens in service layer.

**File:** `guards/moderation-access.guard.ts:56`

---

### 4. Rate Limiting Guards

**ModerationReportRateLimitGuard:**
- Prevents report spam
- Custom rate limit per user session

**ModerationActionRateLimitGuard:**
- Throttles moderation actions
- Module-level: 20 requests/minute

**File:** `guards/moderation-rate-limit.guard.ts`

---

## Automated Tasks

### Processor: `ModerationTaskProcessor`

**File:** `processors/moderation-task.processor.ts:8`

#### 1. Process Expired Actions
```typescript
@Cron(CronExpression.EVERY_HOUR)
```
**Runs:** Every hour
**Function:** Marks expired temporary suspensions/bans as `expired`
**Logging:** Logs cleanup count to `ModerationLog`

**File:** `processors/moderation-task.processor.ts:19`

---

#### 2. Cleanup Old Logs
```typescript
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
```
**Runs:** Daily at 00:00
**Function:** Placeholder (TTL index auto-deletes logs after 1 year)

**File:** `processors/moderation-task.processor.ts:65`

---

#### 3. Generate Daily Summary
```typescript
@Cron('0 1 * * *')
```
**Runs:** Daily at 01:00
**Function:** Aggregates previous day's moderation statistics
**Output:** Stored as `ModerationLog` with category `SYSTEM_EVENT`

**Includes:**
- Total reports/actions
- Resolution times
- Priority distribution
- Moderator activity

**File:** `processors/moderation-task.processor.ts:83`

---

## Workflow Examples

### Scenario 1: User Reports Fraudulent Offer

1. **User submits report**
   ```bash
   POST /api/v1/moderation/reports
   {
     "type": "offer",
     "targetId": "60d5ec49f1b2c8b1f8e4e1a1",
     "reason": "fraud",
     "description": "Seller is charging but not providing items"
   }
   ```

2. **System validates and stores**
   - Checks for duplicate report (24h window)
   - Auto-assigns priority: `high` (fraud)
   - Status: `pending`
   - Logs creation event

3. **Admin reviews dashboard**
   ```bash
   GET /api/v1/moderation/reports/dashboard/stats
   ```
   - Sees 1 critical report

4. **Admin assigns to moderator**
   ```bash
   POST /api/v1/moderation/reports/:id/assign
   { "moderatorId": "60d5ec49f1b2c8b1f8e4e1a2" }
   ```

5. **Moderator investigates**
   - Reviews evidence
   - Checks offer history
   - Updates status: `in_review`

6. **Moderator takes action**
   ```bash
   POST /api/v1/moderation/actions
   {
     "actionType": "hide_content",
     "targetUserId": "60d5ec49f1b2c8b1f8e4e1a3",
     "relatedReportId": "...",
     "severity": "severe",
     "reason": "Confirmed fraudulent offer based on evidence",
     "affectedFeatures": ["offer_creation"]
   }
   ```

7. **Moderator resolves report**
   ```bash
   PATCH /api/v1/moderation/reports/:id
   {
     "status": "resolved",
     "resolutionNotes": "Offer hidden, user warned"
   }
   ```

8. **Audit trail generated**
   - All actions logged to `ModerationLog`
   - Notification sent to reporter
   - Statistics updated

---

### Scenario 2: Automated Cleanup

**Daily at 01:00:**
```
[ModerationTaskProcessor] Expired actions check
→ Finds 5 suspensions that expired
→ Updates status: active → expired
→ Logs cleanup event
→ Generates daily summary
```

---

## Configuration

### Environment Variables

None required - uses shared MongoDB and Redis connections from AppModule.

### Rate Limiting

**Module-level throttle:**
```typescript
ThrottlerModule.forRoot([{
  ttl: 60000,  // 1 minute
  limit: 20,   // 20 requests
}])
```

Configured in `moderation.module.ts:39`

---

## Integration Points

### Dependencies on Other Modules

1. **Auth Module**
   - `JwtAuthGuard` - Authentication
   - `UserRole` enum - Authorization

2. **Users Module**
   - User schema for role validation
   - User references in reports/actions

3. **Common Module**
   - `LoggingInterceptor` - Request logging
   - `@CurrentUser()` decorator - User extraction
   - `@IpAddress()` decorator - IP tracking

4. **Notifications Module** (potential)
   - Send notifications on report resolution
   - Alert users of moderation actions

---

## Exported Services

Available for use in other modules:

```typescript
export {
  ReportService,              // Report CRUD + business logic
  ModerationActionService,    // Action enforcement
  ModerationLogService,       // Audit logging + statistics
  ModerationAccessGuard,      // Access control
  AdminOnlyModerationGuard,   // Admin-only operations
}
```

**File:** `index.ts:1`

---

## Testing Recommendations

### Unit Tests

**Priority test cases:**
1. **ReportService**
   - Duplicate report prevention
   - Priority auto-assignment logic
   - Role-based query filtering

2. **ModerationActionService**
   - Expiry processing
   - Revocation audit trail
   - Bulk action validation

3. **Guards**
   - Role-based access control
   - Ownership validation
   - Rate limiting enforcement

### Integration Tests

**Key scenarios:**
1. End-to-end report workflow (create → assign → resolve)
2. Moderation action lifecycle (create → active → expired/revoked)
3. Dashboard statistics accuracy
4. Automated task execution

### E2E Tests

**Critical paths:**
```bash
# Report submission and resolution
POST /reports → GET /reports → PATCH /reports/:id

# Moderation action enforcement
POST /actions → Verify user restrictions → GET /actions (status check)
```

---

## Monitoring & Alerts

### Key Metrics to Track

1. **Volume Metrics**
   - Reports created per day
   - Actions taken per moderator
   - Average resolution time

2. **Quality Metrics**
   - Percentage of escalated reports
   - Action appeal rate
   - False positive rate (rejected reports)

3. **Performance Metrics**
   - Query response times (indexed lookups)
   - Cron job execution time
   - Rate limit hits

### Alerting Thresholds

- **Critical:** >50 unassigned high-priority reports
- **Warning:** Average resolution time >24 hours
- **Info:** Daily summary generation failure

---

## Known Limitations

1. **No appeal workflow** - `isAppealable` field exists but no appeal API yet
2. **Manual moderator assignment** - No auto-assignment algorithm
3. **Basic rate limiting** - No per-user or IP-based sophisticated throttling
4. **No ML auto-flagging** - `isAutoFlagged` field prepared but not integrated
5. **Evidence storage** - URLs only, no direct file upload support

---

## Future Enhancements

1. **Appeal System**
   - User-facing appeal submission
   - Appeal review workflow
   - Escalation to admin

2. **Smart Assignment**
   - Auto-assign reports based on moderator workload
   - Specialty-based routing (e.g., fraud expert)

3. **ML Integration**
   - Auto-flag suspicious content
   - Priority prediction
   - Pattern detection (repeat offenders)

4. **Reporting Dashboard**
   - Real-time charts (Chart.js/D3)
   - Moderator performance metrics
   - Trend analysis

5. **Webhooks**
   - External system notifications
   - Integration with compliance tools

---

## References

- **Module Definition:** `moderation.module.ts:29`
- **Swagger Docs:** `http://localhost:3000/api/v1/api-docs#/Moderation`
- **Related Docs:**
  - Backend Architecture: `apps/food-waste-backend/CLAUDE.md`
  - Authentication: `src/auth/README.md`
  - User Roles: `src/users/schemas/user.schema.ts`

---

**Last Updated:** 2026-01-15
**Module Version:** 1.0.0
**Maintainer:** Backend Team
