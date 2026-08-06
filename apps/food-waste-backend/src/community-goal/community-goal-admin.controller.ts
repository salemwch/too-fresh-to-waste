import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AdminOnlyGuard } from '../admin/guards/admin-only.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

import { MonthlyBagGoalService } from './community-goal.service';
import { SetGoalTargetDto, MonthlyBagGoalStatsResponseDto } from './dto/community-goal.dto';

@ApiTags('Admin - Community Goal')
@Controller('admin/community-goal')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@ApiBearerAuth()
export class MonthlyBagGoalAdminController {
  private readonly logger = new Logger(MonthlyBagGoalAdminController.name);

  constructor(private readonly monthlyBagGoalService: MonthlyBagGoalService) {}

  /**
   * POST /admin/community-goal/target
   * Set a new target for the active community goal
   */
  @Post('target')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set community goal target (admin)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Goal target updated',
    type: MonthlyBagGoalStatsResponseDto,
  })
  async setTarget(
    @Body() dto: SetGoalTargetDto,
    @CurrentUser('userId') adminId: string,
  ): Promise<{ message: string; data: MonthlyBagGoalStatsResponseDto }> {
    this.logger.log(`Admin ${adminId} setting community goal target to ${dto.targetCount}`);
    const stats = await this.monthlyBagGoalService.setGoalTarget(dto.targetCount, adminId, {
      ...(dto.causeType !== undefined && { causeType: dto.causeType }),
      ...(dto.causeTitle !== undefined && { causeTitle: dto.causeTitle }),
      ...(dto.causeDescription !== undefined && { causeDescription: dto.causeDescription }),
      ...(dto.seasonName !== undefined && { seasonName: dto.seasonName }),
      ...(dto.endDate !== undefined && { endDate: dto.endDate }),
    });
    return {
      message: `Community goal target updated to ${dto.targetCount}`,
      data: stats,
    };
  }

  /**
   * POST /admin/community-goal/reset
   * Reset the current count to 0
   */
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset community goal count (admin)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Goal count reset to 0',
    type: MonthlyBagGoalStatsResponseDto,
  })
  async reset(
    @CurrentUser('userId') adminId: string,
  ): Promise<{ message: string; data: MonthlyBagGoalStatsResponseDto }> {
    this.logger.log(`Admin ${adminId} resetting community goal`);
    const stats = await this.monthlyBagGoalService.resetGoal(adminId);
    return {
      message: 'Community goal count reset to 0',
      data: stats,
    };
  }

  /**
   * GET /admin/community-goal/history
   * Get all goal cycles (paginated)
   */
  @Get('history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get community goal history (admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Goal history retrieved',
  })
  async getHistory(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{
    message: string;
    data: MonthlyBagGoalStatsResponseDto[];
    meta: { total: number; page: number; limit: number };
  }> {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20));

    const { goals, total } = await this.monthlyBagGoalService.getHistory(pageNum, limitNum);
    return {
      message: 'Community goal history retrieved successfully',
      data: goals,
      meta: { total, page: pageNum, limit: limitNum },
    };
  }
}
