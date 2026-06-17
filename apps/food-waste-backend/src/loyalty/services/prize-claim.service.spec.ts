/* eslint-disable require-await */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { PrizeClaimService } from './prize-claim.service';
import { PrizeClaimStatus, PrizeType } from '../schemas/prize-claim.schema';

const USER_ID = '660000000000000000000001';
const USER_ID_OBJ = new Types.ObjectId(USER_ID);
const EST_ID = '670000000000000000000001';

const makeGoal = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(),
  cycleNumber: 1,
  endDate: new Date('2025-01-01'),
  ...overrides,
});

const makeClaim = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(),
  userId: USER_ID_OBJ,
  prizeType: PrizeType.SMARTPHONE,
  status: PrizeClaimStatus.PENDING,
  rank: 1,
  totalPoints: 5000,
  cycleNumber: 1,
  createdAt: new Date(),
  toString() {
    return this._id.toString();
  },
  ...overrides,
});

const buildMocks = () => {
  const prizeClaimModel = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation(async data => makeClaim(data)),
    exists: jest.fn().mockResolvedValue(null),
  };

  const loyaltyModel = {
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { userId: USER_ID_OBJ, totalPoints: 5000 },
            { userId: new Types.ObjectId('660000000000000000000002'), totalPoints: 4000 },
            { userId: new Types.ObjectId('660000000000000000000003'), totalPoints: 3000 },
            { userId: new Types.ObjectId('660000000000000000000004'), totalPoints: 2000 },
            { userId: new Types.ObjectId('660000000000000000000005'), totalPoints: 1000 },
            { userId: new Types.ObjectId('660000000000000000000006'), totalPoints: 500 },
            { userId: new Types.ObjectId('660000000000000000000007'), totalPoints: 100 },
          ]),
        }),
      }),
    }),
    findOne: jest.fn().mockResolvedValue({ totalPoints: 5000 }),
  };

  const goalModel = {
    findOne: jest.fn().mockReturnValue({
      sort: jest.fn().mockResolvedValue(makeGoal()),
    }),
  };

  const establishmentModel = {
    findById: jest.fn().mockResolvedValue({ _id: EST_ID, name: 'Test Restaurant' }),
  };

  const emailService = {
    sendTemplateEmail: jest.fn().mockResolvedValue(undefined),
  };

  const configService = {
    get: jest.fn().mockReturnValue('admin@test.com'),
  };

  return {
    prizeClaimModel,
    loyaltyModel,
    goalModel,
    establishmentModel,
    emailService,
    configService,
  };
};

const buildService = (mocks: ReturnType<typeof buildMocks>) => {
  return new PrizeClaimService(
    mocks.prizeClaimModel as never,
    mocks.loyaltyModel as never,
    mocks.goalModel as never,
    mocks.establishmentModel as never,
    mocks.emailService as never,
    mocks.configService as never,
  );
};

describe('PrizeClaimService', () => {
  let service: PrizeClaimService;
  let mocks: ReturnType<typeof buildMocks>;

  beforeEach(() => {
    mocks = buildMocks();
    service = buildService(mocks);
  });

  afterEach(() => jest.restoreAllMocks());

  // ─── getClaimStatus ─────────────────────────────────────────────────────────

  describe('getClaimStatus', () => {
    it('should return defaults when no challenge has ended', async () => {
      mocks.goalModel.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });

      const result = await service.getClaimStatus(USER_ID);

      expect(result).toEqual({
        hasClaimed: false,
        claim: null,
        eligiblePrizeType: null,
        rank: null,
      });
    });

    it('should return smartphone eligible for top 5 user', async () => {
      const result = await service.getClaimStatus(USER_ID);

      expect(result.hasClaimed).toBe(false);
      expect(result.eligiblePrizeType).toBe(PrizeType.SMARTPHONE);
      expect(result.rank).toBe(1);
    });

    it('should return discount eligible for rank 6+ user', async () => {
      const rank6UserId = '660000000000000000000006';

      const result = await service.getClaimStatus(rank6UserId);

      expect(result.hasClaimed).toBe(false);
      expect(result.eligiblePrizeType).toBe(PrizeType.DISCOUNT);
      expect(result.rank).toBe(6);
    });

    it('should return hasClaimed=true when user already claimed', async () => {
      const existingClaim = makeClaim();
      mocks.prizeClaimModel.findOne.mockResolvedValue(existingClaim);

      const result = await service.getClaimStatus(USER_ID);

      expect(result.hasClaimed).toBe(true);
      expect(result.claim).not.toBeNull();
    });

    it('should return null rank for user not on leaderboard', async () => {
      const unknownUser = '660000000000000000000099';

      const result = await service.getClaimStatus(unknownUser);

      expect(result.rank).toBeNull();
      expect(result.eligiblePrizeType).toBeNull();
    });
  });

  // ─── claimSmartphone ────────────────────────────────────────────────────────

  describe('claimSmartphone', () => {
    it('should create a pending smartphone claim for rank 1 user', async () => {
      const result = await service.claimSmartphone(USER_ID);

      expect(mocks.prizeClaimModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID_OBJ,
          prizeType: PrizeType.SMARTPHONE,
          status: PrizeClaimStatus.PENDING,
          rank: 1,
        }),
      );
      expect(result.prizeType).toBe(PrizeType.SMARTPHONE);
    });

    it('should reject rank > 5 from claiming smartphone', async () => {
      const rank6UserId = '660000000000000000000006';

      await expect(service.claimSmartphone(rank6UserId)).rejects.toThrow(BadRequestException);
    });

    it('should reject when no challenge has ended', async () => {
      mocks.goalModel.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });

      await expect(service.claimSmartphone(USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate claims', async () => {
      mocks.prizeClaimModel.findOne.mockResolvedValue(makeClaim());

      await expect(service.claimSmartphone(USER_ID)).rejects.toThrow(ConflictException);
    });

    it('should send admin notification email on success', async () => {
      await service.claimSmartphone(USER_ID);

      // Allow async fire-and-forget to settle
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mocks.emailService.sendTemplateEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Smartphone claimed'),
        }),
        expect.objectContaining({ userId: 'admin@test.com' }),
      );
    });

    it('should not crash when ADMIN_NOTIFICATION_EMAILS is not configured', async () => {
      mocks.configService.get.mockReturnValue(undefined);

      const result = await service.claimSmartphone(USER_ID);

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(result.prizeType).toBe(PrizeType.SMARTPHONE);
      expect(mocks.emailService.sendTemplateEmail).not.toHaveBeenCalled();
    });

    it('should reject user not on the leaderboard', async () => {
      const unknownUser = '660000000000000000000099';

      await expect(service.claimSmartphone(unknownUser)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── claimDiscount ──────────────────────────────────────────────────────────

  describe('claimDiscount', () => {
    const rank6UserId = '660000000000000000000006';

    it('should create a pending discount claim with establishment reference', async () => {
      const result = await service.claimDiscount(rank6UserId, EST_ID);

      expect(mocks.prizeClaimModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          prizeType: PrizeType.DISCOUNT,
          status: PrizeClaimStatus.PENDING,
          rank: 6,
          establishmentName: 'Test Restaurant',
        }),
      );
      expect(result.prizeType).toBe(PrizeType.DISCOUNT);
    });

    it('should reject top 5 user from claiming discount', async () => {
      await expect(service.claimDiscount(USER_ID, EST_ID)).rejects.toThrow(BadRequestException);
    });

    it('should reject when establishment not found', async () => {
      mocks.establishmentModel.findById.mockResolvedValue(null);

      await expect(service.claimDiscount(rank6UserId, EST_ID)).rejects.toThrow(NotFoundException);
    });

    it('should reject duplicate claims', async () => {
      mocks.prizeClaimModel.findOne.mockResolvedValue(makeClaim({ prizeType: PrizeType.DISCOUNT }));

      await expect(service.claimDiscount(rank6UserId, EST_ID)).rejects.toThrow(ConflictException);
    });

    it('should reject when no challenge has ended', async () => {
      mocks.goalModel.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });

      await expect(service.claimDiscount(rank6UserId, EST_ID)).rejects.toThrow(BadRequestException);
    });

    it('should reject user not on the leaderboard', async () => {
      const unknownUser = '660000000000000000000099';

      await expect(service.claimDiscount(unknownUser, EST_ID)).rejects.toThrow(BadRequestException);
    });
  });
});
