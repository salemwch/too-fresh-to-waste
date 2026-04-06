/**
 * usePressGuard Hook
 *
 * Throttle guard for press handlers — prevents rapid-fire taps from
 * triggering duplicate API calls, navigation, or side-effects.
 *
 * Uses a ref-based cooldown (not state) so it never causes re-renders
 * and works correctly even when the component tree is mid-transition.
 *
 * @module usePressGuard
 */

import { useCallback, useRef } from 'react';

/**
 * Returns a guarded version of the given press handler that ignores
 * invocations within `cooldownMs` of the last accepted press.
 *
 * @param handler  - The original press callback
 * @param cooldownMs - Minimum ms between accepted presses (default: 500)
 * @returns A throttled handler + `isGuarded` ref for UI feedback
 *
 * @example
 * ```tsx
 * const { guardedPress, isGuarded } = usePressGuard(handleSubmit, 1000);
 * <Button onPress={guardedPress} disabled={isGuarded.current} />
 * ```
 */
export function usePressGuard<Args extends unknown[] = []>(
  handler: ((...args: Args) => unknown) | undefined,
  cooldownMs: number = 500,
): { guardedPress: (...args: Args) => void; isGuarded: React.RefObject<boolean> } {
  const lastCallTime = useRef<number | null>(null);
  const isGuarded = useRef<boolean>(false);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const guardedPress = useCallback(
    (...args: Args) => {
      if (cooldownMs <= 0) {
        handler?.(...args);
        return;
      }

      const now = Date.now();
      const elapsed =
        lastCallTime.current === null ? Number.POSITIVE_INFINITY : now - lastCallTime.current;

      if (elapsed < cooldownMs) {
        // Still within cooldown — ignore this press
        return;
      }

      lastCallTime.current = now;
      isGuarded.current = true;

      // Clear any pending timer before setting a new one
      if (cooldownTimer.current !== null) {
        clearTimeout(cooldownTimer.current);
      }

      cooldownTimer.current = setTimeout(() => {
        isGuarded.current = false;
        cooldownTimer.current = null;
      }, cooldownMs);

      handler?.(...args);
    },
    [handler, cooldownMs],
  );

  return { guardedPress, isGuarded };
}
