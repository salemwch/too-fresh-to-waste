import { Controller, Get, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../common/decorators/public.decorator';

import { MonthlyBagGoalService } from './community-goal.service';
import { MonthlyBagGoalStatsResponseDto } from './dto/community-goal.dto';

@ApiTags('Community Goal')
@Controller('community-goal')
export class MonthlyBagGoalController {
  private readonly logger = new Logger(MonthlyBagGoalController.name);

  constructor(private readonly monthlyBagGoalService: MonthlyBagGoalService) {}

  /**
   * GET /community-goal/stats
   * PUBLIC endpoint — no auth required (same pattern as donations/stats)
   */
  @Public()
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get community bag goal statistics',
    description:
      'Retrieve real-time community bag goal progress. Public endpoint — no authentication required.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Community goal statistics retrieved successfully',
    type: MonthlyBagGoalStatsResponseDto,
  })
  async getStats(): Promise<{
    message: string;
    data: MonthlyBagGoalStatsResponseDto;
  }> {
    this.logger.log('Fetching community bag goal statistics');
    try {
      const stats = await this.monthlyBagGoalService.getStats();
      return {
        message: 'Community goal statistics retrieved successfully',
        data: stats,
      };
    } catch (error) {
      this.logger.error('Error fetching community goal stats', error);
      throw error;
    }
  }
}
