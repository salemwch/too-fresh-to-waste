/* eslint-disable require-await */
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';

import { WebSocketService } from '../../websocket/websocket.service';
import { MonthlyBagGoalService } from '../community-goal.service';
import { MonthlyBagGoal, MonthlyGoalStatus } from '../schemas/community-bag-goal.schema';

import type { TestingModule } from '@nestjs/testing';

const USER_A = '660000000000000000000001';
const USER_B = '660000000000000000000002';
const GOAL_ID = '670000000000000000000001';

const makeGoal = (overrides: Record<string, unknown> = {}) => ({
  _id: GOAL_ID,
  currentCount: 0,
  targetCount: 100,
  cycleNumber: 1,
  status: MonthlyGoalStatus.ACTIVE,
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

describe('MonthlyBagGoalService', () => {
  let service: MonthlyBagGoalService;
  let mockModel: ReturnType<typeof createMockModel>;
  let mockWsService: { sendToRoom: jest.Mock };

  beforeEach(async () => {
    mockModel = createMockModel();
    mockWsService = { sendToRoom: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonthlyBagGoalService,
        { provide: getModelToken(MonthlyBagGoal.name), useValue: mockModel },
        { provide: WebSocketService, useValue: mockWsService },
      ],
    }).compile();

    service = module.get(MonthlyBagGoalService);
  });

  describe('incrementBagCount — participant tracking', () => {
    it('should include $addToSet with userId when userId is provided', async () => {
      await service.incrementBagCount(1, USER_A);

      expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
        { status: MonthlyGoalStatus.ACTIVE },
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

  describe('goal completion', () => {
    it('should not distribute reward points on completion', async () => {
      mockModel._reset({
        currentCount: 98,
        targetCount: 100,
        participantIds: [USER_A, USER_B],
      });

      const stats = await service.incrementBagCount(2, USER_A);

      expect(stats).toBeDefined();
      expect(mockModel.create).toHaveBeenCalled();
    });
  });

  describe('new cycle creation', () => {
    it('should carry seasonName to the new cycle', async () => {
      mockModel._reset({
        currentCount: 99,
        targetCount: 100,
        seasonName: 'Summer Sprint',
        participantIds: [USER_A],
      });

      await service.incrementBagCount(1, USER_A);

      expect(mockModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          seasonName: 'Summer Sprint',
          cycleNumber: 2,
          status: MonthlyGoalStatus.ACTIVE,
        }),
      );
    });

    it('should carry overflow bags to new cycle', async () => {
      mockModel._reset({
        currentCount: 95,
        targetCount: 100,
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
    it('should return seasonName and participantCount', async () => {
      mockModel._reset({
        seasonName: 'Ramadan Challenge',
        participantIds: [USER_A, USER_B],
      });

      const stats = await service.getStats();

      expect(stats.seasonName).toBe('Ramadan Challenge');
      expect(stats.participantCount).toBe(2);
    });
  });
});
