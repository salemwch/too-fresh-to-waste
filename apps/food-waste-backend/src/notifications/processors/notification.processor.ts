import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';

import { QueueConcurrency } from '../../common/constants/queue-concurrency.constant';
import { NOTIFICATION_JOB, NOTIFICATION_QUEUE } from '../notifications.constants';
import { NotificationService } from '../services/notification.service';

import type { ISendNotificationRequest } from '../interfaces/notification.interfaces';
import type { Job } from 'bull';

/**
 * Delivers queued notifications, with Bull supplying the retries.
 *
 * The processor is deliberately thin: it re-enters `sendNotification`, the same
 * path a synchronous caller takes. Duplicating the dispatch logic here would
 * give queued and direct sends two subtly different behaviours — different
 * preference checks, different sanitisation — which is exactly the class of
 * drift that makes "it works when I call it directly" bugs.
 */
@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly notificationService: NotificationService) {}

  @Process({ name: NOTIFICATION_JOB, concurrency: QueueConcurrency.NOTIFICATIONS })
  async handleSend(job: Job<ISendNotificationRequest>): Promise<void> {
    const request = job.data;

    const result = await this.notificationService.sendNotification(request);

    if (!result.success) {
      /*
       * Throwing is what tells Bull to retry. Returning normally would mark the
       * job complete and silently drop a notification that never arrived.
       *
       * One exception: a send blocked by the user's own preferences is a
       * correct outcome, not a failure. Retrying it would hammer the provider
       * four more times to reach the same decision, so it completes quietly.
       */
      if (result.error === 'Blocked by user preferences') {
        this.logger.debug(
          `Notification "${request.trigger}" suppressed by user preferences — not retrying`,
        );
        return;
      }

      throw new Error(result.error ?? 'Notification dispatch failed');
    }
  }

  /**
   * Fires on every failed attempt, including ones Bull will retry.
   *
   * Logged at error level only once the job is exhausted: a first-attempt
   * failure that succeeds on retry is noise, but a genuinely undelivered
   * notification needs to be findable.
   */
  @OnQueueFailed()
  onFailed(job: Job<ISendNotificationRequest>, error: Error): void {
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);

    if (exhausted) {
      this.logger.error(
        `Notification permanently failed after ${job.attemptsMade} attempt(s): ` +
          `type=${job.data.type} trigger=${job.data.trigger} — ${error.message}`,
      );
      return;
    }

    this.logger.warn(
      `Notification attempt ${job.attemptsMade} failed, will retry: ` +
        `type=${job.data.type} trigger=${job.data.trigger} — ${error.message}`,
    );
  }
}
