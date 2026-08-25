/**
 * Reduced-motion preference, as reported by the OS.
 *
 * `DESIGN.md` §8.3 and §11.6 make honouring reduced motion mandatory. On the
 * web that is a CSS media query; React Native has no equivalent, so it has to
 * be read from `AccessibilityInfo` and subscribed to, because the user can turn
 * it on while the app is running.
 *
 * The setting is "Reduce Motion" on iOS and "Remove animations" on Android.
 *
 * Deliberately conservative: it starts `false` and only becomes `true` once the
 * OS confirms it. A user who has *not* asked for reduced motion must see
 * exactly the animation they see today, so the default has to be the animated
 * one - never the reverse.
 *
 * @example
 * const reduceMotion = useReducedMotion();
 * // skip the transition entirely rather than shortening it
 * if (reduceMotion) return <View style={finalStyle}>{children}</View>;
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;

    /*
     * The initial read is async and can resolve after unmount - on a fast
     * navigation that would set state on a torn-down component.
     */
    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (active) setReduceMotion(enabled);
      })
      .catch(() => {
        /* Platform could not report it; stay with the animated default. */
      });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled: boolean) => {
        if (active) setReduceMotion(enabled);
      },
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
