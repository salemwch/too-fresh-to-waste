import { AuthFlowState } from '@/features/auth/types';

/**
 * Whether the root <Stack.Navigator> may be rendered yet.
 *
 * React Navigation throws "Couldn't find any screens for the navigator" if a
 * navigator renders with no <Stack.Screen> children, and RootNavigator picks
 * its screen from `flowState`. INITIALIZING means "we do not know yet", so
 * there is no screen to pick and the navigator must not mount at all.
 *
 * That was the fresh-install crash. On a clean install nothing is persisted, so
 * Redux starts at INITIALIZING; `setIsAppReady(true)` runs synchronously in the
 * mount effect while auth validation is deferred behind InteractionManager; and
 * `isNavigationReady` is seeded `!__DEV__`, so a release build has it true on
 * the very first render. Every readiness flag was therefore true while
 * flowState was still INITIALIZING, and the navigator mounted empty.
 *
 * Two reasons it stayed hidden:
 *   - development seeds isNavigationReady false, which delays the first render
 *     past the point auth resolves, so it never reproduced locally;
 *   - a second launch rehydrates a real flowState from MMKV, so only the very
 *     first run after install is exposed.
 *
 * Extracted as a predicate so the rule can be asserted against every state in
 * the enum without mounting NavigationContainer, Redux, MMKV and NetInfo.
 */
export function canRenderNavigator(params: {
  isAppReady: boolean;
  isNavigationReady: boolean;
  flowState: AuthFlowState;
}): boolean {
  const { isAppReady, isNavigationReady, flowState } = params;

  if (!isAppReady || !isNavigationReady) {
    return false;
  }

  // Every other state maps to a screen — see renderNavigator, where the
  // `default` branch is the catch-all. INITIALIZING is the only one that does
  // not, so it is the only one that has to wait.
  return flowState !== AuthFlowState.INITIALIZING;
}
