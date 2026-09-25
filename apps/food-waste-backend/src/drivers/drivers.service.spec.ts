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
import { DriverCashService } from './services/driver-cash.service';
import { DriverNotificationsService } from './services/driver-notifications.service';
import { EventBusService } from '../common/services/event-bus/event-bus.service';

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
    findById: jest.Mock;
  };
  let mockDriverProfileModel: {
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    updateOne: jest.Mock;
  };
  let mockQueue: { add: jest.Mock; getJob: jest.Mock };
  let mockEventBus: { emit: jest.Mock };
  let mockNotifications: {
    notifyNearbyDriversOfNewOrder: jest.Mock;
    notifyCustomerDriverAssigned: jest.Mock;
    notifyCustomerOrderPickedUp: jest.Mock;
    notifyCustomerOrderDelivered: jest.Mock;
  };
  /**
   * The money transitions are DriverCashService's, and run against a real
   * MongoDB in driver-cash.integration.spec.ts. Here: that DriversService hands
   * off to it, and keeps the notifications and timeouts that are its own job.
   */
  let mockDriverCash: {
    onMerchantPickup: jest.Mock;
    onDelivered: jest.Mock;
    onFailed: jest.Mock;
    reconciliation: jest.Mock;
  };
  /** What `findById().populate()` returns after a transition. */
  const resolvePopulatedWith = (value: unknown): void => {
    mockOrderModel.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(value) });
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
      findById: jest.fn(),
    };

    mockDriverCash = {
      onMerchantPickup: jest.fn().mockResolvedValue({ order: {}, instruction: {} }),
      onDelivered: jest.fn().mockResolvedValue({}),
      onFailed: jest.fn().mockResolvedValue({}),
      reconciliation: jest.fn().mockResolvedValue({ drivers: [] }),
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

    mockEventBus = { emit: jest.fn().mockResolvedValue(undefined) };

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
        { provide: DriverCashService, useValue: mockDriverCash },
        { provide: EventBusService, useValue: mockEventBus },
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
    it('hands the money transition to DriverCashService, then notifies with the frozen order', async () => {
      const mockOrder = {
        _id: ORDER_ID,
        status: OrderStatus.OUT_FOR_DELIVERY,
        driverInstruction: { payMerchant: 5, collectFromCustomer: 14, driverKeeps: 3.2 },
      };
      resolvePopulatedWith(mockOrder);

      const result = await service.markPickedUp(ORDER_ID, DRIVER_ID);

      expect(mockDriverCash.onMerchantPickup).toHaveBeenCalledWith(ORDER_ID, DRIVER_ID);
      expect(result).toEqual(mockOrder);
      expect(mockNotifications.notifyCustomerOrderPickedUp).toHaveBeenCalledWith(mockOrder);
    });

    it('propagates NotFoundException when the order is not in DRIVER_ASSIGNED', async () => {
      mockDriverCash.onMerchantPickup.mockRejectedValue(new NotFoundException());

      await expect(service.markPickedUp(ORDER_ID, DRIVER_ID)).rejects.toThrow(NotFoundException);
      expect(mockNotifications.notifyCustomerOrderPickedUp).not.toHaveBeenCalled();
    });

    it('rejects a malformed order id before touching money', async () => {
      await expect(service.markPickedUp('not-an-id', DRIVER_ID)).rejects.toThrow(NotFoundException);
      expect(mockDriverCash.onMerchantPickup).not.toHaveBeenCalled();
    });
  });

  describe('markDelivered', () => {
    it('records the collected cash, cancels the timeout job and notifies', async () => {
      const mockOrder = { _id: ORDER_ID, status: OrderStatus.DELIVERED };
      resolvePopulatedWith(mockOrder);

      const result = await service.markDelivered(ORDER_ID, DRIVER_ID, 14);

      expect(mockDriverCash.onDelivered).toHaveBeenCalledWith(ORDER_ID, DRIVER_ID, 14);
      expect(result).toEqual(mockOrder);
      expect(mockQueue.getJob).toHaveBeenCalledWith(ORDER_ID);
      expect(mockNotifications.notifyCustomerOrderDelivered).toHaveBeenCalledWith(mockOrder);
    });

    it('passes an absent amount through as absent, never as zero', async () => {
      resolvePopulatedWith({ _id: ORDER_ID });

      await service.markDelivered(ORDER_ID, DRIVER_ID);

      expect(mockDriverCash.onDelivered).toHaveBeenCalledWith(ORDER_ID, DRIVER_ID, undefined);
    });

    it('propagates NotFoundException when the order was never picked up', async () => {
      mockDriverCash.onDelivered.mockRejectedValue(new NotFoundException());

      await expect(service.markDelivered(ORDER_ID, DRIVER_ID)).rejects.toThrow(NotFoundException);
      expect(mockQueue.getJob).not.toHaveBeenCalled();
      // A delivery that did not happen is not a completed sale.
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('emits order.completed, so loyalty and the charity see a delivered sale', async () => {
      const deliveredAt = new Date('2026-09-25T12:00:00.000Z');
      resolvePopulatedWith({
        _id: ORDER_ID,
        status: OrderStatus.DELIVERED,
        customerId: { _id: 'customer-1', toString: () => 'customer-1' },
        merchantId: 'merchant-1',
        establishmentId: 'establishment-1',
        items: [
          { quantity: 2, offerId: 'offer-1' },
          { quantity: 1, offerId: 'offer-2' },
        ],
        pricing: { subtotal: 12, total: 15 },
        paymentDetails: { method: 'pay_on_delivery' },
        deliveredAt,
      });

      await service.markDelivered(ORDER_ID, DRIVER_ID, 15);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'order.completed',
        expect.objectContaining({
          orderId: ORDER_ID,
          userId: 'customer-1',
          merchantId: 'merchant-1',
          totalAmount: 15,
          // The charity basis is the food subtotal, never the delivery fee.
          subtotalAmount: 12,
          establishmentId: 'establishment-1',
          completedAt: deliveredAt,
          metadata: expect.objectContaining({ itemCount: 3, paymentMethod: 'pay_on_delivery' }),
        }),
      );
    });

    it('still completes the delivery when the event cannot be emitted', async () => {
      const mockOrder = { _id: ORDER_ID, status: OrderStatus.DELIVERED, items: [] };
      resolvePopulatedWith(mockOrder);
      mockEventBus.emit.mockRejectedValue(new Error('broker down'));

      await expect(service.markDelivered(ORDER_ID, DRIVER_ID, 0)).resolves.toEqual(mockOrder);
    });
  });

  describe('failDelivery', () => {
    it('records the failure and releases the delivery timeout', async () => {
      resolvePopulatedWith({ _id: ORDER_ID, status: OrderStatus.CANCELLED });
      const input = { reason: 'CUSTOMER_REFUSED' as const, recovery: 'UNRECOVERABLE' as const };

      await service.failDelivery(ORDER_ID, DRIVER_ID, input);

      expect(mockDriverCash.onFailed).toHaveBeenCalledWith(ORDER_ID, DRIVER_ID, input);
      expect(mockQueue.getJob).toHaveBeenCalledWith(ORDER_ID);
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

    it('only ever releases an order the driver has not collected yet', async () => {
      resolveUpdateWith({ _id: ORDER_ID, status: OrderStatus.CONFIRMED });

      await service.unassignOrder(ORDER_ID, DRIVER_ID);

      // Not DRIVER_ACTIVE_STATUSES: after pickup the merchant has been paid from
      // the float and the food is with this driver.
      expect(mockOrderModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.DRIVER_ASSIGNED }),
        expect.anything(),
        expect.anything(),
      );
    });

    it('refuses to release an order already collected - report a problem instead', async () => {
      resolveUpdateWith(null);
      mockOrderModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest
            .fn()
            .mockResolvedValue({ _id: ORDER_ID, status: OrderStatus.OUT_FOR_DELIVERY }),
        }),
      });

      await expect(service.unassignOrder(ORDER_ID, DRIVER_ID)).rejects.toThrow(ConflictException);
      expect(mockQueue.getJob).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the order is not the driver’s', async () => {
      resolveUpdateWith(null);
      mockOrderModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      });

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

    it('never auto-releases a collected order - the food and the float money are with the driver', async () => {
      resolveUpdateWith(null);

      await service.autoUnassignOnTimeout(ORDER_ID, DRIVER_ID);

      expect(mockOrderModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.DRIVER_ASSIGNED }),
        expect.anything(),
        expect.anything(),
      );
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
