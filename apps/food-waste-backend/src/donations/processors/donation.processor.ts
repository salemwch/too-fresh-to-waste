import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bull';
import { Model, Types } from 'mongoose';

import { DonationPool, DonationPoolDocument } from '../schemas/donation-pool.schema';
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
  ) {}

  /**
   * Background job: contributor count + badge assignment.
   *
   * Runs after createDonation has already committed the donation document
   * and applied the $inc on currentAmount. Safe to retry — the orderId
   * unique index guarantees the donation document is never duplicated, so
   * this job is never enqueued more than once for the same donation.
   */
  @Process('post-donation')
  async handlePostDonation(job: Job<PostDonationJobData>): Promise<void> {
    const userId = new Types.ObjectId(job.data.userId);
    const donationId = new Types.ObjectId(job.data.donationId);
    const poolId = new Types.ObjectId(job.data.poolId);

    // Run concurrently — contributor count and badges are independent.
    await Promise.all([
      this.updateContributorCount(userId, donationId, poolId),
      this.assignBadges(userId, donationId),
    ]);
  }

  /**
   * First-time contribution guard.
   *
   * Uses the existing compound index { donationPoolId: 1, userId: 1 }.
   * Excludes the current donation from the count so that a user's very
   * first donation (count === 0 excluding self) triggers exactly one $inc.
   *
   * Why this is safe against inflation:
   * - Replay of the same order: orderId unique index prevents a second
   *   UserDonation document → createDonation returns before enqueuing →
   *   this job is never queued for the same donation twice.
   * - Two concurrent NEW orders from same user: each job sees the other's
   *   donation (already committed before the job runs) so at most one of
   *   them sees otherContributions === 0 and increments.
   */
  private async updateContributorCount(
    userId: Types.ObjectId,
    donationId: Types.ObjectId,
    poolId: Types.ObjectId,
  ): Promise<void> {
    try {
      const otherContributions = await this.userDonationModel.countDocuments({
        userId,
        donationPoolId: poolId,
        _id: { $ne: donationId },
      });

      if (otherContributions === 0) {
        await this.donationPoolModel.findByIdAndUpdate(poolId, {
          $inc: { contributorCount: 1 },
        });
      }
    } catch (error) {
      this.logger.error(`Failed to update contributor count for pool ${poolId}`, error);
      throw error; // re-throw so Bull retries the job
    }
  }

  /**
   * Badge assignment based on user's cumulative donation history.
   * Non-critical: errors are logged but do not trigger a retry.
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
