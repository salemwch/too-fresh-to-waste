import { CycleStatus } from '@foodwaste/shared';
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  LoyaltyAccount,
  type LoyaltyAccountDocument,
} from '../loyalty/schemas/loyalty-account.schema';

import { CastVoteDto } from './dto/cast-vote.dto';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { UpdateCycleDto } from './dto/update-cycle.dto';
import { VotingPrizeService } from './services/voting-prize.service';
import {
  BALLOT_DURATION_MS,
  VOTING_COUNTER_ID,
  VOTING_ERROR_CODES,
  VOTING_AUDIT_ACTIONS,
} from './voting.constants';
import { Counter, type CounterDocument } from './schemas/counter.schema';
import { Vote, type VoteDocument } from './schemas/vote.schema';
import { VotingAuditLog, type VotingAuditLogDocument } from './schemas/voting-audit-log.schema';
import { VotingCycle, type VotingCycleDocument } from './schemas/voting-cycle.schema';
import {
  VotingEligibility,
  type VotingEligibilityDocument,
} from './schemas/voting-eligibility.schema';

// ── Result / Stats payload types ─────────────────────────────────────────────

export interface PrizeTallyRow {
  prizeId: string;
  name: string;
  totalWeightedVotes: number;
  voterCount: number;
}

export interface ResultsPayload {
  results: PrizeTallyRow[];
  totalVoters: number;
  totalEligible: number;
}

export interface StatsPayload extends ResultsPayload {
  participationRate: number;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class VotingService {
  private readonly logger = new Logger(VotingService.name);

  constructor(
    @InjectModel(VotingCycle.name)
    private readonly cycleModel: Model<VotingCycleDocument>,
    @InjectModel(Vote.name)
    private readonly voteModel: Model<VoteDocument>,
    @InjectModel(VotingEligibility.name)
    private readonly eligibilityModel: Model<VotingEligibilityDocument>,
    @InjectModel(VotingAuditLog.name)
    private readonly auditLogModel: Model<VotingAuditLogDocument>,
    @InjectModel(Counter.name)
    private readonly counterModel: Model<CounterDocument>,
    @InjectModel(LoyaltyAccount.name)
    private readonly loyaltyModel: Model<LoyaltyAccountDocument>,
    private readonly votingPrizeService: VotingPrizeService,
  ) {}

  // ── Audit helper ──────────────────────────────────────────────────────────

  private async writeAuditLog(
    cycleId: Types.ObjectId,
    action: string,
    fromStatus: string,
    toStatus: string,
    performedBy?: string,
  ): Promise<void> {
    await this.auditLogModel.create({
      cycleId,
      action,
      fromStatus,
      toStatus,
      ...(performedBy ? { performedBy: new Types.ObjectId(performedBy) } : {}),
    });
  }

  // ── Cycle CRUD ────────────────────────────────────────────────────────────

  async createCycle(dto: CreateCycleDto, adminId: string): Promise<VotingCycleDocument> {
    const counter = await this.counterModel.findOneAndUpdate(
      { _id: VOTING_COUNTER_ID },
      { $inc: { seq: 1 } },
      { upsert: true, new: true },
    );

    const cycle = await this.cycleModel.create({
      name: dto.name,
      cycleStartDate: new Date(dto.cycleStartDate),
      cycleEndDate: new Date(dto.cycleEndDate),
      communityGoalTarget: dto.communityGoalTarget,
      minimumBags: dto.minimumBags,
      recipientCount: dto.recipientCount,
      prizes: dto.prizes,
      cycleNumber: counter?.seq ?? 1,
      status: CycleStatus.DRAFT,
      createdBy: new Types.ObjectId(adminId),
    });

    return cycle;
  }

  async updateCycle(cycleId: string, dto: UpdateCycleDto): Promise<VotingCycleDocument> {
    const cycle = await this.cycleModel.findById(cycleId);
    if (!cycle) {
      throw new NotFoundException('Voting cycle not found');
    }

    const lockedAfterDraft: (keyof UpdateCycleDto)[] = [
      'prizes',
      'minimumBags',
      'communityGoalTarget',
      'cycleStartDate',
    ];
    const lockedAfterBallot: (keyof UpdateCycleDto)[] = [
      ...lockedAfterDraft,
      'cycleEndDate',
      'recipientCount',
    ];

    const fieldsToCheck =
      cycle.status === CycleStatus.DRAFT
        ? []
        : cycle.status === CycleStatus.ACTIVE
          ? lockedAfterDraft
          : lockedAfterBallot;

    for (const field of fieldsToCheck) {
      if (dto[field] !== undefined) {
        throw new BadRequestException({
          statusCode: 400,
          error: VOTING_ERROR_CODES.FIELD_LOCKED_AFTER_ACTIVATION,
          message: `Field '${field}' cannot be modified in ${cycle.status} status`,
        });
      }
    }

    const updateFields: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      updateFields['name'] = dto.name;
    }
    if (dto.cycleStartDate !== undefined) {
      updateFields['cycleStartDate'] = new Date(dto.cycleStartDate);
    }
    if (dto.cycleEndDate !== undefined) {
      updateFields['cycleEndDate'] = new Date(dto.cycleEndDate);
    }
    if (dto.communityGoalTarget !== undefined) {
      updateFields['communityGoalTarget'] = dto.communityGoalTarget;
    }
    if (dto.minimumBags !== undefined) {
      updateFields['minimumBags'] = dto.minimumBags;
    }
    if (dto.recipientCount !== undefined) {
      updateFields['recipientCount'] = dto.recipientCount;
    }
    if (dto.prizes !== undefined) {
      updateFields['prizes'] = dto.prizes;
    }

    const updated = await this.cycleModel.findByIdAndUpdate(
      cycleId,
      { $set: updateFields },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('Voting cycle not found');
    }
    return updated;
  }

  async deleteCycle(cycleId: string): Promise<void> {
    const cycle = await this.cycleModel.findById(cycleId);
    if (!cycle) {
      throw new NotFoundException('Voting cycle not found');
    }
    if (cycle.status !== CycleStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT cycles can be deleted');
    }
    await this.cycleModel.deleteOne({ _id: cycle._id });
  }

  async listCycles(
    page: number,
    limit: number,
  ): Promise<{ cycles: VotingCycleDocument[]; total: number }> {
    const [cycles, total] = await Promise.all([
      this.cycleModel
        .find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.cycleModel.countDocuments(),
    ]);
    return { cycles, total };
  }

  // ── State transitions ─────────────────────────────────────────────────────

  async activateCycle(cycleId: string, adminId: string): Promise<VotingCycleDocument> {
    const updated = await this.cycleModel.findOneAndUpdate(
      { _id: new Types.ObjectId(cycleId), status: CycleStatus.DRAFT },
      { $set: { status: CycleStatus.ACTIVE, isLive: true } },
      { new: true },
    );

    if (!updated) {
      const exists = await this.cycleModel.findById(cycleId);
      if (!exists) {
        throw new NotFoundException('Voting cycle not found');
      }
      if (exists.status !== CycleStatus.DRAFT) {
        throw new BadRequestException(`Cycle is ${exists.status}, not DRAFT`);
      }
      throw new ConflictException('Another live cycle already exists');
    }

    await this.writeAuditLog(
      updated._id as Types.ObjectId,
      VOTING_AUDIT_ACTIONS.ACTIVATE,
      CycleStatus.DRAFT,
      CycleStatus.ACTIVE,
      adminId,
    );

    // Seed communityGoalProgress if cycleStartDate is in the past
    if (updated.cycleStartDate < new Date()) {
      const seedCount = await this.aggregateBagCountForCycle(updated.cycleStartDate, new Date());
      if (seedCount > 0) {
        await this.cycleModel.updateOne(
          { _id: updated._id },
          { $inc: { communityGoalProgress: seedCount } },
        );
      }
    }

    return updated;
  }

  async openBallot(cycleId: string): Promise<VotingCycleDocument | null> {
    const now = new Date();
    const updated = await this.cycleModel.findOneAndUpdate(
      { _id: new Types.ObjectId(cycleId), status: CycleStatus.ACTIVE },
      {
        $set: {
          status: CycleStatus.BALLOT_OPEN,
          communityGoalMetAt: now,
          ballotOpensAt: now,
          ballotClosesAt: new Date(now.getTime() + BALLOT_DURATION_MS),
          snapshotReady: false,
        },
      },
      { new: true },
    );

    if (!updated) {
      return null;
    }

    await this.writeAuditLog(
      updated._id as Types.ObjectId,
      VOTING_AUDIT_ACTIONS.OPEN_BALLOT,
      CycleStatus.ACTIVE,
      CycleStatus.BALLOT_OPEN,
    );

    return updated;
  }

  async closeBallotAndTally(cycleId: string): Promise<VotingCycleDocument | null> {
    const tallyTransition = await this.cycleModel.findOneAndUpdate(
      { _id: new Types.ObjectId(cycleId), status: CycleStatus.BALLOT_OPEN },
      { $set: { status: CycleStatus.TALLYING } },
      { new: true },
    );

    if (!tallyTransition) {
      return null;
    }

    await this.writeAuditLog(
      tallyTransition._id as Types.ObjectId,
      VOTING_AUDIT_ACTIONS.CLOSE_BALLOT,
      CycleStatus.BALLOT_OPEN,
      CycleStatus.TALLYING,
    );

    return this.runTally(cycleId);
  }

  async expireCycle(cycleId: string): Promise<VotingCycleDocument | null> {
    const updated = await this.cycleModel.findOneAndUpdate(
      { _id: new Types.ObjectId(cycleId), status: CycleStatus.ACTIVE },
      { $set: { status: CycleStatus.EXPIRED, isLive: null } },
      { new: true },
    );

    if (!updated) {
      return null;
    }

    await this.writeAuditLog(
      updated._id as Types.ObjectId,
      VOTING_AUDIT_ACTIONS.EXPIRE,
      CycleStatus.ACTIVE,
      CycleStatus.EXPIRED,
    );

    return updated;
  }

  async archiveCycle(cycleId: string, adminId: string): Promise<VotingCycleDocument> {
    // Read the current status before the transition so we can record the correct fromStatus
    const before = await this.cycleModel.findOne({
      _id: new Types.ObjectId(cycleId),
      status: { $in: [CycleStatus.COMPLETED, CycleStatus.EXPIRED] },
    });

    if (!before) {
      const exists = await this.cycleModel.findById(cycleId);
      if (!exists) {
        throw new NotFoundException('Voting cycle not found');
      }
      throw new BadRequestException(`Cannot archive cycle in ${exists.status} status`);
    }

    const fromStatus = before.status;

    const updated = await this.cycleModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(cycleId),
        status: { $in: [CycleStatus.COMPLETED, CycleStatus.EXPIRED] },
      },
      { $set: { status: CycleStatus.ARCHIVED } },
      { new: true },
    );

    if (!updated) {
      throw new ConflictException('Archive transition failed due to concurrent update');
    }

    await this.writeAuditLog(
      updated._id as Types.ObjectId,
      VOTING_AUDIT_ACTIONS.ARCHIVE,
      fromStatus,
      CycleStatus.ARCHIVED,
      adminId,
    );

    return updated;
  }

  // ── Tally ─────────────────────────────────────────────────────────────────

  private async runTally(cycleId: string): Promise<VotingCycleDocument> {
    const results = await this.voteModel.aggregate<{
      _id: Types.ObjectId;
      totalWeightedVotes: number;
      voterCount: number;
    }>([
      { $match: { cycleId: new Types.ObjectId(cycleId) } },
      {
        $group: {
          _id: '$prizeId',
          totalWeightedVotes: { $sum: '$pointsSnapshot' },
          voterCount: { $sum: 1 },
        },
      },
      { $sort: { totalWeightedVotes: -1, voterCount: -1, _id: 1 } },
    ]);

    const cycle = await this.cycleModel.findById(cycleId);
    if (!cycle) {
      throw new NotFoundException('Voting cycle not found');
    }

    let winnerUpdate: Record<string, unknown>;

    if (results.length === 0) {
      winnerUpdate = {
        status: CycleStatus.COMPLETED,
        isLive: null,
      };
    } else {
      // results.length > 0 is guaranteed by the outer `if` branch
      const topResult = results[0] as NonNullable<(typeof results)[0]>;
      const winningPrizeId = topResult._id;
      const winningPrize = cycle.prizes.find(p => p._id.toString() === winningPrizeId.toString());

      winnerUpdate = {
        status: CycleStatus.COMPLETED,
        isLive: null,
        winner: {
          prizeId: winningPrizeId,
          name: winningPrize?.name ?? 'Unknown Prize',
          totalWeightedVotes: topResult.totalWeightedVotes,
          voterCount: topResult.voterCount,
          announcedAt: new Date(),
        },
        winnerPrizeId: winningPrizeId,
      };
    }

    const completed = await this.cycleModel.findOneAndUpdate(
      { _id: new Types.ObjectId(cycleId), status: CycleStatus.TALLYING },
      { $set: winnerUpdate },
      { new: true },
    );

    if (!completed) {
      throw new BadRequestException('Cycle is no longer in TALLYING status');
    }

    await this.writeAuditLog(
      completed._id as Types.ObjectId,
      VOTING_AUDIT_ACTIONS.TALLY,
      CycleStatus.TALLYING,
      CycleStatus.COMPLETED,
    );

    if (completed.winnerPrizeId) {
      void this.votingPrizeService.notifyWinners(
        (completed._id as Types.ObjectId).toString(),
        completed.winnerPrizeId,
        completed.recipientCount,
        completed.winner?.name ?? 'the winning prize',
      );
    }

    return completed;
  }

  async manualTally(cycleId: string, adminId: string): Promise<VotingCycleDocument> {
    const cycle = await this.cycleModel.findById(cycleId);
    if (!cycle) {
      throw new NotFoundException('Voting cycle not found');
    }

    if (cycle.status === CycleStatus.COMPLETED) {
      return cycle;
    }

    if (cycle.status !== CycleStatus.TALLYING) {
      throw new BadRequestException(`Cannot tally cycle in ${cycle.status} status`);
    }

    const result = await this.runTally(cycleId);

    await this.writeAuditLog(
      result._id as Types.ObjectId,
      VOTING_AUDIT_ACTIONS.MANUAL_TALLY,
      CycleStatus.TALLYING,
      CycleStatus.COMPLETED,
      adminId,
    );

    return result;
  }

  // ── Snapshots ─────────────────────────────────────────────────────────────

  async createEligibilitySnapshots(cycleId: string): Promise<number> {
    const cycle = await this.cycleModel.findById(cycleId);
    if (!cycle) {
      throw new NotFoundException('Voting cycle not found');
    }

    const eligibleUsers = await this.getEligibleUsersForCycle(
      cycle.cycleStartDate,
      cycle.ballotOpensAt ?? new Date(),
      cycle.minimumBags,
    );

    if (eligibleUsers.length === 0) {
      await this.cycleModel.updateOne({ _id: cycle._id }, { $set: { snapshotReady: true } });
      return 0;
    }

    const userIds = eligibleUsers.map(u => u.userId);
    const loyaltyAccounts = await this.loyaltyModel.find(
      { userId: { $in: userIds } },
      { userId: 1, availablePoints: 1 },
    );

    const pointsMap = new Map<string, number>();
    for (const account of loyaltyAccounts) {
      pointsMap.set(account.userId.toString(), account.availablePoints);
    }

    const snapshotAt = cycle.ballotOpensAt ?? new Date();

    await this.eligibilityModel.bulkWrite(
      eligibleUsers.map(u => ({
        updateOne: {
          filter: {
            cycleId: cycle._id as Types.ObjectId,
            userId: u.userId,
          },
          update: {
            $setOnInsert: {
              cycleId: cycle._id,
              userId: u.userId,
              bagsSavedInCycle: u.bags,
              pointsSnapshot: pointsMap.get(u.userId.toString()) ?? 0,
              snapshotAt,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );

    await this.cycleModel.updateOne({ _id: cycle._id }, { $set: { snapshotReady: true } });

    this.logger.log(
      `Created eligibility snapshots for ${eligibleUsers.length} users in cycle ${cycleId}`,
    );
    return eligibleUsers.length;
  }

  async retrySnapshot(cycleId: string, adminId: string): Promise<number> {
    const cycle = await this.cycleModel.findById(cycleId);
    if (!cycle) {
      throw new NotFoundException('Voting cycle not found');
    }
    if (cycle.status !== CycleStatus.BALLOT_OPEN || cycle.snapshotReady) {
      throw new BadRequestException(
        'Snapshot retry only available for BALLOT_OPEN cycles with snapshotReady=false',
      );
    }

    const count = await this.createEligibilitySnapshots(cycleId);

    await this.writeAuditLog(
      cycle._id as Types.ObjectId,
      VOTING_AUDIT_ACTIONS.RETRY_SNAPSHOT,
      CycleStatus.BALLOT_OPEN,
      CycleStatus.BALLOT_OPEN,
      adminId,
    );

    return count;
  }

  private async getEligibleUsersForCycle(
    cycleStartDate: Date,
    ballotOpensAt: Date,
    minimumBags: number,
  ): Promise<Array<{ userId: Types.ObjectId; bags: number }>> {
    const results = await this.loyaltyModel.aggregate<{
      _id: Types.ObjectId;
      bagsSavedInCycle: number;
    }>([
      { $unwind: '$pointsHistory' },
      {
        $match: {
          'pointsHistory.orderId': { $exists: true, $ne: null },
          'pointsHistory.createdAt': {
            $gte: cycleStartDate,
            $lt: ballotOpensAt,
          },
        },
      },
      {
        $addFields: {
          bags: { $ifNull: ['$pointsHistory.bagCount', 1] },
        },
      },
      {
        $group: {
          _id: '$userId',
          bagsSavedInCycle: { $sum: '$bags' },
        },
      },
      { $match: { bagsSavedInCycle: { $gte: minimumBags } } },
    ]);

    return results.map(r => ({
      userId: r._id,
      bags: r.bagsSavedInCycle,
    }));
  }

  private async aggregateBagCountForCycle(cycleStartDate: Date, endDate: Date): Promise<number> {
    const results = await this.loyaltyModel.aggregate<{
      _id: null;
      totalBags: number;
    }>([
      { $unwind: '$pointsHistory' },
      {
        $match: {
          'pointsHistory.orderId': { $exists: true, $ne: null },
          'pointsHistory.createdAt': {
            $gte: cycleStartDate,
            $lt: endDate,
          },
        },
      },
      {
        $addFields: {
          bags: { $ifNull: ['$pointsHistory.bagCount', 1] },
        },
      },
      {
        $group: {
          _id: null,
          totalBags: { $sum: '$bags' },
        },
      },
    ]);

    return results[0]?.totalBags ?? 0;
  }

  // ── Voting ────────────────────────────────────────────────────────────────

  async castVote(userId: string, dto: CastVoteDto): Promise<VoteDocument> {
    const cycle = await this.cycleModel.findOne({
      isLive: true,
      status: CycleStatus.BALLOT_OPEN,
    });

    if (!cycle) {
      throw new NotFoundException(VOTING_ERROR_CODES.NO_ACTIVE_CYCLE);
    }

    if (!cycle.snapshotReady) {
      throw new ConflictException(VOTING_ERROR_CODES.SNAPSHOT_NOT_READY);
    }

    const now = new Date();
    if (!cycle.ballotOpensAt || !cycle.ballotClosesAt) {
      throw new BadRequestException(VOTING_ERROR_CODES.BALLOT_NOT_OPEN);
    }
    if (now < cycle.ballotOpensAt) {
      throw new BadRequestException(VOTING_ERROR_CODES.BALLOT_NOT_OPEN);
    }
    if (now >= cycle.ballotClosesAt) {
      throw new BadRequestException(VOTING_ERROR_CODES.BALLOT_CLOSED);
    }

    const prizeExists = cycle.prizes.some(p => p._id.toString() === dto.prizeId);
    if (!prizeExists) {
      throw new BadRequestException(VOTING_ERROR_CODES.INVALID_PRIZE);
    }

    const eligibility = await this.eligibilityModel.findOne({
      cycleId: cycle._id,
      userId: new Types.ObjectId(userId),
    });
    if (!eligibility) {
      throw new ForbiddenException(VOTING_ERROR_CODES.NOT_ELIGIBLE);
    }

    const existingVote = await this.voteModel.findOne({
      cycleId: cycle._id,
      userId: new Types.ObjectId(userId),
    });
    if (existingVote) {
      throw new ConflictException(VOTING_ERROR_CODES.ALREADY_VOTED);
    }

    try {
      const vote = await this.voteModel.create({
        cycleId: cycle._id,
        userId: new Types.ObjectId(userId),
        prizeId: new Types.ObjectId(dto.prizeId),
        pointsSnapshot: eligibility.pointsSnapshot,
        votedAt: now,
      });
      return vote;
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && (error as { code: number }).code === 11000) {
        throw new ConflictException(VOTING_ERROR_CODES.ALREADY_VOTED);
      }
      throw error;
    }
  }

  // ── User queries ──────────────────────────────────────────────────────────

  async getActiveCycle(userId: string): Promise<{
    cycle: VotingCycleDocument | null;
    eligibility: {
      canVote: boolean;
      reason?: string;
      userBagsInCycle: number;
      requiredBags: number;
      pointsSnapshot: number;
    } | null;
    myVote: VoteDocument | null;
  }> {
    const cycle = await this.cycleModel.findOne({ isLive: true });

    if (!cycle) {
      return { cycle: null, eligibility: null, myVote: null };
    }

    const userObjId = new Types.ObjectId(userId);
    const cycleId = cycle._id as Types.ObjectId;

    let userBagsInCycle = 0;
    let pointsSnapshot = 0;
    let canVote = false;
    let reason: string | undefined;

    if (
      cycle.status === CycleStatus.BALLOT_OPEN ||
      cycle.status === CycleStatus.COMPLETED ||
      cycle.status === CycleStatus.TALLYING
    ) {
      const elig = await this.eligibilityModel.findOne({
        cycleId,
        userId: userObjId,
      });

      if (elig) {
        userBagsInCycle = elig.bagsSavedInCycle;
        pointsSnapshot = elig.pointsSnapshot;

        if (cycle.status === CycleStatus.BALLOT_OPEN && cycle.snapshotReady) {
          const existingVote = await this.voteModel.findOne({
            cycleId,
            userId: userObjId,
          });
          if (existingVote) {
            reason = 'ALREADY_VOTED';
          } else {
            canVote = true;
          }
        } else if (cycle.status === CycleStatus.BALLOT_OPEN && !cycle.snapshotReady) {
          reason = 'SNAPSHOT_NOT_READY';
        } else {
          reason = 'BALLOT_NOT_OPEN';
        }
      } else {
        reason = 'NOT_ENOUGH_BAGS';
      }
    } else if (cycle.status === CycleStatus.ACTIVE) {
      // Live query for pre-ballot bag count
      const bagResults = await this.loyaltyModel.aggregate<{
        _id: null;
        totalBags: number;
      }>([
        { $match: { userId: userObjId } },
        { $unwind: '$pointsHistory' },
        {
          $match: {
            'pointsHistory.orderId': { $exists: true, $ne: null },
            'pointsHistory.createdAt': { $gte: cycle.cycleStartDate },
          },
        },
        {
          $addFields: {
            bags: { $ifNull: ['$pointsHistory.bagCount', 1] },
          },
        },
        {
          $group: {
            _id: null,
            totalBags: { $sum: '$bags' },
          },
        },
      ]);

      userBagsInCycle = bagResults[0]?.totalBags ?? 0;

      const account = await this.loyaltyModel.findOne(
        { userId: userObjId },
        { availablePoints: 1 },
      );
      pointsSnapshot = account?.availablePoints ?? 0;
      reason = 'BALLOT_NOT_OPEN';
    }

    const myVote = await this.voteModel.findOne({
      cycleId,
      userId: userObjId,
    });

    return {
      cycle,
      eligibility: {
        canVote,
        ...(reason ? { reason } : {}),
        userBagsInCycle,
        requiredBags: cycle.minimumBags,
        pointsSnapshot,
      },
      myVote,
    };
  }

  async getResults(userId: string, cycleId?: string): Promise<ResultsPayload> {
    let cycle: VotingCycleDocument | null;

    if (cycleId) {
      cycle = await this.cycleModel.findById(cycleId);
    } else {
      cycle = await this.cycleModel.findOne({ isLive: true });
    }

    if (!cycle) {
      throw new NotFoundException(VOTING_ERROR_CODES.NO_ACTIVE_CYCLE);
    }

    if (cycle.status === CycleStatus.DRAFT || cycle.status === CycleStatus.ACTIVE) {
      throw new NotFoundException(VOTING_ERROR_CODES.NO_ACTIVE_CYCLE);
    }

    // Vote-first-to-see rule during BALLOT_OPEN
    if (cycle.status === CycleStatus.BALLOT_OPEN) {
      const hasVoted = await this.voteModel.findOne({
        cycleId: cycle._id,
        userId: new Types.ObjectId(userId),
      });
      if (!hasVoted) {
        throw new ForbiddenException(VOTING_ERROR_CODES.VOTE_FIRST_TO_SEE_RESULTS);
      }
    }

    const aggResults = await this.voteModel.aggregate<{
      _id: Types.ObjectId;
      totalWeightedVotes: number;
      voterCount: number;
    }>([
      { $match: { cycleId: cycle._id as Types.ObjectId } },
      {
        $group: {
          _id: '$prizeId',
          totalWeightedVotes: { $sum: '$pointsSnapshot' },
          voterCount: { $sum: 1 },
        },
      },
      { $sort: { totalWeightedVotes: -1, voterCount: -1, _id: 1 } },
    ]);

    const prizeMap = new Map(cycle.prizes.map(p => [p._id.toString(), p.name]));

    const results: PrizeTallyRow[] = aggResults.map(r => ({
      prizeId: r._id.toString(),
      name: prizeMap.get(r._id.toString()) ?? 'Unknown',
      totalWeightedVotes: r.totalWeightedVotes,
      voterCount: r.voterCount,
    }));

    const totalVoters = results.reduce((sum, r) => sum + r.voterCount, 0);
    const totalEligible = await this.eligibilityModel.countDocuments({
      cycleId: cycle._id,
    });

    return { results, totalVoters, totalEligible };
  }

  async getHistory(): Promise<VotingCycleDocument[]> {
    const cycles = await this.cycleModel
      .find({
        status: { $in: [CycleStatus.COMPLETED, CycleStatus.ARCHIVED] },
      })
      .sort({ createdAt: -1 })
      .select('name cycleStartDate cycleEndDate winner status cycleNumber')
      .limit(20)
      .exec();
    return cycles;
  }

  async getCycleStats(cycleId: string): Promise<StatsPayload> {
    const cycle = await this.cycleModel.findById(cycleId);
    if (!cycle) {
      throw new NotFoundException('Voting cycle not found');
    }

    const aggResults = await this.voteModel.aggregate<{
      _id: Types.ObjectId;
      totalWeightedVotes: number;
      voterCount: number;
    }>([
      { $match: { cycleId: cycle._id as Types.ObjectId } },
      {
        $group: {
          _id: '$prizeId',
          totalWeightedVotes: { $sum: '$pointsSnapshot' },
          voterCount: { $sum: 1 },
        },
      },
      { $sort: { totalWeightedVotes: -1, voterCount: -1, _id: 1 } },
    ]);

    const prizeMap = new Map(cycle.prizes.map(p => [p._id.toString(), p.name]));

    const results: PrizeTallyRow[] = aggResults.map(r => ({
      prizeId: r._id.toString(),
      name: prizeMap.get(r._id.toString()) ?? 'Unknown',
      totalWeightedVotes: r.totalWeightedVotes,
      voterCount: r.voterCount,
    }));

    const totalVoters = results.reduce((sum, r) => sum + r.voterCount, 0);
    const totalEligible = await this.eligibilityModel.countDocuments({
      cycleId: cycle._id,
    });
    const participationRate = totalEligible > 0 ? totalVoters / totalEligible : 0;

    return { results, totalVoters, totalEligible, participationRate };
  }

  // ── Community goal increment ──────────────────────────────────────────────

  async incrementCommunityGoalProgress(bagCount: number): Promise<void> {
    await this.cycleModel.updateOne(
      { status: CycleStatus.ACTIVE },
      { $inc: { communityGoalProgress: bagCount } },
    );
  }
}
