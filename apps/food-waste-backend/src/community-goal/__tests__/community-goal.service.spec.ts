/* eslint-disable require-await */
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';

import { LoyaltyService } from '../../loyalty/loyalty.service';
import { WebSocketService } from '../../websocket/websocket.service';
import { CommunityGoalService } from '../community-goal.service';
import { CommunityBagGoal, CommunityGoalStatus } from '../schemas/community-bag-goal.schema';

import type { TestingModule } from '@nestjs/testing';

const USER_A = '660000000000000000000001';
const USER_B = '660000000000000000000002';
const USER_C = '660000000000000000000003';
const GOAL_ID = '670000000000000000000001';

const makeGoal = (overrides: Record<string, unknown> = {}) => ({
  _id: GOAL_ID,
  currentCount: 0,
  targetCount: 100,
  cycleNumber: 1,
  status: CommunityGoalStatus.ACTIVE,
  rewardPoints: 50,
  seasonName: 'Test Challenge',
  participantIds: [],
  updatedAt: new Date(),
  ...overrides,
});

const createMockModel = () => {
  let activeGoal = makeGoal();

  const model = {
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockImplementation(async () => ({ ...activeGoal })),
      }),
    }),
    findOneAndUpdate: jest.fn().mockImplementation((_filter, update, _opts) => {
      if (update.$inc?.currentCount) {
        activeGoal.currentCount += update.$inc.currentCount;
      }
      if (update.$addToSet?.participantIds) {
        const id = update.$addToSet.participantIds;
        if (
          !activeGoal.participantIds.some(
            (p: { toString: () => string }) => p.toString() === id.toString(),
          )
        ) {
          (activeGoal.participantIds as string[]).push(id);
        }
      }
      if (update.$set) {
        Object.assign(activeGoal, update.$set);
      }
      return {
        exec: jest.fn().mockResolvedValue({ ...activeGoal }),
      };
    }),
    create: jest.fn().mockImplementation(async data => {
      const newGoal = makeGoal(data);
      activeGoal = newGoal;
      return { ...newGoal, toObject: () => ({ ...newGoal }) };
    }),
    countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(1) }),
    _reset: (overrides: Record<string, unknown> = {}) => {
      activeGoal = makeGoal(overrides);
    },
    _getGoal: () => activeGoal,
  };

  return model;
};

describe('CommunityGoalService', () => {
  let service: CommunityGoalService;
  let mockModel: ReturnType<typeof createMockModel>;
  let mockLoyaltyService: { addPoints: jest.Mock };
  let mockWsService: { sendToRoom: jest.Mock };

  beforeEach(async () => {
    mockModel = createMockModel();
    mockLoyaltyService = { addPoints: jest.fn().mockResolvedValue({}) };
    mockWsService = { sendToRoom: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityGoalService,
        { provide: getModelToken(CommunityBagGoal.name), useValue: mockModel },
        { provide: LoyaltyService, useValue: mockLoyaltyService },
        { provide: WebSocketService, useValue: mockWsService },
      ],
    }).compile();

    service = module.get(CommunityGoalService);
  });

  describe('incrementBagCount — participant tracking', () => {
    it('should include $addToSet with userId when userId is provided', async () => {
      await service.incrementBagCount(1, USER_A);

      expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
        { status: CommunityGoalStatus.ACTIVE },
        expect.objectContaining({
          $inc: { currentCount: 1 },
          $addToSet: { participantIds: USER_A },
        }),
        expect.any(Object),
      );
    });

    it('should NOT include $addToSet when userId is omitted', async () => {
      await service.incrementBagCount(1);

      const updateArg = mockModel.findOneAndUpdate.mock.calls[0][1];
      expect(updateArg.$addToSet).toBeUndefined();
    });
  });

  describe('reward distribution on goal completion', () => {
    it('should award rewardPoints to ALL participants when target is reached', async () => {
      mockModel._reset({
        currentCount: 98,
        targetCount: 100,
        rewardPoints: 50,
        participantIds: [USER_A, USER_B, USER_C],
      });

      await service.incrementBagCount(2, USER_A);

      expect(mockLoyaltyService.addPoints).toHaveBeenCalledTimes(3);
      expect(mockLoyaltyService.addPoints).toHaveBeenCalledWith(
        USER_A,
        expect.objectContaining({ amount: 50, reason: expect.stringContaining('cycle') }),
      );
      expect(mockLoyaltyService.addPoints).toHaveBeenCalledWith(
        USER_B,
        expect.objectContaining({ amount: 50 }),
      );
      expect(mockLoyaltyService.addPoints).toHaveBeenCalledWith(
        USER_C,
        expect.objectContaining({ amount: 50 }),
      );
    });

    it('should skip reward distribution when rewardPoints is 0', async () => {
      mockModel._reset({
        currentCount: 99,
        targetCount: 100,
        rewardPoints: 0,
        participantIds: [USER_A, USER_B],
      });

      await service.incrementBagCount(1, USER_A);

      expect(mockLoyaltyService.addPoints).not.toHaveBeenCalled();
    });

    it('should skip reward distribution when no participants', async () => {
      mockModel._reset({
        currentCount: 99,
        targetCount: 100,
        rewardPoints: 50,
        participantIds: [],
      });

      await service.incrementBagCount(1);

      expect(mockLoyaltyService.addPoints).not.toHaveBeenCalled();
    });

    it('should not fail if one participant reward fails (Promise.allSettled)', async () => {
      mockModel._reset({
        currentCount: 99,
        targetCount: 100,
        rewardPoints: 25,
        participantIds: [USER_A, USER_B],
      });

      mockLoyaltyService.addPoints
        .mockRejectedValueOnce(new Error('Loyalty account not found'))
        .mockResolvedValueOnce({});

      await expect(service.incrementBagCount(1, USER_A)).resolves.toBeDefined();

      expect(mockLoyaltyService.addPoints).toHaveBeenCalledTimes(2);
    });
  });

  describe('new cycle creation', () => {
    it('should carry rewardPoints and seasonName to the new cycle', async () => {
      mockModel._reset({
        currentCount: 99,
        targetCount: 100,
        rewardPoints: 75,
        seasonName: 'Summer Sprint',
        participantIds: [USER_A],
      });

      await service.incrementBagCount(1, USER_A);

      expect(mockModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rewardPoints: 75,
          seasonName: 'Summer Sprint',
          cycleNumber: 2,
          status: CommunityGoalStatus.ACTIVE,
        }),
      );
    });

    it('should carry overflow bags to new cycle', async () => {
      mockModel._reset({
        currentCount: 95,
        targetCount: 100,
        rewardPoints: 50,
        participantIds: [USER_A],
      });

      await service.incrementBagCount(10, USER_A);

      expect(mockModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          currentCount: 5,
        }),
      );
    });
  });

  describe('getStats', () => {
    it('should return rewardPoints, seasonName, and participantCount', async () => {
      mockModel._reset({
        rewardPoints: 100,
        seasonName: 'Ramadan Challenge',
        participantIds: [USER_A, USER_B],
      });

      const stats = await service.getStats();

      expect(stats.rewardPoints).toBe(100);
      expect(stats.seasonName).toBe('Ramadan Challenge');
      expect(stats.participantCount).toBe(2);
    });
  });
});
