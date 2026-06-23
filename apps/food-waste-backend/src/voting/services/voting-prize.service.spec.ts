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
