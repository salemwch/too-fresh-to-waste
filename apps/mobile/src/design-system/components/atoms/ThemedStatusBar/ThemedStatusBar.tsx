/**
 * Status-bar icon appearance, driven by the active theme.
 *
 * `App.tsx` rendered `<StatusBar barStyle='dark-content' />` unconditionally,
 * which is correct on a light ground and wrong on a dark one - dark icons on a
 * dark surface (device finding D4). It also sat *outside* `ThemeProvider`, so it
 * could not have read the theme even if it wanted to.
 *
 * Under edge-to-edge, `backgroundColor` and `translucent` are no-ops (see the
 * comment in `App.tsx` and `.claude/rules/mobile.md`); `barStyle` is the only
 * prop that still does anything, and it is the only one set here.
 *
 * SCOPE. This follows the *theme*. It does not know about screens that paint a
 * fixed brand ground in both themes - `WelcomeScreen` and `LeaderboardScreen`
 * (`DESIGN.md` §19-E26). Those are dark surfaces even in light mode and want
 * `light-content` regardless; they need a screen-level `statusBarStyle`, which
 * `react-native-screens` applies per screen and which takes precedence over
 * this. Recorded rather than guessed at here.
 */

import React from 'react';
import { StatusBar } from 'react-native';

import { useTheme } from '@/design-system/providers';

export const ThemedStatusBar: React.FC = () => {
  const { colorScheme } = useTheme();

  return <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />;
};

ThemedStatusBar.displayName = 'ThemedStatusBar';
