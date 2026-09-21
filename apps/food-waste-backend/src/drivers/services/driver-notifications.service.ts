import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { DEFAULT_DRIVER_MAX_RADIUS_METERS } from '../../common/constants/dispatch.constant';
import { NotificationService } from '../../notifications/services/notification.service';
import {
  NotificationPriority,
  NotificationTrigger,
  NotificationType,
} from '../../notifications/types/notification.types';
import { OrderDocument } from '../../orders/schemas/order.schema';
import { DriverProfile, DriverProfileDocument } from '../schemas/driver-profile.schema';

/**
 * Owns every push notification that belongs to the delivery lifecycle — both
 * sides of it. Keeping the copy and the targeting in one place stops the same
 * message from being rewritten slightly differently in the service, the
 * listener, and the timeout processor.
 *
 * Every method is fire-and-forget: a failed push must never roll back or block
 * the order transition that triggered it.
 */
@Injectable()
export class DriverNotificationsService {
  private readonly logger = new Logger(DriverNotificationsService.name);

  constructor(
    @InjectModel(DriverProfile.name)
    private readonly driverProfileModel: Model<DriverProfileDocument>,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Fan out a new delivery order to every online driver whose last reported
   * position is within the dispatch radius of the establishment.
   *
   * Drivers who have never reported a location are not indexed by the sparse
   * 2dsphere index and are therefore skipped — they will still see the order
   * when they open the app and their list query runs.
   */
  async notifyNearbyDriversOfNewOrder(order: OrderDocument): Promise<void> {
    const coords = order.establishmentAddress?.coordinates?.coordinates;
    if (!coords) {
      return;
    }

    const radius =
      this.configService.get<number>('DRIVER_MAX_RADIUS_METERS') ??
      DEFAULT_DRIVER_MAX_RADIUS_METERS;

    try {
      const nearbyDrivers = await this.driverProfileModel
        .find({
          isOnline: true,
          lastKnownLocation: {
            $near: {
              $geometry: { type: 'Point', coordinates: coords },
              $maxDistance: radius,
            },
          },
        })
        .select('userId')
        .lean()
        .exec();

      if (nearbyDrivers.length === 0) {
        return;
      }

      const earnings = order.driverEarnings?.toFixed(3) ?? '—';
      const city = order.establishmentAddress?.city ?? 'a nearby store';

      await this.notificationService.sendBulkNotification(
        nearbyDrivers.map(driver => ({
          type: NotificationType.PUSH,
          trigger: NotificationTrigger.DRIVER_NEW_ORDER_NEARBY,
          target: { userId: driver.userId.toString() },
          payload: {
            title: 'New delivery near you',
            body: `Pick up from ${city} and earn ${earnings} TND.`,
            data: {
              trigger: NotificationTrigger.DRIVER_NEW_ORDER_NEARBY,
              orderId: order._id.toString(),
            },
          },
          priority: NotificationPriority.HIGH,
        })),
      );

      this.logger.log(
        `Notified ${nearbyDrivers.length} nearby driver(s) of delivery order ${order.orderNumber}`,
      );
    } catch (err) {
      // A missing 2dsphere index or a push outage must not fail order creation.
      this.logger.error(`Failed to notify nearby drivers for order ${order._id.toString()}`, err);
    }
  }

  /** Customer-facing: a driver accepted and is on the way to the store. */
  async notifyCustomerDriverAssigned(order: OrderDocument): Promise<void> {
    await this.notifyCustomer(
      order,
      NotificationTrigger.ORDER_DRIVER_ASSIGNED,
      'A driver is on the way',
      'Your driver is heading to the store to collect your order.',
    );
  }

  /** Customer-facing: the driver has the food and is en route. */
  async notifyCustomerOrderPickedUp(order: OrderDocument): Promise<void> {
    await this.notifyCustomer(
      order,
      NotificationTrigger.ORDER_PICKED_UP_BY_DRIVER,
      'Your order is on its way',
      'Your driver has collected your order and is heading to you.',
    );
  }

  /** Customer-facing: terminal success state. */
  async notifyCustomerOrderDelivered(order: OrderDocument): Promise<void> {
    await this.notifyCustomer(
      order,
      NotificationTrigger.ORDER_DELIVERED,
      'Order delivered',
      'Your order has been delivered. Enjoy — and thanks for saving food!',
    );
  }

  /**
   * customerId may be a raw ObjectId or a populated user document depending on
   * which query produced the order, so normalise before addressing the push.
   */
  private async notifyCustomer(
    order: OrderDocument,
    trigger: NotificationTrigger,
    title: string,
    body: string,
  ): Promise<void> {
    const customerId = this.resolveCustomerId(order);
    if (!customerId) {
      return;
    }

    try {
      // Queued: delivery status changes are exactly the notifications a
      // customer must not miss ("your driver is on the way"), and an inline
      // send that fails is gone with no retry.
      await this.notificationService.queueNotification({
        type: NotificationType.PUSH,
        trigger,
        target: { userId: customerId },
        payload: {
          title,
          body,
          data: { trigger, orderId: order._id.toString() },
        },
        priority: NotificationPriority.HIGH,
      });
    } catch (err) {
      this.logger.error(`Failed to notify customer for order ${order._id.toString()}`, err);
    }
  }

  private resolveCustomerId(order: OrderDocument): string | null {
    const raw = order.customerId as Types.ObjectId | { _id: Types.ObjectId } | undefined;
    if (!raw) {
      return null;
    }
    if (raw instanceof Types.ObjectId) {
      return raw.toString();
    }
    return raw._id?.toString() ?? null;
  }
}
