/**
 * The default has to be "animate".
 *
 * A user who has not asked for reduced motion must get exactly the animation
 * they get today, so every uncertain path - the initial async read, a platform
 * that cannot answer, a rejected promise - has to resolve to `false`. Getting
 * that backwards would silently strip animation from everyone.
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { useReducedMotion } from '../useReducedMotion';

type Listener = (enabled: boolean) => void;

let listeners: Listener[] = [];
const remove = jest.fn();

beforeEach(() => {
  listeners = [];
  remove.mockClear();
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockImplementation((event: string, cb: unknown) => {
      if (event === 'reduceMotionChanged') listeners.push(cb as Listener);
      return { remove } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>;
    });
});

afterEach(() => jest.restoreAllMocks());

const mockInitial = (value: boolean | Promise<boolean>) =>
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockReturnValue(value instanceof Promise ? value : Promise.resolve(value));

describe('disabled (the default)', () => {
  it('starts false before the OS has answered', () => {
    mockInitial(new Promise<boolean>(() => {})); // never resolves
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('stays false when the OS reports it off', async () => {
    mockInitial(false);
    const { result } = renderHook(() => useReducedMotion());
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('stays false when the platform cannot report it', async () => {
    mockInitial(Promise.reject(new Error('unsupported')));
    const { result } = renderHook(() => useReducedMotion());
    await waitFor(() => expect(result.current).toBe(false));
  });
});

describe('enabled', () => {
  it('becomes true when the OS reports it on at mount', async () => {
    mockInitial(true);
    const { result } = renderHook(() => useReducedMotion());
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('reacts to the preference being turned on while mounted', async () => {
    mockInitial(false);
    const { result } = renderHook(() => useReducedMotion());
    await waitFor(() => expect(result.current).toBe(false));

    act(() => listeners.forEach(l => l(true)));
    expect(result.current).toBe(true);
  });

  it('reacts to it being turned back off', async () => {
    mockInitial(true);
    const { result } = renderHook(() => useReducedMotion());
    await waitFor(() => expect(result.current).toBe(true));

    act(() => listeners.forEach(l => l(false)));
    expect(result.current).toBe(false);
  });
});

describe('teardown', () => {
  it('removes the subscription on unmount', async () => {
    mockInitial(false);
    const { unmount } = renderHook(() => useReducedMotion());
    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('does not set state after unmount when the initial read resolves late', async () => {
    let resolveRead: (v: boolean) => void = () => {};
    mockInitial(
      new Promise<boolean>(res => {
        resolveRead = res;
      }),
    );

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = renderHook(() => useReducedMotion());
    unmount();

    await act(async () => {
      resolveRead(true);
      await Promise.resolve();
    });

    // A state write after teardown surfaces as a React console error.
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
