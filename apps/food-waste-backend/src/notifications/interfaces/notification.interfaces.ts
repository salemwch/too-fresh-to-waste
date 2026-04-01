import type {
  NotificationTarget,
  NotificationPayload,
  NotificationSchedule,
} from '../types/notification.types';

// Interface for notification metadata
export interface INotificationMetadata {
  deviceToken?: string;
  email?: string;
  phone?: string;
  to?: string;
  segment?: string;
  campaign?: string;
  templateId?: string;
  retryCount?: number;
  maxRetries?: number;
  deliveryProvider?: string;
  messageId?: string;
  trackingId?: string;
  batchId?: string;
  userId?: string;
  requestId?: string;
  source?: string;
  environment?: string;
  version?: string;
  adminAction?: string;
  critical?: boolean;
  accepted?: string[];
  rejected?: string[];
  // Allow additional dynamic fields for email providers
  [key: string]: string | number | boolean | string[] | undefined;
}

// Interface for user preferences in notification context
interface IUserNotificationPreferences {
  email?: {
    enabled: boolean;
    marketing?: boolean;
    orderUpdates?: boolean;
    newOffers?: boolean;
    weeklyDigest?: boolean;
    securityAlerts?: boolean;
  };
  push?: {
    enabled: boolean;
    orderUpdates?: boolean;
    nearbyOffers?: boolean;
    favoriteStoreOffers?: boolean;
    newMessages?: boolean;
  };
  sms?: {
    enabled: boolean;
    orderConfirmation?: boolean;
    securityAlerts?: boolean;
  };
  timezone?: string;
  language?: string;
  doNotDisturbHours?: {
    start: string;
    end: string;
  };
}

// Interface for template variables
interface ITemplateVariables {
  userName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  orderNumber?: string;
  establishmentName?: string;
  ownerName?: string;
  offerTitle?: string;
  price?: number;
  originalPrice?: number;
  discount?: number;
  quantity?: number;
  pickupTime?: string;
  address?: string;
  confirmationCode?: string;
  trackingUrl?: string;
  supportUrl?: string;
  unsubscribeUrl?: string;
  previousStatus?: string;
  customData?: Record<string, string | number | boolean>;
  // Allow additional dynamic fields
  [key: string]: string | number | boolean | undefined | Record<string, string | number | boolean>;
}

export interface INotificationProvider {
  send(payload: NotificationPayload, target: NotificationTarget): Promise<NotificationResult>;
  sendBulk(
    payload: NotificationPayload,
    targets: NotificationTarget[],
  ): Promise<NotificationResult[]>;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  deliveryStatus?: 'sent' | 'delivered' | 'failed';
  metadata?: INotificationMetadata;
}

export interface ISendNotificationRequest {
  type: 'push' | 'email' | 'sms' | 'in_app';
  trigger: string;
  target: NotificationTarget;
  payload: NotificationPayload;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  schedule?: NotificationSchedule;
  templateId?: string;
  templateVariables?: ITemplateVariables;
  metadata?: INotificationMetadata;
}

export interface INotificationContext {
  userId?: string;
  establishmentId?: string;
  orderId?: string;
  offerId?: string;
  variables?: ITemplateVariables;
  userPreferences?: IUserNotificationPreferences;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface INotificationAnalytics {
  track(event: string, notificationId: string, metadata?: INotificationMetadata): Promise<void>;
  getMetrics(timeRange: { from: Date; to: Date }): Promise<NotificationMetrics>;
}

export interface NotificationMetrics {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalOpened: number;
  totalClicked: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  byChannel: Record<
    string,
    {
      sent: number;
      delivered: number;
      failed: number;
      opened: number;
      clicked: number;
    }
  >;
  byTrigger: Record<
    string,
    {
      sent: number;
      delivered: number;
      failed: number;
      opened: number;
      clicked: number;
    }
  >;
}
