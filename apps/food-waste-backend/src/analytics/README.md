# Analytics Module

The Analytics Module provides comprehensive business intelligence and data
analytics capabilities for the food waste marketplace platform. It offers
real-time metrics, customizable dashboards, predictive analytics, and
sustainability impact tracking.

## 🏗️ Architecture

### Directory Structure

```
analytics/
├── aggregators/        # Data aggregation utilities
├── controllers/        # REST API controllers
├── dto/               # Data Transfer Objects
├── interfaces/        # TypeScript interfaces
├── schemas/           # MongoDB schemas
├── services/          # Business logic services
└── utils/            # Utility functions
```

### Key Components

#### Services

- **AnalyticsService**: Core analytics calculations and data processing
- **DashboardService**: Dashboard configuration and management

#### Controllers

- **AnalyticsController**: Business metrics and real-time analytics endpoints
- **DashboardController**: Dashboard CRUD operations and widget management

#### Schemas

- **AnalyticsCache**: Caching layer for performance optimization
- **DashboardConfig**: User dashboard configurations and layouts
- **AlertRule/Alert**: Real-time alerting system

## 🚀 Features

### Business Analytics

- **Revenue Metrics**: Total revenue, growth trends, period comparisons
- **Order Analytics**: Order volumes, completion rates, average order values
- **User Analytics**: User growth, retention, churn analysis, demographics
- **Establishment Analytics**: Performance rankings, category analysis
- **Sustainability Impact**: Food waste saved, carbon footprint reduction

### Real-time Monitoring

- **Live Metrics**: Active users, current orders, system health
- **Alert System**: Configurable thresholds and notifications
- **Performance Tracking**: Response times, error rates, uptime

### Customizable Dashboards

- **Widget System**: Metric cards, charts, tables, maps, heatmaps
- **Role-based Access**: Permissions based on user roles
- **Templates**: Pre-built dashboard templates for different use cases
- **Export Capabilities**: PDF, Excel, CSV export options

### Advanced Analytics

- **Predictive Analytics**: Demand forecasting, churn prediction
- **Location Analytics**: Geographic performance, delivery heatmaps
- **Customer Behavior**: Usage patterns, segmentation, journey analysis
- **Cohort Analysis**: User retention and revenue cohorts

## 📊 API Endpoints

### Analytics Endpoints

```http
POST /analytics/business-metrics     # Get business metrics
POST /analytics/user-analytics       # Get user analytics
GET  /analytics/real-time           # Get real-time metrics
GET  /analytics/quick-stats         # Get quick overview stats
POST /analytics/cache/invalidate    # Invalidate analytics cache
GET  /analytics/cache/stats         # Get cache statistics
```

### Dashboard Endpoints

```http
GET    /analytics/dashboards          # List all dashboards
POST   /analytics/dashboards          # Create new dashboard
GET    /analytics/dashboards/:id      # Get dashboard by ID
PUT    /analytics/dashboards/:id      # Update dashboard
DELETE /analytics/dashboards/:id      # Delete dashboard

POST   /analytics/dashboards/:id/widgets        # Add widget
PUT    /analytics/dashboards/:id/widgets/:wid   # Update widget
DELETE /analytics/dashboards/:id/widgets/:wid   # Remove widget
```

## 🔧 Configuration

### Environment Variables

```env
# Analytics Configuration
ANALYTICS_CACHE_ENABLED=true          # Enable/disable caching
ANALYTICS_CACHE_TTL=900                # Cache TTL in seconds (15 minutes)
ANALYTICS_MAX_DATE_RANGE=730           # Maximum date range in days (2 years)

# Database
DATABASE_URL=mongodb://localhost:27017/foodwaste

# Optional: Redis for advanced caching
REDIS_URL=redis://localhost:6379
```

### Module Configuration

```typescript
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    AnalyticsModule,
    // ... other modules
  ],
})
export class AppModule {}
```

## 📈 Usage Examples

### Getting Business Metrics

```typescript
const metricsRequest: BusinessMetricsRequestDto = {
  filters: {
    dateRange: {
      startDate: '2024-01-01T00:00:00.000Z',
      endDate: '2024-01-31T23:59:59.999Z',
    },
    granularity: {
      period: 'day',
      timezone: 'UTC',
    },
    establishmentIds: ['64b1c2e5f123456789abcdef'],
  },
  includeSustainability: true,
};

const metrics = await analyticsService.getBusinessMetrics(metricsRequest);
console.log(`Total Revenue: €${metrics.totalRevenue.value}`);
console.log(`Trend: ${metrics.totalRevenue.trend}`);
```

### Creating a Dashboard

```typescript
const dashboardDto: CreateDashboardDto = {
  name: 'My Business Dashboard',
  description: 'Key performance indicators',
  category: 'business',
  widgets: [
    {
      type: 'metric',
      title: 'Total Revenue',
      dataSource: 'business_metrics',
      visualization: {
        displayOptions: { showTrend: true },
      },
      filters: {},
      position: { row: 1, column: 1, width: 3, height: 1 },
    },
  ],
};

const dashboard = await dashboardService.createDashboard(
  dashboardDto,
  userId,
  userRole,
);
```

### Filtering Analytics Data

```typescript
const filters: AnalyticsFiltersDto = {
  dateRange: {
    startDate: '2024-01-01T00:00:00.000Z',
    endDate: '2024-12-31T23:59:59.999Z',
  },
  granularity: { period: 'month' },
  establishmentTypes: ['restaurant', 'bakery'],
  categories: ['breakfast', 'lunch'],
  userRoles: ['consumer'],
  minOrderValue: 10,
  maxOrderValue: 50,
};
```

## 🎨 Dashboard Widgets

### Widget Types

- **metric**: Single value displays with trends
- **chart**: Line, bar, pie, donut, area, scatter plots
- **table**: Tabular data with sorting and pagination
- **map**: Geographic data visualization
- **heatmap**: Intensity-based visualizations

### Widget Configuration

```typescript
const widget: CreateWidgetDto = {
  type: 'chart',
  title: 'Revenue Trend',
  description: 'Monthly revenue over time',
  dataSource: 'business_metrics',
  visualization: {
    chartType: 'line',
    xAxis: 'date',
    yAxis: 'revenue',
    colorScheme: ['#3B82F6', '#EF4444', '#10B981'],
  },
  filters: {
    dateRange: {
      /* ... */
    },
    granularity: { period: 'month' },
  },
  refreshInterval: 30, // minutes
  position: {
    row: 1,
    column: 1,
    width: 6,
    height: 3,
  },
};
```

## ⚡ Performance Features

### Intelligent Caching

- **Multi-level Caching**: Memory and database caching layers
- **Cache Invalidation**: Smart invalidation based on data changes
- **Cache Analytics**: Performance monitoring and hit rate tracking

### Optimizations

- **Aggregation Pipelines**: Efficient MongoDB aggregations
- **Pagination**: Large dataset handling
- **Parallel Processing**: Concurrent metric calculations
- **Data Compression**: Reduced payload sizes

## 🔐 Security & Permissions

### Role-based Access Control

- **Admin**: Full access to all analytics and dashboards
- **Merchant**: Access to their establishment's analytics
- **Consumer**: Limited access to personal analytics

### Data Privacy

- **Data Anonymization**: Personal data protection
- **Audit Logging**: Analytics access tracking
- **Secure Aggregation**: No individual record exposure

## 🧪 Testing

### Unit Tests

```bash
npm run test:unit -- --testPathPattern=analytics
```

### Integration Tests

```bash
npm run test:integration -- --testPathPattern=analytics
```

### Load Testing

```bash
npm run test:load -- --testPathPattern=analytics
```

## 📋 Monitoring & Alerts

### Health Checks

```http
GET /analytics/health
```

### Alert Configuration

```typescript
const alertRule: CreateAlertRuleDto = {
  name: 'High Order Volume',
  description: 'Alert when orders exceed threshold',
  metric: 'orders_per_hour',
  condition: 'greater_than',
  threshold: 100,
  timeWindow: 60, // minutes
  notificationChannels: ['email', 'webhook'],
};
```

## 🚀 Future Enhancements

- **Machine Learning**: Advanced predictive models
- **Real-time Streaming**: Live data processing with Kafka
- **Advanced Visualizations**: 3D charts, interactive maps
- **Mobile Analytics**: React Native dashboard components
- **API Rate Limiting**: Advanced throttling mechanisms
- **Data Warehousing**: Integration with analytical databases

## 📚 Additional Resources

- [API Documentation](./docs/api.md)
- [Dashboard Guide](./docs/dashboards.md)
- [Performance Tuning](./docs/performance.md)
- [Security Best Practices](./docs/security.md)
