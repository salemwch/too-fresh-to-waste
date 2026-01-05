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
   * Record daily login and award streak points
   * Called when user logs in
   */
  async recordDailyLogin(userId: string): Promise<{ streakDays: number; pointsAwarded: number }> {
    const account = await this.loyaltyModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!account) {
      throw new NotFoundException('Loyalty account not found');
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const loginStreak = account.loginStreak || {
      currentStreak: 0,
      pointsEarnedThisMonth: 0,
      longestStreak: 0,
    };

    // Check if monthly reset is needed
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    if (!loginStreak.monthlyResetDate || loginStreak.monthlyResetDate < monthStart) {
      loginStreak.pointsEarnedThisMonth = 0;
      loginStreak.monthlyResetDate = monthStart;
    }

    // Check if already logged in today
    if (loginStreak.lastLoginDate) {
      const lastLogin = new Date(loginStreak.lastLoginDate);
      const lastLoginDay = new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate());

      if (lastLoginDay.getTime() === today.getTime()) {
        // Already logged in today, no points
        return { streakDays: loginStreak.currentStreak, pointsAwarded: 0 };
      }

      // Check if streak continues (yesterday)
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      if (lastLoginDay.getTime() === yesterday.getTime()) {
        // Streak continues
        loginStreak.currentStreak += 1;
      } else {
        // Streak broken, reset to 1
        loginStreak.currentStreak = 1;
      }
    } else {
      // First login ever
      loginStreak.currentStreak = 1;
    }

    loginStreak.lastLoginDate = now;

    // Update longest streak
    if (loginStreak.currentStreak > (loginStreak.longestStreak || 0)) {
      loginStreak.longestStreak = loginStreak.currentStreak;
    }

    // Award points if within the 10-day streak and haven't maxed out monthly
    let pointsAwarded = 0;
    if (
      loginStreak.currentStreak <= GAMIFICATION_CONSTANTS.LOGIN_STREAK_DAYS_REQUIRED &&
      loginStreak.pointsEarnedThisMonth < GAMIFICATION_CONSTANTS.LOGIN_STREAK_MAX_POINTS_PER_MONTH
    ) {
      pointsAwarded = GAMIFICATION_CONSTANTS.LOGIN_STREAK_POINTS_PER_DAY;
      loginStreak.pointsEarnedThisMonth += pointsAwarded;

      await this.loyaltyService.addPoints(userId, {
        amount: pointsAwarded,
        reason: `Daily login streak - Day ${loginStreak.currentStreak}`,
      });

      this.logger.log(`Awarded ${pointsAwarded} login streak points to ${userId} (Day ${loginStreak.currentStreak})`);
    }

    // Save updated streak
    await this.loyaltyModel.findByIdAndUpdate(account._id, {
      loginStreak,
      lastActivity: now,
    });

    return { streakDays: loginStreak.currentStreak, pointsAwarded };
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
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let purchaseStreak = account.purchaseStreak || {
      bagsThisPeriod: 0,
      completedThisMonth: false,
      totalStreaksCompleted: 0,
    };

    // Check if monthly reset is needed
    if (!purchaseStreak.monthlyResetDate || purchaseStreak.monthlyResetDate < monthStart) {
      purchaseStreak.bagsThisPeriod = 0;
      purchaseStreak.completedThisMonth = false;
      purchaseStreak.periodStartDate = now;
      purchaseStreak.monthlyResetDate = monthStart;
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
        bagsThisPeriod: account.purchaseStreak?.bagsThisPeriod || 0,
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
