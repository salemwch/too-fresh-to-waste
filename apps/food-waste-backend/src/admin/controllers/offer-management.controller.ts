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
  Res,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuthenticatedRequest } from '../../common/decorators/get-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { QueryOptimizer } from '../../common/utils/query-optimization.util';
import {
  AdminOfferQueryDto,
  AdminOfferDeletedQueryDto,
  BulkOfferActionDto,
  LowPickupRateQueryDto,
  PriceViolationQueryDto,
  ExportOffersQueryDto,
} from '../dto/admin-offer-query.dto';
import { OfferManagementService } from '../services/offer-management.service';

@ApiTags('Admin — Offer Management')
@Controller('admin/offers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class OfferManagementController {
  constructor(private readonly offerManagementService: OfferManagementService) {}

  // ── List All Offers ────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'List all offers (all merchants)',
    description:
      'Platform-wide offer listing with full filters: status, establishment, merchant, category, discount range, date range, featured flag.',
  })
  @ApiResponse({ status: 200, description: 'Offers retrieved' })
  async listOffers(@Query(new ValidationPipe({ transform: true })) query: AdminOfferQueryDto) {
    const result = await this.offerManagementService.listOffers(query);
    return {
      message: 'Offers retrieved successfully',
      data: result.data,
      meta: QueryOptimizer.getPaginationMeta(result.total, result.page, result.limit),
    };
  }

  // ── Platform Stats ─────────────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({
    summary: 'Platform-wide offer statistics',
    description:
      'Count by status, total sold bags, revenue saved, avg discount, pickup rate, top categories, featured count.',
  })
  @ApiResponse({ status: 200, description: 'Stats retrieved' })
  async getStats() {
    const stats = await this.offerManagementService.getStats();
    return {
      message: 'Offer statistics retrieved successfully',
      data: stats,
    };
  }

  // ── Low Pickup Rate ────────────────────────────────────────────────────────

  @Get('low-pickup-rate')
  @ApiOperation({
    summary: 'Offers with low pickup rate',
    description:
      'Returns expired/sold_out offers where soldQuantity/totalQuantity is below the threshold (default 20%). Sorted worst first.',
  })
  @ApiResponse({ status: 200, description: 'Low-performance offers retrieved' })
  async getLowPickupRate(
    @Query(new ValidationPipe({ transform: true })) query: LowPickupRateQueryDto,
  ) {
    const result = await this.offerManagementService.getLowPickupRate(query);
    return {
      message: 'Low pickup rate offers retrieved successfully',
      data: result.data,
      meta: QueryOptimizer.getPaginationMeta(result.total, query.page ?? 1, query.limit ?? 20),
    };
  }

  // ── Price Violations ───────────────────────────────────────────────────────

  @Get('price-violations')
  @ApiOperation({
    summary: 'Offers below minimum discount threshold',
    description:
      'Returns active/draft offers whose discount percentage is below the platform minimum (default 30%). Sorted by lowest discount first.',
  })
  @ApiResponse({ status: 200, description: 'Price violation offers retrieved' })
  async getPriceViolations(
    @Query(new ValidationPipe({ transform: true })) query: PriceViolationQueryDto,
  ) {
    const result = await this.offerManagementService.getPriceViolations(query);
    return {
      message: 'Price violation offers retrieved successfully',
      data: result.data,
      meta: QueryOptimizer.getPaginationMeta(result.total, query.page ?? 1, query.limit ?? 20),
    };
  }

  // ── Soft-Deleted Offers ────────────────────────────────────────────────────

  @Get('deleted')
  @ApiOperation({
    summary: 'List soft-deleted offers',
    description:
      'View all offers that were soft-deleted. Can be filtered by deletion date range or who deleted them. Enables recovery.',
  })
  @ApiResponse({ status: 200, description: 'Deleted offers retrieved' })
  async getDeletedOffers(
    @Query(new ValidationPipe({ transform: true })) query: AdminOfferDeletedQueryDto,
  ) {
    const result = await this.offerManagementService.getDeletedOffers(query);
    return {
      message: 'Deleted offers retrieved successfully',
      data: result.data,
      meta: QueryOptimizer.getPaginationMeta(result.total, query.page ?? 1, query.limit ?? 20),
    };
  }

  // ── Bulk Action ────────────────────────────────────────────────────────────

  @Post('bulk-action')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk action on offers',
    description:
      'Apply an action to multiple offers at once: disable, enable, feature, unfeature, or delete (soft). Max 100 IDs per request. Delete requires a reason.',
  })
  @ApiResponse({ status: 200, description: 'Bulk action result' })
  @ApiResponse({ status: 400, description: 'Invalid action or missing reason for delete' })
  async bulkAction(@Body() dto: BulkOfferActionDto, @Request() req: AuthenticatedRequest) {
    const result = await this.offerManagementService.bulkAction(dto, {
      adminId: req.user.userId,
      adminEmail: req.user.email,
      ipAddress: req.ip ?? 'unknown',
      userAgent: req.headers['user-agent'] ?? 'unknown',
    });

    return {
      message: `Bulk action "${result.action}" completed`,
      data: {
        processed: result.processed,
        failed: result.failed,
        failedCount: result.failed.length,
      },
    };
  }

  // ── Restore Offer ──────────────────────────────────────────────────────────

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Restore a soft-deleted offer',
    description:
      'Restores a deleted offer back to DRAFT status. The merchant must re-review and re-publish it.',
  })
  @ApiResponse({ status: 200, description: 'Offer restored to draft' })
  @ApiResponse({ status: 404, description: 'Deleted offer not found' })
  async restoreOffer(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const offer = await this.offerManagementService.restoreOffer(id, {
      adminId: req.user.userId,
      adminEmail: req.user.email,
      ipAddress: req.ip ?? 'unknown',
      userAgent: req.headers['user-agent'] ?? 'unknown',
    });

    return {
      message: 'Offer restored to draft successfully',
      data: offer,
    };
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  @Get('export')
  @ApiOperation({
    summary: 'Export offers (CSV or JSON)',
    description:
      'Export all offers matching the query filters. Supports same filters as GET /admin/offers. Max 5 000 rows.',
  })
  @ApiResponse({ status: 200, description: 'File download' })
  async exportOffers(
    @Query(new ValidationPipe({ transform: true })) query: ExportOffersQueryDto,
    @Request() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const result = await this.offerManagementService.exportOffers(query, {
      adminId: req.user.userId,
      adminEmail: req.user.email,
      ipAddress: req.ip ?? 'unknown',
      userAgent: req.headers['user-agent'] ?? 'unknown',
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  }
}
