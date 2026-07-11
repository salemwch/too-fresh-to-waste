import { apiClient } from '@/lib/api-client';
import type { BackendEnvelope } from '@/types/dashboard';
import type {
  NotificationListResponse,
  NotificationItem,
  NotificationPreferences,
  UpdateNotificationPreferencesPayload,
} from '@/types/notifications';

const NOTIFICATIONS_BASE = '/notifications';

export const notificationsService = {
  getNotifications(params?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    channel?: string;
  }) {
    return apiClient.get<BackendEnvelope<NotificationListResponse>>(NOTIFICATIONS_BASE, {
      params: {
        limit: params?.limit ?? 20,
        offset: params?.offset ?? 0,
        ...(params?.unreadOnly ? { unreadOnly: true } : {}),
        ...(params?.channel ? { channel: params.channel } : {}),
      },
    });
  },

  getUnreadCount() {
    return apiClient.get<BackendEnvelope<{ count: number }>>(`${NOTIFICATIONS_BASE}/unread/count`);
  },

  markAsRead(notificationId: string) {
    return apiClient.patch<BackendEnvelope<NotificationItem>>(
      `${NOTIFICATIONS_BASE}/${notificationId}/read`,
    );
  },

  markAllAsRead() {
    return apiClient.patch<BackendEnvelope<{ message: string }>>(`${NOTIFICATIONS_BASE}/read/all`);
  },

  getPreferences() {
    return apiClient.get<BackendEnvelope<NotificationPreferences>>(
      `${NOTIFICATIONS_BASE}/preferences`,
    );
  },

  updatePreferences(payload: UpdateNotificationPreferencesPayload) {
    return apiClient.patch<BackendEnvelope<NotificationPreferences>>(
      `${NOTIFICATIONS_BASE}/preferences`,
      payload,
    );
  },
};
