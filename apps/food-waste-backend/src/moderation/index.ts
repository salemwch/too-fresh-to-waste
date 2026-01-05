// Main Module
export { ModerationModule } from './moderation.module';

// Services
export { ReportService } from './services/report.service';
export { ModerationActionService } from './services/moderation-action.service';
export { ModerationLogService } from './services/moderation-log.service';

// Controllers
export { ReportController } from './controllers/report.controller';
export { ModerationActionController } from './controllers/moderation-action.controller';
export { ModerationLogController } from './controllers/moderation-log.controller';

// Guards
export { ModerationAccessGuard, AdminOnlyModerationGuard, ReportOwnershipGuard } from './guards/moderation-access.guard';
export { ModerationReportRateLimitGuard, ModerationActionRateLimitGuard } from './guards/moderation-rate-limit.guard';

// Schemas and Types
export { Report, ReportType, ReportReason, ReportStatus, ReportPriority } from './schemas/report.schema';
export type { ReportDocument } from './schemas/report.schema';
export { ModerationAction, ModerationActionType, ModerationActionStatus, ModerationSeverity } from './schemas/moderation-action.schema';
export type { ModerationActionDocument } from './schemas/moderation-action.schema';
export { ModerationLog, LogLevel, LogCategory } from './schemas/moderation-log.schema';
export type { ModerationLogDocument } from './schemas/moderation-log.schema';

// DTOs
export { CreateReportDto } from './dtos/create-report.dto';
export { CreateModerationActionDto, UpdateModerationActionDto, BulkModerationActionDto } from './dtos/moderation-action.dto';
export { ReportQueryDto, ReportUpdateDto, ModerationActionQueryDto } from './dtos/report-query.dto';