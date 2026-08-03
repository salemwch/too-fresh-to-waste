/**
 * Opt-in latency instrumentation.
 *
 * The order-creation and payment paths carry step-by-step `[PERF]` timings that
 * were invaluable while tuning them. Left unconditional they emit five or more
 * lines per order — at 100k orders/day that is ~500k lines of pure
 * instrumentation, which costs real money on a hosted log backend and, worse,
 * buries the lines that matter during an incident.
 *
 * These helpers keep the instrumentation in the code (deleting it would mean
 * rewriting it the next time latency regresses) while making it silent by
 * default in production.
 *
 * Enable at runtime without a redeploy by setting `PERF_LOGGING=true`.
 */

/**
 * Whether step-level `[PERF]` lines are emitted.
 *
 * On outside production, so local and staging keep the timings they had.
 * In production, off unless explicitly switched on.
 *
 * Read once at module load: this is checked on the hot path, and re-reading
 * `process.env` per call is a documented deoptimisation in Node.
 */
export const PERF_LOGGING_ENABLED: boolean =
  process.env['PERF_LOGGING'] === 'true' || process.env['NODE_ENV'] !== 'production';

/**
 * Marks a start time for {@link perfLog}.
 *
 * Always runs — `performance.now()` costs tens of nanoseconds, far below the
 * threshold where gating it would pay for the added branch, and keeping it
 * unconditional means the timing is available the moment logging is switched on.
 */
export function perfStart(): number {
  return performance.now();
}

/**
 * Emits `[PERF] <label>: <elapsed>ms` through the supplied sink, if enabled.
 *
 * Takes an emit callback rather than a logger instance because call sites use
 * different sinks and contexts (`AppLoggerService.log(msg, 'OrderService')` vs
 * a plain `Logger.log(msg)`).
 *
 * Formatting happens inside the guard on purpose. Building the message at the
 * call site — the shape this replaced — runs `toFixed` and the template
 * interpolation on every request regardless of whether anything is logged.
 *
 * @param emit      where to write the finished line
 * @param label     what was measured, e.g. 'order.save'
 * @param startedAt the value returned by {@link perfStart}
 * @param detail    optional suffix for context, e.g. 'payment=online'
 */
export function perfLog(
  emit: (message: string) => void,
  label: string,
  startedAt: number,
  detail?: string,
): void {
  if (!PERF_LOGGING_ENABLED) {
    return;
  }

  const elapsedMs = (performance.now() - startedAt).toFixed(0);
  emit(`[PERF] ${label}: ${elapsedMs}ms${detail === undefined ? '' : ` (${detail})`}`);
}
