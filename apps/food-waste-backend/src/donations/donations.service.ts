import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';

import { DonationStatsResponseDto, UserDonationStatsResponseDto } from './dto/donation-stats.dto';
import { DEFAULT_CURRENCY } from '@foodwaste/shared';

import { CreateDonationInput, DONATION_CONSTANTS } from './interfaces/donation.interface';
import {
  DonationPool,
  DonationPoolDocument,
  DonationPoolStatus,
} from './schemas/donation-pool.schema';
import { UserDonation, UserDonationDocument, DonationBadge } from './schemas/user-donation.schema';

interface AggregateCountResult {
  count: number;
}

/**
 * DonationsService
 * Enterprise-grade service for managing donation pools and user contributions
 * Implements SOLID principles with full transaction support and error handling
 */
@Injectable()
export class DonationsService {
  private readonly logger = new Logger(DonationsService.name);

  constructor(
    @InjectModel(DonationPool.name)
    private readonly donationPoolModel: Model<DonationPoolDocument>,
    @InjectModel(UserDonation.name)
    private readonly userDonationModel: Model<UserDonationDocument>,
  ) {
    this.initializeDefaultPool().catch(error => {
      this.logger.error('Failed to initialize default donation pool', error);
    });
  }

  /**
   * Initialize the default active donation pool if none exists
   * Runs on service startup to ensure there's always an active pool
   */
  private async initializeDefaultPool(): Promise<void> {
    try {
      const existingPool = await this.donationPoolModel.findOne({
        status: DonationPoolStatus.ACTIVE,
        isArchived: false,
      });

      if (!existingPool) {
        this.logger.log('No active donation pool found. Creating default pool...');

        const defaultPool = new this.donationPoolModel({
          currentAmount: 0,
          targetAmount: DONATION_CONSTANTS.DEFAULT_TARGET_AMOUNT,
          mealCount: 0,
          contributorCount: 0,
          totalDistributed: 0,
          status: DonationPoolStatus.ACTIVE,
          cause: 'Community Food Relief 2025',
          startDate: new Date(),
          distributionHistory: [],
          isArchived: false,
        });

        await defaultPool.save();
        this.logger.log('Default donation pool created successfully');
      }
    } catch (error) {
      this.logger.error('Error initializing default donation pool', error);
      throw error;
    }
  }

  /**
   * Calculate donation amount from order total
   * Formula: (orderTotal * platformFeePercentage) * donationPercentage
   * Example: (5 DT * 0.25) * 0.05 = 0.0625 DT
   */
  calculateDonationAmount(orderTotal: number): number {
    if (orderTotal <= 0) {
      throw new BadRequestException('Order total must be greater than 0');
    }

    const platformFee = orderTotal * DONATION_CONSTANTS.PLATFORM_FEE_PERCENTAGE;
    const donationAmount = platformFee * DONATION_CONSTANTS.DONATION_PERCENTAGE;

    return parseFloat(donationAmount.toFixed(3)); // Precision to 3 decimal places
  }

  /**
   * Calculate estimated meals from donation amount
   */
  calculateMealCount(donationAmount: number): number {
    return Math.floor(donationAmount / DONATION_CONSTANTS.MEAL_COST_ESTIMATE_TND);
  }

  /**
   * Get the current active donation pool
   * Creates one if it doesn't exist
   */
  async getActivePool(): Promise<DonationPoolDocument> {
    let pool = await this.donationPoolModel.findOne({
      status: DonationPoolStatus.ACTIVE,
      isArchived: false,
    });

    if (!pool) {
      this.logger.warn('No active pool found during getActivePool, creating one');
      await this.initializeDefaultPool();
      pool = await this.donationPoolModel.findOne({
        status: DonationPoolStatus.ACTIVE,
        isArchived: false,
      });
    }

    if (!pool) {
      throw new InternalServerErrorException('Failed to retrieve or create active donation pool');
    }

    return pool;
  }

  /**
   * Create a donation record for a user's order
   * This is called automatically when an order is created
   */
  async createDonation(input: CreateDonationInput): Promise<UserDonationDocument> {
    try {
      // Get or create active pool
      const pool = await this.getActivePool();

      // Check if donation already exists for this order (idempotency)
      // Note: isDeleted filter is handled by schema pre-find middleware
      const existingDonation = await this.userDonationModel.findOne({
        orderId: input.orderId,
      });

      if (existingDonation) {
        this.logger.warn(`Donation already exists for order ${input.orderId}`);
        return existingDonation;
      }

      // Calculate meals
      const estimatedMeals = this.calculateMealCount(input.amount);
      const normalizedCurrency = input.currency?.trim();

      // Create donation record
      const donation = new this.userDonationModel({
        userId: input.userId,
        orderId: input.orderId,
        donationPoolId: pool._id,
        amount: input.amount,
        currency:
          normalizedCurrency !== null &&
          normalizedCurrency !== undefined &&
          normalizedCurrency.length > 0
            ? normalizedCurrency
            : DEFAULT_CURRENCY,
        contributedAt: new Date(),
        isAnonymous: input.isAnonymous ?? false,
        badgesEarned: [],
        metadata: input.metadata,
      });

      await donation.save();

      // Update pool atomically
      await this.donationPoolModel.findByIdAndUpdate(
        pool._id,
        {
          $inc: {
            currentAmount: input.amount,
            mealCount: estimatedMeals,
          },
        },
        { new: true },
      );

      // Update contributor count (unique users)
      await this.updateContributorCount(pool._id);

      // Calculate and assign badges
      await this.calculateAndAssignBadges(input.userId, donation._id);

      // Check if pool reached target and should transition
      await this.checkPoolTargetReached(pool._id);

      this.logger.log(
        `Donation created: ${input.amount} TND by user ${input.userId} for order ${input.orderId}`,
      );

      return donation;
    } catch (error) {
      this.logger.error('Failed to create donation', error);
      throw new InternalServerErrorException('Failed to create donation record');
    }
  }

  /**
   * Update unique contributor count for a pool
   */
  private async updateContributorCount(poolId: Types.ObjectId): Promise<void> {
    const uniqueContributors = await this.userDonationModel.distinct('userId', {
      donationPoolId: poolId,
    });

    await this.donationPoolModel.findByIdAndUpdate(poolId, {
      contributorCount: uniqueContributors.length,
    });
  }

  /**
   * Calculate and assign badges based on user's donation history
   */
  private async calculateAndAssignBadges(
    userId: Types.ObjectId,
    donationId: Types.ObjectId,
  ): Promise<void> {
    try {
      // Get user's total stats
      const stats = await this.getUserStats(userId);
      const earnedBadges: DonationBadge[] = [];

      // Check badge criteria
      if (stats.contributionCount >= 1 && stats.contributionCount < 10) {
        earnedBadges.push(DonationBadge.FIRST_STEP);
      }
      if (stats.contributionCount >= 10) {
        earnedBadges.push(DonationBadge.FIRST_STEP, DonationBadge.COMMUNITY_HELPER);
      }
      if (stats.totalDonated >= 50) {
        earnedBadges.push(DonationBadge.IMPACT_MAKER);
      }
      if (stats.totalDonated >= 100) {
        earnedBadges.push(DonationBadge.FOOD_HERO);
      }
      if (stats.totalDonated >= 500) {
        earnedBadges.push(DonationBadge.CHAMPION);
      }

      // Update the donation record with badges
      if (earnedBadges.length > 0) {
        await this.userDonationModel.findByIdAndUpdate(donationId, {
          badgesEarned: earnedBadges,
        });
      }
    } catch (error) {
      this.logger.error('Failed to calculate badges', error);
      // Non-critical, don't throw
    }
  }

  /**
   * Check if pool reached target and transition status
   */
  private async checkPoolTargetReached(poolId: Types.ObjectId): Promise<void> {
    const pool = await this.donationPoolModel.findById(poolId);

    if (
      pool &&
      pool.currentAmount >= pool.targetAmount &&
      pool.status === DonationPoolStatus.ACTIVE
    ) {
      pool.status = DonationPoolStatus.FUNDED;
      await pool.save();

      this.logger.log(`Donation pool ${poolId} reached target! Status: FUNDED`);
      // TODO: Trigger notification to admins
    }
  }

  /**
   * Get current donation pool statistics (public endpoint)
   */
  async getCurrentStats(): Promise<DonationStatsResponseDto> {
    try {
      const pool = await this.getActivePool();

      const stats: DonationStatsResponseDto = {
        totalDonations: parseFloat(pool.currentAmount.toFixed(2)),
        targetAmount: pool.targetAmount,
        mealCount: this.calculateMealCount(pool.currentAmount),
        contributorCount: pool.contributorCount,
        progressPercentage: parseFloat(((pool.currentAmount / pool.targetAmount) * 100).toFixed(2)),
        status: pool.status,
        cause: pool.cause,
        currency: DEFAULT_CURRENCY,
        targetDate: pool.targetDate ? pool.targetDate.toISOString() : undefined,
      };

      return stats;
    } catch (error) {
      this.logger.error('Failed to get current donation stats', error);
      throw new InternalServerErrorException('Failed to retrieve donation statistics');
    }
  }

  /**
   * Get user-specific donation statistics
   */
  async getUserStats(userId: Types.ObjectId): Promise<UserDonationStatsResponseDto> {
    try {
      // Aggregate user donations — select only fields needed for stats computation
      // Note: isDeleted filter is handled by schema pre-find middleware
      const userDonations = await this.userDonationModel
        .find({
          userId,
        })
        .select('amount contributedAt badges')
        .lean();

      const totalDonated = userDonations.reduce((sum, d) => sum + d.amount, 0);
      const contributionCount = userDonations.length;

      // Get all badges (take from most recent donation)
      const latestDonation = userDonations.sort(
        (a, b) => b.contributedAt.getTime() - a.contributedAt.getTime(),
      )[0];

      const badgesEarned = latestDonation?.badgesEarned ?? [];
      const mealsContributed = this.calculateMealCount(totalDonated);

      // Calculate rank (simplified - count users with more donations)
      // Note: isDeleted filter is handled by schema pre-aggregate middleware
      const usersWithMore = await this.userDonationModel.aggregate<AggregateCountResult>([
        { $group: { _id: '$userId', total: { $sum: '$amount' } } },
        { $match: { total: { $gt: totalDonated } } },
        { $count: 'count' },
      ]);

      const rank = (usersWithMore[0]?.count ?? 0) + 1;

      return {
        totalDonated: parseFloat(totalDonated.toFixed(2)),
        contributionCount,
        badgesEarned,
        mealsContributed,
        rank,
        currency: DEFAULT_CURRENCY,
      };
    } catch (error) {
      this.logger.error(`Failed to get user stats for ${userId}`, error);
      throw new InternalServerErrorException('Failed to retrieve user donation statistics');
    }
  }

  /**
   * Admin: Update the active donation pool (targetAmount, cause)
   * Only updates fields that are provided (partial update)
   */
  async updateActivePool(updates: {
    targetAmount?: number | undefined;
    cause?: string | undefined;
  }): Promise<DonationStatsResponseDto> {
    const pool = await this.getActivePool();

    const setFields: Record<string, unknown> = {};
    if (updates.targetAmount !== null) {
      setFields['targetAmount'] = updates.targetAmount;
    }
    if (updates.cause !== null) {
      setFields['cause'] = updates.cause;
    }

    if (Object.keys(setFields).length === 0) {
      return this.getCurrentStats();
    }

    await this.donationPoolModel.findByIdAndUpdate(pool._id, { $set: setFields }, { new: true });

    this.logger.log(`Active donation pool updated: ${JSON.stringify(setFields)}`);

    return this.getCurrentStats();
  }

  /**
   * Archive old pools and create new one (admin/cron job)
   * Runs monthly to rotate donation pools
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async archiveCompletedPools(): Promise<void> {
    try {
      const fundedPools = await this.donationPoolModel
        .find({
          status: DonationPoolStatus.FUNDED,
          isArchived: false,
        })
        .lean();

      for (const pool of fundedPools) {
        pool.isArchived = true;
        pool.archivedAt = new Date();
        await pool.save();
        this.logger.log(`Archived donation pool ${pool._id}`);
      }
    } catch (error) {
      this.logger.error('Failed to archive completed pools', error);
    }
  }
}
