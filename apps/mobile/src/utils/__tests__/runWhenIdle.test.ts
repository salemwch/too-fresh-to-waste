/**
 * runWhenIdle - the InteractionManager.runAfterInteractions replacement.
 *
 * Six call sites depend on two properties: the task does not run synchronously
 * (that is the whole point of deferring past the first frame), and the returned
 * function cancels it (every useEffect returns it as cleanup, so a screen that
 * unmounts before idle must not run stale work).
 */

import { IDLE_TASK_TIMEOUT_MS, runWhenIdle } from '../runWhenIdle';

describe('runWhenIdle', () => {
  const realRequest = globalThis.requestIdleCallback;
  const realCancel = globalThis.cancelIdleCallback;

  afterEach(() => {
    globalThis.requestIdleCallback = realRequest;
    globalThis.cancelIdleCallback = realCancel;
    jest.useRealTimers();
  });

  it('does not run the task synchronously', () => {
    jest.useFakeTimers();
    const task = jest.fn();

    runWhenIdle(task);

    expect(task).not.toHaveBeenCalled();
    jest.runAllTimers();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('never runs the task once cancelled', () => {
    jest.useFakeTimers();
    const task = jest.fn();

    const cancel = runWhenIdle(task);
    cancel();
    jest.runAllTimers();

    expect(task).not.toHaveBeenCalled();
  });

  it('is safe to cancel after the task already ran', () => {
    jest.useFakeTimers();
    const task = jest.fn();

    const cancel = runWhenIdle(task);
    jest.runAllTimers();

    expect(() => cancel()).not.toThrow();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('passes the default timeout so a busy thread cannot starve the task', () => {
    const request = jest.fn().mockReturnValue(7);
    globalThis.requestIdleCallback = request;

    runWhenIdle(jest.fn());

    expect(request).toHaveBeenCalledWith(expect.any(Function), { timeout: IDLE_TASK_TIMEOUT_MS });
  });

  it('honours an explicit timeout', () => {
    const request = jest.fn().mockReturnValue(7);
    globalThis.requestIdleCallback = request;

    runWhenIdle(jest.fn(), 250);

    expect(request).toHaveBeenCalledWith(expect.any(Function), { timeout: 250 });
  });

  it('cancels the exact handle it was given', () => {
    const cancelSpy = jest.fn();
    globalThis.requestIdleCallback = jest.fn().mockReturnValue(42);
    globalThis.cancelIdleCallback = cancelSpy;

    runWhenIdle(jest.fn())();

    expect(cancelSpy).toHaveBeenCalledWith(42);
  });
});
