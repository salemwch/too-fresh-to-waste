/**
 * The root navigator must never mount without a screen.
 *
 * React Navigation throws "Couldn't find any screens for the navigator" when a
 * navigator renders with no children, and RootNavigator picks its screen from
 * flowState. INITIALIZING means "not known yet", so there is nothing to pick.
 *
 * That threw on every fresh install from the Play Store. The user saw
 * "Something went wrong. Please try again." — the query error boundary
 * catching it — and Try Again worked, because by then auth had resolved and
 * flowState was no longer INITIALIZING.
 *
 * Two things kept it out of sight, and both are worth remembering:
 *   - isNavigationReady is seeded `!__DEV__`, so development delays the first
 *     render past the point auth resolves and never reproduces it;
 *   - only the first launch after install starts at INITIALIZING, because any
 *     later launch rehydrates a real flowState from MMKV.
 *
 * The enum is walked in full rather than spot-checked, so a state added later
 * without a matching screen fails here rather than in the Play Store.
 */

import { AuthFlowState } from '@/features/auth/types';

import { canRenderNavigator } from '../canRenderNavigator';

const READY = { isAppReady: true, isNavigationReady: true } as const;

const ALL_FLOW_STATES = Object.values(AuthFlowState) as AuthFlowState[];

describe('canRenderNavigator', () => {
  it('covers every state in the enum', () => {
    // Guards the describe.each below: if the enum is emptied or renamed, the
    // per-state assertions would silently pass by iterating nothing.
    expect(ALL_FLOW_STATES.length).toBeGreaterThan(1);
    expect(ALL_FLOW_STATES).toContain(AuthFlowState.INITIALIZING);
  });

  describe('the fresh-install crash', () => {
    it('holds the navigator back while the flow state is unknown', () => {
      // The exact production condition: a release build has isNavigationReady
      // true from the first render, and setIsAppReady(true) runs synchronously,
      // so only flowState stands between this and an empty navigator.
      expect(canRenderNavigator({ ...READY, flowState: AuthFlowState.INITIALIZING })).toBe(false);
    });

    it('releases it once auth resolves, which is what Try Again observed', () => {
      expect(canRenderNavigator({ ...READY, flowState: AuthFlowState.UNAUTHENTICATED })).toBe(true);
    });
  });

  describe.each(ALL_FLOW_STATES.filter(state => state !== AuthFlowState.INITIALIZING))(
    'flow state %s',
    flowState => {
      it('renders the navigator, because it maps to a screen', () => {
        expect(canRenderNavigator({ ...READY, flowState })).toBe(true);
      });
    },
  );

  describe('readiness flags still gate independently', () => {
    it.each([
      ['app not ready', { isAppReady: false, isNavigationReady: true }],
      ['navigation not ready', { isAppReady: true, isNavigationReady: false }],
      ['neither ready', { isAppReady: false, isNavigationReady: false }],
    ])('waits when %s, even with a resolved flow state', (_label, flags) => {
      expect(canRenderNavigator({ ...flags, flowState: AuthFlowState.AUTHENTICATED })).toBe(false);
    });
  });
});
