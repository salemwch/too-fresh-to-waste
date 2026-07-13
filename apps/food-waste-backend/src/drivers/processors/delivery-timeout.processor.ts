import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';

import { DriversService } from '../drivers.service';
import {
  DELIVERY_TIMEOUT_JOB,
  DELIVERY_TIMEOUT_QUEUE,
  DeliveryTimeoutJobData,
} from './delivery-timeout.constants';

/**
 * Rescues orders whose driver accepted and then went dark — phone died, app
 * uninstalled, driver simply stopped. Without this the order sits in
 * DRIVER_ASSIGNED / OUT_FOR_DELIVERY forever: invisible to every other driver
 * and never delivered to the customer.
 *
 * The job is scheduled on accept and removed on delivery, so reaching the
 * processor at all means the delivery did not complete in time.
 */
@Injectable()
@Processor(DELIVERY_TIMEOUT_QUEUE)
export class DeliveryTimeoutProcessor {
  private readonly logger = new Logger(DeliveryTimeoutProcessor.name);

  constructor(private readonly driversService: DriversService) {}

  @Process(DELIVERY_TIMEOUT_JOB)
  async handleDeliveryTimeout(job: Job<DeliveryTimeoutJobData>): Promise<void> {
    const { orderId, driverId } = job.data;

    // autoUnassignOnTimeout no-ops when the order already left the driver's
    // hands, which covers the race between a late delivery and this job.
    const released = await this.driversService.autoUnassignOnTimeout(orderId, driverId);

    if (!released) {
      this.logger.debug(
        `Delivery timeout for order ${orderId} skipped — order is no longer with driver ${driverId}`,
      );
    }
  }
}
