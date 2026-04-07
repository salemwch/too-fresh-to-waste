/**
 * Notification Preferences Service
 *
 * API client for notification preference operations.
 * Integrates with backend /api/v1/notifications/preferences endpoints.
 *
 * Endpoints:
 * - GET  /notifications/preferences - Get current user preferences
 * - PATCH /notifications/preferences - Update user preferences
 */

import { apiClient, type BackendApiResponse, unwrapBackendResponse } from '@/services/apiClient';

// ============================================================================
// Types
// ============================================================================

interface ChannelPreference {
  push: boolean;
  email: boolean;
  sms: boolean;
}

export interface NotificationPreferences {
  globalPushEnabled: boolean;
  globalEmailEnabled: boolean;
  channels: {
    offers?: ChannelPreference;
    order_updates?: ChannelPreference;
    pickup_reminders?: ChannelPreference;
    marketing?: ChannelPreference;
    security?: ChannelPreference;
  };
}

interface UpdateNotificationPreferencesDto {
  globalPushEnabled?: boolean;
  channels?: Partial<NotificationPreferences['channels']>;
}

// ============================================================================
// Service
// ============================================================================

export const notificationPreferencesService = {
  async getPreferences(): Promise<NotificationPreferences> {
    const response = await apiClient.get<BackendApiResponse<NotificationPreferences>>(
      '/notifications/preferences',
    );
    return unwrapBackendResponse(response);
  },

  async updatePreferences(dto: UpdateNotificationPreferencesDto): Promise<NotificationPreferences> {
    const response = await apiClient.patch<BackendApiResponse<NotificationPreferences>>(
      '/notifications/preferences',
      dto,
    );
    return unwrapBackendResponse(response);
  },
};
