export enum NotificationType {
  PUSH = 'push',
  EMAIL = 'email',
  SMS = 'sms',
  IN_APP = 'in_app',
}

export enum NotificationChannel {
  ORDER_UPDATES = 'order_updates',
  MARKETING = 'marketing',
  PICKUP_REMINDERS = 'pickup_reminders',
  SECURITY = 'security',
  OFFERS = 'offers',
  ADMIN = 'admin',
  LEADERBOARD = 'leaderboard',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  READ = 'read',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum NotificationTrigger {
  NEW_OFFER_NEARBY = 'new_offer_nearby',
  ORDER_CONFIRMED = 'order_confirmed',
  PICKUP_REMINDER_2H = 'pickup_reminder_2h',
  PICKUP_READY = 'pickup_ready',
  ORDER_COMPLETED = 'order_completed',
  ORDER_CANCELLED = 'order_cancelled',
  WEEKLY_NEWSLETTER = 'weekly_newsletter',
  PERSONALIZED_PROMOTION = 'personalized_promotion',
  SECURITY_ALERT = 'security_alert',
  ESTABLISHMENT_APPROVED = 'establishment_approved',
  ESTABLISHMENT_REJECTED = 'establishment_rejected',
  ESTABLISHMENT_TRIAL_EXPIRING_SOON = 'establishment_trial_expiring_soon',
  ESTABLISHMENT_TRIAL_EXPIRED = 'establishment_trial_expired',
  NEW_REVIEW = 'new_review',
  PRIZE_CLAIMED = 'prize_claimed',
  LEADERBOARD_UNDER_ATTACK = 'leaderboard_under_attack',
  LEADERBOARD_DETHRONED = 'leaderboard_dethroned',
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  image?: string;
  sound?: string;
  badge?: number;
  clickAction?: string;
}

export interface NotificationTarget {
  userId?: string | undefined;
  userIds?: string[] | undefined;
  establishmentId?: string | undefined;
  segment?: string | undefined;
  location?:
    | {
        latitude: number;
        longitude: number;
        radius: number; // in km
      }
    | undefined;
}

export interface NotificationSchedule {
  sendAt?: Date;
  timezone?: string;
  recurring?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    endDate?: Date;
  };
}
