/**
 * Query cache persistence — what is allowed onto disk
 *
 * Persisting the query cache turns every cached response into data at rest, so
 * `shouldPersistQuery` is a security boundary rather than a performance knob.
 * These tests exist so that adding a new query key cannot silently start
 * writing user data to storage: anything not explicitly allowlisted must be
 * dropped, and the default for an unknown key is "do not persist".
 */

import { shouldPersistQuery } from '../persister';

import type { Query } from '@tanstack/react-query';

jest.mock('@/storage/mmkv', () => ({
  storage: { getString: jest.fn(), set: jest.fn(), remove: jest.fn() },
}));
jest.mock('@/utils/logger', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

/** Minimal stand-in — shouldPersistQuery only reads queryKey and state.status. */
const makeQuery = (queryKey: readonly unknown[], status: 'success' | 'error' | 'pending') =>
  ({ queryKey, state: { status } }) as unknown as Query;

describe('shouldPersistQuery', () => {
  describe('allowed onto disk', () => {
    it.each([['offers'], ['establishments'], ['search'], ['categories']])(
      'persists successful %s queries',
      root => {
        expect(shouldPersistQuery(makeQuery([root, 'nearby', { lat: 1 }], 'success'))).toBe(true);
      },
    );

    it('matches on the first key segment, not the whole key', () => {
      expect(shouldPersistQuery(makeQuery(['offers', 'detail', 'abc123'], 'success'))).toBe(true);
    });
  });

  describe('kept off disk', () => {
    // The point of the allowlist. Each of these is either sensitive at rest or
    // must be re-fetched to be correct.
    it.each([
      ['auth'],
      ['user'],
      ['profile'],
      ['orders'],
      ['payment'],
      ['notifications'],
      ['loyalty'],
      ['favorites'],
    ])('never persists %s queries', root => {
      expect(shouldPersistQuery(makeQuery([root, 'me'], 'success'))).toBe(false);
    });

    // A key nobody has thought about yet must default to NOT persisted, so the
    // failure mode of adding a feature is a missing optimisation, not a leak.
    it('defaults an unknown key to not persisted', () => {
      expect(shouldPersistQuery(makeQuery(['some-future-feature'], 'success'))).toBe(false);
    });

    it('does not persist a non-string first segment', () => {
      expect(shouldPersistQuery(makeQuery([{ scope: 'offers' }], 'success'))).toBe(false);
    });

    it('does not persist an empty key', () => {
      expect(shouldPersistQuery(makeQuery([], 'success'))).toBe(false);
    });
  });

  describe('query state', () => {
    // Restoring a failed query would show a stale error for something that may
    // work fine now.
    it('does not persist an errored query even on an allowed key', () => {
      expect(shouldPersistQuery(makeQuery(['offers'], 'error'))).toBe(false);
    });

    it('does not persist an in-flight query', () => {
      expect(shouldPersistQuery(makeQuery(['offers'], 'pending'))).toBe(false);
    });
  });
});
