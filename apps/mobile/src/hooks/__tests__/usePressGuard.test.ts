/**
 * usePressGuard — Stress Tests
 *
 * Verifies the hook correctly throttles rapid-fire invocations
 * including a 500-press-in-60s scenario.
 */

import { renderHook, act } from '@testing-library/react-native';

import { usePressGuard } from '../usePressGuard';

// Use fake timers so we can control cooldown windows
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('usePressGuard', () => {
  it('allows the first press immediately', () => {
    const handler = jest.fn();
    const { result } = renderHook(() => usePressGuard(handler, 500));

    act(() => result.current.guardedPress());

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('blocks presses within the cooldown window', () => {
    const handler = jest.fn();
    const { result } = renderHook(() => usePressGuard(handler, 500));

    act(() => {
      result.current.guardedPress(); // accepted (t=0)
      result.current.guardedPress(); // blocked  (t≈0)
      result.current.guardedPress(); // blocked  (t≈0)
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('allows a press after the cooldown expires', () => {
    const handler = jest.fn();
    const { result } = renderHook(() => usePressGuard(handler, 500));

    act(() => result.current.guardedPress()); // accepted
    expect(handler).toHaveBeenCalledTimes(1);

    // Advance past cooldown
    act(() => jest.advanceTimersByTime(501));

    act(() => result.current.guardedPress()); // accepted again
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('sets isGuarded ref during cooldown', () => {
    const handler = jest.fn();
    const { result } = renderHook(() => usePressGuard(handler, 500));

    expect(result.current.isGuarded.current).toBe(false);

    act(() => result.current.guardedPress());
    expect(result.current.isGuarded.current).toBe(true);

    act(() => jest.advanceTimersByTime(501));
    expect(result.current.isGuarded.current).toBe(false);
  });

  it('handles undefined handler without throwing', () => {
    const { result } = renderHook(() => usePressGuard(undefined, 500));

    expect(() => {
      act(() => result.current.guardedPress());
    }).not.toThrow();
  });

  it('passes arguments through to the handler', () => {
    const handler = jest.fn();
    const { result } = renderHook(() => usePressGuard(handler, 500));

    const fakeEvent = { nativeEvent: { locationX: 42 } };
    act(() => result.current.guardedPress(fakeEvent));

    expect(handler).toHaveBeenCalledWith(fakeEvent);
  });

  // ────────────────────────────────────────────────────────
  // STRESS TEST: 500 rapid presses in 60 seconds
  // ────────────────────────────────────────────────────────
  it('survives 500 rapid presses in 60s — only allows expected number through', () => {
    const handler = jest.fn();
    const cooldownMs = 500;
    const { result } = renderHook(() => usePressGuard(handler, cooldownMs));

    const totalPresses = 500;
    const totalDurationMs = 60_000;
    const intervalBetweenPresses = totalDurationMs / totalPresses; // 120ms each

    for (let i = 0; i < totalPresses; i++) {
      act(() => {
        jest.advanceTimersByTime(intervalBetweenPresses);
        result.current.guardedPress();
      });
    }

    // With 500ms cooldown and 120ms interval, one press accepted per
    // ceil(500/120)=5 presses → 500/5 = 100 accepted. Allow generous range
    // because fake-timer discrete steps shift boundaries.
    const expectedMax = 130;
    const expectedMin = 90;

    expect(handler.mock.calls.length).toBeGreaterThanOrEqual(expectedMin);
    expect(handler.mock.calls.length).toBeLessThanOrEqual(expectedMax);

    // Most importantly: FAR fewer than the 500 raw taps
    expect(handler.mock.calls.length).toBeLessThan(totalPresses);
  });

  it('stress test: 500 synchronous presses with 0ms between — only 1 gets through', () => {
    const handler = jest.fn();
    const { result } = renderHook(() => usePressGuard(handler, 1000));

    act(() => {
      for (let i = 0; i < 500; i++) {
        result.current.guardedPress();
      }
    });

    // All 500 happen at the same timestamp → only the first is accepted
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
