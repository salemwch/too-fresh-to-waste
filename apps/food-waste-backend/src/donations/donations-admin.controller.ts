import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Logger,
    Patch,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../admin/guards/admin-only.guard';
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
        this.logger.log(
            `Admin ${adminId} updating donation pool: ${JSON.stringify(dto)}`,
        );
        const stats = await this.donationsService.updateActivePool(dto);
        return {
            message: 'Donation pool updated successfully',
            data: stats,
        };
    }
}
