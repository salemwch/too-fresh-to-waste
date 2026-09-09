'use client';

import { useSyncExternalStore } from 'react';

/**
 * `false` while server-rendering and during hydration, `true` afterwards.
 *
 * Use it to gate anything that cannot exist in the server HTML - a portal
 * target, a `window` measurement, a locale-dependent format - without the
 * markup disagreeing between server and client.
 *
 * The usual spelling of this is `useState(false)` plus
 * `useEffect(() => setMounted(true), [])`, which works but commits a render
 * and then immediately schedules a second one. react-hooks reports that as a
 * cascading render, and it is: the component renders twice on every mount.
 *
 * useSyncExternalStore expresses the same thing in one commit. It takes an
 * explicit server snapshot, so React renders `false` on the server and during
 * hydration - matching the HTML - and reads the client snapshot immediately
 * after, with no second pass.
 */

/** Mounted-ness never changes after the first commit, so nothing to subscribe to. */
const noopSubscribe = (): (() => void) => () => {};
const getClientSnapshot = (): boolean => true;
const getServerSnapshot = (): boolean => false;

export function useHasMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, getClientSnapshot, getServerSnapshot);
}
