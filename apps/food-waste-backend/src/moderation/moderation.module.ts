import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';

// Note: ScheduleModule.forRoot() is already called in AppModule

// Schemas
import { Report, ReportSchema } from './schemas/report.schema';
import { ModerationAction, ModerationActionSchema } from './schemas/moderation-action.schema';
import { ModerationLog, ModerationLogSchema } from './schemas/moderation-log.schema';

// Services
import { ReportService } from './services/report.service';
import { ModerationActionService } from './services/moderation-action.service';
import { ModerationLogService } from './services/moderation-log.service';

// Controllers
import { ReportController } from './controllers/report.controller';
import { ModerationActionController } from './controllers/moderation-action.controller';
import { ModerationLogController } from './controllers/moderation-log.controller';

// Guards
import { ModerationAccessGuard, AdminOnlyModerationGuard, ReportOwnershipGuard } from './guards/moderation-access.guard';
import { ModerationReportRateLimitGuard, ModerationActionRateLimitGuard } from './guards/moderation-rate-limit.guard';

// Task Processor (for scheduled tasks)
import { ModerationTaskProcessor } from './processors/moderation-task.processor';

@Module({
    imports: [
        // MongoDB Schemas
        MongooseModule.forFeature([
            { name: Report.name, schema: ReportSchema },
            { name: ModerationAction.name, schema: ModerationActionSchema },
            { name: ModerationLog.name, schema: ModerationLogSchema },
        ]),

        // Throttler for rate limiting (optional - if you want module-specific config)
        ThrottlerModule.forRoot([{
            ttl: 60000, // 1 minute
            limit: 20,  // 20 requests per minute for moderation actions
        }]),
        // ScheduleModule is initialized in AppModule
    ],
    controllers: [
        ReportController,
        ModerationActionController,
        ModerationLogController,
    ],
    providers: [
        // Services
        ReportService,
        ModerationActionService,
        ModerationLogService,

        // Guards
        ModerationAccessGuard,
        AdminOnlyModerationGuard,
        ReportOwnershipGuard,
        ModerationReportRateLimitGuard,
        ModerationActionRateLimitGuard,

        // Task Processor
        ModerationTaskProcessor,
    ],
    exports: [
        // Export services for use in other modules
        ReportService,
        ModerationActionService,
        ModerationLogService,

        // Export guards for use in other modules
        ModerationAccessGuard,
        AdminOnlyModerationGuard,
    ],
})
export class ModerationModule {}