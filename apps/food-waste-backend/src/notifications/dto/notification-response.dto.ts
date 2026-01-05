import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType, NotificationStatus, NotificationChannel, NotificationPriority, NotificationTrigger } from '../types/notification.types';

export class NotificationResponseDto {
  @ApiProperty({ description: 'Notification ID' })
  id: string;

  @ApiProperty({ enum: NotificationType, description: 'Notification type' })
  type: NotificationType;

  @ApiProperty({ enum: NotificationChannel, description: 'Notification channel' })
  channel: NotificationChannel;

  @ApiProperty({ enum: NotificationTrigger, description: 'What triggered this notification' })
  trigger: NotificationTrigger;

  @ApiProperty({ description: 'Notification title' })
  title: string;

  @ApiProperty({ description: 'Notification body/message' })
  body: string;

  @ApiPropertyOptional({ description: 'Additional notification data' })
  data?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Notification image URL' })
  image?: string;

  @ApiProperty({ enum: NotificationStatus, description: 'Current notification status' })
  status: NotificationStatus;

  @ApiProperty({ enum: NotificationPriority, description: 'Notification priority' })
  priority: NotificationPriority;

  @ApiProperty({ description: 'Whether notification has been read' })
  isRead: boolean;

  @ApiPropertyOptional({ description: 'When notification was scheduled to be sent' })
  scheduledAt?: Date;

  @ApiPropertyOptional({ description: 'When notification was actually sent' })
  sentAt?: Date;

  @ApiPropertyOptional({ description: 'When notification was delivered' })
  deliveredAt?: Date;

  @ApiPropertyOptional({ description: 'When notification was read' })
  readAt?: Date;

  @ApiPropertyOptional({ description: 'When notification failed' })
  failedAt?: Date;

  @ApiPropertyOptional({ description: 'Error message if notification failed' })
  errorMessage?: string;

  @ApiProperty({ description: 'When notification was created' })
  createdAt: Date;

  @ApiProperty({ description: 'When notification was last updated' })
  updatedAt: Date;
}

export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationResponseDto], description: 'List of notifications' })
  notifications: NotificationResponseDto[];

  @ApiProperty({ description: 'Total number of notifications matching criteria' })
  total: number;

  @ApiProperty({ description: 'Number of notifications returned in this response' })
  count: number;

  @ApiProperty({ description: 'Number of notifications skipped' })
  offset: number;

  @ApiProperty({ description: 'Maximum number of notifications requested' })
  limit: number;

  @ApiProperty({ description: 'Whether there are more notifications available' })
  hasMore: boolean;
}

export class NotificationStatsResponseDto {
  @ApiProperty({ description: 'Total notifications sent in period' })
  totalSent: number;

  @ApiProperty({ description: 'Total notifications delivered in period' })
  totalDelivered: number;

  @ApiProperty({ description: 'Total notifications that failed in period' })
  totalFailed: number;

  @ApiProperty({ description: 'Total notifications opened/read in period' })
  totalOpened: number;

  @ApiProperty({ description: 'Delivery rate as percentage (0-100)' })
  deliveryRate: number;

  @ApiProperty({ description: 'Open rate as percentage (0-100)' })
  openRate: number;

  @ApiProperty({
    description: 'Statistics broken down by channel',
    type: 'object',
    additionalProperties: {
      type: 'object',
      properties: {
        sent: { type: 'number' },
        delivered: { type: 'number' },
        failed: { type: 'number' },
        opened: { type: 'number' }
      }
    }
  })
  byChannel: Record<string, {
    sent: number;
    delivered: number;
    failed: number;
    opened: number;
  }>;

  @ApiProperty({
    description: 'Statistics broken down by trigger',
    type: 'object',
    additionalProperties: {
      type: 'object',
      properties: {
        sent: { type: 'number' },
        delivered: { type: 'number' },
        failed: { type: 'number' },
        opened: { type: 'number' }
      }
    }
  })
  byTrigger: Record<string, {
    sent: number;
    delivered: number;
    failed: number;
    opened: number;
  }>;

  @ApiPropertyOptional({
    description: 'Time-series data if groupBy was specified',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        period: { type: 'string' },
        sent: { type: 'number' },
        delivered: { type: 'number' },
        failed: { type: 'number' },
        opened: { type: 'number' }
      }
    }
  })
  timeSeries?: Array<{
    period: string;
    sent: number;
    delivered: number;
    failed: number;
    opened: number;
  }>;
}

export class SendNotificationResponseDto {
  @ApiProperty({ description: 'Whether the notification was sent successfully' })
  success: boolean;

  @ApiPropertyOptional({ description: 'Unique message ID from the notification provider' })
  messageId?: string;

  @ApiPropertyOptional({ description: 'Error message if sending failed' })
  error?: string;

  @ApiPropertyOptional({ description: 'Current delivery status' })
  deliveryStatus?: 'sent' | 'delivered' | 'failed';

  @ApiPropertyOptional({ description: 'Additional metadata from the notification provider' })
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Notification ID in our system' })
  notificationId?: string;
}

export class BulkNotificationResponseDto {
  @ApiProperty({ description: 'Total number of notifications processed' })
  totalProcessed: number;

  @ApiProperty({ description: 'Number of notifications sent successfully' })
  successCount: number;

  @ApiProperty({ description: 'Number of notifications that failed' })
  failureCount: number;

  @ApiProperty({ type: [SendNotificationResponseDto], description: 'Individual results for each notification' })
  results: SendNotificationResponseDto[];
}

export class NotificationPreferencesResponseDto {
  @ApiProperty({ description: 'User ID these preferences belong to' })
  userId: string;

  @ApiProperty({
    description: 'Channel-specific notification preferences',
    type: 'object',
    additionalProperties: {
      type: 'object',
      properties: {
        push: { type: 'boolean' },
        email: { type: 'boolean' },
        sms: { type: 'boolean' }
      }
    }
  })
  channels: Record<string, {
    push: boolean;
    email: boolean;
    sms: boolean;
  }>;

  @ApiProperty({ description: 'Global push notification setting' })
  globalPushEnabled: boolean;

  @ApiProperty({ description: 'Global email notification setting' })
  globalEmailEnabled: boolean;

  @ApiProperty({ description: 'Global SMS notification setting' })
  globalSmsEnabled: boolean;

  @ApiPropertyOptional({ description: 'Quiet hours configuration' })
  quietHours?: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };

  @ApiProperty({ type: [String], description: 'Registered device tokens' })
  deviceTokens: string[];

  @ApiPropertyOptional({ description: 'User\'s preferred language' })
  language?: string;

  @ApiPropertyOptional({ description: 'User\'s timezone' })
  timezone?: string;

  @ApiPropertyOptional({ description: 'Location-based notification preferences' })
  locationPreferences?: {
    radius: number;
    enableNearbyOffers: boolean;
    savedLocations: Array<{
      name: string;
      latitude: number;
      longitude: number;
      radius: number;
    }>;
  };

  @ApiProperty({ description: 'When preferences were created' })
  createdAt: Date;

  @ApiProperty({ description: 'When preferences were last updated' })
  updatedAt: Date;

}