import { CycleStatus } from '@foodwaste/shared';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';

import { VotingCycle } from '../schemas/voting-cycle.schema';
import { VotingCron } from '../voting.cron';
import { VotingService } from '../voting.service';

const mockCycleId = new Types.ObjectId();

describe('VotingCron', () => {
  let cron: VotingCron;
  let votingService: {
    openBallot: jest.Mock;
    closeBallotAndTally: jest.Mock;
    expireCycle: jest.Mock;
    createEligibilitySnapshots: jest.Mock;
  };
  let cycleModel: {
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    votingService = {
      openBallot: jest.fn(),
      closeBallotAndTally: jest.fn(),
      expireCycle: jest.fn(),
      createEligibilitySnapshots: jest.fn(),
    };

    cycleModel = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VotingCron,
        { provide: VotingService, useValue: votingService },
        { provide: getModelToken(VotingCycle.name), useValue: cycleModel },
      ],
    }).compile();

    cron = module.get<VotingCron>(VotingCron);
  });

  describe('checkCommunityGoal', () => {
    it('should skip when no ACTIVE cycle', async () => {
      cycleModel.findOne.mockResolvedValueOnce(null);
      await cron.checkCommunityGoal();
      expect(votingService.openBallot).not.toHaveBeenCalled();
      expect(votingService.expireCycle).not.toHaveBeenCalled();
    });

    it('should open ballot when goal is met', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      cycleModel.findOne.mockResolvedValueOnce({
        _id: mockCycleId,
        name: 'Summer 2026',
        status: CycleStatus.ACTIVE,
        seasonBagProgress: 30000,
        seasonBagTarget: 30000,
        cycleEndDate: futureDate,
      });
      votingService.openBallot.mockResolvedValueOnce({ _id: mockCycleId } as any);
      votingService.createEligibilitySnapshots.mockResolvedValueOnce(100);

      await cron.checkCommunityGoal();

      expect(votingService.openBallot).toHaveBeenCalledWith(mockCycleId.toString());
      expect(votingService.createEligibilitySnapshots).toHaveBeenCalledWith(mockCycleId.toString());
    });

    it('should expire cycle when cycleEndDate passed and goal not met', async () => {
      cycleModel.findOne.mockResolvedValueOnce({
        _id: mockCycleId,
        name: 'Summer 2026',
        status: CycleStatus.ACTIVE,
        seasonBagProgress: 100,
        seasonBagTarget: 30000,
        cycleEndDate: new Date('2020-01-01'),
      });
      votingService.expireCycle.mockResolvedValueOnce({ _id: mockCycleId } as any);

      await cron.checkCommunityGoal();

      expect(votingService.expireCycle).toHaveBeenCalledWith(mockCycleId.toString());
      expect(votingService.openBallot).not.toHaveBeenCalled();
    });

    it('should handle snapshot failure gracefully', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      cycleModel.findOne.mockResolvedValueOnce({
        _id: mockCycleId,
        name: 'Summer 2026',
        status: CycleStatus.ACTIVE,
        seasonBagProgress: 30001,
        seasonBagTarget: 30000,
        cycleEndDate: futureDate,
      });
      votingService.openBallot.mockResolvedValueOnce({ _id: mockCycleId } as any);
      votingService.createEligibilitySnapshots.mockRejectedValueOnce(new Error('DB timeout'));

      // Should not throw despite snapshot failure
      await expect(cron.checkCommunityGoal()).resolves.not.toThrow();
      expect(votingService.openBallot).toHaveBeenCalled();
    });

    it('should not call createEligibilitySnapshots when openBallot returns falsy', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      cycleModel.findOne.mockResolvedValueOnce({
        _id: mockCycleId,
        name: 'Summer 2026',
        status: CycleStatus.ACTIVE,
        seasonBagProgress: 30000,
        seasonBagTarget: 30000,
        cycleEndDate: futureDate,
      });
      votingService.openBallot.mockResolvedValueOnce(null);

      await cron.checkCommunityGoal();

      expect(votingService.openBallot).toHaveBeenCalled();
      expect(votingService.createEligibilitySnapshots).not.toHaveBeenCalled();
    });

    it('should handle outer error gracefully', async () => {
      cycleModel.findOne.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(cron.checkCommunityGoal()).resolves.not.toThrow();
    });
  });

  describe('checkBallotClose', () => {
    it('should close ballot and tally when time is up', async () => {
      cycleModel.findOne.mockResolvedValueOnce({
        _id: mockCycleId,
        name: 'Summer 2026',
        status: CycleStatus.BALLOT_OPEN,
        ballotClosesAt: new Date('2020-01-01'),
      });
      votingService.closeBallotAndTally.mockResolvedValueOnce({ _id: mockCycleId } as any);

      await cron.checkBallotClose();

      expect(cycleModel.findOne).toHaveBeenCalledWith({
        status: CycleStatus.BALLOT_OPEN,
        ballotClosesAt: { $lte: expect.any(Date) },
      });
      expect(votingService.closeBallotAndTally).toHaveBeenCalledWith(mockCycleId.toString());
    });

    it('should skip when no ballot to close', async () => {
      cycleModel.findOne.mockResolvedValueOnce(null);
      await cron.checkBallotClose();
      expect(votingService.closeBallotAndTally).not.toHaveBeenCalled();
    });

    it('should not call closeBallotAndTally when it returns falsy', async () => {
      cycleModel.findOne.mockResolvedValueOnce({
        _id: mockCycleId,
        name: 'Summer 2026',
        status: CycleStatus.BALLOT_OPEN,
        ballotClosesAt: new Date('2020-01-01'),
      });
      votingService.closeBallotAndTally.mockResolvedValueOnce(null);

      await cron.checkBallotClose();

      expect(votingService.closeBallotAndTally).toHaveBeenCalled();
    });

    it('should handle error gracefully', async () => {
      cycleModel.findOne.mockRejectedValueOnce(new Error('Query failed'));

      await expect(cron.checkBallotClose()).resolves.not.toThrow();
    });
  });

  describe('retryFailedSnapshots', () => {
    it('should retry when BALLOT_OPEN + snapshotReady=false', async () => {
      cycleModel.findOne.mockResolvedValueOnce({
        _id: mockCycleId,
        name: 'Summer 2026',
        status: CycleStatus.BALLOT_OPEN,
        snapshotReady: false,
      });
      votingService.createEligibilitySnapshots.mockResolvedValueOnce(50);

      await cron.retryFailedSnapshots();

      expect(cycleModel.findOne).toHaveBeenCalledWith({
        status: CycleStatus.BALLOT_OPEN,
        snapshotReady: false,
      });
      expect(votingService.createEligibilitySnapshots).toHaveBeenCalledWith(mockCycleId.toString());
    });

    it('should skip when no failed snapshots to retry', async () => {
      cycleModel.findOne.mockResolvedValueOnce(null);
      await cron.retryFailedSnapshots();
      expect(votingService.createEligibilitySnapshots).not.toHaveBeenCalled();
    });

    it('should handle snapshot retry error gracefully', async () => {
      cycleModel.findOne.mockResolvedValueOnce({
        _id: mockCycleId,
        name: 'Summer 2026',
        status: CycleStatus.BALLOT_OPEN,
        snapshotReady: false,
      });
      votingService.createEligibilitySnapshots.mockRejectedValueOnce(
        new Error('Snapshot creation failed'),
      );

      // Should not throw despite snapshot failure
      await expect(cron.retryFailedSnapshots()).resolves.not.toThrow();
      expect(votingService.createEligibilitySnapshots).toHaveBeenCalled();
    });

    it('should handle outer error gracefully', async () => {
      cycleModel.findOne.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(cron.retryFailedSnapshots()).resolves.not.toThrow();
    });
  });
});
