import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ArchiveService } from '../archive.service';

/**
 * Nightly cron (5 AM) that archives and purges soft-deleted records
 * older than 30 days across all archivable entities.
 *
 * Schedule rationale — runs after other maintenance crons:
 *   Midnight : inventory expiry, gamification, moderation cleanup
 *   1 AM     : payout retry, moderation summary
 *   2 AM     : review analytics
 *   3 AM     : establishment rating recalc
 *   4 AM     : auth token cleanup
 *   5 AM     : archive expired soft-deletes (THIS)
 */
@Injectable()
export class ArchiveTask {
    private readonly logger = new Logger(ArchiveTask.name);

    constructor(private readonly archiveService: ArchiveService) {}

    @Cron(CronExpression.EVERY_DAY_AT_5AM)
    async handleArchiveCron(): Promise<void> {
        this.logger.log('Starting nightly archive of expired soft-deleted records…');

        try {
            const results = await this.archiveService.archiveAllExpired();

            const summary = results
                .filter((r) => r.archivedCount > 0)
                .map((r) => `${r.archivedCount} ${r.sourceCollection}`)
                .join(', ');

            if (summary) {
                this.logger.log(`Archive complete — archived ${summary}`);
            } else {
                this.logger.log('Archive complete — no records eligible for archival');
            }
        } catch (error) {
            this.logger.error(
                `Archive cron failed: ${(error as Error).message}`,
                (error as Error).stack,
            );
        }
    }
}
