import { Injectable } from '@nestjs/common';

import { PaymentService } from '../payments.service';

/**
 * Payment task runner — webhook retry cron removed (payment not active).
 * Re-add @Cron(CronExpression.EVERY_5_MINUTES) on handleFailedWebhooks()
 * when SMT payment integration goes live, and register PaymentTasks in
 * payments.module.ts providers array.
 */
@Injectable()
export class PaymentTasks {
  constructor(private readonly paymentService: PaymentService) {}

  async handleFailedWebhooks() {
    const result = await this.paymentService.retryFailedWebhooks();
    return result;
  }
}
