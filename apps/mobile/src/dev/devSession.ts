/**
 * Development-only session seeding.
 *
 * WHY
 * ---
 * Every authenticated screen in this app - Home, Orders, Checkout, Profile, the
 * driver flow - had never been rendered on a device. They were unreachable:
 * `.env.development` points at the production API, so reaching them meant
 * either creating an account on production or standing up the real backend.
 *
 * This seeds a fake session against a **local mock API** instead.
 *
 * WHAT IT DOES NOT DO
 * -------------------
 * It does not touch authentication. There is no bypass, no new Redux action, no
 * relaxed guard, and no branch inside any auth code path. All it does is write
 * the same three `SecureStorage` entries a real login writes - tokens, user
 * JSON, session metadata - and then let the app's own `loadStoredAuthAsync`
 * find them on the next boot and authenticate exactly as it always does.
 *
 * That is the whole trick, and it is why this is safe: from the app's point of
 * view nothing unusual happened. Someone logged in, and here is the session.
 *
 * THREE INDEPENDENT GATES
 * -----------------------
 * All three must hold. Any one of them failing is a hard refusal.
 *
 *   1. `__DEV__` - false in every release build, so this cannot run in one.
 *   2. `ENABLE_DEV_AUTH === 'true'` - explicit opt-in. It is absent from
 *      `.env.staging` and `.env.production`, and `devSession.test.ts` asserts
 *      that it stays absent.
 *   3. **The API base URL must be local.** This is the important one. Even if
 *      someone shipped a build with the flag on, a seeded session is useless
 *      and inert unless the app is pointed at a mock on localhost - and it
 *      refuses to write anything if it is not. A fake token is never written
 *      while the app can reach a real backend.
 *
 * Gate 3 exists because gates 1 and 2 are both "did someone configure this
 * wrong", and gate 3 is "does it matter even if they did".
 */

import { Platform } from 'react-native';
import Config from 'react-native-config';

import { environment } from '@/config/environment';
import { SecureStorage } from '@/services/SecureStorage';
import { Logger } from '@/utils/logger';

/** Hosts that count as "a mock on this machine". */
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '10.0.2.2'] as const;

const isLocalApi = (baseUrl: string): boolean => {
  try {
    const { hostname } = new URL(baseUrl);
    return LOCAL_HOSTS.some(h => h === hostname);
  } catch {
    return false;
  }
};

/**
 * The fixture user. Deliberately `.invalid` - a reserved TLD that can never
 * resolve - so this address cannot collide with, or be mistaken for, a real
 * account. It mirrors `tools/dev-mock-api/server.mjs`, which serves the same
 * user from `GET /auth/me`.
 */
const DEV_USER = {
  userId: 'dev-user-000000000001',
  email: 'dev.consumer@example.invalid',
  firstName: 'Dev',
  lastName: 'Consumer',
  phoneNumber: '+21600000000',
  role: 'consumer',
  status: 'active',
  isEmailVerified: true,
  isPhoneVerified: true,
  profileImage: null,
  leaderboardAnonymous: false,
  createdAt: '2026-05-31T00:00:00.000Z',
  updatedAt: '2026-08-29T00:00:00.000Z',
  authProvider: 'local',
} as const;

/* Obviously-fake, and obviously not a secret. The app never decodes tokens -
 * they are opaque Bearer strings - so these need no JWT structure. */
const DEV_ACCESS_TOKEN = 'dev-mock-access-token.not-a-real-credential';
const DEV_REFRESH_TOKEN = 'dev-mock-refresh-token.not-a-real-credential';

export interface DevSessionResult {
  seeded: boolean;
  reason: string;
}

/**
 * Why the seeder would refuse, or `null` if every gate is satisfied.
 * Exported so the test can assert each gate independently rather than only
 * observing the combined outcome.
 */
export const devSessionBlockedReason = (
  isDev: boolean,
  flag: string | undefined,
  apiBaseUrl: string,
): string | null => {
  if (!isDev) return 'not a development build';
  if (flag !== 'true') return 'ENABLE_DEV_AUTH is not "true"';
  if (!isLocalApi(apiBaseUrl)) return `API base URL is not local (${apiBaseUrl})`;
  return null;
};

/**
 * Writes a fixture session to secure storage when, and only when, all three
 * gates hold. Safe to call unconditionally on every boot: it is a no-op
 * otherwise, and it never throws into the caller.
 */
export async function seedDevSessionIfEnabled(): Promise<DevSessionResult> {
  const blocked = devSessionBlockedReason(
    __DEV__,
    Config['ENABLE_DEV_AUTH'],
    environment.api.baseUrl,
  );

  if (blocked !== null) {
    return { seeded: false, reason: blocked };
  }

  try {
    const existing = await SecureStorage.getUserData();
    if (existing != null && existing !== '') {
      return { seeded: false, reason: 'a session is already stored' };
    }

    await SecureStorage.setTokens(DEV_ACCESS_TOKEN, DEV_REFRESH_TOKEN);
    await SecureStorage.setUserData(JSON.stringify(DEV_USER));
    await SecureStorage.setSessionMetadata(
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      new Date().toISOString(),
    );

    Logger.warn(
      '[DEV-SESSION] Seeded a fixture session against a local mock API. ' +
        'This build cannot do this against a real backend.',
      { platform: Platform.OS, api: environment.api.baseUrl },
    );

    return { seeded: true, reason: 'seeded' };
  } catch (error) {
    // Never let a dev convenience break the boot path.
    Logger.warn('[DEV-SESSION] Failed to seed', {}, error instanceof Error ? error : undefined);
    return { seeded: false, reason: 'write failed' };
  }
}
