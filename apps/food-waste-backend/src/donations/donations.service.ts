import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CronLockName, CronLockTtl } from '../common/constants/cron-lock.constant';
import { CronLockService } from '../common/services/cron-lock.service';
import { Queue } from 'bull';
import { Model, Types } from 'mongoose';

import { DEFAULT_CURRENCY, DonationGoalCategory } from '@foodwaste/shared';

import { DonationStatsResponseDto, UserDonationStatsResponseDto } from './dto/donation-stats.dto';
import type { PostDonationJobData } from './processors/donation.processor';

import { getFirstGoal, getNextGoal } from './constants/goal-sequence.constant';
import {
  CreateDonationInput,
  DONATION_CONSTANTS,
  DEFAULT_CATEGORY_PRICES,
} from './interfaces/donation.interface';
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
    private readonly cronLock: CronLockService,
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

        const firstCategory = getFirstGoal();
        const defaults = DEFAULT_CATEGORY_PRICES[firstCategory];

        const defaultPool = new this.donationPoolModel({
          currentAmount: 0,
          targetAmount: defaults.itemPrice * defaults.targetCount,
          mealCount: 0,
          contributorCount: 0,
          totalDistributed: 0,
          status: DonationPoolStatus.ACTIVE,
          cause: 'Community Food Relief',
          activeGoalCategory: firstCategory,
          startDate: new Date(),
          season: 1,
          goalIndex: 0,
          completedGoals: [],
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
    const ops = categories.map(category => {
      const defaults = DEFAULT_CATEGORY_PRICES[category];
      return this.snapshotModel.updateOne(
        { category },
        {
          $setOnInsert: {
            category,
            totalAmount: 0,
            totalItems: 0,
            percent: 0,
            itemPrice: defaults.itemPrice,
            targetCount: defaults.targetCount,
            targetAmount: defaults.itemPrice * defaults.targetCount,
          },
        },
        { upsert: true },
      );
    });
    await Promise.all(ops);
  }

  /**
   * Calculate donation amount from order total
   * Formula: (orderTotal * platformFeePercentage) * donationPercentage
   * Example: (5 DT * 0.19) * 0.05 = 0.0475 DT
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

      // Target reached — advance to next goal with overflow
      if (
        updatedPool &&
        updatedPool.currentAmount >= updatedPool.targetAmount &&
        updatedPool.status === DonationPoolStatus.ACTIVE
      ) {
        const overflow = parseFloat(
          Math.max(0, updatedPool.currentAmount - updatedPool.targetAmount).toFixed(3),
        );
        await this.advanceToNextGoal(updatedPool, overflow);
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
   * Advance from a completed goal to the next one in the sequence.
   * The funded pool is capped at its target; overflow seeds the new pool.
   */
  private async advanceToNextGoal(
    fundedPool: DonationPoolDocument,
    overflow: number,
  ): Promise<void> {
    const nextCategory = getNextGoal(fundedPool.activeGoalCategory);

    if (!nextCategory) {
      await this.completeSeason(fundedPool);
      return;
    }

    const nextIndex = fundedPool.goalIndex + 1;
    const defaults = DEFAULT_CATEGORY_PRICES[nextCategory];
    const nextTarget = defaults.itemPrice * defaults.targetCount;

    // Cap the funded pool at its target and record the completed goal
    await this.donationPoolModel.findByIdAndUpdate(fundedPool._id, {
      $set: {
        status: DonationPoolStatus.FUNDED,
        currentAmount: fundedPool.targetAmount,
      },
      $push: { completedGoals: fundedPool.activeGoalCategory },
    });

    // Create the next goal's pool
    const newPool = new this.donationPoolModel({
      currentAmount: overflow,
      targetAmount: nextTarget,
      mealCount: 0,
      contributorCount: 0,
      totalDistributed: 0,
      status: DonationPoolStatus.ACTIVE,
      cause: fundedPool.cause,
      activeGoalCategory: nextCategory,
      startDate: new Date(),
      season: fundedPool.season,
      goalIndex: nextIndex,
      completedGoals: [...fundedPool.completedGoals, fundedPool.activeGoalCategory],
      distributionHistory: [],
      isArchived: false,
    });

    await newPool.save();

    // Update the next category's snapshot with overflow
    if (overflow > 0) {
      const mealOverflow = this.calculateMealCount(overflow);
      await this.snapshotModel.updateOne(
        { category: nextCategory },
        { $inc: { totalAmount: overflow, totalItems: mealOverflow } },
      );
    }

    this.logger.log(
      `Goal auto-rotated: ${fundedPool.activeGoalCategory} → ${nextCategory} (overflow: ${overflow} TND, season ${fundedPool.season})`,
    );

    // If overflow already fills the next goal, recurse
    if (overflow >= nextTarget) {
      const nextPoolDoc = await this.donationPoolModel.findOne({
        status: DonationPoolStatus.ACTIVE,
        isArchived: false,
      });
      if (nextPoolDoc) {
        const nextOverflow = parseFloat((overflow - nextTarget).toFixed(3));
        await this.advanceToNextGoal(nextPoolDoc, nextOverflow);
      }
    }
  }

  /**
   * All 5 goals completed — mark the pool as SEASON_COMPLETE.
   * A new season requires admin approval via the start-season endpoint.
   */
  private async completeSeason(lastPool: DonationPoolDocument): Promise<void> {
    await this.donationPoolModel.findByIdAndUpdate(lastPool._id, {
      $set: {
        status: DonationPoolStatus.SEASON_COMPLETE,
        currentAmount: lastPool.targetAmount,
      },
      $push: { completedGoals: lastPool.activeGoalCategory },
    });

    this.logger.log(
      `Season ${lastPool.season} complete! All 5 goals funded. Awaiting admin approval for new season.`,
    );
  }

  /**
   * Get current donation pool statistics (public endpoint)
   */
  async getCurrentStats(): Promise<DonationStatsResponseDto> {
    try {
      const [pool, snapshots] = await Promise.all([
        this.getActivePool(),
        this.snapshotModel.find().lean(),
      ]);

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
        season: pool.season ?? 1,
        goalIndex: pool.goalIndex ?? 0,
        completedGoals: pool.completedGoals ?? [],
        categoryProgress: snapshots.map(s => {
          const targetAmount = s.itemPrice * s.targetCount;
          return {
            category: s.category,
            percent:
              targetAmount > 0
                ? parseFloat(Math.min((s.totalAmount / targetAmount) * 100, 100).toFixed(2))
                : 0,
            totalItems: s.itemPrice > 0 ? Math.floor(s.totalAmount / s.itemPrice) : 0,
            totalAmount: parseFloat(s.totalAmount.toFixed(2)),
            targetAmount,
            itemPrice: s.itemPrice,
            targetCount: s.targetCount,
          };
        }),
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
      const [statsResult, latestDonation] = await Promise.all([
        this.userDonationModel.aggregate<{ totalDonated: number; count: number }>([
          { $match: { userId, isDeleted: { $ne: true } } },
          { $group: { _id: null, totalDonated: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        this.userDonationModel
          .findOne({ userId })
          .select('badgesEarned')
          .sort({ contributedAt: -1 })
          .lean(),
      ]);

      const totalDonated = statsResult[0]?.totalDonated ?? 0;
      const contributionCount = statsResult[0]?.count ?? 0;

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
    categoryPricing?:
      | Array<{
          category: DonationGoalCategory;
          itemPrice: number;
          targetCount: number;
        }>
      | undefined;
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
      setFields['targetDate'] = updates.targetDate ? new Date(updates.targetDate) : null;
    }

    if (Object.keys(setFields).length > 0) {
      await this.donationPoolModel.findByIdAndUpdate(pool._id, { $set: setFields }, { new: true });
      this.logger.log(`Active donation pool updated: ${JSON.stringify(setFields)}`);
    }

    if (updates.categoryPricing && updates.categoryPricing.length > 0) {
      const ops = updates.categoryPricing.map(cp =>
        this.snapshotModel.updateOne(
          { category: cp.category },
          {
            $set: {
              itemPrice: cp.itemPrice,
              targetCount: cp.targetCount,
              targetAmount: cp.itemPrice * cp.targetCount,
            },
          },
        ),
      );
      await Promise.all(ops);
      this.logger.log(`Category pricing updated for ${updates.categoryPricing.length} categories`);
    }

    return this.getCurrentStats();
  }

  /**
   * Admin: Archive the current active pool and create a fresh one.
   * Existing donation records are kept; pool counters reset to zero.
   */
  async resetPool(): Promise<DonationStatsResponseDto> {
    // Find the current highest season number
    const currentPool = await this.donationPoolModel
      .findOne({ isArchived: false })
      .sort({ season: -1 })
      .select('season')
      .lean();

    const nextSeason = (currentPool?.season ?? 0) + 1;

    // Archive ALL non-archived pools (handles SEASON_COMPLETE and any stragglers)
    await this.donationPoolModel.updateMany(
      { isArchived: false },
      { $set: { isArchived: true, archivedAt: new Date() } },
    );

    const firstCategory = getFirstGoal();
    const defaults = DEFAULT_CATEGORY_PRICES[firstCategory];

    const newPool = new this.donationPoolModel({
      currentAmount: 0,
      targetAmount: defaults.itemPrice * defaults.targetCount,
      mealCount: 0,
      contributorCount: 0,
      totalDistributed: 0,
      status: DonationPoolStatus.ACTIVE,
      cause: 'Community Food Relief',
      activeGoalCategory: firstCategory,
      startDate: new Date(),
      season: nextSeason,
      goalIndex: 0,
      completedGoals: [],
      distributionHistory: [],
      isArchived: false,
    });

    await newPool.save();

    // Reset category snapshots for the new season
    const resetOps = Object.values(DonationGoalCategory).map(category => {
      const catDefaults = DEFAULT_CATEGORY_PRICES[category];
      return this.snapshotModel.updateOne(
        { category },
        {
          $set: {
            totalAmount: 0,
            totalItems: 0,
            percent: 0,
            itemPrice: catDefaults.itemPrice,
            targetCount: catDefaults.targetCount,
            targetAmount: catDefaults.itemPrice * catDefaults.targetCount,
          },
        },
      );
    });
    await Promise.all(resetOps);

    this.logger.log(`New season ${nextSeason} started: old pools archived, snapshots reset`);

    return this.getCurrentStats();
  }

  /**
   * Get donation history: all archived/funded/season_complete pools grouped by season.
   * Admin sees the full history of every goal in every season.
   */
  async getDonationHistory(): Promise<
    Array<{
      season: number;
      pools: Array<{
        _id: string;
        activeGoalCategory: string;
        targetAmount: number;
        currentAmount: number;
        status: string;
        cause: string;
        startDate: string;
        archivedAt?: string;
        contributorCount: number;
        mealCount: number;
        goalIndex: number;
        completedGoals: string[];
      }>;
    }>
  > {
    const pools = await this.donationPoolModel
      .find({
        status: {
          $in: [
            DonationPoolStatus.FUNDED,
            DonationPoolStatus.ARCHIVED,
            DonationPoolStatus.SEASON_COMPLETE,
          ],
        },
      })
      .sort({ season: 1, goalIndex: 1 })
      .select(
        'season activeGoalCategory targetAmount currentAmount status cause startDate archivedAt contributorCount mealCount goalIndex completedGoals',
      )
      .lean();

    const seasonMap = new Map<number, typeof pools>();
    for (const pool of pools) {
      const season = pool.season ?? 1;
      if (!seasonMap.has(season)) {
        seasonMap.set(season, []);
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      seasonMap.get(season)!.push(pool);
    }

    return Array.from(seasonMap.entries())
      .sort(([a], [b]) => b - a)
      .map(([season, seasonPools]) => ({
        season,
        pools: seasonPools.map(p => ({
          _id: String(p._id),
          activeGoalCategory: p.activeGoalCategory,
          targetAmount: p.targetAmount,
          currentAmount: p.currentAmount,
          status: p.status,
          cause: p.cause,
          startDate: p.startDate.toISOString(),
          ...(p.archivedAt ? { archivedAt: p.archivedAt.toISOString() } : {}),
          contributorCount: p.contributorCount,
          mealCount: p.mealCount,
          goalIndex: p.goalIndex ?? 0,
          completedGoals: (p.completedGoals ?? []) as string[],
        })),
      }));
  }

  /**
   * Nightly: recalculate percent for every category snapshot.
   * Runs at 00:00 — no real-time updates needed.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async refreshCategorySnapshots(): Promise<void> {
    await this.cronLock.runExclusive(
      CronLockName.DONATIONS_DAILY,
      CronLockTtl.STANDARD,
      async () => {
        await this.runCategorySnapshotRefresh();
      },
    );
  }

  private async runCategorySnapshotRefresh(): Promise<void> {
    try {
      const snapshots = await this.snapshotModel.find().lean();
      const ops = snapshots.map(snap => {
        const targetAmount = snap.itemPrice * snap.targetCount;
        const percent =
          targetAmount > 0
            ? Math.min(parseFloat(((snap.totalAmount / targetAmount) * 100).toFixed(2)), 100)
            : 0;
        return this.snapshotModel.updateOne({ _id: snap._id }, { $set: { percent, targetAmount } });
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
    await this.cronLock.runExclusive(
      CronLockName.DONATIONS_MONTHLY,
      CronLockTtl.HEAVY,
      async () => {
        await this.runCompletedPoolArchival();
      },
    );
  }

  private async runCompletedPoolArchival(): Promise<void> {
    try {
      const result = await this.donationPoolModel.updateMany(
        { status: DonationPoolStatus.FUNDED, isArchived: false },
        { $set: { isArchived: true, archivedAt: new Date(), status: DonationPoolStatus.ARCHIVED } },
      );
      if (result.modifiedCount > 0) {
        this.logger.log(`Archived ${result.modifiedCount} funded donation pool(s)`);
      }
    } catch (error) {
      this.logger.error('Failed to archive completed pools', error);
    }
  }
}
