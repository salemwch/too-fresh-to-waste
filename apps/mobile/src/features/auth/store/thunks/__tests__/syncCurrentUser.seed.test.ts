/**
 * syncCurrentUserAsync — cache seeding.
 *
 * The cold-start dedup has two halves. useCurrentUser.test.tsx covers the read
 * side (a seeded cache suppresses the fetch); this covers the write side: the
 * middleware's sync must actually put its result into ['auth','me'].
 *
 * Without the seed the two paths do not collide — they simply both fetch, one
 * after the other, and the "one /auth/me per launch" property is quietly lost
 * with every test still green. Hence this test.
 */

const mockSetQueryData = jest.fn();
jest.mock('@/lib/react-query/queryClient', () => ({
  queryClient: { setQueryData: (...a: unknown[]) => mockSetQueryData(...a) },
}));

const mockGetAccessToken = jest.fn();
jest.mock('@/services/SecureStorage', () => ({
  SecureStorage: {
    getAccessToken: () => mockGetAccessToken(),
    setUserData: jest.fn(),
  },
}));

const mockGetCurrentUser = jest.fn();
jest.mock('../../../services/authService', () => ({
  authService: { getCurrentUser: (...a: unknown[]) => mockGetCurrentUser(...a) },
}));

jest.mock('@/utils/backgroundStorage', () => ({
  backgroundStorage: { execute: jest.fn() },
}));

jest.mock('@/utils/logger', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { authKeys } from '../../../queryKeys';
import { syncCurrentUserAsync } from '../account.thunks';

const USER = { userId: 'u1', email: 'a@b.com', role: 'consumer', isEmailVerified: true };

/** Drives the thunk's payload creator directly — no store needed. */
const runThunk = async () =>
  syncCurrentUserAsync()(jest.fn(), () => ({}), undefined) as unknown as Promise<{
    meta: { requestStatus: string };
  }>;

describe('syncCurrentUserAsync — seeds the React Query cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAccessToken.mockResolvedValue('token-abc');
    mockGetCurrentUser.mockResolvedValue(USER);
  });

  it('writes the fetched user into the auth/me key', async () => {
    const result = await runThunk();

    expect(result.meta.requestStatus).toBe('fulfilled');
    expect(mockSetQueryData).toHaveBeenCalledWith(authKeys.me(), USER);
  });

  it('fetches /auth/me exactly once', async () => {
    await runThunk();

    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
  });

  it('does not seed when there is no access token', async () => {
    mockGetAccessToken.mockResolvedValue(null);

    const result = await runThunk();

    expect(result.meta.requestStatus).toBe('rejected');
    expect(mockSetQueryData).not.toHaveBeenCalled();
  });

  // A failed sync must leave the cache untouched, or useCurrentUser would open
  // its gate onto stale-or-absent data and skip the retry it should make.
  it('does not seed when the request fails', async () => {
    mockGetCurrentUser.mockRejectedValue(new Error('Network request failed'));

    const result = await runThunk();

    expect(result.meta.requestStatus).toBe('rejected');
    expect(mockSetQueryData).not.toHaveBeenCalled();
  });
});
