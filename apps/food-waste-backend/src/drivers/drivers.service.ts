import { InjectQueue } from '@nestjs/bull';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bull';
import { Model, Types } from 'mongoose';

import { OrderStatus } from '@foodwaste/shared';

import { DEFAULT_DRIVER_MAX_RADIUS_METERS } from '../common/constants/dispatch.constant';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { AvailableOrdersQueryDto } from './dto/available-orders-query.dto';
import { OrderHistoryQueryDto } from './dto/order-history-query.dto';
import { DriverProfile, DriverProfileDocument } from './schemas/driver-profile.schema';
import { DriverNotificationsService } from './services/driver-notifications.service';
import {
  DELIVERY_TIMEOUT_JOB,
  DELIVERY_TIMEOUT_QUEUE,
  DeliveryTimeoutJobData,
} from './processors/delivery-timeout.constants';

/**
 * Statuses in which an order is "in the driver's hands" — the driver has
 * committed to it and no other driver may take it. Used both for the
 * concurrency guard and for active-order recovery.
 */
const DRIVER_ACTIVE_STATUSES: readonly OrderStatus[] = [
  OrderStatus.DRIVER_ASSIGNED,
  OrderStatus.OUT_FOR_DELIVERY,
];

export interface DriverEarningsSummary {
  today: number;
  thisWeek: number;
  thisMonth: number;
  allTime: number;
  deliveriesToday: number;
  deliveriesAllTime: number;
  currency: 'TND';
}

export interface PaginatedOrders {
  orders: OrderDocument[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(DriverProfile.name)
    private readonly driverProfileModel: Model<DriverProfileDocument>,
    @InjectQueue(DELIVERY_TIMEOUT_QUEUE) private readonly deliveryTimeoutQueue: Queue,
    private readonly configService: ConfigService,
    private readonly driverNotifications: DriverNotificationsService,
  ) {}

  private static readonly CUSTOMER_POPULATE = {
    path: 'customerId',
    select: 'firstName lastName phoneNumber',
  };

  // ===========================================================================
  // Profile — availability and location
  // ===========================================================================

  /**
   * A DriverProfile is created by the admin alongside the user account, so a
   * missing profile means the account was provisioned incorrectly rather than
   * that the driver simply has not onboarded — surface it rather than silently
   * upserting a profile with empty CIN/address.
   */
  async getProfile(driverId: string): Promise<DriverProfileDocument> {
    const profile = await this.driverProfileModel.findOne({
      userId: new Types.ObjectId(driverId),
    });
    if (!profile) {
      throw new NotFoundException('Driver profile not found');
    }
    return profile;
  }

  async setOnlineStatus(driverId: string, isOnline: boolean): Promise<DriverProfileDocument> {
    const profile = await this.driverProfileModel.findOneAndUpdate(
      { userId: new Types.ObjectId(driverId) },
      { $set: { isOnline, ...(isOnline ? { lastOnlineAt: new Date() } : {}) } },
      { new: true },
    );
    if (!profile) {
      throw new NotFoundException('Driver profile not found');
    }

    this.logger.log(`Driver ${driverId} went ${isOnline ? 'online' : 'offline'}`);
    return profile;
  }

  /**
   * Location heartbeat from the driver app. Stored as GeoJSON [lng, lat] to
   * match the 2dsphere index. Fed by the app only while the driver is online.
   */
  async updateLocation(driverId: string, lat: number, lng: number): Promise<void> {
    // Bypass Mongoose — its schema defaults on the nested `lastKnownLocation`
    // subdocument strip `coordinates` and leave `{ type: "Point" }`, which the
    // 2dsphere index rejects with "Point must be an array or object".
    const result = await this.driverProfileModel.collection.updateOne(
      { userId: new Types.ObjectId(driverId) },
      {
        $set: {
          lastKnownLocation: { type: 'Point', coordinates: [lng, lat] },
          lastLocationAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );
    if (result.matchedCount === 0) {
      throw new NotFoundException('Driver profile not found');
    }
  }

  // ===========================================================================
  // Order pool
  // ===========================================================================

  /**
   * The pool a driver may accept from.
   *
   * Returns empty (rather than throwing) when the driver is offline or already
   * carrying an order: both are normal states, not errors, and the app renders
   * a dedicated banner for each. Throwing here would turn an ordinary screen
   * refresh into an error toast.
   */
  async getAvailableOrders(
    query: AvailableOrdersQueryDto,
    driverId: string,
  ): Promise<OrderDocument[]> {
    const { lat, lng, page = 1, limit = 20 } = query;

    const profile = await this.getProfile(driverId);
    if (!profile.isOnline) {
      return [];
    }

    if (await this.hasReachedConcurrencyLimit(driverId)) {
      return [];
    }

    const bufferMs =
      (this.configService.get<number>('DRIVER_PRE_DISPATCH_BUFFER_MINUTES') ?? 20) * 60_000;
    const maxRadius =
      this.configService.get<number>('DRIVER_MAX_RADIUS_METERS') ??
      DEFAULT_DRIVER_MAX_RADIUS_METERS;
    const now = new Date();

    try {
      return await this.orderModel
        .find({
          deliveryMode: 'delivery',
          status: OrderStatus.CONFIRMED,
          driverId: null,
          collectionStartTime: { $lte: new Date(now.getTime() + bufferMs) },
          collectionEndTime: { $gte: now },
          'establishmentAddress.coordinates': {
            $near: {
              $geometry: { type: 'Point', coordinates: [lng, lat] },
              $maxDistance: maxRadius,
            },
          },
        })
        .populate(DriversService.CUSTOMER_POPULATE)
        .skip((page - 1) * limit)
        .limit(limit)
        .exec();
    } catch (err) {
      // $near requires a 2dsphere index. If the index is missing (e.g. fresh
      // database without syncIndexes), log the error and return empty rather
      // than surfacing a 500 to the driver app.
      this.logger.error('getAvailableOrders geo query failed — returning empty', err);
      return [];
    }
  }

  /**
   * The driver's in-progress order, if any. This is what lets the app recover
   * after a restart: DRIVER_ASSIGNED / OUT_FOR_DELIVERY orders are excluded
   * from the available pool, so without this endpoint an active delivery is
   * unreachable once the in-memory navigation param is gone.
   */
  async getActiveOrder(driverId: string): Promise<OrderDocument | null> {
    const order = await this.orderModel
      .findOne({
        driverId: new Types.ObjectId(driverId),
        status: { $in: DRIVER_ACTIVE_STATUSES },
      })
      .populate(DriversService.CUSTOMER_POPULATE)
      .exec();

    return order;
  }

  // ===========================================================================
  // Lifecycle transitions
  // ===========================================================================

  /**
   * CONFIRMED → DRIVER_ASSIGNED.
   *
   * The driver has committed to the order but has not collected the food yet;
   * OUT_FOR_DELIVERY is only reached via markPickedUp(). The findOneAndUpdate
   * filter carries `driverId: null`, so two drivers racing for the same order
   * cannot both win — the loser gets the ConflictException.
   */
  async acceptOrder(orderId: string, driverId: string): Promise<OrderDocument> {
    const profile = await this.getProfile(driverId);
    if (!profile.isOnline) {
      throw new ForbiddenException('You must be online to accept orders');
    }

    if (await this.hasReachedConcurrencyLimit(driverId)) {
      throw new ConflictException('Finish your current delivery before accepting another order');
    }

    const order = await this.orderModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(orderId),
          driverId: null,
          status: OrderStatus.CONFIRMED,
          deliveryMode: 'delivery',
        },
        {
          $set: {
            driverId: new Types.ObjectId(driverId),
            status: OrderStatus.DRIVER_ASSIGNED,
            driverAssignedAt: new Date(),
          },
        },
        { new: true },
      )
      .populate(DriversService.CUSTOMER_POPULATE);

    if (!order) {
      throw new ConflictException('Order already accepted by another driver');
    }

    await this.scheduleDeliveryTimeout(order._id.toString(), driverId);
    void this.driverNotifications.notifyCustomerDriverAssigned(order);

    return order;
  }

  /** DRIVER_ASSIGNED → OUT_FOR_DELIVERY. The food is now with the driver. */
  async markPickedUp(orderId: string, driverId: string): Promise<OrderDocument> {
    const order = await this.orderModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(orderId),
          driverId: new Types.ObjectId(driverId),
          status: OrderStatus.DRIVER_ASSIGNED,
        },
        {
          $set: {
            status: OrderStatus.OUT_FOR_DELIVERY,
            driverPickedUpAt: new Date(),
          },
        },
        { new: true },
      )
      .populate(DriversService.CUSTOMER_POPULATE);

    if (!order) {
      throw new NotFoundException('Order not found, not yours, or already picked up');
    }

    void this.driverNotifications.notifyCustomerOrderPickedUp(order);
    return order;
  }

  /** OUT_FOR_DELIVERY → DELIVERED. Terminal success state. */
  async markDelivered(orderId: string, driverId: string): Promise<OrderDocument> {
    const order = await this.orderModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(orderId),
          driverId: new Types.ObjectId(driverId),
          status: OrderStatus.OUT_FOR_DELIVERY,
        },
        {
          $set: {
            status: OrderStatus.DELIVERED,
            deliveredAt: new Date(),
          },
        },
        { new: true },
      )
      .populate(DriversService.CUSTOMER_POPULATE);

    if (!order) {
      throw new NotFoundException('Order not found, not yours, or not yet picked up');
    }

    await this.cancelDeliveryTimeout(orderId);
    void this.driverNotifications.notifyCustomerOrderDelivered(order);

    return order;
  }

  /**
   * Driver drops the order and it returns to the pool.
   *
   * Allowed from DRIVER_ASSIGNED and OUT_FOR_DELIVERY: a driver who has already
   * collected the food can still break down, and leaving them no exit would
   * strand the order until the timeout fires. The unassignment is recorded so
   * repeated drops after pickup are visible to ops.
   */
  async unassignOrder(orderId: string, driverId: string, reason?: string): Promise<OrderDocument> {
    const order = await this.releaseOrder(orderId, driverId, {
      auto: false,
      ...(reason ? { reason } : {}),
    });
    if (!order) {
      throw new NotFoundException('Order not found or not yours to unassign');
    }

    await this.cancelDeliveryTimeout(orderId);
    return order;
  }

  /**
   * Called by the timeout processor when a driver accepted but never completed
   * the delivery. Silently no-ops if the order already moved on — the job and a
   * late manual delivery can race.
   */
  async autoUnassignOnTimeout(orderId: string, driverId: string): Promise<boolean> {
    const order = await this.releaseOrder(orderId, driverId, {
      auto: true,
      reason: 'Delivery not completed within the allowed time',
    });

    if (!order) {
      return false;
    }

    this.logger.warn(`Auto-unassigned order ${orderId} from driver ${driverId} after timeout`);
    return true;
  }

  /**
   * Single write path back to the pool, shared by the manual and automatic
   * unassign flows so the audit trail and the counter can never diverge.
   */
  private async releaseOrder(
    orderId: string,
    driverId: string,
    context: { auto: boolean; reason?: string },
  ): Promise<OrderDocument | null> {
    const order = await this.orderModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(orderId),
          driverId: new Types.ObjectId(driverId),
          status: { $in: DRIVER_ACTIVE_STATUSES },
        },
        {
          $set: {
            status: OrderStatus.CONFIRMED,
            driverId: null,
          },
          $unset: { driverAssignedAt: '', driverPickedUpAt: '' },
          $inc: { driverCancellationCount: 1 },
          $push: {
            driverUnassignments: {
              driverId: new Types.ObjectId(driverId),
              auto: context.auto,
              at: new Date(),
              ...(context.reason ? { reason: context.reason } : {}),
            },
          },
        },
        { new: true },
      )
      .populate(DriversService.CUSTOMER_POPULATE);

    return order;
  }

  // ===========================================================================
  // History and earnings
  // ===========================================================================

  async getOrderHistory(driverId: string, query: OrderHistoryQueryDto): Promise<PaginatedOrders> {
    const { page = 1, limit = 20 } = query;
    const filter = {
      driverId: new Types.ObjectId(driverId),
      status: OrderStatus.DELIVERED,
    };

    const [orders, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ deliveredAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate(DriversService.CUSTOMER_POPULATE)
        .exec(),
      this.orderModel.countDocuments(filter),
    ]);

    return { orders, total, page, limit };
  }

  /**
   * Earnings roll-up for the driver dashboard.
   *
   * Uses `deliveredAt` (not createdAt) so an order placed yesterday and
   * delivered today counts toward today. Buckets are computed in a single
   * aggregation pass with $facet rather than four round trips.
   */
  async getEarningsSummary(driverId: string): Promise<DriverEarningsSummary> {
    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    // Week starts Monday — the Tunisian working week.
    const startOfWeek = new Date(startOfToday);
    const dayOffset = (startOfToday.getDay() + 6) % 7;
    startOfWeek.setDate(startOfToday.getDate() - dayOffset);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const sumEarnings = [
      { $group: { _id: null, total: { $sum: '$driverEarnings' }, count: { $sum: 1 } } },
    ];

    const [result] = await this.orderModel.aggregate<{
      today: Array<{ total: number; count: number }>;
      thisWeek: Array<{ total: number; count: number }>;
      thisMonth: Array<{ total: number; count: number }>;
      allTime: Array<{ total: number; count: number }>;
    }>([
      {
        $match: {
          driverId: new Types.ObjectId(driverId),
          status: OrderStatus.DELIVERED,
        },
      },
      {
        $facet: {
          today: [{ $match: { deliveredAt: { $gte: startOfToday } } }, ...sumEarnings],
          thisWeek: [{ $match: { deliveredAt: { $gte: startOfWeek } } }, ...sumEarnings],
          thisMonth: [{ $match: { deliveredAt: { $gte: startOfMonth } } }, ...sumEarnings],
          allTime: sumEarnings,
        },
      },
    ]);

    const round = (value: number): number => parseFloat(value.toFixed(3));
    const bucket = (rows: Array<{ total: number; count: number }> | undefined) =>
      rows?.[0] ?? { total: 0, count: 0 };

    const today = bucket(result?.today);
    const allTime = bucket(result?.allTime);

    return {
      today: round(today.total),
      thisWeek: round(bucket(result?.thisWeek).total),
      thisMonth: round(bucket(result?.thisMonth).total),
      allTime: round(allTime.total),
      deliveriesToday: today.count,
      deliveriesAllTime: allTime.count,
      currency: 'TND',
    };
  }

  // ===========================================================================
  // Internals
  // ===========================================================================

  /**
   * MVP carries one order at a time, matching what Uber Eats and Bolt Food do
   * for new couriers. Raising DRIVER_MAX_CONCURRENT_ORDERS is enough to allow
   * stacking later — no other code depends on the limit being 1.
   */
  private async hasReachedConcurrencyLimit(driverId: string): Promise<boolean> {
    const maxConcurrent = this.configService.get<number>('DRIVER_MAX_CONCURRENT_ORDERS') ?? 1;

    const activeCount = await this.orderModel.countDocuments({
      driverId: new Types.ObjectId(driverId),
      status: { $in: DRIVER_ACTIVE_STATUSES },
    });

    return activeCount >= maxConcurrent;
  }

  /**
   * The job id is the order id, which makes scheduling idempotent and lets
   * cancelDeliveryTimeout() find the job without storing a handle on the order.
   */
  private async scheduleDeliveryTimeout(orderId: string, driverId: string): Promise<void> {
    const timeoutMinutes = this.configService.get<number>('DRIVER_DELIVERY_TIMEOUT_MINUTES') ?? 60;

    try {
      await this.deliveryTimeoutQueue.add(
        DELIVERY_TIMEOUT_JOB,
        { orderId, driverId } satisfies DeliveryTimeoutJobData,
        {
          jobId: orderId,
          delay: timeoutMinutes * 60_000,
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    } catch (err) {
      // A queue outage must not block the driver from taking the order — the
      // order simply loses its automatic rescue and needs manual intervention.
      this.logger.error(`Failed to schedule delivery timeout for order ${orderId}`, err);
    }
  }

  private async cancelDeliveryTimeout(orderId: string): Promise<void> {
    try {
      const job = await this.deliveryTimeoutQueue.getJob(orderId);
      await job?.remove();
    } catch (err) {
      // A stale job that fires against a DELIVERED order is a no-op, so a
      // failed removal is harmless.
      this.logger.warn(`Failed to cancel delivery timeout for order ${orderId}`, err);
    }
  }
}
