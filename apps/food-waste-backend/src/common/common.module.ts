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
import { SupabaseStorageService } from './services/supabase-storage.service';
import { LocalStorageService } from './services/local-storage.service';
import { PhoneNumberService } from './services/phone-number.service';
import { IsNotProfaneConstraint } from './validators/business-constraints.validator';
import { GlobalSanitizationMiddleware } from './middleware/global-sanitization.middleware';
import { CspReportController } from './controllers/csp-report.controller';
import { MetricsController } from './controllers/metrics.controller';
import { PrometheusMetricsService } from './services/prometheus-metrics.service';
import { RedisModule } from '../redis/redis.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { EventBusService } from './services/event-bus/event-bus.service';
import { RabbitMQAdapter } from './services/event-bus/adapters/rabbitmq.adapter';
import { EventEmitter2Adapter } from './services/event-bus/adapters/eventemitter2.adapter';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule,
    RedisModule,
    RabbitMQModule,
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
    SupabaseStorageService,
    LocalStorageService, // Local file storage for development
    PhoneNumberService,
    IsNotProfaneConstraint, // Injectable custom validator
    GlobalSanitizationMiddleware, // Global XSS prevention
    EventBusService, // Event routing: RabbitMQ or EventEmitter2
    RabbitMQAdapter, // RabbitMQ event publisher
    EventEmitter2Adapter, // EventEmitter2 fallback publisher
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
    SupabaseStorageService,
    LocalStorageService, // Export for Establishments and Offers modules
    PhoneNumberService,
    IsNotProfaneConstraint,
    GlobalSanitizationMiddleware,
    EventBusService, // Export for all modules to use event bus
  ],
})
export class CommonModule {}