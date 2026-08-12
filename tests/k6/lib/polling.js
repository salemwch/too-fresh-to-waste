// tests/k6/lib/polling.js
import { sleep } from 'k6';

/**
 * Polls `checkFn` every `intervalMs` until it returns truthy or `deadlineMs`
 * elapses. Returns the result shape for invariant reporting.
 *
 * `checkFn` receives the iteration count and must return a truthy value on
 * success, falsy to keep polling. The truthy value is forwarded as `result`.
 */
export function pollUntil(checkFn, { intervalMs = 500, deadlineMs = 30000 } = {}) {
  const start = Date.now();
  let iterations = 0;

  while (Date.now() - start < deadlineMs) {
    iterations++;
    const result = checkFn(iterations);
    if (result) {
      return { success: true, elapsed: Date.now() - start, iterations, result };
    }
    sleep(intervalMs / 1000);
  }

  return { success: false, elapsed: Date.now() - start, iterations, result: null };
}
