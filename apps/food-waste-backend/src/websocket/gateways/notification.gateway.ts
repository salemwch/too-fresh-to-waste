import { Injectable, Logger } from '@nestjs/common';
import { WebSocketService } from '../websocket.service';
import { NotificationEvent, WebSocketEvents } from '../interfaces/websocket.interface';

@Injectable()
export class NotificationGateway {
  private readonly logger = new Logger(NotificationGateway.name);

  constructor(private readonly webSocketService: WebSocketService) {}

  /**
   * Send a single notification to a user
   */
  sendNotification(notification: NotificationEvent): void {
    try {
      this.webSocketService.sendNotification(notification);
      this.logger.log(`Notification sent to user ${notification.userId}: ${notification.title}`);
    } catch (error) {
      this.logger.error('Failed to send notification:', error);
    }
  }

  /**
   * Send bulk notifications to multiple users
   */
  sendBulkNotifications(notifications: NotificationEvent[]): void {
    try {
      const userNotifications = new Map<string, NotificationEvent[]>();

      // Group notifications by user
      for (const notification of notifications) {
        if (!userNotifications.has(notification.userId)) {
          userNotifications.set(notification.userId, []);
        }
        userNotifications.get(notification.userId)!.push(notification);
      }

      // Send grouped notifications
      for (const [userId, userNotifs] of userNotifications.entries()) {
        this.webSocketService.sendToUser(userId, WebSocketEvents.NOTIFICATION_BULK, {
          notifications: userNotifs,
          count: userNotifs.length,
          timestamp: new Date(),
        });
      }

      this.logger.log(`Bulk notifications sent: ${notifications.length} notifications to ${userNotifications.size} users`);
    } catch (error) {
      this.logger.error('Failed to send bulk notifications:', error);
    }
  }

  /**
   * Send system-wide announcement
   */
  sendSystemAnnouncement(
    title: string,
    message: string,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
    data?: Record<string, any>
  ): void {
    try {
      const announcement = {
        id: `system_${Date.now()}`,
        type: 'system' as const,
        title,
        message,
        priority,
        data: data || {},
        createdAt: new Date(),
      };

      this.webSocketService.broadcast(WebSocketEvents.SYSTEM_ANNOUNCEMENT, announcement);
      this.logger.log(`System announcement broadcasted: ${title}`);
    } catch (error) {
      this.logger.error('Failed to send system announcement:', error);
    }
  }

  /**
   * Send maintenance notification
   */
  sendMaintenanceNotification(
    message: string,
    scheduledTime: Date,
    estimatedDuration: number // in minutes
  ): void {
    try {
      const notification = {
        id: `maintenance_${Date.now()}`,
        type: 'system' as const,
        title: '🔧 Scheduled Maintenance',
        message,
        priority: 'high' as const,
        data: {
          scheduledTime,
          estimatedDuration,
          maintenanceType: 'scheduled',
        },
        createdAt: new Date(),
      };

      this.webSocketService.broadcast(WebSocketEvents.SYSTEM_MAINTENANCE, notification);
      this.logger.log(`Maintenance notification sent for ${scheduledTime}`);
    } catch (error) {
      this.logger.error('Failed to send maintenance notification:', error);
    }
  }

  /**
   * Send promotional notification to targeted users
   */
  sendPromotion(
    userIds: string[],
    title: string,
    message: string,
    promotionData: {
      code?: string;
      discount?: number;
      validUntil?: Date;
      termsUrl?: string;
    }
  ): void {
    try {
      for (const userId of userIds) {
        const notification: NotificationEvent = {
          id: `promo_${Date.now()}_${userId}`,
          userId,
          type: 'promotion',
          title,
          message,
          priority: 'medium',
          data: promotionData,
          createdAt: new Date(),
        };

        this.webSocketService.sendNotification(notification);
      }

      this.logger.log(`Promotion sent to ${userIds.length} users: ${title}`);
    } catch (error) {
      this.logger.error('Failed to send promotion:', error);
    }
  }

  /**
   * Send merchant-specific notifications (e.g., business insights, tips)
   */
  sendMerchantNotification(
    merchantId: string,
    title: string,
    message: string,
    actionData?: {
      actionType: 'view_analytics' | 'create_offer' | 'update_hours' | 'contact_support';
      actionUrl?: string;
    }
  ): void {
    try {
      const notification: NotificationEvent = {
        id: `merchant_${Date.now()}_${merchantId}`,
        userId: merchantId,
        type: 'merchant',
        title,
        message,
        priority: 'medium',
        data: actionData || {},
        createdAt: new Date(),
      };

      this.webSocketService.sendNotification(notification);
      this.logger.log(`Merchant notification sent to ${merchantId}: ${title}`);
    } catch (error) {
      this.logger.error('Failed to send merchant notification:', error);
    }
  }

  /**
   * Send location-based notifications (weather, events, etc.)
   */
  sendLocationBasedNotification(
    coordinates: [number, number], // [longitude, latitude]
    radius: number, // in meters
    title: string,
    message: string,
    data?: Record<string, any>
  ): void {
    try {
      const locationRoom = `location_${coordinates[1]}_${coordinates[0]}_${radius}`;

      const notification = {
        id: `location_${Date.now()}`,
        type: 'system' as const,
        title,
        message,
        priority: 'medium' as const,
        data: {
          location: coordinates,
          radius,
          ...data,
        },
        createdAt: new Date(),
      };

      this.webSocketService.sendToRoom(locationRoom, 'location:notification', notification);
      this.logger.log(`Location-based notification sent to ${locationRoom}`);
    } catch (error) {
      this.logger.error('Failed to send location-based notification:', error);
    }
  }

  /**
   * Send reminder notifications
   */
  sendReminder(
    userId: string,
    title: string,
    message: string,
    reminderType: 'pickup' | 'payment' | 'review' | 'profile' | 'subscription',
    actionData?: Record<string, any>
  ): void {
    try {
      const notification: NotificationEvent = {
        id: `reminder_${reminderType}_${Date.now()}_${userId}`,
        userId,
        type: 'system',
        title: `⏰ ${title}`,
        message,
        priority: 'medium',
        data: {
          reminderType,
          ...actionData,
        },
        createdAt: new Date(),
      };

      this.webSocketService.sendNotification(notification);
      this.logger.log(`Reminder sent to ${userId}: ${reminderType}`);
    } catch (error) {
      this.logger.error('Failed to send reminder:', error);
    }
  }

  /**
   * Send achievement/gamification notifications
   */
  sendAchievementNotification(
    userId: string,
    achievement: {
      id: string;
      name: string;
      description: string;
      icon: string;
      points?: number;
      badge?: string;
    }
  ): void {
    try {
      const notification: NotificationEvent = {
        id: `achievement_${achievement.id}_${userId}`,
        userId,
        type: 'system',
        title: `🏆 Achievement Unlocked!`,
        message: `You've earned "${achievement.name}" - ${achievement.description}`,
        priority: 'medium',
        data: {
          achievement,
          actionType: 'view_achievements',
        },
        createdAt: new Date(),
      };

      this.webSocketService.sendNotification(notification);
      this.logger.log(`Achievement notification sent to ${userId}: ${achievement.name}`);
    } catch (error) {
      this.logger.error('Failed to send achievement notification:', error);
    }
  }

  /**
   * Mark notification as read (sends WebSocket update)
   */
  markNotificationAsRead(userId: string, notificationId: string): void {
    try {
      this.webSocketService.sendToUser(userId, WebSocketEvents.NOTIFICATION_READ, {
        notificationId,
        readAt: new Date(),
      });

      this.logger.debug(`Notification marked as read: ${notificationId} for user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to mark notification as read:', error);
    }
  }

  /**
   * Send custom notification with full control
   */
  sendCustomNotification(
    userIds: string[],
    event: string,
    title: string,
    message: string,
    data?: Record<string, any>,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
  ): void {
    try {
      for (const userId of userIds) {
        const notification: NotificationEvent = {
          id: `custom_${Date.now()}_${userId}`,
          userId,
          type: 'system',
          title,
          message,
          priority,
          data: data || {},
          createdAt: new Date(),
        };

        this.webSocketService.sendToUser(userId, event, notification);
      }

      this.logger.log(`Custom notification sent to ${userIds.length} users via ${event}`);
    } catch (error) {
      this.logger.error('Failed to send custom notification:', error);
    }
  }
}