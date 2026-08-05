/** Raised when the operation outlives its budget. */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/** Raised when the caller's AbortSignal fires before the operation settles. */
export class CancelledError extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'CancelledError';
  }
}

/**
 * Race an operation against a deadline, cleaning up whichever side loses.
 *
 * The obvious hand-rolled version leaks, and it leaks *on success*:
 *
 *   const timeout = new Promise((_, reject) =>
 *     setTimeout(() => reject(new Error('...')), 15_000));
 *   // ... early return here, before Promise.race ...
 *   await Promise.race([work, timeout]);
 *
 * If anything returns between constructing that promise and racing it, nothing
 * ever attaches a handler to it — but the timer is still armed. It fires later,
 * rejects with no handler attached, and surfaces as an unhandled rejection.
 * Reverse geocoding did exactly this: a hit in the bundled Tunisian-cities
 * lookup returned early, and fifteen seconds later Sentry recorded a
 * "Reverse geocoding timeout" error for a lookup that had in fact succeeded.
 *
 * Two properties make that unrepresentable here:
 *
 *   - the timer is created inside this call, so it cannot outlive a caller's
 *     early return — there is no window in which it exists unraced;
 *   - `finally` clears the timer and detaches the abort listener on every exit
 *     path, so a resolved or rejected operation leaves nothing armed. Without
 *     the listener removal, signals that outlive one call accumulate handlers
 *     and eventually trip MaxListenersExceededWarning.
 *
 * @param operation  work already in flight; it is raced, not started, here.
 * @param timeoutMs  budget before rejecting with TimeoutError.
 * @param signal     caller's abort signal; firing rejects with CancelledError.
 * @param message    what timed out, for the error and for Sentry grouping.
 */
export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  signal: AbortSignal,
  message: string,
): Promise<T> {
  if (signal.aborted) {
    throw new CancelledError();
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let handleAbort: (() => void) | undefined;

  try {
    const deadline = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new TimeoutError(message));
      }, timeoutMs);

      handleAbort = () => {
        reject(new CancelledError());
      };
      signal.addEventListener('abort', handleAbort);
    });

    return await Promise.race([operation, deadline]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    if (handleAbort !== undefined) {
      signal.removeEventListener('abort', handleAbort);
    }
  }
}
