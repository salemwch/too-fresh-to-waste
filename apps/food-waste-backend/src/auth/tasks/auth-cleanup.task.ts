import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { TokenService } from '../services/token.service';

/**
 * Scheduled task for cleaning up expired authentication tokens.
 * Runs daily at 4 AM to avoid collision with:
 *  - Review cleanup (2 AM)
 *  - Review stats recalc (3 AM)
 */
@Injectable()
export class AuthCleanupTask {
  private readonly logger = new Logger(AuthCleanupTask.name);

  constructor(private readonly tokenService: TokenService) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanupExpiredTokens(): Promise<void> {
    try {
      const deletedCount = await this.tokenService.cleanupTokens(2);
      if (deletedCount > 0) {
        this.logger.log(`Cleaned up ${deletedCount} expired refresh tokens`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup expired tokens', (error as Error).stack);
    }
  }
}
