// Analytics Module Exports
export { AnalyticsModule } from './analytics.module';

// Services
export { AnalyticsService } from './services/analytics.service';
export { DashboardService } from './services/dashboard.service';

// Controllers
export { AnalyticsController } from './controllers/analytics.controller';
export { DashboardController } from './controllers/dashboard.controller';

// Interfaces
export * from './interfaces/analytics.interface';

// DTOs
export * from './dto/analytics.dto';

// Schemas
export { AnalyticsCache } from './schemas/analytics-cache.schema';
export type { AnalyticsCacheDocument } from './schemas/analytics-cache.schema';
export { DashboardConfig } from './schemas/dashboard-config.schema';
export type { DashboardConfigDocument } from './schemas/dashboard-config.schema';
export { AlertRule, Alert } from './schemas/alert-rule.schema';
export type { AlertRuleDocument, AlertDocument } from './schemas/alert-rule.schema';

// Utils
export { AnalyticsUtil } from './utils/analytics.util';