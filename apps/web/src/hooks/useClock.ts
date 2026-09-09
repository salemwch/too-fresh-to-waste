'use client';

import { useSyncExternalStore } from 'react';

export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;

/**
 * A stable, quantised read of the wall clock.
 *
 * Countdown UI ("3 days left", "2h remaining") was calling `Date.now()`
 * directly in render. Three problems with that, only one of which the linter
 * names:
 *
 *  1. It is impure. Two renders of the same component with the same props can
 *     produce different output, so the render is not reproducible and the React
 *     Compiler cannot memoise it.
 *  2. It is a hydration hazard. The server reads the clock when it renders and
 *     the browser reads it again on hydration; if a boundary falls between the
 *     two, the markup disagrees.
 *  3. It never updates. A dashboard left open overnight keeps showing
 *     yesterday's count, because nothing re-renders when the clock moves.
 *
 * Quantising fixes all three. The value only changes when the chosen unit rolls
 * over, so it is stable across renders - which `useSyncExternalStore` requires,
 * since an unstable snapshot re-renders forever - server and client agree
 * unless they genuinely straddle a boundary, and the subscription re-renders
 * once when the unit ticks.
 *
 * Pick the coarsest unit the UI actually displays. A component showing whole
 * days should not re-render every hour.
 */
function createClock(intervalMs: number): () => number {
  const getSnapshot = (): number => Math.floor(Date.now() / intervalMs) * intervalMs;

  const subscribe = (onTick: () => void): (() => void) => {
    if (typeof window === 'undefined') return () => {};

    let timeoutId: ReturnType<typeof setTimeout>;

    // Wake on the boundary itself rather than polling on an offset interval.
    const scheduleNextTick = (): void => {
      const msUntilBoundary = getSnapshot() + intervalMs - Date.now();
      timeoutId = setTimeout(() => {
        onTick();
        scheduleNextTick();
      }, msUntilBoundary);
    };

    scheduleNextTick();
    return () => clearTimeout(timeoutId);
  };

  // Same snapshot on both sides: server and browser sit in the same bucket for
  // all but a hair's breadth around a boundary.
  return () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Start of the current UTC day. For day counts. */
export const useToday = createClock(MS_PER_DAY);

/** Start of the current hour. For hour counts. */
export const useCurrentHour = createClock(MS_PER_HOUR);

/** Whole days from `from` until `date`, floored at 0. */
export function daysUntil(date: string | Date, from: number): number {
  const target = typeof date === 'string' ? new Date(date) : date;
  return Math.max(0, Math.ceil((target.getTime() - from) / MS_PER_DAY));
}
