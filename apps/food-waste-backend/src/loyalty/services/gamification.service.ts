import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CronLockName, CronLockTtl } from '../../common/constants/cron-lock.constant';
import { LOYALTY_REVIEWED_ORDER_IDS_MAX } from '../../common/constants/document-limits.constant';
import { CronLockService } from '../../common/services/cron-lock.service';
import { Model, Types } from 'mongoose';

import { LoyaltyService } from '../loyalty.service';
import {
  LoyaltyAccount,
  LoyaltyAccountDocument,
  FriendReferralStatus,
  BusinessReferralStatus,
} from '../schemas/loyalty-account.schema';
import { ReferredIdentity, ReferredIdentityDocument } from '../schemas/referred-identity.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';

import { appError } from '../../common/errors';
/**
 * Gamification Constants
 */
export const GAMIFICATION_CONSTANTS = {
  // Friend Referral: Friend buys 2 bags in first month → 50 points
  FRIEND_REFERRAL_BAGS_REQUIRED: 2,
  FRIEND_REFERRAL_POINTS: 50,
  FRIEND_REFERRAL_EXPIRY_DAYS: 30,

  // Business Referral: Business sells 14 bags in first month from first sale → 50 points
  BUSINESS_REFERRAL_ORDERS_REQUIRED: 14,
  BUSINESS_REFERRAL_POINTS: 50,
  BUSINESS_REFERRAL_EXPIRY_DAYS: 30,

  // Login Streak: 10 days consecutive login → 2 points/day (max 20/month)
  LOGIN_STREAK_DAYS_REQUIRED: 10,
  LOGIN_STREAK_POINTS_PER_DAY: 2,
  LOGIN_STREAK_MAX_POINTS_PER_MONTH: 20,

  // Purchase Streak: 15 bags in 15 days → 10 points (monthly)
  PURCHASE_STREAK_BAGS_REQUIRED: 15,
  PURCHASE_STREAK_DAYS: 15,
  PURCHASE_STREAK_POINTS: 10,

  // Review Points: 1 review per order (6+ words) → 10 points
  REVIEW_MIN_WORDS: 6,
  REVIEW_POINTS: 10,
} as const;

/**
 * GamificationService
 * Handles all gamification features for loyalty program
 */
@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    @InjectModel(LoyaltyAccount.name) private readonly loyaltyModel: Model<LoyaltyAccountDocument>,
    @InjectModel(ReferredIdentity.name)
    private readonly referredIdentityModel: Model<ReferredIdentityDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly loyaltyService: LoyaltyService,
    private readonly cronLock: CronLockService,
  ) {}

  // =============================================================================
  // LOYALTY ACCOUNT CREATION (AUTO-CREATE ON REGISTRATION)
  // =============================================================================

  /**
   * Create loyalty account for new user (auto-created on registration)
   *
   * BEST PRACTICES:
   * - ✅ Idempotent: Safe to call multiple times (checks if exists first)
   * - ✅ Fast: Minimal data, no welcome bonus (MVP requirement)
   * - ✅ Error handling: Gracefully handles duplicates
   * - ✅ Logging: Clear audit trail
   *
   * PERFORMANCE: ~50ms (single DB write)
   *
   * @param userId - User ID from registration event
   * @returns Created or existing loyalty account
   */
  async createLoyaltyAccountForNewUser(userId: string): Promise<LoyaltyAccountDocument> {
    try {
      const userIdObj = new Types.ObjectId(userId);

      // IDEMPOTENCY CHECK: Return existing account if already created
      const existingAccount = await this.loyaltyModel.findOne({ userId: userIdObj });
      if (existingAccount) {
        this.logger.log(`Loyalty account already exists for user: ${userId}`);
        return existingAccount;
      }

      // Create minimal loyalty account (MVP: just points tracking)
      const newAccount = await this.loyaltyModel.create({
        userId: userIdObj,
        totalPoints: 0,
        availablePoints: 0,
        lifetimePointsEarned: 0,
        totalOrdersCount: 0,
        totalAmountSpent: 0,
        currentTier: 'Bronze',
        badges: [],
        pointsHistory: [],
        joinedAt: new Date(),
        isActive: true,
      });

      this.logger.log(`✅ Loyalty account created for user: ${userId}`);
      return newAccount;
    } catch (error) {
      // Handle duplicate key error gracefully (race condition)
      const errorCode =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: number }).code
          : undefined;

      if (errorCode === 11000) {
        this.logger.warn(
          `Duplicate loyalty account creation attempt for user: ${userId} (race condition handled)`,
        );
        const existingAccount = await this.loyaltyModel.findOne({
          userId: new Types.ObjectId(userId),
        });
        if (existingAccount) {
          return existingAccount;
        }
      }

      this.logger.error(
        `Failed to create loyalty account for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  // =============================================================================
  // REFERRAL CODE GENERATION
  // =============================================================================

  /**
   * Derive a 6-char base36 suffix from a MongoDB ObjectId.
   * Deterministic and unique at app scale — no retry loop needed.
   */
  private deriveBase36Suffix(objectId: Types.ObjectId): string {
    return BigInt(`0x${objectId.toString()}`).toString(36).slice(-6);
  }

  /**
   * Normalize a firstName into a safe lowercase alphabetic prefix.
   */
  private deriveNamePrefix(firstName: string | undefined): string {
    if (!firstName) {
      return 'user';
    }
    const normalized = firstName
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, '')
      .slice(0, 10);
    return normalized.length > 0 ? normalized : 'user';
  }

  /**
   * Generate a unique referral code for a user.
   * Format: {firstName}-{6-char base36 of LoyaltyAccount ObjectId}
   * Example: salem-k3m9p1
   */
  async generateReferralCode(userId: string): Promise<string> {
    const account = await this.loyaltyModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!account) {
      throw new NotFoundException(appError('LOYALTY_ACCOUNT_NOT_FOUND'));
    }

    const user = await this.userModel.findById(userId).select('firstName').lean();
    const prefix = this.deriveNamePrefix(user?.firstName);
    const suffix = this.deriveBase36Suffix(account._id as Types.ObjectId);
    const code = `${prefix}-${suffix}`;

    await this.loyaltyModel.findByIdAndUpdate(account._id, { referralCode: code });
    this.logger.log(`Generated referral code ${code} for user ${userId}`);
    return code;
  }

  /**
   * Get user's referral code, generating it if absent or in the old format.
   * Old format (no hyphen) is auto-migrated to the new personalized format.
   */
  async getReferralCode(userId: string): Promise<string> {
    const account = await this.loyaltyModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!account) {
      throw new NotFoundException(appError('LOYALTY_ACCOUNT_NOT_FOUND'));
    }

    // Auto-migrate old-format codes (e.g. USERPEEF, JOHN1234) that lack a hyphen
    if (account.referralCode?.includes('-')) {
      return account.referralCode;
    }

    return this.generateReferralCode(userId);
  }

  /**
   * Find referrer by referral code (case-insensitive for forward/backward compatibility).
   */
  async findReferrerByCode(code: string): Promise<LoyaltyAccountDocument | null> {
    const safeCode = code.replace(/[^a-zA-Z0-9-]/g, '');
    const result = await this.loyaltyModel.findOne({
      referralCode: { $regex: new RegExp(`^${safeCode}$`, 'i') },
    });
    return result;
  }

  /**
   * Anti-fraud: Check if a referred identity (email/phone) was already used in a referral.
   * Records the identity if new; returns false if duplicate.
   */
  async checkAndRecordReferredIdentity(
    email: string,
    phone: string | undefined,
    referredUserId: string,
    referrerUserId: string,
    referredAs: 'consumer' | 'merchant',
  ): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await this.referredIdentityModel.findOne({
      $or: [{ email: normalizedEmail }, ...(phone ? [{ phone }] : [])],
    });

    if (existing) {
      if (existing.referrerUserId.toString() === referrerUserId) {
        this.logger.log(
          `Anti-fraud: Allowing retry for email=${normalizedEmail} — same referrer ${referrerUserId}`,
        );
        return true;
      }
      this.logger.warn(
        `Anti-fraud: Blocked duplicate referral for email=${normalizedEmail} phone=${phone ?? 'none'} ` +
          `(previously referred by different user=${existing.referrerUserId})`,
      );
      return false;
    }

    try {
      await this.referredIdentityModel.create({
        email: normalizedEmail,
        ...(phone ? { phone } : {}),
        referredUserId: new Types.ObjectId(referredUserId),
        referrerUserId: new Types.ObjectId(referrerUserId),
        referredAs,
      });
      return true;
    } catch (error) {
      const errorCode =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: number }).code
          : undefined;
      if (errorCode === 11000) {
        this.logger.warn(`Anti-fraud: Race condition caught for email=${normalizedEmail}`);
        return false;
      }
      throw error;
    }
  }

  // =============================================================================
  // FRIEND REFERRAL SYSTEM
  // =============================================================================

  /**
   * Register a new friend referral when friend signs up with referral code
   */
  async registerFriendReferral(referrerUserId: string, friendUserId: string): Promise<void> {
    const referrerObjectId = new Types.ObjectId(referrerUserId);
    const friendObjectId = new Types.ObjectId(friendUserId);

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + GAMIFICATION_CONSTANTS.FRIEND_REFERRAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    // Atomic idempotency, matching the pattern in LoyaltyService.addPoints: the
    // filter rejects the push when this friend is already present, so two
    // concurrent registrations race on a single findOneAndUpdate and only one
    // can win. Reading the array and then pushing let both callers through,
    // which duplicated the referral and double-incremented referralCount —
    // and updateFriendBagCount only ever locates the first copy, so the
    // duplicate stayed invisible until someone read the counter.
    const updated = await this.loyaltyModel.findOneAndUpdate(
      {
        userId: referrerObjectId,
        'friendReferrals.friendUserId': { $ne: friendObjectId },
      },
      {
        $push: {
          friendReferrals: {
            friendUserId: friendObjectId,
            referredAt: now,
            expiresAt,
            friendBagCount: 0,
            status: FriendReferralStatus.PENDING,
            pointsAwarded: 0,
          },
        },
        $inc: { referralCount: 1 },
      },
      { new: true },
    );

    if (!updated) {
      // No match means either the account does not exist or the friend was
      // already referred. Distinguish them so a missing account still raises.
      const accountExists = await this.loyaltyModel.exists({ userId: referrerObjectId });
      if (!accountExists) {
        throw new NotFoundException(appError('REFERRER_NOT_FOUND'));
      }
      this.logger.warn(`Friend ${friendUserId} already referred by ${referrerUserId}`);
      return;
    }

    this.logger.log(`Registered friend referral: ${friendUserId} referred by ${referrerUserId}`);
  }

  /**
   * Update friend's bag count when they complete an order pickup
   * Called from OrderService when pickup is confirmed
   */
  async updateFriendBagCount(friendUserId: string, bagsCount: number): Promise<void> {
    const friendObjectId = new Types.ObjectId(friendUserId);

    // Find all referrers who have this friend in a *pending* referral. $elemMatch
    // is required: the two dotted paths above matched a document where any entry
    // had the friend and any entry was pending, which are not necessarily the
    // same entry.
    const referrers = await this.loyaltyModel.find({
      friendReferrals: {
        $elemMatch: { friendUserId: friendObjectId, status: FriendReferralStatus.PENDING },
      },
    });

    const pendingMatch = {
      $elemMatch: { friendUserId: friendObjectId, status: FriendReferralStatus.PENDING },
    };

    for (const referrer of referrers) {
      // Add the bags atomically and read back the post-image. The previous form
      // computed `referral.friendBagCount + bagsCount` from a document read
      // outside any guard and then wrote the sum back with `.save()`, so two
      // pickups confirmed together both derived the same total from the same
      // stale value and one of the two increments was lost.
      const incremented = await this.loyaltyModel.findOneAndUpdate(
        { _id: referrer._id, friendReferrals: pendingMatch },
        { $inc: { 'friendReferrals.$.friendBagCount': bagsCount } },
        { new: true },
      );

      if (!incremented) {
        continue;
      }

      const referral = incremented.friendReferrals.find(
        r =>
          r.friendUserId.toString() === friendUserId && r.status === FriendReferralStatus.PENDING,
      );

      if (
        !referral ||
        referral.friendBagCount < GAMIFICATION_CONSTANTS.FRIEND_REFERRAL_BAGS_REQUIRED
      ) {
        continue;
      }

      // Claim the completion before awarding. Only one caller can flip
      // PENDING -> COMPLETED, and only the winner pays out.
      //
      // This transition is the *sole* protection against paying the referral
      // bonus twice: addPoints is only idempotent when given an `orderId`, and
      // a referral award has none, so its `pointsHistory.orderId` filter does
      // not apply here.
      //
      // Claiming first means a failed addPoints under-awards rather than
      // double-awards. That is the correct way round — an unpaid bonus is
      // visible (status COMPLETED with no matching points transaction) and an
      // admin can grant it, whereas a double payout is silent.
      const claimed = await this.loyaltyModel.findOneAndUpdate(
        { _id: referrer._id, friendReferrals: pendingMatch },
        {
          $set: {
            'friendReferrals.$.status': FriendReferralStatus.COMPLETED,
            'friendReferrals.$.completedAt': new Date(),
            'friendReferrals.$.pointsAwarded': GAMIFICATION_CONSTANTS.FRIEND_REFERRAL_POINTS,
          },
          $inc: { friendReferralsCompleted: 1 },
        },
        { new: true },
      );

      if (!claimed) {
        continue;
      }

      await this.loyaltyService.addPoints(referrer.userId.toString(), {
        amount: GAMIFICATION_CONSTANTS.FRIEND_REFERRAL_POINTS,
        reason: `Friend referral completed: Friend bought ${referral.friendBagCount} bags`,
        bypassMultiplier: true,
      });

      this.logger.log(
        `Friend referral completed! Awarded ${GAMIFICATION_CONSTANTS.FRIEND_REFERRAL_POINTS} points to ${referrer.userId}`,
      );
    }
  }

  // =============================================================================
  // BUSINESS REFERRAL SYSTEM
  // =============================================================================

  /**
   * Register a new business referral when business signs up with referral code
   */
  async registerBusinessReferral(
    referrerUserId: string,
    businessUserId: string,
    establishmentId?: string,
  ): Promise<void> {
    const referrerAccount = await this.loyaltyModel.findOne({
      userId: new Types.ObjectId(referrerUserId),
    });

    if (!referrerAccount) {
      throw new NotFoundException(appError('REFERRER_NOT_FOUND'));
    }

    // Check if this business is already referred
    const existingReferral = referrerAccount.businessReferrals?.find(
      r => r.businessUserId.toString() === businessUserId,
    );

    if (existingReferral) {
      this.logger.warn(`Business ${businessUserId} already referred by ${referrerUserId}`);
      return;
    }

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + GAMIFICATION_CONSTANTS.BUSINESS_REFERRAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.loyaltyModel.findByIdAndUpdate(referrerAccount._id, {
      $push: {
        businessReferrals: {
          businessUserId: new Types.ObjectId(businessUserId),
          establishmentId: establishmentId ? new Types.ObjectId(establishmentId) : undefined,
          referredAt: now,
          expiresAt,
          businessOrderCount: 0,
          status: BusinessReferralStatus.PENDING,
          pointsAwarded: 0,
        },
      },
      $inc: { referralCount: 1 },
    });

    this.logger.log(
      `Registered business referral: ${businessUserId} referred by ${referrerUserId}`,
    );
  }

  /**
   * Update business's order count when they complete an order.
   * Called from OrderService when pickup is confirmed (for merchant).
   *
   * First-sale timing: The 30-day expiry window starts from the business's
   * first bag sold (firstSaleAt), not from the registration date.
   */
  async updateBusinessOrderCount(businessUserId: string, bagsCount = 1): Promise<void> {
    const referrers = await this.loyaltyModel.find({
      'businessReferrals.businessUserId': new Types.ObjectId(businessUserId),
      'businessReferrals.status': BusinessReferralStatus.PENDING,
    });

    for (const referrer of referrers) {
      const referralIndex = referrer.businessReferrals.findIndex(
        r =>
          r.businessUserId.toString() === businessUserId &&
          r.status === BusinessReferralStatus.PENDING,
      );

      if (referralIndex === -1) {
        continue;
      }

      const referral = referrer.businessReferrals[referralIndex];
      if (!referral) {
        continue;
      }

      const now = new Date();
      const newOrderCount = referral.businessOrderCount + bagsCount;

      const isFirstSale = !referral.firstSaleAt;
      const firstSaleAt = referral.firstSaleAt ?? now;
      const expiresAt = isFirstSale
        ? new Date(
            now.getTime() +
              GAMIFICATION_CONSTANTS.BUSINESS_REFERRAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
          )
        : referral.expiresAt;

      if (newOrderCount >= GAMIFICATION_CONSTANTS.BUSINESS_REFERRAL_ORDERS_REQUIRED) {
        await this.loyaltyService.addPoints(referrer.userId.toString(), {
          amount: GAMIFICATION_CONSTANTS.BUSINESS_REFERRAL_POINTS,
          reason: `Business referral completed: Business sold ${newOrderCount} bags`,
          bypassMultiplier: true,
        });

        referral.businessOrderCount = newOrderCount;
        referral.status = BusinessReferralStatus.COMPLETED;
        referral.completedAt = now;
        referral.pointsAwarded = GAMIFICATION_CONSTANTS.BUSINESS_REFERRAL_POINTS;
        if (isFirstSale) {
          referral.firstSaleAt = firstSaleAt;
          referral.expiresAt = expiresAt;
        }
        referrer.businessReferralsCompleted = (referrer.businessReferralsCompleted || 0) + 1;

        await referrer.save();

        this.logger.log(
          `Business referral completed! Awarded ${GAMIFICATION_CONSTANTS.BUSINESS_REFERRAL_POINTS} points to ${referrer.userId}`,
        );
      } else {
        const updateFields: Record<string, unknown> = {
          'businessReferrals.$.businessOrderCount': newOrderCount,
        };
        if (isFirstSale) {
          updateFields['businessReferrals.$.firstSaleAt'] = firstSaleAt;
          updateFields['businessReferrals.$.expiresAt'] = expiresAt;
        }

        await this.loyaltyModel.updateOne(
          {
            _id: referrer._id,
            'businessReferrals.businessUserId': new Types.ObjectId(businessUserId),
          },
          { $set: updateFields },
        );
      }
    }
  }

  // =============================================================================
  // DAILY LOGIN STREAK
  // =============================================================================

  /**
   * Record daily login and award streak points.
   *
   * COOLDOWN-BASED IDEMPOTENCY: Uses a strict 24-hour cooldown from the
   * last login timestamp instead of UTC midnight boundaries. This prevents
   * users from earning two streak rewards within a single 24-hour window
   * (e.g. logging in at 23:59 UTC and 00:01 UTC the next day).
   *
   * Streak logic:
   *  - < 24h since last login  → duplicate, no points
   *  - 24h..48h since last     → consecutive day, streak continues
   *  - > 48h since last        → missed a day, streak resets to 1
   *
   * Flow:
   *  1. Read current account state
   *  2. Compute 24h cooldown and streak values in memory
   *  3. Atomically update loginStreak with a filter that rejects writes
   *     when lastLoginDate is within the past 24 hours
   *  4. Only AFTER the atomic write succeeds, award points via addPoints()
   */
  async recordDailyLogin(userId: string): Promise<{ streakDays: number; pointsAwarded: number }> {
    const userIdObj = new Types.ObjectId(userId);
    const account = await this.loyaltyModel.findOne({ userId: userIdObj });
    if (!account) {
      throw new NotFoundException(appError('LOYALTY_ACCOUNT_NOT_FOUND'));
    }

    const now = new Date();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
    const twentyFourHoursAgo = new Date(now.getTime() - TWENTY_FOUR_HOURS_MS);
    const monthStartUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    // Extract current streak as a plain object (avoid Mongoose subdocument serialization issues)
    const loginStreak = account.loginStreak;
    const streak =
      loginStreak !== null && loginStreak !== undefined
        ? {
            currentStreak: loginStreak.currentStreak || 0,
            lastLoginDate: loginStreak.lastLoginDate ? new Date(loginStreak.lastLoginDate) : null,
            pointsEarnedThisMonth: loginStreak.pointsEarnedThisMonth || 0,
            monthlyResetDate: loginStreak.monthlyResetDate
              ? new Date(loginStreak.monthlyResetDate)
              : null,
            longestStreak: loginStreak.longestStreak || 0,
          }
        : {
            currentStreak: 0,
            lastLoginDate: null as Date | null,
            pointsEarnedThisMonth: 0,
            monthlyResetDate: null as Date | null,
            longestStreak: 0,
          };

    // --- Quick guard: if last login was within 24 hours, reject immediately ---
    if (streak.lastLoginDate && streak.lastLoginDate >= twentyFourHoursAgo) {
      return { streakDays: streak.currentStreak, pointsAwarded: 0 };
    }

    // --- Monthly reset ---
    let pointsThisMonth = streak.pointsEarnedThisMonth;
    let resetDate = streak.monthlyResetDate;
    if (!resetDate || resetDate < monthStartUTC) {
      pointsThisMonth = 0;
      resetDate = monthStartUTC;
    }

    // --- Compute new streak ---
    let newStreak: number;
    if (streak.lastLoginDate) {
      const timeSinceLastLogin = now.getTime() - streak.lastLoginDate.getTime();
      if (timeSinceLastLogin < FORTY_EIGHT_HOURS_MS) {
        // 24h ≤ gap < 48h → consecutive day, streak continues
        newStreak = streak.currentStreak + 1;
      } else {
        // gap ≥ 48h → missed a day, streak resets
        newStreak = 1;
      }
    } else {
      // First login ever
      newStreak = 1;
    }

    const newLongest = Math.max(newStreak, streak.longestStreak);

    // --- Compute points to award ---
    let pointsAwarded = 0;
    if (
      newStreak <= GAMIFICATION_CONSTANTS.LOGIN_STREAK_DAYS_REQUIRED &&
      pointsThisMonth < GAMIFICATION_CONSTANTS.LOGIN_STREAK_MAX_POINTS_PER_MONTH
    ) {
      pointsAwarded = GAMIFICATION_CONSTANTS.LOGIN_STREAK_POINTS_PER_DAY;
    }

    // --- ATOMIC UPDATE: filter guarantees at most one write per 24-hour window ---
    // The filter only matches if lastLoginDate is absent/null OR older than 24 hours.
    // If a concurrent request already updated lastLoginDate within 24h, this
    // findOneAndUpdate returns null → no duplicate points.
    const updated = await this.loyaltyModel.findOneAndUpdate(
      {
        userId: userIdObj,
        $or: [
          { 'loginStreak.lastLoginDate': { $exists: false } },
          { 'loginStreak.lastLoginDate': null },
          { 'loginStreak.lastLoginDate': { $lt: twentyFourHoursAgo } },
        ],
      },
      {
        $set: {
          'loginStreak.currentStreak': newStreak,
          'loginStreak.lastLoginDate': now,
          'loginStreak.pointsEarnedThisMonth': pointsThisMonth + pointsAwarded,
          'loginStreak.monthlyResetDate': resetDate,
          'loginStreak.longestStreak': newLongest,
          lastActivity: now,
        },
      },
      { new: true },
    );

    if (!updated) {
      // Atomic filter rejected → already logged in within 24h (concurrent request won)
      this.logger.debug(
        `Login streak already recorded within 24h for user ${userId} (concurrent guard)`,
      );
      return { streakDays: streak.currentStreak, pointsAwarded: 0 };
    }

    // --- Award points AFTER the atomic guard succeeded ---
    if (pointsAwarded > 0) {
      await this.loyaltyService.addPoints(userId, {
        amount: pointsAwarded,
        reason: `Daily login streak - Day ${newStreak}`,
        bypassMultiplier: true,
      });

      this.logger.log(
        `Awarded ${pointsAwarded} login streak points to ${userId} (Day ${newStreak})`,
      );
    }

    return { streakDays: newStreak, pointsAwarded };
  }

  // =============================================================================
  // PURCHASE STREAK
  // =============================================================================

  /**
   * Update purchase streak when user picks up bags
   * Called from OrderService when pickup is confirmed
   */
  async updatePurchaseStreak(
    userId: string,
    bagsCount: number,
  ): Promise<{ completed: boolean; pointsAwarded: number }> {
    const account = await this.loyaltyModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!account) {
      return { completed: false, pointsAwarded: 0 };
    }

    const now = new Date();
    const monthStartUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const purchaseStreak = account.purchaseStreak ?? {
      bagsThisPeriod: 0,
      completedThisMonth: false,
      totalStreaksCompleted: 0,
    };

    // Check if monthly reset is needed (UTC-based)
    if (
      !purchaseStreak.monthlyResetDate ||
      purchaseStreak.monthlyResetDate.getTime() < monthStartUTC.getTime()
    ) {
      purchaseStreak.bagsThisPeriod = 0;
      purchaseStreak.completedThisMonth = false;
      purchaseStreak.periodStartDate = now;
      purchaseStreak.monthlyResetDate = monthStartUTC;
    }

    // Check if period needs reset (15 days passed)
    if (purchaseStreak.periodStartDate) {
      const periodEnd = new Date(
        purchaseStreak.periodStartDate.getTime() +
          GAMIFICATION_CONSTANTS.PURCHASE_STREAK_DAYS * 24 * 60 * 60 * 1000,
      );
      if (now > periodEnd) {
        // Period expired, reset
        purchaseStreak.bagsThisPeriod = 0;
        purchaseStreak.periodStartDate = now;
      }
    } else {
      purchaseStreak.periodStartDate = now;
    }

    // Add bags to current period
    purchaseStreak.bagsThisPeriod += bagsCount;

    let pointsAwarded = 0;
    let completed = false;

    // Check if streak completed (and not already completed this month)
    if (
      purchaseStreak.bagsThisPeriod >= GAMIFICATION_CONSTANTS.PURCHASE_STREAK_BAGS_REQUIRED &&
      !purchaseStreak.completedThisMonth
    ) {
      pointsAwarded = GAMIFICATION_CONSTANTS.PURCHASE_STREAK_POINTS;
      purchaseStreak.completedThisMonth = true;
      purchaseStreak.totalStreaksCompleted = (purchaseStreak.totalStreaksCompleted || 0) + 1;
      completed = true;

      await this.loyaltyService.addPoints(userId, {
        amount: pointsAwarded,
        reason: `Purchase streak completed: ${purchaseStreak.bagsThisPeriod} bags in 15 days`,
        bypassMultiplier: true,
      });

      this.logger.log(`Purchase streak completed! Awarded ${pointsAwarded} points to ${userId}`);
    }

    // Save updated streak
    await this.loyaltyModel.findByIdAndUpdate(account._id, { purchaseStreak });

    return { completed, pointsAwarded };
  }

  // =============================================================================
  // REVIEW POINTS
  // =============================================================================

  /**
   * Award points for a review (if valid).
   * Called from ReviewService when a review is created.
   *
   * ## Why the claim is a single atomic update
   *
   * This previously read the account, checked `reviewedOrderIds` in memory,
   * awarded the points, then wrote the whole `reviewTracking` sub-document back.
   * Two reviews submitted close together both read the pre-write array, and the
   * second write replaced the first — dropping an order id and leaving that
   * order claimable again. The counters lost an increment the same way. On a
   * single process this needs only two overlapping requests; across replicas it
   * is routine.
   *
   * The fix is to make "has this order been claimed?" and "mark it claimed" one
   * indivisible operation: the `$ne` guard lives in the **filter**, so MongoDB
   * evaluates it against the current document under the document-level write
   * lock. Exactly one of two concurrent claims can match. `$push`/`$inc` also
   * replace the read-modify-write, so no concurrent update can be clobbered.
   *
   * ## Why the claim happens before the points are awarded
   *
   * The two writes cannot be one transaction without a session, so one of them
   * must go first and a crash in between must be survivable.
   *
   * - Award first, claim second → a crash loses the claim, the user re-reviews
   *   and is paid twice. Points are currency here; that is a money leak.
   * - Claim first, award second → a crash costs the user one review's points,
   *   recoverable by hand and visible in the logged error below.
   *
   * Failing closed on the money is the correct trade, so the claim goes first.
   */
  async awardReviewPoints(
    userId: string,
    orderId: string,
    reviewText: string,
  ): Promise<{ awarded: boolean; pointsAwarded: number; reason?: string }> {
    /*
     * Validate before touching the database. A too-short review is the common
     * rejection and costs nothing to detect, so it should not consume a write.
     */
    const wordCount = reviewText
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 0).length;
    if (wordCount < GAMIFICATION_CONSTANTS.REVIEW_MIN_WORDS) {
      return {
        awarded: false,
        pointsAwarded: 0,
        reason: `Review must have at least ${GAMIFICATION_CONSTANTS.REVIEW_MIN_WORDS} words (you have ${wordCount})`,
      };
    }

    const orderObjectId = new Types.ObjectId(orderId);
    const pointsAwarded = GAMIFICATION_CONSTANTS.REVIEW_POINTS;

    /*
     * Atomic claim. `$slice` bounds the array at the cap — see
     * LOYALTY_REVIEWED_ORDER_IDS_MAX for why this ledger is capped rather than
     * left to grow, and what the exact fix would be.
     */
    const claim = await this.loyaltyModel.updateOne(
      {
        userId: new Types.ObjectId(userId),
        'reviewTracking.reviewedOrderIds': { $ne: orderObjectId },
      },
      {
        $push: {
          'reviewTracking.reviewedOrderIds': {
            $each: [orderObjectId],
            $slice: -LOYALTY_REVIEWED_ORDER_IDS_MAX,
          },
        },
        $inc: {
          'reviewTracking.totalReviewsCount': 1,
          'reviewTracking.totalReviewPoints': pointsAwarded,
        },
      },
    );

    if (claim.matchedCount === 0) {
      /*
       * Either there is no loyalty account, or this order was already claimed.
       * Distinguishing them needs a second read, and only the "no account" case
       * is actionable — "already reviewed" is an ordinary duplicate submission.
       */
      const accountExists = await this.loyaltyModel.exists({
        userId: new Types.ObjectId(userId),
      });

      return accountExists
        ? { awarded: false, pointsAwarded: 0, reason: 'Already reviewed this order' }
        : { awarded: false, pointsAwarded: 0, reason: 'Loyalty account not found' };
    }

    try {
      await this.loyaltyService.addPoints(userId, {
        amount: pointsAwarded,
        reason: 'Review submitted for order',
        orderId,
        bypassMultiplier: true,
      });
    } catch (err) {
      /*
       * The claim is already committed, so the user cannot retry for these
       * points. Log loudly with both ids: this is the one branch that needs a
       * human, and it is invisible to the user otherwise.
       */
      this.logger.error(
        `Claimed review points for order ${orderId} (user ${userId}) but addPoints failed — ` +
          `${pointsAwarded} points owed and not credited: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }

    this.logger.log(`Awarded ${pointsAwarded} review points to ${userId} for order ${orderId}`);

    return { awarded: true, pointsAwarded };
  }

  // =============================================================================
  // GAMIFICATION STATS
  // =============================================================================

  /**
   * Get user's gamification progress
   */
  async getGamificationStats(userId: string) {
    const account = await this.loyaltyModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!account) {
      throw new NotFoundException(appError('LOYALTY_ACCOUNT_NOT_FOUND'));
    }

    return {
      referralCode: account.referralCode,
      friendReferrals: {
        pending:
          account.friendReferrals?.filter(r => r.status === FriendReferralStatus.PENDING).length ||
          0,
        completed: account.friendReferralsCompleted || 0,
        pointsReward: GAMIFICATION_CONSTANTS.FRIEND_REFERRAL_POINTS,
        pendingDetails: account.friendReferrals
          ?.filter(r => r.status === FriendReferralStatus.PENDING)
          .map(r => ({
            friendBagCount: r.friendBagCount,
            bagsRequired: GAMIFICATION_CONSTANTS.FRIEND_REFERRAL_BAGS_REQUIRED,
            expiresAt: r.expiresAt,
          })),
      },
      businessReferrals: {
        pending:
          account.businessReferrals?.filter(r => r.status === BusinessReferralStatus.PENDING)
            .length || 0,
        completed: account.businessReferralsCompleted || 0,
        pointsReward: GAMIFICATION_CONSTANTS.BUSINESS_REFERRAL_POINTS,
        pendingDetails: account.businessReferrals
          ?.filter(r => r.status === BusinessReferralStatus.PENDING)
          .map(r => ({
            businessOrderCount: r.businessOrderCount,
            ordersRequired: GAMIFICATION_CONSTANTS.BUSINESS_REFERRAL_ORDERS_REQUIRED,
            expiresAt: r.expiresAt,
          })),
      },
      loginStreak: {
        currentStreak: account.loginStreak?.currentStreak || 0,
        pointsEarnedThisMonth: account.loginStreak?.pointsEarnedThisMonth || 0,
        maxPointsPerMonth: GAMIFICATION_CONSTANTS.LOGIN_STREAK_MAX_POINTS_PER_MONTH,
        daysRequired: GAMIFICATION_CONSTANTS.LOGIN_STREAK_DAYS_REQUIRED,
        longestStreak: account.loginStreak?.longestStreak || 0,
      },
      purchaseStreak: {
        // Cap at bagsRequired so the UI always shows at most 15/15 once the streak
        // is completed, even though the raw DB counter keeps growing past 15.
        bagsThisPeriod: Math.min(
          account.purchaseStreak?.bagsThisPeriod || 0,
          GAMIFICATION_CONSTANTS.PURCHASE_STREAK_BAGS_REQUIRED,
        ),
        bagsRequired: GAMIFICATION_CONSTANTS.PURCHASE_STREAK_BAGS_REQUIRED,
        daysRemaining: account.purchaseStreak?.periodStartDate
          ? Math.max(
              0,
              GAMIFICATION_CONSTANTS.PURCHASE_STREAK_DAYS -
                Math.floor(
                  (Date.now() - account.purchaseStreak.periodStartDate.getTime()) /
                    (24 * 60 * 60 * 1000),
                ),
            )
          : GAMIFICATION_CONSTANTS.PURCHASE_STREAK_DAYS,
        completedThisMonth: account.purchaseStreak?.completedThisMonth || false,
        totalStreaksCompleted: account.purchaseStreak?.totalStreaksCompleted || 0,
      },
      reviews: {
        totalReviews: account.reviewTracking?.totalReviewsCount || 0,
        totalPointsFromReviews: account.reviewTracking?.totalReviewPoints || 0,
        pointsPerReview: GAMIFICATION_CONSTANTS.REVIEW_POINTS,
        minWordsRequired: GAMIFICATION_CONSTANTS.REVIEW_MIN_WORDS,
      },
    };
  }

  // =============================================================================
  // CRON JOBS: Expire stale referrals
  // =============================================================================

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireStaleReferrals(): Promise<void> {
    await this.cronLock.runExclusive(
      CronLockName.GAMIFICATION_DAILY,
      CronLockTtl.STANDARD,
      async () => {
        await this.runStaleReferralExpiry();
      },
    );
  }

  private async runStaleReferralExpiry(): Promise<void> {
    const now = new Date();

    // Expire friend referrals
    const friendResult = await this.loyaltyModel.updateMany(
      {
        'friendReferrals.status': FriendReferralStatus.PENDING,
        'friendReferrals.expiresAt': { $lt: now },
      },
      {
        $set: { 'friendReferrals.$[elem].status': FriendReferralStatus.EXPIRED },
      },
      {
        arrayFilters: [
          { 'elem.status': FriendReferralStatus.PENDING, 'elem.expiresAt': { $lt: now } },
        ],
      },
    );

    // Expire business referrals
    const businessResult = await this.loyaltyModel.updateMany(
      {
        'businessReferrals.status': BusinessReferralStatus.PENDING,
        'businessReferrals.expiresAt': { $lt: now },
      },
      {
        $set: { 'businessReferrals.$[elem].status': BusinessReferralStatus.EXPIRED },
      },
      {
        arrayFilters: [
          { 'elem.status': BusinessReferralStatus.PENDING, 'elem.expiresAt': { $lt: now } },
        ],
      },
    );

    if (friendResult.modifiedCount > 0 || businessResult.modifiedCount > 0) {
      this.logger.log(
        `Expired referrals: ${friendResult.modifiedCount} friend, ${businessResult.modifiedCount} business`,
      );
    }
  }
}
