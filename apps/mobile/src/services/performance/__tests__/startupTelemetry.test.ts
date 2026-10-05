/**
 * Startup telemetry: Web Performance APIs -> one sampled Sentry transaction.
 *
 * What must hold in production: each phase is recorded once, the long-task
 * observer only aggregates and is disconnected after the single report, the
 * report separates native from JS startup correctly, nothing is sent before
 * Sentry is running, and every API is optional.
 */
const mockStartInactiveSpan = jest.fn();
const mockGetClient = jest.fn();
jest.mock('@sentry/react-native', () => ({
  startInactiveSpan: (...args: unknown[]) => mockStartInactiveSpan(...args),
  getClient: () => mockGetClient(),
}));

import {
  createStartupTelemetry,
  reportStartupToSentry,
  STARTUP_SETTLE_MS,
  type StartupSpan,
  type TelemetryEnv,
} from '../startupTelemetry';

type Callback = (list: { getEntries: () => Array<{ duration: number }> }) => void;

/** A controllable platform: clock, marks, native timing and one observer. */
const makeEnv = (
  opts: { longtask?: boolean; observer?: boolean; native?: boolean; perf?: boolean } = {},
) => {
  const { longtask = true, observer = true, native = true, perf = true } = opts;
  let now = 1_000;
  const timers: Array<() => void> = [];
  const reports: StartupSpan[] = [];
  const marks: string[] = [];
  let observerCallback: Callback | null = null;
  const disconnect = jest.fn();
  const observe = jest.fn();

  class FakeObserver {
    static supportedEntryTypes = longtask ? ['mark', 'measure', 'longtask'] : ['mark', 'measure'];
    constructor(cb: Callback) {
      observerCallback = cb;
    }
    observe = observe;
    disconnect = disconnect;
  }

  const env: TelemetryEnv = {
    performance: perf
      ? {
          now: () => now,
          mark: (name: string) => marks.push(name),
          measure: jest.fn(),
          clearMarks: jest.fn(),
          clearMeasures: jest.fn(),
          ...(native
            ? {
                rnStartupTiming: {
                  startTime: 100,
                  initializeRuntimeStart: 300,
                  executeJavaScriptBundleEntryPointStart: 400,
                },
              }
            : {}),
        }
      : undefined,
    PerformanceObserver: observer ? FakeObserver : undefined,
    report: span => reports.push(span),
    setTimeout: (fn, ms) => {
      expect(ms).toBe(STARTUP_SETTLE_MS);
      timers.push(fn);
    },
    dateNow: () => 1_700_000_000_000 + now,
  };
  return {
    env,
    reports,
    marks,
    disconnect,
    observe,
    advance: (ms: number) => {
      now += ms;
    },
    longTasks: (...durations: number[]) =>
      observerCallback?.({ getEntries: () => durations.map(d => ({ duration: d })) }),
    flushTimers: () => timers.splice(0).forEach(fn => fn()),
    pendingTimers: () => timers.length,
  };
};

describe('createStartupTelemetry', () => {
  it('records each phase once, as a prefixed performance mark', () => {
    const p = makeEnv();
    const t = createStartupTelemetry(p.env);
    t.markPhase('js_init');
    t.markPhase('js_init');
    expect(p.marks).toEqual(['tftw.startup.js_init']);
  });

  it('does nothing at all without a performance API', () => {
    const p = makeEnv({ perf: false });
    const t = createStartupTelemetry(p.env);
    t.markPhase('js_init');
    t.markPhase('first_render');
    expect(p.pendingTimers()).toBe(0);
    expect(p.reports).toHaveLength(0);
  });

  it('observes long tasks only where the runtime supports them', () => {
    const supported = makeEnv();
    createStartupTelemetry(supported.env).markPhase('js_init');
    expect(supported.observe).toHaveBeenCalledWith({ type: 'longtask' });

    const unsupported = makeEnv({ longtask: false });
    createStartupTelemetry(unsupported.env).markPhase('js_init');
    expect(unsupported.observe).not.toHaveBeenCalled();
  });

  it('reports once, after the settle window, and then disconnects the observer', () => {
    const p = makeEnv();
    const t = createStartupTelemetry(p.env);
    t.markPhase('js_init');
    t.markPhase('first_render');
    t.markPhase('first_render');
    expect(p.pendingTimers()).toBe(1);
    expect(p.reports).toHaveLength(0);

    p.flushTimers();
    expect(p.reports).toHaveLength(1);
    expect(p.disconnect).toHaveBeenCalledTimes(1);
  });

  it('splits native startup from JS startup and aggregates long tasks', () => {
    const p = makeEnv();
    const t = createStartupTelemetry(p.env);
    // clock: native start 100, runtime init 300, bundle 400 (rnStartupTiming)
    p.advance(0); // js_init at 1000
    t.markPhase('js_init');
    p.longTasks(60, 120.4);
    p.advance(500); // first render at 1500
    t.markPhase('first_render');
    p.advance(200); // auth at 1700, inside the settle window
    t.markPhase('auth_ready');
    p.longTasks(80);
    p.flushTimers();

    expect(p.reports[0]?.attributes).toEqual({
      'startup.native_to_runtime_init_ms': 200,
      'startup.native_to_bundle_start_ms': 300,
      'startup.bundle_to_js_init_ms': 600,
      'startup.js_init_to_first_render_ms': 500,
      'startup.native_to_first_render_ms': 1400,
      'startup.native_to_auth_ready_ms': 1600,
      'startup.long_task_count': 3,
      'startup.long_task_total_ms': 260,
      'startup.long_task_max_ms': 120,
    });
  });

  it('converts the performance timeline to epoch seconds for the span', () => {
    const p = makeEnv();
    const t = createStartupTelemetry(p.env);
    t.markPhase('js_init'); // 1000
    p.advance(500);
    t.markPhase('first_render'); // 1500; epoch offset = 1_700_000_000_000
    p.flushTimers();
    const span = p.reports[0];
    expect(span?.startTimestamp).toBeCloseTo((1_700_000_000_000 + 100) / 1000, 6);
    expect(span?.endTimestamp).toBeCloseTo((1_700_000_000_000 + 1500) / 1000, 6);
  });

  it('falls back to the JS timeline when native startup timing is unavailable', () => {
    const p = makeEnv({ native: false, observer: false });
    const t = createStartupTelemetry(p.env);
    t.markPhase('js_init');
    p.advance(250);
    t.markPhase('first_render');
    p.flushTimers();
    expect(p.reports[0]?.attributes).toEqual({
      'startup.js_init_to_first_render_ms': 250,
      'startup.long_task_count': 0,
      'startup.long_task_total_ms': 0,
      'startup.long_task_max_ms': 0,
    });
  });

  it('drops implausible durations instead of reporting clock errors', () => {
    const p = makeEnv();
    const t = createStartupTelemetry(p.env);
    t.markPhase('js_init');
    p.advance(200_000); // 200 s "startup": a suspended process, not a real launch
    t.markPhase('first_render');
    p.flushTimers();
    const attrs = p.reports[0]?.attributes ?? {};
    expect(attrs['startup.js_init_to_first_render_ms']).toBeUndefined();
    expect(attrs['startup.native_to_first_render_ms']).toBeUndefined();
  });

  it('never reports without a first render', () => {
    const p = makeEnv();
    const t = createStartupTelemetry(p.env);
    t.markPhase('js_init');
    t.markPhase('auth_ready');
    expect(p.pendingTimers()).toBe(0);
    expect(p.reports).toHaveLength(0);
  });
});

describe('reportStartupToSentry', () => {
  beforeEach(() => {
    mockStartInactiveSpan.mockReset();
    mockGetClient.mockReset();
  });

  const span: StartupSpan = {
    startTimestamp: 1_700_000_000.1,
    endTimestamp: 1_700_000_001.5,
    attributes: { 'startup.js_init_to_first_render_ms': 500 },
  };

  it('sends one transaction through Sentry tracing when Sentry is running', () => {
    const end = jest.fn();
    mockStartInactiveSpan.mockReturnValue({ end });
    mockGetClient.mockReturnValue({});

    reportStartupToSentry(span);

    expect(mockStartInactiveSpan).toHaveBeenCalledTimes(1);
    expect(mockStartInactiveSpan).toHaveBeenCalledWith({
      name: 'app.startup',
      op: 'app.start.js',
      forceTransaction: true,
      startTime: span.startTimestamp,
      attributes: span.attributes,
    });
    expect(end).toHaveBeenCalledWith(span.endTimestamp);
  });

  it('sends nothing before Sentry has been initialised', () => {
    mockGetClient.mockReturnValue(undefined);
    reportStartupToSentry(span);
    expect(mockStartInactiveSpan).not.toHaveBeenCalled();
  });
});
