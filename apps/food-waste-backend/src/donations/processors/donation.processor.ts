import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bull';
import { Model, Types } from 'mongoose';

import { QueueConcurrency } from '../../common/constants/queue-concurrency.constant';
import { DonationPool, DonationPoolDocument } from '../schemas/donation-pool.schema';
import { PoolContributor, PoolContributorDocument } from '../schemas/pool-contributor.schema';
import { DonationBadge, UserDonation, UserDonationDocument } from '../schemas/user-donation.schema';

export interface PostDonationJobData {
  userId: string;
  donationId: string;
  poolId: string;
}

@Injectable()
@Processor('donations')
export class DonationProcessor {
  private readonly logger = new Logger(DonationProcessor.name);

  constructor(
    @InjectModel(DonationPool.name)
    private readonly donationPoolModel: Model<DonationPoolDocument>,
    @InjectModel(UserDonation.name)
    private readonly userDonationModel: Model<UserDonationDocument>,
    @InjectModel(PoolContributor.name)
    private readonly poolContributorModel: Model<PoolContributorDocument>,
  ) {}

  @Process({ name: 'post-donation', concurrency: QueueConcurrency.DONATIONS })
  async handlePostDonation(job: Job<PostDonationJobData>): Promise<void> {
    const userId = new Types.ObjectId(job.data.userId);
    const donationId = new Types.ObjectId(job.data.donationId);
    const poolId = new Types.ObjectId(job.data.poolId);

    await Promise.all([
      this.updateContributorCount(userId, poolId),
      this.assignBadges(userId, donationId),
    ]);
  }

  /**
   * O(1) contributor count via unique-index upsert.
   *
   * Attempt to insert { poolId, userId }. If the insert succeeds the user is
   * new to this pool → $inc contributorCount. If MongoDB rejects with 11000
   * (duplicate key) the user already contributed → skip silently.
   *
   * This is race-condition-proof: two concurrent jobs for the same user can
   * never both increment because only one insert can win the unique index.
   */
  private async updateContributorCount(
    userId: Types.ObjectId,
    poolId: Types.ObjectId,
  ): Promise<void> {
    try {
      await this.poolContributorModel.create({ poolId, userId });
      // Insert succeeded → new contributor
      await this.donationPoolModel.findByIdAndUpdate(poolId, {
        $inc: { contributorCount: 1 },
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        return; // returning contributor — nothing to do
      }
      this.logger.error(`Failed to update contributor count for pool ${poolId}`, error);
      throw error; // non-duplicate error → Bull retries the job
    }
  }

  /**
   * Badge assignment based on cumulative donation history.
   * Non-critical: errors are logged but never propagate to Bull.
   */
  private async assignBadges(userId: Types.ObjectId, donationId: Types.ObjectId): Promise<void> {
    try {
      const userDonations = await this.userDonationModel.find({ userId }).select('amount').lean();

      const totalDonated = userDonations.reduce((sum, d) => sum + d.amount, 0);
      const contributionCount = userDonations.length;

      const badges: DonationBadge[] = [];
      if (contributionCount >= 1) {
        badges.push(DonationBadge.FIRST_STEP);
      }
      if (contributionCount >= 10) {
        badges.push(DonationBadge.COMMUNITY_HELPER);
      }
      if (totalDonated >= 50) {
        badges.push(DonationBadge.IMPACT_MAKER);
      }
      if (totalDonated >= 100) {
        badges.push(DonationBadge.FOOD_HERO);
      }
      if (totalDonated >= 500) {
        badges.push(DonationBadge.CHAMPION);
      }

      if (badges.length > 0) {
        await this.userDonationModel.findByIdAndUpdate(donationId, { badgesEarned: badges });
      }
    } catch (error) {
      this.logger.error(`Failed to assign badges for user ${userId}`, error);
      // intentionally not re-thrown — badge failure must not fail the job
    }
  }
}
