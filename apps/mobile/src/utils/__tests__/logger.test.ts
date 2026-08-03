/**
 * Logger buffer behaviour.
 *
 * The in-memory ring buffer is written on EVERY log call, and the QueryCache
 * hooks route through it, so its cost lands on the JS thread on every query
 * resolution — exactly where React Native jank comes from.
 *
 * Two defects were fixed here and both are regression-guarded below:
 *
 *  1. `shouldLog` gated only console output, so `logLevel: 'error'` in
 *     production still paid the full allocation + buffer write for every DEBUG
 *     call. Configuring the level away did not make it free.
 *  2. Trimming used `this.logs.slice(-maxLogs)`, allocating a fresh
 *     1000-element array on every call once full — which happens within a
 *     minute of use.
 */

/**
 * The public surface these tests drive.
 *
 * Declared structurally rather than inferring `typeof Logger`: the singleton's
 * class is not exported, so inference leaks its private members and trips
 * TS4094 under declaration emit. This also states exactly what the tests rely on.
 */
interface TestLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>, error?: Error): void;
  error(message: string, context?: Record<string, unknown>, error?: Error): void;
  getLogs(): Array<{
    message: string;
    timestamp: string;
    context?: Record<string, unknown>;
    error?: Error;
  }>;
  clearLogs(): void;
}

const loadLoggerWithLevel = (logLevel: 'debug' | 'info' | 'warn' | 'error'): TestLogger => {
  jest.resetModules();

  jest.doMock('@/config/environment', () => ({
    environment: {
      debug: { logLevel },
      monitoring: { enableCrashlytics: false },
    },
  }));

  jest.doMock('@sentry/react-native', () => ({
    addBreadcrumb: jest.fn(),
    captureException: jest.fn(),
  }));

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const loaded = require('../logger') as { Logger: TestLogger };
  return loaded.Logger;
};

describe('Logger — buffer retention', () => {
  let consoleSpies: jest.SpyInstance[];

  beforeEach(() => {
    // The logger writes through to console; silence it so test output stays readable.
    consoleSpies = [
      jest.spyOn(console, 'debug').mockImplementation(() => undefined),
      jest.spyOn(console, 'info').mockImplementation(() => undefined),
      jest.spyOn(console, 'warn').mockImplementation(() => undefined),
      jest.spyOn(console, 'error').mockImplementation(() => undefined),
    ];
  });

  afterEach(() => {
    consoleSpies.forEach(spy => spy.mockRestore());
    jest.resetModules();
  });

  describe('level gating', () => {
    it('does not retain entries below the configured level', () => {
      // The regression. At logLevel 'error', a DEBUG call must cost nothing —
      // no entry, no allocation, no buffer write.
      const Logger = loadLoggerWithLevel('error');
      Logger.clearLogs();

      Logger.debug('noisy');
      Logger.info('also noisy');
      Logger.warn('still below error');

      expect(Logger.getLogs()).toHaveLength(0);
    });

    it('retains entries at the configured level', () => {
      const Logger = loadLoggerWithLevel('error');
      Logger.clearLogs();

      Logger.error('real failure');

      expect(Logger.getLogs()).toHaveLength(1);
    });

    it('retains entries above the configured level', () => {
      const Logger = loadLoggerWithLevel('warn');
      Logger.clearLogs();

      Logger.warn('at level');
      Logger.error('above level');

      expect(Logger.getLogs()).toHaveLength(2);
    });

    it('retains every level when configured to debug', () => {
      const Logger = loadLoggerWithLevel('debug');
      Logger.clearLogs();

      Logger.debug('d');
      Logger.info('i');
      Logger.warn('w');
      Logger.error('e');

      expect(Logger.getLogs()).toHaveLength(4);
    });

    it('suppresses the highest-volume path (debug) at the production level', () => {
      // 143 Logger.debug call sites exist in the app. At logLevel 'error' every
      // one of them must be free.
      const Logger = loadLoggerWithLevel('error');
      Logger.clearLogs();

      for (let i = 0; i < 5000; i++) {
        Logger.debug(`chatter ${i}`);
      }

      expect(Logger.getLogs()).toHaveLength(0);
    });
  });

  describe('ring buffer bounds', () => {
    it('never exceeds the 1000-entry cap', () => {
      const Logger = loadLoggerWithLevel('debug');
      Logger.clearLogs();

      for (let i = 0; i < 1500; i++) {
        Logger.debug(`entry ${i}`);
      }

      expect(Logger.getLogs()).toHaveLength(1000);
    });

    it('evicts oldest-first, keeping the most recent entries', () => {
      const Logger = loadLoggerWithLevel('debug');
      Logger.clearLogs();

      for (let i = 0; i < 1200; i++) {
        Logger.debug(`entry ${i}`);
      }

      const logs = Logger.getLogs();
      // 1200 written, 1000 retained → the survivors are 200..1199.
      expect(logs[0]?.message).toBe('entry 200');
      expect(logs[logs.length - 1]?.message).toBe('entry 1199');
    });

    it('holds exactly the cap without evicting when filled to the boundary', () => {
      const Logger = loadLoggerWithLevel('debug');
      Logger.clearLogs();

      for (let i = 0; i < 1000; i++) {
        Logger.debug(`entry ${i}`);
      }

      const logs = Logger.getLogs();
      expect(logs).toHaveLength(1000);
      expect(logs[0]?.message).toBe('entry 0');
    });

    it('evicts exactly one entry at one past the boundary', () => {
      const Logger = loadLoggerWithLevel('debug');
      Logger.clearLogs();

      for (let i = 0; i < 1001; i++) {
        Logger.debug(`entry ${i}`);
      }

      const logs = Logger.getLogs();
      expect(logs).toHaveLength(1000);
      expect(logs[0]?.message).toBe('entry 1');
    });

    it('keeps entry order stable across mixed levels', () => {
      const Logger = loadLoggerWithLevel('debug');
      Logger.clearLogs();

      Logger.debug('first');
      Logger.error('second');
      Logger.info('third');

      expect(Logger.getLogs().map(l => l.message)).toEqual(['first', 'second', 'third']);
    });
  });

  describe('entry contents', () => {
    it('records the message, level and an ISO timestamp', () => {
      const Logger = loadLoggerWithLevel('debug');
      Logger.clearLogs();

      Logger.error('boom');

      const entry = Logger.getLogs()[0];
      expect(entry?.message).toBe('boom');
      expect(entry?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('retains supplied context', () => {
      const Logger = loadLoggerWithLevel('debug');
      Logger.clearLogs();

      Logger.error('boom', { orderId: 'o-1' });

      expect(Logger.getLogs()[0]?.context).toEqual({ orderId: 'o-1' });
    });

    it('omits the context key entirely when none is supplied', () => {
      // exactOptionalPropertyTypes — the key must be absent, not undefined.
      const Logger = loadLoggerWithLevel('debug');
      Logger.clearLogs();

      Logger.error('boom');

      expect(Logger.getLogs()[0]).not.toHaveProperty('context');
    });

    it('retains the Error object on error entries', () => {
      const Logger = loadLoggerWithLevel('debug');
      Logger.clearLogs();
      const cause = new Error('root cause');

      Logger.error('wrapper', undefined, cause);

      expect(Logger.getLogs()[0]?.error).toBe(cause);
    });
  });

  describe('getLogs / clearLogs', () => {
    it('returns a copy, so callers cannot mutate the live buffer', () => {
      const Logger = loadLoggerWithLevel('debug');
      Logger.clearLogs();
      Logger.error('kept');

      const snapshot = Logger.getLogs() as unknown as unknown[];
      snapshot.length = 0;

      expect(Logger.getLogs()).toHaveLength(1);
    });

    it('clearLogs empties the buffer', () => {
      const Logger = loadLoggerWithLevel('debug');
      Logger.error('a');
      Logger.error('b');

      Logger.clearLogs();

      expect(Logger.getLogs()).toHaveLength(0);
    });

    it('is safe to clear an already-empty buffer', () => {
      const Logger = loadLoggerWithLevel('debug');
      Logger.clearLogs();

      expect(() => Logger.clearLogs()).not.toThrow();
      expect(Logger.getLogs()).toHaveLength(0);
    });
  });

  describe('console pass-through', () => {
    it('writes suppressed levels to neither the buffer nor the console', () => {
      const Logger = loadLoggerWithLevel('error');
      Logger.clearLogs();

      Logger.debug('suppressed');

      expect(console.debug).not.toHaveBeenCalled();
      expect(Logger.getLogs()).toHaveLength(0);
    });

    it('still writes permitted levels to the console', () => {
      const Logger = loadLoggerWithLevel('debug');
      Logger.clearLogs();

      Logger.debug('shown');

      expect(console.debug).toHaveBeenCalled();
    });
  });
});
