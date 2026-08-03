import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { CronLockName, CronLockTtl } from '../../common/constants/cron-lock.constant';
import { CronLockService } from '../../common/services/cron-lock.service';
import { OrdersService } from '../order.service';

/**
 * Runs every 10 minutes to mark orders whose expiresAt has passed as EXPIRED.
 * Without this, orders stay in RESERVED/CONFIRMED status indefinitely after
 * the pickup window closes — they never move to the History tab on mobile.
 */
@Injectable()
export class OrderExpiryTask {
  private readonly logger = new Logger(OrderExpiryTask.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly cronLock: CronLockService,
  ) {}

  @Cron('0 */10 * * * *')
  async handleOrderExpiry(): Promise<void> {
    await this.cronLock.runExclusive(CronLockName.ORDER_EXPIRY, CronLockTtl.STANDARD, async () => {
      try {
        const updatedCount = await this.ordersService.updateExpiredOrders();
        if (updatedCount > 0) {
          this.logger.log(`Expired ${updatedCount} orders`);
        }
      } catch (error) {
        this.logger.error(
          `Order expiry cron failed: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    });
  }
}
