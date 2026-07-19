import { UserRole } from '@foodwaste/shared';
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  NotificationManagementService,
  AdminBroadcastPayload,
} from '../services/notification-management.service';

@ApiTags('Admin — Notification Management')
@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class NotificationManagementController {
  constructor(private readonly notificationManagementService: NotificationManagementService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Platform notification statistics' })
  @ApiResponse({ status: 200, description: 'Notification stats retrieved' })
  async getStats() {
    const stats = await this.notificationManagementService.getNotificationStats();
    return {
      message: 'Notification statistics retrieved successfully',
      data: stats,
    };
  }

  @Post('broadcast')
  @ApiOperation({ summary: 'Send broadcast notification to user segment' })
  @ApiResponse({ status: 201, description: 'Broadcast sent' })
  async sendBroadcast(@Body() payload: AdminBroadcastPayload) {
    const result = await this.notificationManagementService.sendBroadcast(payload);
    return {
      message: `Broadcast sent to ${result.totalProcessed} recipients`,
      data: result,
    };
  }
}
