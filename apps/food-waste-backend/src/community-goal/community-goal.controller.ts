import { Controller, Get, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../common/decorators/public.decorator';

import { CommunityGoalService } from './community-goal.service';
import { CommunityGoalStatsResponseDto } from './dto/community-goal.dto';

@ApiTags('Community Goal')
@Controller('community-goal')
export class CommunityGoalController {
  private readonly logger = new Logger(CommunityGoalController.name);

  constructor(private readonly communityGoalService: CommunityGoalService) {}

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
    type: CommunityGoalStatsResponseDto,
  })
  async getStats(): Promise<{
    message: string;
    data: CommunityGoalStatsResponseDto;
  }> {
    this.logger.log('Fetching community bag goal statistics');
    try {
      const stats = await this.communityGoalService.getStats();
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
