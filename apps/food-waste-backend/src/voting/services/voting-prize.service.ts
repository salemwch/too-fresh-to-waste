import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  LEADERBOARD_PARTICIPANT_FILTER,
  LEADERBOARD_SORT,
} from '../../loyalty/constants/leaderboard-ranking';
import {
  LoyaltyAccount,
  type LoyaltyAccountDocument,
} from '../../loyalty/schemas/loyalty-account.schema';
import {
  PrizeClaim,
  PrizeClaimDocument,
  PrizeClaimStatus,
  PrizeSource,
  PrizeType,
} from '../../loyalty/schemas/prize-claim.schema';
import { PushNotificationService } from '../../notifications/services/push-notification.service';
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
    @InjectModel(VotingCycle.name) private readonly cycleModel: Model<VotingCycleDocument>,
    @InjectModel(LoyaltyAccount.name)
    private readonly loyaltyModel: Model<LoyaltyAccountDocument>,
    @InjectModel(PrizeClaim.name) private readonly prizeClaimModel: Model<PrizeClaimDocument>,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  /**
   * The users who win the voted prize: the top `recipientCount` of the
   * **leaderboard**.
   *
   * The vote decides *what* the prize is. The leaderboard decides *who* gets
   * it. Voting is not a lottery ticket.
   *
   * This previously ranked the top voters **who had backed the winning prize**,
   * which is a different population and a perverse one: the #1 user in the
   * country won nothing if they voted for the phone and the scooter won, while
   * someone at #14 who happened to back the scooter took a prize. It punished
   * people for voting honestly.
   *
   * Ranked with the shared leaderboard predicate so the winner list and the
   * list the user was shown cannot disagree — including the `_id` tiebreak,
   * without which ties resolve in an order MongoDB does not guarantee between
   * calls and the winner set could change under the same data.
   */
  async getPrizeWinners(recipientCount: number): Promise<VotingWinnerRow[]> {
    if (recipientCount <= 0) {
      return [];
    }

    const rows = await this.loyaltyModel
      .find(LEADERBOARD_PARTICIPANT_FILTER)
      .sort(LEADERBOARD_SORT)
      .limit(recipientCount)
      .select('userId totalPoints')
      .lean();

    return rows.map((row, idx) => ({
      userId: row.userId.toString(),
      rank: idx + 1,
      pointsSnapshot: row.totalPoints,
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
    const ranks = await this.getPrizeWinners(cycle.recipientCount);
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

  /**
   * Claims the grand prize the community voted for.
   *
   * No establishment and no voucher code: the grand prize is a physical item —
   * a scooter, a hotel stay, a gym year — delivered by an admin, not redeemed
   * at a business. Only the *discount*, which every other participant gets, is
   * tied to an establishment of their choosing.
   *
   * Previously this stamped `prizeType: DISCOUNT` on every winner whatever they
   * had actually won, and demanded an establishment for a scooter, so the
   * record of what was awarded was wrong and the claim flow asked a question
   * that made no sense.
   */
  async claimPrize(userId: string): Promise<VotingPrizeStatus> {
    const cycle = await this.getLatestCompletedCycle();
    if (!cycle?.winnerPrizeId) {
      throw new BadRequestException('No completed voting cycle is available to claim.');
    }

    const cycleId = (cycle._id as Types.ObjectId).toString();
    const ranks = await this.getPrizeWinners(cycle.recipientCount);
    const mine = ranks.find(r => r.userId === userId);
    if (!mine) {
      throw new BadRequestException(
        `Only the top ${cycle.recipientCount} on the leaderboard can claim this prize.`,
      );
    }

    const duplicate = await this.prizeClaimModel.findOne({
      userId: new Types.ObjectId(userId),
      votingCycleId: new Types.ObjectId(cycleId),
      source: PrizeSource.VOTING,
    });
    if (duplicate) {
      throw new ConflictException('You have already claimed your voting prize for this cycle.');
    }

    const winningPrize = cycle.prizes?.find(
      p => p._id.toString() === cycle.winnerPrizeId?.toString(),
    );

    try {
      await this.prizeClaimModel.create({
        userId: new Types.ObjectId(userId),
        prizeType: PrizeType.GRAND_PRIZE,
        // Snapshotted so an admin editing the catalogue later cannot rewrite
        // what this user was told they won.
        ...(cycle.winner?.name !== undefined ? { prizeName: cycle.winner.name } : {}),
        ...(winningPrize?.category !== undefined ? { prizeCategory: winningPrize.category } : {}),
        status: PrizeClaimStatus.PENDING,
        rank: mine.rank,
        totalPoints: mine.pointsSnapshot,
        cycleNumber: cycle.cycleNumber,
        source: PrizeSource.VOTING,
        votingCycleId: new Types.ObjectId(cycleId),
      });
    } catch (err) {
      // The read-then-write above lets two concurrent claims through; the
      // partial unique index is what actually stops the second one.
      if (typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000) {
        throw new ConflictException('You have already claimed your voting prize for this cycle.');
      }
      throw err;
    }

    this.logger.log(
      `Voting grand prize claimed by user ${userId} (rank ${mine.rank}) for cycle ${cycleId}`,
    );

    return this.getMyPrize(userId);
  }

  /**
   * Fire one push notification per prize winner. Swallows all errors — never
   * blocks tally. Call fire-and-forget with `void` from runTally.
   */
  async notifyWinners(cycleId: string, recipientCount: number, prizeName: string): Promise<void> {
    try {
      const winners = await this.getPrizeWinners(recipientCount);

      const sendPromises = winners.map(async winner => {
        const result = await this.pushNotificationService.send(
          {
            title: '🎉 You won a prize!',
            // "on the leaderboard", not "in the vote": the vote chose the
            // prize, the leaderboard chose the winners.
            body: `You finished #${winner.rank} on the leaderboard and won the ${prizeName}. Claim your prize now!`,
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
