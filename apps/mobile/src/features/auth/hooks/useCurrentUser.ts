/**
 * Current user — parallel read path (Phase 1 of the auth ownership migration).
 *
 * ⚠️ ADDITIVE ONLY. Redux `auth.user` is unchanged and remains the source every
 * existing consumer reads. Nothing is migrated onto this hook yet; Phase 2 moves
 * consumers over one at a time. See docs/plans/auth-state-ownership-audit.md.
 *
 * Why this is not simply "move user to React Query"
 * -------------------------------------------------
 * `RootNavigator` chooses DriverStack vs MainStack from `user.role` the moment
 * `flowState` becomes AUTHENTICATED, and `ProtectedRoute` gates on the same
 * field. Redux rehydrates synchronously from Keychain; a query has a window
 * where `data` is undefined. Routing off this hook during that window would put
 * a **driver into the consumer UI**.
 *
 * So this hook deliberately falls back to the Redux/Keychain value rather than
 * returning undefined while loading. It is a freshness layer over an identity
 * that is already available, not a replacement for it.
 *
 * NOT persisted: `persister.ts` excludes auth/profile from disk on purpose.
 * The durable copy lives in the Keychain, which is hardware-backed — the right
 * place for it, and already what session restoration reads.
 */

import { useQuery } from '@tanstack/react-query';

import { useAppSelector } from '@/hooks/redux';
import { Freshness } from '@/lib/react-query/freshness';
import { apiClient, unwrapBackendResponse } from '@/services/apiClient';
import { isAuthReadyForApiCalls } from '@/utils/tokenValidator';

import { authKeys } from '../queryKeys';

import type { User } from '../types';

export interface CurrentUserResult {
  /** The user. Never undefined while a session exists — falls back to Redux. */
  user: User | null;
  /** True while the first /auth/me fetch is in flight. `user` is still usable. */
  isRefreshing: boolean;
  /** True when the value came from the server rather than the restored copy. */
  isFresh: boolean;
}

/**
 * Fresh user data from `GET /auth/me`, falling back to the restored session.
 *
 * Gated on auth readiness for the same reason every other authenticated query
 * is: firing mid-refresh returns 401 and would surface a spurious error.
 */
export function useCurrentUser(): CurrentUserResult {
  const authState = useAppSelector(state => state.auth);
  const { isReady } = isAuthReadyForApiCalls(authState);
  const { isUserSynced } = authState;

  const query = useQuery({
    queryKey: authKeys.me(),
    // apiClient rather than authService: authService reads the token by hand and
    // pulls in errorHandler and toast, which would land react-native-toast-message,
    // vector-icons and i18n in the module graph of every component that shows a
    // name or an avatar. apiClient is the pattern every other query hook uses and
    // injects the token via its interceptor.
    queryFn: async (): Promise<User> =>
      unwrapBackendResponse<User>(await apiClient.get('/auth/me'), 'current user'),
    // Gated on isUserSynced as well as readiness, so this does not race the
    // middleware's cold-start /auth/me. That sync is the one request per launch:
    // it writes the Keychain copy and flips isUserSynced, and seeds this cache
    // on the way (see syncCurrentUserAsync). By the time the gate opens the data
    // is already here and fresh, so no second request is made.
    //
    // The flag is stripped on persist, so it is reliably false on cold start.
    // A 401/403 sync leaves it false, which keeps this query disabled while the
    // interceptor logs out rather than adding to a 401 flood.
    enabled: isReady && isUserSynced,
    // The profile changes rarely and only through this device's own edits,
    // which invalidate explicitly. Refetching more often costs a request per
    // screen focus and tells us nothing new.
    staleTime: Freshness.STATIC,
  });

  return {
    // Redux is the fallback, not the other way round: it is synchronously
    // available from the Keychain restore, so routing and role gates never see
    // a null user that Redux could have answered.
    user: query.data ?? authState.user,
    isRefreshing: query.isFetching,
    isFresh: query.data !== undefined,
  };
}
