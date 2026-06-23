import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Establishment,
  type EstablishmentDocument,
} from '../../establishments/schemas/establishment.schema';
import { PushNotificationService } from '../../notifications/services/push-notification.service';
import { PrizeClaim, type PrizeClaimDocument } from '../../loyalty/schemas/prize-claim.schema';
import { Vote, type VoteDocument } from '../schemas/vote.schema';
import { VotingCycle, type VotingCycleDocument } from '../schemas/voting-cycle.schema';

export interface VotingWinnerRow {
  userId: string;
  rank: number;
  pointsSnapshot: number;
}

@Injectable()
export class VotingPrizeService {
  private readonly logger = new Logger(VotingPrizeService.name);

  constructor(
    @InjectModel(Vote.name) private readonly voteModel: Model<VoteDocument>,
    @InjectModel(VotingCycle.name) private readonly cycleModel: Model<VotingCycleDocument>,
    @InjectModel(PrizeClaim.name) private readonly prizeClaimModel: Model<PrizeClaimDocument>,
    @InjectModel(Establishment.name)
    private readonly establishmentModel: Model<EstablishmentDocument>,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  /**
   * Top `recipientCount` voters for the winning prize, ranked by pointsSnapshot
   * desc, then votedAt asc for ties. Deterministic — ties broken by insertion
   * order (_id asc) as a final tiebreaker.
   */
  async getWinningVoterRanks(
    cycleId: string,
    winnerPrizeId: Types.ObjectId,
    recipientCount: number,
  ): Promise<VotingWinnerRow[]> {
    if (recipientCount <= 0) {
      return [];
    }

    const rows = await this.voteModel.aggregate<{
      userId: Types.ObjectId;
      pointsSnapshot: number;
    }>([
      {
        $match: {
          cycleId: new Types.ObjectId(cycleId),
          prizeId: new Types.ObjectId(winnerPrizeId.toString()),
        },
      },
      { $sort: { pointsSnapshot: -1, votedAt: 1, _id: 1 } },
      { $limit: recipientCount },
      { $project: { _id: 0, userId: 1, pointsSnapshot: 1 } },
    ]);

    return rows.slice(0, recipientCount).map((row, idx) => ({
      userId: row.userId.toString(),
      rank: idx + 1,
      pointsSnapshot: row.pointsSnapshot,
    }));
  }
}
