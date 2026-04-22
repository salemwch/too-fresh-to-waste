import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bull';
import { Model, Types } from 'mongoose';

import { DEFAULT_CURRENCY, DonationGoalCategory } from '@foodwaste/shared';

import { DonationStatsResponseDto, UserDonationStatsResponseDto } from './dto/donation-stats.dto';
import type { PostDonationJobData } from './processors/donation.processor';

import { CreateDonationInput, DONATION_CONSTANTS } from './interfaces/donation.interface';
import {
  DonationPool,
  DonationPoolDocument,
  DonationPoolStatus,
} from './schemas/donation-pool.schema';
import {
  DonationPoolSnapshot,
  DonationPoolSnapshotDocument,
} from './schemas/donation-pool-snapshot.schema';
import { UserDonation, UserDonationDocument } from './schemas/user-donation.schema';

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
    @InjectModel(DonationPoolSnapshot.name)
    private readonly snapshotModel: Model<DonationPoolSnapshotDocument>,
    @InjectModel(UserDonation.name)
    private readonly userDonationModel: Model<UserDonationDocument>,
    @InjectQueue('donations')
    private readonly donationsQueue: Queue<PostDonationJobData>,
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
          activeGoalCategory: DonationGoalCategory.TSHIRTS,
          startDate: new Date(),
          distributionHistory: [],
          isArchived: false,
        });

        await defaultPool.save();
        this.logger.log('Default donation pool created successfully');
      }

      await this.seedCategorySnapshots();
    } catch (error) {
      this.logger.error('Error initializing default donation pool', error);
      throw error;
    }
  }

  /**
   * Seed one DonationPoolSnapshot per DonationGoalCategory if missing.
   * Idempotent — uses upsert so concurrent startups are safe.
   */
  private async seedCategorySnapshots(): Promise<void> {
    const categories = Object.values(DonationGoalCategory);
    const ops = categories.map(category =>
      this.snapshotModel.updateOne(
        { category },
        {
          $setOnInsert: {
            category,
            totalAmount: 0,
            totalItems: 0,
            percent: 0,
            targetAmount: DONATION_CONSTANTS.DEFAULT_TARGET_AMOUNT,
          },
        },
        { upsert: true },
      ),
    );
    await Promise.all(ops);
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
   * Create a donation record for a user's order.
   *
   * Synchronous critical path — kept minimal on purpose:
   *   1. Idempotency check (orderId unique index is the hard guard)
   *   2. Save UserDonation
   *   3. Atomic $inc on currentAmount + mealCount
   *   4. Inline target-reached check (reuses the doc returned by $inc, no extra query)
   *   5. Enqueue background job for contributor count + badges
   *
   * contributor count and badge assignment intentionally run in the background
   * queue so they cannot add latency to the order completion path.
   */
  async createDonation(input: CreateDonationInput): Promise<UserDonationDocument> {
    try {
      const pool = await this.getActivePool();

      // Hard idempotency guard — orderId unique index prevents a second document,
      // this early-return prevents the queue from being enqueued twice.
      const existingDonation = await this.userDonationModel.findOne({
        orderId: input.orderId,
      });
      if (existingDonation) {
        this.logger.warn(`Donation already exists for order ${input.orderId}`);
        return existingDonation;
      }

      const estimatedMeals = this.calculateMealCount(input.amount);
      const normalizedCurrency = input.currency?.trim();

      const donation = new this.userDonationModel({
        userId: input.userId,
        orderId: input.orderId,
        donationPoolId: pool._id,
        amount: input.amount,
        moneySaved: input.moneySaved ?? 0,
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

      // Atomic increment — reuse the returned doc to avoid an extra findById.
      const updatedPool = await this.donationPoolModel.findByIdAndUpdate(
        pool._id,
        { $inc: { currentAmount: input.amount, mealCount: estimatedMeals } },
        { new: true },
      );

      // O(1) increment on the active category's pre-aggregated snapshot.
      await this.snapshotModel.updateOne(
        { category: pool.activeGoalCategory },
        { $inc: { totalAmount: input.amount, totalItems: estimatedMeals } },
      );

      // Inline target check using the doc we already have.
      if (
        updatedPool &&
        updatedPool.currentAmount >= updatedPool.targetAmount &&
        updatedPool.status === DonationPoolStatus.ACTIVE
      ) {
        await this.donationPoolModel.findByIdAndUpdate(pool._id, {
          $set: { status: DonationPoolStatus.FUNDED },
        });
        this.logger.log(`Donation pool ${pool._id} reached target — status set to FUNDED`);
      }

      // Off the critical path: contributor count + badge assignment.
      await this.donationsQueue.add('post-donation', {
        userId: input.userId.toString(),
        donationId: donation._id.toString(),
        poolId: pool._id.toString(),
      });

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
        activeGoalCategory: pool.activeGoalCategory,
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
    activeGoalCategory?: DonationGoalCategory | undefined;
    targetDate?: string | null | undefined;
  }): Promise<DonationStatsResponseDto> {
    const pool = await this.getActivePool();

    const setFields: Record<string, unknown> = {};
    if (updates.targetAmount !== undefined && updates.targetAmount !== null) {
      setFields['targetAmount'] = updates.targetAmount;
    }
    if (updates.cause !== undefined && updates.cause !== null) {
      setFields['cause'] = updates.cause;
    }
    if (updates.activeGoalCategory !== undefined && updates.activeGoalCategory !== null) {
      setFields['activeGoalCategory'] = updates.activeGoalCategory;
    }
    if (updates.targetDate !== undefined) {
      // null means "clear the date"; a string sets it
      setFields['targetDate'] = updates.targetDate ? new Date(updates.targetDate) : null;
    }

    if (Object.keys(setFields).length === 0) {
      return this.getCurrentStats();
    }

    await this.donationPoolModel.findByIdAndUpdate(pool._id, { $set: setFields }, { new: true });

    this.logger.log(`Active donation pool updated: ${JSON.stringify(setFields)}`);

    return this.getCurrentStats();
  }

  /**
   * Admin: Archive the current active pool and create a fresh one.
   * Existing donation records are kept; pool counters reset to zero.
   */
  async resetPool(): Promise<DonationStatsResponseDto> {
    await this.donationPoolModel.updateOne(
      { status: DonationPoolStatus.ACTIVE, isArchived: false },
      { $set: { isArchived: true, archivedAt: new Date() } },
    );

    const newPool = new this.donationPoolModel({
      currentAmount: 0,
      targetAmount: DONATION_CONSTANTS.DEFAULT_TARGET_AMOUNT,
      mealCount: 0,
      contributorCount: 0,
      totalDistributed: 0,
      status: DonationPoolStatus.ACTIVE,
      cause: 'Community Food Relief',
      activeGoalCategory: DonationGoalCategory.TSHIRTS,
      startDate: new Date(),
      distributionHistory: [],
      isArchived: false,
    });

    await newPool.save();
    this.logger.log('Donation pool reset: old pool archived, new pool created');

    return this.getCurrentStats();
  }

  /**
   * Nightly: recalculate percent for every category snapshot.
   * Runs at 00:00 — no real-time updates needed.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async refreshCategorySnapshots(): Promise<void> {
    try {
      const snapshots = await this.snapshotModel.find().lean();
      const ops = snapshots.map(snap => {
        const percent =
          snap.targetAmount > 0
            ? Math.min(parseFloat(((snap.totalAmount / snap.targetAmount) * 100).toFixed(2)), 100)
            : 0;
        return this.snapshotModel.updateOne({ _id: snap._id }, { $set: { percent } });
      });
      await Promise.all(ops);
      this.logger.log(`Refreshed ${snapshots.length} category snapshots`);
    } catch (error) {
      this.logger.error('Failed to refresh category snapshots', error);
    }
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
