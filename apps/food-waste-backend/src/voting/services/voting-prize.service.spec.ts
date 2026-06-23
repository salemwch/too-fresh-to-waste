import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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

describe('VotingPrizeService.claimPrize', () => {
  const winningPrizeId = new Types.ObjectId();
  const winnerUser = new Types.ObjectId();
  const cycleId = new Types.ObjectId();
  const estId = new Types.ObjectId();

  const voteModel = { aggregate: jest.fn() };
  const cycleModel = { findOne: jest.fn() };
  const prizeClaimModel = { findOne: jest.fn(), exists: jest.fn(), create: jest.fn() };
  const establishmentModel = { findById: jest.fn() };

  async function buildService() {
    const moduleRef = await Test.createTestingModule({
      providers: [
        VotingPrizeService,
        { provide: getModelToken(Vote.name), useValue: voteModel },
        { provide: getModelToken(VotingCycle.name), useValue: cycleModel },
        { provide: getModelToken(PrizeClaim.name), useValue: prizeClaimModel },
        { provide: getModelToken(Establishment.name), useValue: establishmentModel },
        { provide: PushNotificationService, useValue: { send: jest.fn() } },
      ],
    }).compile();
    return moduleRef;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    cycleModel.findOne.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: cycleId,
          name: 'Eco Cycle 3',
          cycleNumber: 3,
          recipientCount: 5,
          winnerPrizeId: winningPrizeId,
          winner: { prizeId: winningPrizeId, name: 'Smart Garden' },
        }),
      }),
    });
    voteModel.aggregate.mockResolvedValue([{ userId: winnerUser, pointsSnapshot: 200 }]);
  });

  it('throws when the user is not a winner', async () => {
    voteModel.aggregate.mockResolvedValue([{ userId: new Types.ObjectId(), pointsSnapshot: 5 }]);
    const moduleRef = await buildService();
    const service = moduleRef.get(VotingPrizeService);
    await expect(
      service.claimPrize(winnerUser.toString(), estId.toString()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFound for a missing establishment', async () => {
    prizeClaimModel.findOne.mockResolvedValue(null);
    establishmentModel.findById.mockResolvedValue(null);
    const moduleRef = await buildService();
    const service = moduleRef.get(VotingPrizeService);
    await expect(
      service.claimPrize(winnerUser.toString(), estId.toString()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws Conflict when already claimed', async () => {
    prizeClaimModel.findOne.mockResolvedValue({ voucherCode: 'TFW-OLD111', status: 'pending' });
    const moduleRef = await buildService();
    const service = moduleRef.get(VotingPrizeService);
    await expect(
      service.claimPrize(winnerUser.toString(), estId.toString()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a voting PrizeClaim and returns claimed status', async () => {
    prizeClaimModel.findOne
      .mockResolvedValueOnce(null) // duplicate check inside claimPrize
      .mockResolvedValueOnce({
        voucherCode: 'TFW-NEW222',
        establishmentName: 'Green Cafe',
        status: 'pending',
      }); // getMyPrize re-read
    establishmentModel.findById.mockResolvedValue({ _id: estId, name: 'Green Cafe' });
    prizeClaimModel.exists.mockResolvedValue(null);
    prizeClaimModel.create.mockResolvedValue({ voucherCode: 'TFW-NEW222' });

    const moduleRef = await buildService();
    const service = moduleRef.get(VotingPrizeService);
    const result = await service.claimPrize(winnerUser.toString(), estId.toString());

    expect(prizeClaimModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'voting',
        prizeType: 'discount',
        establishmentName: 'Green Cafe',
      }),
    );
    expect(result.hasClaimed).toBe(true);
    expect(result.voucherCode).toBe('TFW-NEW222');
  });
});

describe('VotingPrizeService.notifyWinners', () => {
  const winningPrizeId = new Types.ObjectId();
  const u1 = new Types.ObjectId();
  const u2 = new Types.ObjectId();

  const voteModel = { aggregate: jest.fn() };
  const push = { send: jest.fn().mockResolvedValue({ success: true }) };

  async function buildService() {
    const moduleRef = await Test.createTestingModule({
      providers: [
        VotingPrizeService,
        { provide: getModelToken(Vote.name), useValue: voteModel },
        { provide: getModelToken(VotingCycle.name), useValue: {} },
        { provide: getModelToken(PrizeClaim.name), useValue: {} },
        { provide: getModelToken(Establishment.name), useValue: {} },
        { provide: PushNotificationService, useValue: push },
      ],
    }).compile();
    return moduleRef;
  }

  beforeEach(() => jest.clearAllMocks());

  it('sends one push per winner with userId target', async () => {
    voteModel.aggregate.mockResolvedValue([
      { userId: u1, pointsSnapshot: 100 },
      { userId: u2, pointsSnapshot: 90 },
    ]);
    const moduleRef = await buildService();
    const service = moduleRef.get(VotingPrizeService);

    await service.notifyWinners(new Types.ObjectId().toString(), winningPrizeId, 5, 'Smart Garden');

    expect(push.send).toHaveBeenCalledTimes(2);
    expect(push.send).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.any(String), body: expect.any(String) }),
      { userId: u1.toString() },
    );
  });

  it('never throws when a push fails', async () => {
    voteModel.aggregate.mockResolvedValue([{ userId: u1, pointsSnapshot: 100 }]);
    push.send.mockRejectedValueOnce(new Error('fcm down'));
    const moduleRef = await buildService();
    const service = moduleRef.get(VotingPrizeService);

    await expect(
      service.notifyWinners(new Types.ObjectId().toString(), winningPrizeId, 5, 'Smart Garden'),
    ).resolves.toBeUndefined();
  });

  it('resolves immediately with no pushes when there are no winners', async () => {
    voteModel.aggregate.mockResolvedValue([]);
    const moduleRef = await buildService();
    const service = moduleRef.get(VotingPrizeService);

    await service.notifyWinners(new Types.ObjectId().toString(), winningPrizeId, 5, 'Smart Garden');

    expect(push.send).not.toHaveBeenCalled();
  });

  it('includes correct rank in the notification body', async () => {
    voteModel.aggregate.mockResolvedValue([
      { userId: u1, pointsSnapshot: 100 },
      { userId: u2, pointsSnapshot: 90 },
    ]);
    const moduleRef = await buildService();
    const service = moduleRef.get(VotingPrizeService);

    await service.notifyWinners(new Types.ObjectId().toString(), winningPrizeId, 5, 'Smart Garden');

    // rank 1 → u1, rank 2 → u2
    const firstCall = push.send.mock.calls[0] as [{ title: string; body: string }, unknown];
    expect(firstCall[0].body).toContain('#1');
    const secondCall = push.send.mock.calls[1] as [{ title: string; body: string }, unknown];
    expect(secondCall[0].body).toContain('#2');
  });
});
