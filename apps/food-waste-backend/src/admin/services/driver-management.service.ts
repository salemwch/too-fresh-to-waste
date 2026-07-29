import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';

import { OrderStatus, UserRole, UserStatus } from '@foodwaste/shared';

import { DriverEarningsSummary, DriversService } from '../../drivers/drivers.service';
import { DriverProfile, DriverProfileDocument } from '../../drivers/schemas/driver-profile.schema';
import { Order, OrderDocument } from '../../orders/schemas/order.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { CreateDriverDto } from '../dto/create-driver.dto';
import { DriverOrdersQueryDto } from '../dto/driver-orders-query.dto';

/** Statuses in which an order is currently in a driver's hands. */
const DRIVER_ACTIVE_STATUSES: readonly OrderStatus[] = [
  OrderStatus.DRIVER_ASSIGNED,
  OrderStatus.OUT_FOR_DELIVERY,
];

// ── Public shapes ─────────────────────────────────────────────────────────────

/** Last reported position, converted from GeoJSON [lng, lat] at the boundary. */
export interface DriverPosition {
  lat: number;
  lng: number;
  at: Date | null;
}

export interface AdminDriverProfile {
  idCardNumber: string;
  address: string;
  isOnline: boolean;
  lastOnlineAt: Date | null;
  lastKnownLocation: DriverPosition | null;
}

/**
 * Lifetime activity roll-up. Every field is derived from orders — the driver
 * documents themselves store no counters, so these can never drift.
 */
export interface DriverStats {
  /** Orders currently assigned to this driver, whatever their status. */
  totalAssigned: number;
  totalDelivered: number;
  /** Assigned or out for delivery right now. */
  activeCount: number;
  /** Sum of `driverEarnings` over delivered orders, TND. */
  totalEarnings: number;
  /** Mean `driverAssignedAt` → `deliveredAt`, null when nothing is delivered. */
  avgDeliveryMinutes: number | null;
  lastDeliveredAt: Date | null;
  /** Orders this driver dropped themselves. */
  cancellationCount: number;
  /** Orders released from this driver by the delivery-timeout job. */
  autoReleaseCount: number;
}

export interface AdminDriverRow {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  status: UserStatus;
  requiresPasswordChange: boolean;
  createdAt: Date;
  driverProfile: AdminDriverProfile | null;
  stats: DriverStats;
}

export interface AdminDriverUnassignment {
  orderId: string;
  orderNumber: string;
  reason: string | null;
  auto: boolean;
  at: Date;
}

export interface AdminDriverDetail {
  driver: AdminDriverRow & { lastLoginAt: Date | null };
  earnings: DriverEarningsSummary;
  unassignments: AdminDriverUnassignment[];
}

export interface AdminDriverOrderRow {
  _id: string;
  orderNumber: string;
  status: OrderStatus;
  deliveryMode: 'pickup' | 'delivery';
  total: number;
  currency: string;
  driverEarnings: number | null;
  estimatedDistanceKm: number | null;
  deliveryCity: string | null;
  createdAt: Date;
  driverAssignedAt: Date | null;
  driverPickedUpAt: Date | null;
  deliveredAt: Date | null;
}

export interface AdminDriverOrdersPage {
  orders: AdminDriverOrderRow[];
  total: number;
  page: number;
  limit: number;
}

// ── Internal aggregation shapes ───────────────────────────────────────────────

interface OrderStatsRow {
  _id: Types.ObjectId;
  totalAssigned: number;
  totalDelivered: number;
  activeCount: number;
  totalEarnings: number;
  lastDeliveredAt: Date | null;
  deliveryMsTotal: number;
  timedDeliveries: number;
}

interface UnassignStatsRow {
  _id: Types.ObjectId;
  cancellationCount: number;
  autoReleaseCount: number;
}

const EMPTY_STATS: DriverStats = {
  totalAssigned: 0,
  totalDelivered: 0,
  activeCount: 0,
  totalEarnings: 0,
  avgDeliveryMinutes: null,
  lastDeliveredAt: null,
  cancellationCount: 0,
  autoReleaseCount: 0,
};

/** TND has 3 decimals — round money the same way the driver app does. */
const roundTnd = (value: number): number => parseFloat(value.toFixed(3));

/**
 * Orders scanned when building the unassignment trail, and entries kept from
 * them — bounded so one serially-cancelling driver cannot pull an unbounded
 * document set into memory.
 */
const UNASSIGNMENT_SCAN_LIMIT = 100;
const UNASSIGNMENT_PAGE_SIZE = 50;

@Injectable()
export class DriverManagementService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(DriverProfile.name)
    private readonly driverProfileModel: Model<DriverProfileDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly driversService: DriversService,
  ) {}

  // ── Provisioning ────────────────────────────────────────────────────────────

  async createDriver(dto: CreateDriverDto): Promise<{
    driver: {
      _id: string;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      requiresPasswordChange: boolean;
    };
    driverProfile: { idCardNumber: string; address: string };
    temporaryPassword: string;
  }> {
    const temporaryPassword = `Drv-${crypto.randomBytes(3).toString('hex')}-${crypto.randomBytes(3).toString('hex')}`;
    const hashedPassword = await argon2.hash(temporaryPassword, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const createdUsers = await this.userModel.create(
        [
          {
            firstName: dto.firstName,
            lastName: dto.lastName,
            email: dto.email,
            phoneNumber: dto.phoneNumber,
            password: hashedPassword,
            role: UserRole.DRIVER,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            requiresPasswordChange: true,
          },
        ],
        { session },
      );
      const user = createdUsers[0];
      if (!user) {
        throw new Error('Failed to create driver user');
      }

      const createdProfiles = await this.driverProfileModel.create(
        [
          {
            userId: user._id,
            idCardNumber: dto.idCardNumber,
            address: dto.address,
          },
        ],
        { session },
      );
      const driverProfile = createdProfiles[0];
      if (!driverProfile) {
        throw new Error('Failed to create driver profile');
      }

      await session.commitTransaction();

      return {
        driver: {
          _id: (user._id as { toString(): string }).toString(),
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          requiresPasswordChange: user.requiresPasswordChange,
        },
        driverProfile: {
          idCardNumber: driverProfile.idCardNumber,
          address: driverProfile.address,
        },
        temporaryPassword,
      };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  }

  // ── Fleet list ──────────────────────────────────────────────────────────────

  /**
   * Every driver with their profile, live availability and lifetime delivery
   * stats.
   *
   * Four queries regardless of fleet size: users, profiles, order roll-up,
   * unassignment roll-up. The two roll-ups are aggregations keyed by driverId
   * and resolved from a Map — never one query per driver.
   */
  async getDrivers(): Promise<AdminDriverRow[]> {
    const drivers = await this.userModel
      .find({ role: UserRole.DRIVER, deletedAt: null })
      .select('firstName lastName email phoneNumber status requiresPasswordChange createdAt')
      .sort({ createdAt: -1 })
      .lean<
        Array<{
          _id: Types.ObjectId;
          firstName: string;
          lastName: string;
          email: string;
          phoneNumber?: string;
          status: UserStatus;
          requiresPasswordChange?: boolean;
          createdAt: Date;
        }>
      >()
      .exec();

    if (drivers.length === 0) {
      return [];
    }

    const ids = drivers.map(d => d._id);
    const [profileMap, statsMap] = await Promise.all([
      this.fetchProfiles(ids),
      this.aggregateStats(ids),
    ]);

    return drivers.map(d => {
      const id = d._id.toString();
      return {
        _id: id,
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        ...(d.phoneNumber !== undefined ? { phoneNumber: d.phoneNumber } : {}),
        status: d.status,
        requiresPasswordChange: d.requiresPasswordChange ?? false,
        createdAt: d.createdAt,
        driverProfile: profileMap.get(id) ?? null,
        stats: statsMap.get(id) ?? EMPTY_STATS,
      };
    });
  }

  // ── Single driver ───────────────────────────────────────────────────────────

  /**
   * Full dossier for one driver: identity, profile, lifetime stats, the
   * earnings buckets the driver sees in their own app, and the unassignment
   * trail.
   *
   * Earnings are delegated to `DriversService` rather than re-derived here —
   * an admin reading a different number from the driver would be a support
   * nightmare, and the $facet pass is already written there.
   */
  async getDriverDetail(driverId: string): Promise<AdminDriverDetail> {
    if (!Types.ObjectId.isValid(driverId)) {
      throw new NotFoundException('Driver not found');
    }
    const oid = new Types.ObjectId(driverId);

    const driver = await this.userModel
      .findOne({ _id: oid, role: UserRole.DRIVER, deletedAt: null })
      .select(
        'firstName lastName email phoneNumber status requiresPasswordChange createdAt lastLoginAt',
      )
      .lean<{
        _id: Types.ObjectId;
        firstName: string;
        lastName: string;
        email: string;
        phoneNumber?: string;
        status: UserStatus;
        requiresPasswordChange?: boolean;
        createdAt: Date;
        lastLoginAt?: Date;
      } | null>()
      .exec();

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const [profileMap, statsMap, earnings, unassignments] = await Promise.all([
      this.fetchProfiles([oid]),
      this.aggregateStats([oid]),
      this.driversService.getEarningsSummary(driverId),
      this.fetchUnassignments(oid),
    ]);

    return {
      driver: {
        _id: driverId,
        firstName: driver.firstName,
        lastName: driver.lastName,
        email: driver.email,
        ...(driver.phoneNumber !== undefined ? { phoneNumber: driver.phoneNumber } : {}),
        status: driver.status,
        requiresPasswordChange: driver.requiresPasswordChange ?? false,
        createdAt: driver.createdAt,
        lastLoginAt: driver.lastLoginAt ?? null,
        driverProfile: profileMap.get(driverId) ?? null,
        stats: statsMap.get(driverId) ?? EMPTY_STATS,
      },
      earnings,
      unassignments,
    };
  }

  /**
   * Every order this driver has held, newest first — not just the delivered
   * ones. `.lean()` with an explicit projection: the admin table renders ten
   * fields and the order document carries far more than that.
   */
  async getDriverOrders(
    driverId: string,
    query: DriverOrdersQueryDto,
  ): Promise<AdminDriverOrdersPage> {
    if (!Types.ObjectId.isValid(driverId)) {
      throw new NotFoundException('Driver not found');
    }

    const { page = 1, limit = 20 } = query;
    const filter = {
      driverId: new Types.ObjectId(driverId),
      ...(query.status ? { status: query.status } : {}),
    };

    const [orders, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .select(
          'orderNumber status deliveryMode pricing.total pricing.currency driverEarnings ' +
            'estimatedDistanceKm deliveryAddress.city createdAt driverAssignedAt ' +
            'driverPickedUpAt deliveredAt',
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<
          Array<{
            _id: Types.ObjectId;
            orderNumber: string;
            status: OrderStatus;
            deliveryMode?: 'pickup' | 'delivery';
            pricing?: { total?: number; currency?: string };
            driverEarnings?: number;
            estimatedDistanceKm?: number;
            deliveryAddress?: { city?: string };
            createdAt: Date;
            driverAssignedAt?: Date;
            driverPickedUpAt?: Date;
            deliveredAt?: Date;
          }>
        >()
        .exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);

    return {
      orders: orders.map(o => ({
        _id: o._id.toString(),
        orderNumber: o.orderNumber,
        status: o.status,
        deliveryMode: o.deliveryMode ?? 'pickup',
        total: o.pricing?.total ?? 0,
        currency: o.pricing?.currency ?? 'TND',
        driverEarnings: o.driverEarnings ?? null,
        estimatedDistanceKm: o.estimatedDistanceKm ?? null,
        deliveryCity: o.deliveryAddress?.city ?? null,
        createdAt: o.createdAt,
        driverAssignedAt: o.driverAssignedAt ?? null,
        driverPickedUpAt: o.driverPickedUpAt ?? null,
        deliveredAt: o.deliveredAt ?? null,
      })),
      total,
      page,
      limit,
    };
  }

  // ── Shared internals ────────────────────────────────────────────────────────

  private async fetchProfiles(ids: Types.ObjectId[]): Promise<Map<string, AdminDriverProfile>> {
    const profiles = await this.driverProfileModel
      .find({ userId: { $in: ids } })
      .select('userId idCardNumber address isOnline lastOnlineAt lastKnownLocation lastLocationAt')
      .lean<
        Array<{
          userId: Types.ObjectId;
          idCardNumber: string;
          address: string;
          isOnline?: boolean;
          lastOnlineAt?: Date;
          lastKnownLocation?: { type: 'Point'; coordinates: [number, number] };
          lastLocationAt?: Date;
        }>
      >()
      .exec();

    return new Map(
      profiles.map(p => {
        // GeoJSON stores [lng, lat]. Flip once, here, so no consumer has to
        // remember the order.
        const coords = p.lastKnownLocation?.coordinates;
        const position: DriverPosition | null =
          coords?.length === 2 && coords[0] !== undefined && coords[1] !== undefined
            ? { lng: coords[0], lat: coords[1], at: p.lastLocationAt ?? null }
            : null;

        return [
          p.userId.toString(),
          {
            idCardNumber: p.idCardNumber,
            address: p.address,
            isOnline: p.isOnline ?? false,
            lastOnlineAt: p.lastOnlineAt ?? null,
            lastKnownLocation: position,
          },
        ];
      }),
    );
  }

  /**
   * Lifetime stats for a set of drivers, in two aggregations run in parallel.
   *
   * They are separate rather than one `$facet` because each hits a different
   * index — `{ driverId, status, createdAt }` for the order roll-up and
   * `{ driverUnassignments.driverId }` for the release trail. A single
   * pipeline would need an `$or` match that can use neither.
   */
  private async aggregateStats(ids: Types.ObjectId[]): Promise<Map<string, DriverStats>> {
    const isDelivered = { $eq: ['$status', OrderStatus.DELIVERED] };
    // `$gt: null` is the BSON-order idiom for "present and not null" — a
    // missing date sorts at or below null and is excluded.
    const isTimed = {
      $and: [isDelivered, { $gt: ['$deliveredAt', null] }, { $gt: ['$driverAssignedAt', null] }],
    };

    const [orderRows, unassignRows] = await Promise.all([
      this.orderModel
        .aggregate<OrderStatsRow>([
          { $match: { driverId: { $in: ids } } },
          {
            $group: {
              _id: '$driverId',
              totalAssigned: { $sum: 1 },
              totalDelivered: { $sum: { $cond: [isDelivered, 1, 0] } },
              activeCount: {
                $sum: { $cond: [{ $in: ['$status', DRIVER_ACTIVE_STATUSES] }, 1, 0] },
              },
              totalEarnings: {
                $sum: { $cond: [isDelivered, { $ifNull: ['$driverEarnings', 0] }, 0] },
              },
              lastDeliveredAt: { $max: { $cond: [isDelivered, '$deliveredAt', null] } },
              deliveryMsTotal: {
                $sum: {
                  $cond: [isTimed, { $subtract: ['$deliveredAt', '$driverAssignedAt'] }, 0],
                },
              },
              timedDeliveries: { $sum: { $cond: [isTimed, 1, 0] } },
            },
          },
        ])
        .exec(),

      this.orderModel
        .aggregate<UnassignStatsRow>([
          { $match: { 'driverUnassignments.driverId': { $in: ids } } },
          { $unwind: '$driverUnassignments' },
          { $match: { 'driverUnassignments.driverId': { $in: ids } } },
          {
            $group: {
              _id: '$driverUnassignments.driverId',
              cancellationCount: {
                $sum: { $cond: [{ $eq: ['$driverUnassignments.auto', true] }, 0, 1] },
              },
              autoReleaseCount: {
                $sum: { $cond: [{ $eq: ['$driverUnassignments.auto', true] }, 1, 0] },
              },
            },
          },
        ])
        .exec(),
    ]);

    const unassignMap = new Map(unassignRows.map(r => [r._id.toString(), r]));
    const stats = new Map<string, DriverStats>();

    for (const row of orderRows) {
      const id = row._id.toString();
      const releases = unassignMap.get(id);
      stats.set(id, {
        totalAssigned: row.totalAssigned,
        totalDelivered: row.totalDelivered,
        activeCount: row.activeCount,
        totalEarnings: roundTnd(row.totalEarnings),
        avgDeliveryMinutes:
          row.timedDeliveries > 0
            ? Math.round(row.deliveryMsTotal / row.timedDeliveries / 60_000)
            : null,
        lastDeliveredAt: row.lastDeliveredAt ?? null,
        cancellationCount: releases?.cancellationCount ?? 0,
        autoReleaseCount: releases?.autoReleaseCount ?? 0,
      });
    }

    // A driver who dropped every order they ever took has no row in the order
    // roll-up (the order moved on to someone else) but still has releases.
    for (const [id, releases] of unassignMap) {
      if (!stats.has(id)) {
        stats.set(id, {
          ...EMPTY_STATS,
          cancellationCount: releases.cancellationCount,
          autoReleaseCount: releases.autoReleaseCount,
        });
      }
    }

    return stats;
  }

  /**
   * Flattened unassignment trail for one driver, newest first. Capped — this
   * is a "what went wrong recently" panel, not an export.
   */
  private async fetchUnassignments(oid: Types.ObjectId): Promise<AdminDriverUnassignment[]> {
    const orders = await this.orderModel
      .find({ 'driverUnassignments.driverId': oid })
      .select('orderNumber driverUnassignments')
      .sort({ createdAt: -1 })
      .limit(UNASSIGNMENT_SCAN_LIMIT)
      .lean<
        Array<{
          _id: Types.ObjectId;
          orderNumber: string;
          driverUnassignments?: Array<{
            driverId?: Types.ObjectId;
            reason?: string;
            auto?: boolean;
            at?: Date;
          }>;
        }>
      >()
      .exec();

    const target = oid.toString();
    return orders
      .flatMap(o =>
        (o.driverUnassignments ?? [])
          .filter(u => u.driverId?.toString() === target && u.at)
          .map(u => ({
            orderId: o._id.toString(),
            orderNumber: o.orderNumber,
            reason: u.reason ?? null,
            auto: u.auto ?? false,
            at: u.at as Date,
          })),
      )
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, UNASSIGNMENT_PAGE_SIZE);
  }
}
