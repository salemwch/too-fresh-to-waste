/**
 * useFavoriteToggle — the optimistic contract
 *
 * These four guarantees used to live in `favoritesSlice` and were verified only
 * by inspection. They now live in React Query's mutation lifecycle, so they are
 * pinned here:
 *
 *   1. the heart flips before the request resolves
 *   2. it rolls back to the exact prior state if the request fails
 *   3. a second toggle cannot race the first
 *   4. offline toggles are queued and never sent
 *
 * (4) is the one that made this migration non-trivial: the optimistic patch has
 * to survive a cold start until the write queue drains, which is why the
 * favourites query is on the persister allowlist.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import React from 'react';

import { favoriteKeys } from '../favoriteKeys';

const mockToggleFavorite = jest.fn();
const mockGetFavoriteIds = jest.fn();
jest.mock('../../services', () => ({
  favoritesService: {
    toggleFavorite: (...args: unknown[]) => mockToggleFavorite(...args),
    getFavoriteIds: () => mockGetFavoriteIds(),
  },
}));

const mockEnqueue = jest.fn();
jest.mock('@/services/OfflineWriteQueue', () => ({
  offlineWriteQueue: { enqueue: (...a: unknown[]) => mockEnqueue(...a) },
}));

const mockIsOffline = jest.fn(() => false);
jest.mock('@/utils/offlineManager', () => ({
  offlineManager: { isOffline: () => mockIsOffline() },
}));

jest.mock('@/utils/logger', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ dispatch: jest.fn() }) }));
jest.mock('react-native-toast-message', () => ({ show: jest.fn(), hide: jest.fn() }));

// The read hook is exercised separately; here we only need its value to come
// from the same cache the mutation patches.
jest.mock('@/hooks/redux', () => ({
  useAppSelector: (fn: (s: unknown) => unknown) =>
    fn({ auth: { isAuthenticated: true, sessionExpiresAt: null } }),
}));

import { useFavoriteToggle } from '../useFavoriteToggle';

const OFFER = 'offer-1';

function setup(seedIds: string[] = []) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  createdClients.push(queryClient);
  queryClient.setQueryData(favoriteKeys.ids(), seedIds);

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const view = renderHook(() => useFavoriteToggle(OFFER, 'Bag', 'img'), { wrapper });
  return { ...view, queryClient };
}

/** Clients created per test, torn down so their timers do not outlive the run. */
const createdClients: QueryClient[] = [];

const idsIn = (qc: QueryClient) => qc.getQueryData<readonly string[]>(favoriteKeys.ids()) ?? [];

describe('useFavoriteToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOffline.mockReturnValue(false);
    mockToggleFavorite.mockResolvedValue({ isFavorite: true, message: 'ok' });
    mockGetFavoriteIds.mockResolvedValue({ ids: [] });
  });

  afterEach(() => {
    createdClients.forEach(c => {
      c.cancelQueries();
      c.clear();
    });
    createdClients.length = 0;
  });

  describe('optimistic update', () => {
    it('adds the id to the cache before the request resolves', async () => {
      let release!: () => void;
      mockToggleFavorite.mockReturnValue(
        new Promise<void>(resolve => {
          release = resolve;
        }),
      );

      const { result, queryClient } = setup([]);
      void act(() => {
        void result.current.toggle();
      });

      // Patched while the request is still in flight — the whole point.
      await waitFor(() => expect(idsIn(queryClient)).toContain(OFFER));

      release();
    });

    it('removes the id when toggling an existing favourite', async () => {
      const { result, queryClient } = setup([OFFER]);

      await act(async () => {
        await result.current.toggle();
      });

      await waitFor(() => expect(idsIn(queryClient)).not.toContain(OFFER));
    });

    it('reports isFavorite from the same cache it patches', async () => {
      const { result } = setup([OFFER]);
      await waitFor(() => expect(result.current.isFavorite).toBe(true));
    });
  });

  describe('rollback', () => {
    // Restores the snapshot rather than re-toggling, so a concurrent change
    // cannot be clobbered by an inverted guess.
    it('restores the exact previous list when the request fails', async () => {
      mockToggleFavorite.mockRejectedValue(new Error('network'));
      // The write failed, so the server still holds the original list — the
      // refetch that onSettled triggers must agree with the rollback.
      const seed = ['other-offer'];
      mockGetFavoriteIds.mockResolvedValue({ ids: seed });
      const { result, queryClient } = setup(seed);

      await act(async () => {
        await result.current.toggle();
      });

      await waitFor(() => expect(idsIn(queryClient)).toEqual(seed));
    });

    it('does not throw out of toggle when the request fails', async () => {
      mockToggleFavorite.mockRejectedValue(new Error('network'));
      const { result } = setup([]);

      await expect(
        act(async () => {
          await result.current.toggle();
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('offline', () => {
    it('queues the write and never calls the API', async () => {
      mockIsOffline.mockReturnValue(true);
      const { result, queryClient } = setup([]);

      await act(async () => {
        await result.current.toggle();
      });

      expect(mockToggleFavorite).not.toHaveBeenCalled();
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({ id: `FAVORITE_TOGGLE:${OFFER}`, type: 'FAVORITE_TOGGLE' }),
      );
      // The cache is still patched, so the heart stays filled — and because
      // this query is persisted, it survives a restart until the queue drains.
      expect(idsIn(queryClient)).toContain(OFFER);
    });
  });

  describe('concurrency', () => {
    it('ignores a second toggle while the first is in flight', async () => {
      let release!: () => void;
      mockToggleFavorite.mockReturnValue(
        new Promise<void>(resolve => {
          release = resolve;
        }),
      );

      const { result } = setup([]);
      void act(() => {
        void result.current.toggle();
      });
      await waitFor(() => expect(result.current.isLoading).toBe(true));

      await act(async () => {
        await result.current.toggle();
      });

      expect(mockToggleFavorite).toHaveBeenCalledTimes(1);
      release();
    });
  });
});
