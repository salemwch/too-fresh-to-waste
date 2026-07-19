import { UserRole, UserStatus } from '@foodwaste/shared';
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { Model } from 'mongoose';

import { RegexSecurityUtil } from '../../common/utils/regex-security.util';
import { User, UserDocument } from '../../users/schemas/user.schema';
import {
  InviteTeamMemberDto,
  UpdateTeamMemberRoleDto,
  UpdateTeamMemberPermissionsDto,
  TeamSearchDto,
  AdminPermission,
  ADMIN_PERMISSIONS,
  MODERATOR_DEFAULT_PERMISSIONS,
} from '../dto/team-management.dto';

export interface TeamMemberRow {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  permissions: string[];
  isActive: boolean;
  lastLoginAt: string | null;
  invitedBy: string | null;
  createdAt: string;
}

export interface TeamListResponse {
  members: TeamMemberRow[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class TeamManagementService {
  private readonly logger = new Logger(TeamManagementService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly regexSecurityUtil: RegexSecurityUtil,
  ) {}

  async listTeamMembers(query: TeamSearchDto): Promise<TeamListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = {
      role: { $in: [UserRole.ADMIN, UserRole.MODERATOR] },
    };

    if (query.role) {
      filter['role'] = query.role;
    }

    if (query.search) {
      const escaped = this.regexSecurityUtil.escapeRegexPattern(query.search);
      filter['$or'] = [
        { firstName: { $regex: escaped, $options: 'i' } },
        { lastName: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [members, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select(
          'firstName lastName email role permissions isActive lastLoginAt invitedBy createdAt',
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.userModel.countDocuments(filter),
    ]);

    return {
      members: members.map(m => ({
        _id: m._id.toString(),
        firstName: m.firstName ?? '',
        lastName: m.lastName ?? '',
        email: m.email,
        role: m.role,
        permissions: m.permissions ?? [],
        isActive: m.status === UserStatus.ACTIVE,
        lastLoginAt: m.lastLoginAt ? new Date(m.lastLoginAt).toISOString() : null,
        invitedBy: m.invitedBy ?? null,
        createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : '',
      })),
      total,
      page,
      limit,
    };
  }

  async inviteTeamMember(
    dto: InviteTeamMemberDto,
    invitedByAdminId: string,
  ): Promise<{ member: TeamMemberRow; temporaryPassword: string }> {
    const existing = await this.userModel.findOne({ email: dto.email.toLowerCase() }).lean();
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const temporaryPassword = crypto.randomBytes(12).toString('base64url');
    const hashedPassword = await argon2.hash(temporaryPassword);

    const permissions =
      dto.permissions ??
      (dto.role === UserRole.ADMIN ? ADMIN_PERMISSIONS : MODERATOR_DEFAULT_PERMISSIONS);

    const user = await this.userModel.create({
      email: dto.email.toLowerCase(),
      password: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role,
      authProvider: 'local',
      isEmailVerified: true,
      status: UserStatus.ACTIVE,
      permissions,
      invitedBy: invitedByAdminId,
      requiresPasswordChange: true,
    });

    this.logger.log(
      `Team member invited: ${dto.email} as ${dto.role} by admin ${invitedByAdminId}`,
    );

    return {
      member: {
        _id: user._id.toString(),
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email.toLowerCase(),
        role: dto.role,
        permissions,
        isActive: true,
        lastLoginAt: null,
        invitedBy: invitedByAdminId,
        createdAt: new Date().toISOString(),
      },
      temporaryPassword,
    };
  }

  async updateTeamMemberRole(
    memberId: string,
    dto: UpdateTeamMemberRoleDto,
  ): Promise<TeamMemberRow> {
    const member = await this.userModel.findById(memberId);
    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    if (member.role !== UserRole.ADMIN && member.role !== UserRole.MODERATOR) {
      throw new BadRequestException('Only admin/moderator team members can be updated');
    }

    member.role = dto.role;

    if (dto.role === UserRole.ADMIN) {
      member.permissions = ADMIN_PERMISSIONS;
    }

    await member.save();

    return {
      _id: member._id.toString(),
      firstName: member.firstName ?? '',
      lastName: member.lastName ?? '',
      email: member.email,
      role: member.role as UserRole,
      permissions: member.permissions ?? [],
      isActive: member.status === UserStatus.ACTIVE,
      lastLoginAt: member.lastLoginAt ? new Date(member.lastLoginAt).toISOString() : null,
      invitedBy: member.invitedBy ?? null,
      createdAt: member.createdAt ? new Date(member.createdAt).toISOString() : '',
    };
  }

  async updateTeamMemberPermissions(
    memberId: string,
    dto: UpdateTeamMemberPermissionsDto,
  ): Promise<TeamMemberRow> {
    const member = await this.userModel.findById(memberId);
    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    if (member.role !== UserRole.ADMIN && member.role !== UserRole.MODERATOR) {
      throw new BadRequestException('Only admin/moderator team members can be updated');
    }

    member.permissions = dto.permissions;
    await member.save();

    return {
      _id: member._id.toString(),
      firstName: member.firstName ?? '',
      lastName: member.lastName ?? '',
      email: member.email,
      role: member.role as UserRole,
      permissions: member.permissions ?? [],
      isActive: member.status === UserStatus.ACTIVE,
      lastLoginAt: member.lastLoginAt ? new Date(member.lastLoginAt).toISOString() : null,
      invitedBy: member.invitedBy ?? null,
      createdAt: member.createdAt ? new Date(member.createdAt).toISOString() : '',
    };
  }

  async removeTeamMember(memberId: string, adminId: string): Promise<void> {
    const member = await this.userModel.findById(memberId);
    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    if (member.role !== UserRole.ADMIN && member.role !== UserRole.MODERATOR) {
      throw new BadRequestException('Only admin/moderator team members can be removed');
    }

    if (member._id.toString() === adminId) {
      throw new BadRequestException('You cannot remove yourself from the team');
    }

    member.status = UserStatus.BLOCKED;
    member.permissions = [];
    await member.save();

    this.logger.log(`Team member removed: ${member.email} by admin ${adminId}`);
  }

  async getTeamMember(memberId: string): Promise<TeamMemberRow> {
    const member = await this.userModel
      .findById(memberId)
      .select('firstName lastName email role permissions status lastLoginAt invitedBy createdAt')
      .lean();

    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    if (member.role !== UserRole.ADMIN && member.role !== UserRole.MODERATOR) {
      throw new BadRequestException('User is not a team member');
    }

    return {
      _id: member._id.toString(),
      firstName: member.firstName ?? '',
      lastName: member.lastName ?? '',
      email: member.email,
      role: member.role as UserRole,
      permissions: member.permissions ?? [],
      isActive: member.status === UserStatus.ACTIVE,
      lastLoginAt: member.lastLoginAt ? new Date(member.lastLoginAt).toISOString() : null,
      invitedBy: member.invitedBy ?? null,
      createdAt: member.createdAt ? new Date(member.createdAt).toISOString() : '',
    };
  }

  getAvailablePermissions(): AdminPermission[] {
    return ADMIN_PERMISSIONS;
  }

  getDefaultPermissions(role: UserRole): AdminPermission[] {
    if (role === UserRole.ADMIN) {
      return ADMIN_PERMISSIONS;
    }
    return MODERATOR_DEFAULT_PERMISSIONS;
  }
}
