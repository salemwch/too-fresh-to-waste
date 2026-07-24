import { Test } from '@nestjs/testing';

import { DonationsAdminController } from '../donations-admin.controller';
import { DonationsService } from '../donations.service';

import type { TestingModule } from '@nestjs/testing';

const VALID_ADMIN_ID = '507f1f77bcf86cd799439099';

const mockPoolStats = {
  totalDonations: 500,
  targetAmount: 1000,
  mealCount: 100,
  contributorCount: 300,
  progressPercentage: 50,
  status: 'active',
  cause: 'Test Cause',
  currency: 'TND',
};

describe('DonationsAdminController', () => {
  let controller: DonationsAdminController;
  let donationsService: {
    getCurrentStats: jest.Mock;
    updateActivePool: jest.Mock;
    resetPool: jest.Mock;
  };

  beforeEach(async () => {
    donationsService = {
      getCurrentStats: jest.fn().mockResolvedValue(mockPoolStats),
      updateActivePool: jest.fn().mockResolvedValue(mockPoolStats),
      resetPool: jest.fn().mockResolvedValue(mockPoolStats),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DonationsAdminController],
      providers: [{ provide: DonationsService, useValue: donationsService }],
    }).compile();

    controller = module.get<DonationsAdminController>(DonationsAdminController);
  });

  describe('getActivePool', () => {
    it('should return active pool stats', async () => {
      const result = await controller.getActivePool();
      expect(result.data).toEqual(mockPoolStats);
    });
  });

  describe('updatePool', () => {
    const dto = { targetAmount: 2000, cause: 'Updated Cause' };

    it('should pass dto to service and return updated stats', async () => {
      const result = await controller.updatePool(dto as never, VALID_ADMIN_ID);
      expect(donationsService.updateActivePool).toHaveBeenCalledWith(dto);
      expect(result.data).toEqual(mockPoolStats);
    });

    it('should log the admin userId (not undefined)', async () => {
      const logSpy = jest.spyOn(controller['logger'], 'log');
      await controller.updatePool(dto as never, VALID_ADMIN_ID);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(VALID_ADMIN_ID));
      expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('undefined'));
    });

    it('should not silently accept undefined adminId', async () => {
      const logSpy = jest.spyOn(controller['logger'], 'log');
      await controller.updatePool(dto as never, undefined as unknown as string);
      // With @CurrentUser('_id') this would log "Admin undefined updating..."
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('undefined'));
    });
  });

  describe('resetPool', () => {
    it('should return fresh pool stats', async () => {
      const result = await controller.resetPool(VALID_ADMIN_ID);
      expect(donationsService.resetPool).toHaveBeenCalledTimes(1);
      expect(result.data).toEqual(mockPoolStats);
    });

    it('should log the admin userId (not undefined)', async () => {
      const logSpy = jest.spyOn(controller['logger'], 'log');
      await controller.resetPool(VALID_ADMIN_ID);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(VALID_ADMIN_ID));
    });
  });
});
