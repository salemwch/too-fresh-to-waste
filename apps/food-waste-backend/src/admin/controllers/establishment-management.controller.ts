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
  Logger,
  Req
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../guards/admin-only.guard';
import { EstablishmentManagementService } from '../services/establishment-management.service';
import {
  ApproveEstablishmentDto,
  UpdateEstablishmentStatusDto,
  EstablishmentSearchDto,
  EstablishmentStatsDto
} from '../dto/establishment-management.dto';
import { IpAddress, UserAgent } from '../decorators';
import { IEstablishment, IEstablishmentOverview, IEstablishmentStats, IEstablishmentListResponse } from '../../common/interfaces/establishment.interface';

@ApiTags('Admin Establishment Management')
@Controller('admin/establishments')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@ApiBearerAuth()
export class EstablishmentManagementController {
  private readonly logger = new Logger(EstablishmentManagementController.name);

  constructor(
    private readonly establishmentManagementService: EstablishmentManagementService,
  ) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Get establishment overview',
    description: 'Get overview statistics and metrics for all establishments'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Establishment overview retrieved successfully'
  })
  getEstablishmentOverview(): Promise<IEstablishmentOverview> {
    return this.establishmentManagementService.getEstablishmentOverview();
  }

  @Get('pending-approvals')
  @ApiOperation({
    summary: 'Get pending establishment approvals',
    description: 'Retrieve establishments waiting for approval'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pending approvals retrieved successfully'
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of results (default: 50)' })
  getPendingApprovals(
    @Query('limit') limit?: number
  ): Promise<IEstablishment[]> {
    return this.establishmentManagementService.getPendingApprovals(limit || 50);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search establishments',
    description: 'Search and filter establishments with pagination'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Establishments retrieved successfully'
  })
  @ApiQuery({ name: 'search', required: false, description: 'Search term for name, description, or email' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'active', 'suspended', 'rejected', 'inactive'] })
  @ApiQuery({ name: 'type', required: false, enum: ['restaurant', 'bakery', 'grocery_store', 'cafe', 'fast_food', 'supermarket', 'other'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  searchEstablishments(
    @Query() query: EstablishmentSearchDto
  ): Promise<IEstablishmentListResponse> {
    return this.establishmentManagementService.searchEstablishments(query);
  }

  @Get(':establishmentId')
  @ApiOperation({
    summary: 'Get establishment by ID',
    description: 'Retrieve detailed information about a specific establishment'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Establishment retrieved successfully'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Establishment not found'
  })
  @ApiParam({ name: 'establishmentId', description: 'Establishment ID' })
   getEstablishmentById(
    @Param('establishmentId') establishmentId: string
  ): Promise<IEstablishment> {
    return  this.establishmentManagementService.getEstablishmentById(establishmentId);
  }

  @Post(':establishmentId/approve')
  @ApiOperation({
    summary: 'Approve or reject establishment',
    description: 'Approve or reject a pending establishment application'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Establishment approval status updated successfully'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Establishment not found'
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Only pending establishments can be approved or rejected'
  })
  @ApiParam({ name: 'establishmentId', description: 'Establishment ID' })
   approveEstablishment(
    @Param('establishmentId') establishmentId: string,
    @Body() approveDto: ApproveEstablishmentDto,
    @Req() req: { user: { userId: string; email: string } },
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string
  ): Promise<IEstablishment> {
    const admin = req.user;

    return  this.establishmentManagementService.approveEstablishment(
      establishmentId,
      approveDto,
      admin.userId,
      admin.email,
      ipAddress,
      userAgent
    );
  }

  @Patch(':establishmentId/status')
  @ApiOperation({
    summary: 'Update establishment status',
    description: 'Update the status of a specific establishment (suspend, activate, etc.)'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Establishment status updated successfully'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Establishment not found'
  })
  @ApiParam({ name: 'establishmentId', description: 'Establishment ID' })
   updateEstablishmentStatus(
    @Param('establishmentId') establishmentId: string,
    @Body() updateDto: UpdateEstablishmentStatusDto,
    @Req() req: { user: { userId: string; email: string } },
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string
  ): Promise<IEstablishment> {
    const admin = req.user;

    return  this.establishmentManagementService.updateEstablishmentStatus(
      establishmentId,
      updateDto,
      admin.userId,
      admin.email,
      ipAddress,
      userAgent
    );
  }

  @Get(':establishmentId/stats')
  @ApiOperation({
    summary: 'Get establishment statistics',
    description: 'Get detailed statistics for a specific establishment'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Establishment statistics retrieved successfully'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Establishment not found'
  })
  @ApiParam({ name: 'establishmentId', description: 'Establishment ID' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date for statistics (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date for statistics (ISO string)' })
  @ApiQuery({ name: 'includeDetails', required: false, type: Boolean, description: 'Include detailed breakdown' })
   getEstablishmentStats(
    @Param('establishmentId') establishmentId: string,
    @Query() statsDto: EstablishmentStatsDto
  ): Promise<IEstablishmentStats> {
    return  this.establishmentManagementService.getEstablishmentStats(establishmentId, statsDto);
  }

  @Get(':establishmentId/activity')
  @ApiOperation({
    summary: 'Get establishment activity',
    description: 'Get activity history for a specific establishment'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Establishment activity retrieved successfully'
  })
  @ApiParam({ name: 'establishmentId', description: 'Establishment ID' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to look back (default: 30)' })
   getEstablishmentActivity(
    @Param('establishmentId') establishmentId: string,
    @Query('days') days: number = 30
  ): Promise<unknown[]> {
    return  this.establishmentManagementService.getEstablishmentActivity(establishmentId, days);
  }

  @Post(':establishmentId/verify-documents')
  @ApiOperation({
    summary: 'Manually verify establishment documents',
    description: 'Manually mark establishment documents as verified'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Establishment documents verified successfully'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Establishment not found'
  })
  @ApiParam({ name: 'establishmentId', description: 'Establishment ID' })
   verifyEstablishmentDocuments(
    @Param('establishmentId') establishmentId: string,
    @Req() req: { user: { userId: string; email: string } },
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string
  ): Promise<IEstablishment> {
    const admin = req.user;

    return  this.establishmentManagementService.verifyEstablishmentDocuments(
      establishmentId,
      admin.userId,
      admin.email,
      ipAddress,
      userAgent
    );
  }
}