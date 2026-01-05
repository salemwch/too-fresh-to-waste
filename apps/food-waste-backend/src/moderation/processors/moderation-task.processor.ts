import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ModerationActionService } from '../services/moderation-action.service';
import { ModerationLogService } from '../services/moderation-log.service';
import { LogLevel, LogCategory } from '../schemas/moderation-log.schema';

@Injectable()
export class ModerationTaskProcessor {
    private readonly logger = new Logger(ModerationTaskProcessor.name);

    constructor(
        private readonly moderationActionService: ModerationActionService,
        private readonly moderationLogService: ModerationLogService
    ) {}

    /**
     * Process expired moderation actions every hour
     */
    @Cron(CronExpression.EVERY_HOUR)
    async processExpiredActions(): Promise<void> {
        try {
            this.logger.log('Starting expired actions processing...');

            const processedCount = await this.moderationActionService.processExpiredActions();

            this.logger.log(`Processed ${processedCount} expired moderation actions`);

            // Log the cleanup activity
            if (processedCount > 0) {
                await this.moderationLogService.logModerationEvent({
                    level: LogLevel.INFO,
                    category: LogCategory.SYSTEM_EVENT,
                    action: 'EXPIRED_ACTIONS_CLEANUP',
                    description: `Processed ${processedCount} expired moderation actions`,
                    performedBy: 'system', // Special system user ID
                    isAutomated: true,
                    automationRule: 'expired_actions_cleanup',
                    metadata: { processedCount }
                });
            }

        } catch (error) {
            this.logger.error('Failed to process expired actions', error);

            // Log the error
            await this.moderationLogService.logModerationEvent({
                level: LogLevel.ERROR,
                category: LogCategory.SYSTEM_EVENT,
                action: 'EXPIRED_ACTIONS_CLEANUP_ERROR',
                description: 'Failed to process expired actions',
                performedBy: 'system',
                isAutomated: true,
                automationRule: 'expired_actions_cleanup',
                metadata: { error: (error as Error).message }
            }).catch(() => {
                // If logging fails, at least log to console
                this.logger.error('Failed to log cleanup error to database');
            });
        }
    }

    /**
     * Clean up old moderation logs (older than 1 year) - runs daily at midnight
     */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    cleanupOldLogs(): void {
        try {
            this.logger.log('Starting old logs cleanup...');

            // Note: The schema already has TTL index for automatic cleanup after 1 year
            // This is just for additional cleanup if needed

            this.logger.log('Old logs cleanup completed (handled by TTL index)');

        } catch (error) {
            this.logger.error('Failed to cleanup old logs', error);
        }
    }

    /**
     * Generate daily moderation summary - runs every day at 1 AM
     */
    @Cron('0 1 * * *')
    async generateDailyModerationSummary(): Promise<void> {
        try {
            this.logger.log('Generating daily moderation summary...');

            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(0, 0, 0, 0);

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const stats = await this.moderationLogService.getModerationStatistics(yesterday, today);

            // Log daily summary
            await this.moderationLogService.logModerationEvent({
                level: LogLevel.INFO,
                category: LogCategory.SYSTEM_EVENT,
                action: 'DAILY_MODERATION_SUMMARY',
                description: `Daily moderation summary generated`,
                performedBy: 'system',
                isAutomated: true,
                automationRule: 'daily_summary',
                metadata: {
                    date: yesterday.toISOString().split('T')[0],
                    ...stats
                },
                tags: ['daily-summary', 'statistics']
            });

            this.logger.log(`Daily summary generated: ${stats.totalActions} total actions`);

        } catch (error) {
            this.logger.error('Failed to generate daily summary', error);
        }
    }
}