import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UserRole } from '@foodwaste/shared';
import {
  InviteTeamMemberDto,
  UpdateTeamMemberRoleDto,
  UpdateTeamMemberPermissionsDto,
  TeamSearchDto,
} from '../dto/team-management.dto';
import { TeamManagementService } from '../services/team-management.service';

@ApiTags('Admin Team Management')
@Controller('admin/team')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class TeamManagementController {
  constructor(private readonly teamService: TeamManagementService) {}

  @Get()
  @ApiOperation({ summary: 'List team members (admins & moderators)' })
  async listTeamMembers(@Query() query: TeamSearchDto) {
    const result = await this.teamService.listTeamMembers(query);
    return {
      status: 'success',
      message: 'Team members retrieved',
      data: result.members,
      meta: { page: result.page, limit: result.limit, total: result.total },
    };
  }

  @Get('permissions')
  @ApiOperation({ summary: 'Get available permissions list' })
  getAvailablePermissions() {
    return {
      status: 'success',
      message: 'Available permissions retrieved',
      data: this.teamService.getAvailablePermissions(),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single team member' })
  async getTeamMember(@Param('id') id: string) {
    const member = await this.teamService.getTeamMember(id);
    return {
      status: 'success',
      message: 'Team member retrieved',
      data: member,
    };
  }

  @Post('invite')
  @ApiOperation({ summary: 'Invite a new admin or moderator' })
  async inviteTeamMember(@Body() dto: InviteTeamMemberDto, @GetUser('userId') adminId: string) {
    const result = await this.teamService.inviteTeamMember(dto, adminId);
    return {
      status: 'success',
      message: 'Team member invited successfully',
      data: result,
    };
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Change team member role' })
  async updateRole(@Param('id') id: string, @Body() dto: UpdateTeamMemberRoleDto) {
    const member = await this.teamService.updateTeamMemberRole(id, dto);
    return {
      status: 'success',
      message: 'Team member role updated',
      data: member,
    };
  }

  @Patch(':id/permissions')
  @ApiOperation({ summary: 'Update team member permissions' })
  async updatePermissions(@Param('id') id: string, @Body() dto: UpdateTeamMemberPermissionsDto) {
    const member = await this.teamService.updateTeamMemberPermissions(id, dto);
    return {
      status: 'success',
      message: 'Team member permissions updated',
      data: member,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove team member (blocks account)' })
  async removeTeamMember(@Param('id') id: string, @GetUser('userId') adminId: string) {
    await this.teamService.removeTeamMember(id, adminId);
    return {
      status: 'success',
      message: 'Team member removed',
    };
  }
}
