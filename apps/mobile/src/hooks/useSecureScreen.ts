/**
 * useSecureScreen
 *
 * Prevents screenshots and screen recordings on the screen that calls this hook.
 *
 * Android: sets FLAG_SECURE on the Activity window via a native module.
 *   Blocks power+volume-down screenshots, screen recording, and the
 *   recent-apps thumbnail — without affecting any other screen.
 *
 * iOS: no-op for now (requires a native UITextField-based implementation;
 *   add the Swift/ObjC module when the iOS build is set up on macOS).
 *
 * Usage:
 *   function OrderDetailsScreen() {
 *     useSecureScreen();
 *     ...
 *   }
 */

import { useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';

import { Logger } from '@/utils/logger';

const { ScreenCaptureModule } = NativeModules as {
  ScreenCaptureModule?: {
    enableSecureScreen: () => void;
    disableSecureScreen: () => void;
  };
};

export function useSecureScreen(): void {
  useEffect(() => {
    if (Platform.OS !== 'android') {
      // iOS implementation requires native UITextField trick — add in a future sprint
      return;
    }

    if (!ScreenCaptureModule) {
      Logger.warn('[useSecureScreen] ScreenCaptureModule not found — native build required');
      return;
    }

    ScreenCaptureModule.enableSecureScreen();
    Logger.debug('[useSecureScreen] FLAG_SECURE enabled');

    return () => {
      ScreenCaptureModule.disableSecureScreen();
      Logger.debug('[useSecureScreen] FLAG_SECURE cleared');
    };
  }, []);
}
