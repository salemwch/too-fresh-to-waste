/**
 * useOncePerOrderFlag.
 *
 * Persists "this already happened for this order" across sessions. Getting it
 * wrong in either direction is user-visible: forget, and the review prompt
 * reappears every time the screen mounts; over-remember, and it never shows.
 *
 * Storage is the failure surface here — it can be empty, corrupt, or refuse to
 * write — so those paths carry as much weight as the happy one.
 */

import { act, renderHook } from '@testing-library/react-native';

const store = new Map<string, string>();
const mockGetString = jest.fn((key: string) => store.get(key));
const mockSet = jest.fn((key: string, value: string) => store.set(key, value));

jest.mock('@/utils/mmkvStorage', () => ({
  mmkv: {
    getString: (key: string) => mockGetString(key),
    set: (key: string, value: string) => mockSet(key, value),
  },
}));

import { useOncePerOrderFlag } from '../useOncePerOrderFlag';

const KEY = 'reviewed_orders';

const setup = (orderId = 'order-1', key = KEY) =>
  renderHook(() => useOncePerOrderFlag(key, orderId));

const stored = (key = KEY): string[] => JSON.parse(store.get(key) ?? '[]') as string[];

describe('useOncePerOrderFlag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.clear();
  });

  describe('reading on mount', () => {
    it('is false when nothing has been stored', () => {
      expect(setup().result.current[0]).toBe(false);
    });

    it('is true when this order is already recorded', () => {
      store.set(KEY, JSON.stringify(['order-1']));

      expect(setup().result.current[0]).toBe(true);
    });

    it('is false when other orders are recorded but not this one', () => {
      store.set(KEY, JSON.stringify(['order-9', 'order-8']));

      expect(setup().result.current[0]).toBe(false);
    });

    // Two flags share this hook against different keys; a hit under one must
    // not satisfy the other.
    it('does not read across keys', () => {
      store.set('impact_shown_orders', JSON.stringify(['order-1']));

      expect(setup('order-1', KEY).result.current[0]).toBe(false);
    });

    // Reads once, not on every render.
    it('reads storage a single time on mount', () => {
      const { rerender } = setup();
      rerender(undefined);
      rerender(undefined);

      expect(mockGetString).toHaveBeenCalledTimes(1);
    });
  });

  describe('marking', () => {
    it('flips the flag and persists the id', () => {
      const { result } = setup();

      act(() => result.current[1]());

      expect(result.current[0]).toBe(true);
      expect(stored()).toEqual(['order-1']);
    });

    it('appends without dropping other orders', () => {
      store.set(KEY, JSON.stringify(['order-9']));
      const { result } = setup();

      act(() => result.current[1]());

      expect(stored()).toEqual(['order-9', 'order-1']);
    });

    // Marking twice must not write the id twice — the list would grow with
    // duplicates on every remount.
    it('is idempotent', () => {
      const { result } = setup();

      act(() => result.current[1]());
      act(() => result.current[1]());

      expect(stored()).toEqual(['order-1']);
    });

    it('does not rewrite storage when the id is already present', () => {
      store.set(KEY, JSON.stringify(['order-1']));
      const { result } = setup();

      act(() => result.current[1]());

      expect(mockSet).not.toHaveBeenCalled();
      expect(result.current[0]).toBe(true);
    });
  });

  describe('bounded growth', () => {
    // Unbounded, this list grows by one id per order forever and is parsed in
    // full on every mount.
    it('keeps the list at the cap', () => {
      store.set(KEY, JSON.stringify(Array.from({ length: 500 }, (_, i) => `old-${i}`)));
      const { result } = setup('order-new');

      act(() => result.current[1]());

      expect(stored()).toHaveLength(500);
    });

    it('drops the oldest and keeps the newest', () => {
      store.set(KEY, JSON.stringify(Array.from({ length: 500 }, (_, i) => `old-${i}`)));
      const { result } = setup('order-new');

      act(() => result.current[1]());

      expect(stored()).not.toContain('old-0');
      expect(stored()).toContain('order-new');
      expect(stored()).toContain('old-499');
    });
  });

  describe('unusable storage', () => {
    it.each(['', 'not json', '{"not":"an array"}', 'null'])(
      'treats %p as nothing recorded',
      value => {
        store.set(KEY, value);

        expect(setup().result.current[0]).toBe(false);
      },
    );

    // A hand-edited or half-written array must not poison the list.
    it('ignores non-string entries', () => {
      store.set(KEY, JSON.stringify(['order-1', 42, null, { id: 'x' }]));
      const { result } = setup('order-2');

      act(() => result.current[1]());

      expect(stored()).toEqual(['order-1', 'order-2']);
    });

    it('still recovers the flag from a corrupt list when marking', () => {
      store.set(KEY, 'not json');
      const { result } = setup();

      act(() => result.current[1]());

      expect(stored()).toEqual(['order-1']);
    });

    // The flag must flip for this session even if it cannot be persisted —
    // failing to write is not a reason to re-prompt immediately.
    it('flips the flag even when writing throws', () => {
      mockSet.mockImplementationOnce(() => {
        throw new Error('storage full');
      });
      const { result } = setup();

      expect(() => act(() => result.current[1]())).not.toThrow();
      expect(result.current[0]).toBe(true);
    });

    it('reports false when reading throws', () => {
      mockGetString.mockImplementationOnce(() => {
        throw new Error('storage unavailable');
      });

      expect(setup().result.current[0]).toBe(false);
    });
  });
});
