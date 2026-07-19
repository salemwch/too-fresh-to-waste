import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  PrizeClaim,
  type PrizeClaimDocument,
  PrizeClaimStatus,
  PrizeSource,
} from '../../loyalty/schemas/prize-claim.schema';
import { User, type UserDocument } from '../../users/schemas/user.schema';
import { Vote, type VoteDocument } from '../schemas/vote.schema';
import { VotingCycle, type VotingCycleDocument } from '../schemas/voting-cycle.schema';
import { UpdatePrizeClaimDto } from '../dto/update-prize-claim.dto';

export interface AdminWinnerRow {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  rank: number;
  pointsSnapshot: number;
  hasClaimed: boolean;
  claimStatus: string | null;
  voucherCode: string | null;
  establishmentName: string | null;
}

@Injectable()
export class VotingPrizeAdminService {
  constructor(
    @InjectModel(Vote.name) private readonly voteModel: Model<VoteDocument>,
    @InjectModel(VotingCycle.name) private readonly cycleModel: Model<VotingCycleDocument>,
    @InjectModel(PrizeClaim.name) private readonly prizeClaimModel: Model<PrizeClaimDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async getCycleWinners(cycleId: string): Promise<AdminWinnerRow[]> {
    const cycle = await this.cycleModel.findById(cycleId).lean();
    if (!cycle) {
      throw new NotFoundException('Voting cycle not found');
    }
    if (!cycle.winnerPrizeId) {
      return [];
    }

    const rows = await this.voteModel.aggregate<{
      userId: Types.ObjectId;
      pointsSnapshot: number;
    }>([
      {
        $match: {
          cycleId: new Types.ObjectId(cycleId),
          prizeId: new Types.ObjectId(cycle.winnerPrizeId.toString()),
        },
      },
      { $sort: { pointsSnapshot: -1, votedAt: 1, _id: 1 } },
      { $limit: cycle.recipientCount },
      { $project: { _id: 0, userId: 1, pointsSnapshot: 1 } },
    ]);

    if (rows.length === 0) {
      return [];
    }

    const userIds = rows.map(r => r.userId);
    const [users, claims] = await Promise.all([
      this.userModel
        .find({ _id: { $in: userIds } })
        .select('firstName lastName email')
        .lean(),
      this.prizeClaimModel
        .find({
          userId: { $in: userIds },
          votingCycleId: new Types.ObjectId(cycleId),
          source: PrizeSource.VOTING,
        })
        .lean(),
    ]);

    const userMap = new Map(users.map(u => [u._id.toString(), u]));
    const claimMap = new Map(claims.map(c => [c.userId.toString(), c]));

    return rows.map((row, idx) => {
      const user = userMap.get(row.userId.toString());
      const claim = claimMap.get(row.userId.toString());
      return {
        userId: row.userId.toString(),
        firstName: user?.firstName ?? '',
        lastName: user?.lastName ?? '',
        email: user?.email ?? '',
        rank: idx + 1,
        pointsSnapshot: row.pointsSnapshot,
        hasClaimed: !!claim,
        claimStatus: claim?.status ?? null,
        voucherCode: claim?.voucherCode ?? null,
        establishmentName: claim?.establishmentName ?? null,
      };
    });
  }

  async listPrizeClaims(page: number, limit: number, status?: string, source?: string) {
    const filter: Record<string, string> = {};
    if (status && Object.values(PrizeClaimStatus).includes(status as PrizeClaimStatus)) {
      filter['status'] = status;
    }
    if (source && Object.values(PrizeSource).includes(source as PrizeSource)) {
      filter['source'] = source;
    }

    const [claims, total] = await Promise.all([
      this.prizeClaimModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'firstName lastName email')
        .lean(),
      this.prizeClaimModel.countDocuments(filter),
    ]);

    return { claims, total };
  }

  async updatePrizeClaim(claimId: string, dto: UpdatePrizeClaimDto) {
    const claim = await this.prizeClaimModel.findById(claimId);
    if (!claim) {
      throw new NotFoundException('Prize claim not found');
    }

    if (claim.status === PrizeClaimStatus.DELIVERED) {
      throw new BadRequestException('Cannot modify a delivered prize claim');
    }
    if (claim.status === PrizeClaimStatus.REJECTED) {
      throw new BadRequestException('Cannot modify a rejected prize claim');
    }

    claim.status = dto.status;
    if (dto.adminNotes) {
      claim.adminNotes = dto.adminNotes;
    }
    if (dto.status === PrizeClaimStatus.VERIFIED) {
      claim.verifiedAt = new Date();
    }
    if (dto.status === PrizeClaimStatus.DELIVERED) {
      claim.deliveredAt = new Date();
    }

    return claim.save();
  }
}
