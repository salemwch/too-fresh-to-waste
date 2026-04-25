import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery, UpdateQuery } from 'mongoose';

import { SanitizationUtil } from '../../common/utils/sanitization.util';
import {
  ISendNotificationRequest,
  INotificationContext,
  INotificationMetadata,
  NotificationResult,
} from '../interfaces/notification.interfaces';
import { NotificationPreference } from '../schemas/notification-preference.schema';
import { NotificationTemplate } from '../schemas/notification-template.schema';
import { Notification } from '../schemas/notification.schema';
import {
  NotificationStatus,
  NotificationType,
  NotificationChannel,
  NotificationTrigger,
} from '../types/notification.types';

import { EmailNotificationService } from './email-notification.service';
import { PushNotificationService } from './push-notification.service';
import { SmsNotificationService } from './sms-notification.service';
import { TemplateService } from './template.service';

export interface NotificationStatsResult {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalOpened: number;
  totalClicked: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  byChannel: Record<string, unknown>;
  byTrigger: Record<string, unknown>;
}

interface GroupedNotificationEntry {
  channel?: string;
  trigger?: string;
  status: string;
  isRead?: boolean;
}

interface NotificationStatsAggregateResult {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalOpened: number;
  byChannel: GroupedNotificationEntry[];
  byTrigger: GroupedNotificationEntry[];
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel(Notification.name) private readonly notificationModel: Model<Notification>,
    @InjectModel(NotificationPreference.name)
    private readonly preferencesModel: Model<NotificationPreference>,
    @InjectModel(NotificationTemplate.name)
    private readonly templateModel: Model<NotificationTemplate>,
    private readonly pushService: PushNotificationService,
    private readonly emailService: EmailNotificationService,
    private readonly smsService: SmsNotificationService,
    private readonly templateService: TemplateService,
    private readonly eventEmitter: EventEmitter2,
    private readonly sanitizationUtil: SanitizationUtil,
  ) {}

  async sendNotification(request: ISendNotificationRequest): Promise<NotificationResult> {
    try {
      // Sanitize input to prevent XSS attacks
      const sanitizedRequest = this.sanitizeNotificationRequest(request);
      // Check user preferences
      const canSend = await this.checkUserPreferences(sanitizedRequest);
      if (!canSend) {
        this.logger.log(`Notification blocked by user preferences: ${sanitizedRequest.trigger}`);
        return { success: false, error: 'Blocked by user preferences' };
      }

      // Create notification record
      const notification = await this.createNotificationRecord(sanitizedRequest);

      // Send via appropriate channel
      const result = await this.dispatchNotification(notification, sanitizedRequest);

      // Update notification status
      await this.updateNotificationStatus(notification._id, result);

      // Emit analytics event
      this.eventEmitter.emit('notification.sent', {
        notificationId: notification._id,
        type: sanitizedRequest.type,
        trigger: sanitizedRequest.trigger,
        success: result.success,
        userId: sanitizedRequest.target.userId,
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to send notification: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return { success: false, error: (error as Error).message };
    }
  }

  async sendBulkNotification(requests: ISendNotificationRequest[]): Promise<NotificationResult[]> {
    const results = await Promise.allSettled(
      requests.map(async request => {
        const result = await this.sendNotification(request);
        return result;
      }),
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      this.logger.error(`Bulk notification ${index} failed: ${result.reason}`);
      return {
        success: false,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      };
    });
  }

  async sendTriggeredNotification(
    trigger: NotificationTrigger,
    context: INotificationContext,
    overrides?: Partial<ISendNotificationRequest>,
  ): Promise<NotificationResult[]> {
    // Get templates for this trigger
    const templates = await this.templateModel
      .find({
        trigger,
        isActive: true,
      })
      .limit(50)
      .exec();

    if (templates.length === 0) {
      this.logger.warn(`No active templates found for trigger: ${trigger}`);
      return [];
    }

    // Get user preferences
    const preferences = context.userId ? await this.getUserPreferences(context.userId) : null;

    const notifications: ISendNotificationRequest[] = [];

    for (const template of templates) {
      // Check if user allows this type of notification
      if (preferences && !this.isNotificationAllowed(template.type, preferences)) {
        continue;
      }

      // Sanitize template variables before rendering
      const sanitizedVariables = this.sanitizationUtil.sanitizeTemplateVariables(
        context.variables ?? {},
      );
      // Render template with sanitized variables
      const rendered = this.templateService.render(template, sanitizedVariables);

      notifications.push({
        type: template.type,
        trigger,
        target: { userId: context.userId },
        payload: {
          title: this.sanitizationUtil.sanitizeText(rendered.subject),
          body: this.sanitizationUtil.sanitizeText(rendered.body),
          data: sanitizedVariables,
        },
        templateId: template._id.toString(),
        ...overrides,
      });
    }

    return this.sendBulkNotification(notifications);
  }

  /**
   * Sanitize notification request to prevent XSS attacks
   */
  private sanitizeNotificationRequest(request: ISendNotificationRequest): ISendNotificationRequest {
    // Create a sanitized copy of the request
    const sanitizedRequest: ISendNotificationRequest = {
      ...request,
      payload: this.sanitizationUtil.sanitizeNotificationPayload(request.payload),
    };

    // Validate trigger and type (should be enum values) without changing their values
    if (sanitizedRequest.trigger && typeof sanitizedRequest.trigger === 'string') {
      // Keep original enum value - just validate it doesn't contain malicious content
      if (this.sanitizationUtil.containsSuspiciousContent(sanitizedRequest.trigger)) {
        this.logger.warn('Suspicious trigger value detected', {
          trigger: sanitizedRequest.trigger,
        });
      }
    }

    // Type should remain as enum, don't sanitize as text
    if (sanitizedRequest.type && typeof sanitizedRequest.type === 'string') {
      if (this.sanitizationUtil.containsSuspiciousContent(sanitizedRequest.type)) {
        this.logger.warn('Suspicious type value detected', { type: sanitizedRequest.type });
      }
    }
    if (sanitizedRequest.metadata) {
      sanitizedRequest.metadata = this.sanitizationUtil.sanitizeObjectRecursively(
        sanitizedRequest.metadata,
      ) as INotificationMetadata;
    }
    // Sanitize template ID
    if (sanitizedRequest.templateId) {
      sanitizedRequest.templateId = this.sanitizationUtil.sanitizeText(sanitizedRequest.templateId);
    }

    // Log suspicious content for security monitoring
    const originalPayload = JSON.stringify(request.payload);
    if (this.sanitizationUtil.containsSuspiciousContent(originalPayload)) {
      this.logger.warn(`Potentially malicious notification content detected and sanitized`, {
        userId: request.target?.userId,
        trigger: request.trigger,
        type: request.type,
        suspiciousContent: true,
      });
    }

    return sanitizedRequest;
  }

  private async createNotificationRecord(request: ISendNotificationRequest): Promise<Notification> {
    const notification = new this.notificationModel({
      type: request.type,
      channel: this.getChannelFromTrigger(request.trigger),
      trigger: request.trigger,
      userId: request.target.userId ? new Types.ObjectId(request.target.userId) : undefined,
      establishmentId: request.target.establishmentId
        ? new Types.ObjectId(request.target.establishmentId)
        : undefined,
      title: request.payload.title,
      body: request.payload.body,
      data: request.payload.data,
      image: request.payload.image,
      priority: request.priority ?? 'medium',
      scheduledAt: request.schedule?.sendAt ?? new Date(),
      metadata: {
        ...request.metadata,
        templateId: request.templateId,
      },
    });

    const saved = await notification.save();
    return saved;
  }

  private async dispatchNotification(
    notification: Notification,
    request: ISendNotificationRequest,
  ): Promise<NotificationResult> {
    // Ensure payload is sanitized before sending to any service
    const sanitizedPayload = this.sanitizationUtil.sanitizeNotificationPayload(request.payload);
    let result: NotificationResult;
    switch (request.type) {
      case 'push':
        result = await this.pushService.send(sanitizedPayload, request.target);
        break;
      case 'email':
        result = await this.emailService.send(sanitizedPayload, request.target);
        break;
      case 'sms':
        result = await this.smsService.send(sanitizedPayload, request.target);
        break;
      case 'in_app':
        // In-app notifications are stored in DB and retrieved by client
        result = { success: true, messageId: notification._id.toString() };
        break;
      default:
        throw new Error(`Unsupported notification type: ${request.type}`);
    }
    return result;
  }

  private async updateNotificationStatus(
    notificationId: Types.ObjectId,
    result: NotificationResult,
  ): Promise<void> {
    const update: UpdateQuery<Notification> = {
      status: result.success ? NotificationStatus.SENT : NotificationStatus.FAILED,
    };

    if (result.success) {
      update.sentAt = new Date();
      if (result.messageId) {
        update['metadata.messageId'] = result.messageId;
      }
    } else {
      update.failedAt = new Date();
      update.errorMessage = result.error;
    }

    await this.notificationModel.updateOne({ _id: notificationId }, update);
  }

  private async checkUserPreferences(request: ISendNotificationRequest): Promise<boolean> {
    if (!request.target.userId) {
      return true;
    }

    const preferences = await this.getUserPreferences(request.target.userId);
    if (!preferences) {
      return true;
    }

    return this.isNotificationAllowed(request.type as NotificationType, preferences);
  }

  private async getUserPreferences(userId: string): Promise<NotificationPreference | null> {
    if (!userId) {
      return null;
    }
    const preference = await this.preferencesModel.findOne({ userId: new Types.ObjectId(userId) });
    return preference;
  }

  private isNotificationAllowed(
    type: NotificationType,
    preferences: NotificationPreference,
  ): boolean {
    // Check global preferences first
    switch (type) {
      case NotificationType.PUSH:
        return preferences.globalPushEnabled;
      case NotificationType.EMAIL:
        return preferences.globalEmailEnabled;
      case NotificationType.SMS:
        return preferences.globalSmsEnabled;
      case NotificationType.IN_APP:
        return true;
      default:
        return true;
    }
  }

  private getChannelFromTrigger(trigger: string): NotificationChannel {
    const triggerChannelMap: Record<string, NotificationChannel> = {
      [NotificationTrigger.ORDER_CONFIRMED]: NotificationChannel.ORDER_UPDATES,
      [NotificationTrigger.PICKUP_REMINDER_24H]: NotificationChannel.PICKUP_REMINDERS,
      [NotificationTrigger.PICKUP_REMINDER_2H]: NotificationChannel.PICKUP_REMINDERS,
      [NotificationTrigger.NEW_OFFER_NEARBY]: NotificationChannel.OFFERS,
      [NotificationTrigger.PERSONALIZED_PROMOTION]: NotificationChannel.MARKETING,
      [NotificationTrigger.SECURITY_ALERT]: NotificationChannel.SECURITY,
      [NotificationTrigger.ESTABLISHMENT_APPROVED]: NotificationChannel.ADMIN,
    };

    return triggerChannelMap[trigger] ?? NotificationChannel.ADMIN;
  }

  // Public API methods for retrieving notifications
  async getUserNotifications(
    userId: string,
    options: {
      limit?: number | undefined;
      offset?: number | undefined;
      unreadOnly?: boolean | undefined;
      type?: NotificationType | undefined;
    } = {},
  ): Promise<{ notifications: Notification[]; total: number }> {
    const { limit = 20, offset = 0, unreadOnly = false, type } = options;

    const filter: FilterQuery<Notification> = { userId: new Types.ObjectId(userId) };
    if (unreadOnly) {
      filter.isRead = false;
    }
    if (type !== null && type !== undefined) {
      filter.type = type;
    }

    const [notifications, total] = await Promise.all([
      this.notificationModel.find(filter).sort({ createdAt: -1 }).limit(limit).skip(offset).exec(),
      this.notificationModel.countDocuments(filter),
    ]);

    return { notifications, total };
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.notificationModel.updateOne(
      {
        _id: new Types.ObjectId(notificationId),
        userId: new Types.ObjectId(userId),
      },
      {
        isRead: true,
        readAt: new Date(),
        status: NotificationStatus.READ,
      },
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationModel.updateMany(
      { userId: new Types.ObjectId(userId), isRead: false },
      {
        isRead: true,
        readAt: new Date(),
        status: NotificationStatus.READ,
      },
    );
  }

  async getUnreadCount(userId: string): Promise<number> {
    const count = await this.notificationModel.countDocuments({
      userId: new Types.ObjectId(userId),
      isRead: false,
    });
    return count;
  }

  async getNotificationStats(options: {
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    type?: string | undefined;
    channel?: string | undefined;
  }): Promise<NotificationStatsResult> {
    const matchStage: FilterQuery<Notification> = {};

    if (options.startDate ?? options.endDate) {
      const createdAtRange: { $gte?: Date; $lte?: Date } = {};
      if (options.startDate) {
        createdAtRange.$gte = options.startDate;
      }
      if (options.endDate) {
        createdAtRange.$lte = options.endDate;
      }
      matchStage.createdAt = createdAtRange;
    }

    if (options.type) {
      matchStage.type = options.type;
    }
    if (options.channel) {
      matchStage.channel = options.channel;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalSent: {
            $sum: { $cond: [{ $in: ['$status', ['sent', 'delivered', 'read']] }, 1, 0] },
          },
          totalDelivered: { $sum: { $cond: [{ $in: ['$status', ['delivered', 'read']] }, 1, 0] } },
          totalFailed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          totalOpened: { $sum: { $cond: [{ $eq: ['$isRead', true] }, 1, 0] } },
          byChannel: {
            $push: {
              channel: '$channel',
              status: '$status',
              isRead: '$isRead',
            },
          },
          byTrigger: {
            $push: {
              trigger: '$trigger',
              status: '$status',
              isRead: '$isRead',
            },
          },
        },
      },
    ];

    const result =
      await this.notificationModel.aggregate<NotificationStatsAggregateResult>(pipeline);

    const [data] = result;
    if (data === null || data === undefined) {
      return {
        totalSent: 0,
        totalDelivered: 0,
        totalFailed: 0,
        totalOpened: 0,
        totalClicked: 0,
        deliveryRate: 0,
        openRate: 0,
        clickRate: 0,
        byChannel: {},
        byTrigger: {},
      };
    }
    const deliveryRate =
      data.totalSent > 0 ? Math.round((data.totalDelivered / data.totalSent) * 100 * 100) / 100 : 0;
    const openRate =
      data.totalDelivered > 0
        ? Math.round((data.totalOpened / data.totalDelivered) * 100 * 100) / 100
        : 0;

    // Process grouped stats
    const byChannel = this.processGroupedStats(data.byChannel, 'channel');
    const byTrigger = this.processGroupedStats(data.byTrigger, 'trigger');

    return {
      totalSent: data.totalSent,
      totalDelivered: data.totalDelivered,
      totalFailed: data.totalFailed,
      totalOpened: data.totalOpened,
      totalClicked: 0,
      deliveryRate,
      openRate,
      clickRate: 0,
      byChannel,
      byTrigger,
    };
  }

  private processGroupedStats(
    data: GroupedNotificationEntry[],
    groupField: 'channel' | 'trigger',
  ): Record<
    string,
    { sent: number; delivered: number; failed: number; opened: number; clicked: number }
  > {
    const stats: Record<
      string,
      { sent: number; delivered: number; failed: number; opened: number; clicked: number }
    > = {};

    data.forEach(item => {
      const key = item[groupField] ?? 'unknown';
      stats[key] ??= { sent: 0, delivered: 0, failed: 0, opened: 0, clicked: 0 };

      const bucket = stats[key];
      if (['sent', 'delivered', 'read'].includes(item.status)) {
        bucket.sent++;
      }
      if (['delivered', 'read'].includes(item.status)) {
        bucket.delivered++;
      }
      if (item.status === 'failed') {
        bucket.failed++;
      }
      if (item.isRead === true) {
        bucket.opened++;
      }
    });

    return stats;
  }
}
