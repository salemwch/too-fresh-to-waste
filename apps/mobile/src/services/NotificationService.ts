/**
 * NotificationService
 * Manages FCM push notifications: permissions, token registration,
 * foreground display, and background/killed-state tap routing.
 *
 * Libraries:
 *   @react-native-firebase/messaging — FCM token + message events
 *   @notifee/react-native — NOT used here (MVP uses FCM auto-display for bg)
 *
 * Integration points:
 *   1. App.tsx     — initialize() on mount, registerToken() on AUTHENTICATED
 *   2. RootNavigator — getInitialNotification() for killed-state taps
 */

import {
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  getInitialNotification,
  registerDeviceForRemoteMessages,
  isDeviceRegisteredForRemoteMessages,
} from '@react-native-firebase/messaging';
import axios from 'axios';
import { Platform } from 'react-native';
import { RESULTS, requestNotifications } from 'react-native-permissions';

import { environment } from '@/config/environment';
import { navigateFromNotification, type NotificationNavData } from '@/navigation/navigationRef';
import { SecureStorage } from '@/services/SecureStorage';
import { Logger } from '@/utils/logger';

type ForegroundMessageHandler = (data: NotificationNavData, title: string, body: string) => void;

class NotificationService {
  private _foregroundUnsubscribe: (() => void) | null = null;
  private _tokenRefreshUnsubscribe: (() => void) | null = null;

  // ── Permission ─────────────────────────────────────────────────────────────
  /**
   * Request push notification permission.
   * Android 13+ requires POST_NOTIFICATIONS at runtime.
   * iOS requires explicit authorization via Firebase.
   */
  async requestPermission(): Promise<boolean> {
    try {
      const { status } = await requestNotifications(['alert', 'sound', 'badge']);
      const granted = status === RESULTS.GRANTED || status === RESULTS.LIMITED;

      Logger.info('[NotificationService] Notification permission result', {
        granted,
        platform: Platform.OS,
        status,
      });

      return granted;
    } catch (error) {
      Logger.warn('[NotificationService] Permission request failed', {}, error as Error);
      return false;
    }
  }

  // ── Token ──────────────────────────────────────────────────────────────────
  /** Returns the current FCM token, or null on failure. */
  async getToken(): Promise<string | null> {
    try {
      const m = getMessaging();
      // iOS requires explicit registration before token retrieval
      if (Platform.OS === 'ios' && !isDeviceRegisteredForRemoteMessages(m)) {
        await registerDeviceForRemoteMessages(m);
      }
      const token = await getToken(m);
      Logger.debug('[NotificationService] FCM token obtained');
      return token;
    } catch (error) {
      Logger.warn('[NotificationService] Failed to get FCM token', {}, error as Error);
      return null;
    }
  }

  /**
   * Register the FCM token with the backend.
   * Backend stores it in NotificationPreference.deviceTokens.
   * Endpoint: POST /notifications/device-token
   */
  async registerTokenWithBackend(token: string): Promise<void> {
    try {
      const accessToken = await SecureStorage.getAccessToken();
      if (!accessToken) {
        Logger.warn('[NotificationService] No access token — skipping token registration');
        return;
      }

      await axios.post(
        `${environment.api.baseUrl}/notifications/device-token`,
        { deviceToken: token, platform: Platform.OS },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 10_000,
        },
      );

      Logger.info('[NotificationService] FCM token registered with backend');
    } catch (error) {
      // Non-fatal: user still receives notifications until next token refresh
      Logger.warn('[NotificationService] Failed to register token', {}, error as Error);
    }
  }

  /**
   * Unregister the FCM token from the backend on logout.
   * Prevents push notifications being sent to logged-out devices.
   * Endpoint: DELETE /notifications/device-token
   */
  async unregisterTokenFromBackend(): Promise<void> {
    try {
      const token = await this.getToken();
      if (!token) return;

      const accessToken = await SecureStorage.getAccessToken();
      if (!accessToken) return;

      await axios.delete(`${environment.api.baseUrl}/notifications/device-token`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: { deviceToken: token },
        timeout: 10_000,
      });

      Logger.info('[NotificationService] FCM token unregistered from backend');
    } catch (error) {
      Logger.warn('[NotificationService] Failed to unregister token', {}, error as Error);
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  /**
   * Set up FCM message listeners.
   * Call once from App.tsx on mount.
   *
   * @param onForeground  Called for in-app (foreground) messages.
   *                      Use this to show a toast — do NOT auto-navigate.
   */
  initialize(onForeground: ForegroundMessageHandler): void {
    const m = getMessaging();

    // Foreground: app is open, notification arrives
    this._foregroundUnsubscribe = onMessage(m, (remoteMessage) => {
      const data = (remoteMessage.data ?? {}) as NotificationNavData;
      const title = remoteMessage.notification?.title ?? '';
      const body = remoteMessage.notification?.body ?? '';
      Logger.debug('[NotificationService] Foreground message', { trigger: data.trigger });
      onForeground(data, title, body);
    });

    // Background tap: app in bg, user taps notification → app becomes active
    onNotificationOpenedApp(m, (remoteMessage) => {
      Logger.debug('[NotificationService] Background notification tapped');
      navigateFromNotification((remoteMessage.data ?? {}) as NotificationNavData);
    });

    // Token refresh: re-register whenever FCM rotates the token
    this._tokenRefreshUnsubscribe = onTokenRefresh(m, async (newToken) => {
      Logger.info('[NotificationService] FCM token refreshed');
      await this.registerTokenWithBackend(newToken);
    });

    Logger.info('[NotificationService] Initialized');
  }

  /**
   * Check if the app was opened by a notification tap from a killed state.
   * Must be called AFTER NavigationContainer is mounted and ready.
   */
  async handleKilledStateNotification(): Promise<void> {
    try {
      const remoteMessage = await getInitialNotification(getMessaging());
      if (remoteMessage) {
        Logger.info('[NotificationService] App opened from killed state via notification');
        navigateFromNotification((remoteMessage.data ?? {}) as NotificationNavData);
      }
    } catch (error) {
      Logger.warn('[NotificationService] getInitialNotification failed', {}, error as Error);
    }
  }

  /** Remove all FCM listeners. Call from App.tsx cleanup. */
  cleanup(): void {
    this._foregroundUnsubscribe?.();
    this._tokenRefreshUnsubscribe?.();
    this._foregroundUnsubscribe = null;
    this._tokenRefreshUnsubscribe = null;
    Logger.debug('[NotificationService] Cleaned up');
  }
}

// Singleton — one instance for the lifetime of the app
export const notificationService = new NotificationService();
