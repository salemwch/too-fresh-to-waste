import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  LoyaltyAccount,
  LoyaltyAccountDocument,
  FriendReferralStatus,
  BusinessReferralStatus,
  BadgeType,
} from '../schemas/loyalty-account.schema';
import { LoyaltyService } from '../loyalty.service';

/**
 * Gamification Constants
 */
export const GAMIFICATION_CONSTANTS = {
  // Friend Referral: Friend buys 10 bags in first month → 15 points
  FRIEND_REFERRAL_BAGS_REQUIRED: 10,
  FRIEND_REFERRAL_POINTS: 15,
  FRIEND_REFERRAL_EXPIRY_DAYS: 30,

  // Business Referral: Business sells 30 orders in first month → 30 points
  BUSINESS_REFERRAL_ORDERS_REQUIRED: 30,
  BUSINESS_REFERRAL_POINTS: 30,
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
    private readonly loyaltyService: LoyaltyService,
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
      if (error.code === 11000) {
        this.logger.warn(`Duplicate loyalty account creation attempt for user: ${userId} (race condition handled)`);
        const existingAccount = await this.loyaltyModel.findOne({ userId: new Types.ObjectId(userId) });
        return existingAccount;
      }

      this.logger.error(
        `Failed to create loyalty account for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // =============================================================================
  // REFERRAL CODE GENERATION
  // =============================================================================

  /**
   * Generate a unique referral code for a user
   * Format: First 4 chars of name + 4 random alphanumeric
   */
  async generateReferralCode(userId: string, userName?: string): Promise<string> {
    const account = await this.loyaltyModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!account) {
      throw new NotFoundException('Loyalty account not found');
    }

    if (account.referralCode) {
      return account.referralCode;
    }

    // Generate code: NAME1234 format
    const prefix = (userName || 'USER').substring(0, 4).toUpperCase();
    let code: string;
    let attempts = 0;

    do {
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      code = `${prefix}${random}`;
      attempts++;
    } while (await this.loyaltyModel.exists({ referralCode: code }) && attempts < 10);

    if (attempts >= 10) {
      // Fallback to fully random
      code = `REF${Date.now().toString(36).toUpperCase()}`;
    }

    await this.loyaltyModel.findByIdAndUpdate(account._id, { referralCode: code });
    this.logger.log(`Generated referral code ${code} for user ${userId}`);

    return code;
  }

  /**
   * Get user's referral code (generate if doesn't exist)
   */
  async getReferralCode(userId: string, userName?: string): Promise<string> {
    const account = await this.loyaltyModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!account) {
      throw new NotFoundException('Loyalty account not found');
    }

    if (account.referralCode) {
      return account.referralCode;
    }

    return this.generateReferralCode(userId, userName);
  }

  /**
   * Find referrer by referral code
   */
  async findReferrerByCode(code: string): Promise<LoyaltyAccountDocument | null> {
    return this.loyaltyModel.findOne({ referralCode: code.toUpperCase() });
  }

  // =============================================================================
  // FRIEND REFERRAL SYSTEM
  // =============================================================================

  /**
   * Register a new friend referral when friend signs up with referral code
   */
  async registerFriendReferral(referrerUserId: string, friendUserId: string): Promise<void> {
    const referrerAccount = await this.loyaltyModel.findOne({
      userId: new Types.ObjectId(referrerUserId),
    });

    if (!referrerAccount) {
      throw new NotFoundException('Referrer loyalty account not found');
    }

    // Check if this friend is already referred
    const existingReferral = referrerAccount.friendReferrals?.find(
      r => r.friendUserId.toString() === friendUserId,
    );

    if (existingReferral) {
      this.logger.warn(`Friend ${friendUserId} already referred by ${referrerUserId}`);
      return;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + GAMIFICATION_CONSTANTS.FRIEND_REFERRAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await this.loyaltyModel.findByIdAndUpdate(referrerAccount._id, {
      $push: {
        friendReferrals: {
          friendUserId: new Types.ObjectId(friendUserId),
          referredAt: now,
          expiresAt,
          friendBagCount: 0,
          status: FriendReferralStatus.PENDING,
          pointsAwarded: 0,
        },
      },
    });

    this.logger.log(`Registered friend referral: ${friendUserId} referred by ${referrerUserId}`);
  }

  /**
   * Update friend's bag count when they complete an order pickup
   * Called from OrderService when pickup is confirmed
   */
  async updateFriendBagCount(friendUserId: string, bagsCount: number): Promise<void> {
    // Find all referrers who have this friend in their pending referrals
    const referrers = await this.loyaltyModel.find({
      'friendReferrals.friendUserId': new Types.ObjectId(friendUserId),
      'friendReferrals.status': FriendReferralStatus.PENDING,
    });

    for (const referrer of referrers) {
      const referralIndex = referrer.friendReferrals.findIndex(
        r => r.friendUserId.toString() === friendUserId && r.status === FriendReferralStatus.PENDING,
      );

      if (referralIndex === -1) continue;

      const referral = referrer.friendReferrals[referralIndex];
      const newBagCount = referral.friendBagCount + bagsCount;

      // Check if threshold reached
      if (newBagCount >= GAMIFICATION_CONSTANTS.FRIEND_REFERRAL_BAGS_REQUIRED) {
        // Award points!
        await this.loyaltyService.addPoints(referrer.userId.toString(), {
          amount: GAMIFICATION_CONSTANTS.FRIEND_REFERRAL_POINTS,
          reason: `Friend referral completed: Friend bought ${newBagCount} bags`,
          bypassMultiplier: true,
        });

        // Update referral status
        referrer.friendReferrals[referralIndex].friendBagCount = newBagCount;
        referrer.friendReferrals[referralIndex].status = FriendReferralStatus.COMPLETED;
        referrer.friendReferrals[referralIndex].completedAt = new Date();
        referrer.friendReferrals[referralIndex].pointsAwarded = GAMIFICATION_CONSTANTS.FRIEND_REFERRAL_POINTS;
        referrer.friendReferralsCompleted = (referrer.friendReferralsCompleted || 0) + 1;

        await referrer.save();

        this.logger.log(
          `Friend referral completed! Awarded ${GAMIFICATION_CONSTANTS.FRIEND_REFERRAL_POINTS} points to ${referrer.userId}`,
        );
      } else {
        // Just update bag count
        await this.loyaltyModel.updateOne(
          { _id: referrer._id, 'friendReferrals.friendUserId': new Types.ObjectId(friendUserId) },
          { $set: { 'friendReferrals.$.friendBagCount': newBagCount } },
        );
      }
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
      throw new NotFoundException('Referrer loyalty account not found');
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
    const expiresAt = new Date(now.getTime() + GAMIFICATION_CONSTANTS.BUSINESS_REFERRAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

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
    });

    this.logger.log(`Registered business referral: ${businessUserId} referred by ${referrerUserId}`);
  }

  /**
   * Update business's order count when they complete an order
   * Called from OrderService when pickup is confirmed (for merchant)
   */
  async updateBusinessOrderCount(businessUserId: string): Promise<void> {
    // Find all referrers who have this business in their pending referrals
    const referrers = await this.loyaltyModel.find({
      'businessReferrals.businessUserId': new Types.ObjectId(businessUserId),
      'businessReferrals.status': BusinessReferralStatus.PENDING,
    });

    for (const referrer of referrers) {
      const referralIndex = referrer.businessReferrals.findIndex(
        r => r.businessUserId.toString() === businessUserId && r.status === BusinessReferralStatus.PENDING,
      );

      if (referralIndex === -1) continue;

      const referral = referrer.businessReferrals[referralIndex];
      const newOrderCount = referral.businessOrderCount + 1;

      // Check if threshold reached
      if (newOrderCount >= GAMIFICATION_CONSTANTS.BUSINESS_REFERRAL_ORDERS_REQUIRED) {
        // Award points!
        await this.loyaltyService.addPoints(referrer.userId.toString(), {
          amount: GAMIFICATION_CONSTANTS.BUSINESS_REFERRAL_POINTS,
          reason: `Business referral completed: Business sold ${newOrderCount} orders`,
          bypassMultiplier: true,
        });

        // Update referral status
        referrer.businessReferrals[referralIndex].businessOrderCount = newOrderCount;
        referrer.businessReferrals[referralIndex].status = BusinessReferralStatus.COMPLETED;
        referrer.businessReferrals[referralIndex].completedAt = new Date();
        referrer.businessReferrals[referralIndex].pointsAwarded = GAMIFICATION_CONSTANTS.BUSINESS_REFERRAL_POINTS;
        referrer.businessReferralsCompleted = (referrer.businessReferralsCompleted || 0) + 1;

        await referrer.save();

        this.logger.log(
          `Business referral completed! Awarded ${GAMIFICATION_CONSTANTS.BUSINESS_REFERRAL_POINTS} points to ${referrer.userId}`,
        );
      } else {
        // Just update order count
        await this.loyaltyModel.updateOne(
          { _id: referrer._id, 'businessReferrals.businessUserId': new Types.ObjectId(businessUserId) },
          { $set: { 'businessReferrals.$.businessOrderCount': newOrderCount } },
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
      throw new NotFoundException('Loyalty account not found');
    }

    const now = new Date();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
    const twentyFourHoursAgo = new Date(now.getTime() - TWENTY_FOUR_HOURS_MS);
    const monthStartUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    // Extract current streak as a plain object (avoid Mongoose subdocument serialization issues)
    const streak = account.loginStreak
      ? {
          currentStreak: account.loginStreak.currentStreak || 0,
          lastLoginDate: account.loginStreak.lastLoginDate
            ? new Date(account.loginStreak.lastLoginDate)
            : null,
          pointsEarnedThisMonth: account.loginStreak.pointsEarnedThisMonth || 0,
          monthlyResetDate: account.loginStreak.monthlyResetDate
            ? new Date(account.loginStreak.monthlyResetDate)
            : null,
          longestStreak: account.loginStreak.longestStreak || 0,
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
      this.logger.debug(`Login streak already recorded within 24h for user ${userId} (concurrent guard)`);
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
  async updatePurchaseStreak(userId: string, bagsCount: number): Promise<{ completed: boolean; pointsAwarded: number }> {
    const account = await this.loyaltyModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!account) {
      return { completed: false, pointsAwarded: 0 };
    }

    const now = new Date();
    const monthStartUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    let purchaseStreak = account.purchaseStreak || {
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
      const periodEnd = new Date(purchaseStreak.periodStartDate.getTime() + GAMIFICATION_CONSTANTS.PURCHASE_STREAK_DAYS * 24 * 60 * 60 * 1000);
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
   * Award points for a review (if valid)
   * Called from ReviewService when review is created
   */
  async awardReviewPoints(
    userId: string,
    orderId: string,
    reviewText: string,
  ): Promise<{ awarded: boolean; pointsAwarded: number; reason?: string }> {
    const account = await this.loyaltyModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!account) {
      return { awarded: false, pointsAwarded: 0, reason: 'Loyalty account not found' };
    }

    // Check if already reviewed this order
    const reviewTracking = account.reviewTracking || { reviewedOrderIds: [], totalReviewsCount: 0, totalReviewPoints: 0 };
    if (reviewTracking.reviewedOrderIds?.some(id => id.toString() === orderId)) {
      return { awarded: false, pointsAwarded: 0, reason: 'Already reviewed this order' };
    }

    // Check minimum word count
    const wordCount = reviewText.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount < GAMIFICATION_CONSTANTS.REVIEW_MIN_WORDS) {
      return {
        awarded: false,
        pointsAwarded: 0,
        reason: `Review must have at least ${GAMIFICATION_CONSTANTS.REVIEW_MIN_WORDS} words (you have ${wordCount})`,
      };
    }

    // Award points
    const pointsAwarded = GAMIFICATION_CONSTANTS.REVIEW_POINTS;

    await this.loyaltyService.addPoints(userId, {
      amount: pointsAwarded,
      reason: 'Review submitted for order',
      orderId,
      bypassMultiplier: true,
    });

    // Update review tracking
    reviewTracking.reviewedOrderIds = [...(reviewTracking.reviewedOrderIds || []), new Types.ObjectId(orderId)];
    reviewTracking.totalReviewsCount = (reviewTracking.totalReviewsCount || 0) + 1;
    reviewTracking.totalReviewPoints = (reviewTracking.totalReviewPoints || 0) + pointsAwarded;

    await this.loyaltyModel.findByIdAndUpdate(account._id, { reviewTracking });

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
      throw new NotFoundException('Loyalty account not found');
    }

    return {
      referralCode: account.referralCode,
      friendReferrals: {
        pending: account.friendReferrals?.filter(r => r.status === FriendReferralStatus.PENDING).length || 0,
        completed: account.friendReferralsCompleted || 0,
        pendingDetails: account.friendReferrals
          ?.filter(r => r.status === FriendReferralStatus.PENDING)
          .map(r => ({
            friendBagCount: r.friendBagCount,
            bagsRequired: GAMIFICATION_CONSTANTS.FRIEND_REFERRAL_BAGS_REQUIRED,
            expiresAt: r.expiresAt,
          })),
      },
      businessReferrals: {
        pending: account.businessReferrals?.filter(r => r.status === BusinessReferralStatus.PENDING).length || 0,
        completed: account.businessReferralsCompleted || 0,
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
          ? Math.max(0, GAMIFICATION_CONSTANTS.PURCHASE_STREAK_DAYS - Math.floor((Date.now() - account.purchaseStreak.periodStartDate.getTime()) / (24 * 60 * 60 * 1000)))
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
        arrayFilters: [{ 'elem.status': FriendReferralStatus.PENDING, 'elem.expiresAt': { $lt: now } }],
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
        arrayFilters: [{ 'elem.status': BusinessReferralStatus.PENDING, 'elem.expiresAt': { $lt: now } }],
      },
    );

    if (friendResult.modifiedCount > 0 || businessResult.modifiedCount > 0) {
      this.logger.log(
        `Expired referrals: ${friendResult.modifiedCount} friend, ${businessResult.modifiedCount} business`,
      );
    }
  }
}
