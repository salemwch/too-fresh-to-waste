import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentService } from '../payments.service';

@Injectable()
export class PaymentTasks {
    private readonly logger = new Logger(PaymentTasks.name);

    constructor(private readonly paymentService: PaymentService) { }

    // Retry failed webhooks every 5 minutes
    @Cron(CronExpression.EVERY_5_MINUTES)
    async handleFailedWebhooks() {
        try {
            const retriedCount = await this.paymentService.retryFailedWebhooks();
            if (retriedCount > 0) {
                this.logger.log(`Retried ${retriedCount} failed webhooks`);
            }
        } catch (error) {
            this.logger.error('Failed to retry webhooks:', error);
        }
    }
}
