import { UserRole } from '@foodwaste/shared';
import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { QueryOptimizer } from '../../common/utils/query-optimization.util';
import { PaymentManagementService } from '../services/payment-management.service';

@ApiTags('Admin — Payment Management')
@Controller('admin/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class PaymentManagementController {
  constructor(private readonly paymentManagementService: PaymentManagementService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Platform-wide payment statistics' })
  @ApiResponse({ status: 200, description: 'Payment stats retrieved' })
  async getStats() {
    const stats = await this.paymentManagementService.getAdminPaymentStats();
    return {
      message: 'Payment statistics retrieved successfully',
      data: stats,
    };
  }

  @Get('payouts')
  @ApiOperation({ summary: 'Merchant payout summaries (wallets)' })
  @ApiResponse({ status: 200, description: 'Payout summaries retrieved' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getPayouts(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const result = await this.paymentManagementService.getPayoutSummaries(page, limit);
    return {
      message: 'Payout summaries retrieved successfully',
      data: result.data,
      meta: QueryOptimizer.getPaginationMeta(result.total, result.page, result.limit),
    };
  }
}
