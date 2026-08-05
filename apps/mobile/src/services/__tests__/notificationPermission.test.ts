/**
 * When the notification prompt is spent, and when it must not be.
 *
 * Android 13+ shows the POST_NOTIFICATIONS dialog exactly once. A denial is
 * final: the app cannot ask again and the user has to reverse it in system
 * settings. So there is one prompt available per install, and the rules about
 * spending it are worth pinning rather than leaving to a comment.
 *
 * This used to fire unconditionally at app startup — before sign-in, before the
 * user had seen what the app does, and for people who never signed up at all.
 * It now runs after authentication, where order updates and pickup reminders
 * are something the user can recognise as theirs.
 */

jest.mock('react-native-permissions', () => ({
  checkNotifications: jest.fn(),
  requestNotifications: jest.fn(),
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    BLOCKED: 'blocked',
    UNAVAILABLE: 'unavailable',
    LIMITED: 'limited',
  },
}));

jest.mock('@/utils/logger', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

// Ships untranspiled ESM, and none of it is exercised here — permission state
// is decided entirely by react-native-permissions.
jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: jest.fn(),
  getToken: jest.fn(),
  onMessage: jest.fn(() => jest.fn()),
  onNotificationOpenedApp: jest.fn(() => jest.fn()),
  getInitialNotification: jest.fn(),
  isDeviceRegisteredForRemoteMessages: jest.fn(() => true),
  registerDeviceForRemoteMessages: jest.fn(),
  setBackgroundMessageHandler: jest.fn(),
  deleteToken: jest.fn(),
  onTokenRefresh: jest.fn(() => jest.fn()),
}));

jest.mock('@/navigation/navigationRef', () => ({
  navigateFromNotification: jest.fn(),
}));

import { checkNotifications, requestNotifications } from 'react-native-permissions';

import { notificationService } from '../NotificationService';

const mockCheck = checkNotifications as jest.MockedFunction<typeof checkNotifications>;
const mockRequest = requestNotifications as jest.MockedFunction<typeof requestNotifications>;

/** react-native-permissions returns a settings object alongside the status. */
const result = (status: string) =>
  ({ status, settings: {} }) as unknown as Awaited<ReturnType<typeof checkNotifications>>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('notificationService.ensurePermission', () => {
  describe('spends the prompt only when one is available', () => {
    it('prompts when the OS has not decided yet', async () => {
      mockCheck.mockResolvedValue(result('denied'));
      mockRequest.mockResolvedValue(result('granted'));

      await expect(notificationService.ensurePermission()).resolves.toBe(true);
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('does not prompt again once permanently blocked', async () => {
      // The Android 13+ dead end. Prompting here shows nothing and cannot
      // change the answer — only system settings can.
      mockCheck.mockResolvedValue(result('blocked'));

      await expect(notificationService.ensurePermission()).resolves.toBe(false);
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('does not prompt when notifications are unavailable on the device', async () => {
      mockCheck.mockResolvedValue(result('unavailable'));

      await expect(notificationService.ensurePermission()).resolves.toBe(false);
      expect(mockRequest).not.toHaveBeenCalled();
    });
  });

  describe('already granted', () => {
    it.each(['granted', 'limited'])('reports %s without prompting', async status => {
      // `limited` is the iOS provisional case — already permitted, so asking
      // again would be a dialog the user has no reason to see.
      mockCheck.mockResolvedValue(result(status));

      await expect(notificationService.ensurePermission()).resolves.toBe(true);
      expect(mockRequest).not.toHaveBeenCalled();
    });
  });

  describe('failure paths leave notifications off rather than throwing', () => {
    it('returns false when the status check fails', async () => {
      // Called during sign-in; a rejection here must not break that flow.
      mockCheck.mockRejectedValue(new Error('native module unavailable'));

      await expect(notificationService.ensurePermission()).resolves.toBe(false);
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('returns false when the prompt itself fails', async () => {
      mockCheck.mockResolvedValue(result('denied'));
      mockRequest.mockRejectedValue(new Error('activity not attached'));

      await expect(notificationService.ensurePermission()).resolves.toBe(false);
    });

    it('reports a declined prompt as not granted', async () => {
      mockCheck.mockResolvedValue(result('denied'));
      mockRequest.mockResolvedValue(result('blocked'));

      await expect(notificationService.ensurePermission()).resolves.toBe(false);
    });
  });
});
