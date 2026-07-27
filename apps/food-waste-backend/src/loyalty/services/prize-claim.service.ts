import { randomBytes } from 'crypto';

import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  CommunityBagGoal,
  CommunityBagGoalDocument,
} from '../../community-goal/schemas/community-bag-goal.schema';
import {
  Establishment,
  EstablishmentDocument,
} from '../../establishments/schemas/establishment.schema';
import { EmailNotificationService } from '../../notifications/services/email-notification.service';
import { outranking } from '../constants/leaderboard-ranking';
import { LoyaltyAccount, LoyaltyAccountDocument } from '../schemas/loyalty-account.schema';
import {
  PrizeClaim,
  PrizeClaimDocument,
  PrizeClaimStatus,
  PrizeType,
} from '../schemas/prize-claim.schema';

/** Ranks 1..3 win a smartphone; rank 4 and below win a discount voucher. */
const PHONE_MAX_RANK = 3;

/**
 * One message for both duplicate-claim paths — the pre-check and the unique
 * index — so the user cannot tell which one caught them.
 */
const DUPLICATE_CLAIM_MESSAGE = 'You have already claimed your prize for this challenge.';

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
 * The season is a fixed window — see `docs/plans/cycle-lifecycle-scenarios.md`
 * §4.1 — so reaching the target does not end it early. The target is read once,
 * here, when the season is already over, and it decides only whether the
 * collective prizes unlocked.
 */
const targetReached = (goal: Pick<CommunityBagGoal, 'currentCount' | 'targetCount'>): boolean =>
  goal.currentCount >= goal.targetCount;

@Injectable()
export class PrizeClaimService {
  private readonly logger = new Logger(PrizeClaimService.name);

  constructor(
    @InjectModel(PrizeClaim.name) private readonly prizeClaimModel: Model<PrizeClaimDocument>,
    @InjectModel(LoyaltyAccount.name) private readonly loyaltyModel: Model<LoyaltyAccountDocument>,
    @InjectModel(CommunityBagGoal.name) private readonly goalModel: Model<CommunityBagGoalDocument>,
    @InjectModel(Establishment.name)
    private readonly establishmentModel: Model<EstablishmentDocument>,
    private readonly emailService: EmailNotificationService,
    private readonly configService: ConfigService,
  ) {}

  async getClaimStatus(userId: string) {
    const goal = await this.getEndedGoal();
    if (!goal) {
      return {
        hasClaimed: false,
        claim: null,
        eligiblePrizeType: null,
        rank: null,
        targetReached: false,
      };
    }

    const rank = await this.getUserRank(userId);
    const eligiblePrizeType = this.eligiblePrizeType(rank, goal);

    const existing = await this.prizeClaimModel.findOne({
      userId: new Types.ObjectId(userId),
      cycleNumber: goal.cycleNumber,
    });

    return {
      hasClaimed: existing !== null,
      claim: existing ? this.toResponse(existing) : null,
      eligiblePrizeType: rank !== null ? eligiblePrizeType : null,
      rank,
      targetReached: targetReached(goal),
    };
  }

  async claimSmartphone(userId: string) {
    const goal = await this.requireEndedGoal();
    const rank = await this.requireUserRank(userId);

    /*
     * The smartphone is the community's prize, not a personal one: it is
     * unlocked by the season hitting its bag target. When the season falls
     * short nobody wins one — the top ranks fall back to the discount voucher
     * along with everyone else.
     */
    if (!targetReached(goal)) {
      throw new BadRequestException(
        'The community did not reach its goal this season, so the smartphone prize was not unlocked. You can still claim your discount.',
      );
    }

    if (rank > PHONE_MAX_RANK) {
      throw new BadRequestException(
        `Only the top ${PHONE_MAX_RANK} users can claim a smartphone. Your rank is ${rank}.`,
      );
    }

    await this.ensureNoDuplicateClaim(userId, goal.cycleNumber);

    const account = await this.loyaltyModel.findOne({ userId: new Types.ObjectId(userId) });
    const totalPoints = account?.totalPoints ?? 0;

    const claim = await this.createClaim({
      userId: new Types.ObjectId(userId),
      prizeType: PrizeType.SMARTPHONE,
      status: PrizeClaimStatus.PENDING,
      rank,
      totalPoints,
      cycleNumber: goal.cycleNumber,
    });

    this.logger.log(`Smartphone claimed by user ${userId} at rank ${rank}`);

    this.sendAdminNotification(userId, rank, totalPoints, goal.cycleNumber).catch(err =>
      this.logger.error(`Admin notification failed: ${(err as Error).message}`),
    );

    return this.toResponse(claim);
  }

  async claimDiscount(userId: string, establishmentId: string) {
    const goal = await this.requireEndedGoal();
    const rank = await this.requireUserRank(userId);

    // Only steer the top ranks to the smartphone when there *is* one to win.
    if (targetReached(goal) && rank <= PHONE_MAX_RANK) {
      throw new BadRequestException(
        `The top ${PHONE_MAX_RANK} should claim a smartphone, not a discount.`,
      );
    }

    const establishment = await this.establishmentModel.findById(establishmentId);
    if (!establishment) {
      throw new NotFoundException('Establishment not found');
    }

    await this.ensureNoDuplicateClaim(userId, goal.cycleNumber);

    const account = await this.loyaltyModel.findOne({ userId: new Types.ObjectId(userId) });
    const totalPoints = account?.totalPoints ?? 0;

    const voucherCode = await this.generateVoucherCode();

    const claim = await this.createClaim({
      userId: new Types.ObjectId(userId),
      prizeType: PrizeType.DISCOUNT,
      status: PrizeClaimStatus.PENDING,
      rank,
      totalPoints,
      cycleNumber: goal.cycleNumber,
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
    goal: Pick<CommunityBagGoal, 'currentCount' | 'targetCount'>,
  ): PrizeType {
    return rank !== null && rank <= PHONE_MAX_RANK && targetReached(goal)
      ? PrizeType.SMARTPHONE
      : PrizeType.DISCOUNT;
  }

  private async getEndedGoal() {
    const goal = await this.goalModel
      .findOne({ endDate: { $lte: new Date() } })
      .sort({ cycleNumber: -1 });
    return goal;
  }

  private async requireEndedGoal() {
    const goal = await this.getEndedGoal();
    if (!goal) {
      throw new BadRequestException('No challenge has ended yet. Prizes cannot be claimed.');
    }
    return goal;
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
      .select('_id totalPoints isActive')
      .lean();

    /*
     * Only two ways to be unranked: no loyalty account, or a deactivated one.
     * Leaderboard consent deliberately plays no part — hiding your name hides
     * the name, not the player. A user shown as "Anonymous" still holds their
     * rank and still wins the prize that rank earns.
     */
    if (!account?.isActive) {
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
      throw new BadRequestException('You are not a participant in the leaderboard.');
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

  private async sendAdminNotification(
    userId: string,
    rank: number,
    totalPoints: number,
    cycleNumber: number,
  ) {
    const adminEmails = this.configService.get<string>('ADMIN_NOTIFICATION_EMAILS');
    if (!adminEmails) {
      this.logger.warn('ADMIN_NOTIFICATION_EMAILS not configured — skipping prize notification');
      return;
    }

    const emails = adminEmails
      .split(',')
      .map(e => e.trim())
      .filter(Boolean);

    for (const email of emails) {
      await this.emailService.sendTemplateEmail(
        {
          subject: `[Prize Claim] Smartphone claimed — Rank #${rank} (Cycle ${cycleNumber})`,
          htmlBody: `
            <h2>Smartphone Prize Claimed</h2>
            <p>A user has claimed their smartphone prize and needs verification.</p>
            <table style="border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:8px;font-weight:bold">User ID</td><td style="padding:8px">${userId}</td></tr>
              <tr><td style="padding:8px;font-weight:bold">Rank</td><td style="padding:8px">#${rank}</td></tr>
              <tr><td style="padding:8px;font-weight:bold">Total Points</td><td style="padding:8px">${totalPoints.toLocaleString()}</td></tr>
              <tr><td style="padding:8px;font-weight:bold">Cycle</td><td style="padding:8px">${cycleNumber}</td></tr>
              <tr><td style="padding:8px;font-weight:bold">Status</td><td style="padding:8px;color:#F59E0B;font-weight:bold">PENDING VERIFICATION</td></tr>
            </table>
            <p>Please verify this claim in the admin dashboard before shipping.</p>
          `,
          textBody: `Smartphone Prize Claimed — Rank #${rank}, User ${userId}, Cycle ${cycleNumber}. Status: PENDING VERIFICATION.`,
        },
        { userId: email },
      );
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
