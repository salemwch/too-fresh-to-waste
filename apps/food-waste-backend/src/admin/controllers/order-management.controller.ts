import { UserRole } from '@foodwaste/shared';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuthenticatedRequest } from '../../common/decorators/get-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { QueryOptimizer } from '../../common/utils/query-optimization.util';
import {
  AdminOrderQueryDto,
  AdminCancelOrderDto,
  AdminRefundOrderDto,
} from '../dto/admin-order-query.dto';
import { OrderManagementService } from '../services/order-management.service';
import { strictValidation } from '../../common/pipes/validation-pipes';

@ApiTags('Admin — Order Management')
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class OrderManagementController {
  constructor(private readonly orderManagementService: OrderManagementService) {}

  // ── List All Orders ───────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'List all orders (platform-wide)',
    description:
      'Admin order listing with filters: status, payment status, payment provider, customer/merchant/establishment, date range, search by order number.',
  })
  @ApiResponse({ status: 200, description: 'Orders retrieved' })
  async listOrders(@Query(strictValidation()) query: AdminOrderQueryDto) {
    const result = await this.orderManagementService.listOrders(query);
    return {
      message: 'Orders retrieved successfully',
      data: result.data,
      meta: QueryOptimizer.getPaginationMeta(result.total, result.page, result.limit),
    };
  }

  // ── Order Stats ───────────────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({
    summary: 'Platform-wide order statistics',
    description:
      'Total orders, active orders, dispute/cancellation rate, total revenue, count by status and payment status, refund totals.',
  })
  @ApiResponse({ status: 200, description: 'Stats retrieved' })
  async getStats() {
    const stats = await this.orderManagementService.getOrderStats();
    return {
      message: 'Order statistics retrieved successfully',
      data: stats,
    };
  }

  // ── Order Detail ──────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({
    summary: 'Get order detail',
    description:
      'Full order detail with populated customer, merchant, establishment, items, and refund requests.',
  })
  @ApiResponse({ status: 200, description: 'Order detail retrieved' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderDetail(@Param('id') id: string) {
    const order = await this.orderManagementService.getOrderDetail(id);
    return {
      message: 'Order detail retrieved successfully',
      data: order,
    };
  }

  // ── Admin Cancel Order ────────────────────────────────────────────────────

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel an order (admin)',
    description:
      'Admin-initiated cancellation. Automatically triggers refund for online-paid orders. Cannot cancel terminal-status orders.',
  })
  @ApiResponse({ status: 200, description: 'Order cancelled' })
  @ApiResponse({ status: 400, description: 'Order cannot be cancelled' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async cancelOrder(
    @Param('id') id: string,
    @Body() dto: AdminCancelOrderDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const order = await this.orderManagementService.adminCancelOrder(id, dto, {
      adminId: req.user.userId,
      adminEmail: req.user.email,
      ipAddress: req.ip ?? 'unknown',
      userAgent: req.headers['user-agent'] ?? 'unknown',
    });
    return {
      message: 'Order cancelled successfully',
      data: order,
    };
  }

  // ── Admin Issue Refund ────────────────────────────────────────────────────

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Issue refund for an order (admin)',
    description:
      'Admin-initiated refund for online-paid orders. Only available for Konnect payments with paid/held status. Checks for existing pending refund requests.',
  })
  @ApiResponse({ status: 200, description: 'Refund initiated' })
  @ApiResponse({ status: 400, description: 'Cannot refund this order' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async refundOrder(
    @Param('id') id: string,
    @Body() dto: AdminRefundOrderDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const order = await this.orderManagementService.adminIssueRefund(id, dto, {
      adminId: req.user.userId,
      adminEmail: req.user.email,
      ipAddress: req.ip ?? 'unknown',
      userAgent: req.headers['user-agent'] ?? 'unknown',
    });
    return {
      message: 'Refund initiated successfully',
      data: order,
    };
  }
}
