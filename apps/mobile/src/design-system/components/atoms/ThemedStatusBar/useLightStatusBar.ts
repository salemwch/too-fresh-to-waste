/**
 * Light status-bar icons while the calling screen is focused.
 *
 * For screens that paint the dark brand ground in both themes (onboarding,
 * offer details hero). The screen-level `statusBarStyle: 'light'` option from
 * react-native-screens is NOT enough on Android: `<ThemedStatusBar>` in App.tsx
 * schedules its `setStyle('dark-content')` after the first screen attaches, so
 * the last writer is the global one and the icons render dark on green
 * (seen on the OPPO rig, onboarding page 1).
 *
 * RN's `StatusBar` keeps a stack and applies its top entry; pushing one on
 * focus and popping it on blur makes this screen win while visible and hands
 * control back to the theme afterwards. `barStyle` only - colour and
 * translucency are no-ops under edge-to-edge (see App.tsx).
 */

import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { StatusBar } from 'react-native';

export const useLightStatusBar = (): void => {
  useFocusEffect(
    useCallback(() => {
      const entry = StatusBar.pushStackEntry({ barStyle: 'light-content' });
      return () => {
        StatusBar.popStackEntry(entry);
      };
    }, []),
  );
};
