import { Controller, Get, UseGuards, Logger, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

import { DonationsService } from './donations.service';
import { DonationStatsResponseDto, UserDonationStatsResponseDto } from './dto/donation-stats.dto';

/**
 * DonationsController
 * Handles HTTP endpoints for donation statistics and user impact tracking
 * Enterprise-grade with Swagger documentation and authentication
 */
@ApiTags('Donations')
@Controller('donations')
export class DonationsController {
  private readonly logger = new Logger(DonationsController.name);

  constructor(private readonly donationsService: DonationsService) {}

  /**
   * GET /donations/stats
   * Public endpoint - Get current donation pool statistics
   * Used by frontend to display community impact metrics
   */
  @Public()
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get current donation pool statistics',
    description:
      'Retrieve real-time statistics about the active donation pool including total donations, meal count, and progress towards target. This endpoint is public and does not require authentication.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Donation statistics retrieved successfully',
    type: DonationStatsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Failed to retrieve donation statistics',
  })
  async getCurrentDonationStats(): Promise<{ message: string; data: DonationStatsResponseDto }> {
    this.logger.log('Fetching current donation pool statistics');

    try {
      const stats = await this.donationsService.getCurrentStats();
      return {
        message: 'Donation statistics retrieved successfully',
        data: stats,
      };
    } catch (error) {
      this.logger.error('Error fetching donation stats', error);
      throw error;
    }
  }

  /**
   * GET /donations/user/stats
   * Protected endpoint - Get user-specific donation statistics
   * Requires authentication
   */
  @UseGuards(JwtAuthGuard)
  @Get('user/stats')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user donation statistics',
    description:
      'Retrieve personalized donation statistics for the authenticated user including total contributions, badges earned, and rank among contributors. Requires authentication.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User donation statistics retrieved successfully',
    type: UserDonationStatsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Failed to retrieve user statistics',
  })
  async getUserDonationStats(
    @CurrentUser('userId') userId: string,
  ): Promise<{ message: string; data: UserDonationStatsResponseDto }> {
    this.logger.log(`Fetching donation statistics for user ${userId}`);

    try {
      const userObjectId = new Types.ObjectId(userId);
      const stats = await this.donationsService.getUserStats(userObjectId);
      return {
        message: 'User donation statistics retrieved successfully',
        data: stats,
      };
    } catch (error) {
      this.logger.error(`Error fetching user stats for ${userId}`, error);
      throw error;
    }
  }

  /**
   * GET /donations/health
   * Health check endpoint for monitoring
   */
  @Public()
  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Health check for donations service',
    description: 'Simple health check endpoint to verify the donations service is operational',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Service is healthy',
  })
  healthCheck(): { status: string; timestamp: string } {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }
}
