/**
 * `[PERF]` instrumentation gating.
 *
 * These lines fire five-plus times per order creation. Left unconditional in
 * production that is ~500k log lines/day at 100k orders — real spend on a
 * hosted log backend, and noise that buries the lines that matter during an
 * incident. The instrumentation stays in the code (it is rewritten every time
 * latency regresses); it just has to be silent unless asked for.
 *
 * PERF_LOGGING_ENABLED is resolved at module load, so each scenario re-imports
 * the module under a fresh environment via jest.isolateModules.
 */

type PerfModule = typeof import('../perf-log.util');

/** Loads perf-log.util with the given env, isolated from other cases. */
const loadWithEnv = (env: Record<string, string | undefined>): PerfModule => {
  const original = { ...process.env };
  Object.entries(env).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });

  let loaded: PerfModule | undefined;
  jest.isolateModules(() => {
    loaded = require('../perf-log.util') as PerfModule;
  });

  process.env = original;

  if (!loaded) {
    throw new Error('Failed to load perf-log.util');
  }
  return loaded;
};

describe('perf-log.util', () => {
  describe('PERF_LOGGING_ENABLED — environment gating', () => {
    it('is disabled in production by default', () => {
      const { PERF_LOGGING_ENABLED } = loadWithEnv({
        NODE_ENV: 'production',
        PERF_LOGGING: undefined,
      });

      expect(PERF_LOGGING_ENABLED).toBe(false);
    });

    it('is enabled in production when PERF_LOGGING=true', () => {
      // The escape hatch: turn timings on during an incident without redeploying.
      const { PERF_LOGGING_ENABLED } = loadWithEnv({
        NODE_ENV: 'production',
        PERF_LOGGING: 'true',
      });

      expect(PERF_LOGGING_ENABLED).toBe(true);
    });

    it('is enabled in development', () => {
      const { PERF_LOGGING_ENABLED } = loadWithEnv({
        NODE_ENV: 'development',
        PERF_LOGGING: undefined,
      });

      expect(PERF_LOGGING_ENABLED).toBe(true);
    });

    it('is enabled in staging, so pre-production keeps its timings', () => {
      const { PERF_LOGGING_ENABLED } = loadWithEnv({
        NODE_ENV: 'staging',
        PERF_LOGGING: undefined,
      });

      expect(PERF_LOGGING_ENABLED).toBe(true);
    });

    it('is enabled when NODE_ENV is unset', () => {
      const { PERF_LOGGING_ENABLED } = loadWithEnv({
        NODE_ENV: undefined,
        PERF_LOGGING: undefined,
      });

      expect(PERF_LOGGING_ENABLED).toBe(true);
    });

    it('treats any PERF_LOGGING value other than "true" as off in production', () => {
      // Strict equality, so '1' / 'yes' do not silently enable it.
      for (const value of ['1', 'yes', 'TRUE', '']) {
        const { PERF_LOGGING_ENABLED } = loadWithEnv({
          NODE_ENV: 'production',
          PERF_LOGGING: value,
        });
        expect(PERF_LOGGING_ENABLED).toBe(false);
      }
    });
  });

  describe('perfStart', () => {
    it('returns a monotonic timestamp', () => {
      const { perfStart } = loadWithEnv({ NODE_ENV: 'development' });

      const first = perfStart();
      const second = perfStart();

      expect(typeof first).toBe('number');
      expect(second).toBeGreaterThanOrEqual(first);
    });

    it('still returns a timestamp when logging is disabled', () => {
      // Kept unconditional so timings are available the moment logging is
      // switched on mid-incident.
      const { perfStart } = loadWithEnv({ NODE_ENV: 'production' });

      expect(typeof perfStart()).toBe('number');
    });
  });

  describe('perfLog — emission', () => {
    it('emits a formatted line when enabled', () => {
      const { perfLog, perfStart } = loadWithEnv({ NODE_ENV: 'development' });
      const emit = jest.fn();

      perfLog(emit, 'order.save', perfStart());

      expect(emit).toHaveBeenCalledTimes(1);
      expect(emit.mock.calls[0][0]).toMatch(/^\[PERF] order\.save: \d+ms$/);
    });

    it('appends the detail suffix in parentheses when supplied', () => {
      const { perfLog, perfStart } = loadWithEnv({ NODE_ENV: 'development' });
      const emit = jest.fn();

      perfLog(emit, 'POST /orders total', perfStart(), 'payment=online');

      expect(emit.mock.calls[0][0]).toMatch(
        /^\[PERF] POST \/orders total: \d+ms \(payment=online\)$/,
      );
    });

    it('omits the parentheses entirely when detail is undefined', () => {
      const { perfLog, perfStart } = loadWithEnv({ NODE_ENV: 'development' });
      const emit = jest.fn();

      perfLog(emit, 'step', perfStart());

      expect(emit.mock.calls[0][0]).not.toContain('(');
    });

    it('renders an empty-string detail rather than dropping it', () => {
      // '' is a supplied value, not an absent one — the distinction matters
      // because `detail === undefined` is the guard, not truthiness.
      const { perfLog, perfStart } = loadWithEnv({ NODE_ENV: 'development' });
      const emit = jest.fn();

      perfLog(emit, 'step', perfStart(), '');

      expect(emit.mock.calls[0][0]).toMatch(/\(\)$/);
    });

    it('emits nothing at all when disabled', () => {
      const { perfLog, perfStart } = loadWithEnv({ NODE_ENV: 'production' });
      const emit = jest.fn();

      perfLog(emit, 'order.save', perfStart());

      expect(emit).not.toHaveBeenCalled();
    });

    it('does not even read the clock when disabled', () => {
      // The guard must precede the measurement, not merely the emit. If the
      // helper computed the elapsed time and then discarded it, every request
      // would still pay for performance.now() + toFixed() — the per-order cost
      // this change exists to remove. Spying on the clock is what distinguishes
      // "returns early" from "does the work and throws it away".
      const { perfLog } = loadWithEnv({ NODE_ENV: 'production' });
      const emit = jest.fn();
      const nowSpy = jest.spyOn(performance, 'now');

      perfLog(emit, 'order.save', 0);

      expect(nowSpy).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalled();
      nowSpy.mockRestore();
    });

    it('reads the clock exactly once when enabled', () => {
      const { perfLog } = loadWithEnv({ NODE_ENV: 'development' });
      const emit = jest.fn();
      const nowSpy = jest.spyOn(performance, 'now');

      perfLog(emit, 'order.save', 0);

      expect(nowSpy).toHaveBeenCalledTimes(1);
      nowSpy.mockRestore();
    });

    it('reports elapsed time as a non-negative whole number of ms', () => {
      const { perfLog, perfStart } = loadWithEnv({ NODE_ENV: 'development' });
      const emit = jest.fn();

      perfLog(emit, 'step', perfStart());

      const elapsed = /: (\d+)ms/.exec(emit.mock.calls[0][0] as string)?.[1];
      expect(Number(elapsed)).toBeGreaterThanOrEqual(0);
    });

    it('measures from the supplied start, not from the call', () => {
      const { perfLog } = loadWithEnv({ NODE_ENV: 'development' });
      const emit = jest.fn();

      // A start 500ms in the past must surface as ~500ms, not ~0ms.
      perfLog(emit, 'slow step', performance.now() - 500);

      const elapsed = Number(/: (\d+)ms/.exec(emit.mock.calls[0][0] as string)?.[1]);
      expect(elapsed).toBeGreaterThanOrEqual(490);
    });
  });
});
