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
import { ModerationAccessGuard, AdminOnlyModerationGuard } from '../guards/moderation-access.guard';
import { ModerationActionRateLimitGuard } from '../guards/moderation-rate-limit.guard';
import { LoggingInterceptor } from '../../common/interceptors/loggin.interceptor';
import { ModerationActionService } from '../services/moderation-action.service';
import { CreateModerationActionDto, UpdateModerationActionDto, BulkModerationActionDto } from '../dtos/moderation-action.dto';
import { ModerationActionQueryDto } from '../dtos/report-query.dto';
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

@ApiTags('Moderation - Actions')
@ApiBearerAuth()
@Controller('moderation/actions')
@UseGuards(JwtAuthGuard)
@UseInterceptors(LoggingInterceptor)
export class ModerationActionController {
    constructor(private readonly moderationActionService: ModerationActionService) {}

    @Post()
    @ApiOperation({ summary: 'Create a moderation action (Admin/Moderator only)' })
    @ApiResponse({ status: 201, description: 'Moderation action created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid input or conflicting action' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
    @HttpCode(HttpStatus.CREATED)
    @UseGuards(ModerationAccessGuard, ModerationActionRateLimitGuard)
    async createModerationAction(
        @Body(ValidationPipe) createActionDto: CreateModerationActionDto,
        @CurrentUser('id') moderatorId: string,
        @CurrentUser('role') moderatorRole: UserRole,
        @IpAddress() ipAddress: string,
        @Request() req: AuthenticatedRequest
    ) {
        // Validate MongoDB ObjectIds
        if (!Types.ObjectId.isValid(createActionDto.targetUserId)) {
            throw new BadRequestException('Invalid target user ID format');
        }

        if (createActionDto.relatedReportId && !Types.ObjectId.isValid(createActionDto.relatedReportId)) {
            throw new BadRequestException('Invalid report ID format');
        }

        const requestContext = {
            ipAddress,
            userAgent: req.headers['user-agent'],
            endpoint: req.url,
            location: {
                // You can integrate with a geolocation service here
                country: req.headers['cf-ipcountry'] as string, // Cloudflare example
                region: req.headers['cf-region'] as string,
                city: req.headers['cf-ipcity'] as string
            }
        };

        const moderationAction = await this.moderationActionService.createModerationAction(
            createActionDto,
            moderatorId,
            moderatorRole,
            requestContext
        );

        return {
            success: true,
            message: 'Moderation action created successfully',
            data: {
                id: moderationAction._id,
                actionType: moderationAction.actionType,
                targetUserId: moderationAction.targetUserId,
                severity: moderationAction.severity,
                status: moderationAction.status,
                expiresAt: moderationAction.expiresAt,
                createdAt: (moderationAction as any).createdAt
            }
        };
    }

    @Get()
    @ApiOperation({ summary: 'Get moderation actions with filtering' })
    @ApiResponse({ status: 200, description: 'Moderation actions retrieved successfully' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    @ApiQuery({ name: 'targetUserId', required: false, description: 'Filter by target user ID' })
    @ApiQuery({ name: 'actionType', required: false, description: 'Filter by action type' })
    @ApiQuery({ name: 'status', required: false, description: 'Filter by action status' })
    @ApiQuery({ name: 'page', required: false, description: 'Page number for pagination' })
    @ApiQuery({ name: 'limit', required: false, description: 'Number of items per page' })
    @UseGuards(ModerationAccessGuard)
    async getModerationActions(
        @Query(ValidationPipe) queryDto: ModerationActionQueryDto,
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: UserRole
    ) {
        const result = await this.moderationActionService.getModerationActions(
            queryDto,
            userId,
            userRole
        );

        return {
            success: true,
            message: 'Moderation actions retrieved successfully',
            data: result.actions,
            pagination: {
                page: queryDto.page,
                limit: queryDto.limit,
                total: result.total,
                totalPages: result.totalPages
            }
        };
    }

    @Get('user/:userId')
    @ApiOperation({ summary: 'Get active actions for a specific user' })
    @ApiParam({ name: 'userId', description: 'User ID to check actions for' })
    @ApiResponse({ status: 200, description: 'User actions retrieved successfully' })
    @ApiResponse({ status: 400, description: 'Invalid user ID format' })
    @UseGuards(ModerationAccessGuard)
    async getUserActiveActions(
        @Param('userId') userId: string
    ) {
        if (!Types.ObjectId.isValid(userId)) {
            throw new BadRequestException('Invalid user ID format');
        }

        const actions = await this.moderationActionService.getUserActiveActions(userId);

        return {
            success: true,
            message: 'User active actions retrieved successfully',
            data: actions
        };
    }

    @Patch(':id/revoke')
    @ApiOperation({ summary: 'Revoke a moderation action' })
    @ApiParam({ name: 'id', description: 'Moderation action ID' })
    @ApiResponse({ status: 200, description: 'Action revoked successfully' })
    @ApiResponse({ status: 404, description: 'Action not found' })
    @ApiResponse({ status: 400, description: 'Action cannot be revoked' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    @UseGuards(ModerationAccessGuard)
    async revokeModerationAction(
        @Param('id') actionId: string,
        @Body('revocationReason', ValidationPipe) revocationReason: string,
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: UserRole,
        @IpAddress() ipAddress: string,
        @Request() req: AuthenticatedRequest
    ) {
        if (!Types.ObjectId.isValid(actionId)) {
            throw new BadRequestException('Invalid action ID format');
        }

        const requestContext = {
            ipAddress,
            userAgent: req.headers['user-agent']
        };

        const revokedAction = await this.moderationActionService.revokeModerationAction(
            actionId,
            revocationReason,
            userId,
            userRole,
            requestContext
        );

        return {
            success: true,
            message: 'Moderation action revoked successfully',
            data: revokedAction
        };
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update a moderation action' })
    @ApiParam({ name: 'id', description: 'Moderation action ID' })
    @ApiResponse({ status: 200, description: 'Action updated successfully' })
    @ApiResponse({ status: 404, description: 'Action not found' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    @UseGuards(ModerationAccessGuard)
    async updateModerationAction(
        @Param('id') actionId: string,
        @Body(ValidationPipe) updateDto: UpdateModerationActionDto,
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: UserRole,
        @IpAddress() ipAddress: string,
        @Request() req: AuthenticatedRequest
    ) {
        if (!Types.ObjectId.isValid(actionId)) {
            throw new BadRequestException('Invalid action ID format');
        }

        const requestContext = {
            ipAddress,
            userAgent: req.headers['user-agent']
        };

        const updatedAction = await this.moderationActionService.updateModerationAction(
            actionId,
            updateDto,
            userId,
            userRole,
            requestContext
        );

        return {
            success: true,
            message: 'Moderation action updated successfully',
            data: updatedAction
        };
    }

    @Post('bulk')
    @ApiOperation({ summary: 'Apply bulk moderation actions (Admin only)' })
    @ApiResponse({ status: 201, description: 'Bulk actions processed successfully' })
    @ApiResponse({ status: 403, description: 'Admin access required' })
    @ApiResponse({ status: 400, description: 'Invalid input data' })
    @HttpCode(HttpStatus.CREATED)
    @UseGuards(AdminOnlyModerationGuard, ModerationActionRateLimitGuard)
    async createBulkModerationActions(
        @Body(ValidationPipe) bulkActionDto: BulkModerationActionDto,
        @CurrentUser('id') adminId: string,
        @CurrentUser('role') adminRole: UserRole,
        @IpAddress() ipAddress: string,
        @Request() req: AuthenticatedRequest
    ) {
        // Validate all user IDs
        for (const userId of bulkActionDto.targetUserIds) {
            if (!Types.ObjectId.isValid(userId)) {
                throw new BadRequestException(`Invalid user ID format: ${userId}`);
            }
        }

        const requestContext = {
            ipAddress,
            userAgent: req.headers['user-agent']
        };

        const result = await this.moderationActionService.createBulkModerationActions(
            bulkActionDto,
            adminId,
            adminRole,
            requestContext
        );

        return {
            success: true,
            message: `Bulk action completed. ${result.successful.length} successful, ${result.failed.length} failed`,
            data: {
                successful: result.successful.map(action => ({
                    id: action._id,
                    targetUserId: action.targetUserId,
                    actionType: action.actionType,
                    status: action.status
                })),
                failed: result.failed,
                summary: {
                    total: bulkActionDto.targetUserIds.length,
                    successful: result.successful.length,
                    failed: result.failed.length
                }
            }
        };
    }
}