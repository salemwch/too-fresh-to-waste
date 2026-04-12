import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  IEstablishment,
  IEstablishmentOverview,
  IEstablishmentStats,
  IEstablishmentListResponse,
} from '../../common/interfaces/establishment.interface';
import { IpAddress, UserAgent } from '../decorators';
import {
  ApproveEstablishmentDto,
  UpdateEstablishmentStatusDto,
  EstablishmentSearchDto,
  EstablishmentStatsDto,
  ExtendTrialDto,
  MarkAsPaidDto,
} from '../dto/establishment-management.dto';
import { AdminOnlyGuard } from '../guards/admin-only.guard';
import { EstablishmentManagementService } from '../services/establishment-management.service';

@ApiTags('Admin Establishment Management')
@Controller('admin/establishments')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@ApiBearerAuth()
export class EstablishmentManagementController {
  constructor(private readonly establishmentManagementService: EstablishmentManagementService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Get establishment overview',
    description: 'Get overview statistics and metrics for all establishments',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Establishment overview retrieved successfully',
  })
  async getEstablishmentOverview(): Promise<IEstablishmentOverview> {
    const result = await this.establishmentManagementService.getEstablishmentOverview();
    return result;
  }

  @Get('pending-approvals')
  @ApiOperation({
    summary: 'Get pending establishment approvals',
    description: 'Retrieve establishments waiting for approval',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pending approvals retrieved successfully',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of results (default: 50)',
  })
  async getPendingApprovals(@Query('limit') limit?: number): Promise<IEstablishment[]> {
    const result = await this.establishmentManagementService.getPendingApprovals(limit ?? 50);
    return result;
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search establishments',
    description: 'Search and filter establishments with pagination',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Establishments retrieved successfully',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search term for name, description, or email',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'active', 'suspended', 'rejected', 'inactive'],
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['restaurant', 'bakery', 'grocery_store', 'cafe', 'fast_food', 'supermarket', 'other'],
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async searchEstablishments(
    @Query() query: EstablishmentSearchDto,
  ): Promise<IEstablishmentListResponse> {
    const result = await this.establishmentManagementService.searchEstablishments(query);
    return result;
  }

  @Get(':establishmentId')
  @ApiOperation({
    summary: 'Get establishment by ID',
    description: 'Retrieve detailed information about a specific establishment',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Establishment retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Establishment not found',
  })
  @ApiParam({ name: 'establishmentId', description: 'Establishment ID' })
  async getEstablishmentById(
    @Param('establishmentId') establishmentId: string,
  ): Promise<IEstablishment> {
    const result = await this.establishmentManagementService.getEstablishmentById(establishmentId);
    return result;
  }

  @Post(':establishmentId/approve')
  @ApiOperation({
    summary: 'Approve or reject establishment',
    description: 'Approve or reject a pending establishment application',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Establishment approval status updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Establishment not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Only pending establishments can be approved or rejected',
  })
  @ApiParam({ name: 'establishmentId', description: 'Establishment ID' })
  async approveEstablishment(
    @Param('establishmentId') establishmentId: string,
    @Body() approveDto: ApproveEstablishmentDto,
    @Req() req: { user: { userId: string; email: string } },
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ): Promise<IEstablishment> {
    const admin = req.user;

    const result = await this.establishmentManagementService.approveEstablishment(
      establishmentId,
      approveDto,
      admin.userId,
      admin.email,
      ipAddress,
      userAgent,
    );
    return result;
  }

  @Patch(':establishmentId/trial')
  @ApiOperation({
    summary: 'Extend establishment free trial',
    description:
      'Extends the merchant trial. Accepts an absolute trialEndsAt or a relative extendByDays offset. Automatically flips subscriptionStatus back to "trial" and reactivates suspended merchants.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Trial extended successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Establishment not found',
  })
  @ApiParam({ name: 'establishmentId', description: 'Establishment ID' })
  async extendTrial(
    @Param('establishmentId') establishmentId: string,
    @Body() extendDto: ExtendTrialDto,
    @Req() req: { user: { userId: string; email: string } },
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ): Promise<IEstablishment> {
    const admin = req.user;
    const result = await this.establishmentManagementService.extendTrial(
      establishmentId,
      extendDto,
      admin.userId,
      admin.email,
      ipAddress,
      userAgent,
    );
    return result;
  }

  @Patch(':establishmentId/subscription/mark-as-paid')
  @ApiOperation({
    summary: 'Mark establishment as paid',
    description:
      'Marks the merchant as paid (bypasses the daily trial-expiry scan). Clears trialEndsAt and reactivates the merchant if they were suspended.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Establishment marked as paid',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Establishment not found',
  })
  @ApiParam({ name: 'establishmentId', description: 'Establishment ID' })
  async markAsPaid(
    @Param('establishmentId') establishmentId: string,
    @Body() markAsPaidDto: MarkAsPaidDto,
    @Req() req: { user: { userId: string; email: string } },
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ): Promise<IEstablishment> {
    const admin = req.user;
    const result = await this.establishmentManagementService.markAsPaid(
      establishmentId,
      markAsPaidDto,
      admin.userId,
      admin.email,
      ipAddress,
      userAgent,
    );
    return result;
  }

  @Patch(':establishmentId/status')
  @ApiOperation({
    summary: 'Update establishment status',
    description: 'Update the status of a specific establishment (suspend, activate, etc.)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Establishment status updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Establishment not found',
  })
  @ApiParam({ name: 'establishmentId', description: 'Establishment ID' })
  async updateEstablishmentStatus(
    @Param('establishmentId') establishmentId: string,
    @Body() updateDto: UpdateEstablishmentStatusDto,
    @Req() req: { user: { userId: string; email: string } },
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ): Promise<IEstablishment> {
    const admin = req.user;

    const result = await this.establishmentManagementService.updateEstablishmentStatus(
      establishmentId,
      updateDto,
      admin.userId,
      admin.email,
      ipAddress,
      userAgent,
    );
    return result;
  }

  @Get(':establishmentId/stats')
  @ApiOperation({
    summary: 'Get establishment statistics',
    description: 'Get detailed statistics for a specific establishment',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Establishment statistics retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Establishment not found',
  })
  @ApiParam({ name: 'establishmentId', description: 'Establishment ID' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date for statistics (ISO string)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date for statistics (ISO string)',
  })
  @ApiQuery({
    name: 'includeDetails',
    required: false,
    type: Boolean,
    description: 'Include detailed breakdown',
  })
  async getEstablishmentStats(
    @Param('establishmentId') establishmentId: string,
    @Query() statsDto: EstablishmentStatsDto,
  ): Promise<IEstablishmentStats> {
    const result = await this.establishmentManagementService.getEstablishmentStats(
      establishmentId,
      statsDto,
    );
    return result;
  }

  @Get(':establishmentId/activity')
  @ApiOperation({
    summary: 'Get establishment activity',
    description: 'Get activity history for a specific establishment',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Establishment activity retrieved successfully',
  })
  @ApiParam({ name: 'establishmentId', description: 'Establishment ID' })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days to look back (default: 30)',
  })
  async getEstablishmentActivity(
    @Param('establishmentId') establishmentId: string,
    @Query('days') days: number = 30,
  ): Promise<unknown[]> {
    const result = await this.establishmentManagementService.getEstablishmentActivity(
      establishmentId,
      days,
    );
    return result;
  }

  @Post(':establishmentId/verify-documents')
  @ApiOperation({
    summary: 'Manually verify establishment documents',
    description: 'Manually mark establishment documents as verified',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Establishment documents verified successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Establishment not found',
  })
  @ApiParam({ name: 'establishmentId', description: 'Establishment ID' })
  async verifyEstablishmentDocuments(
    @Param('establishmentId') establishmentId: string,
    @Req() req: { user: { userId: string; email: string } },
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ): Promise<IEstablishment> {
    const admin = req.user;

    const result = await this.establishmentManagementService.verifyEstablishmentDocuments(
      establishmentId,
      admin.userId,
      admin.email,
      ipAddress,
      userAgent,
    );
    return result;
  }
}
