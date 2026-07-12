import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { Order } from '../orders/schemas/order.schema';
import { OrderStatus } from '@foodwaste/shared';

describe('DriversService', () => {
  let service: DriversService;
  let mockOrderModel: {
    find: jest.Mock;
    findOneAndUpdate: jest.Mock;
  };
  let mockConfigService: { get: jest.Mock };

  beforeEach(async () => {
    mockOrderModel = {
      find: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
      findOneAndUpdate: jest.fn(),
    };
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        const config: Record<string, number> = {
          DRIVER_PRE_DISPATCH_BUFFER_MINUTES: 20,
          DRIVER_MAX_RADIUS_METERS: 5000,
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriversService,
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<DriversService>(DriversService);
  });

  describe('getAvailableOrders', () => {
    it('queries with correct delivery filter', async () => {
      await service.getAvailableOrders({ lat: 36.8, lng: 10.1, page: 1, limit: 20 });
      expect(mockOrderModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryMode: 'delivery',
          status: OrderStatus.CONFIRMED,
          driverId: null,
        }),
      );
    });
  });

  describe('acceptOrder', () => {
    it('returns the order on success', async () => {
      const mockOrder = { _id: 'order1', status: OrderStatus.OUT_FOR_DELIVERY };
      mockOrderModel.findOneAndUpdate.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockOrder),
      });
      const result = await service.acceptOrder(
        '66a1b2c3d4e5f6789012abcd',
        '66a1b2c3d4e5f6789012aaaa',
      );
      expect(result).toEqual(mockOrder);
    });

    it('throws ConflictException when order already taken', async () => {
      mockOrderModel.findOneAndUpdate.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.acceptOrder('66a1b2c3d4e5f6789012abcd', '66a1b2c3d4e5f6789012aaaa'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('markDelivered', () => {
    it('returns the order on success', async () => {
      const mockOrder = { _id: 'order1', status: OrderStatus.DELIVERED };
      mockOrderModel.findOneAndUpdate.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockOrder),
      });
      const result = await service.markDelivered(
        '66a1b2c3d4e5f6789012abcd',
        '66a1b2c3d4e5f6789012aaaa',
      );
      expect(result).toEqual(mockOrder);
    });

    it('throws NotFoundException when order not found', async () => {
      mockOrderModel.findOneAndUpdate.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.markDelivered('66a1b2c3d4e5f6789012abcd', '66a1b2c3d4e5f6789012aaaa'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('unassignOrder', () => {
    it('returns the order on success', async () => {
      const mockOrder = {
        _id: 'order1',
        status: OrderStatus.CONFIRMED,
        driverCancellationCount: 1,
      };
      mockOrderModel.findOneAndUpdate.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockOrder),
      });
      const result = await service.unassignOrder(
        '66a1b2c3d4e5f6789012abcd',
        '66a1b2c3d4e5f6789012aaaa',
      );
      expect(result).toEqual(mockOrder);
    });

    it('throws NotFoundException when order not found or wrong driver', async () => {
      mockOrderModel.findOneAndUpdate.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.unassignOrder('66a1b2c3d4e5f6789012abcd', '66a1b2c3d4e5f6789012aaaa'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
