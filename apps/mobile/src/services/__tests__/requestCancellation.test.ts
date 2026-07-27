/**
 * Request cancellation.
 *
 * This exists so a response cannot land after the session is torn down and
 * re-trigger an auth flow — logout and account deletion both call
 * cancelInflightRequests. A controller that is never released leaks, and the
 * leak is silent: nothing crashes, the set just grows for the life of the app.
 *
 * getInflightRequestCount was written for exactly this ("exposed for
 * diagnostics/tests so a controller leak is observable rather than silent") but
 * nothing used it, which is why knip reported it as dead. It is not dead — it
 * was unused. These are the tests it was waiting for.
 */

import {
  cancelInflightRequests,
  createTrackedAbortController,
  getInflightRequestCount,
  releaseTrackedAbortController,
} from '../requestCancellation';

jest.mock('@/utils/logger', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('request cancellation', () => {
  // The tracking set is module state; each test must start from empty.
  beforeEach(() => {
    cancelInflightRequests();
  });

  describe('tracking', () => {
    it('starts with nothing in flight', () => {
      expect(getInflightRequestCount()).toBe(0);
    });

    it('counts each controller created', () => {
      createTrackedAbortController();
      createTrackedAbortController();

      expect(getInflightRequestCount()).toBe(2);
    });

    it('hands back a usable controller', () => {
      const controller = createTrackedAbortController();

      expect(controller.signal.aborted).toBe(false);
    });
  });

  describe('releasing', () => {
    // The leak case: a completed request that never releases its controller
    // grows the set for the life of the app, and nothing surfaces it.
    it('drops the controller for a completed request', () => {
      const controller = createTrackedAbortController();

      releaseTrackedAbortController(controller.signal);

      expect(getInflightRequestCount()).toBe(0);
    });

    it('drops only the matching controller', () => {
      const first = createTrackedAbortController();
      createTrackedAbortController();

      releaseTrackedAbortController(first.signal);

      expect(getInflightRequestCount()).toBe(1);
    });

    // The signal arrives from axios config, so its shape is not guaranteed.
    it.each([undefined, null, {}, 'signal', 42])('ignores a non-signal value %p', value => {
      createTrackedAbortController();

      expect(() => releaseTrackedAbortController(value)).not.toThrow();
      expect(getInflightRequestCount()).toBe(1);
    });

    it('is idempotent', () => {
      const controller = createTrackedAbortController();

      releaseTrackedAbortController(controller.signal);
      releaseTrackedAbortController(controller.signal);

      expect(getInflightRequestCount()).toBe(0);
    });
  });

  describe('cancelling everything', () => {
    it('aborts every tracked request', () => {
      const first = createTrackedAbortController();
      const second = createTrackedAbortController();

      cancelInflightRequests();

      expect(first.signal.aborted).toBe(true);
      expect(second.signal.aborted).toBe(true);
    });

    // Otherwise logout leaks every controller it just aborted.
    it('empties the set', () => {
      createTrackedAbortController();
      createTrackedAbortController();

      cancelInflightRequests();

      expect(getInflightRequestCount()).toBe(0);
    });

    it('does nothing when there is nothing in flight', () => {
      expect(() => cancelInflightRequests()).not.toThrow();
      expect(getInflightRequestCount()).toBe(0);
    });

    // Logout can be triggered twice — a second pass must not throw on
    // controllers that are already aborted.
    it('survives being called twice', () => {
      createTrackedAbortController();

      cancelInflightRequests();

      expect(() => cancelInflightRequests()).not.toThrow();
    });

    it('leaves already-released controllers alone', () => {
      const released = createTrackedAbortController();
      releaseTrackedAbortController(released.signal);
      const active = createTrackedAbortController();

      cancelInflightRequests();

      expect(released.signal.aborted).toBe(false);
      expect(active.signal.aborted).toBe(true);
    });
  });

  // The property the module exists for, stated end to end.
  it('leaves nothing tracked after a full request lifecycle', () => {
    const completed = createTrackedAbortController();
    releaseTrackedAbortController(completed.signal);

    createTrackedAbortController();
    cancelInflightRequests();

    expect(getInflightRequestCount()).toBe(0);
  });
});
