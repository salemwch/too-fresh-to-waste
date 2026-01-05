import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { SanitizationUtil } from './utils/sanitization.util';
import { RegexSecurityUtil } from './utils/regex-security.util';
import { QueryComplexityGuard } from './guards/query-complexity.guard';
import { ConfigParserService } from './services/config-parser.service';
import { AppLoggerService } from './services/logger.service';
import { SentryService } from './services/sentry.service';
import { FirebaseAdminService } from './services/firebase-admin.service';
import { FirebaseStorageService } from './services/firebase-storage.service';
import { PhoneNumberService } from './services/phone-number.service';
import { IsNotProfaneConstraint } from './validators/business-constraints.validator';
import { GlobalSanitizationMiddleware } from './middleware/global-sanitization.middleware';
import { CspReportController } from './controllers/csp-report.controller';
import { MetricsController } from './controllers/metrics.controller';
import { SessionManagementService } from './security/session-management.service';
import { PrometheusMetricsService } from './services/prometheus-metrics.service';
import { RedisModule } from '../redis/redis.module';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule,
    RedisModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [
    CspReportController, // CSP violation reporting endpoint
    MetricsController, // Prometheus metrics endpoint
  ],
  providers: [
    SanitizationUtil,
    RegexSecurityUtil,
    QueryComplexityGuard,
    ConfigParserService,
    AppLoggerService,
    SentryService, // Enterprise error tracking and monitoring
    PrometheusMetricsService, // Prometheus metrics collection
    FirebaseAdminService,
    FirebaseStorageService,
    PhoneNumberService,
    IsNotProfaneConstraint, // Injectable custom validator
    GlobalSanitizationMiddleware, // Global XSS prevention
    SessionManagementService, // Unified session management (v2.0)
  ],
  exports: [
    SanitizationUtil,
    RegexSecurityUtil,
    QueryComplexityGuard,
    ConfigParserService,
    AppLoggerService,
    SentryService, // Export for global error tracking
    PrometheusMetricsService, // Export for application-wide metrics
    FirebaseAdminService,
    FirebaseStorageService,
    PhoneNumberService,
    IsNotProfaneConstraint,
    GlobalSanitizationMiddleware,
    SessionManagementService, // Export for Auth and Users modules
  ],
})
export class CommonModule {}