import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'crypto';
import { Model, Types } from 'mongoose';

import {
  Establishment,
  type EstablishmentDocument,
} from '../../establishments/schemas/establishment.schema';
import {
  PrizeClaim,
  PrizeClaimDocument,
  PrizeClaimStatus,
  PrizeSource,
  PrizeType,
} from '../../loyalty/schemas/prize-claim.schema';
import { PushNotificationService } from '../../notifications/services/push-notification.service';
import { Vote, type VoteDocument } from '../schemas/vote.schema';
import { VotingCycle, type VotingCycleDocument } from '../schemas/voting-cycle.schema';

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

  /** Claims a voting prize voucher for a winner user at the chosen establishment. */
  async claimPrize(userId: string, establishmentId: string): Promise<VotingPrizeStatus> {
    const cycle = await this.getLatestCompletedCycle();
    if (!cycle?.winnerPrizeId) {
      throw new BadRequestException('No completed voting cycle is available to claim.');
    }

    const cycleId = (cycle._id as Types.ObjectId).toString();
    const ranks = await this.getWinningVoterRanks(
      cycleId,
      cycle.winnerPrizeId,
      cycle.recipientCount,
    );
    const mine = ranks.find(r => r.userId === userId);
    if (!mine) {
      throw new BadRequestException('You are not among the winning voters for this cycle.');
    }

    const duplicate = await this.prizeClaimModel.findOne({
      userId: new Types.ObjectId(userId),
      votingCycleId: new Types.ObjectId(cycleId),
      source: PrizeSource.VOTING,
    });
    if (duplicate) {
      throw new ConflictException('You have already claimed your voting prize for this cycle.');
    }

    const establishment = await this.establishmentModel.findById(establishmentId);
    if (!establishment) {
      throw new NotFoundException('Establishment not found');
    }

    const voucherCode = await this.generateVoucherCode();

    await this.prizeClaimModel.create({
      userId: new Types.ObjectId(userId),
      prizeType: PrizeType.DISCOUNT,
      status: PrizeClaimStatus.PENDING,
      rank: mine.rank,
      totalPoints: mine.pointsSnapshot,
      cycleNumber: cycle.cycleNumber,
      source: PrizeSource.VOTING,
      votingCycleId: new Types.ObjectId(cycleId),
      establishmentId: new Types.ObjectId(establishmentId),
      establishmentName: establishment.name,
      voucherCode,
    });

    this.logger.log(
      `Voting prize claimed by user ${userId} (rank ${mine.rank}) at ${establishment.name} for cycle ${cycleId}`,
    );

    return this.getMyPrize(userId);
  }

  /** Generates a unique TFW-XXXXXX voucher code, retrying up to 10 times on collision. */
  private async generateVoucherCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = `TFW-${randomBytes(3).toString('hex').toUpperCase()}`;
      const exists = await this.prizeClaimModel.exists({ voucherCode: code });
      if (!exists) {
        return code;
      }
    }
    // Fallback: base-36 timestamp suffix (extremely unlikely to reach this path)
    return `TFW-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  }

  /**
   * Fire one push notification per winning voter. Swallows all errors — never
   * blocks tally. Call fire-and-forget with `void` from runTally.
   */
  async notifyWinners(
    cycleId: string,
    winnerPrizeId: Types.ObjectId,
    recipientCount: number,
    prizeName: string,
  ): Promise<void> {
    try {
      const winners = await this.getWinningVoterRanks(cycleId, winnerPrizeId, recipientCount);

      const sendPromises = winners.map(async winner => {
        const result = await this.pushNotificationService.send(
          {
            title: '🎉 You won a prize!',
            body: `You ranked #${winner.rank} in the community vote and won a ${prizeName} discount. Claim your prize now!`,
            data: { type: 'voting_prize', cycleId, rank: String(winner.rank) },
          },
          { userId: winner.userId },
        );
        return result;
      });
      const results = await Promise.allSettled(sendPromises);

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      this.logger.log(
        `notifyWinners cycleId=${cycleId}: ${succeeded} sent, ${failed} failed out of ${winners.length} winners`,
      );

      results.forEach((result, idx) => {
        if (result.status === 'rejected') {
          this.logger.warn(
            `Winner push failed for user ${winners[idx]?.userId ?? 'unknown'}: ${String((result as PromiseRejectedResult).reason)}`,
          );
        }
      });
    } catch (err) {
      this.logger.error(
        `notifyWinners failed for cycle ${cycleId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
