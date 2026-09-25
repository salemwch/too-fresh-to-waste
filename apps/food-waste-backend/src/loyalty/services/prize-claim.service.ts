import { randomBytes } from 'crypto';

import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Establishment,
  EstablishmentDocument,
} from '../../establishments/schemas/establishment.schema';
import { VotingCycle, type VotingCycleDocument } from '../../voting/schemas/voting-cycle.schema';
import { outranking } from '../constants/leaderboard-ranking';
import { LoyaltyAccount, LoyaltyAccountDocument } from '../schemas/loyalty-account.schema';
import {
  PrizeClaim,
  PrizeClaimDocument,
  PrizeClaimStatus,
  PrizeType,
} from '../schemas/prize-claim.schema';

import { appError } from '../../common/errors';
/**
 * Bags a user must have saved to place on the leaderboard at all, and so to
 * qualify for the discount.
 *
 * One: the entry price is taking part. Voting has a much higher bar
 * (`VotingCycle.minimumBags`, 25) because voting steers the prize; the
 * discount only rewards what you personally saved.
 */
const MIN_BAGS_FOR_DISCOUNT = 1;

/**
 * One message for both duplicate-claim paths — the pre-check and the unique
 * index — so the user cannot tell which one caught them.
 */
const DUPLICATE_CLAIM_MESSAGE = appError('CHALLENGE_PRIZE_ALREADY_CLAIMED');

/**
 * MongoDB's duplicate-key error, narrowed enough to tell which unique index
 * rejected the write. Both `{ userId, cycleNumber }` and the partial
 * `{ userId, votingCycleId }` mean "already claimed"; a collision on
 * `voucherCode` does not, and must not be reported as one.
 */
const isDuplicateKeyError = (
  err: unknown,
): err is { code: number; keyPattern?: Record<string, unknown> } =>
  typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;

/**
 * Did the season hit its community bag target?
 *
 * Reads the **season** (`VotingCycle`, 30,000 bags), not the recurring
 * mini-goal (`MonthlyBagGoal`, 500 bags → points). Those are two different
 * features that both count bags; gating the grand prize on the mini-goal meant
 * it unlocked at 500. See `docs/plans/merge-two-prize-systems.md` §2.
 *
 * The season is a fixed window — see `cycle-lifecycle-scenarios.md` §4.1 — so
 * reaching the target does not end it early. The target is read once, here,
 * when the season is already over, and decides only whether the collective
 * prizes unlocked.
 */
const targetReached = (
  season: Pick<VotingCycle, 'seasonBagProgress' | 'seasonBagTarget'>,
): boolean => season.seasonBagProgress >= season.seasonBagTarget;

@Injectable()
export class PrizeClaimService {
  private readonly logger = new Logger(PrizeClaimService.name);

  constructor(
    @InjectModel(PrizeClaim.name) private readonly prizeClaimModel: Model<PrizeClaimDocument>,
    @InjectModel(LoyaltyAccount.name) private readonly loyaltyModel: Model<LoyaltyAccountDocument>,
    @InjectModel(VotingCycle.name) private readonly seasonModel: Model<VotingCycleDocument>,
    @InjectModel(Establishment.name)
    private readonly establishmentModel: Model<EstablishmentDocument>,
  ) {}

  async getClaimStatus(userId: string) {
    const season = await this.getEndedSeason();
    if (!season) {
      return {
        hasClaimed: false,
        claim: null,
        eligiblePrizeType: null,
        rank: null,
        targetReached: false,
        recipientCount: 0,
      };
    }

    const rank = await this.getUserRank(userId);
    const eligiblePrizeType = this.eligiblePrizeType(rank, season);

    const existing = await this.prizeClaimModel.findOne({
      userId: new Types.ObjectId(userId),
      cycleNumber: season.cycleNumber,
    });

    return {
      hasClaimed: existing !== null,
      claim: existing ? this.toResponse(existing) : null,
      eligiblePrizeType: rank !== null ? eligiblePrizeType : null,
      rank,
      targetReached: targetReached(season),
      // The app draws the prize cutoff at this rank rather than assuming 3.
      recipientCount: season.recipientCount,
    };
  }

  async claimDiscount(userId: string, establishmentId: string) {
    const season = await this.requireEndedSeason();
    const rank = await this.requireUserRank(userId);

    /*
     * Steer the top ranks to the grand prize — but only when there is one to
     * win. A season that fell short pays everyone a discount, top ranks
     * included.
     *
     * How many rank as winners is the season's `recipientCount`, set by the
     * admin per cycle. It used to be a hardcoded 3 here while the voting path
     * read `recipientCount` (5 on every existing cycle), so ranks 4 and 5 were
     * told they had won by one screen and refused by the other.
     */
    if (targetReached(season) && rank <= season.recipientCount) {
      throw new BadRequestException(appError('LEADERBOARD_CLAIM_GRAND_PRIZE'));
    }

    const establishment = await this.establishmentModel.findById(establishmentId);
    if (!establishment) {
      throw new NotFoundException(appError('ESTABLISHMENT_NOT_FOUND'));
    }

    await this.ensureNoDuplicateClaim(userId, season.cycleNumber);

    const account = await this.loyaltyModel.findOne({ userId: new Types.ObjectId(userId) });
    const totalPoints = account?.totalPoints ?? 0;

    const voucherCode = await this.generateVoucherCode();

    const claim = await this.createClaim({
      userId: new Types.ObjectId(userId),
      prizeType: PrizeType.DISCOUNT,
      status: PrizeClaimStatus.PENDING,
      rank,
      totalPoints,
      cycleNumber: season.cycleNumber,
      establishmentId: new Types.ObjectId(establishmentId),
      establishmentName: establishment.name,
      voucherCode,
    });

    this.logger.log(
      `Discount claimed by user ${userId} at rank ${rank} for establishment ${establishment.name}`,
    );

    return this.toResponse(claim);
  }

  /**
   * Which prize this rank qualifies for, given how the season ended.
   *
   * Two payouts with different rules: the smartphone is collective and needs
   * the community target; the discount voucher is the personal payout for the
   * points you earned yourself, so it is unconditional. A season that fell
   * short pays everyone a discount, the top ranks included.
   */
  private eligiblePrizeType(
    rank: number | null,
    season: Pick<VotingCycle, 'seasonBagProgress' | 'seasonBagTarget' | 'recipientCount'>,
  ): PrizeType {
    return rank !== null && rank <= season.recipientCount && targetReached(season)
      ? PrizeType.GRAND_PRIZE
      : PrizeType.DISCOUNT;
  }

  /**
   * The most recent season that has ended, or null.
   *
   * Reads `VotingCycle.cycleEndDate`, not the mini-goal's `endDate`. The
   * mini-goal repeats every 500 bags and its end date says nothing about
   * whether the season is over.
   */
  private async getEndedSeason() {
    // Assigned rather than `return await`: require-await wants the await,
    // no-return-await forbids returning it directly.
    const season = await this.seasonModel
      .findOne({ cycleEndDate: { $lte: new Date() } })
      .sort({ cycleNumber: -1 });
    return season;
  }

  private async requireEndedSeason() {
    const season = await this.getEndedSeason();
    if (!season) {
      throw new BadRequestException(appError('CHALLENGE_NOT_ENDED'));
    }
    return season;
  }

  /**
   * The caller's leaderboard rank, or null if they are not ranked.
   *
   * Counts the accounts ahead rather than loading the leaderboard and calling
   * findIndex on it. The old form pulled every loyalty account into memory on
   * every prize-screen open — i.e. from every user at once, at season end,
   * which is the one moment the collection is largest and the traffic heaviest.
   *
   * Deliberately reads the database rather than the Redis rank cache
   * `resolveCurrentUserEntry` uses: a stale rank is a cosmetic problem on the
   * leaderboard and a wrong prize here.
   */
  private async getUserRank(userId: string): Promise<number | null> {
    const account = await this.loyaltyModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .select('_id totalPoints isActive totalBagsSaved')
      .lean();

    /*
     * Three ways to be unranked: no loyalty account, a deactivated one, or
     * never having saved a bag. The last is the entry price — you take part by
     * rescuing food, so an account that has saved nothing has not taken part.
     *
     * Leaderboard consent deliberately plays no part: hiding your name hides
     * the name, not the player. A user shown as "Anonymous" still holds their
     * rank and still wins the prize that rank earns.
     */
    if (!account?.isActive || (account.totalBagsSaved ?? 0) < MIN_BAGS_FOR_DISCOUNT) {
      return null;
    }

    const ahead = await this.loyaltyModel.countDocuments(
      outranking(account.totalPoints, account._id),
    );
    return ahead + 1;
  }

  private async requireUserRank(userId: string): Promise<number> {
    const rank = await this.getUserRank(userId);
    if (rank === null) {
      throw new BadRequestException(appError('LEADERBOARD_NOT_LISTED'));
    }
    return rank;
  }

  private async ensureNoDuplicateClaim(userId: string, cycleNumber: number) {
    const existing = await this.prizeClaimModel.findOne({
      userId: new Types.ObjectId(userId),
      cycleNumber,
    });
    if (existing) {
      throw new ConflictException(DUPLICATE_CLAIM_MESSAGE);
    }
  }

  /**
   * Writes the claim, translating a unique-index rejection into the same 409
   * the pre-check raises.
   *
   * `ensureNoDuplicateClaim` reads and then writes, so two requests arriving
   * together both pass the read. The unique index on `{ userId, cycleNumber }`
   * is what actually stops the second claim — but an unhandled E11000 surfaces
   * as a 500, telling the user the app broke when in fact it correctly refused
   * a double claim. The pre-check stays because it fails before the voucher
   * code and establishment lookup are spent; this is the guard that holds.
   */
  private async createClaim(data: Record<string, unknown>): Promise<PrizeClaimDocument> {
    try {
      return await this.prizeClaimModel.create(data);
    } catch (err) {
      // A voucherCode collision is not a duplicate claim — let it surface.
      if (isDuplicateKeyError(err) && err.keyPattern?.['userId'] !== undefined) {
        throw new ConflictException(DUPLICATE_CLAIM_MESSAGE);
      }
      throw err;
    }
  }

  private async generateVoucherCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = `TFW-${randomBytes(3).toString('hex').toUpperCase()}`;
      const exists = await this.prizeClaimModel.exists({ voucherCode: code });
      if (!exists) {
        return code;
      }
    }
    const fallback = `TFW-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    return fallback;
  }

  private toResponse(doc: PrizeClaimDocument) {
    return {
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      prizeType: doc.prizeType,
      // What the user was actually told they won — the app shows this rather
      // than assuming a phone.
      ...(doc.prizeName ? { prizeName: doc.prizeName } : {}),
      ...(doc.prizeCategory ? { prizeCategory: doc.prizeCategory } : {}),
      status: doc.status,
      rank: doc.rank,
      totalPoints: doc.totalPoints,
      cycleNumber: doc.cycleNumber,
      ...(doc.establishmentId ? { establishmentId: doc.establishmentId.toString() } : {}),
      ...(doc.establishmentName ? { establishmentName: doc.establishmentName } : {}),
      ...(doc.voucherCode ? { voucherCode: doc.voucherCode } : {}),
      ...(doc.adminNotes ? { adminNotes: doc.adminNotes } : {}),
      ...(doc.verifiedAt ? { verifiedAt: doc.verifiedAt.toISOString() } : {}),
      ...(doc.deliveredAt ? { deliveredAt: doc.deliveredAt.toISOString() } : {}),
      createdAt:
        (doc as unknown as { createdAt?: Date }).createdAt?.toISOString() ??
        new Date().toISOString(),
    };
  }
}
