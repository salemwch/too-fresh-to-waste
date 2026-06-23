import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Vote, type VoteDocument } from '../schemas/vote.schema';
import { VotingCycle, type VotingCycleDocument } from '../schemas/voting-cycle.schema';
import {
  PrizeClaim,
  PrizeClaimDocument,
  PrizeSource,
} from '../../loyalty/schemas/prize-claim.schema';

export interface VotingWinnerRow {
  userId: string;
  rank: number;
  pointsSnapshot: number;
}

export interface VotingPrizeStatus {
  isWinner: boolean;
  rank: number | null;
  recipientCount: number;
  cycleId: string | null;
  cycleName: string | null;
  prizeName: string | null;
  hasClaimed: boolean;
  voucherCode: string | null;
  establishmentName: string | null;
  status: 'pending' | 'verified' | 'delivered' | 'rejected' | null;
}

const NOT_A_WINNER: VotingPrizeStatus = {
  isWinner: false,
  rank: null,
  recipientCount: 0,
  cycleId: null,
  cycleName: null,
  prizeName: null,
  hasClaimed: false,
  voucherCode: null,
  establishmentName: null,
  status: null,
};

@Injectable()
export class VotingPrizeService {
  private readonly logger = new Logger(VotingPrizeService.name);

  constructor(
    @InjectModel(Vote.name) private readonly voteModel: Model<VoteDocument>,
    @InjectModel(VotingCycle.name) private readonly cycleModel: Model<VotingCycleDocument>,
    @InjectModel(PrizeClaim.name) private readonly prizeClaimModel: Model<PrizeClaimDocument>,
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

  /** Returns the most recently completed VotingCycle, or null if none. */
  private async getLatestCompletedCycle(): Promise<VotingCycleDocument | null> {
    const cycle = await this.cycleModel
      .findOne({ status: 'COMPLETED', winnerPrizeId: { $ne: null } })
      .sort({ cycleNumber: -1 })
      .lean<VotingCycleDocument | null>();
    return cycle;
  }

  /** Returns the latest completed cycle prize status for the given user. */
  async getMyPrize(userId: string): Promise<VotingPrizeStatus> {
    const cycle = await this.getLatestCompletedCycle();
    if (!cycle?.winnerPrizeId) {
      return { ...NOT_A_WINNER };
    }

    const cycleId = (cycle._id as Types.ObjectId).toString();
    const ranks = await this.getWinningVoterRanks(
      cycleId,
      cycle.winnerPrizeId,
      cycle.recipientCount,
    );
    const mine = ranks.find(r => r.userId === userId);

    const prizeName = cycle.winner?.name ?? null;

    if (!mine) {
      return {
        ...NOT_A_WINNER,
        recipientCount: cycle.recipientCount,
        cycleId,
        cycleName: cycle.name,
        prizeName,
      };
    }

    const existing = await this.prizeClaimModel.findOne({
      userId: new Types.ObjectId(userId),
      votingCycleId: new Types.ObjectId(cycleId),
      source: PrizeSource.VOTING,
    });

    this.logger.debug(`getMyPrize userId=${userId} cycleId=${cycleId} rank=${mine.rank}`);

    return {
      isWinner: true,
      rank: mine.rank,
      recipientCount: cycle.recipientCount,
      cycleId,
      cycleName: cycle.name,
      prizeName,
      hasClaimed: existing !== null,
      voucherCode: existing?.voucherCode ?? null,
      establishmentName: existing?.establishmentName ?? null,
      status: existing?.status ?? null,
    };
  }
}
