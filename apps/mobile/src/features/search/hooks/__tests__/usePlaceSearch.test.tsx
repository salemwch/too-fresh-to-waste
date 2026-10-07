/**
 * usePlaceSearch — the dual-source search pipeline.
 *
 * The search bar runs Google Places autocomplete and app establishment search
 * in parallel. Zero results from both means either:
 *   1. The query is too short (< 2 chars)
 *   2. Google returned nothing for the term
 *   3. No registered establishment matches the regex on name/city/street
 *   4. Both services errored and were swallowed by .catch()
 *
 * These tests pin the contract at each seam: when the query fires, what the
 * services receive, how errors are contained, and what the consumer sees.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react-native';
import React from 'react';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockAutocomplete = jest.fn();
jest.mock('@/services/location/RemoteLocationService', () => ({
  remoteLocationService: {
    autocomplete: (...a: unknown[]) => mockAutocomplete(...a),
    getPlaceDetails: jest.fn(),
  },
}));

const mockSearchEstablishments = jest.fn();
jest.mock('@/features/offers/services/nearbyOffersService', () => ({
  nearbyOffersService: {
    searchEstablishments: (...a: unknown[]) => mockSearchEstablishments(...a),
  },
}));

jest.mock('@/utils/logger', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { usePlaceSearch } from '../usePlaceSearch';

// ── Helpers ────────────────────────────────────────────────────────────────

const SOUSSE = { latitude: 35.8245, longitude: 10.6346 };
const RADIUS = 15_000;

const googleResult = (id: string, name: string) => ({
  id,
  name,
  subtext: `${name}, Tunisia`,
  coords: { lat: 35.8, lng: 10.6 },
});

const appResult = (id: string, name: string, city: string) => ({
  item: { _id: id, name, address: { city, formattedAddress: `${name}, ${city}` } },
  distance: { value: 2, unit: 'kilometers', formatted: '2 km' },
  geoData: { coordinates: { latitude: 35.8, longitude: 10.6 } },
});

const createdClients: QueryClient[] = [];

function setup(query: string, center = SOUSSE, radius = RADIUS) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  createdClients.push(queryClient);

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const view = renderHook(({ q }: { q: string }) => usePlaceSearch(q, center, radius), {
    wrapper,
    initialProps: { q: query },
  });
  return { ...view, queryClient };
}

/**
 * Flush debounce (300ms) + let React Query run its queryFn + flush the
 * TanStack notification batch (which also uses setTimeout).
 */
async function flushDebounceAndQuery() {
  // Advance past useDebounce's 300ms setTimeout
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
  // Let resolved promises propagate through the microtask queue
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  // Flush TanStack Query's batched notification setTimeout
  await act(async () => {
    jest.advanceTimersByTime(10);
  });
  // One more microtask flush for React state updates
  await act(async () => {
    await Promise.resolve();
  });
}

// ── Suite ──────────────────────────────────────────────────────────────────

describe('usePlaceSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockAutocomplete.mockResolvedValue([]);
    mockSearchEstablishments.mockResolvedValue([]);
  });

  afterEach(() => {
    createdClients.forEach(c => {
      c.cancelQueries();
      c.clear();
    });
    createdClients.length = 0;
    jest.useRealTimers();
  });

  describe('query gating', () => {
    it('does not fire any request when the query is below 2 characters', async () => {
      setup('b');
      await flushDebounceAndQuery();

      expect(mockAutocomplete).not.toHaveBeenCalled();
      expect(mockSearchEstablishments).not.toHaveBeenCalled();
    });

    it('fires both searches once the debounced query reaches 2 characters', async () => {
      setup('bo');
      await flushDebounceAndQuery();

      expect(mockAutocomplete).toHaveBeenCalledTimes(1);
      expect(mockSearchEstablishments).toHaveBeenCalledTimes(1);
    });
  });

  describe('parallel search', () => {
    it('passes the query and limit to Google autocomplete', async () => {
      setup('sousse');
      await flushDebounceAndQuery();

      expect(mockAutocomplete).toHaveBeenCalledWith('sousse', expect.any(String), 5);
    });

    it('passes center, radius, and query to app establishment search', async () => {
      setup('sousse');
      await flushDebounceAndQuery();

      expect(mockSearchEstablishments).toHaveBeenCalledWith(
        expect.objectContaining({
          center: SOUSSE,
          radius: RADIUS,
          query: 'sousse',
          limit: 10,
          sortByDistance: true,
        }),
      );
    });
  });

  describe('result merging', () => {
    it('surfaces Google results and app results separately', async () => {
      mockAutocomplete.mockResolvedValue([googleResult('g1', 'Sousse Park')]);
      mockSearchEstablishments.mockResolvedValue([appResult('e1', 'Boulangerie', 'Sousse')]);

      const { result } = setup('sousse');
      await flushDebounceAndQuery();

      expect(result.current.googleResults).toHaveLength(1);
      expect(result.current.appResults).toHaveLength(1);
      expect(result.current.hasResults).toBe(true);
      expect(result.current.totalResults).toBe(2);
    });

    it('reports hasResults=false when both sources return empty', async () => {
      const { result } = setup('zzznonexistent');
      await flushDebounceAndQuery();

      expect(result.current.hasResults).toBe(false);
      expect(result.current.totalResults).toBe(0);
    });

    it('returns app results even when Google fails', async () => {
      mockAutocomplete.mockRejectedValue(new Error('network'));
      mockSearchEstablishments.mockResolvedValue([appResult('e1', 'Café Tunis', 'Tunis')]);

      const { result } = setup('tunis');
      await flushDebounceAndQuery();

      expect(result.current.googleResults).toHaveLength(0);
      expect(result.current.appResults).toHaveLength(1);
      expect(result.current.hasResults).toBe(true);
    });

    it('returns Google results even when app search fails', async () => {
      mockAutocomplete.mockResolvedValue([googleResult('g1', 'Tunis')]);
      mockSearchEstablishments.mockRejectedValue(new Error('timeout'));

      const { result } = setup('tunis');
      await flushDebounceAndQuery();

      expect(result.current.googleResults).toHaveLength(1);
      expect(result.current.appResults).toHaveLength(0);
      expect(result.current.hasResults).toBe(true);
    });

    it('returns empty arrays when both services fail', async () => {
      mockAutocomplete.mockRejectedValue(new Error('fail'));
      mockSearchEstablishments.mockRejectedValue(new Error('fail'));

      const { result } = setup('tunis');
      await flushDebounceAndQuery();

      expect(result.current.hasResults).toBe(false);
      expect(result.current.googleResults).toEqual([]);
      expect(result.current.appResults).toEqual([]);
    });
  });

  describe('Tunisian city searches', () => {
    it.each([
      ['tunis', 'Tunis'],
      ['sousse', 'Sousse'],
      ['sfax', 'Sfax'],
      ['monastir', 'Monastir'],
      ['nabeul', 'Nabeul'],
    ])('query "%s" reaches the backend which can match city "%s"', async (query, city) => {
      mockSearchEstablishments.mockResolvedValue([
        appResult(`e-${city}`, `Restaurant ${city}`, city),
      ]);

      const { result } = setup(query);
      await flushDebounceAndQuery();

      expect(mockSearchEstablishments).toHaveBeenCalledWith(expect.objectContaining({ query }));
      expect(result.current.appResults).toHaveLength(1);
    });

    it('the query "msaken" reaches the backend - whether it matches depends on stored city name', async () => {
      setup('msaken');
      await flushDebounceAndQuery();

      expect(mockSearchEstablishments).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'msaken' }),
      );
    });
  });

  describe('session token lifecycle', () => {
    it('passes a session token string to Google autocomplete', async () => {
      setup('so');
      await flushDebounceAndQuery();

      expect(mockAutocomplete).toHaveBeenCalledTimes(1);
      const token = mockAutocomplete.mock.calls[0]?.[1];
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });
  });
});
