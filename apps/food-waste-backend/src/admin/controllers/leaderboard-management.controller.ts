import { UserRole } from '@foodwaste/shared';
import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { QueryOptimizer } from '../../common/utils/query-optimization.util';
import { LeaderboardManagementService } from '../services/leaderboard-management.service';

@ApiTags('Admin — Leaderboard Management')
@Controller('admin/leaderboards')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class LeaderboardManagementController {
  constructor(private readonly leaderboardService: LeaderboardManagementService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Leaderboard statistics' })
  @ApiResponse({ status: 200, description: 'Leaderboard stats retrieved' })
  async getStats() {
    const stats = await this.leaderboardService.getLeaderboardStats();
    return {
      message: 'Leaderboard statistics retrieved successfully',
      data: stats,
    };
  }

  @Get('top-users')
  @ApiOperation({ summary: 'Top users by points (admin view)' })
  @ApiResponse({ status: 200, description: 'Top users retrieved' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTopUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const result = await this.leaderboardService.getTopUsers(page, limit);
    return {
      message: 'Top users retrieved successfully',
      data: result.data,
      meta: QueryOptimizer.getPaginationMeta(result.total, result.page, result.limit),
    };
  }

  @Get('top-merchants')
  @ApiOperation({ summary: 'Top merchants by bags saved (sponsor day eligibility)' })
  @ApiResponse({ status: 200, description: 'Top merchants retrieved' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTopMerchants(@Query('limit', new DefaultValuePipe(3), ParseIntPipe) limit: number) {
    const data = await this.leaderboardService.getTopMerchants(limit);
    return {
      message: 'Top merchants retrieved successfully',
      data,
    };
  }
}
