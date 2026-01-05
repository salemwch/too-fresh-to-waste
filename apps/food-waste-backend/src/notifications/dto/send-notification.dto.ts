import { IsString, IsOptional, IsEnum, IsObject, IsArray, ValidateNested,  IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType,  NotificationPriority, NotificationTrigger } from '../types/notification.types';

export class LocationTargetDto {
  @ApiProperty({ description: 'Latitude coordinate' })
  @IsNumber()
  latitude: number;

  @ApiProperty({ description: 'Longitude coordinate' })
  @IsNumber()
  longitude: number;

  @ApiProperty({ description: 'Search radius in kilometers' })
  @IsNumber()
  radius: number;
}

export class RecurringScheduleDto {
  @ApiProperty({ enum: ['daily', 'weekly', 'monthly'] })
  @IsEnum(['daily', 'weekly', 'monthly'])
  frequency: 'daily' | 'weekly' | 'monthly';

  @ApiPropertyOptional({ description: 'When to stop recurring (ISO date string)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class NotificationPayloadDto {
  @ApiProperty({ description: 'Notification title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Notification body/message' })
  @IsString()
  body: string;

  @ApiPropertyOptional({ description: 'Additional data to include with notification' })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Image URL for notification' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ description: 'Sound for notification' })
  @IsOptional()
  @IsString()
  sound?: string;

  @ApiPropertyOptional({ description: 'Badge count for push notifications' })
  @IsOptional()
  @IsNumber()
  badge?: number;

  @ApiPropertyOptional({ description: 'Action URL when notification is clicked' })
  @IsOptional()
  @IsString()
  clickAction?: string;
}

export class NotificationTargetDto {
  @ApiPropertyOptional({ description: 'Single user ID to target' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Multiple user IDs to target', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];

  @ApiPropertyOptional({ description: 'Establishment ID to target' })
  @IsOptional()
  @IsString()
  establishmentId?: string;

  @ApiPropertyOptional({ description: 'User segment to target' })
  @IsOptional()
  @IsString()
  segment?: string;

  @ApiPropertyOptional({
    description: 'Location-based targeting',
    type: 'object',
    properties: {
      latitude: { type: 'number' },
      longitude: { type: 'number' },
      radius: { type: 'number', description: 'Radius in kilometers' }
    }
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LocationTargetDto)
  location?: any;
}

export class NotificationScheduleDto {
  @ApiPropertyOptional({ description: 'When to send the notification (ISO date string)' })
  @IsOptional()
  @IsDateString()
  sendAt?: string;

  @ApiPropertyOptional({ description: 'Timezone for scheduling' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Recurring notification settings',
    type: 'object',
    properties: {
      frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
      endDate: { type: 'string', format: 'date-time' }
    }
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RecurringScheduleDto)
  recurring?: any;
}

export class SendNotificationDto {
  @ApiProperty({ enum: NotificationType, description: 'Type of notification to send' })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ enum: NotificationTrigger, description: 'What triggered this notification' })
  @IsEnum(NotificationTrigger)
  trigger: NotificationTrigger;

  @ApiProperty({ description: 'Target recipients', type: NotificationTargetDto })
  @ValidateNested()
  @Type(() => NotificationTargetDto)
  target: NotificationTargetDto;

  @ApiProperty({ description: 'Notification content', type: NotificationPayloadDto })
  @ValidateNested()
  @Type(() => NotificationPayloadDto)
  payload: NotificationPayloadDto;

  @ApiPropertyOptional({ enum: NotificationPriority, description: 'Notification priority' })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({ description: 'Scheduling options', type: NotificationScheduleDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationScheduleDto)
  schedule?: NotificationScheduleDto;

  @ApiPropertyOptional({ description: 'Template ID to use for this notification' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({ description: 'Variables for template rendering' })
  @IsOptional()
  @IsObject()
  templateVariables?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}