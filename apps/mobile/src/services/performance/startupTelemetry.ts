/**
 * Real-user startup telemetry built on React Native's Web Performance APIs
 * (stable since RN 0.83): performance.mark / measure, PerformanceObserver and
 * the Long Tasks API, plus RN's native startup timeline (performance.rnStartupTiming).
 *
 * It separates three things the native first-frame metric cannot:
 *   native startup  - process start -> JS runtime -> bundle execution (RN native timings)
 *   JS startup      - bundle execution -> module graph evaluated -> first useful render
 *   slow JS         - long tasks (>50 ms) on the JS thread during the startup window
 *
 * Production cost and noise are deliberately tiny:
 *   - a handful of marks, written once each;
 *   - one PerformanceObserver that only increments counters (no entry is kept),
 *     disconnected as soon as the report is sent;
 *   - ONE Sentry transaction per cold start, created through Sentry's normal
 *     tracing, so it inherits tracesSampleRate (10%): no extra events, no
 *     breadcrumbs, no per-mark sends. It carries numbers only - no user data.
 *
 * Session-long slow-JS visibility already exists: Sentry's RN tracing records JS
 * stalls on every sampled transaction. This covers the startup window only.
 *
 * Every API is feature-detected: without RN's native performance module,
 * `mark` is a no-op and PerformanceObserver is absent, and this does nothing.
 */
import * as Sentry from '@sentry/react-native';

export type StartupPhase = 'js_init' | 'first_render' | 'auth_ready';

/** Long tasks are aggregated until this long after the first useful render. */
export const STARTUP_SETTLE_MS = 5_000;
/** Durations outside (0, this] are clock errors, not startups - dropped. */
const MAX_PLAUSIBLE_MS = 120_000;
const MARK_PREFIX = 'tftw.startup.';

interface NativeStartupTiming {
  startTime?: number | null;
  initializeRuntimeStart?: number | null;
  executeJavaScriptBundleEntryPointStart?: number | null;
}

/** The slice of the platform this module touches - injectable for tests. */
export interface TelemetryEnv {
  performance:
    | {
        now: () => number;
        mark?: (name: string) => unknown;
        measure?: (name: string, start: string, end: string) => unknown;
        clearMarks?: (name?: string) => void;
        clearMeasures?: (name?: string) => void;
        rnStartupTiming?: NativeStartupTiming;
      }
    | undefined;
  PerformanceObserver:
    | ((new (callback: (list: { getEntries: () => Array<{ duration: number }> }) => void) => {
        observe: (options: { type: string }) => void;
        disconnect: () => void;
      }) & { supportedEntryTypes?: readonly string[] })
    | undefined;
  report: (span: StartupSpan) => void;
  setTimeout: (fn: () => void, ms: number) => unknown;
  dateNow: () => number;
}

export interface StartupSpan {
  /** Epoch seconds, Sentry's timestamp unit. */
  startTimestamp: number;
  endTimestamp: number;
  attributes: Record<string, number>;
}

export function createStartupTelemetry(env: TelemetryEnv) {
  const phaseTimes: Partial<Record<StartupPhase, number>> = {};
  const longTasks = { count: 0, totalMs: 0, maxMs: 0 };
  let observer: { disconnect: () => void } | null = null;
  let reportScheduled = false;

  const perf = env.performance;

  const startLongTaskObserver = (): void => {
    const PO = env.PerformanceObserver;
    if (observer || !PO || !(PO.supportedEntryTypes ?? []).includes('longtask')) return;
    try {
      const created = new PO(list => {
        for (const entry of list.getEntries()) {
          longTasks.count += 1;
          longTasks.totalMs += entry.duration;
          if (entry.duration > longTasks.maxMs) longTasks.maxMs = entry.duration;
        }
      });
      created.observe({ type: 'longtask' });
      observer = created;
    } catch {
      observer = null; // unsupported at runtime: startup phases are still reported
    }
  };

  const stopLongTaskObserver = (): void => {
    observer?.disconnect();
    observer = null;
  };

  const measure = (name: string, from: StartupPhase, to: StartupPhase): void => {
    if (phaseTimes[from] === undefined || phaseTimes[to] === undefined) return;
    try {
      perf?.measure?.(`${MARK_PREFIX}${name}`, `${MARK_PREFIX}${from}`, `${MARK_PREFIX}${to}`);
    } catch {
      // measure is a convenience for DevTools' Performance panel; never fatal
    }
  };

  const sendReport = (): void => {
    stopLongTaskObserver();
    const firstRender = phaseTimes.first_render;
    if (firstRender === undefined || !perf) return;

    const native = perf.rnStartupTiming;
    const nativeStart = native?.startTime ?? undefined;
    const bundleStart = native?.executeJavaScriptBundleEntryPointStart ?? undefined;
    const runtimeInit = native?.initializeRuntimeStart ?? undefined;
    const jsInit = phaseTimes.js_init;
    const authReady = phaseTimes.auth_ready;

    const raw: Record<string, number | undefined> = {
      'startup.native_to_runtime_init_ms': diff(nativeStart, runtimeInit),
      'startup.native_to_bundle_start_ms': diff(nativeStart, bundleStart),
      'startup.bundle_to_js_init_ms': diff(bundleStart, jsInit),
      'startup.js_init_to_first_render_ms': diff(jsInit, firstRender),
      'startup.native_to_first_render_ms': diff(nativeStart, firstRender),
      'startup.native_to_auth_ready_ms': diff(nativeStart, authReady),
      'startup.long_task_count': longTasks.count,
      'startup.long_task_total_ms': longTasks.totalMs,
      'startup.long_task_max_ms': longTasks.maxMs,
    };
    const attributes: Record<string, number> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (value === undefined || !Number.isFinite(value) || value < 0) continue;
      if (
        key.endsWith('_ms') &&
        !key.startsWith('startup.long_task') &&
        (value === 0 || value > MAX_PLAUSIBLE_MS)
      ) {
        continue;
      }
      attributes[key] = Math.round(value);
    }

    // performance.now() and Date.now() read at the same moment give the offset
    // to epoch time; RN's performance.timeOrigin is not relied on.
    const epochOffsetMs = env.dateNow() - perf.now();
    const spanStart = nativeStart ?? jsInit ?? firstRender;
    env.report({
      startTimestamp: (spanStart + epochOffsetMs) / 1000,
      endTimestamp: (firstRender + epochOffsetMs) / 1000,
      attributes,
    });

    for (const phase of Object.keys(phaseTimes)) perf.clearMarks?.(`${MARK_PREFIX}${phase}`);
    perf.clearMeasures?.(`${MARK_PREFIX}bundle_to_first_render`);
  };

  return {
    /** Records a startup phase once; later calls for the same phase are ignored. */
    markPhase(phase: StartupPhase): void {
      if (!perf || phaseTimes[phase] !== undefined) return;
      phaseTimes[phase] = perf.now();
      try {
        perf.mark?.(`${MARK_PREFIX}${phase}`);
      } catch {
        // marks are best-effort
      }

      if (phase === 'js_init') {
        startLongTaskObserver();
      }
      if (phase === 'first_render' && !reportScheduled) {
        reportScheduled = true;
        measure('bundle_to_first_render', 'js_init', 'first_render');
        env.setTimeout(sendReport, STARTUP_SETTLE_MS);
      }
    },
  };
}

const diff = (from: number | undefined, to: number | undefined): number | undefined =>
  from === undefined || to === undefined ? undefined : to - from;

/** Sends the startup report as one sampled Sentry transaction, if Sentry is running. */
export const reportStartupToSentry = ({
  startTimestamp,
  endTimestamp,
  attributes,
}: StartupSpan): void => {
  if (!Sentry.getClient()) return;
  const span = Sentry.startInactiveSpan({
    name: 'app.startup',
    op: 'app.start.js',
    forceTransaction: true,
    startTime: startTimestamp,
    attributes,
  });
  span.end(endTimestamp);
};

export const startupTelemetry = createStartupTelemetry({
  performance: typeof performance === 'object' ? performance : undefined,
  PerformanceObserver: typeof PerformanceObserver === 'function' ? PerformanceObserver : undefined,
  report: reportStartupToSentry,
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  dateNow: () => Date.now(),
});
