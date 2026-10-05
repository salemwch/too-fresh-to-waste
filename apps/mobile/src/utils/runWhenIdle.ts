/**
 * Defers non-urgent work until the JS thread is idle.
 *
 * Replaces `InteractionManager.runAfterInteractions`, which React Native 0.87
 * removed in favour of `requestIdleCallback`
 * (https://reactnative.dev/blog/2026/08/11/react-native-0.87). Under the New
 * Architecture both globals are backed by the C++ `NativeIdleCallbacksCxx`
 * TurboModule, which honours `timeout`.
 *
 * The timeout is an upper bound, not a delay: the task runs at the first idle
 * moment and is forced through after `IDLE_TASK_TIMEOUT_MS` if the thread never
 * goes idle, so deferred startup work (auth validation, Sentry init) cannot be
 * starved. One second is well past a native-stack transition (~350 ms), so it
 * never pre-empts the animation the deferral exists to protect.
 *
 * @returns a cancel function, safe to return directly from `useEffect`.
 */
export const IDLE_TASK_TIMEOUT_MS = 1000;

export function runWhenIdle(
  task: () => void,
  timeoutMs: number = IDLE_TASK_TIMEOUT_MS,
): () => void {
  const handle = requestIdleCallback(
    () => {
      task();
    },
    { timeout: timeoutMs },
  );
  return () => {
    cancelIdleCallback(handle);
  };
}
