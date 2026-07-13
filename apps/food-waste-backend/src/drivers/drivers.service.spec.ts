import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';

import { OrderStatus } from '@foodwaste/shared';

import { Order } from '../orders/schemas/order.schema';
import { DriversService } from './drivers.service';
import { DELIVERY_TIMEOUT_QUEUE } from './processors/delivery-timeout.constants';
import { DriverProfile } from './schemas/driver-profile.schema';
import { DriverNotificationsService } from './services/driver-notifications.service';

const ORDER_ID = '66a1b2c3d4e5f6789012abcd';
const DRIVER_ID = '66a1b2c3d4e5f6789012aaaa';

describe('DriversService', () => {
  let service: DriversService;
  let mockOrderModel: {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    countDocuments: jest.Mock;
    aggregate: jest.Mock;
  };
  let mockDriverProfileModel: {
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    updateOne: jest.Mock;
  };
  let mockQueue: { add: jest.Mock; getJob: jest.Mock };
  let mockNotifications: {
    notifyNearbyDriversOfNewOrder: jest.Mock;
    notifyCustomerDriverAssigned: jest.Mock;
    notifyCustomerOrderPickedUp: jest.Mock;
    notifyCustomerOrderDelivered: jest.Mock;
  };

  /** Default: driver is online with no active order — the accept happy path. */
  const setOnline = (isOnline: boolean): void => {
    mockDriverProfileModel.findOne.mockResolvedValue({ userId: DRIVER_ID, isOnline });
  };
  const setActiveOrderCount = (count: number): void => {
    mockOrderModel.countDocuments.mockResolvedValue(count);
  };
  const resolveUpdateWith = (value: unknown): void => {
    mockOrderModel.findOneAndUpdate.mockReturnValue({
      populate: jest.fn().mockResolvedValue(value),
    });
  };

  beforeEach(async () => {
    mockOrderModel = {
      find: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
      findOne: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      }),
      findOneAndUpdate: jest.fn(),
      countDocuments: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue([]),
    };

    mockDriverProfileModel = {
      findOne: jest.fn().mockResolvedValue({ userId: DRIVER_ID, isOnline: true }),
      findOneAndUpdate: jest.fn().mockResolvedValue({ userId: DRIVER_ID, isOnline: true }),
      updateOne: jest.fn().mockResolvedValue({ matchedCount: 1 }),
    };

    mockQueue = {
      add: jest.fn().mockResolvedValue(undefined),
      getJob: jest.fn().mockResolvedValue({ remove: jest.fn() }),
    };

    mockNotifications = {
      notifyNearbyDriversOfNewOrder: jest.fn().mockResolvedValue(undefined),
      notifyCustomerDriverAssigned: jest.fn().mockResolvedValue(undefined),
      notifyCustomerOrderPickedUp: jest.fn().mockResolvedValue(undefined),
      notifyCustomerOrderDelivered: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriversService,
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
        { provide: getModelToken(DriverProfile.name), useValue: mockDriverProfileModel },
        { provide: getQueueToken(DELIVERY_TIMEOUT_QUEUE), useValue: mockQueue },
        { provide: DriverNotificationsService, useValue: mockNotifications },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config: Record<string, number> = {
                DRIVER_PRE_DISPATCH_BUFFER_MINUTES: 20,
                DRIVER_MAX_RADIUS_METERS: 5000,
                DRIVER_MAX_CONCURRENT_ORDERS: 1,
                DRIVER_DELIVERY_TIMEOUT_MINUTES: 60,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<DriversService>(DriversService);
  });

  describe('getAvailableOrders', () => {
    it('queries with the delivery pool filter when the driver is online and free', async () => {
      await service.getAvailableOrders({ lat: 36.8, lng: 10.1, page: 1, limit: 20 }, DRIVER_ID);

      expect(mockOrderModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryMode: 'delivery',
          status: OrderStatus.CONFIRMED,
          driverId: null,
        }),
      );
    });

    it('returns empty without querying when the driver is offline', async () => {
      setOnline(false);

      const result = await service.getAvailableOrders(
        { lat: 36.8, lng: 10.1, page: 1, limit: 20 },
        DRIVER_ID,
      );

      expect(result).toEqual([]);
      expect(mockOrderModel.find).not.toHaveBeenCalled();
    });

    it('returns empty when the driver already carries an order', async () => {
      setActiveOrderCount(1);

      const result = await service.getAvailableOrders(
        { lat: 36.8, lng: 10.1, page: 1, limit: 20 },
        DRIVER_ID,
      );

      expect(result).toEqual([]);
      expect(mockOrderModel.find).not.toHaveBeenCalled();
    });
  });

  describe('acceptOrder', () => {
    it('assigns the driver and schedules the timeout rescue job', async () => {
      const mockOrder = { _id: ORDER_ID, status: OrderStatus.DRIVER_ASSIGNED };
      resolveUpdateWith(mockOrder);

      const result = await service.acceptOrder(ORDER_ID, DRIVER_ID);

      expect(result).toEqual(mockOrder);
      expect(mockOrderModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ driverId: null, status: OrderStatus.CONFIRMED }),
        expect.objectContaining({
          $set: expect.objectContaining({ status: OrderStatus.DRIVER_ASSIGNED }),
        }),
        expect.anything(),
      );
      expect(mockQueue.add).toHaveBeenCalled();
      expect(mockNotifications.notifyCustomerDriverAssigned).toHaveBeenCalledWith(mockOrder);
    });

    it('rejects an offline driver', async () => {
      setOnline(false);

      await expect(service.acceptOrder(ORDER_ID, DRIVER_ID)).rejects.toThrow(ForbiddenException);
      expect(mockOrderModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('rejects a driver who already carries an order', async () => {
      setActiveOrderCount(1);

      await expect(service.acceptOrder(ORDER_ID, DRIVER_ID)).rejects.toThrow(ConflictException);
      expect(mockOrderModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('throws ConflictException when another driver won the race', async () => {
      resolveUpdateWith(null);

      await expect(service.acceptOrder(ORDER_ID, DRIVER_ID)).rejects.toThrow(ConflictException);
    });
  });

  describe('markPickedUp', () => {
    it('moves DRIVER_ASSIGNED to OUT_FOR_DELIVERY', async () => {
      const mockOrder = { _id: ORDER_ID, status: OrderStatus.OUT_FOR_DELIVERY };
      resolveUpdateWith(mockOrder);

      const result = await service.markPickedUp(ORDER_ID, DRIVER_ID);

      expect(result).toEqual(mockOrder);
      expect(mockOrderModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.DRIVER_ASSIGNED }),
        expect.objectContaining({
          $set: expect.objectContaining({ status: OrderStatus.OUT_FOR_DELIVERY }),
        }),
        expect.anything(),
      );
      expect(mockNotifications.notifyCustomerOrderPickedUp).toHaveBeenCalledWith(mockOrder);
    });

    it('throws NotFoundException when the order is not in DRIVER_ASSIGNED', async () => {
      resolveUpdateWith(null);

      await expect(service.markPickedUp(ORDER_ID, DRIVER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markDelivered', () => {
    it('completes the order and cancels the timeout job', async () => {
      const mockOrder = { _id: ORDER_ID, status: OrderStatus.DELIVERED };
      resolveUpdateWith(mockOrder);

      const result = await service.markDelivered(ORDER_ID, DRIVER_ID);

      expect(result).toEqual(mockOrder);
      expect(mockQueue.getJob).toHaveBeenCalledWith(ORDER_ID);
      expect(mockNotifications.notifyCustomerOrderDelivered).toHaveBeenCalledWith(mockOrder);
    });

    it('throws NotFoundException when the order was never picked up', async () => {
      resolveUpdateWith(null);

      await expect(service.markDelivered(ORDER_ID, DRIVER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('unassignOrder', () => {
    it('returns the order to the pool and records the reason', async () => {
      const mockOrder = { _id: ORDER_ID, status: OrderStatus.CONFIRMED };
      resolveUpdateWith(mockOrder);

      const result = await service.unassignOrder(ORDER_ID, DRIVER_ID, 'Bike broke down');

      expect(result).toEqual(mockOrder);
      expect(mockOrderModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({ status: OrderStatus.CONFIRMED, driverId: null }),
          $push: expect.objectContaining({
            driverUnassignments: expect.objectContaining({
              reason: 'Bike broke down',
              auto: false,
            }),
          }),
        }),
        expect.anything(),
      );
    });

    it('throws NotFoundException when the order is not the driver’s', async () => {
      resolveUpdateWith(null);

      await expect(service.unassignOrder(ORDER_ID, DRIVER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('autoUnassignOnTimeout', () => {
    it('reports true when the stale order was released', async () => {
      resolveUpdateWith({ _id: ORDER_ID, status: OrderStatus.CONFIRMED });

      await expect(service.autoUnassignOnTimeout(ORDER_ID, DRIVER_ID)).resolves.toBe(true);
    });

    it('reports false when the order already moved on', async () => {
      resolveUpdateWith(null);

      await expect(service.autoUnassignOnTimeout(ORDER_ID, DRIVER_ID)).resolves.toBe(false);
    });
  });

  describe('setOnlineStatus', () => {
    it('throws NotFoundException when the driver has no profile', async () => {
      mockDriverProfileModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(service.setOnlineStatus(DRIVER_ID, true)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEarningsSummary', () => {
    it('returns zeroed buckets when the driver has no deliveries', async () => {
      mockOrderModel.aggregate.mockResolvedValue([
        { today: [], thisWeek: [], thisMonth: [], allTime: [] },
      ]);

      const result = await service.getEarningsSummary(DRIVER_ID);

      expect(result).toEqual({
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
        allTime: 0,
        deliveriesToday: 0,
        deliveriesAllTime: 0,
        currency: 'TND',
      });
    });

    it('rounds earnings to millimes', async () => {
      mockOrderModel.aggregate.mockResolvedValue([
        {
          today: [{ total: 7.5, count: 3 }],
          thisWeek: [{ total: 22.5, count: 9 }],
          thisMonth: [{ total: 45.0, count: 18 }],
          allTime: [{ total: 100.0004, count: 40 }],
        },
      ]);

      const result = await service.getEarningsSummary(DRIVER_ID);

      expect(result.today).toBe(7.5);
      expect(result.allTime).toBe(100);
      expect(result.deliveriesAllTime).toBe(40);
    });
  });
});
