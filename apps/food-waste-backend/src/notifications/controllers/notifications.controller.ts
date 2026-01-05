import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
  HttpStatus,
  Logger
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../../admin/guards/admin-only.guard';
import { NotificationService } from '../services/notification.service';
import { NotificationPreferencesService } from '../services/notification-preferences.service';
import {
  SendNotificationDto,
  GetNotificationsQueryDto,
  UpdateNotificationPreferencesDto,
  AddDeviceTokenDto,
  RemoveDeviceTokenDto,
  NotificationStatsQueryDto
} from '../dto';
import {
  NotificationListResponseDto,
  SendNotificationResponseDto,
  NotificationStatsResponseDto,
  NotificationPreferencesResponseDto,
  BulkNotificationResponseDto
} from '../dto/notification-response.dto';
import { NotificationTrigger } from '../types/notification.types';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly preferencesService: NotificationPreferencesService,
  ) {}

  @Post('send')
  @ApiOperation({ summary: 'Send a notification' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification sent successfully',
    type: SendNotificationResponseDto
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid notification data' })
  async sendNotification(@Body() sendNotificationDto: SendNotificationDto): Promise<SendNotificationResponseDto> {
    try {
      // Convert DTO to service request format
      const serviceRequest = this.convertDtoToServiceRequest(sendNotificationDto);
      const result = await this.notificationService.sendNotification(serviceRequest);
      return result;
    } catch (error) {
      this.logger.error(`Failed to send notification: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }

  @Post('send/bulk')
  @ApiOperation({ summary: 'Send multiple notifications' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bulk notifications processed',
    type: BulkNotificationResponseDto
  })
  async sendBulkNotifications(@Body() notifications: SendNotificationDto[]): Promise<BulkNotificationResponseDto> {
    try {
      // Convert DTOs to service request format
      const serviceRequests = notifications.map(dto => this.convertDtoToServiceRequest(dto));
      const results = await this.notificationService.sendBulkNotification(serviceRequests);

      return {
        totalProcessed: results.length,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length,
        results: results as SendNotificationResponseDto[]
      };
    } catch (error) {
      this.logger.error(`Failed to send bulk notifications: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }

  @Post('trigger/:trigger')
  @ApiOperation({ summary: 'Send triggered notification with context' })
  @ApiParam({ name: 'trigger', enum: NotificationTrigger })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Triggered notifications sent',
    type: BulkNotificationResponseDto
  })
  async sendTriggeredNotification(
    @Param('trigger') trigger: NotificationTrigger,
    @Body() context: {
      userId?: string;
      establishmentId?: string;
      orderId?: string;
      offerId?: string;
      variables?: Record<string, any>;
      overrides?: Partial<SendNotificationDto>;
    }
  ): Promise<BulkNotificationResponseDto> {
    try {
      // Convert overrides to service request format if provided
      const convertedOverrides = context.overrides ?
        this.convertDtoToServiceRequest(context.overrides as SendNotificationDto) :
        undefined;

      const results = await this.notificationService.sendTriggeredNotification(
        trigger,
        context,
        convertedOverrides
      );

      return {
        totalProcessed: results.length,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length,
        results: results as SendNotificationResponseDto[]
      };
    } catch (error) {
      this.logger.error(`Failed to send triggered notification: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User notifications retrieved',
    type: NotificationListResponseDto
  })
  async getUserNotifications(
    @Req() req: any,
    @Query() query: GetNotificationsQueryDto
  ): Promise<NotificationListResponseDto> {
    const userId = req.user.userId;

    const { notifications, total } = await this.notificationService.getUserNotifications(userId, {
      limit: query.limit,
      offset: query.offset,
      unreadOnly: query.unreadOnly,
      type: query.type
    });

    return {
      notifications: notifications.map(n => ({
        id: n._id.toString(),
        type: n.type,
        channel: n.channel,
        trigger: n.trigger,
        title: n.title,
        body: n.body,
        data: n.data,
        image: n.image,
        status: n.status,
        priority: n.priority,
        isRead: n.isRead,
        scheduledAt: n.scheduledAt,
        sentAt: n.sentAt,
        deliveredAt: n.deliveredAt,
        readAt: n.readAt,
        failedAt: n.failedAt,
        errorMessage: n.errorMessage,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt
      })) as any,
      total,
      count: notifications.length,
      offset: query.offset || 0,
      limit: query.limit || 20,
      hasMore: (query.offset || 0) + notifications.length < total
    };
  }

  @Get('unread/count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Unread count retrieved',
    schema: { type: 'object', properties: { count: { type: 'number' } } }
  })
  async getUnreadCount(@Req() req: any): Promise<{ count: number }> {
    const userId = req.user.userId;
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Notification marked as read' })
  async markAsRead(@Req() req: any, @Param('id') notificationId: string): Promise<{ success: boolean }> {
    const userId = req.user.userId;
    await this.notificationService.markAsRead(notificationId, userId);
    return { success: true };
  }

  @Patch('read/all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: HttpStatus.OK, description: 'All notifications marked as read' })
  async markAllAsRead(@Req() req: any): Promise<{ success: boolean }> {
    const userId = req.user.userId;
    await this.notificationService.markAllAsRead(userId);
    return { success: true };
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get user notification preferences' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User preferences retrieved',
    type: NotificationPreferencesResponseDto
  })
  async getPreferences(@Req() req: any): Promise<NotificationPreferencesResponseDto> {
    const userId = req.user.userId;
    const preferences = await this.preferencesService.getPreferences(userId);

    return {
      userId,
      channels: Object.fromEntries(preferences.channels || new Map()),
      globalPushEnabled: preferences.globalPushEnabled,
      globalEmailEnabled: preferences.globalEmailEnabled,
      globalSmsEnabled: preferences.globalSmsEnabled,
      quietHours: preferences.quietHours,
      deviceTokens: preferences.deviceTokens,
      language: preferences.language,
      timezone: preferences.timezone,
      locationPreferences: preferences.locationPreferences,
      createdAt: preferences.createdAt,
      updatedAt: preferences.updatedAt
    } as NotificationPreferencesResponseDto;
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update user notification preferences' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Preferences updated successfully',
    type: NotificationPreferencesResponseDto
  })
  async updatePreferences(
    @Req() req: any,
    @Body() updateDto: UpdateNotificationPreferencesDto
  ): Promise<NotificationPreferencesResponseDto> {
    const userId = req.user.userId;
    const preferences = await this.preferencesService.updatePreferences(userId, updateDto);

    return {
      userId,
      channels: Object.fromEntries(preferences.channels || new Map()),
      globalPushEnabled: preferences.globalPushEnabled,
      globalEmailEnabled: preferences.globalEmailEnabled,
      globalSmsEnabled: preferences.globalSmsEnabled,
      quietHours: preferences.quietHours,
      deviceTokens: preferences.deviceTokens,
      language: preferences.language,
      timezone: preferences.timezone,
      locationPreferences: preferences.locationPreferences,
      createdAt: preferences.createdAt,
      updatedAt: preferences.updatedAt
    } as NotificationPreferencesResponseDto;
  }

  @Post('device-token')
  @ApiOperation({ summary: 'Add device token for push notifications' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Device token added successfully' })
  async addDeviceToken(@Req() req: any, @Body() addTokenDto: AddDeviceTokenDto): Promise<{ success: boolean }> {
    const userId = req.user.userId;
    await this.preferencesService.addDeviceToken(userId, addTokenDto.deviceToken);
    return { success: true };
  }

  @Delete('device-token')
  @ApiOperation({ summary: 'Remove device token' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Device token removed successfully' })
  async removeDeviceToken(@Req() req: any, @Body() removeTokenDto: RemoveDeviceTokenDto): Promise<{ success: boolean }> {
    const userId = req.user.userId;
    await this.preferencesService.removeDeviceToken(userId, removeTokenDto.deviceToken);
    return { success: true };
  }

  @Get('stats')
  @UseGuards(AdminOnlyGuard)
  @ApiOperation({ summary: 'Get notification statistics (Admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification statistics',
    type: NotificationStatsResponseDto
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admin access required' })
  async getStats(@Query() query: NotificationStatsQueryDto): Promise<NotificationStatsResponseDto> {
    const stats = await this.notificationService.getNotificationStats({
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      type: query.type,
      channel: query.channel
    });

    return stats as NotificationStatsResponseDto;
  }


  private convertDtoToServiceRequest(dto: SendNotificationDto | Partial<SendNotificationDto>): any {
    const serviceRequest: any = { ...dto };

    // Convert schedule.sendAt from string to Date if present
    if (serviceRequest.schedule?.sendAt) {
      if (typeof serviceRequest.schedule.sendAt === 'string') {
        serviceRequest.schedule = {
          ...serviceRequest.schedule,
          sendAt: new Date(serviceRequest.schedule.sendAt)
        };
      }
    }

    return serviceRequest;
  }
}