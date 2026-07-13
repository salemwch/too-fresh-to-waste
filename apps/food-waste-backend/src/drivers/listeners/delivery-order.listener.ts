import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { DriverNotificationsService } from '../services/driver-notifications.service';
import { DELIVERY_ORDER_CREATED, DeliveryOrderCreatedEvent } from './delivery-order.events';

@Injectable()
export class DeliveryOrderListener {
  private readonly logger = new Logger(DeliveryOrderListener.name);

  constructor(private readonly driverNotifications: DriverNotificationsService) {}

  /**
   * Fan the new order out to nearby online drivers. Errors are swallowed inside
   * the notification service, but guard here too: an unhandled rejection in an
   * event handler would otherwise surface as an unhandled promise rejection.
   */
  @OnEvent(DELIVERY_ORDER_CREATED, { async: true })
  async handleDeliveryOrderCreated(event: DeliveryOrderCreatedEvent): Promise<void> {
    try {
      await this.driverNotifications.notifyNearbyDriversOfNewOrder(event.order);
    } catch (err) {
      this.logger.error('Failed to dispatch new delivery order to drivers', err);
    }
  }
}
