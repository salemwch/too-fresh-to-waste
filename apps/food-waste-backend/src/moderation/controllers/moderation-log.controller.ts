import { UserRole } from '@foodwaste/shared';
import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
  BadRequestException,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Types } from 'mongoose';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LoggingInterceptor } from '../../common/interceptors/loggin.interceptor';
import { AdminOnlyModerationGuard, ModerationAccessGuard } from '../guards/moderation-access.guard';
import { LogLevel, LogCategory } from '../schemas/moderation-log.schema';
import { ModerationLogService } from '../services/moderation-log.service';

class ModerationLogQueryDto {
  level?: LogLevel;
  category?: LogCategory;
  performedBy?: string;
  targetId?: string;
  startDate?: string;
  endDate?: string;
  tags?: string[];
  isAutomated?: boolean;
  page?: number = 1;
  limit?: number = 20;
  sortBy?: string = 'createdAt';
  sortOrder?: 'asc' | 'desc' = 'desc';
}

@ApiTags('Moderation - Logs')
@ApiBearerAuth()
@Controller('moderation/logs')
@UseGuards(JwtAuthGuard)
@UseInterceptors(LoggingInterceptor)
export class ModerationLogController {
  constructor(private readonly moderationLogService: ModerationLogService) {}

  @Get()
  @ApiOperation({ summary: 'Get moderation logs (Admin only)' })
  @ApiResponse({ status: 200, description: 'Moderation logs retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiQuery({ name: 'level', required: false, enum: LogLevel, description: 'Filter by log level' })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: LogCategory,
    description: 'Filter by log category',
  })
  @ApiQuery({
    name: 'performedBy',
    required: false,
    description: 'Filter by user who performed the action',
  })
  @ApiQuery({ name: 'targetId', required: false, description: 'Filter by target ID' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date for filtering (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date for filtering (ISO format)',
  })
  @ApiQuery({
    name: 'isAutomated',
    required: false,
    type: Boolean,
    description: 'Filter automated vs manual actions',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number for pagination' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of items per page (max 100)' })
  @UseGuards(AdminOnlyModerationGuard)
  async getModerationLogs(@Query(ValidationPipe) queryDto: ModerationLogQueryDto) {
    // Validate ObjectId fields if provided
    if (queryDto.performedBy && !Types.ObjectId.isValid(queryDto.performedBy)) {
      throw new BadRequestException('Invalid performedBy user ID format');
    }

    if (queryDto.targetId && !Types.ObjectId.isValid(queryDto.targetId)) {
      throw new BadRequestException('Invalid target ID format');
    }

    // Parse date strings to Date objects
    const filters: {
      level?: LogLevel;
      category?: LogCategory;
      performedBy?: string;
      targetId?: string;
      isAutomated?: boolean;
      tags?: string[];
      startDate?: Date;
      endDate?: Date;
    } = {
      ...(queryDto.level !== undefined ? { level: queryDto.level } : {}),
      ...(queryDto.category !== undefined ? { category: queryDto.category } : {}),
      ...(queryDto.performedBy !== undefined ? { performedBy: queryDto.performedBy } : {}),
      ...(queryDto.targetId !== undefined ? { targetId: queryDto.targetId } : {}),
      ...(queryDto.isAutomated !== undefined ? { isAutomated: queryDto.isAutomated } : {}),
      ...(queryDto.tags !== undefined ? { tags: queryDto.tags } : {}),
    };

    if (queryDto.startDate) {
      filters.startDate = new Date(queryDto.startDate);
    }

    if (queryDto.endDate) {
      filters.endDate = new Date(queryDto.endDate);
    }

    const sortBy =
      queryDto.sortBy !== null && queryDto.sortBy !== undefined && queryDto.sortBy.length > 0
        ? queryDto.sortBy
        : 'createdAt';
    const sortOrder =
      queryDto.sortOrder !== null &&
      queryDto.sortOrder !== undefined &&
      queryDto.sortOrder.length > 0
        ? queryDto.sortOrder
        : 'desc';
    const pagination = {
      page: Math.max(1, queryDto.page ?? 1),
      limit: Math.min(100, Math.max(1, queryDto.limit ?? 20)),
      sortBy,
      sortOrder,
    };

    const result = await this.moderationLogService.getModerationLogs(filters, pagination);

    return {
      success: true,
      message: 'Moderation logs retrieved successfully',
      data: result.logs,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  @Get('user/:userId/history')
  @ApiOperation({ summary: 'Get moderation history for a specific user' })
  @ApiParam({ name: 'userId', description: 'User ID to get history for' })
  @ApiResponse({ status: 200, description: 'User moderation history retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid user ID format' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @UseGuards(ModerationAccessGuard)
  async getUserModerationHistory(
    @Param('userId') userId: string,
    @Query('limit') limit?: number,
    @CurrentUser('role') userRole?: UserRole,
  ) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const historyLimit = Math.min(50, Math.max(1, limit ?? 10));
    const history = await this.moderationLogService.getUserModerationHistory(userId, historyLimit);

    // Filter sensitive information for moderators
    const filteredHistory =
      userRole === UserRole.MODERATOR
        ? history.map(log => ({
            level: log.level,
            category: log.category,
            action: log.action,
            description: log.description,
            createdAt: (log as { createdAt?: Date }).createdAt,
            isAutomated: log.isAutomated,
            tags: log.tags,
            // Remove sensitive fields like IP addresses, full request context
            performedBy: log.performedBy,
          }))
        : history;

    return {
      success: true,
      message: 'User moderation history retrieved successfully',
      data: filteredHistory,
    };
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get moderation statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Moderation statistics retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date for statistics (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date for statistics (ISO format)',
  })
  @UseGuards(AdminOnlyModerationGuard)
  async getModerationStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const dateFilters: { startDate?: Date; endDate?: Date } = {};

    if (startDate) {
      dateFilters.startDate = new Date(startDate);
    }

    if (endDate) {
      dateFilters.endDate = new Date(endDate);
    }

    const statistics = await this.moderationLogService.getModerationStatistics(
      dateFilters.startDate,
      dateFilters.endDate,
    );

    return {
      success: true,
      message: 'Moderation statistics retrieved successfully',
      data: {
        ...statistics,
        dateRange: {
          startDate: dateFilters.startDate?.toISOString(),
          endDate: dateFilters.endDate?.toISOString(),
        },
      },
    };
  }

  @Get('my-activity')
  @ApiOperation({ summary: 'Get current moderator activity log' })
  @ApiResponse({ status: 200, description: 'Moderator activity retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Moderation access required' })
  @UseGuards(ModerationAccessGuard)
  async getMyModerationActivity(
    @CurrentUser('userId') userId: string,
    @Query('limit') limit?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: { performedBy: string; startDate?: Date; endDate?: Date } = {
      performedBy: userId,
    };

    if (startDate) {
      filters.startDate = new Date(startDate);
    }

    if (endDate) {
      filters.endDate = new Date(endDate);
    }

    const pagination = {
      page: 1,
      limit: Math.min(100, Math.max(1, limit ?? 20)),
      sortBy: 'createdAt',
      sortOrder: 'desc' as const,
    };

    const result = await this.moderationLogService.getModerationLogs(filters, pagination);

    return {
      success: true,
      message: 'Your moderation activity retrieved successfully',
      data: result.logs,
      pagination: {
        total: result.total,
        showing: result.logs.length,
      },
    };
  }
}
