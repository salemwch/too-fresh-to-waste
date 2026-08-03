import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';

import { QueueConcurrency } from '../../common/constants/queue-concurrency.constant';
import { NotificationService } from '../../notifications/services/notification.service';
import {
  NotificationPriority,
  NotificationTrigger,
  NotificationType,
} from '../../notifications/types/notification.types';

export interface PickupReminderJobData {
  orderId: string;
  customerId: string;
  establishmentName: string;
  offerTitle: string;
  availableUntil: string;
}

@Injectable()
@Processor('pickup-reminders')
export class PickupReminderProcessor {
  private readonly logger = new Logger(PickupReminderProcessor.name);

  constructor(private readonly notificationService: NotificationService) {}

  @Process({ name: 'send-2h-reminder', concurrency: QueueConcurrency.PICKUP_REMINDERS })
  async handlePickupReminder(job: Job<PickupReminderJobData>): Promise<void> {
    const { orderId, customerId, establishmentName, offerTitle, availableUntil } = job.data;

    if (new Date() > new Date(availableUntil)) {
      this.logger.warn(`Skipping reminder for order ${orderId} — offer already expired`);
      return;
    }

    this.logger.log(`Sending 2h pickup reminder for order ${orderId} to customer ${customerId}`);

    await this.notificationService.sendNotification({
      type: NotificationType.PUSH,
      trigger: NotificationTrigger.PICKUP_REMINDER_2H,
      target: { userId: customerId },
      payload: {
        title: 'Pickup in 2 hours!',
        body: `Your order "${offerTitle}" from ${establishmentName} expires in 2 hours. Don't miss it!`,
        data: {
          trigger: 'pickup_reminder_2h',
          orderId,
        },
      },
      priority: NotificationPriority.HIGH,
    });
  }
}
