import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { LoyaltyService } from '../loyalty/loyalty.service';
import { WebSocketEvents, WEBSOCKET_ROOMS } from '../websocket/interfaces/websocket.interface';
import { WebSocketService } from '../websocket/websocket.service';

import {
  MonthlyBagGoal,
  MonthlyBagGoalDocument,
  MonthlyGoalStatus,
  MonthlyGoalCauseType,
} from './schemas/community-bag-goal.schema';

import type { MonthlyBagGoalStats } from '@foodwaste/shared';

const DEFAULT_TARGET = 8000;

/** Lean (POJO) representation returned by .lean() or .toObject() */
interface GoalLean {
  _id?: unknown;
  currentCount: number;
  targetCount: number;
  cycleNumber: number;
  status: string;
  causeType?: MonthlyGoalCauseType;
  causeTitle?: string;
  causeDescription?: string;
  rewardPoints?: number;
  seasonName?: string;
  endDate?: Date;
  participantIds?: { toString(): string }[];
  createdBy?: unknown;
  completedAt?: Date;
  resetAt?: Date;
  updatedAt?: Date;
  createdAt?: Date;
}

@Injectable()
export class MonthlyBagGoalService {
  private readonly logger = new Logger(MonthlyBagGoalService.name);

  constructor(
    @InjectModel(MonthlyBagGoal.name)
    private readonly goalModel: Model<MonthlyBagGoalDocument>,
    private readonly webSocketService: WebSocketService,
    @Inject(forwardRef(() => LoyaltyService))
    private readonly loyaltyService: LoyaltyService,
  ) {}

  /**
   * Get current community goal stats.
   * Creates a default goal (target: 8000) on first call if none exists.
   */
  async getStats(): Promise<MonthlyBagGoalStats> {
    let goal: GoalLean | null = await this.goalModel
      .findOne({ status: MonthlyGoalStatus.ACTIVE })
      .lean<GoalLean>()
      .exec();

    goal ??= await this.createDefaultGoal();

    return this.toStats(goal);
  }

  /**
   * Atomic increment of bag count on the active goal.
   * If the goal is reached, completes current cycle and starts a new one.
   * Broadcasts updated stats via WebSocket after every increment.
   */
  async incrementBagCount(count: number, userId?: string): Promise<MonthlyBagGoalStats> {
    if (count <= 0) {
      this.logger.warn(`Invalid bag count increment: ${count}`);
      return this.getStats();
    }

    // Build update ops — track participant if userId provided
    const updateOps: Record<string, unknown> = { $inc: { currentCount: count } };
    if (userId) {
      (updateOps as Record<string, unknown>)['$addToSet'] = { participantIds: userId };
    }

    // Atomic update — safe under concurrent writes
    const updatedGoal = (await this.goalModel
      .findOneAndUpdate({ status: MonthlyGoalStatus.ACTIVE }, updateOps, {
        new: true,
        lean: true,
      })
      .exec()) as GoalLean | null;

    if (!updatedGoal) {
      this.logger.warn('No active goal found during increment, creating default');
      await this.createDefaultGoal();
      return this.incrementBagCount(count, userId);
    }

    // Check if goal was reached
    if (updatedGoal.currentCount >= updatedGoal.targetCount) {
      return this.completeAndResetGoal(updatedGoal);
    }

    const stats = this.toStats(updatedGoal);
    this.broadcastUpdate(stats);
    return stats;
  }

  /**
   * Admin: Set a new target and optional cause on the active goal.
   */
  async setGoalTarget(
    targetCount: number,
    adminId: string,
    cause?: {
      causeType?: MonthlyGoalCauseType;
      causeTitle?: string;
      causeDescription?: string;
      rewardPoints?: number;
      seasonName?: string;
      endDate?: string;
    },
  ): Promise<MonthlyBagGoalStats> {
    const updateFields = {
      ...(cause?.causeType !== undefined && { causeType: cause.causeType }),
      ...(cause?.causeTitle !== undefined && { causeTitle: cause.causeTitle }),
      ...(cause?.causeDescription !== undefined && { causeDescription: cause.causeDescription }),
      ...(cause?.rewardPoints !== undefined && { rewardPoints: cause.rewardPoints }),
      ...(cause?.seasonName !== undefined && { seasonName: cause.seasonName }),
      ...(cause?.endDate !== undefined && { endDate: new Date(cause.endDate) }),
    };

    const goal = (await this.goalModel
      .findOneAndUpdate(
        { status: MonthlyGoalStatus.ACTIVE },
        { $set: { targetCount, ...updateFields } },
        { new: true, lean: true },
      )
      .exec()) as GoalLean | null;

    if (!goal) {
      const newGoal = await this.goalModel.create({
        currentCount: 0,
        targetCount,
        cycleNumber: 1,
        status: MonthlyGoalStatus.ACTIVE,
        createdBy: adminId,
        ...updateFields,
      });
      return this.toStats(newGoal.toObject() as GoalLean);
    }

    this.logger.log(`Admin ${adminId} updated goal target to ${targetCount}`);

    const stats = this.toStats(goal);
    this.broadcastUpdate(stats);
    return stats;
  }

  /**
   * Admin: Reset the current count to 0 on the active goal.
   */
  async resetGoal(adminId: string): Promise<MonthlyBagGoalStats> {
    const goal = (await this.goalModel
      .findOneAndUpdate(
        { status: MonthlyGoalStatus.ACTIVE },
        { $set: { currentCount: 0, resetAt: new Date() } },
        { new: true, lean: true },
      )
      .exec()) as GoalLean | null;

    if (!goal) {
      this.logger.warn('No active goal to reset');
      return this.getStats();
    }

    this.logger.log(`Admin ${adminId} reset community goal`);

    const stats = this.toStats(goal);
    this.broadcastUpdate(stats);
    return stats;
  }

  /**
   * Admin: Get goal history (all cycles).
   */
  async getHistory(page = 1, limit = 20): Promise<{ goals: MonthlyBagGoalStats[]; total: number }> {
    const skip = (page - 1) * limit;

    const [goals, total] = await Promise.all([
      this.goalModel
        .find()
        .sort({ cycleNumber: -1 })
        .skip(skip)
        .limit(limit)
        .lean<GoalLean[]>()
        .exec(),
      this.goalModel.countDocuments().exec(),
    ]);

    return {
      goals: goals.map(g => this.toStats(g)),
      total,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────

  /**
   * Complete the current goal cycle and create a new one.
   * Uses conditional findOneAndUpdate to prevent race conditions —
   * only one concurrent writer wins the ACTIVE → COMPLETED transition.
   * Overflow bags carry over to the new cycle.
   */
  private async completeAndResetGoal(completedGoal: GoalLean): Promise<MonthlyBagGoalStats> {
    // Atomically mark as COMPLETED (only if still ACTIVE)
    const transitioned = (await this.goalModel
      .findOneAndUpdate(
        { _id: completedGoal._id, status: MonthlyGoalStatus.ACTIVE },
        {
          $set: {
            status: MonthlyGoalStatus.COMPLETED,
            completedAt: new Date(),
          },
        },
        { new: true, lean: true },
      )
      .exec()) as GoalLean | null;

    // Another writer already transitioned — just return current stats
    if (!transitioned) {
      return this.getStats();
    }

    // Carry over overflow bags
    const overflow = Math.max(0, transitioned.currentCount - transitioned.targetCount);

    // ── Distribute reward points to all participants ──
    const rewardPoints = transitioned.rewardPoints ?? 0;
    const participantIds = transitioned.participantIds ?? [];

    if (rewardPoints > 0 && participantIds.length > 0) {
      this.logger.log(
        `Distributing ${rewardPoints} points to ${participantIds.length} participants for cycle ${transitioned.cycleNumber}`,
      );

      const results = await Promise.allSettled(
        participantIds.map(async id => {
          const account = await this.loyaltyService.addPoints(id.toString(), {
            amount: rewardPoints,
            reason: `Community challenge cycle ${transitioned.cycleNumber} completed`,
          });
          return account;
        }),
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      this.logger.log(`Reward distribution complete: ${succeeded} succeeded, ${failed} failed`);
    }

    const newGoal = await this.goalModel.create({
      currentCount: overflow,
      targetCount: transitioned.targetCount,
      cycleNumber: transitioned.cycleNumber + 1,
      status: MonthlyGoalStatus.ACTIVE,
      rewardPoints: transitioned.rewardPoints,
      seasonName: transitioned.seasonName,
    });

    this.logger.log(
      `Goal cycle ${transitioned.cycleNumber} completed! New cycle ${newGoal.cycleNumber} started (overflow: ${overflow})`,
    );

    // Broadcast goal completion event
    const globalRoom = WEBSOCKET_ROOMS['GLOBAL'];
    if (globalRoom) {
      this.webSocketService.sendToRoom(
        globalRoom.name,
        WebSocketEvents.COMMUNITY_GOAL_COMPLETED,
        this.toStats(transitioned),
      );
    }

    // Broadcast new goal stats
    const newStats = this.toStats(newGoal.toObject() as GoalLean);
    this.broadcastUpdate(newStats);
    return newStats;
  }

  private async createDefaultGoal(): Promise<GoalLean> {
    const goal = await this.goalModel.create({
      currentCount: 0,
      targetCount: DEFAULT_TARGET,
      cycleNumber: 1,
      status: MonthlyGoalStatus.ACTIVE,
    });

    this.logger.log('Created default community bag goal');
    return goal.toObject() as GoalLean;
  }

  private toStats(goal: GoalLean): MonthlyBagGoalStats {
    const progressPercentage =
      goal.targetCount > 0
        ? Math.min(100, parseFloat(((goal.currentCount / goal.targetCount) * 100).toFixed(2)))
        : 0;

    return {
      currentCount: goal.currentCount,
      targetCount: goal.targetCount,
      progressPercentage,
      remaining: Math.max(0, goal.targetCount - goal.currentCount),
      cycleNumber: goal.cycleNumber,
      status: goal.status as MonthlyBagGoalStats['status'],
      lastUpdatedAt: (goal.updatedAt ?? new Date()).toISOString(),
      // Cause fields are optional — omit rather than null so legacy goals stay clean
      ...(goal.causeType !== undefined && { causeType: goal.causeType }),
      ...(goal.causeTitle !== undefined && { causeTitle: goal.causeTitle }),
      ...(goal.causeDescription !== undefined && { causeDescription: goal.causeDescription }),
      ...(goal.rewardPoints !== undefined && { rewardPoints: goal.rewardPoints }),
      ...(goal.seasonName !== undefined && { seasonName: goal.seasonName }),
      ...(goal.endDate !== undefined && { endDate: goal.endDate.toISOString() }),
      participantCount: goal.participantIds?.length ?? 0,
    };
  }

  private broadcastUpdate(stats: MonthlyBagGoalStats): void {
    const globalRoom = WEBSOCKET_ROOMS['GLOBAL'];
    if (globalRoom) {
      this.webSocketService.sendToRoom(
        globalRoom.name,
        WebSocketEvents.COMMUNITY_BAG_UPDATED,
        stats,
      );
    }
  }
}
