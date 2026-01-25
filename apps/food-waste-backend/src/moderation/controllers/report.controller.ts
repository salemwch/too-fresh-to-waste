import {
    Controller,
    Get,
    Post,
    Patch,
    Body,
    Param,
    Query,
    UseGuards,
    HttpStatus,
    HttpCode,
    UseInterceptors,
    Request,
    ValidationPipe,
    BadRequestException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ModerationAccessGuard, AdminOnlyModerationGuard, ReportOwnershipGuard } from '../guards/moderation-access.guard';
import { ModerationReportRateLimitGuard } from '../guards/moderation-rate-limit.guard';
import { LoggingInterceptor } from '../../common/interceptors/loggin.interceptor';
import { ReportService } from '../services/report.service';
import { CreateReportDto } from '../dtos/create-report.dto';
import { ReportQueryDto, ReportUpdateDto } from '../dtos/report-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IpAddress } from '../../admin/decorators/ip-address.decorator';
import { UserRole } from '../../common/enums/user.enum';

interface AuthenticatedRequest extends Request {
    user: {
        id: string;
        role: UserRole;
        email: string;
    };
    moderatorRole?: UserRole;
}

@ApiTags('Moderation - Reports')
@ApiBearerAuth()
@Controller('moderation/reports')
@UseGuards(JwtAuthGuard)
@UseInterceptors(LoggingInterceptor)
export class ReportController {
    constructor(private readonly reportService: ReportService) {}

    @Post()
    @ApiOperation({ summary: 'Create a new report' })
    @ApiResponse({ status: 201, description: 'Report created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid input or duplicate report' })
    @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
    @HttpCode(HttpStatus.CREATED)
    @UseGuards(ModerationReportRateLimitGuard)
    async createReport(
        @Body(ValidationPipe) createReportDto: CreateReportDto,
        @CurrentUser('id') userId: string,
        @IpAddress() ipAddress: string,
        @Request() req: AuthenticatedRequest
    ) {
        // Additional validation for MongoDB ObjectId
        if (!Types.ObjectId.isValid(createReportDto.targetId)) {
            throw new BadRequestException('Invalid target ID format');
        }

        const requestContext = {
            ipAddress,
            userAgent: req.headers['user-agent'],
            endpoint: req.url
        };

        const report = await this.reportService.createReport(
            createReportDto,
            userId,
            requestContext
        );

        return {
            success: true,
            message: 'Report submitted successfully',
            data: {
                id: report._id,
                type: report.type,
                status: report.status,
                priority: report.priority,
                createdAt: (report as any).createdAt
            }
        };
    }

    @Get()
    @ApiOperation({ summary: 'Get reports with filtering (Admin/Moderator only)' })
    @ApiResponse({ status: 200, description: 'Reports retrieved successfully' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    @ApiQuery({ name: 'type', required: false, description: 'Filter by report type' })
    @ApiQuery({ name: 'status', required: false, description: 'Filter by report status' })
    @ApiQuery({ name: 'priority', required: false, description: 'Filter by priority level' })
    @ApiQuery({ name: 'page', required: false, description: 'Page number for pagination' })
    @ApiQuery({ name: 'limit', required: false, description: 'Number of items per page' })
    @UseGuards(ModerationAccessGuard)
    async getReports(
        @Query(ValidationPipe) queryDto: ReportQueryDto,
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: UserRole
    ) {
        const result = await this.reportService.getReports(queryDto, userId, userRole);

        return {
            success: true,
            message: 'Reports retrieved successfully',
            data: result.reports,
            pagination: {
                page: queryDto.page,
                limit: queryDto.limit,
                total: result.total,
                totalPages: result.totalPages
            }
        };
    }

    @Get('dashboard/stats')
    @ApiOperation({ summary: 'Get moderation dashboard statistics' })
    @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
    @UseGuards(ModerationAccessGuard)
    async getDashboardStats(
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: UserRole
    ) {
        const stats = await this.reportService.getDashboardStats(userId, userRole);

        return {
            success: true,
            message: 'Dashboard statistics retrieved successfully',
            data: stats
        };
    }

    @Get('assigned-to-me')
    @ApiOperation({ summary: 'Get reports assigned to current moderator' })
    @ApiResponse({ status: 200, description: 'Assigned reports retrieved successfully' })
    @UseGuards(ModerationAccessGuard)
    async getMyAssignedReports(
        @CurrentUser('id') userId: string,
        @Query('status') status?: string
    ) {
        const reports = await this.reportService.getMyAssignedReports(userId, status as any);

        return {
            success: true,
            message: 'Assigned reports retrieved successfully',
            data: reports
        };
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a specific report by ID' })
    @ApiParam({ name: 'id', description: 'Report ID' })
    @ApiResponse({ status: 200, description: 'Report retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Report not found' })
    @ApiResponse({ status: 403, description: 'Access denied' })
    @UseGuards(ReportOwnershipGuard)
    async getReportById(
        @Param('id') reportId: string,
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: UserRole
    ) {
        if (!Types.ObjectId.isValid(reportId)) {
            throw new BadRequestException('Invalid report ID format');
        }

        const report = await this.reportService.getReportById(reportId, userId, userRole);

        return {
            success: true,
            message: 'Report retrieved successfully',
            data: report
        };
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update a report (Admin/Moderator only)' })
    @ApiParam({ name: 'id', description: 'Report ID' })
    @ApiResponse({ status: 200, description: 'Report updated successfully' })
    @ApiResponse({ status: 404, description: 'Report not found' })
    @ApiResponse({ status: 403, description: 'Access denied' })
    @UseGuards(ReportOwnershipGuard)
    async updateReport(
        @Param('id') reportId: string,
        @Body(ValidationPipe) updateDto: ReportUpdateDto,
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: UserRole,
        @IpAddress() ipAddress: string,
        @Request() req: AuthenticatedRequest
    ) {
        if (!Types.ObjectId.isValid(reportId)) {
            throw new BadRequestException('Invalid report ID format');
        }

        const requestContext = {
            ipAddress,
            userAgent: req.headers['user-agent']
        };

        const updatedReport = await this.reportService.updateReport(
            reportId,
            updateDto,
            userId,
            userRole,
            requestContext
        );

        return {
            success: true,
            message: 'Report updated successfully',
            data: updatedReport
        };
    }

    @Post(':id/assign')
    @ApiOperation({ summary: 'Assign report to moderator (Admin only)' })
    @ApiParam({ name: 'id', description: 'Report ID' })
    @ApiResponse({ status: 200, description: 'Report assigned successfully' })
    @ApiResponse({ status: 404, description: 'Report not found' })
    @ApiResponse({ status: 403, description: 'Admin access required' })
    @UseGuards(AdminOnlyModerationGuard)
    async assignReport(
        @Param('id') reportId: string,
        @Body('moderatorId', ValidationPipe) moderatorId: string,
        @CurrentUser('id') adminId: string,
        @IpAddress() ipAddress: string,
        @Request() req: AuthenticatedRequest
    ) {
        if (!Types.ObjectId.isValid(reportId) || !Types.ObjectId.isValid(moderatorId)) {
            throw new BadRequestException('Invalid ID format');
        }

        const requestContext = {
            ipAddress,
            userAgent: req.headers['user-agent']
        };

        const updatedReport = await this.reportService.assignReport(
            reportId,
            moderatorId,
            adminId,
            requestContext
        );

        return {
            success: true,
            message: 'Report assigned successfully',
            data: updatedReport
        };
    }
}