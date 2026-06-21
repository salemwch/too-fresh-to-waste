import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { DonationsService } from '../donations/donations.service';
import { DEFAULT_CURRENCY } from '@foodwaste/shared';

import { DONATION_CONSTANTS } from '../donations/interfaces/donation.interface';
import { LeaderboardCacheService } from '../leaderboard/leaderboard-cache.service';
import { Order, OrderDocument, OrderStatus } from '../orders/schemas/order.schema';

import {
  CreateLoyaltyAccountDto,
  AddPointsDto,
  LoyaltyStatsDto,
  DonatePointsDto,
  DonatePointsResponseDto,
} from './dto/loyalty-account.dto';
import {
  LoyaltyAccountDocument,
  BadgeType,
  PointTransaction,
  LoyaltyAccount,
} from './schemas/loyalty-account.schema';
import { LeaderboardNotificationService } from './services/leaderboard-notification.service';

interface TotalBagsResult {
  totalBags: number;
}

interface LeaderboardUserInfo {
  firstName?: string;
  lastName?: string;
  profileImage?: string | null;
  avatar?: string | null;
}

interface LeaderboardAggregateDoc {
  userId: Types.ObjectId;
  totalPoints?: number;
  currentTier?: string;
  badges?: Array<{ type: string; name: string }>;
  userInfo?: LeaderboardUserInfo;
  leaderboardConsent?: { given: boolean; showRealName: boolean };
}

// ---------------------------------------------------------------------------
// Leaderboard response shape (returned by getLeaderboard)
// ---------------------------------------------------------------------------
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  firstName: string;
  lastName: string;
  profileImage: string | null;
  currentBadge: string | null;
  currentBadgeType: string | null;
  currentTier: string;
  totalPoints: number;
  isCurrentUser: boolean;
  percentile?: number;
}

/**
 * LoyaltyService
 * Manages user loyalty accounts, points, badges, and tiers
 * Points can be earned through orders and referrals, and donated to community food relief
 */
@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  /**
   * Tier configuration - defines progression levels
   * Note: Tiers provide multipliers for earning points, but no discount benefits
   */
  private readonly tiers = [
    { name: 'Bronze', minPoints: 0, multiplier: 1.0 },
    { name: 'Silver', minPoints: 400, multiplier: 1.2 },
    { name: 'Gold', minPoints: 1200, multiplier: 1.5 },
    { name: 'Platinum', minPoints: 2700, multiplier: 2.0 },
  ];

  /**
   * Points to TND conversion rate
   * 100 points = 1 TND for donation purposes
   */
  private readonly POINTS_TO_TND_RATE = 0.01;

  constructor(
    @InjectModel(LoyaltyAccount.name) private readonly loyaltyModel: Model<LoyaltyAccountDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @Inject(forwardRef(() => DonationsService)) private readonly donationsService: DonationsService,
    private readonly leaderboardCache: LeaderboardCacheService,
    private readonly leaderboardNotification: LeaderboardNotificationService,
  ) {}

  /**
   * Create a new loyalty account for a user
   * Awards welcome bonus and handles referral bonuses
   */
  async createLoyaltyAccount(createDto: CreateLoyaltyAccountDto): Promise<LoyaltyAccountDocument> {
    try {
      const existingAccount = await this.loyaltyModel.findOne({ userId: createDto.userId });
      if (existingAccount) {
        throw new BadRequestException('Loyalty account already exists for this user');
      }

      const loyaltyAccount = new this.loyaltyModel({
        ...createDto,
        userId: new Types.ObjectId(createDto.userId),
        referredBy: createDto.referredBy ? new Types.ObjectId(createDto.referredBy) : undefined,
        badges: [this.createWelcomeBadge()],
      });

      const saved = await loyaltyAccount.save();

      // Handle referral bonus if applicable
      if (createDto.referredBy) {
        await this.handleReferralBonus(createDto.referredBy, createDto.userId);
      }

      // Award welcome bonus
      await this.addPoints(createDto.userId, {
        amount: 100,
        reason: 'Welcome bonus',
      });

      this.logger.log(`Loyalty account created for user: ${createDto.userId}`);
      return saved;
    } catch (error) {
      this.logger.error(
        `Error creating loyalty account: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Retrieve a user's loyalty account
   */
  async getLoyaltyAccount(userId: string): Promise<LoyaltyAccountDocument> {
    const account = await this.loyaltyModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!account) {
      throw new NotFoundException('Loyalty account not found');
    }
    return account;
  }

  /**
   * Retrieve loyalty account with accurate totalBagsSaved.
   * One-time backfill: if totalBagsSaved is 0 but orders exist,
   * computes from orders, persists to DB, then returns.
   * Subsequent calls read the stored value instantly.
   */
  async getLoyaltyAccountWithBagCount(userId: string): Promise<LoyaltyAccountDocument> {
    const account = await this.getLoyaltyAccount(userId);

    if (!account.totalBagsSaved && account.totalOrdersCount > 0) {
      account.totalBagsSaved = await this.backfillTotalBagsSaved(userId);
    }

    return account;
  }

  /**
   * Build loyalty statistics DTO with accurate bag count.
   * Uses persisted totalBagsSaved (backfilled on first access if needed).
   */
  async getLoyaltyStats(userId: string): Promise<LoyaltyStatsDto> {
    const account = await this.getLoyaltyAccount(userId);

    let totalBagsSaved = account.totalBagsSaved;
    if (!totalBagsSaved && account.totalOrdersCount > 0) {
      totalBagsSaved = await this.backfillTotalBagsSaved(userId);
    }

    return {
      totalPoints: account.totalPoints,
      availablePoints: account.availablePoints,
      lifetimePointsEarned: account.lifetimePointsEarned,
      totalOrdersCount: account.totalOrdersCount,
      totalBagsSaved: totalBagsSaved || account.totalOrdersCount,
      totalAmountSpent: account.totalAmountSpent,
      currentTier: account.currentTier,
      badgeCount: account.badges.length,
      referralCount: account.referralCount,
      joinedAt: account.joinedAt.toISOString(),
      lastActivity: account.lastActivity?.toISOString(),
    };
  }

  /**
   * One-time backfill: Aggregate total bags from orders, persist to loyalty account.
   * After this runs once, totalBagsSaved is stored in DB and never recomputed.
   * New orders increment it via addPoints() (line ~139).
   */
  private async backfillTotalBagsSaved(userId: string): Promise<number> {
    const result = await this.orderModel.aggregate<TotalBagsResult>([
      {
        $match: {
          customerId: new Types.ObjectId(userId),
          status: OrderStatus.PICKED_UP,
        },
      },
      { $unwind: '$items' },
      { $group: { _id: null, totalBags: { $sum: '$items.quantity' } } },
    ]);

    const totalBags = result[0]?.totalBags ?? 0;

    if (totalBags > 0) {
      await this.loyaltyModel.updateOne(
        { userId: new Types.ObjectId(userId) },
        { $set: { totalBagsSaved: totalBags } },
      );
      this.logger.log(`Backfilled totalBagsSaved=${totalBags} for user ${userId}`);
    }

    return totalBags;
  }

  /**
   * Add points to a user's account
   * Points are multiplied based on current tier
   * Implements idempotency: If orderId provided, checks for duplicate before adding points
   */
  async addPoints(userId: string, addPointsDto: AddPointsDto): Promise<LoyaltyAccountDocument> {
    try {
      const account = await this.getLoyaltyAccount(userId);

      // IDEMPOTENCY CHECK: Prevent duplicate point awards for same order
      if (addPointsDto.orderId) {
        const orderIdObj = new Types.ObjectId(addPointsDto.orderId);
        const alreadyProcessed = account.pointsHistory.some(
          transaction => transaction.orderId?.toString() === orderIdObj.toString(),
        );

        if (alreadyProcessed) {
          this.logger.warn(
            `Points already awarded for order ${addPointsDto.orderId} to user ${userId}. Skipping duplicate.`,
          );
          return account; // Return existing account without modifications
        }
      }

      const currentTier = this.getCurrentTier(account.totalPoints);
      // Gamification points (login streak, purchase streak, referrals, reviews) bypass the
      // tier multiplier so the advertised flat amounts are always awarded accurately.
      const multipliedPoints =
        addPointsDto.bypassMultiplier === true
          ? addPointsDto.amount
          : Math.floor(addPointsDto.amount * currentTier.multiplier);

      const pointTransaction: PointTransaction = {
        amount: multipliedPoints,
        type: 'earned',
        reason: addPointsDto.reason,
        orderId: addPointsDto.orderId ? new Types.ObjectId(addPointsDto.orderId) : undefined,
        offerId: addPointsDto.offerId ? new Types.ObjectId(addPointsDto.offerId) : undefined,
        createdAt: new Date(),
        expiresAt: addPointsDto.expiresAt
          ? new Date(addPointsDto.expiresAt)
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year default
        ...(addPointsDto.bagCount ? { bagCount: addPointsDto.bagCount } : {}),
      };

      // Only increment order/bag counters for actual order completions (identified by orderId)
      const isOrderCompletion = !!addPointsDto.orderId;
      const bagCount = addPointsDto.bagCount ?? 1;
      const orderIdForLog =
        addPointsDto.orderId !== null &&
        addPointsDto.orderId !== undefined &&
        addPointsDto.orderId.length > 0
          ? addPointsDto.orderId
          : 'N/A';

      const updatedAccount = await this.loyaltyModel.findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        {
          $inc: {
            totalPoints: multipliedPoints,
            availablePoints: multipliedPoints,
            lifetimePointsEarned: multipliedPoints,
            ...(isOrderCompletion ? { totalOrdersCount: 1 } : {}),
            ...(isOrderCompletion ? { totalBagsSaved: bagCount } : {}),
            ...(addPointsDto.orderAmount ? { totalAmountSpent: addPointsDto.orderAmount } : {}),
          },
          $push: { pointsHistory: pointTransaction },
          $set: {
            lastActivity: new Date(),
            currentTier: this.getCurrentTier(account.totalPoints + multipliedPoints).name,
          },
        },
        { new: true },
      );

      if (!updatedAccount) {
        throw new NotFoundException('Loyalty account not found');
      }

      await this.checkAndAwardBadges(updatedAccount);

      if (updatedAccount.leaderboardConsent?.given) {
        const previousRankData = await this.leaderboardCache.getLoyaltyRankData(userId);
        await this.leaderboardCache.setLoyaltyScore(userId, updatedAccount.totalPoints);

        void this.leaderboardNotification
          .checkRankChangeNotifications(
            userId,
            updatedAccount.totalPoints,
            previousRankData?.rank ?? null,
          )
          .catch(() => {});
      }

      this.logger.log(
        `Added ${multipliedPoints} points to user: ${userId} for order: ${orderIdForLog}`,
      );
      return updatedAccount;
    } catch (error) {
      this.logger.error(
        `Error adding points: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Donate points to the community food relief pool
   * Converts points to TND and adds to donation pool
   */
  async donatePoints(userId: string, donateDto: DonatePointsDto): Promise<DonatePointsResponseDto> {
    try {
      const account = await this.getLoyaltyAccount(userId);

      if (account.availablePoints < donateDto.amount) {
        throw new BadRequestException(
          `Insufficient points. You have ${account.availablePoints} points available.`,
        );
      }

      // Convert points to TND
      const donationAmount = donateDto.amount * this.POINTS_TO_TND_RATE;
      const estimatedMeals = Math.floor(donationAmount / DONATION_CONSTANTS.MEAL_COST_ESTIMATE_TND);

      // Create donation transaction in points history
      const pointTransaction: PointTransaction = {
        amount: -donateDto.amount,
        type: 'donated',
        reason:
          donateDto.message !== null &&
          donateDto.message !== undefined &&
          donateDto.message.trim().length > 0
            ? donateDto.message
            : 'Donated to community food relief',
        createdAt: new Date(),
      };

      // Atomic deduction: filter ensures availablePoints >= amount at write time,
      // preventing double-spend via concurrent requests.
      const updatedAccount = await this.loyaltyModel.findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          availablePoints: { $gte: donateDto.amount },
        },
        {
          $inc: { availablePoints: -donateDto.amount },
          $push: { pointsHistory: pointTransaction },
          $set: { lastActivity: new Date() },
        },
        { new: true },
      );

      if (!updatedAccount) {
        throw new BadRequestException('Insufficient points or loyalty account not found');
      }

      // Add to donation pool
      const pool = await this.donationsService.getActivePool();
      await this.donationsService['donationPoolModel'].findByIdAndUpdate(pool._id, {
        $inc: {
          currentAmount: donationAmount,
          mealCount: estimatedMeals,
        },
      });

      this.logger.log(
        `User ${userId} donated ${donateDto.amount} points (${donationAmount} TND) to donation pool`,
      );

      return {
        success: true,
        pointsDonated: donateDto.amount,
        donationAmount: parseFloat(donationAmount.toFixed(2)),
        currency: DEFAULT_CURRENCY,
        estimatedMeals,
        remainingPoints: updatedAccount.availablePoints,
        message: `Thank you! Your ${donateDto.amount} points have been converted to ${donationAmount.toFixed(2)} TND and donated to help feed those in need.`,
      };
    } catch (error) {
      this.logger.error(
        `Error donating points: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Get the user's points donation history
   */
  async getDonationHistory(userId: string): Promise<PointTransaction[]> {
    const account = await this.getLoyaltyAccount(userId);
    return account.pointsHistory.filter(tx => tx.type === 'donated');
  }

  /**
   * Calculate current tier based on total points
   */
  private getCurrentTier(totalPoints: number): (typeof this.tiers)[number] {
    const defaultTier = this.tiers[0];
    if (!defaultTier) {
      throw new BadRequestException('No loyalty tiers configured');
    }

    return (
      this.tiers
        .filter(tier => totalPoints >= tier.minPoints)
        .sort((a, b) => b.minPoints - a.minPoints)[0] ?? defaultTier
    );
  }

  /**
   * Create welcome badge for new users
   */
  private createWelcomeBadge() {
    return {
      type: BadgeType.NEWCOMER,
      earnedAt: new Date(),
      name: 'Welcome to Too Fresh To Waste',
      description: 'Joined the fight against food waste',
      iconUrl: '/badges/newcomer.png',
    };
  }

  /**
   * Handle referral bonus when a new user signs up with a referral
   */
  private async handleReferralBonus(referrerId: string, _newUserId: string): Promise<void> {
    await Promise.all([
      this.addPoints(referrerId, {
        amount: 200,
        reason: 'Referral bonus',
      }),
      this.loyaltyModel.findOneAndUpdate(
        { userId: new Types.ObjectId(referrerId) },
        { $inc: { referralCount: 1 } },
      ),
    ]);
  }

  /**
   * Check and award badges based on user activity
   */
  private async checkAndAwardBadges(account: LoyaltyAccountDocument): Promise<void> {
    const badges = [];

    if (
      account.totalOrdersCount >= 10 &&
      !account.badges.some(b => b.type === BadgeType.FREQUENT_SAVER)
    ) {
      badges.push({
        type: BadgeType.FREQUENT_SAVER,
        earnedAt: new Date(),
        name: 'Frequent Saver',
        description: 'Completed 10 orders',
        iconUrl: '/badges/frequent-saver.png',
      });
    }

    if (
      account.totalAmountSpent >= 1000 &&
      !account.badges.some(b => b.type === BadgeType.ECO_WARRIOR)
    ) {
      badges.push({
        type: BadgeType.ECO_WARRIOR,
        earnedAt: new Date(),
        name: 'Eco Warrior',
        description: 'Saved 1000 TND worth of food',
        iconUrl: '/badges/eco-warrior.png',
      });
    }

    if (badges.length > 0) {
      await this.loyaltyModel.findByIdAndUpdate(account._id, {
        $push: { badges: { $each: badges } },
      });
    }
  }

  // ===========================================================================
  // LEADERBOARD
  // ===========================================================================

  /**
   * Get top-N loyalty accounts with user info for the leaderboard.
   * Uses a $lookup aggregation against the 'users' collection — no circular
   * dependency since we never inject the UserModel here.
   * Also returns the calling user's entry when they fall outside the top N.
   */
  async getLeaderboard(
    currentUserId: string,
    limit = 50,
    offset = 0,
  ): Promise<{
    entries: LeaderboardEntry[];
    currentUserEntry: LeaderboardEntry | null;
    total: number;
    hasMore: boolean;
    hasSetConsent: boolean;
  }> {
    const MAX_BROWSABLE = 200;
    const currentUserObjectId = new Types.ObjectId(currentUserId);

    const callerAccount = await this.loyaltyModel
      .findOne({ userId: currentUserObjectId }, { 'leaderboardConsent.given': 1, totalPoints: 1 })
      .lean();
    const hasSetConsent = callerAccount?.leaderboardConsent?.given ?? false;

    // ── Try Redis-backed read path first ─────────────────────────────────────
    const cached = await this.leaderboardCache.getTopLoyalty(limit, offset);
    if (cached && cached.length > 0) {
      const cachedTotal = await this.leaderboardCache.getLoyaltyTotal();
      const entries = await this.hydrateLoyaltyEntries(cached, offset, currentUserObjectId);
      const total = cachedTotal ?? cached.length;
      const hasMore = offset + entries.length < Math.min(total, MAX_BROWSABLE);

      let currentUserEntry: LeaderboardEntry | null = null;
      const isCurrentUserInTop = entries.some(e => e.isCurrentUser);
      if (!isCurrentUserInTop && hasSetConsent) {
        currentUserEntry = await this.resolveCurrentUserEntry(
          currentUserId,
          currentUserObjectId,
          total,
        );
      }

      return { entries, currentUserEntry, total, hasMore, hasSetConsent };
    }

    // ── Fallback: MongoDB aggregation ────────────────────────────────────────
    this.logger.warn('Loyalty leaderboard cache miss — falling back to aggregation');
    return this.getLeaderboardFromDb(
      currentUserId,
      currentUserObjectId,
      hasSetConsent,
      limit,
      offset,
    );
  }

  private async hydrateLoyaltyEntries(
    scores: { userId: string; totalPoints: number }[],
    offset: number,
    currentUserObjectId: Types.ObjectId,
  ): Promise<LeaderboardEntry[]> {
    const ids = scores.map(s => new Types.ObjectId(s.userId));

    const [accounts, users] = await Promise.all([
      this.loyaltyModel
        .find(
          { userId: { $in: ids } },
          { userId: 1, currentTier: 1, badges: 1, leaderboardConsent: 1 },
        )
        .lean()
        .exec(),
      this.loyaltyModel.aggregate<LeaderboardAggregateDoc>([
        { $match: { userId: { $in: ids } } },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            pipeline: [{ $project: { firstName: 1, lastName: 1, profileImage: 1, avatar: 1 } }],
            as: 'userInfo',
          },
        },
        { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
      ]),
    ]);

    const accountMap = new Map(accounts.map(a => [a.userId.toString(), a]));
    const userInfoMap = new Map(users.map(u => [u.userId.toString(), u]));

    return scores.map((s, i) => {
      const account = accountMap.get(s.userId);
      const aggDoc = userInfoMap.get(s.userId);

      const doc: LeaderboardAggregateDoc = {
        userId: new Types.ObjectId(s.userId),
        ...(s.totalPoints !== undefined ? { totalPoints: s.totalPoints } : {}),
        ...(account?.currentTier ? { currentTier: account.currentTier } : {}),
        ...(account?.badges
          ? { badges: account.badges.map(b => ({ type: b.type, name: b.name })) }
          : {}),
        ...(aggDoc?.userInfo ? { userInfo: aggDoc.userInfo } : {}),
        ...(account?.leaderboardConsent
          ? {
              leaderboardConsent: account.leaderboardConsent as {
                given: boolean;
                showRealName: boolean;
              },
            }
          : {}),
      };

      return this.mapToLeaderboardEntry(doc, offset + i + 1, currentUserObjectId);
    });
  }

  private async resolveCurrentUserEntry(
    userId: string,
    currentUserObjectId: Types.ObjectId,
    total?: number,
  ): Promise<LeaderboardEntry | null> {
    const cachedRank = await this.leaderboardCache.getLoyaltyRankData(userId);
    if (cachedRank) {
      const entries = await this.hydrateLoyaltyEntries(
        [{ userId, totalPoints: cachedRank.totalPoints }],
        0,
        currentUserObjectId,
      );
      if (entries[0]) {
        entries[0].rank = cachedRank.rank;
        const resolvedTotal = total ?? (await this.leaderboardCache.getLoyaltyTotal()) ?? 1;
        entries[0].percentile = this.computePercentile(cachedRank.rank, resolvedTotal);
        return entries[0];
      }
    }

    const userProjection = { firstName: 1, lastName: 1, profileImage: 1, avatar: 1 };
    const consentFilter = { isActive: true, 'leaderboardConsent.given': true };

    const ownRaw = await this.loyaltyModel.aggregate<LeaderboardAggregateDoc>([
      { $match: { userId: currentUserObjectId } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          pipeline: [{ $project: userProjection }],
          as: 'userInfo',
        },
      },
      { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
    ]);

    const ownEntry = ownRaw[0];
    if (!ownEntry) {
      return null;
    }

    const aboveCount = await this.loyaltyModel.countDocuments({
      ...consentFilter,
      totalPoints: { $gt: ownEntry.totalPoints },
    });
    const rank = aboveCount + 1;
    const resolvedTotal = total ?? (await this.loyaltyModel.countDocuments(consentFilter));
    const entry = this.mapToLeaderboardEntry(ownEntry, rank, currentUserObjectId);
    entry.percentile = this.computePercentile(rank, resolvedTotal);
    return entry;
  }

  private async getLeaderboardFromDb(
    currentUserId: string,
    currentUserObjectId: Types.ObjectId,
    hasSetConsent: boolean,
    limit: number,
    offset: number,
  ): Promise<{
    entries: LeaderboardEntry[];
    currentUserEntry: LeaderboardEntry | null;
    total: number;
    hasMore: boolean;
    hasSetConsent: boolean;
  }> {
    const MAX_BROWSABLE = 200;
    const userProjection = { firstName: 1, lastName: 1, profileImage: 1, avatar: 1 };
    const consentFilter = { isActive: true, 'leaderboardConsent.given': true };

    const [raw, total] = await Promise.all([
      this.loyaltyModel.aggregate<LeaderboardAggregateDoc>([
        { $match: consentFilter },
        { $sort: { totalPoints: -1, _id: 1 } },
        { $skip: offset },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            pipeline: [{ $project: userProjection }],
            as: 'userInfo',
          },
        },
        { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
      ]),
      this.loyaltyModel.countDocuments(consentFilter),
    ]);

    const entries: LeaderboardEntry[] = raw.map((doc, index) =>
      this.mapToLeaderboardEntry(doc, offset + index + 1, currentUserObjectId),
    );

    const hasMore = offset + entries.length < Math.min(total, MAX_BROWSABLE);

    const isCurrentUserInTop = entries.some(e => e.isCurrentUser);
    let currentUserEntry: LeaderboardEntry | null = null;

    if (!isCurrentUserInTop && hasSetConsent) {
      currentUserEntry = await this.resolveCurrentUserEntry(
        currentUserId,
        currentUserObjectId,
        total,
      );
    }

    return { entries, currentUserEntry, total, hasMore, hasSetConsent };
  }

  /**
   * Save or update the user's leaderboard display preference.
   * Sets leaderboardConsent.given = true so the user appears in the leaderboard.
   */
  async updateLeaderboardConsent(userId: string, showRealName: boolean): Promise<void> {
    const updated = await this.loyaltyModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        $set: {
          'leaderboardConsent.given': true,
          'leaderboardConsent.showRealName': showRealName,
          'leaderboardConsent.setAt': new Date(),
        },
      },
      { new: true },
    );

    if (updated) {
      await this.leaderboardCache.setLoyaltyScore(userId, updated.totalPoints);
    }
  }

  /** Maps a raw aggregation document to a typed LeaderboardEntry */
  private mapToLeaderboardEntry(
    doc: LeaderboardAggregateDoc,
    rank: number,
    currentUserObjectId: Types.ObjectId,
  ): LeaderboardEntry {
    const user = doc.userInfo ?? {};
    const badges = doc.badges ?? [];
    const mostRecentBadge = badges.length > 0 ? badges[badges.length - 1] : null;
    const showReal = doc.leaderboardConsent?.showRealName ?? true;

    return {
      rank,
      userId: doc.userId.toString(),
      firstName: showReal ? (user.firstName ?? 'Unknown') : 'Anonymous',
      lastName: showReal ? (user.lastName ?? '') : '',
      profileImage: showReal ? (user.profileImage ?? user.avatar ?? null) : null,
      currentBadge: mostRecentBadge?.name ?? null,
      currentBadgeType: mostRecentBadge?.type ?? null,
      currentTier: doc.currentTier ?? 'Bronze',
      totalPoints: doc.totalPoints ?? 0,
      isCurrentUser: doc.userId.equals(currentUserObjectId),
    };
  }

  private computePercentile(rank: number, total: number): number {
    if (total <= 1) {
      return 100;
    }
    return Math.round(((total - rank) / total) * 100);
  }

  // ===========================================================================
  // NEIGHBORHOOD
  // ===========================================================================

  async getNeighborhood(
    currentUserId: string,
    radius = 5,
  ): Promise<{
    entries: (LeaderboardEntry & { isAnchor: boolean })[];
    anchorRank: number;
    total: number;
  }> {
    const currentUserObjectId = new Types.ObjectId(currentUserId);

    const cached = await this.leaderboardCache.getLoyaltyNeighborhood(currentUserId, radius);
    if (!cached) {
      throw new NotFoundException('User not found on leaderboard');
    }

    const startRank = Math.max(1, cached.rank - radius);
    const hydrated = await this.hydrateLoyaltyEntries(
      cached.entries,
      startRank - 1,
      currentUserObjectId,
    );

    const entries = hydrated.map(entry => ({
      ...entry,
      isAnchor: entry.userId === currentUserId,
    }));

    return { entries, anchorRank: cached.rank, total: cached.total };
  }

  // ===========================================================================
  // CHAMPION (#1)
  // ===========================================================================

  async getChampion(): Promise<{
    userId: string;
    firstName: string;
    lastName: string;
    profileImage: string | null;
    totalPoints: number;
    currentTier: string;
    currentBadge: string | null;
  } | null> {
    const cachedJson = await this.leaderboardCache.getCachedChampion();
    if (cachedJson) {
      return JSON.parse(cachedJson);
    }

    const top = await this.leaderboardCache.getTopLoyalty(1, 0);
    if (!top || top.length === 0) {
      return null;
    }

    const dummyObjectId = new Types.ObjectId();
    const hydrated = await this.hydrateLoyaltyEntries(top, 0, dummyObjectId);
    const champion = hydrated[0];
    if (!champion) {
      return null;
    }

    const result = {
      userId: champion.userId,
      firstName: champion.firstName,
      lastName: champion.lastName,
      profileImage: champion.profileImage,
      totalPoints: champion.totalPoints,
      currentTier: champion.currentTier,
      currentBadge: champion.currentBadge,
    };

    await this.leaderboardCache.setCachedChampion(JSON.stringify(result));
    return result;
  }
}
