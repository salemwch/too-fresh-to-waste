'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsService } from '@/services/notifications.service';
import type {
  NotificationListResponse,
  NotificationPreferences,
  UpdateNotificationPreferencesPayload,
} from '@/types/notifications';

// ─── Query keys ─────────────────────────────────────────────────────────────

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (offset: number, limit: number, channel?: string, unreadOnly?: boolean) =>
    [
      ...notificationKeys.all,
      'list',
      offset,
      limit,
      channel ?? 'all',
      unreadOnly ?? false,
    ] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
  preferences: () => [...notificationKeys.all, 'preferences'] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useNotifications(offset = 0, limit = 20, channel?: string, unreadOnly?: boolean) {
  return useQuery({
    queryKey: notificationKeys.list(offset, limit, channel, unreadOnly),
    queryFn: async (): Promise<NotificationListResponse> => {
      const response = await notificationsService.getNotifications({
        offset,
        limit,
        ...(channel ? { channel } : {}),
        ...(unreadOnly ? { unreadOnly } : {}),
      });
      return response.data.data;
    },
    staleTime: 30 * 1000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async (): Promise<number> => {
      const response = await notificationsService.getUnreadCount();
      return response.data.data.count;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => notificationsService.markAsRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsService.markAllAsRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: notificationKeys.preferences(),
    queryFn: async (): Promise<NotificationPreferences> => {
      const response = await notificationsService.getPreferences();
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateNotificationPreferencesPayload) =>
      notificationsService.updatePreferences(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.preferences() });
    },
  });
}
