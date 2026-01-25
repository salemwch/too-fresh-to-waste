# Analytics Module Documentation

## Overview

The Analytics Module provides comprehensive business intelligence, data analytics, and reporting capabilities for the Too Fresh To Waste platform. It delivers real-time metrics, customizable dashboards, predictive analytics, and sustainability impact tracking.

---

## Architecture

### Directory Structure

```
analytics/
├── analytics.module.ts              # Main analytics module
├── index.ts                         # Public API exports
├── README.md                        # User-facing documentation
├── analytics.md                     # Technical documentation (this file)
│
├── constants/
│   └── sustainability.constants.ts  # CO2, water, waste reduction factors
│
├── controllers/
│   ├── analytics.controller.ts      # Business metrics endpoints
│   └── dashboard.controller.ts      # Dashboard CRUD operations
│
├── dto/
│   └── analytics.dto.ts             # Request/response DTOs
│
├── interfaces/
│   └── analytics.interface.ts       # TypeScript interfaces
│
├── schemas/
│   ├── alert-rule.schema.ts         # Alert configuration and history
│   ├── analytics-cache.schema.ts    # Performance caching layer
│   └── dashboard-config.schema.ts   # User dashboard configurations
│
├── services/
│   ├── analytics.service.ts         # Core analytics calculations
│   └── dashboard.service.ts         # Dashboard management
│
└── utils/
    └── analytics.util.ts            # Helper functions and utilities
```

---

## Module Details

### AnalyticsModule

**File**: `analytics.module.ts`

**Purpose**: Core analytics module providing comprehensive business metrics, customizable dashboards, real-time monitoring, and sustainability tracking.

**Imports**:
- `ConfigModule` - Environment configuration
- `EventEmitterModule` - Event-driven architecture
- `MongooseModule` - MongoDB integration with schemas:
  - External: User, Establishment, Offer, Order, Payment
  - Internal: AnalyticsCache, DashboardConfig, AlertRule, Alert

**Providers**:
- `AnalyticsService` - Core analytics calculations
- `DashboardService` - Dashboard CRUD and templates
- `AppLoggerService` - Structured logging

**Controllers**:
- `AnalyticsController` - Business metrics endpoints
- `DashboardController` - Dashboard management

**Exports**:
- `AnalyticsService`, `DashboardService` for use in other modules

**Initialization**:
- Automatically creates default dashboard templates on startup via `initializeDefaultTemplates()`

---

## Core Services

### AnalyticsService

**File**: `services/analytics.service.ts`

**Responsibilities**:
- Calculate business metrics (revenue, orders, users)
- Aggregate data with filtering (date range, establishment, category)
- Real-time metrics computation
- Cache management and invalidation
- Sustainability impact calculations

**Key Methods**:
- `getBusinessMetrics(filters)` - Comprehensive business analytics
- `getUserAnalytics(filters)` - User growth, retention, churn
- `getRealTimeMetrics()` - Live system metrics
- `getQuickStats()` - Dashboard overview statistics
- `invalidateCache(pattern)` - Clear cached results
- `getCacheStats()` - Cache hit rate and performance

---

### DashboardService

**File**: `services/dashboard.service.ts`

**Responsibilities**:
- Dashboard CRUD operations
- Widget management (add, update, remove)
- Role-based access control (RBAC)
- Template creation and initialization
- Export capabilities (PDF, Excel, CSV)

**Key Methods**:
- `createDashboard(dto, userId, role)` - Create custom dashboard
- `updateDashboard(id, dto, userId, role)` - Update existing dashboard
- `deleteDashboard(id, userId, role)` - Soft delete dashboard
- `addWidget(dashboardId, widget)` - Add widget to dashboard
- `updateWidget(dashboardId, widgetId, updates)` - Update widget config
- `removeWidget(dashboardId, widgetId)` - Remove widget
- `createDefaultTemplates()` - Initialize system templates

**Widget Types**:
- `metric` - Single value displays with trends
- `chart` - Line, bar, pie, donut, area, scatter plots
- `table` - Tabular data with sorting/pagination
- `map` - Geographic visualizations
- `heatmap` - Intensity-based heatmaps

---

## MongoDB Schemas

### AnalyticsCache

**File**: `schemas/analytics-cache.schema.ts`

**Purpose**: Performance optimization layer for expensive analytics queries.

**Fields**:
- `key` (String, unique, indexed) - Cache key (hash of query parameters)
- `data` (Mixed) - Cached result
- `ttl` (Number) - Time-to-live in seconds
- `createdAt` (Date) - Cache creation timestamp
- `expiresAt` (Date, indexed) - Expiration timestamp

**Indexes**: Compound index on `key + expiresAt` for efficient lookups and cleanup.

---

### DashboardConfig

**File**: `schemas/dashboard-config.schema.ts`

**Purpose**: Store user-created dashboards and widget configurations.

**Fields**:
- `userId` (ObjectId, indexed) - Dashboard owner
- `name` (String) - Dashboard name
- `description` (String) - Dashboard description
- `category` (Enum) - Dashboard category (business, sustainability, operations)
- `widgets` (Array) - Widget configurations
- `layout` (Object) - Grid layout settings
- `permissions` (Object) - Role-based access control
- `isDefault` (Boolean) - System default flag
- `isTemplate` (Boolean) - Template flag

**Widget Schema**:
```typescript
{
  id: String (UUID),
  type: 'metric' | 'chart' | 'table' | 'map' | 'heatmap',
  title: String,
  dataSource: String,
  visualization: Object,
  filters: Object,
  refreshInterval: Number (minutes),
  position: { row, column, width, height }
}
```

---

### AlertRule & Alert

**File**: `schemas/alert-rule.schema.ts`

**Purpose**: Configure and track real-time alerts for metric thresholds.

**AlertRule Fields**:
- `name` (String) - Rule name
- `metric` (String) - Metric to monitor
- `condition` (Enum) - Comparison operator (gt, lt, eq, gte, lte)
- `threshold` (Number) - Alert threshold value
- `timeWindow` (Number) - Time window in minutes
- `notificationChannels` (Array) - Email, SMS, webhook
- `isActive` (Boolean) - Enable/disable rule

**Alert Fields**:
- `ruleId` (ObjectId) - Reference to AlertRule
- `triggeredAt` (Date) - Alert timestamp
- `value` (Number) - Metric value that triggered alert
- `status` (Enum) - OPEN, ACKNOWLEDGED, RESOLVED
- `acknowledgedBy` (ObjectId) - User who acknowledged
- `resolvedAt` (Date) - Resolution timestamp

---

## REST API Endpoints

### Analytics Controller

**Prefix**: `/api/v1/analytics`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/business-metrics` | Get comprehensive business metrics | JWT + Role |
| POST | `/user-analytics` | Get user growth and retention metrics | JWT + Admin |
| GET | `/real-time` | Get real-time system metrics | JWT + Role |
| GET | `/quick-stats` | Get dashboard overview statistics | JWT + Role |
| POST | `/cache/invalidate` | Invalidate analytics cache | JWT + Admin |
| GET | `/cache/stats` | Get cache performance statistics | JWT + Admin |

---

### Dashboard Management (`DashboardController`)

**Prefix**: `/api/v1/analytics/dashboards`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List all dashboards (filtered by role) | JWT |
| POST | `/` | Create new dashboard | JWT |
| GET | `/:id` | Get dashboard by ID | JWT + Ownership |
| PUT | `/:id` | Update dashboard | JWT + Ownership |
| DELETE | `/:id` | Delete dashboard | JWT + Ownership |
| POST | `/:id/widgets` | Add widget to dashboard | JWT + Ownership |
| PUT | `/:id/widgets/:widgetId` | Update widget | JWT + Ownership |
| DELETE | `/:id/widgets/:widgetId` | Remove widget | JWT + Ownership |

---

## Data Transfer Objects (DTOs)

**File**: `dto/analytics.dto.ts`

### Request DTOs

- `BusinessMetricsRequestDto` - Business metrics filtering
- `AnalyticsFiltersDto` - Common filter options
- `CreateDashboardDto` - Dashboard creation
- `UpdateDashboardDto` - Dashboard updates
- `CreateWidgetDto` - Widget configuration
- `CreateAlertRuleDto` - Alert rule configuration

### Common Filter Fields

```typescript
interface AnalyticsFiltersDto {
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  granularity: {
    period: 'hour' | 'day' | 'week' | 'month' | 'year';
    timezone?: string;
  };
  establishmentIds?: string[];
  establishmentTypes?: string[];
  categories?: string[];
  userRoles?: string[];
  minOrderValue?: number;
  maxOrderValue?: number;
}
```

---

## Configuration

### Environment Variables

```env
# Analytics Configuration
ANALYTICS_CACHE_ENABLED=true                    # Enable caching layer
ANALYTICS_CACHE_TTL=900                          # Cache TTL (15 minutes)
ANALYTICS_MAX_DATE_RANGE=730                     # Max date range (2 years)

# Database
DATABASE_URL=mongodb+srv://...                   # MongoDB connection
```

---

## Performance Features

### Caching Strategy

1. **Query Result Caching**: Expensive aggregations cached with configurable TTL
2. **Cache Invalidation**: Smart invalidation on data mutations (new orders, offers)
3. **Cache Key Generation**: Hash-based keys from filter parameters
4. **Hit Rate Tracking**: Monitor cache effectiveness via `/cache/stats`

### Optimization Techniques

1. **MongoDB Aggregation Pipelines**: Efficient server-side data processing
2. **Pagination**: Limit result set sizes
3. **Parallel Processing**: Concurrent metric calculations
4. **Data Compression**: Reduced payload sizes for API responses
5. **Index Optimization**: Compound indexes on frequently queried fields

---

## Security & Permissions

### Role-Based Access Control

| Role | Analytics Access | Dashboard Access | Admin Features |
|------|------------------|------------------|----------------|
| CONSUMER | Personal stats only | Own dashboards | ❌ |
| MERCHANT | Establishment metrics | Own + establishment dashboards | ❌ |
| ADMIN | Full platform analytics | All dashboards | ✅ Cache, alerts |
| MODERATOR | Limited platform view | Read-only system dashboards | ❌ |

### Data Privacy

- **Anonymization**: Personal data aggregated, no individual records exposed
- **Audit Logging**: Analytics access tracked via `CorrelationIdMiddleware`
- **Resource Ownership**: Guards enforce access to user's own data

---

## Testing

### Unit Tests

```bash
pnpm test -- --testPathPattern=analytics
```

**Coverage**: Services, utilities, DTO validation

### Integration Tests

```bash
pnpm test:integration -- --testPathPattern=analytics
```

**Coverage**: Controllers, database interactions, cache behavior

### E2E Tests

```bash
pnpm test:e2e -- --testPathPattern=analytics
```

**Coverage**: Full request flow, authentication, RBAC

---

## Monitoring

### Health Checks

- Module health included in `GET /health` endpoint
- MongoDB analytics collection availability

### Prometheus Metrics

Available at `GET /metrics`:

- `analytics_cache_hit_rate` - Cache effectiveness
- `analytics_query_duration_seconds` - Query performance
- `analytics_dashboard_views_total` - Dashboard usage
- `analytics_api_requests_total` - Endpoint usage

### Logging

Structured logs via `AppLoggerService`:

```typescript
this.logger.log('Analytics query executed', {
  correlationId: request.correlationId,
  userId: user.id,
  filters: JSON.stringify(filters),
  duration: executionTime,
  cached: wasFromCache
});
```

---

## Usage Examples

### Example 1: Get Business Metrics

```typescript
const metrics = await analyticsService.getBusinessMetrics({
  filters: {
    dateRange: {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31')
    },
    granularity: {
      period: 'day',
      timezone: 'Africa/Tunis'
    },
    establishmentIds: ['507f1f77bcf86cd799439011']
  },
  includeSustainability: true
});

console.log(`Revenue: ${metrics.totalRevenue.value} TND`);
console.log(`Growth: ${metrics.totalRevenue.trend}%`);
console.log(`Food Saved: ${metrics.sustainability.foodSaved} kg`);
```

---

### Example 2: Create Dashboard

```typescript
const dashboard = await dashboardService.createDashboard({
  name: 'My Business Dashboard',
  description: 'Key performance indicators',
  category: 'business',
  widgets: [
    {
      type: 'metric',
      title: 'Total Revenue',
      dataSource: 'business_metrics',
      visualization: {
        displayOptions: { showTrend: true }
      },
      filters: {},
      position: { row: 1, column: 1, width: 3, height: 1 }
    },
    {
      type: 'chart',
      title: 'Revenue Trend',
      dataSource: 'business_metrics',
      visualization: {
        chartType: 'line',
        xAxis: 'date',
        yAxis: 'revenue'
      },
      filters: {
        dateRange: { startDate: '...', endDate: '...' },
        granularity: { period: 'week' }
      },
      refreshInterval: 15,
      position: { row: 2, column: 1, width: 6, height: 3 }
    }
  ]
}, userId, userRole);
```

---

### Example 3: Configure Alert

```typescript
const alertRule = await analyticsService.createAlertRule({
  name: 'High Order Volume',
  description: 'Alert when hourly orders exceed 100',
  metric: 'orders_per_hour',
  condition: 'greater_than',
  threshold: 100,
  timeWindow: 60, // minutes
  notificationChannels: ['email', 'webhook'],
  webhookUrl: 'https://hooks.slack.com/...',
  isActive: true
});
```

---

## Dependencies

### External Dependencies

- `@nestjs/common`, `@nestjs/core` - NestJS framework
- `@nestjs/mongoose` - MongoDB integration (v10.1.0)
- `mongoose` - ODM (v8.18.3)
- `@nestjs/event-emitter` - Event-driven architecture
- `@nestjs/config` - Configuration management

### Internal Dependencies

- `@foodwaste/shared` - Shared utilities and types
- `src/common/services/logger.service` - AppLoggerService
- `src/users/schemas/user.schema` - User collection
- `src/establishments/schemas/establishment.schema` - Establishment collection
- `src/offers/schemas/offer.schema` - Offer collection
- `src/orders/schemas/order.schema` - Order collection
- `src/payments/schemas/payment.schema` - Payment collection

---

## Future Enhancements

### Planned Features

1. **Machine Learning Integration**: Advanced predictive models using TensorFlow.js
2. **Real-time Streaming**: Kafka integration for live data processing
3. **Advanced Visualizations**: D3.js-powered 3D charts and interactive maps
4. **Mobile Analytics SDK**: React Native dashboard components
5. **API Rate Limiting**: Advanced throttling with tiered access
6. **Data Warehousing**: ClickHouse or BigQuery integration
7. **Natural Language Queries**: AI-powered analytics queries
8. **Automated Insights**: Proactive anomaly detection and recommendations

### Technical Debt

1. Implement comprehensive E2E tests for dashboard management
2. Optimize aggregation pipelines for multi-tenant queries
3. Add GraphQL support alongside REST endpoints
4. Implement data retention policies for analytics collections

---

## Troubleshooting

### Issue: Cache not working

**Solution**: Verify `ANALYTICS_CACHE_ENABLED=true` and check MongoDB connection.

```bash
pnpm backend mongo:verify-indexes
```

---

### Issue: Slow analytics queries

**Solution**:
1. Check cache hit rate: `GET /api/v1/analytics/cache/stats`
2. Verify indexes: `pnpm backend verify:indexes`
3. Reduce date range or add filters
4. Increase `ANALYTICS_CACHE_TTL` for less volatile data

---

## Contributors

For questions or contributions, refer to the main project documentation.

**File Path**: `apps/food-waste-backend/src/analytics/analytics.md`

**Last Updated**: 2026-01-15
