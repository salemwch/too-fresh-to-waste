import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AdminOnlyGuard } from '../admin/guards/admin-only.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

import { DonationsService } from './donations.service';
import { DonationStatsResponseDto } from './dto/donation-stats.dto';
import { UpdateDonationPoolDto } from './dto/update-donation-pool.dto';

@ApiTags('Admin - Donations')
@Controller('admin/donations')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@ApiBearerAuth()
export class DonationsAdminController {
  private readonly logger = new Logger(DonationsAdminController.name);

  constructor(private readonly donationsService: DonationsService) {}

  /**
   * GET /admin/donations/pool
   * Get the current active donation pool stats (admin view)
   */
  @Get('pool')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get active donation pool (admin)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Active donation pool stats',
    type: DonationStatsResponseDto,
  })
  async getActivePool(): Promise<{
    message: string;
    data: DonationStatsResponseDto;
  }> {
    const stats = await this.donationsService.getCurrentStats();
    return {
      message: 'Active donation pool retrieved',
      data: stats,
    };
  }

  /**
   * PATCH /admin/donations/pool
   * Update the active donation pool (targetAmount, cause)
   */
  @Patch('pool')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update active donation pool (admin)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Donation pool updated',
    type: DonationStatsResponseDto,
  })
  async updatePool(
    @Body() dto: UpdateDonationPoolDto,
    @CurrentUser('_id') adminId: string,
  ): Promise<{ message: string; data: DonationStatsResponseDto }> {
    this.logger.log(`Admin ${adminId} updating donation pool: ${JSON.stringify(dto)}`);
    const stats = await this.donationsService.updateActivePool(dto);
    return {
      message: 'Donation pool updated successfully',
      data: stats,
    };
  }

  /**
   * POST /admin/donations/pool/reset
   * Archive the current pool and create a fresh one.
   */
  @Post('pool/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset (archive) the active pool and create a new one (admin)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'New donation pool created',
    type: DonationStatsResponseDto,
  })
  async resetPool(
    @CurrentUser('_id') adminId: string,
  ): Promise<{ message: string; data: DonationStatsResponseDto }> {
    this.logger.log(`Admin ${adminId} resetting donation pool`);
    const stats = await this.donationsService.resetPool();
    return {
      message: 'Donation pool reset successfully',
      data: stats,
    };
  }
}
