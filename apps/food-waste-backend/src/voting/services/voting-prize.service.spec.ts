import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { Vote } from '../schemas/vote.schema';
import { VotingCycle } from '../schemas/voting-cycle.schema';
import { PrizeClaim } from '../../loyalty/schemas/prize-claim.schema';
import { Establishment } from '../../establishments/schemas/establishment.schema';
import { PushNotificationService } from '../../notifications/services/push-notification.service';

import { VotingPrizeService } from './voting-prize.service';

describe('VotingPrizeService.getWinningVoterRanks', () => {
  const prizeId = new Types.ObjectId();
  const voteModel = { aggregate: jest.fn() };

  async function buildService() {
    const moduleRef = await Test.createTestingModule({
      providers: [
        VotingPrizeService,
        { provide: getModelToken(Vote.name), useValue: voteModel },
        { provide: getModelToken(VotingCycle.name), useValue: {} },
        { provide: getModelToken(PrizeClaim.name), useValue: {} },
        { provide: getModelToken(Establishment.name), useValue: {} },
        { provide: PushNotificationService, useValue: { send: jest.fn() } },
      ],
    }).compile();
    return moduleRef;
  }

  beforeEach(() => jest.clearAllMocks());

  it('ranks the top N voters by pointsSnapshot desc, votedAt asc for ties', async () => {
    const u1 = new Types.ObjectId();
    const u2 = new Types.ObjectId();
    const u3 = new Types.ObjectId();
    // Aggregate returns pre-sorted rows (sort done in the pipeline).
    voteModel.aggregate.mockResolvedValue([
      { userId: u1, pointsSnapshot: 100 },
      { userId: u2, pointsSnapshot: 100 },
      { userId: u3, pointsSnapshot: 50 },
    ]);

    const moduleRef = await buildService();
    const service = moduleRef.get(VotingPrizeService);

    const rows = await service.getWinningVoterRanks(new Types.ObjectId().toString(), prizeId, 2);

    expect(rows).toEqual([
      { userId: u1.toString(), rank: 1, pointsSnapshot: 100 },
      { userId: u2.toString(), rank: 2, pointsSnapshot: 100 },
    ]);
    // recipientCount=2 → only 2 rows even though 3 voters exist.
    expect(rows).toHaveLength(2);
  });

  it('returns an empty array when there are no voters', async () => {
    voteModel.aggregate.mockResolvedValue([]);
    const moduleRef = await buildService();
    const service = moduleRef.get(VotingPrizeService);

    const rows = await service.getWinningVoterRanks(new Types.ObjectId().toString(), prizeId, 5);
    expect(rows).toEqual([]);
  });
});

describe('VotingPrizeService.getMyPrize', () => {
  const winningPrizeId = new Types.ObjectId();
  const winnerUser = new Types.ObjectId();
  const loserUser = new Types.ObjectId();
  const cycleId = new Types.ObjectId();

  const voteModel = { aggregate: jest.fn() };
  const cycleModel = { findOne: jest.fn() };
  const prizeClaimModel = { findOne: jest.fn() };

  async function buildService() {
    const moduleRef = await Test.createTestingModule({
      providers: [
        VotingPrizeService,
        { provide: getModelToken(Vote.name), useValue: voteModel },
        { provide: getModelToken(VotingCycle.name), useValue: cycleModel },
        { provide: getModelToken(PrizeClaim.name), useValue: prizeClaimModel },
        { provide: getModelToken(Establishment.name), useValue: {} },
        { provide: PushNotificationService, useValue: { send: jest.fn() } },
      ],
    }).compile();
    return moduleRef;
  }

  beforeEach(() => jest.clearAllMocks());

  function mockCompletedCycle() {
    cycleModel.findOne.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: cycleId,
          name: 'Eco Cycle 3',
          recipientCount: 5,
          winnerPrizeId: winningPrizeId,
          winner: { prizeId: winningPrizeId, name: 'Smart Garden' },
        }),
      }),
    });
  }

  it('reports a top-N voter as a winner who has not claimed', async () => {
    mockCompletedCycle();
    voteModel.aggregate.mockResolvedValue([
      { userId: winnerUser, pointsSnapshot: 200 },
      { userId: loserUser, pointsSnapshot: 10 },
    ]);
    prizeClaimModel.findOne.mockResolvedValue(null);

    const moduleRef = await buildService();
    const service = moduleRef.get(VotingPrizeService);

    const result = await service.getMyPrize(winnerUser.toString());

    expect(result.isWinner).toBe(true);
    expect(result.rank).toBe(1);
    expect(result.recipientCount).toBe(5);
    expect(result.cycleId).toBe(cycleId.toString());
    expect(result.prizeName).toBe('Smart Garden');
    expect(result.hasClaimed).toBe(false);
    expect(result.voucherCode).toBeNull();
    expect(result.status).toBeNull();
  });

  it('reports a non-winner with isWinner=false', async () => {
    mockCompletedCycle();
    voteModel.aggregate.mockResolvedValue([{ userId: winnerUser, pointsSnapshot: 200 }]);
    prizeClaimModel.findOne.mockResolvedValue(null);

    const moduleRef = await buildService();
    const service = moduleRef.get(VotingPrizeService);

    const result = await service.getMyPrize(loserUser.toString());
    expect(result.isWinner).toBe(false);
    expect(result.rank).toBeNull();
  });

  it('reflects an existing claim with voucher + status', async () => {
    mockCompletedCycle();
    voteModel.aggregate.mockResolvedValue([{ userId: winnerUser, pointsSnapshot: 200 }]);
    prizeClaimModel.findOne.mockResolvedValue({
      voucherCode: 'TFW-ABC123',
      establishmentName: 'Green Cafe',
      status: 'pending',
    });

    const moduleRef = await buildService();
    const service = moduleRef.get(VotingPrizeService);

    const result = await service.getMyPrize(winnerUser.toString());
    expect(result.hasClaimed).toBe(true);
    expect(result.voucherCode).toBe('TFW-ABC123');
    expect(result.establishmentName).toBe('Green Cafe');
    expect(result.status).toBe('pending');
  });

  it('returns a non-winner shell when there is no completed cycle', async () => {
    cycleModel.findOne.mockReturnValue({
      sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    });
    const moduleRef = await buildService();
    const service = moduleRef.get(VotingPrizeService);

    const result = await service.getMyPrize(winnerUser.toString());
    expect(result.isWinner).toBe(false);
    expect(result.cycleId).toBeNull();
  });
});
