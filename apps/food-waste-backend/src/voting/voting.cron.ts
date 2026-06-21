import { CycleStatus } from '@foodwaste/shared';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';

import { VotingCycle, type VotingCycleDocument } from './schemas/voting-cycle.schema';
import { VotingService } from './voting.service';

@Injectable()
export class VotingCron {
  private readonly logger = new Logger(VotingCron.name);

  constructor(
    @InjectModel(VotingCycle.name) private readonly cycleModel: Model<VotingCycleDocument>,
    private readonly votingService: VotingService,
  ) {}

  @Cron('*/5 * * * *')
  async checkCommunityGoal(): Promise<void> {
    try {
      const activeCycle = await this.cycleModel.findOne({ status: CycleStatus.ACTIVE });
      if (!activeCycle) {
        return;
      }

      const now = new Date();

      // Check expiry first: cycleEndDate passed and goal not met
      if (now >= activeCycle.cycleEndDate) {
        const expired = await this.votingService.expireCycle(
          (activeCycle._id as import('mongoose').Types.ObjectId).toString(),
        );
        if (expired) {
          this.logger.log(`Cycle ${activeCycle.name} expired — goal not met by end date`);
        }
        return;
      }

      // Check if community goal is met
      if (activeCycle.communityGoalProgress >= activeCycle.communityGoalTarget) {
        const cycleId = (activeCycle._id as import('mongoose').Types.ObjectId).toString();
        const opened = await this.votingService.openBallot(cycleId);
        if (opened) {
          this.logger.log(`Ballot opened for cycle ${activeCycle.name}`);

          try {
            const count = await this.votingService.createEligibilitySnapshots(cycleId);
            this.logger.log(`Created ${count} eligibility snapshots for cycle ${activeCycle.name}`);
          } catch (snapshotError) {
            this.logger.error(
              `Snapshot creation failed for cycle ${cycleId}: ${snapshotError instanceof Error ? snapshotError.message : 'Unknown error'}`,
              snapshotError instanceof Error ? snapshotError.stack : undefined,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Community goal check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  @Cron('* * * * *')
  async checkBallotClose(): Promise<void> {
    try {
      const now = new Date();
      const openCycle = await this.cycleModel.findOne({
        status: CycleStatus.BALLOT_OPEN,
        ballotClosesAt: { $lte: now },
      });

      if (!openCycle) {
        return;
      }

      const cycleId = (openCycle._id as import('mongoose').Types.ObjectId).toString();
      const completed = await this.votingService.closeBallotAndTally(cycleId);
      if (completed) {
        this.logger.log(`Ballot closed and tally completed for cycle ${openCycle.name}`);
      }
    } catch (error) {
      this.logger.error(
        `Ballot close check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  @Cron('*/5 * * * *')
  async retryFailedSnapshots(): Promise<void> {
    try {
      const cycle = await this.cycleModel.findOne({
        status: CycleStatus.BALLOT_OPEN,
        snapshotReady: false,
      });

      if (!cycle) {
        return;
      }

      const cycleId = (cycle._id as import('mongoose').Types.ObjectId).toString();
      this.logger.warn(`Retrying snapshot creation for cycle ${cycle.name}`);

      try {
        const count = await this.votingService.createEligibilitySnapshots(cycleId);
        this.logger.log(`Snapshot retry succeeded: ${count} users for cycle ${cycle.name}`);
      } catch (error) {
        this.logger.error(
          `Snapshot retry failed for cycle ${cycleId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    } catch (error) {
      this.logger.error(
        `Snapshot retry check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
