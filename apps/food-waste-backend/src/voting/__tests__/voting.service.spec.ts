import { CycleStatus, PrizeCategory } from '@foodwaste/shared';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';

import { LoyaltyAccount } from '../../loyalty/schemas/loyalty-account.schema';
import { Counter } from '../schemas/counter.schema';
import { Vote } from '../schemas/vote.schema';
import { VotingAuditLog } from '../schemas/voting-audit-log.schema';
import { VotingCycle } from '../schemas/voting-cycle.schema';
import { VotingEligibility } from '../schemas/voting-eligibility.schema';
import { VotingPrizeService } from '../services/voting-prize.service';
import { VotingService } from '../voting.service';

const mockCycleId = new Types.ObjectId();
const mockUserId = new Types.ObjectId();
const mockPrizeId = new Types.ObjectId();

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

describe('VotingService', () => {
  let service: VotingService;
  let cycleModel: ReturnType<typeof createMockModel>;
  let voteModel: ReturnType<typeof createMockModel>;
  let eligibilityModel: ReturnType<typeof createMockModel>;
  let auditLogModel: ReturnType<typeof createMockModel>;
  let counterModel: ReturnType<typeof createMockModel>;
  let loyaltyModel: ReturnType<typeof createMockModel>;

  beforeEach(async () => {
    cycleModel = createMockModel();
    voteModel = createMockModel();
    eligibilityModel = createMockModel();
    auditLogModel = createMockModel();
    counterModel = createMockModel();
    loyaltyModel = createMockModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VotingService,
        { provide: getModelToken(VotingCycle.name), useValue: cycleModel },
        { provide: getModelToken(Vote.name), useValue: voteModel },
        { provide: getModelToken(VotingEligibility.name), useValue: eligibilityModel },
        { provide: getModelToken(VotingAuditLog.name), useValue: auditLogModel },
        { provide: getModelToken(Counter.name), useValue: counterModel },
        { provide: getModelToken(LoyaltyAccount.name), useValue: loyaltyModel },
        {
          provide: VotingPrizeService,
          useValue: { notifyWinners: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<VotingService>(VotingService);
  });

  // ── createCycle ───────────────────────────────────────────────────────────

  describe('createCycle', () => {
    it('should create a cycle with atomically assigned cycleNumber', async () => {
      counterModel.findOneAndUpdate.mockResolvedValue({ seq: 42 });
      cycleModel.create.mockResolvedValue({
        _id: mockCycleId,
        name: 'Summer 2026',
        cycleNumber: 42,
        status: CycleStatus.DRAFT,
      });

      const result = await service.createCycle(
        {
          name: 'Summer 2026',
          cycleStartDate: '2026-07-01T00:00:00Z',
          cycleEndDate: '2026-12-31T00:00:00Z',
          communityGoalTarget: 30000,
          minimumBags: 50,
          recipientCount: 5,
          prizes: [
            {
              name: 'Phone',
              description: 'A phone',
              imageUrl: 'https://res.cloudinary.com/img.jpg',
              category: PrizeCategory.PHONE,
              value: '1000 DT',
            },
            {
              name: 'Scooter',
              description: 'A scooter',
              imageUrl: 'https://res.cloudinary.com/img2.jpg',
              category: PrizeCategory.ELECTRIC_SCOOTER,
              value: '2000 DT',
            },
          ],
        },
        mockUserId.toString(),
      );

      expect(counterModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'votingCycle' },
        { $inc: { seq: 1 } },
        { upsert: true, new: true },
      );
      expect(result.cycleNumber).toBe(42);
      expect(result.status).toBe(CycleStatus.DRAFT);
    });
  });

  // ── activateCycle ─────────────────────────────────────────────────────────

  describe('activateCycle', () => {
    it('should transition DRAFT → ACTIVE and set isLive', async () => {
      const mockCycle = {
        _id: mockCycleId,
        status: CycleStatus.ACTIVE,
        isLive: true,
        // Future date — skips aggregateBagCountForCycle call
        cycleStartDate: new Date('2027-01-01'),
      };
      cycleModel.findOneAndUpdate.mockResolvedValue(mockCycle);
      auditLogModel.create.mockResolvedValue({});

      const result = await service.activateCycle(mockCycleId.toString(), mockUserId.toString());

      expect(cycleModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: new Types.ObjectId(mockCycleId.toString()), status: CycleStatus.DRAFT },
        { $set: { status: CycleStatus.ACTIVE, isLive: true } },
        { new: true },
      );
      expect(auditLogModel.create).toHaveBeenCalled();
      expect(result.isLive).toBe(true);
    });

    it('should throw ConflictException when another live cycle exists', async () => {
      // findOneAndUpdate returns null (DRAFT filter failed)
      cycleModel.findOneAndUpdate.mockResolvedValue(null);
      // findById returns cycle that exists but is not DRAFT (i.e., ACTIVE)
      cycleModel.findById.mockResolvedValue({
        _id: mockCycleId,
        status: CycleStatus.ACTIVE,
      });

      await expect(
        service.activateCycle(mockCycleId.toString(), mockUserId.toString()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when cycle does not exist', async () => {
      cycleModel.findOneAndUpdate.mockResolvedValue(null);
      cycleModel.findById.mockResolvedValue(null);

      await expect(
        service.activateCycle(mockCycleId.toString(), mockUserId.toString()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for concurrent conflict (DRAFT exists but update fails)', async () => {
      cycleModel.findOneAndUpdate.mockResolvedValue(null);
      // Cycle is DRAFT so the `exists.status !== CycleStatus.DRAFT` check passes,
      // landing on the ConflictException
      cycleModel.findById.mockResolvedValue({
        _id: mockCycleId,
        status: CycleStatus.DRAFT,
      });

      await expect(
        service.activateCycle(mockCycleId.toString(), mockUserId.toString()),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── castVote ──────────────────────────────────────────────────────────────

  describe('castVote', () => {
    const now = new Date();

    const buildOpenCycle = (
      overrides: Partial<{
        snapshotReady: boolean;
        ballotOpensAt: Date;
        ballotClosesAt: Date;
      }> = {},
    ) => ({
      _id: mockCycleId,
      status: CycleStatus.BALLOT_OPEN,
      isLive: true,
      snapshotReady: overrides.snapshotReady ?? true,
      ballotOpensAt: overrides.ballotOpensAt ?? new Date(now.getTime() - 3_600_000), // 1hr ago
      ballotClosesAt: overrides.ballotClosesAt ?? new Date(now.getTime() + 3_600_000), // 1hr ahead
      prizes: [{ _id: mockPrizeId, name: 'Phone' }],
    });

    it('should cast a vote for an eligible user', async () => {
      cycleModel.findOne.mockResolvedValue(buildOpenCycle());
      eligibilityModel.findOne.mockResolvedValue({
        cycleId: mockCycleId,
        userId: mockUserId,
        pointsSnapshot: 150,
      });
      voteModel.findOne.mockResolvedValue(null);
      voteModel.create.mockResolvedValue({
        cycleId: mockCycleId,
        userId: mockUserId,
        prizeId: mockPrizeId,
        pointsSnapshot: 150,
      });

      const result = await service.castVote(mockUserId.toString(), {
        prizeId: mockPrizeId.toString(),
      });

      expect(voteModel.create).toHaveBeenCalled();
      expect(result.pointsSnapshot).toBe(150);
    });

    it('should throw NotFoundException when ballot is not open (no live BALLOT_OPEN cycle)', async () => {
      cycleModel.findOne.mockResolvedValue(null);

      await expect(
        service.castVote(mockUserId.toString(), { prizeId: mockPrizeId.toString() }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when snapshot is not ready', async () => {
      cycleModel.findOne.mockResolvedValue(buildOpenCycle({ snapshotReady: false }));

      await expect(
        service.castVote(mockUserId.toString(), { prizeId: mockPrizeId.toString() }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for invalid prizeId (not in cycle prizes)', async () => {
      cycleModel.findOne.mockResolvedValue(buildOpenCycle());
      eligibilityModel.findOne.mockResolvedValue({
        cycleId: mockCycleId,
        userId: mockUserId,
        pointsSnapshot: 100,
      });
      voteModel.findOne.mockResolvedValue(null);

      const unknownPrizeId = new Types.ObjectId();
      await expect(
        service.castVote(mockUserId.toString(), { prizeId: unknownPrizeId.toString() }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException for non-eligible user', async () => {
      cycleModel.findOne.mockResolvedValue(buildOpenCycle());
      eligibilityModel.findOne.mockResolvedValue(null);

      await expect(
        service.castVote(mockUserId.toString(), { prizeId: mockPrizeId.toString() }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException for duplicate vote', async () => {
      cycleModel.findOne.mockResolvedValue(buildOpenCycle());
      eligibilityModel.findOne.mockResolvedValue({
        cycleId: mockCycleId,
        userId: mockUserId,
        pointsSnapshot: 100,
      });
      voteModel.findOne.mockResolvedValue({ _id: new Types.ObjectId() }); // existing vote

      await expect(
        service.castVote(mockUserId.toString(), { prizeId: mockPrizeId.toString() }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException at exact ballotClosesAt (exclusive end boundary)', async () => {
      const closesAt = new Date(); // "now" — window is [past, now) so now >= closesAt fails
      cycleModel.findOne.mockResolvedValue(
        buildOpenCycle({
          ballotOpensAt: new Date(closesAt.getTime() - 172_800_000),
          ballotClosesAt: closesAt,
        }),
      );

      await expect(
        service.castVote(mockUserId.toString(), { prizeId: mockPrizeId.toString() }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── getResults ────────────────────────────────────────────────────────────

  describe('getResults', () => {
    it('should enforce vote-first-to-see during BALLOT_OPEN', async () => {
      cycleModel.findOne.mockResolvedValue({
        _id: mockCycleId,
        status: CycleStatus.BALLOT_OPEN,
        isLive: true,
        prizes: [{ _id: mockPrizeId, name: 'Phone' }],
      });
      voteModel.findOne.mockResolvedValue(null); // user has not voted

      await expect(service.getResults(mockUserId.toString())).rejects.toThrow(ForbiddenException);
    });

    it('should return results to everyone after COMPLETED', async () => {
      cycleModel.findOne.mockResolvedValue({
        _id: mockCycleId,
        status: CycleStatus.COMPLETED,
        isLive: true,
        prizes: [{ _id: mockPrizeId, name: 'Phone' }],
      });
      voteModel.aggregate.mockResolvedValue([
        { _id: mockPrizeId, totalWeightedVotes: 500, voterCount: 5 },
      ]);
      eligibilityModel.countDocuments.mockResolvedValue(10);

      const result = await service.getResults(mockUserId.toString());

      expect(result.results).toHaveLength(1);
      const firstResult = result.results[0];
      expect(firstResult?.name).toBe('Phone');
      expect(result.totalVoters).toBe(5);
      expect(result.totalEligible).toBe(10);
    });

    it('should throw NotFoundException when no live cycle', async () => {
      cycleModel.findOne.mockResolvedValue(null);

      await expect(service.getResults(mockUserId.toString())).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when cycle is still ACTIVE (results not available)', async () => {
      cycleModel.findOne.mockResolvedValue({
        _id: mockCycleId,
        status: CycleStatus.ACTIVE,
        isLive: true,
        prizes: [],
      });

      await expect(service.getResults(mockUserId.toString())).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateCycle — field locking ───────────────────────────────────────────

  describe('updateCycle — field locking', () => {
    it('should allow all fields when cycle is DRAFT', async () => {
      cycleModel.findById.mockResolvedValue({
        _id: mockCycleId,
        status: CycleStatus.DRAFT,
      });
      cycleModel.findByIdAndUpdate.mockResolvedValue({
        _id: mockCycleId,
        minimumBags: 100,
      });

      const result = await service.updateCycle(mockCycleId.toString(), { minimumBags: 100 });
      expect(result.minimumBags).toBe(100);
      expect(cycleModel.findByIdAndUpdate).toHaveBeenCalled();
    });

    it('should reject locked fields (minimumBags) in ACTIVE status', async () => {
      cycleModel.findById.mockResolvedValue({
        _id: mockCycleId,
        status: CycleStatus.ACTIVE,
      });

      await expect(
        service.updateCycle(mockCycleId.toString(), { minimumBags: 100 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject locked field (prizes) in ACTIVE status', async () => {
      cycleModel.findById.mockResolvedValue({
        _id: mockCycleId,
        status: CycleStatus.ACTIVE,
      });

      await expect(
        service.updateCycle(mockCycleId.toString(), {
          prizes: [
            {
              name: 'Updated Phone',
              description: 'desc',
              imageUrl: 'https://res.cloudinary.com/img.jpg',
              category: PrizeCategory.PHONE,
              value: '1000 DT',
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow non-locked fields (name) in ACTIVE status', async () => {
      cycleModel.findById.mockResolvedValue({
        _id: mockCycleId,
        status: CycleStatus.ACTIVE,
      });
      cycleModel.findByIdAndUpdate.mockResolvedValue({
        _id: mockCycleId,
        name: 'Updated Name',
      });

      const result = await service.updateCycle(mockCycleId.toString(), { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException when cycle does not exist', async () => {
      cycleModel.findById.mockResolvedValue(null);

      await expect(service.updateCycle(mockCycleId.toString(), { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject cycleStartDate in ACTIVE status (locked after draft)', async () => {
      cycleModel.findById.mockResolvedValue({
        _id: mockCycleId,
        status: CycleStatus.ACTIVE,
      });

      await expect(
        service.updateCycle(mockCycleId.toString(), { cycleStartDate: '2026-08-01T00:00:00Z' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject communityGoalTarget in ACTIVE status (locked after draft)', async () => {
      cycleModel.findById.mockResolvedValue({
        _id: mockCycleId,
        status: CycleStatus.ACTIVE,
      });

      await expect(
        service.updateCycle(mockCycleId.toString(), { communityGoalTarget: 9999 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── getActiveCycle ────────────────────────────────────────────────────────

  describe('getActiveCycle', () => {
    it('should return null cycle and eligibility when no live cycle exists', async () => {
      cycleModel.findOne.mockResolvedValue(null);

      const result = await service.getActiveCycle(mockUserId.toString());

      expect(result.cycle).toBeNull();
      expect(result.eligibility).toBeNull();
      expect(result.myVote).toBeNull();
    });

    it('should return cycle with eligibility canVote=true for eligible user during BALLOT_OPEN', async () => {
      const liveCycle = {
        _id: mockCycleId,
        status: CycleStatus.BALLOT_OPEN,
        isLive: true,
        snapshotReady: true,
        minimumBags: 50,
        cycleStartDate: new Date('2026-01-01'),
        prizes: [{ _id: mockPrizeId, name: 'Phone' }],
      };
      cycleModel.findOne.mockResolvedValue(liveCycle);
      eligibilityModel.findOne.mockResolvedValue({
        bagsSavedInCycle: 60,
        pointsSnapshot: 200,
      });
      voteModel.findOne.mockResolvedValue(null); // no existing vote

      const result = await service.getActiveCycle(mockUserId.toString());

      expect(result.cycle).toBe(liveCycle);
      expect(result.eligibility?.canVote).toBe(true);
      expect(result.eligibility?.pointsSnapshot).toBe(200);
    });

    it('should return canVote=false with ALREADY_VOTED reason when user already voted', async () => {
      const liveCycle = {
        _id: mockCycleId,
        status: CycleStatus.BALLOT_OPEN,
        isLive: true,
        snapshotReady: true,
        minimumBags: 50,
        cycleStartDate: new Date('2026-01-01'),
        prizes: [{ _id: mockPrizeId, name: 'Phone' }],
      };
      cycleModel.findOne.mockResolvedValue(liveCycle);
      eligibilityModel.findOne.mockResolvedValue({
        bagsSavedInCycle: 60,
        pointsSnapshot: 200,
      });
      voteModel.findOne.mockResolvedValue({ _id: new Types.ObjectId() }); // already voted

      const result = await service.getActiveCycle(mockUserId.toString());

      expect(result.eligibility?.canVote).toBe(false);
      expect(result.eligibility?.reason).toBe('ALREADY_VOTED');
    });
  });

  // ── incrementCommunityGoalProgress ────────────────────────────────────────

  describe('incrementCommunityGoalProgress', () => {
    it('should $inc communityGoalProgress on the ACTIVE cycle', async () => {
      cycleModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      await service.incrementCommunityGoalProgress(3);

      expect(cycleModel.updateOne).toHaveBeenCalledWith(
        { status: CycleStatus.ACTIVE },
        { $inc: { communityGoalProgress: 3 } },
      );
    });

    it('should increment by exactly the provided bagCount', async () => {
      cycleModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      await service.incrementCommunityGoalProgress(10);

      expect(cycleModel.updateOne).toHaveBeenCalledWith(
        { status: CycleStatus.ACTIVE },
        { $inc: { communityGoalProgress: 10 } },
      );
    });
  });
});
