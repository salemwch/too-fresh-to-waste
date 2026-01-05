import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationPreference } from '../schemas/notification-preference.schema';
import { INotificationProvider, NotificationResult } from '../interfaces/notification.interfaces';
import { NotificationTarget, NotificationPayload } from '../types/notification.types';
import { FirebaseAdminService } from '../../common/services/firebase-admin.service';
import * as admin from 'firebase-admin';
@Injectable()
export class PushNotificationService implements INotificationProvider {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    @InjectModel(NotificationPreference.name)
    private readonly preferencesModel: Model<NotificationPreference>,
    private readonly configService: ConfigService,
    private readonly firebaseAdminService: FirebaseAdminService,
  ) {
    // Firebase is now initialized by FirebaseAdminService
  }

  /**
   * Ensure Firebase Admin is initialized before use
   */
  private ensureFirebaseInitialized(): void {
    if (!this.firebaseAdminService.isInitialized()) {
      throw new Error('Firebase Admin SDK is not initialized. Check Firebase configuration.');
    }
  }

  async send(payload: NotificationPayload, target: NotificationTarget): Promise<NotificationResult> {
    try {
      this.ensureFirebaseInitialized();
      const deviceTokens = await this.getDeviceTokens(target);

      if (deviceTokens.length === 0) {
        return {
          success: false,
          error: 'No device tokens found for target'
        };
      }

      const message = this.buildFirebaseMessage(payload, deviceTokens[0]);

      const messageId = await this.sendFirebaseMessage(message);

      return {
        success: true,
        messageId,
        deliveryStatus: 'sent'
      };
    } catch (error) {
      this.logger.error(`Push notification failed: ${(error as Error).message}`, (error as Error).stack);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  async sendBulk(payload: NotificationPayload, targets: NotificationTarget[]): Promise<NotificationResult[]> {
    this.ensureFirebaseInitialized();
    const allTokens = new Set<string>();

    for (const target of targets) {
      const tokens = await this.getDeviceTokens(target);
      tokens.forEach(token => allTokens.add(token));
    }

    if (allTokens.size === 0) {
      return [{ success: false, error: 'No device tokens found' }];
    }

    try {
      const message = this.buildMulticastMessage(payload, Array.from(allTokens));
      const response = await this.sendMulticastMessage(message);

      return this.processBulkResponse(response, Array.from(allTokens));
    } catch (error) {
      this.logger.error(`Bulk push notification failed: ${(error as Error).message}`, (error as Error).stack);
      return Array.from(allTokens).map(() => ({
        success: false,
        error: (error as Error).message
      }));
    }
  }

  async sendToTopic(payload: NotificationPayload, topic: string): Promise<NotificationResult> {
    try {
      this.ensureFirebaseInitialized();
      const message = this.buildTopicMessage(payload, topic);
      const messageId = await this.sendFirebaseMessage(message);

      return {
        success: true,
        messageId,
        deliveryStatus: 'sent'
      };
    } catch (error) {
      this.logger.error(`Topic push notification failed: ${(error as Error).message}`, (error as Error).stack);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  async subscribeToTopic(deviceTokens: string[], topic: string): Promise<void> {
    try {
      this.ensureFirebaseInitialized();
      await admin.messaging().subscribeToTopic(deviceTokens, topic);
      this.logger.log(`Subscribed ${deviceTokens.length} devices to topic: ${topic}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to topic: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  async unsubscribeFromTopic(deviceTokens: string[], topic: string): Promise<void> {
    try {
      this.ensureFirebaseInitialized();
      await admin.messaging().unsubscribeFromTopic(deviceTokens, topic);
      this.logger.log(`Unsubscribed ${deviceTokens.length} devices from topic: ${topic}`);
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from topic: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  private async getDeviceTokens(target: NotificationTarget): Promise<string[]> {
    if (target.userId) {
      const preferences = await this.preferencesModel
        .findOne({ userId: target.userId })
        .select('deviceTokens')
        .exec();

      return preferences?.deviceTokens || [];
    }

    return [];
  }

  private buildFirebaseMessage(payload: NotificationPayload, token: string): any {
    return {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
        image: payload.image,
      },
      data: this.sanitizeData(payload.data || {}),
      android: {
        notification: {
          sound: payload.sound || 'default',
          channelId: 'food_waste_notifications',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
          defaultLightSettings: true,
        },
        data: this.sanitizeData(payload.data || {}),
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: payload.title,
              body: payload.body,
            },
            sound: payload.sound || 'default',
            badge: payload.badge,
            category: payload.clickAction,
          },
        },
        fcmOptions: {
          image: payload.image,
        },
      },
      webpush: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: '/icon-192x192.png',
          image: payload.image,
          badge: '/badge-72x72.png',
          tag: 'food-waste-notification',
          requireInteraction: false,
        },
        fcmOptions: {
          link: payload.clickAction,
        },
      },
    };
  }

  private buildMulticastMessage(payload: NotificationPayload, tokens: string[]): any {
    const message = this.buildFirebaseMessage(payload, '');
    delete message.token;
    return {
      ...message,
      tokens,
    };
  }

  private buildTopicMessage(payload: NotificationPayload, topic: string): any {
    const message = this.buildFirebaseMessage(payload, '');
    delete message.token;
    return {
      ...message,
      topic,
    };
  }

  private async sendFirebaseMessage(message: any): Promise<string> {
    const response = await admin.messaging().send(message);
    return response;
  }

  private async sendMulticastMessage(message: any): Promise<any> {
    const response = await admin.messaging().sendEachForMulticast(message);
    return response;
  }

  private processBulkResponse(response: any, tokens: string[]): NotificationResult[] {
    return response.responses.map((result: any, index: number) => ({
      success: result.success,
      messageId: result.messageId,
      error: result.error?.message,
      deliveryStatus: result.success ? 'sent' : 'failed',
      metadata: { token: tokens[index] }
    }));
  }

  private sanitizeData(data: Record<string, any>): Record<string, string> {
    const sanitized: Record<string, string> = {};

    Object.entries(data).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        sanitized[key] = String(value);
      }
    });

    return sanitized;
  }
}