import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';

import { DonationsController } from '../donations.controller';
import { DonationsService } from '../donations.service';

import type { TestingModule } from '@nestjs/testing';

const VALID_USER_ID = '507f1f77bcf86cd799439011';

const mockUserStats = {
  totalDonated: 12.5,
  totalMeals: 2,
  badgesEarned: ['first_step'],
  rank: 42,
  contributions: [],
};

const mockPoolStats = {
  totalDonations: 847.3,
  targetAmount: 1000,
  mealCount: 169,
  contributorCount: 1843,
  progressPercentage: 84.73,
  status: 'active',
  cause: 'Community Food Relief',
  currency: 'TND',
};

describe('DonationsController', () => {
  let controller: DonationsController;
  let donationsService: { getCurrentStats: jest.Mock; getUserStats: jest.Mock };

  beforeEach(async () => {
    donationsService = {
      getCurrentStats: jest.fn().mockResolvedValue(mockPoolStats),
      getUserStats: jest.fn().mockResolvedValue(mockUserStats),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DonationsController],
      providers: [{ provide: DonationsService, useValue: donationsService }],
    }).compile();

    controller = module.get<DonationsController>(DonationsController);
  });

  describe('getCurrentDonationStats (public)', () => {
    it('should return pool stats without authentication', async () => {
      const result = await controller.getCurrentDonationStats();
      expect(result.data).toEqual(mockPoolStats);
      expect(donationsService.getCurrentStats).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUserDonationStats', () => {
    it('should pass valid userId to service as ObjectId', async () => {
      await controller.getUserDonationStats(VALID_USER_ID);

      expect(donationsService.getUserStats).toHaveBeenCalledTimes(1);
      const arg = donationsService.getUserStats.mock.calls[0][0];
      expect(arg).toBeInstanceOf(Types.ObjectId);
      expect(arg.toString()).toBe(VALID_USER_ID);
    });

    it('should return user donation stats', async () => {
      const result = await controller.getUserDonationStats(VALID_USER_ID);
      expect(result.data).toEqual(mockUserStats);
      expect(result.message).toContain('successfully');
    });

    it('should query with a random ObjectId when userId is undefined (the old bug)', async () => {
      // When @CurrentUser('_id') was used, userId was undefined.
      // new Types.ObjectId(undefined) generates a RANDOM ObjectId — the query
      // silently returns empty/wrong data instead of throwing.
      // This test documents the bug behavior: the service IS called, but with
      // a random ID that doesn't match any real user.
      await controller.getUserDonationStats(undefined as unknown as string);
      const arg = donationsService.getUserStats.mock.calls[0][0];
      expect(arg).toBeInstanceOf(Types.ObjectId);
      // A random ObjectId will NOT equal the user's real ID
      expect(arg.toString()).not.toBe(VALID_USER_ID);
    });

    it('should throw when userId is an invalid ObjectId', async () => {
      await expect(controller.getUserDonationStats('not-an-objectid')).rejects.toThrow();
    });

    it('should propagate service errors', async () => {
      donationsService.getUserStats.mockRejectedValueOnce(new Error('DB connection lost'));
      await expect(controller.getUserDonationStats(VALID_USER_ID)).rejects.toThrow(
        'DB connection lost',
      );
    });
  });
});
