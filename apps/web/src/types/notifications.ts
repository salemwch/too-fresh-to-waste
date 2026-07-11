// ─── Notification enums (mirror backend) ────────────────────────────────────

export type NotificationType = 'push' | 'email' | 'sms' | 'in_app';

export type NotificationChannel =
  | 'order_updates'
  | 'marketing'
  | 'pickup_reminders'
  | 'security'
  | 'offers'
  | 'admin'
  | 'leaderboard';

export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export type NotificationTrigger =
  | 'new_offer_nearby'
  | 'order_confirmed'
  | 'pickup_reminder_2h'
  | 'pickup_ready'
  | 'order_completed'
  | 'order_cancelled'
  | 'weekly_newsletter'
  | 'personalized_promotion'
  | 'security_alert'
  | 'establishment_approved'
  | 'establishment_rejected'
  | 'establishment_trial_expiring_soon'
  | 'establishment_trial_expired'
  | 'new_review'
  | 'prize_claimed'
  | 'leaderboard_under_attack'
  | 'leaderboard_dethroned';

// ─── Response types ─────────────────────────────────────────────────────────

export interface NotificationItem {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  trigger: NotificationTrigger;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  image?: string;
  status: NotificationStatus;
  priority: NotificationPriority;
  isRead: boolean;
  scheduledAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationListResponse {
  notifications: NotificationItem[];
  total: number;
  count: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface NotificationPreferences {
  userId: string;
  channels: Record<string, { push: boolean; email: boolean; sms: boolean }>;
  globalPushEnabled: boolean;
  globalEmailEnabled: boolean;
  globalSmsEnabled: boolean;
  quietHours?: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
  language?: string;
  timezone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateNotificationPreferencesPayload {
  channels?: Record<string, { push: boolean; email: boolean; sms: boolean }>;
  globalPushEnabled?: boolean;
  globalEmailEnabled?: boolean;
  globalSmsEnabled?: boolean;
  quietHours?: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
  language?: string;
  timezone?: string;
}
