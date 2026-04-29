import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { OrdersService } from '../order.service';

/**
 * Runs every 10 minutes to mark orders whose expiresAt has passed as EXPIRED.
 * Without this, orders stay in RESERVED/CONFIRMED status indefinitely after
 * the pickup window closes — they never move to the History tab on mobile.
 */
@Injectable()
export class OrderExpiryTask {
  private readonly logger = new Logger(OrderExpiryTask.name);

  constructor(private readonly ordersService: OrdersService) {}

  @Cron('0 */10 * * * *')
  async handleOrderExpiry(): Promise<void> {
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
  }
}
