import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LoyaltyAccountDocument, BadgeType, PointTransaction, LoyaltyAccount } from './schemas/loyalty-account.schema';
import { CreateLoyaltyAccountDto, AddPointsDto, DonatePointsDto, DonatePointsResponseDto } from './dto/loyalty-account.dto';
import { DonationsService } from '../donations/donations.service';
import { DONATION_CONSTANTS } from '../donations/interfaces/donation.interface';

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
    { name: 'Silver', minPoints: 500, multiplier: 1.2 },
    { name: 'Gold', minPoints: 1500, multiplier: 1.5 },
    { name: 'Platinum', minPoints: 3000, multiplier: 2.0 },
  ];

  /**
   * Points to TND conversion rate
   * 100 points = 1 TND for donation purposes
   */
  private readonly POINTS_TO_TND_RATE = 0.01;

  constructor(
    @InjectModel(LoyaltyAccount.name) private readonly loyaltyModel: Model<LoyaltyAccountDocument>,
    @Inject(forwardRef(() => DonationsService)) private readonly donationsService: DonationsService,
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
      this.logger.error(`Error creating loyalty account: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
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
   * Add points to a user's account
   * Points are multiplied based on current tier
   */
  async addPoints(userId: string, addPointsDto: AddPointsDto): Promise<LoyaltyAccountDocument> {
    try {
      const account = await this.getLoyaltyAccount(userId);

      const currentTier = this.getCurrentTier(account.totalPoints);
      const multipliedPoints = Math.floor(addPointsDto.amount * currentTier.multiplier);

      const pointTransaction: PointTransaction = {
        amount: multipliedPoints,
        type: 'earned',
        reason: addPointsDto.reason,
        orderId: addPointsDto.orderId ? new Types.ObjectId(addPointsDto.orderId) : undefined,
        offerId: addPointsDto.offerId ? new Types.ObjectId(addPointsDto.offerId) : undefined,
        createdAt: new Date(),
        expiresAt: addPointsDto.expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year default
      };

      const updatedAccount = await this.loyaltyModel.findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        {
          $inc: {
            totalPoints: multipliedPoints,
            availablePoints: multipliedPoints,
            lifetimePointsEarned: multipliedPoints,
          },
          $push: { pointsHistory: pointTransaction },
          $set: {
            lastActivity: new Date(),
            currentTier: this.getCurrentTier(account.totalPoints + multipliedPoints).name,
          },
        },
        { new: true },
      );

      await this.checkAndAwardBadges(updatedAccount);

      this.logger.log(`Added ${multipliedPoints} points to user: ${userId}`);
      return updatedAccount;
    } catch (error) {
      this.logger.error(`Error adding points: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
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
        throw new BadRequestException(`Insufficient points. You have ${account.availablePoints} points available.`);
      }

      // Convert points to TND
      const donationAmount = donateDto.amount * this.POINTS_TO_TND_RATE;
      const estimatedMeals = Math.floor(donationAmount / DONATION_CONSTANTS.MEAL_COST_ESTIMATE_TND);

      // Create donation transaction in points history
      const pointTransaction: PointTransaction = {
        amount: -donateDto.amount,
        type: 'donated',
        reason: donateDto.message || 'Donated to community food relief',
        createdAt: new Date(),
      };

      // Deduct points from user account
      const updatedAccount = await this.loyaltyModel.findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        {
          $inc: { availablePoints: -donateDto.amount },
          $push: { pointsHistory: pointTransaction },
          $set: { lastActivity: new Date() },
        },
        { new: true },
      );

      // Add to donation pool
      const pool = await this.donationsService.getActivePool();
      await this.donationsService['donationPoolModel'].findByIdAndUpdate(
        pool._id,
        {
          $inc: {
            currentAmount: donationAmount,
            mealCount: estimatedMeals,
          },
        },
      );

      // Update contributor count
      await this.donationsService['updateContributorCount'](pool._id as Types.ObjectId);

      this.logger.log(`User ${userId} donated ${donateDto.amount} points (${donationAmount} TND) to donation pool`);

      return {
        success: true,
        pointsDonated: donateDto.amount,
        donationAmount: parseFloat(donationAmount.toFixed(2)),
        currency: DONATION_CONSTANTS.DEFAULT_CURRENCY,
        estimatedMeals,
        remainingPoints: updatedAccount.availablePoints,
        message: `Thank you! Your ${donateDto.amount} points have been converted to ${donationAmount.toFixed(2)} TND and donated to help feed those in need.`,
      };
    } catch (error) {
      this.logger.error(`Error donating points: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
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
  private getCurrentTier(totalPoints: number) {
    return this.tiers
      .filter(tier => totalPoints >= tier.minPoints)
      .sort((a, b) => b.minPoints - a.minPoints)[0] || this.tiers[0];
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

    if (account.totalOrdersCount >= 10 && !account.badges.some(b => b.type === BadgeType.FREQUENT_SAVER)) {
      badges.push({
        type: BadgeType.FREQUENT_SAVER,
        earnedAt: new Date(),
        name: 'Frequent Saver',
        description: 'Completed 10 orders',
        iconUrl: '/badges/frequent-saver.png',
      });
    }

    if (account.totalAmountSpent >= 1000 && !account.badges.some(b => b.type === BadgeType.ECO_WARRIOR)) {
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
}
