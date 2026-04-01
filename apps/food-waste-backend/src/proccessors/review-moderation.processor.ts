import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';

import { AppLoggerService } from '../common/services/logger.service';
import {
  ReviewModerationService,
  ReviewModerationData,
} from '../services/review-moderation.service';

@Processor('review-moderation')
export class ReviewModerationProcessor {
  constructor(
    private readonly moderationService: ReviewModerationService,
    private readonly appLogger: AppLoggerService,
  ) {}

  @Process('moderate')
  async moderateReview(job: Job<ReviewModerationData>): Promise<void> {
    const moderated = await Promise.resolve(this.moderationService.moderateReview(job.data));
    this.appLogger.log(
      `Moderated review: ${JSON.stringify(moderated)}`,
      'ReviewModerationProcessor',
    );
  }
}
