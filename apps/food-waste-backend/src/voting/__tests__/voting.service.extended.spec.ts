/**
 * voting.service.extended.spec.ts
 *
 * Covers all methods and edge cases NOT already tested in voting.service.spec.ts:
 *   deleteCycle, listCycles, openBallot, closeBallotAndTally, expireCycle,
 *   archiveCycle, manualTally, createEligibilitySnapshots, retrySnapshot,
 *   getHistory, getCycleStats, castVote (11000 duplicate key), getActiveCycle
 *   (ACTIVE status path), and tally deterministic ordering.
 */

import { CycleStatus } from '@foodwaste/shared';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';

import { LoyaltyAccount } from '../../loyalty/schemas/loyalty-account.schema';
import { Counter } from '../schemas/counter.schema';
import { Vote } from '../schemas/vote.schema';
import { VotingAuditLog } from '../schemas/voting-audit-log.schema';
import { VotingCycle } from '../schemas/voting-cycle.schema';
import { VotingEligibility } from '../schemas/voting-eligibility.schema';
import { BALLOT_DURATION_MS, VOTING_AUDIT_ACTIONS, VOTING_ERROR_CODES } from '../voting.constants';
import { VotingPrizeService } from '../services/voting-prize.service';
import { VotingService } from '../voting.service';

// ── Shared IDs ────────────────────────────────────────────────────────────────

const mockCycleId = new Types.ObjectId();
const mockUserId = new Types.ObjectId();
const mockAdminId = new Types.ObjectId();
const mockPrizeId1 = new Types.ObjectId();
const mockPrizeId2 = new Types.ObjectId();
const mockPrizeId3 = new Types.ObjectId();

// ── Mock model factory (mirrors voting.service.spec.ts) ───────────────────────

const createMockModel = () => ({
  create: jest.fn(),
  find: jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnValue({
      skip: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([]),
      }),
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    }),
  }),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
  deleteOne: jest.fn(),
  countDocuments: jest.fn().mockResolvedValue(0),
  aggregate: jest.fn().mockResolvedValue([]),
  bulkWrite: jest.fn().mockResolvedValue({}),
});

// ─────────────────────────────────────────────────────────────────────────────

describe('VotingService (extended)', () => {
  let service: VotingService;
  let cycleModel: ReturnType<typeof createMockModel>;
  let voteModel: ReturnType<typeof createMockModel>;
  let eligibilityModel: ReturnType<typeof createMockModel>;
  let auditLogModel: ReturnType<typeof createMockModel>;
  let counterModel: ReturnType<typeof createMockModel>;
  let loyaltyModel: ReturnType<typeof createMockModel>;
  let votingPrizeServiceMock: { notifyWinners: jest.Mock };

  beforeEach(async () => {
    cycleModel = createMockModel();
    voteModel = createMockModel();
    eligibilityModel = createMockModel();
    auditLogModel = createMockModel();
    counterModel = createMockModel();
    loyaltyModel = createMockModel();
    votingPrizeServiceMock = { notifyWinners: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VotingService,
        { provide: getModelToken(VotingCycle.name), useValue: cycleModel },
        { provide: getModelToken(Vote.name), useValue: voteModel },
        { provide: getModelToken(VotingEligibility.name), useValue: eligibilityModel },
        { provide: getModelToken(VotingAuditLog.name), useValue: auditLogModel },
        { provide: getModelToken(Counter.name), useValue: counterModel },
        { provide: getModelToken(LoyaltyAccount.name), useValue: loyaltyModel },
        { provide: VotingPrizeService, useValue: votingPrizeServiceMock },
      ],
    }).compile();

    service = module.get<VotingService>(VotingService);
  });

  // ── deleteCycle ─────────────────────────────────────────────────────────────

  describe('deleteCycle', () => {
    it('should delete a DRAFT cycle successfully', async () => {
      cycleModel.findById.mockResolvedValue({
        _id: mockCycleId,
        status: CycleStatus.DRAFT,
      });
      cycleModel.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await expect(service.deleteCycle(mockCycleId.toString())).resolves.toBeUndefined();

      expect(cycleModel.deleteOne).toHaveBeenCalledWith({ _id: mockCycleId });
    });

    it('should throw NotFoundException when cycle does not exist', async () => {
      cycleModel.findById.mockResolvedValue(null);

      await expect(service.deleteCycle(mockCycleId.toString())).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when cycle is ACTIVE (not DRAFT)', async () => {
      cycleModel.findById.mockResolvedValue({
        _id: mockCycleId,
        status: CycleStatus.ACTIVE,
      });

      await expect(service.deleteCycle(mockCycleId.toString())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when cycle is COMPLETED (not DRAFT)', async () => {
      cycleModel.findById.mockResolvedValue({
        _id: mockCycleId,
        status: CycleStatus.COMPLETED,
      });

      await expect(service.deleteCycle(mockCycleId.toString())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when cycle is BALLOT_OPEN (not DRAFT)', async () => {
      cycleModel.findById.mockResolvedValue({
        _id: mockCycleId,
        status: CycleStatus.BALLOT_OPEN,
      });

      await expect(service.deleteCycle(mockCycleId.toString())).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── listCycles ──────────────────────────────────────────────────────────────

  describe('listCycles', () => {
    it('should return cycles array and total count', async () => {
      const fakeCycles = [
        { _id: new Types.ObjectId(), name: 'Cycle A', status: CycleStatus.ACTIVE },
        { _id: new Types.ObjectId(), name: 'Cycle B', status: CycleStatus.DRAFT },
      ];
      // Wire the find().sort().skip().limit() chain
      cycleModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(fakeCycles),
          }),
        }),
      });
      cycleModel.countDocuments.mockResolvedValue(2);

      const result = await service.listCycles(1, 10);

      expect(result.cycles).toEqual(fakeCycles);
      expect(result.total).toBe(2);
    });

    it('should pass correct skip offset based on page and limit', async () => {
      const mockSkip = jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) });
      const mockSort = jest.fn().mockReturnValue({ skip: mockSkip });
      cycleModel.find.mockReturnValue({ sort: mockSort });
      cycleModel.countDocuments.mockResolvedValue(50);

      await service.listCycles(3, 10); // page=3, limit=10 → skip=20

      expect(mockSkip).toHaveBeenCalledWith(20);
    });

    it('should return zero total and empty array when no cycles exist', async () => {
      cycleModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      cycleModel.countDocuments.mockResolvedValue(0);

      const result = await service.listCycles(1, 10);

      expect(result.cycles).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ── openBallot ──────────────────────────────────────────────────────────────

  describe('openBallot', () => {
    it('should transition ACTIVE → BALLOT_OPEN with correct ballot timing', async () => {
      const now = Date.now();
      const updatedCycle = {
        _id: mockCycleId,
        status: CycleStatus.BALLOT_OPEN,
        snapshotReady: false,
        ballotOpensAt: new Date(now),
        ballotClosesAt: new Date(now + BALLOT_DURATION_MS),
      };
      cycleModel.findOneAndUpdate.mockResolvedValue(updatedCycle);
      auditLogModel.create.mockResolvedValue({});

      const result = await service.openBallot(mockCycleId.toString());

      expect(result).toBe(updatedCycle);
    });

    it('should call findOneAndUpdate with ACTIVE status filter and set snapshotReady=false', async () => {
      const updatedCycle = {
        _id: mockCycleId,
        status: CycleStatus.BALLOT_OPEN,
        snapshotReady: false,
      };
      cycleModel.findOneAndUpdate.mockResolvedValue(updatedCycle);
      auditLogModel.create.mockResolvedValue({});

      await service.openBallot(mockCycleId.toString());

      expect(cycleModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: new Types.ObjectId(mockCycleId.toString()), status: CycleStatus.ACTIVE },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: CycleStatus.BALLOT_OPEN,
            snapshotReady: false,
          }),
        }),
        { new: true },
      );
    });

    it('should set ballotClosesAt = ballotOpensAt + BALLOT_DURATION_MS (48 hours)', async () => {
      const before = new Date();
      const updatedCycle = { _id: mockCycleId, status: CycleStatus.BALLOT_OPEN };
      cycleModel.findOneAndUpdate.mockResolvedValue(updatedCycle);
      auditLogModel.create.mockResolvedValue({});

      await service.openBallot(mockCycleId.toString());

      const callArgs = cycleModel.findOneAndUpdate.mock.calls[0] as [
        unknown,
        { $set: Record<string, unknown> },
        unknown,
      ];
      const setPayload = callArgs[1].$set;

      const ballotOpensAt = setPayload['ballotOpensAt'] as Date;
      const ballotClosesAt = setPayload['ballotClosesAt'] as Date;

      expect(ballotOpensAt).toBeInstanceOf(Date);
      expect(ballotClosesAt).toBeInstanceOf(Date);

      const diff = (ballotClosesAt as Date).getTime() - (ballotOpensAt as Date).getTime();
      // Allow ±1 second tolerance for test execution time
      expect(diff).toBeGreaterThanOrEqual(BALLOT_DURATION_MS - 1000);
      expect(diff).toBeLessThanOrEqual(BALLOT_DURATION_MS + 1000);

      // Sanity: ballotOpensAt is close to now
      expect(ballotOpensAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 100);
    });

    it('should return null if cycle is not ACTIVE (findOneAndUpdate returns null)', async () => {
      cycleModel.findOneAndUpdate.mockResolvedValue(null);

      const result = await service.openBallot(mockCycleId.toString());

      expect(result).toBeNull();
      // Audit log must NOT be written when the transition is a no-op
      expect(auditLogModel.create).not.toHaveBeenCalled();
    });

    it('should write audit log with OPEN_BALLOT action on success', async () => {
      const updatedCycle = { _id: mockCycleId, status: CycleStatus.BALLOT_OPEN };
      cycleModel.findOneAndUpdate.mockResolvedValue(updatedCycle);
      auditLogModel.create.mockResolvedValue({});

      await service.openBallot(mockCycleId.toString());

      expect(auditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: VOTING_AUDIT_ACTIONS.OPEN_BALLOT,
          fromStatus: CycleStatus.ACTIVE,
          toStatus: CycleStatus.BALLOT_OPEN,
        }),
      );
    });
  });

  // ── closeBallotAndTally ─────────────────────────────────────────────────────

  describe('closeBallotAndTally', () => {
    /**
     * closeBallotAndTally calls findOneAndUpdate twice:
     *   1st: BALLOT_OPEN → TALLYING
     *   2nd (inside runTally): TALLYING → COMPLETED
     *
     * We also need cycleModel.findById (inside runTally) to return a cycle doc.
     */

    const buildTallyingCycle = () => ({
      _id: mockCycleId,
      status: CycleStatus.TALLYING,
      prizes: [
        { _id: mockPrizeId1, name: 'Phone' },
        { _id: mockPrizeId2, name: 'Scooter' },
      ],
    });

    const buildCompletedCycle = (winner?: object) => ({
      _id: mockCycleId,
      status: CycleStatus.COMPLETED,
      isLive: null,
      ...(winner ? { winner } : {}),
    });

    it('should return null if cycle is not BALLOT_OPEN', async () => {
      cycleModel.findOneAndUpdate.mockResolvedValue(null);

      const result = await service.closeBallotAndTally(mockCycleId.toString());

      expect(result).toBeNull();
      expect(auditLogModel.create).not.toHaveBeenCalled();
    });

    it('should transition BALLOT_OPEN → TALLYING → COMPLETED with winner set', async () => {
      const tallyingCycle = buildTallyingCycle();
      const completedCycle = buildCompletedCycle({ prizeId: mockPrizeId1, name: 'Phone' });

      // 1st call: BALLOT_OPEN → TALLYING
      cycleModel.findOneAndUpdate
        .mockResolvedValueOnce(tallyingCycle)
        // 2nd call (runTally): TALLYING → COMPLETED
        .mockResolvedValueOnce(completedCycle);

      cycleModel.findById.mockResolvedValue(tallyingCycle);

      voteModel.aggregate.mockResolvedValue([
        { _id: mockPrizeId1, totalWeightedVotes: 800, voterCount: 8 },
        { _id: mockPrizeId2, totalWeightedVotes: 200, voterCount: 2 },
      ]);
      auditLogModel.create.mockResolvedValue({});

      const result = await service.closeBallotAndTally(mockCycleId.toString());

      expect(result).toBe(completedCycle);
      expect(result?.status).toBe(CycleStatus.COMPLETED);
    });

    it('should set isLive = null after completion', async () => {
      const tallyingCycle = buildTallyingCycle();
      const completedCycle = buildCompletedCycle();
      (completedCycle as Record<string, unknown>)['isLive'] = null;

      cycleModel.findOneAndUpdate
        .mockResolvedValueOnce(tallyingCycle)
        .mockResolvedValueOnce(completedCycle);
      cycleModel.findById.mockResolvedValue(tallyingCycle);
      voteModel.aggregate.mockResolvedValue([]);
      auditLogModel.create.mockResolvedValue({});

      const result = await service.closeBallotAndTally(mockCycleId.toString());

      // The 2nd findOneAndUpdate call (runTally) must set isLive: null
      const secondCall = cycleModel.findOneAndUpdate.mock.calls[1] as [
        unknown,
        { $set: Record<string, unknown> },
        unknown,
      ];
      expect(secondCall[1].$set['isLive']).toBeNull();
      expect(result?.status).toBe(CycleStatus.COMPLETED);
    });

    it('should handle zero votes (no winner set, still COMPLETED)', async () => {
      const tallyingCycle = buildTallyingCycle();
      const completedNoWinner = buildCompletedCycle(); // no winner

      cycleModel.findOneAndUpdate
        .mockResolvedValueOnce(tallyingCycle)
        .mockResolvedValueOnce(completedNoWinner);
      cycleModel.findById.mockResolvedValue(tallyingCycle);
      voteModel.aggregate.mockResolvedValue([]); // no votes
      auditLogModel.create.mockResolvedValue({});

      const result = await service.closeBallotAndTally(mockCycleId.toString());

      expect(result?.status).toBe(CycleStatus.COMPLETED);

      // The TALLYING→COMPLETED $set must NOT include a winner field
      const secondCall = cycleModel.findOneAndUpdate.mock.calls[1] as [
        unknown,
        { $set: Record<string, unknown> },
        unknown,
      ];
      expect(secondCall[1].$set).not.toHaveProperty('winner');
    });

    it('should write audit log for CLOSE_BALLOT action', async () => {
      const tallyingCycle = buildTallyingCycle();
      const completedCycle = buildCompletedCycle();

      cycleModel.findOneAndUpdate
        .mockResolvedValueOnce(tallyingCycle)
        .mockResolvedValueOnce(completedCycle);
      cycleModel.findById.mockResolvedValue(tallyingCycle);
      voteModel.aggregate.mockResolvedValue([]);
      auditLogModel.create.mockResolvedValue({});

      await service.closeBallotAndTally(mockCycleId.toString());

      // First audit log call is CLOSE_BALLOT
      const firstAuditCall = auditLogModel.create.mock.calls[0] as [Record<string, unknown>];
      expect(firstAuditCall[0]).toMatchObject({
        action: VOTING_AUDIT_ACTIONS.CLOSE_BALLOT,
        fromStatus: CycleStatus.BALLOT_OPEN,
        toStatus: CycleStatus.TALLYING,
      });
    });

    it('should call notifyWinners fire-and-forget when completed cycle has a winnerPrizeId', async () => {
      const tallyingCycle = buildTallyingCycle();
      const winnerPrizeId = mockPrizeId1;
      const completedCycleWithWinner = {
        ...buildCompletedCycle({ prizeId: winnerPrizeId, name: 'Phone' }),
        winnerPrizeId,
        recipientCount: 3,
        winner: { name: 'Phone', prizeId: winnerPrizeId },
      };

      cycleModel.findOneAndUpdate
        .mockResolvedValueOnce(tallyingCycle)
        .mockResolvedValueOnce(completedCycleWithWinner);
      cycleModel.findById.mockResolvedValue(tallyingCycle);
      voteModel.aggregate.mockResolvedValue([
        { _id: winnerPrizeId, totalWeightedVotes: 500, voterCount: 3 },
      ]);
      auditLogModel.create.mockResolvedValue({});

      const result = await service.closeBallotAndTally(mockCycleId.toString());

      expect(result?.status).toBe(CycleStatus.COMPLETED);
      // Fire-and-forget: notifyWinners must have been called (void, no await)
      expect(votingPrizeServiceMock.notifyWinners).toHaveBeenCalledWith(
        mockCycleId.toString(),
        winnerPrizeId,
        3,
        'Phone',
      );
    });

    it('should NOT call notifyWinners when completed cycle has no winnerPrizeId', async () => {
      const tallyingCycle = buildTallyingCycle();
      const completedNoWinner = buildCompletedCycle(); // no winnerPrizeId

      cycleModel.findOneAndUpdate
        .mockResolvedValueOnce(tallyingCycle)
        .mockResolvedValueOnce(completedNoWinner);
      cycleModel.findById.mockResolvedValue(tallyingCycle);
      voteModel.aggregate.mockResolvedValue([]);
      auditLogModel.create.mockResolvedValue({});

      await service.closeBallotAndTally(mockCycleId.toString());

      expect(votingPrizeServiceMock.notifyWinners).not.toHaveBeenCalled();
    });
  });

  // ── expireCycle ─────────────────────────────────────────────────────────────

  describe('expireCycle', () => {
    it('should transition ACTIVE → EXPIRED and set isLive = null', async () => {
      const expiredCycle = {
        _id: mockCycleId,
        status: CycleStatus.EXPIRED,
        isLive: null,
      };
      cycleModel.findOneAndUpdate.mockResolvedValue(expiredCycle);
      auditLogModel.create.mockResolvedValue({});

      const result = await service.expireCycle(mockCycleId.toString());

      expect(result).toBe(expiredCycle);
      expect(result?.status).toBe(CycleStatus.EXPIRED);
      expect(result?.isLive).toBeNull();
    });

    it('should call findOneAndUpdate with ACTIVE filter and set status=EXPIRED, isLive=null', async () => {
      const expiredCycle = { _id: mockCycleId, status: CycleStatus.EXPIRED, isLive: null };
      cycleModel.findOneAndUpdate.mockResolvedValue(expiredCycle);
      auditLogModel.create.mockResolvedValue({});

      await service.expireCycle(mockCycleId.toString());

      expect(cycleModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: new Types.ObjectId(mockCycleId.toString()), status: CycleStatus.ACTIVE },
        { $set: { status: CycleStatus.EXPIRED, isLive: null } },
        { new: true },
      );
    });

    it('should return null if cycle is not ACTIVE', async () => {
      cycleModel.findOneAndUpdate.mockResolvedValue(null);

      const result = await service.expireCycle(mockCycleId.toString());

      expect(result).toBeNull();
      expect(auditLogModel.create).not.toHaveBeenCalled();
    });

    it('should write audit log with EXPIRE action on success', async () => {
      const expiredCycle = { _id: mockCycleId, status: CycleStatus.EXPIRED, isLive: null };
      cycleModel.findOneAndUpdate.mockResolvedValue(expiredCycle);
      auditLogModel.create.mockResolvedValue({});

      await service.expireCycle(mockCycleId.toString());

      expect(auditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: VOTING_AUDIT_ACTIONS.EXPIRE,
          fromStatus: CycleStatus.ACTIVE,
          toStatus: CycleStatus.EXPIRED,
        }),
      );
    });
  });

  // ── archiveCycle ────────────────────────────────────────────────────────────

  describe('archiveCycle', () => {
    const adminId = mockAdminId.toString();

    it('should archive a COMPLETED cycle → ARCHIVED', async () => {
      const beforeCycle = { _id: mockCycleId, status: CycleStatus.COMPLETED };
      const archivedCycle = { _id: mockCycleId, status: CycleStatus.ARCHIVED };

      cycleModel.findOne.mockResolvedValue(beforeCycle);
      cycleModel.findOneAndUpdate.mockResolvedValue(archivedCycle);
      auditLogModel.create.mockResolvedValue({});

      const result = await service.archiveCycle(mockCycleId.toString(), adminId);

      expect(result.status).toBe(CycleStatus.ARCHIVED);
    });

    it('should archive an EXPIRED cycle → ARCHIVED', async () => {
      const beforeCycle = { _id: mockCycleId, status: CycleStatus.EXPIRED };
      const archivedCycle = { _id: mockCycleId, status: CycleStatus.ARCHIVED };

      cycleModel.findOne.mockResolvedValue(beforeCycle);
      cycleModel.findOneAndUpdate.mockResolvedValue(archivedCycle);
      auditLogModel.create.mockResolvedValue({});

      const result = await service.archiveCycle(mockCycleId.toString(), adminId);

      expect(result.status).toBe(CycleStatus.ARCHIVED);
    });

    it('should throw BadRequestException when cycle is ACTIVE (cannot archive)', async () => {
      // findOne with $in filter returns null (ACTIVE not in the allowed set)
      cycleModel.findOne.mockResolvedValue(null);
      // findById returns the ACTIVE cycle so the error message is accurate
      cycleModel.findById.mockResolvedValue({ _id: mockCycleId, status: CycleStatus.ACTIVE });

      await expect(service.archiveCycle(mockCycleId.toString(), adminId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when cycle is DRAFT (cannot archive)', async () => {
      cycleModel.findOne.mockResolvedValue(null);
      cycleModel.findById.mockResolvedValue({ _id: mockCycleId, status: CycleStatus.DRAFT });

      await expect(service.archiveCycle(mockCycleId.toString(), adminId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when cycle is BALLOT_OPEN (cannot archive)', async () => {
      cycleModel.findOne.mockResolvedValue(null);
      cycleModel.findById.mockResolvedValue({
        _id: mockCycleId,
        status: CycleStatus.BALLOT_OPEN,
      });

      await expect(service.archiveCycle(mockCycleId.toString(), adminId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when cycle does not exist', async () => {
      cycleModel.findOne.mockResolvedValue(null);
      cycleModel.findById.mockResolvedValue(null);

      await expect(service.archiveCycle(mockCycleId.toString(), adminId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should write audit log with correct fromStatus (COMPLETED)', async () => {
      const beforeCycle = { _id: mockCycleId, status: CycleStatus.COMPLETED };
      const archivedCycle = { _id: mockCycleId, status: CycleStatus.ARCHIVED };

      cycleModel.findOne.mockResolvedValue(beforeCycle);
      cycleModel.findOneAndUpdate.mockResolvedValue(archivedCycle);
      auditLogModel.create.mockResolvedValue({});

      await service.archiveCycle(mockCycleId.toString(), adminId);

      expect(auditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: VOTING_AUDIT_ACTIONS.ARCHIVE,
          fromStatus: CycleStatus.COMPLETED,
          toStatus: CycleStatus.ARCHIVED,
        }),
      );
    });

    it('should write audit log with correct fromStatus (EXPIRED)', async () => {
      const beforeCycle = { _id: mockCycleId, status: CycleStatus.EXPIRED };
      const archivedCycle = { _id: mockCycleId, status: CycleStatus.ARCHIVED };

      cycleModel.findOne.mockResolvedValue(beforeCycle);
      cycleModel.findOneAndUpdate.mockResolvedValue(archivedCycle);
      auditLogModel.create.mockResolvedValue({});

      await service.archiveCycle(mockCycleId.toString(), adminId);

      expect(auditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: VOTING_AUDIT_ACTIONS.ARCHIVE,
          fromStatus: CycleStatus.EXPIRED,
          toStatus: CycleStatus.ARCHIVED,
        }),
      );
    });
  });

  // ── manualTally ─────────────────────────────────────────────────────────────

  describe('manualTally', () => {
    const adminId = mockAdminId.toString();

    const tallyingCycle = {
      _id: mockCycleId,
      status: CycleStatus.TALLYING,
      prizes: [{ _id: mockPrizeId1, name: 'Phone' }],
    };

    it('should run tally on a TALLYING cycle and return completed doc', async () => {
      const completedCycle = { _id: mockCycleId, status: CycleStatus.COMPLETED, isLive: null };

      cycleModel.findById.mockResolvedValue(tallyingCycle);
      voteModel.aggregate.mockResolvedValue([
        { _id: mockPrizeId1, totalWeightedVotes: 500, voterCount: 5 },
      ]);
      cycleModel.findOneAndUpdate.mockResolvedValue(completedCycle);
      auditLogModel.create.mockResolvedValue({});

      const result = await service.manualTally(mockCycleId.toString(), adminId);

      expect(result.status).toBe(CycleStatus.COMPLETED);
    });

    it('should be a no-op and return existing doc for already COMPLETED cycle', async () => {
      const completedCycle = { _id: mockCycleId, status: CycleStatus.COMPLETED };
      cycleModel.findById.mockResolvedValue(completedCycle);

      const result = await service.manualTally(mockCycleId.toString(), adminId);

      expect(result).toBe(completedCycle);
      // No tally aggregation or update should run
      expect(voteModel.aggregate).not.toHaveBeenCalled();
      expect(cycleModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for non-TALLYING, non-COMPLETED cycle', async () => {
      cycleModel.findById.mockResolvedValue({ _id: mockCycleId, status: CycleStatus.BALLOT_OPEN });

      await expect(service.manualTally(mockCycleId.toString(), adminId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for ACTIVE cycle', async () => {
      cycleModel.findById.mockResolvedValue({ _id: mockCycleId, status: CycleStatus.ACTIVE });

      await expect(service.manualTally(mockCycleId.toString(), adminId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when cycle does not exist', async () => {
      cycleModel.findById.mockResolvedValue(null);

      await expect(service.manualTally(mockCycleId.toString(), adminId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should write MANUAL_TALLY audit log after successful tally', async () => {
      const completedCycle = { _id: mockCycleId, status: CycleStatus.COMPLETED };

      cycleModel.findById.mockResolvedValue(tallyingCycle);
      voteModel.aggregate.mockResolvedValue([]);
      cycleModel.findOneAndUpdate.mockResolvedValue(completedCycle);
      auditLogModel.create.mockResolvedValue({});

      await service.manualTally(mockCycleId.toString(), adminId);

      // manualTally writes its own MANUAL_TALLY audit log AFTER runTally writes TALLY
      const auditCalls = auditLogModel.create.mock.calls as [Record<string, unknown>][];
      const manualTallyLog = auditCalls.find(
        ([args]) => args['action'] === VOTING_AUDIT_ACTIONS.MANUAL_TALLY,
      );
      expect(manualTallyLog).toBeDefined();
      expect(manualTallyLog?.[0]).toMatchObject({
        action: VOTING_AUDIT_ACTIONS.MANUAL_TALLY,
        fromStatus: CycleStatus.TALLYING,
        toStatus: CycleStatus.COMPLETED,
      });
    });
  });

  // ── createEligibilitySnapshots ──────────────────────────────────────────────

  describe('createEligibilitySnapshots', () => {
    const cycle = {
      _id: mockCycleId,
      status: CycleStatus.BALLOT_OPEN,
      cycleStartDate: new Date('2026-01-01'),
      ballotOpensAt: new Date('2026-06-01'),
      minimumBags: 50,
    };

    it('should create snapshots for eligible users using $setOnInsert and return count', async () => {
      const eligibleUsers = [
        { _id: new Types.ObjectId(), bagsSavedInCycle: 60 },
        { _id: new Types.ObjectId(), bagsSavedInCycle: 80 },
      ];

      cycleModel.findById.mockResolvedValue(cycle);

      // First aggregate call: getEligibleUsersForCycle
      loyaltyModel.aggregate.mockResolvedValue(eligibleUsers);

      // loyaltyModel.find for points lookup
      loyaltyModel.find.mockResolvedValue([
        { userId: eligibleUsers[0]!._id, availablePoints: 100 },
        { userId: eligibleUsers[1]!._id, availablePoints: 200 },
      ]);

      eligibilityModel.bulkWrite.mockResolvedValue({});
      cycleModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const count = await service.createEligibilitySnapshots(mockCycleId.toString());

      expect(count).toBe(2);
      expect(eligibilityModel.bulkWrite).toHaveBeenCalled();

      // Verify $setOnInsert is used (not $set) for idempotent upserts
      const bulkOps = eligibilityModel.bulkWrite.mock.calls[0]![0] as Array<{
        updateOne: { update: Record<string, unknown> };
      }>;
      expect(bulkOps[0]!.updateOne.update).toHaveProperty('$setOnInsert');
      expect(bulkOps[0]!.updateOne.update).not.toHaveProperty('$set');
    });

    it('should set snapshotReady = true after completion', async () => {
      const eligibleUsers = [{ _id: new Types.ObjectId(), bagsSavedInCycle: 60 }];

      cycleModel.findById.mockResolvedValue(cycle);
      loyaltyModel.aggregate.mockResolvedValue(eligibleUsers);
      loyaltyModel.find.mockResolvedValue([]);
      eligibilityModel.bulkWrite.mockResolvedValue({});
      cycleModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      await service.createEligibilitySnapshots(mockCycleId.toString());

      expect(cycleModel.updateOne).toHaveBeenCalledWith(
        { _id: mockCycleId },
        { $set: { snapshotReady: true } },
      );
    });

    it('should handle zero eligible users and still set snapshotReady = true', async () => {
      cycleModel.findById.mockResolvedValue(cycle);
      loyaltyModel.aggregate.mockResolvedValue([]); // no eligible users
      cycleModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const count = await service.createEligibilitySnapshots(mockCycleId.toString());

      expect(count).toBe(0);
      expect(eligibilityModel.bulkWrite).not.toHaveBeenCalled();
      // Must still set snapshotReady = true even with zero users
      expect(cycleModel.updateOne).toHaveBeenCalledWith(
        { _id: mockCycleId },
        { $set: { snapshotReady: true } },
      );
    });

    it('should use $ifNull bagCount with fallback to 1 in the aggregation pipeline', async () => {
      cycleModel.findById.mockResolvedValue(cycle);
      loyaltyModel.aggregate.mockResolvedValue([]);
      cycleModel.updateOne.mockResolvedValue({});

      await service.createEligibilitySnapshots(mockCycleId.toString());

      // The loyalty aggregate pipeline must include $ifNull bagCount → 1
      const pipeline = loyaltyModel.aggregate.mock.calls[0]![0] as Array<Record<string, unknown>>;
      const addFieldsStage = pipeline.find(s => '$addFields' in s) as
        | { $addFields: { bags: { $ifNull: [string, number] } } }
        | undefined;

      expect(addFieldsStage).toBeDefined();
      expect(addFieldsStage!.$addFields.bags).toMatchObject({
        $ifNull: ['$pointsHistory.bagCount', 1],
      });
    });

    it('should throw NotFoundException when cycle does not exist', async () => {
      cycleModel.findById.mockResolvedValue(null);

      await expect(service.createEligibilitySnapshots(mockCycleId.toString())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── retrySnapshot ───────────────────────────────────────────────────────────

  describe('retrySnapshot', () => {
    const adminId = mockAdminId.toString();

    it('should call createEligibilitySnapshots and write audit log', async () => {
      const ballotCycle = {
        _id: mockCycleId,
        status: CycleStatus.BALLOT_OPEN,
        snapshotReady: false,
        cycleStartDate: new Date('2026-01-01'),
        ballotOpensAt: new Date('2026-06-01'),
        minimumBags: 50,
      };

      // First findById: retrySnapshot's own guard
      // Second findById: createEligibilitySnapshots's guard
      cycleModel.findById.mockResolvedValueOnce(ballotCycle).mockResolvedValueOnce(ballotCycle);

      loyaltyModel.aggregate.mockResolvedValue([]);
      cycleModel.updateOne.mockResolvedValue({});
      auditLogModel.create.mockResolvedValue({});

      const count = await service.retrySnapshot(mockCycleId.toString(), adminId);

      expect(count).toBe(0);
      expect(auditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: VOTING_AUDIT_ACTIONS.RETRY_SNAPSHOT,
          fromStatus: CycleStatus.BALLOT_OPEN,
          toStatus: CycleStatus.BALLOT_OPEN,
        }),
      );
    });

    it('should throw BadRequestException if cycle is not BALLOT_OPEN', async () => {
      cycleModel.findById.mockResolvedValue({
        _id: mockCycleId,
        status: CycleStatus.ACTIVE,
        snapshotReady: false,
      });

      await expect(service.retrySnapshot(mockCycleId.toString(), adminId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if snapshotReady is already true', async () => {
      cycleModel.findById.mockResolvedValue({
        _id: mockCycleId,
        status: CycleStatus.BALLOT_OPEN,
        snapshotReady: true, // already done
      });

      await expect(service.retrySnapshot(mockCycleId.toString(), adminId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when cycle does not exist', async () => {
      cycleModel.findById.mockResolvedValue(null);

      await expect(service.retrySnapshot(mockCycleId.toString(), adminId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── getHistory ──────────────────────────────────────────────────────────────

  describe('getHistory', () => {
    it('should return completed and archived cycles sorted by createdAt desc', async () => {
      const historyCycles = [
        { _id: new Types.ObjectId(), name: 'Cycle B', status: CycleStatus.ARCHIVED },
        { _id: new Types.ObjectId(), name: 'Cycle A', status: CycleStatus.COMPLETED },
      ];

      const mockExec = jest.fn().mockResolvedValue(historyCycles);
      const mockLimit = jest.fn().mockReturnValue({ exec: mockExec });
      const mockSelect = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = jest.fn().mockReturnValue({ select: mockSelect });
      cycleModel.find.mockReturnValue({ sort: mockSort });

      const result = await service.getHistory();

      expect(result).toEqual(historyCycles);
    });

    it('should query only COMPLETED and ARCHIVED statuses', async () => {
      const mockExec = jest.fn().mockResolvedValue([]);
      const mockLimit = jest.fn().mockReturnValue({ exec: mockExec });
      const mockSelect = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = jest.fn().mockReturnValue({ select: mockSelect });
      cycleModel.find.mockReturnValue({ sort: mockSort });

      await service.getHistory();

      expect(cycleModel.find).toHaveBeenCalledWith({
        status: { $in: [CycleStatus.COMPLETED, CycleStatus.ARCHIVED] },
      });
    });

    it('should sort by createdAt descending', async () => {
      const mockExec = jest.fn().mockResolvedValue([]);
      const mockLimit = jest.fn().mockReturnValue({ exec: mockExec });
      const mockSelect = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = jest.fn().mockReturnValue({ select: mockSelect });
      cycleModel.find.mockReturnValue({ sort: mockSort });

      await service.getHistory();

      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
    });

    it('should select only specific fields (name, cycleStartDate, cycleEndDate, winner, status, cycleNumber)', async () => {
      const mockExec = jest.fn().mockResolvedValue([]);
      const mockLimit = jest.fn().mockReturnValue({ exec: mockExec });
      const mockSelect = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = jest.fn().mockReturnValue({ select: mockSelect });
      cycleModel.find.mockReturnValue({ sort: mockSort });

      await service.getHistory();

      expect(mockSelect).toHaveBeenCalledWith(
        'name cycleStartDate cycleEndDate winner status cycleNumber',
      );
    });
  });

  // ── getCycleStats ───────────────────────────────────────────────────────────

  describe('getCycleStats', () => {
    it('should return results with participationRate', async () => {
      const cycle = {
        _id: mockCycleId,
        prizes: [
          { _id: mockPrizeId1, name: 'Phone' },
          { _id: mockPrizeId2, name: 'Scooter' },
        ],
      };
      cycleModel.findById.mockResolvedValue(cycle);
      voteModel.aggregate.mockResolvedValue([
        { _id: mockPrizeId1, totalWeightedVotes: 600, voterCount: 6 },
        { _id: mockPrizeId2, totalWeightedVotes: 400, voterCount: 4 },
      ]);
      eligibilityModel.countDocuments.mockResolvedValue(20);

      const result = await service.getCycleStats(mockCycleId.toString());

      expect(result.results).toHaveLength(2);
      expect(result.totalVoters).toBe(10); // 6 + 4
      expect(result.totalEligible).toBe(20);
      // participationRate = 10 / 20 = 0.5
      expect(result.participationRate).toBeCloseTo(0.5);
    });

    it('should throw NotFoundException when cycle does not exist', async () => {
      cycleModel.findById.mockResolvedValue(null);

      await expect(service.getCycleStats(mockCycleId.toString())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return participationRate = 0 when there are zero eligible users', async () => {
      const cycle = { _id: mockCycleId, prizes: [] };
      cycleModel.findById.mockResolvedValue(cycle);
      voteModel.aggregate.mockResolvedValue([]);
      eligibilityModel.countDocuments.mockResolvedValue(0);

      const result = await service.getCycleStats(mockCycleId.toString());

      expect(result.totalVoters).toBe(0);
      expect(result.totalEligible).toBe(0);
      expect(result.participationRate).toBe(0);
    });

    it('should handle zero votes with non-zero eligible (participationRate = 0)', async () => {
      const cycle = { _id: mockCycleId, prizes: [{ _id: mockPrizeId1, name: 'Phone' }] };
      cycleModel.findById.mockResolvedValue(cycle);
      voteModel.aggregate.mockResolvedValue([]); // no votes
      eligibilityModel.countDocuments.mockResolvedValue(50);

      const result = await service.getCycleStats(mockCycleId.toString());

      expect(result.totalVoters).toBe(0);
      expect(result.totalEligible).toBe(50);
      expect(result.participationRate).toBe(0);
    });
  });

  // ── castVote — MongoDB 11000 duplicate key error ────────────────────────────

  describe('castVote — duplicate key error (11000)', () => {
    const now = new Date();
    const openCycle = {
      _id: mockCycleId,
      status: CycleStatus.BALLOT_OPEN,
      isLive: true,
      snapshotReady: true,
      ballotOpensAt: new Date(now.getTime() - 3_600_000),
      ballotClosesAt: new Date(now.getTime() + 3_600_000),
      prizes: [{ _id: mockPrizeId1, name: 'Phone' }],
    };

    it('should catch MongoDB 11000 error from voteModel.create and throw ConflictException(ALREADY_VOTED)', async () => {
      cycleModel.findOne.mockResolvedValue(openCycle);
      eligibilityModel.findOne.mockResolvedValue({
        cycleId: mockCycleId,
        userId: mockUserId,
        pointsSnapshot: 200,
      });
      voteModel.findOne.mockResolvedValue(null); // no existing vote at query time

      // Simulate race condition: MongoDB unique index violation
      const mongoError = Object.assign(new Error('E11000 duplicate key error'), { code: 11000 });
      voteModel.create.mockRejectedValue(mongoError);

      await expect(
        service.castVote(mockUserId.toString(), { prizeId: mockPrizeId1.toString() }),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.castVote(mockUserId.toString(), { prizeId: mockPrizeId1.toString() }),
      ).rejects.toThrow(VOTING_ERROR_CODES.ALREADY_VOTED);
    });

    it('should re-throw non-11000 errors from voteModel.create', async () => {
      cycleModel.findOne.mockResolvedValue(openCycle);
      eligibilityModel.findOne.mockResolvedValue({
        cycleId: mockCycleId,
        userId: mockUserId,
        pointsSnapshot: 200,
      });
      voteModel.findOne.mockResolvedValue(null);

      const dbError = Object.assign(new Error('Network timeout'), { code: 99999 });
      voteModel.create.mockRejectedValue(dbError);

      await expect(
        service.castVote(mockUserId.toString(), { prizeId: mockPrizeId1.toString() }),
      ).rejects.toThrow('Network timeout');
    });
  });

  // ── getActiveCycle — ACTIVE status path ────────────────────────────────────

  describe('getActiveCycle — ACTIVE status path', () => {
    it('should query live bag count from loyalty aggregation when cycle is ACTIVE', async () => {
      const activeCycle = {
        _id: mockCycleId,
        status: CycleStatus.ACTIVE,
        isLive: true,
        minimumBags: 50,
        cycleStartDate: new Date('2026-01-01'),
        prizes: [],
      };

      cycleModel.findOne.mockResolvedValue(activeCycle);

      // Loyalty aggregate for bag count
      loyaltyModel.aggregate.mockResolvedValue([{ _id: null, totalBags: 35 }]);
      // loyaltyModel.findOne for points snapshot
      loyaltyModel.findOne.mockResolvedValue({ availablePoints: 500 });
      voteModel.findOne.mockResolvedValue(null);

      const result = await service.getActiveCycle(mockUserId.toString());

      expect(loyaltyModel.aggregate).toHaveBeenCalled();
      expect(result.eligibility?.userBagsInCycle).toBe(35);
      expect(result.eligibility?.reason).toBe('BALLOT_NOT_OPEN');
    });

    it('should return pointsSnapshot from loyalty account availablePoints when ACTIVE', async () => {
      const activeCycle = {
        _id: mockCycleId,
        status: CycleStatus.ACTIVE,
        isLive: true,
        minimumBags: 50,
        cycleStartDate: new Date('2026-01-01'),
        prizes: [],
      };

      cycleModel.findOne.mockResolvedValue(activeCycle);
      loyaltyModel.aggregate.mockResolvedValue([{ _id: null, totalBags: 10 }]);
      loyaltyModel.findOne.mockResolvedValue({ availablePoints: 750 });
      voteModel.findOne.mockResolvedValue(null);

      const result = await service.getActiveCycle(mockUserId.toString());

      expect(loyaltyModel.findOne).toHaveBeenCalledWith(
        { userId: new Types.ObjectId(mockUserId.toString()) },
        { availablePoints: 1 },
      );
      expect(result.eligibility?.pointsSnapshot).toBe(750);
    });

    it('should return userBagsInCycle=0 and pointsSnapshot=0 when no loyalty data exists', async () => {
      const activeCycle = {
        _id: mockCycleId,
        status: CycleStatus.ACTIVE,
        isLive: true,
        minimumBags: 50,
        cycleStartDate: new Date('2026-01-01'),
        prizes: [],
      };

      cycleModel.findOne.mockResolvedValue(activeCycle);
      loyaltyModel.aggregate.mockResolvedValue([]); // no bag results
      loyaltyModel.findOne.mockResolvedValue(null); // no loyalty account
      voteModel.findOne.mockResolvedValue(null);

      const result = await service.getActiveCycle(mockUserId.toString());

      expect(result.eligibility?.userBagsInCycle).toBe(0);
      expect(result.eligibility?.pointsSnapshot).toBe(0);
    });

    it('should always set canVote=false and reason=BALLOT_NOT_OPEN when cycle is ACTIVE', async () => {
      const activeCycle = {
        _id: mockCycleId,
        status: CycleStatus.ACTIVE,
        isLive: true,
        minimumBags: 50,
        cycleStartDate: new Date('2026-01-01'),
        prizes: [],
      };

      cycleModel.findOne.mockResolvedValue(activeCycle);
      loyaltyModel.aggregate.mockResolvedValue([{ _id: null, totalBags: 999 }]);
      loyaltyModel.findOne.mockResolvedValue({ availablePoints: 9999 });
      voteModel.findOne.mockResolvedValue(null);

      const result = await service.getActiveCycle(mockUserId.toString());

      // Even with plenty of bags, cannot vote during ACTIVE (ballot not open)
      expect(result.eligibility?.canVote).toBe(false);
      expect(result.eligibility?.reason).toBe('BALLOT_NOT_OPEN');
    });
  });

  // ── Tally deterministic ordering ────────────────────────────────────────────

  describe('Tally deterministic ordering', () => {
    /**
     * The sort in runTally is: { totalWeightedVotes: -1, voterCount: -1, _id: 1 }
     * The mock returns pre-sorted data just as MongoDB would — we verify the
     * $sort stage in the aggregation pipeline rather than re-sorting in JS.
     */

    const buildTallyContext = () => {
      const tallyingCycle = {
        _id: mockCycleId,
        status: CycleStatus.TALLYING,
        prizes: [
          { _id: mockPrizeId1, name: 'Phone' },
          { _id: mockPrizeId2, name: 'Scooter' },
          { _id: mockPrizeId3, name: 'Tablet' },
        ],
      };
      cycleModel.findById.mockResolvedValue(tallyingCycle);
      auditLogModel.create.mockResolvedValue({});
      return tallyingCycle;
    };

    it('should pick prize with highest totalWeightedVotes as winner', async () => {
      buildTallyContext();

      // Aggregation returns pre-sorted results (highest votes first)
      voteModel.aggregate.mockResolvedValue([
        { _id: mockPrizeId2, totalWeightedVotes: 1000, voterCount: 10 }, // winner
        { _id: mockPrizeId1, totalWeightedVotes: 500, voterCount: 5 },
        { _id: mockPrizeId3, totalWeightedVotes: 200, voterCount: 2 },
      ]);

      const completedCycle = {
        _id: mockCycleId,
        status: CycleStatus.COMPLETED,
        winner: { prizeId: mockPrizeId2, name: 'Scooter', totalWeightedVotes: 1000 },
      };
      cycleModel.findOneAndUpdate.mockResolvedValue(completedCycle);

      const result = await service.manualTally(mockCycleId.toString(), mockAdminId.toString());

      // Verify the $set payload passed to findOneAndUpdate sets the correct winner
      const updateCall = cycleModel.findOneAndUpdate.mock.calls[0] as [
        unknown,
        { $set: Record<string, unknown> },
        unknown,
      ];
      const setPayload = updateCall[1].$set;
      const winner = setPayload['winner'] as { prizeId: Types.ObjectId; name: string };
      expect(winner.prizeId.toString()).toBe(mockPrizeId2.toString());
      expect(winner.name).toBe('Scooter');
      expect(result.status).toBe(CycleStatus.COMPLETED);
    });

    it('should use voterCount as tiebreaker when totalWeightedVotes are equal', async () => {
      buildTallyContext();

      // Aggregation pre-sorted: same votes, mockPrizeId2 has more voters
      voteModel.aggregate.mockResolvedValue([
        { _id: mockPrizeId2, totalWeightedVotes: 500, voterCount: 8 }, // wins on voterCount
        { _id: mockPrizeId1, totalWeightedVotes: 500, voterCount: 5 },
      ]);

      const completedCycle = { _id: mockCycleId, status: CycleStatus.COMPLETED };
      cycleModel.findOneAndUpdate.mockResolvedValue(completedCycle);

      await service.manualTally(mockCycleId.toString(), mockAdminId.toString());

      const updateCall = cycleModel.findOneAndUpdate.mock.calls[0] as [
        unknown,
        { $set: Record<string, unknown> },
        unknown,
      ];
      const winner = updateCall[1].$set['winner'] as { prizeId: Types.ObjectId };
      expect(winner.prizeId.toString()).toBe(mockPrizeId2.toString());
    });

    it('should use prizeId (_id) as final tiebreaker (ascending) for identical votes and voterCount', async () => {
      buildTallyContext();

      // Aggregation pre-sorted: identical votes + voterCount, lower ObjectId wins (ascending)
      // We simulate MongoDB's ascending _id sort by putting the smaller id first
      const smallerId = mockPrizeId1 < mockPrizeId2 ? mockPrizeId1 : mockPrizeId2;
      const largerId = mockPrizeId1 < mockPrizeId2 ? mockPrizeId2 : mockPrizeId1;

      voteModel.aggregate.mockResolvedValue([
        { _id: smallerId, totalWeightedVotes: 500, voterCount: 5 }, // wins on _id asc
        { _id: largerId, totalWeightedVotes: 500, voterCount: 5 },
      ]);

      const completedCycle = { _id: mockCycleId, status: CycleStatus.COMPLETED };
      cycleModel.findOneAndUpdate.mockResolvedValue(completedCycle);

      await service.manualTally(mockCycleId.toString(), mockAdminId.toString());

      const updateCall = cycleModel.findOneAndUpdate.mock.calls[0] as [
        unknown,
        { $set: Record<string, unknown> },
        unknown,
      ];
      const winner = updateCall[1].$set['winner'] as { prizeId: Types.ObjectId };
      expect(winner.prizeId.toString()).toBe(smallerId.toString());
    });

    it('should verify the aggregation pipeline includes correct sort stage', async () => {
      buildTallyContext();
      voteModel.aggregate.mockResolvedValue([]);
      const completedCycle = { _id: mockCycleId, status: CycleStatus.COMPLETED };
      cycleModel.findOneAndUpdate.mockResolvedValue(completedCycle);

      await service.manualTally(mockCycleId.toString(), mockAdminId.toString());

      const pipeline = voteModel.aggregate.mock.calls[0]![0] as Array<Record<string, unknown>>;
      const sortStage = pipeline.find(s => '$sort' in s) as
        | { $sort: Record<string, number> }
        | undefined;

      expect(sortStage).toBeDefined();
      expect(sortStage!.$sort).toMatchObject({
        totalWeightedVotes: -1,
        voterCount: -1,
        _id: 1,
      });
    });
  });
});
