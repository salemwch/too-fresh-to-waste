import { NotFoundException } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';

import { OrderStatus, UserStatus } from '@foodwaste/shared';

import { DriversService } from '../../drivers/drivers.service';
import { DriverProfile } from '../../drivers/schemas/driver-profile.schema';
import { Order } from '../../orders/schemas/order.schema';
import { User } from '../../users/schemas/user.schema';
import { DriverManagementService } from './driver-management.service';

const DRIVER_A = new Types.ObjectId('66a1b2c3d4e5f6789012aaaa');
const DRIVER_B = new Types.ObjectId('66a1b2c3d4e5f6789012bbbb');

const EARNINGS = {
  today: 0,
  thisWeek: 0,
  thisMonth: 0,
  allTime: 0,
  deliveriesToday: 0,
  deliveriesAllTime: 0,
  currency: 'TND' as const,
};

/** A `find(...)` chain that ends in `.exec()`. */
const chain = (result: unknown) => ({
  find: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(result),
  }),
});

describe('DriverManagementService', () => {
  let service: DriverManagementService;
  let userModel: { find: jest.Mock; findOne: jest.Mock };
  let orderModel: { find: jest.Mock; countDocuments: jest.Mock; aggregate: jest.Mock };
  let profileModel: { find: jest.Mock };
  let driversService: { getEarningsSummary: jest.Mock };

  /** Queues the two `aggregate()` results in the order the service calls them. */
  const mockAggregates = (orderRows: unknown[], unassignRows: unknown[]): void => {
    orderModel.aggregate
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(orderRows) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(unassignRows) });
  };

  const driverDoc = (id: Types.ObjectId) => ({
    _id: id,
    firstName: 'Ali',
    lastName: 'Ben Salem',
    email: 'ali@example.com',
    status: UserStatus.ACTIVE,
    requiresPasswordChange: false,
    createdAt: new Date('2026-01-01'),
  });

  beforeEach(async () => {
    userModel = { ...chain([]), findOne: jest.fn() };
    orderModel = {
      ...chain([]),
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      aggregate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
    };
    profileModel = chain([]);
    driversService = { getEarningsSummary: jest.fn().mockResolvedValue(EARNINGS) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriverManagementService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Order.name), useValue: orderModel },
        { provide: getModelToken(DriverProfile.name), useValue: profileModel },
        { provide: getConnectionToken(), useValue: { startSession: jest.fn() } },
        { provide: DriversService, useValue: driversService },
      ],
    }).compile();

    service = module.get(DriverManagementService);
  });

  // ── getDrivers ──────────────────────────────────────────────────────────────

  describe('getDrivers', () => {
    it('returns an empty list without touching orders when there are no drivers', async () => {
      const result = await service.getDrivers();

      expect(result).toEqual([]);
      // The roll-ups are skipped entirely — an unfiltered `$in: []` aggregation
      // over every order is exactly the scan this early return avoids.
      expect(orderModel.aggregate).not.toHaveBeenCalled();
      expect(profileModel.find).not.toHaveBeenCalled();
    });

    it('gives a driver with no orders and no profile a zeroed stat block', async () => {
      Object.assign(userModel, chain([driverDoc(DRIVER_A)]));
      mockAggregates([], []);

      const [row] = await service.getDrivers();

      expect(row?.driverProfile).toBeNull();
      expect(row?.stats).toEqual({
        totalAssigned: 0,
        totalDelivered: 0,
        activeCount: 0,
        totalEarnings: 0,
        avgDeliveryMinutes: null,
        lastDeliveredAt: null,
        cancellationCount: 0,
        autoReleaseCount: 0,
      });
    });

    it('merges the order roll-up with the release roll-up per driver', async () => {
      Object.assign(userModel, chain([driverDoc(DRIVER_A)]));
      mockAggregates(
        [
          {
            _id: DRIVER_A,
            totalAssigned: 10,
            totalDelivered: 8,
            activeCount: 1,
            totalEarnings: 42.5,
            lastDeliveredAt: new Date('2026-07-01'),
            deliveryMsTotal: 8 * 30 * 60_000,
            timedDeliveries: 8,
          },
        ],
        [{ _id: DRIVER_A, cancellationCount: 3, autoReleaseCount: 2 }],
      );

      const [row] = await service.getDrivers();

      expect(row?.stats.totalDelivered).toBe(8);
      expect(row?.stats.avgDeliveryMinutes).toBe(30);
      expect(row?.stats.cancellationCount).toBe(3);
      expect(row?.stats.autoReleaseCount).toBe(2);
    });

    it('still reports releases for a driver who currently holds no orders', async () => {
      // Someone who drops every order they accept has no row in the order
      // roll-up at all — the order has moved on to another driver. Without the
      // second merge pass their unreliability would be invisible.
      Object.assign(userModel, chain([driverDoc(DRIVER_A)]));
      mockAggregates([], [{ _id: DRIVER_A, cancellationCount: 5, autoReleaseCount: 1 }]);

      const [row] = await service.getDrivers();

      expect(row?.stats.cancellationCount).toBe(5);
      expect(row?.stats.autoReleaseCount).toBe(1);
      expect(row?.stats.totalDelivered).toBe(0);
    });

    it('leaves avgDeliveryMinutes null when no delivery has both timestamps', async () => {
      // `timedDeliveries: 0` would make the mean a division by zero — NaN
      // reaching the UI as "NaN min" is the failure this guards.
      Object.assign(userModel, chain([driverDoc(DRIVER_A)]));
      mockAggregates(
        [
          {
            _id: DRIVER_A,
            totalAssigned: 2,
            totalDelivered: 2,
            activeCount: 0,
            totalEarnings: 10,
            lastDeliveredAt: null,
            deliveryMsTotal: 0,
            timedDeliveries: 0,
          },
        ],
        [],
      );

      const [row] = await service.getDrivers();

      expect(row?.stats.avgDeliveryMinutes).toBeNull();
    });

    it('rounds earnings to three decimals, the precision TND actually has', async () => {
      Object.assign(userModel, chain([driverDoc(DRIVER_A)]));
      mockAggregates(
        [
          {
            _id: DRIVER_A,
            totalAssigned: 3,
            totalDelivered: 3,
            activeCount: 0,
            totalEarnings: 10.1 + 20.2, // 30.299999999999997 in float
            lastDeliveredAt: null,
            deliveryMsTotal: 0,
            timedDeliveries: 0,
          },
        ],
        [],
      );

      const [row] = await service.getDrivers();

      expect(row?.stats.totalEarnings).toBe(30.3);
    });

    it('does not leak one driver’s stats onto another', async () => {
      Object.assign(userModel, chain([driverDoc(DRIVER_A), { ...driverDoc(DRIVER_B) }]));
      mockAggregates(
        [
          {
            _id: DRIVER_B,
            totalAssigned: 4,
            totalDelivered: 4,
            activeCount: 0,
            totalEarnings: 12,
            lastDeliveredAt: null,
            deliveryMsTotal: 0,
            timedDeliveries: 0,
          },
        ],
        [],
      );

      const rows = await service.getDrivers();

      expect(rows[0]?.stats.totalDelivered).toBe(0);
      expect(rows[1]?.stats.totalDelivered).toBe(4);
    });

    describe('last known position', () => {
      const withProfile = async (lastKnownLocation: unknown) => {
        Object.assign(userModel, chain([driverDoc(DRIVER_A)]));
        Object.assign(
          profileModel,
          chain([
            {
              userId: DRIVER_A,
              idCardNumber: '12345678',
              address: 'Tunis',
              isOnline: true,
              lastKnownLocation,
              lastLocationAt: new Date('2026-07-02'),
            },
          ]),
        );
        mockAggregates([], []);
        const [row] = await service.getDrivers();
        return row?.driverProfile ?? null;
      };

      it('flips GeoJSON [lng, lat] into named lat/lng at the boundary', async () => {
        // Tunis is 36.8 N, 10.18 E. Stored lng-first, a naive read would place
        // the driver in the Gulf of Aden.
        const profile = await withProfile({ type: 'Point', coordinates: [10.18, 36.8] });

        expect(profile?.lastKnownLocation).toEqual({
          lat: 36.8,
          lng: 10.18,
          at: new Date('2026-07-02'),
        });
      });

      it('reports no position when the driver has never sent one', async () => {
        const profile = await withProfile(undefined);
        expect(profile?.lastKnownLocation).toBeNull();
        expect(profile?.isOnline).toBe(true);
      });

      it('reports no position for a malformed coordinate pair', async () => {
        // A half-written point must not render as `(10.18, undefined)`.
        const profile = await withProfile({ type: 'Point', coordinates: [10.18] });
        expect(profile?.lastKnownLocation).toBeNull();
      });
    });
  });

  // ── getDriverDetail ─────────────────────────────────────────────────────────

  describe('getDriverDetail', () => {
    const resolveDriver = (doc: unknown): void => {
      userModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(doc),
      });
    };

    it('rejects a malformed id without querying', async () => {
      await expect(service.getDriverDetail('not-an-object-id')).rejects.toThrow(NotFoundException);
      expect(userModel.findOne).not.toHaveBeenCalled();
    });

    it('rejects an id that is well-formed but matches no driver', async () => {
      resolveDriver(null);
      await expect(service.getDriverDetail(DRIVER_A.toString())).rejects.toThrow(NotFoundException);
    });

    it('delegates earnings to DriversService so admin and driver see one number', async () => {
      resolveDriver({ ...driverDoc(DRIVER_A), lastLoginAt: new Date('2026-06-01') });
      mockAggregates([], []);

      const detail = await service.getDriverDetail(DRIVER_A.toString());

      expect(driversService.getEarningsSummary).toHaveBeenCalledWith(DRIVER_A.toString());
      expect(detail.earnings).toBe(EARNINGS);
      expect(detail.driver.lastLoginAt).toEqual(new Date('2026-06-01'));
    });

    it('reports lastLoginAt as null for a driver who has never signed in', async () => {
      resolveDriver(driverDoc(DRIVER_A));
      mockAggregates([], []);

      const detail = await service.getDriverDetail(DRIVER_A.toString());

      expect(detail.driver.lastLoginAt).toBeNull();
    });

    describe('unassignment trail', () => {
      const withOrders = async (orders: unknown[]) => {
        resolveDriver(driverDoc(DRIVER_A));
        mockAggregates([], []);
        Object.assign(orderModel, chain(orders));
        const detail = await service.getDriverDetail(DRIVER_A.toString());
        return detail.unassignments;
      };

      it('keeps only the entries belonging to this driver', async () => {
        // An order can be dropped by several drivers in turn; the trail must
        // not attribute another driver's abandonment to this one.
        const trail = await withOrders([
          {
            _id: new Types.ObjectId(),
            orderNumber: 'ORD-1',
            driverUnassignments: [
              {
                driverId: DRIVER_B,
                reason: 'other driver',
                auto: false,
                at: new Date('2026-05-01'),
              },
              { driverId: DRIVER_A, reason: 'bike broke', auto: false, at: new Date('2026-05-02') },
            ],
          },
        ]);

        expect(trail).toHaveLength(1);
        expect(trail[0]?.reason).toBe('bike broke');
      });

      it('sorts newest first across orders', async () => {
        const trail = await withOrders([
          {
            _id: new Types.ObjectId(),
            orderNumber: 'ORD-OLD',
            driverUnassignments: [{ driverId: DRIVER_A, auto: false, at: new Date('2026-01-01') }],
          },
          {
            _id: new Types.ObjectId(),
            orderNumber: 'ORD-NEW',
            driverUnassignments: [{ driverId: DRIVER_A, auto: true, at: new Date('2026-06-01') }],
          },
        ]);

        expect(trail.map(u => u.orderNumber)).toEqual(['ORD-NEW', 'ORD-OLD']);
      });

      it('distinguishes a timeout release from a driver-initiated drop', async () => {
        const trail = await withOrders([
          {
            _id: new Types.ObjectId(),
            orderNumber: 'ORD-1',
            driverUnassignments: [{ driverId: DRIVER_A, auto: true, at: new Date('2026-06-01') }],
          },
        ]);

        expect(trail[0]?.auto).toBe(true);
        expect(trail[0]?.reason).toBeNull();
      });

      it('skips entries with no timestamp rather than emitting an invalid date', async () => {
        const trail = await withOrders([
          {
            _id: new Types.ObjectId(),
            orderNumber: 'ORD-1',
            driverUnassignments: [{ driverId: DRIVER_A, auto: false }],
          },
        ]);

        expect(trail).toEqual([]);
      });

      it('tolerates an order whose trail array is absent', async () => {
        const trail = await withOrders([{ _id: new Types.ObjectId(), orderNumber: 'ORD-1' }]);
        expect(trail).toEqual([]);
      });
    });
  });

  // ── getDriverOrders ─────────────────────────────────────────────────────────

  describe('getDriverOrders', () => {
    it('rejects a malformed id without querying', async () => {
      await expect(service.getDriverOrders('nope', {})).rejects.toThrow(NotFoundException);
      expect(orderModel.find).not.toHaveBeenCalled();
    });

    it('returns every status when none is requested', async () => {
      await service.getDriverOrders(DRIVER_A.toString(), {});

      const filter = orderModel.find.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(filter).not.toHaveProperty('status');
      expect(filter['driverId']).toBeInstanceOf(Types.ObjectId);
    });

    it('narrows to the requested status when one is given', async () => {
      await service.getDriverOrders(DRIVER_A.toString(), { status: OrderStatus.CANCELLED });

      const filter = orderModel.find.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(filter['status']).toBe(OrderStatus.CANCELLED);
    });

    it('counts with the same filter it lists with', async () => {
      await service.getDriverOrders(DRIVER_A.toString(), { status: OrderStatus.DELIVERED });

      // A count taken over a different filter makes the last page unreachable
      // or shows pages that render empty.
      expect(orderModel.countDocuments.mock.calls[0]?.[0]).toEqual(
        orderModel.find.mock.calls[0]?.[0],
      );
    });

    it('defaults to page 1 with 20 per page', async () => {
      const page = await service.getDriverOrders(DRIVER_A.toString(), {});
      expect(page.page).toBe(1);
      expect(page.limit).toBe(20);
    });

    it('normalises a sparse order document instead of emitting undefined fields', async () => {
      // Pickup orders carry none of the delivery fields, and they share this
      // endpoint — every optional must land as an explicit null.
      Object.assign(
        orderModel,
        chain([
          {
            _id: DRIVER_A,
            orderNumber: 'ORD-1',
            status: OrderStatus.CANCELLED,
            createdAt: new Date('2026-03-01'),
          },
        ]),
      );

      const { orders } = await service.getDriverOrders(DRIVER_A.toString(), {});

      expect(orders[0]).toMatchObject({
        deliveryMode: 'pickup',
        total: 0,
        currency: 'TND',
        driverEarnings: null,
        estimatedDistanceKm: null,
        deliveryCity: null,
        driverAssignedAt: null,
        driverPickedUpAt: null,
        deliveredAt: null,
      });
    });
  });
});
