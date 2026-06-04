import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Query,
  Request,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '@foodwaste/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../common/decorators/get-user.decorator';
import { LeaderboardService } from './leaderboard.service';
import type { LeaderboardEntry, MerchantRankResponse } from './leaderboard.service';

class UpdateLeaderboardPreferenceDto {
  @IsBoolean()
  anonymous!: boolean;
}

@ApiTags('Leaderboard')
@ApiBearerAuth()
@Controller('leaderboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MERCHANT, UserRole.LOCATION_MANAGER)
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get top merchants ranked by meals saved' })
  async getLeaderboard(
    @Query('limit') limit?: string,
  ): Promise<{ message: string; data: LeaderboardEntry[] }> {
    const data = await this.leaderboardService.getLeaderboard(
      limit ? Math.min(Number(limit), 100) : 50,
    );
    return { message: 'Leaderboard retrieved successfully', data };
  }

  @Get('my-rank')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current merchant/establishment rank and score' })
  async getMyRank(
    @Request() req: AuthenticatedRequest,
    @Query('establishmentId') establishmentId?: string,
  ): Promise<{ message: string; data: MerchantRankResponse }> {
    const effectiveEstablishmentId =
      req.user.role === UserRole.LOCATION_MANAGER
        ? req.user.assignedEstablishmentId
        : establishmentId;
    const data = await this.leaderboardService.getMerchantRank(
      req.user.userId,
      effectiveEstablishmentId,
    );
    return { message: 'Rank retrieved successfully', data };
  }

  @Patch('preference')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set leaderboard anonymity preference' })
  async updatePreference(
    @Request() req: AuthenticatedRequest,
    @Body(new ValidationPipe({ whitelist: true })) dto: UpdateLeaderboardPreferenceDto,
  ): Promise<{ message: string }> {
    await this.leaderboardService.updatePreference(req.user.userId, dto.anonymous);
    return { message: 'Preference updated successfully' };
  }
}
