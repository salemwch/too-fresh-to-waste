import { Test } from '@nestjs/testing';

import { CommunityGoalAdminController } from '../community-goal-admin.controller';
import { CommunityGoalService } from '../community-goal.service';

import type { TestingModule } from '@nestjs/testing';

const VALID_ADMIN_ID = '507f1f77bcf86cd799439099';

const mockGoalStats = {
  currentCount: 45,
  targetCount: 100,
  progressPercentage: 45,
  status: 'active',
  participantCount: 30,
  seasonName: 'Summer Challenge',
};

describe('CommunityGoalAdminController', () => {
  let controller: CommunityGoalAdminController;
  let communityGoalService: {
    setGoalTarget: jest.Mock;
    resetGoal: jest.Mock;
  };

  beforeEach(async () => {
    communityGoalService = {
      setGoalTarget: jest.fn().mockResolvedValue(mockGoalStats),
      resetGoal: jest.fn().mockResolvedValue(mockGoalStats),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommunityGoalAdminController],
      providers: [{ provide: CommunityGoalService, useValue: communityGoalService }],
    }).compile();

    controller = module.get<CommunityGoalAdminController>(CommunityGoalAdminController);
  });

  describe('setTarget', () => {
    const dto = { targetCount: 200 };

    it('should pass adminId to service (not undefined)', async () => {
      await controller.setTarget(dto as never, VALID_ADMIN_ID);
      expect(communityGoalService.setGoalTarget).toHaveBeenCalledWith(
        200,
        VALID_ADMIN_ID,
        expect.any(Object),
      );
    });

    it('should return updated goal stats', async () => {
      const result = await controller.setTarget(dto as never, VALID_ADMIN_ID);
      expect(result.data).toEqual(mockGoalStats);
      expect(result.message).toContain('200');
    });

    it('should log admin userId correctly', async () => {
      const logSpy = jest.spyOn(controller['logger'], 'log');
      await controller.setTarget(dto as never, VALID_ADMIN_ID);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(VALID_ADMIN_ID));
      expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('undefined'));
    });

    it('should pass optional dto fields via conditional spread', async () => {
      const fullDto = {
        targetCount: 500,
        causeType: 'food_bank',
        causeTitle: 'Winter Drive',
        seasonName: 'Winter 2026',
        rewardPoints: 100,
      };
      await controller.setTarget(fullDto as never, VALID_ADMIN_ID);
      expect(communityGoalService.setGoalTarget).toHaveBeenCalledWith(500, VALID_ADMIN_ID, {
        causeType: 'food_bank',
        causeTitle: 'Winter Drive',
        seasonName: 'Winter 2026',
        rewardPoints: 100,
      });
    });
  });

  describe('reset', () => {
    it('should pass adminId to resetGoal service (not undefined)', async () => {
      await controller.reset(VALID_ADMIN_ID);
      expect(communityGoalService.resetGoal).toHaveBeenCalledWith(VALID_ADMIN_ID);
    });

    it('should return reset stats', async () => {
      const result = await controller.reset(VALID_ADMIN_ID);
      expect(result.data).toEqual(mockGoalStats);
      expect(result.message).toContain('reset');
    });

    it('should log admin userId correctly', async () => {
      const logSpy = jest.spyOn(controller['logger'], 'log');
      await controller.reset(VALID_ADMIN_ID);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(VALID_ADMIN_ID));
    });
  });
});
