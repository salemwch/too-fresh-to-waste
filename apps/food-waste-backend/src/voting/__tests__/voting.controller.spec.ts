import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CastVoteDto } from '../dto/cast-vote.dto';
import { CreateCycleDto } from '../dto/create-cycle.dto';
import { UpdateCycleDto } from '../dto/update-cycle.dto';
import { VotingPrizeAdminService } from '../services/voting-prize-admin.service';
import { VotingPrizeService } from '../services/voting-prize.service';
import { VotingAdminController } from '../voting-admin.controller';
import { VotingController } from '../voting.controller';
import { VotingService } from '../voting.service';

const noopGuard = { canActivate: () => true };

// ---------------------------------------------------------------------------
// Shared mock factory — keeps both suites symmetric
// ---------------------------------------------------------------------------
const buildMockService = () => ({
  // VotingController methods
  getActiveCycle: jest.fn(),
  castVote: jest.fn(),
  getResults: jest.fn(),
  getHistory: jest.fn(),
  // VotingAdminController methods
  listCycles: jest.fn(),
  createCycle: jest.fn(),
  updateCycle: jest.fn(),
  deleteCycle: jest.fn(),
  activateCycle: jest.fn(),
  archiveCycle: jest.fn(),
  getCycleStats: jest.fn(),
  manualTally: jest.fn(),
  retrySnapshot: jest.fn(),
});

// ---------------------------------------------------------------------------
// VotingController
// ---------------------------------------------------------------------------
describe('VotingController', () => {
  let controller: VotingController;
  let service: ReturnType<typeof buildMockService>;

  const USER_ID = 'user-abc-123';

  beforeEach(async () => {
    service = buildMockService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VotingController],
      providers: [
        { provide: VotingService, useValue: service },
        {
          provide: VotingPrizeService,
          useValue: { getMyPrize: jest.fn(), claimPrize: jest.fn() },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(noopGuard)
      .overrideGuard(RolesGuard)
      .useValue(noopGuard)
      .overrideGuard(ThrottlerGuard)
      .useValue(noopGuard)
      .compile();

    controller = module.get(VotingController);
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // GET /voting/active
  // -------------------------------------------------------------------------
  describe('getActiveCycle()', () => {
    it('calls votingService.getActiveCycle with the userId from @GetUser', async () => {
      const cyclePayload = { id: 'cycle-1', name: 'Summer 2026' };
      service.getActiveCycle.mockResolvedValue(cyclePayload);

      const result = await controller.getActiveCycle(USER_ID);

      expect(service.getActiveCycle).toHaveBeenCalledTimes(1);
      expect(service.getActiveCycle).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual({
        status: 'success',
        message: 'Active voting cycle retrieved',
        data: cyclePayload,
      });
    });

    it('returns null data when no active cycle exists', async () => {
      service.getActiveCycle.mockResolvedValue(null);

      const result = await controller.getActiveCycle(USER_ID);

      expect(result).toEqual({
        status: 'success',
        message: 'Active voting cycle retrieved',
        data: null,
      });
    });
  });

  // -------------------------------------------------------------------------
  // POST /voting/vote
  // -------------------------------------------------------------------------
  describe('castVote()', () => {
    it('calls votingService.castVote with userId and dto, returns 201 envelope', async () => {
      const dto: CastVoteDto = { prizeId: '507f1f77bcf86cd799439011' };
      const votePayload = { id: 'vote-1', prizeId: dto.prizeId };
      service.castVote.mockResolvedValue(votePayload);

      const result = await controller.castVote(USER_ID, dto);

      expect(service.castVote).toHaveBeenCalledTimes(1);
      expect(service.castVote).toHaveBeenCalledWith(USER_ID, dto);
      expect(result).toEqual({
        status: 'success',
        message: 'Vote cast successfully',
        data: votePayload,
      });
    });
  });

  // -------------------------------------------------------------------------
  // GET /voting/results
  // -------------------------------------------------------------------------
  describe('getResults()', () => {
    it('calls votingService.getResults with userId and cycleId when provided', async () => {
      const resultsPayload = [{ prizeId: 'p1', votes: 42 }];
      const cycleId = 'cycle-xyz';
      service.getResults.mockResolvedValue(resultsPayload);

      const result = await controller.getResults(USER_ID, cycleId);

      expect(service.getResults).toHaveBeenCalledTimes(1);
      expect(service.getResults).toHaveBeenCalledWith(USER_ID, cycleId);
      expect(result).toEqual({
        status: 'success',
        message: 'Voting results retrieved',
        data: resultsPayload,
      });
    });

    it('calls votingService.getResults with undefined cycleId when query param is absent', async () => {
      service.getResults.mockResolvedValue([]);

      await controller.getResults(USER_ID, undefined);

      expect(service.getResults).toHaveBeenCalledWith(USER_ID, undefined);
    });
  });

  // -------------------------------------------------------------------------
  // GET /voting/history
  // -------------------------------------------------------------------------
  describe('getHistory()', () => {
    it('calls votingService.getHistory (no args) and returns envelope', async () => {
      const historyPayload = [{ id: 'cycle-old', name: 'Winter 2025' }];
      service.getHistory.mockResolvedValue(historyPayload);

      const result = await controller.getHistory();

      expect(service.getHistory).toHaveBeenCalledTimes(1);
      expect(service.getHistory).toHaveBeenCalledWith();
      expect(result).toEqual({
        status: 'success',
        message: 'Voting history retrieved',
        data: historyPayload,
      });
    });
  });
});

// ---------------------------------------------------------------------------
// VotingAdminController
// ---------------------------------------------------------------------------
describe('VotingAdminController', () => {
  let controller: VotingAdminController;
  let service: ReturnType<typeof buildMockService>;

  const ADMIN_ID = 'admin-xyz-456';
  const CYCLE_ID = '507f1f77bcf86cd799439011';

  beforeEach(async () => {
    service = buildMockService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VotingAdminController],
      providers: [
        { provide: VotingService, useValue: service },
        {
          provide: VotingPrizeAdminService,
          useValue: {
            getCycleWinners: jest.fn(),
            listPrizeClaims: jest.fn(),
            updatePrizeClaim: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(noopGuard)
      .overrideGuard(RolesGuard)
      .useValue(noopGuard)
      .compile();

    controller = module.get(VotingAdminController);
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // GET /voting/admin/cycles
  // -------------------------------------------------------------------------
  describe('listCycles()', () => {
    it('calls votingService.listCycles with page and limit, returns envelope with meta', async () => {
      const cycles = [{ id: CYCLE_ID, name: 'Summer 2026' }];
      service.listCycles.mockResolvedValue({ cycles, total: 1 });

      const result = await controller.listCycles(1, 10);

      expect(service.listCycles).toHaveBeenCalledTimes(1);
      expect(service.listCycles).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual({
        status: 'success',
        message: 'Voting cycles retrieved',
        data: cycles,
        meta: { page: 1, limit: 10, total: 1 },
      });
    });

    it('passes custom page/limit values through to the service', async () => {
      service.listCycles.mockResolvedValue({ cycles: [], total: 0 });

      const result = await controller.listCycles(3, 5);

      expect(service.listCycles).toHaveBeenCalledWith(3, 5);
      expect(result.meta).toEqual({ page: 3, limit: 5, total: 0 });
    });
  });

  // -------------------------------------------------------------------------
  // POST /voting/admin/cycles
  // -------------------------------------------------------------------------
  describe('createCycle()', () => {
    it('calls votingService.createCycle with dto and adminId, returns envelope', async () => {
      const dto = { name: 'Summer 2026' } as CreateCycleDto;
      const created = { id: CYCLE_ID, name: 'Summer 2026' };
      service.createCycle.mockResolvedValue(created);

      const result = await controller.createCycle(dto, ADMIN_ID);

      expect(service.createCycle).toHaveBeenCalledTimes(1);
      expect(service.createCycle).toHaveBeenCalledWith(dto, ADMIN_ID);
      expect(result).toEqual({
        status: 'success',
        message: 'Voting cycle created',
        data: created,
      });
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /voting/admin/cycles/:id
  // -------------------------------------------------------------------------
  describe('updateCycle()', () => {
    it('calls votingService.updateCycle with id and dto, returns envelope', async () => {
      const dto: UpdateCycleDto = { name: 'Updated Name' };
      const updated = { id: CYCLE_ID, name: 'Updated Name' };
      service.updateCycle.mockResolvedValue(updated);

      const result = await controller.updateCycle(CYCLE_ID, dto);

      expect(service.updateCycle).toHaveBeenCalledTimes(1);
      expect(service.updateCycle).toHaveBeenCalledWith(CYCLE_ID, dto);
      expect(result).toEqual({
        status: 'success',
        message: 'Voting cycle updated',
        data: updated,
      });
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /voting/admin/cycles/:id
  // -------------------------------------------------------------------------
  describe('deleteCycle()', () => {
    it('calls votingService.deleteCycle with id and returns success envelope', async () => {
      service.deleteCycle.mockResolvedValue(undefined);

      const result = await controller.deleteCycle(CYCLE_ID);

      expect(service.deleteCycle).toHaveBeenCalledTimes(1);
      expect(service.deleteCycle).toHaveBeenCalledWith(CYCLE_ID);
      expect(result).toEqual({
        status: 'success',
        message: 'Voting cycle deleted',
      });
    });
  });

  // -------------------------------------------------------------------------
  // POST /voting/admin/cycles/:id/activate
  // -------------------------------------------------------------------------
  describe('activateCycle()', () => {
    it('calls votingService.activateCycle with id and adminId, returns envelope', async () => {
      const activated = { id: CYCLE_ID, status: 'ACTIVE' };
      service.activateCycle.mockResolvedValue(activated);

      const result = await controller.activateCycle(CYCLE_ID, ADMIN_ID);

      expect(service.activateCycle).toHaveBeenCalledTimes(1);
      expect(service.activateCycle).toHaveBeenCalledWith(CYCLE_ID, ADMIN_ID);
      expect(result).toEqual({
        status: 'success',
        message: 'Voting cycle activated',
        data: activated,
      });
    });
  });

  // -------------------------------------------------------------------------
  // POST /voting/admin/cycles/:id/archive
  // -------------------------------------------------------------------------
  describe('archiveCycle()', () => {
    it('calls votingService.archiveCycle with id and adminId, returns envelope', async () => {
      const archived = { id: CYCLE_ID, status: 'ARCHIVED' };
      service.archiveCycle.mockResolvedValue(archived);

      const result = await controller.archiveCycle(CYCLE_ID, ADMIN_ID);

      expect(service.archiveCycle).toHaveBeenCalledTimes(1);
      expect(service.archiveCycle).toHaveBeenCalledWith(CYCLE_ID, ADMIN_ID);
      expect(result).toEqual({
        status: 'success',
        message: 'Voting cycle archived',
        data: archived,
      });
    });
  });

  // -------------------------------------------------------------------------
  // GET /voting/admin/cycles/:id/stats
  // -------------------------------------------------------------------------
  describe('getCycleStats()', () => {
    it('calls votingService.getCycleStats with id and returns envelope', async () => {
      const stats = { totalVotes: 150, leadingPrize: 'Smartphone' };
      service.getCycleStats.mockResolvedValue(stats);

      const result = await controller.getCycleStats(CYCLE_ID);

      expect(service.getCycleStats).toHaveBeenCalledTimes(1);
      expect(service.getCycleStats).toHaveBeenCalledWith(CYCLE_ID);
      expect(result).toEqual({
        status: 'success',
        message: 'Cycle stats retrieved',
        data: stats,
      });
    });
  });

  // -------------------------------------------------------------------------
  // POST /voting/admin/cycles/:id/tally
  // -------------------------------------------------------------------------
  describe('manualTally()', () => {
    it('calls votingService.manualTally with id and adminId, returns envelope', async () => {
      const tallyResult = { winnerId: 'prize-1', voteCount: 77 };
      service.manualTally.mockResolvedValue(tallyResult);

      const result = await controller.manualTally(CYCLE_ID, ADMIN_ID);

      expect(service.manualTally).toHaveBeenCalledTimes(1);
      expect(service.manualTally).toHaveBeenCalledWith(CYCLE_ID, ADMIN_ID);
      expect(result).toEqual({
        status: 'success',
        message: 'Tally completed',
        data: tallyResult,
      });
    });
  });

  // -------------------------------------------------------------------------
  // POST /voting/admin/cycles/:id/retry-snapshot
  // -------------------------------------------------------------------------
  describe('retrySnapshot()', () => {
    it('calls votingService.retrySnapshot with id and adminId, wraps count in data', async () => {
      service.retrySnapshot.mockResolvedValue(42);

      const result = await controller.retrySnapshot(CYCLE_ID, ADMIN_ID);

      expect(service.retrySnapshot).toHaveBeenCalledTimes(1);
      expect(service.retrySnapshot).toHaveBeenCalledWith(CYCLE_ID, ADMIN_ID);
      expect(result).toEqual({
        status: 'success',
        message: 'Snapshot created for 42 users',
        data: { count: 42 },
      });
    });

    it('interpolates the snapshot count correctly in the message', async () => {
      service.retrySnapshot.mockResolvedValue(0);

      const result = await controller.retrySnapshot(CYCLE_ID, ADMIN_ID);

      expect(result.message).toBe('Snapshot created for 0 users');
      expect(result.data).toEqual({ count: 0 });
    });
  });
});
