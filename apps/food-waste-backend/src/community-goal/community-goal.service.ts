import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { WebSocketEvents, WEBSOCKET_ROOMS } from '../websocket/interfaces/websocket.interface';
import { WebSocketService } from '../websocket/websocket.service';

import {
  CommunityBagGoal,
  CommunityBagGoalDocument,
  CommunityGoalStatus,
} from './schemas/community-bag-goal.schema';

import type { CommunityBagGoalStats } from '@foodwaste/shared';

const DEFAULT_TARGET = 8000;

/** Lean (POJO) representation returned by .lean() or .toObject() */
interface GoalLean {
  _id?: unknown;
  currentCount: number;
  targetCount: number;
  cycleNumber: number;
  status: string;
  createdBy?: unknown;
  completedAt?: Date;
  resetAt?: Date;
  updatedAt?: Date;
  createdAt?: Date;
}

@Injectable()
export class CommunityGoalService {
  private readonly logger = new Logger(CommunityGoalService.name);

  constructor(
    @InjectModel(CommunityBagGoal.name)
    private readonly goalModel: Model<CommunityBagGoalDocument>,
    private readonly webSocketService: WebSocketService,
  ) {}

  /**
   * Get current community goal stats.
   * Creates a default goal (target: 8000) on first call if none exists.
   */
  async getStats(): Promise<CommunityBagGoalStats> {
    let goal: GoalLean | null = await this.goalModel
      .findOne({ status: CommunityGoalStatus.ACTIVE })
      .lean<GoalLean>()
      .exec();

    if (!goal) {
      goal = await this.createDefaultGoal();
    }

    return this.toStats(goal);
  }

  /**
   * Atomic increment of bag count on the active goal.
   * If the goal is reached, completes current cycle and starts a new one.
   * Broadcasts updated stats via WebSocket after every increment.
   */
  async incrementBagCount(count: number): Promise<CommunityBagGoalStats> {
    if (count <= 0) {
      this.logger.warn(`Invalid bag count increment: ${count}`);
      return this.getStats();
    }

    // Atomic $inc — safe under concurrent writes
    const updatedGoal = (await this.goalModel
      .findOneAndUpdate(
        { status: CommunityGoalStatus.ACTIVE },
        { $inc: { currentCount: count } },
        { new: true, lean: true },
      )
      .exec()) as GoalLean | null;

    if (!updatedGoal) {
      this.logger.warn('No active goal found during increment, creating default');
      await this.createDefaultGoal();
      return this.incrementBagCount(count);
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
   * Admin: Set a new target on the active goal.
   */
  async setGoalTarget(targetCount: number, adminId: string): Promise<CommunityBagGoalStats> {
    const goal = (await this.goalModel
      .findOneAndUpdate(
        { status: CommunityGoalStatus.ACTIVE },
        { $set: { targetCount } },
        { new: true, lean: true },
      )
      .exec()) as GoalLean | null;

    if (!goal) {
      const newGoal = await this.goalModel.create({
        currentCount: 0,
        targetCount,
        cycleNumber: 1,
        status: CommunityGoalStatus.ACTIVE,
        createdBy: adminId,
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
  async resetGoal(adminId: string): Promise<CommunityBagGoalStats> {
    const goal = (await this.goalModel
      .findOneAndUpdate(
        { status: CommunityGoalStatus.ACTIVE },
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
  async getHistory(
    page = 1,
    limit = 20,
  ): Promise<{ goals: CommunityBagGoalStats[]; total: number }> {
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
      goals: goals.map((g) => this.toStats(g)),
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
  private async completeAndResetGoal(completedGoal: GoalLean): Promise<CommunityBagGoalStats> {
    // Atomically mark as COMPLETED (only if still ACTIVE)
    const transitioned = (await this.goalModel
      .findOneAndUpdate(
        { _id: completedGoal._id, status: CommunityGoalStatus.ACTIVE },
        {
          $set: {
            status: CommunityGoalStatus.COMPLETED,
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

    const newGoal = await this.goalModel.create({
      currentCount: overflow,
      targetCount: transitioned.targetCount,
      cycleNumber: transitioned.cycleNumber + 1,
      status: CommunityGoalStatus.ACTIVE,
    });

    this.logger.log(
      `Goal cycle ${transitioned.cycleNumber} completed! New cycle ${newGoal.cycleNumber} started (overflow: ${overflow})`,
    );

    // Broadcast goal completion event
    this.webSocketService.sendToRoom(
      WEBSOCKET_ROOMS['GLOBAL']!.name,
      WebSocketEvents.COMMUNITY_GOAL_COMPLETED,
      this.toStats(transitioned),
    );

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
      status: CommunityGoalStatus.ACTIVE,
    });

    this.logger.log('Created default community bag goal');
    return goal.toObject() as GoalLean;
  }

  private toStats(goal: GoalLean): CommunityBagGoalStats {
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
      status: goal.status as CommunityBagGoalStats['status'],
      lastUpdatedAt: (goal.updatedAt ?? new Date()).toISOString(),
    };
  }

  private broadcastUpdate(stats: CommunityBagGoalStats): void {
    this.webSocketService.sendToRoom(
      WEBSOCKET_ROOMS['GLOBAL']!.name,
      WebSocketEvents.COMMUNITY_BAG_UPDATED,
      stats,
    );
  }
}
