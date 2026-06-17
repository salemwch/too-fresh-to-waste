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
import { LoyaltyAccount, LoyaltyAccountDocument } from '../schemas/loyalty-account.schema';
import {
  PrizeClaim,
  PrizeClaimDocument,
  PrizeClaimStatus,
  PrizeType,
} from '../schemas/prize-claim.schema';

const PHONE_MAX_RANK = 5;

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
      return { hasClaimed: false, claim: null, eligiblePrizeType: null, rank: null };
    }

    const rank = await this.getUserRank(userId);
    const eligiblePrizeType =
      rank !== null && rank <= PHONE_MAX_RANK ? PrizeType.SMARTPHONE : PrizeType.DISCOUNT;

    const existing = await this.prizeClaimModel.findOne({
      userId: new Types.ObjectId(userId),
      cycleNumber: goal.cycleNumber,
    });

    return {
      hasClaimed: existing !== null,
      claim: existing ? this.toResponse(existing) : null,
      eligiblePrizeType: rank !== null ? eligiblePrizeType : null,
      rank,
    };
  }

  async claimSmartphone(userId: string) {
    const goal = await this.requireEndedGoal();
    const rank = await this.requireUserRank(userId);

    if (rank > PHONE_MAX_RANK) {
      throw new BadRequestException(
        `Only the top ${PHONE_MAX_RANK} users can claim a smartphone. Your rank is ${rank}.`,
      );
    }

    await this.ensureNoDuplicateClaim(userId, goal.cycleNumber);

    const account = await this.loyaltyModel.findOne({ userId: new Types.ObjectId(userId) });
    const totalPoints = account?.totalPoints ?? 0;

    const claim = await this.prizeClaimModel.create({
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

    if (rank <= PHONE_MAX_RANK) {
      throw new BadRequestException('Top 5 users should claim a smartphone, not a discount.');
    }

    const establishment = await this.establishmentModel.findById(establishmentId);
    if (!establishment) {
      throw new NotFoundException('Establishment not found');
    }

    await this.ensureNoDuplicateClaim(userId, goal.cycleNumber);

    const account = await this.loyaltyModel.findOne({ userId: new Types.ObjectId(userId) });
    const totalPoints = account?.totalPoints ?? 0;

    const voucherCode = await this.generateVoucherCode();

    const claim = await this.prizeClaimModel.create({
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

  private async getUserRank(userId: string): Promise<number | null> {
    const allAccounts = await this.loyaltyModel
      .find({ isActive: true })
      .sort({ totalPoints: -1 })
      .select('userId totalPoints')
      .lean();

    const idx = allAccounts.findIndex(a => a.userId.toString() === userId);
    return idx >= 0 ? idx + 1 : null;
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
      throw new ConflictException('You have already claimed your prize for this challenge.');
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
