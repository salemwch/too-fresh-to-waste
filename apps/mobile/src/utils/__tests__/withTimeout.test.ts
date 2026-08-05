/**
 * The failure this exists to prevent is a timer that outlives its race.
 *
 * Reverse geocoding built its timeout promise before an early return, so a hit
 * in the bundled Tunisian-cities lookup left an armed timer nobody was
 * awaiting. Fifteen seconds later it rejected with no handler attached and
 * Sentry recorded "Reverse geocoding timeout" as an error — for a lookup that
 * had succeeded. It ran for two months on the path most users take.
 *
 * So the assertions here are mostly about what is left behind after the call,
 * not about the value it returns. Fake timers make "is anything still armed?"
 * directly observable.
 */

import { CancelledError, TimeoutError, withTimeout } from '../withTimeout';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

const controller = () => new AbortController();

describe('withTimeout', () => {
  describe('cleanup — the actual bug', () => {
    it('leaves no timer armed after the operation resolves', async () => {
      const { signal } = controller();

      await withTimeout(Promise.resolve('done'), 15_000, signal, 'too slow');

      expect(jest.getTimerCount()).toBe(0);
    });

    it('leaves no timer armed after the operation rejects', async () => {
      const { signal } = controller();

      await expect(
        withTimeout(Promise.reject(new Error('network')), 15_000, signal, 'too slow'),
      ).rejects.toThrow('network');

      expect(jest.getTimerCount()).toBe(0);
    });

    it('produces no unhandled rejection once the operation has won', async () => {
      // The original failure mode: advancing past the deadline after a
      // successful call used to reject a promise nobody was holding.
      const { signal } = controller();
      const unhandled = jest.fn();
      process.on('unhandledRejection', unhandled);

      await withTimeout(Promise.resolve('done'), 15_000, signal, 'too slow');
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();

      process.off('unhandledRejection', unhandled);
      expect(unhandled).not.toHaveBeenCalled();
    });

    it('detaches its abort listener so a reused signal does not accumulate them', async () => {
      // Signals outlive individual calls; without removal the handlers pile up
      // and eventually trip MaxListenersExceededWarning.
      const { signal } = controller();
      const removeSpy = jest.spyOn(signal, 'removeEventListener');

      await withTimeout(Promise.resolve('done'), 15_000, signal, 'too slow');

      expect(removeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('racing', () => {
    it('returns the value when the operation wins', async () => {
      const { signal } = controller();

      await expect(withTimeout(Promise.resolve(42), 15_000, signal, 'too slow')).resolves.toBe(42);
    });

    it('rejects with TimeoutError when the deadline wins', async () => {
      const { signal } = controller();
      const never = new Promise<string>(() => {
        // Never settles — stands in for a request that hangs.
      });

      const raced = withTimeout(never, 15_000, signal, 'too slow');
      jest.advanceTimersByTime(15_000);

      await expect(raced).rejects.toBeInstanceOf(TimeoutError);
      await expect(raced).rejects.toThrow('too slow');
    });

    it('does not time out early', async () => {
      const { signal } = controller();
      let settle: (value: string) => void = () => undefined;
      const pending = new Promise<string>(resolve => {
        settle = resolve;
      });

      const raced = withTimeout(pending, 15_000, signal, 'too slow');
      jest.advanceTimersByTime(14_999);
      settle('just in time');

      await expect(raced).resolves.toBe('just in time');
    });
  });

  describe('cancellation', () => {
    it('rejects with CancelledError when the signal fires mid-flight', async () => {
      const abort = controller();
      const never = new Promise<string>(() => {
        // Never settles.
      });

      const raced = withTimeout(never, 15_000, abort.signal, 'too slow');
      abort.abort();

      await expect(raced).rejects.toBeInstanceOf(CancelledError);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('rejects immediately when handed an already-aborted signal', async () => {
      // No timer should be armed at all in this case.
      const abort = controller();
      abort.abort();

      await expect(
        withTimeout(Promise.resolve('done'), 15_000, abort.signal, 'too slow'),
      ).rejects.toBeInstanceOf(CancelledError);
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('error identity', () => {
    it('distinguishes timeout from cancellation by type, not message', () => {
      // locationSlice branches on these to choose between the coordinate
      // fallback and a silent cancel; matching on message text broke whenever
      // the string was reworded.
      expect(new TimeoutError('x')).toBeInstanceOf(TimeoutError);
      expect(new TimeoutError('x')).not.toBeInstanceOf(CancelledError);
      expect(new CancelledError()).toBeInstanceOf(CancelledError);
      expect(new CancelledError()).not.toBeInstanceOf(TimeoutError);
    });
  });
});
