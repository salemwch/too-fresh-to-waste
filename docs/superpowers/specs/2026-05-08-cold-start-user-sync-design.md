# Cold-Start User Sync — Design Spec

**Date**: 2026-05-08 **Problem**: After backend redeploy, users with valid
refresh tokens get stale user data from Keychain. This causes "Email
Verification Required" blocks and missing profile photos until they manually log
out and back in. **Fix**: Fetch fresh user data from `GET /auth/me` on every
cold start after token validation, before the app trusts the cached user object.

---

## Root Cause

`loadStoredAuthAsync` reads the user object from Keychain (written at last
login) and sets `flowState = AUTHENTICATED` immediately. The session middleware
then refreshes tokens if expired, but `refreshTokenAsync` returns **only
tokens** — no user data. The Redux `state.user` remains stale indefinitely.

Any server-side change to the user (email verified, profile photo updated, role
changed by admin, account suspended) is invisible until the next full login.

---

## Solution: `isUserSynced` Flag + `syncCurrentUserAsync` Thunk

### New State Field

Add `isUserSynced: boolean` to `AuthState` interface
(`features/auth/types/index.ts:68`).

**Lifecycle:**

| Event                                           | `isUserSynced` value                   |
| ----------------------------------------------- | -------------------------------------- |
| `initialState`                                  | `false`                                |
| `loadStoredAuthAsync.pending`                   | `false` (reset on every cold start)    |
| `loginAsync.fulfilled`                          | `true` (login returns fresh user)      |
| `registerAsync.fulfilled`                       | `true` (register returns fresh user)   |
| `verifyEmailAsync.fulfilled`                    | `true` (verify returns fresh user)     |
| `syncCurrentUserAsync.fulfilled`                | `true`                                 |
| `syncCurrentUserAsync.rejected` (network error) | `true` (offline-first: trust cache)    |
| `syncCurrentUserAsync.rejected` (auth error)    | unchanged (interceptor handles logout) |
| `logoutAsync.fulfilled`                         | `false` (via `initialState` spread)    |
| `logoutAsync.rejected`                          | `false` (via `initialState` spread)    |
| `forceLocalLogout`                              | `false` (via `initialState` spread)    |

### New Thunk: `syncCurrentUserAsync`

**File**: `features/auth/store/authSlice.ts`

```typescript
export const syncCurrentUserAsync = createAsyncThunk(
  'auth/syncCurrentUser',
  async (_, { rejectWithValue }) => {
    const accessToken = await SecureStorage.getAccessToken();
    if (accessToken == null || accessToken === '') {
      throw new Error('No access token available');
    }

    const user = await authService.getCurrentUser(accessToken);

    // Persist fresh user to Keychain (fire-and-forget is safe here —
    // worst case we re-sync on next cold start)
    backgroundStorage.execute('sync-user-data', async () => {
      await SecureStorage.setUserData(JSON.stringify(user));
    });

    return user;
  },
);
```

**Reducer cases:**

- `syncCurrentUserAsync.fulfilled`: set `state.user = action.payload`, set
  `state.isUserSynced = true`
- `syncCurrentUserAsync.rejected`: if network error, set
  `state.isUserSynced = true` (trust cache). If auth error, do nothing
  (interceptor/middleware handles logout).

**Network error detection**: Same pattern used in `refreshTokenAsync.rejected` —
check for `'network'`, `'timeout'`, `'econnrefused'` in the error message.

### ProtectedRoute Change

**File**: `navigation/ProtectedRoute.tsx:178`

**Before:**

```typescript
if (user?.isEmailVerified !== true) {
```

**After:**

```typescript
if (user?.isEmailVerified !== true && isUserSynced) {
```

When `isUserSynced` is `false`, ProtectedRoute passes through to children.
Children screens show their own loading skeletons naturally via TanStack Query's
`isLoading` state, since their API calls are also in-flight during the sync
window.

Once `isUserSynced` flips to `true`, the email verification check activates with
fresh data. If the user genuinely hasn't verified their email, the block renders
correctly.

### Session Middleware Trigger

**File**: `store/middleware/authSessionMiddleware.ts`

Add a module-scoped `hasPerformedInitialSync: boolean` flag (not in
`SessionManagerState` interface or Redux — it's internal to the middleware, no
component needs it).

**Trigger point**: After `checkAndRefreshToken()` succeeds on cold start (line
377, Layer 1 in `startSessionManager`), dispatch `syncCurrentUserAsync()` and
set `hasPerformedInitialSync = true`.

**Implementation**: Modify `startSessionManager` to await the initial
`checkAndRefreshToken()` call, then conditionally dispatch sync:

```typescript
// In startSessionManager, replace the fire-and-forget Layer 1 call:

// LAYER 1: Check immediately on start + sync user data
void (async () => {
  await checkAndRefreshToken(dispatch, getState);

  // Sync user data from server on first cold-start check
  if (
    !hasPerformedInitialSync &&
    getState().auth.flowState === AuthFlowState.AUTHENTICATED
  ) {
    hasPerformedInitialSync = true;
    dispatch(syncCurrentUserAsync());
  }
})();
```

**Reset on logout**: `hasPerformedInitialSync` must reset to `false` when
`stopSessionManager()` is called. This already happens naturally because
`stopSessionManager` runs when `flowState` leaves `AUTHENTICATED` (logout,
session expiry, force logout). Add the reset in `stopSessionManager`:

```typescript
// In stopSessionManager, after existing reset lines (line 423-427):
hasPerformedInitialSync = false;
```

This ensures that if a different user (or the same user) logs back in during the
same JS engine session, the sync runs again.

**Subsequent checks (Layer 2 periodic, Layer 3 app-resume)**: Do NOT re-sync.
User data doesn't change frequently enough to justify the overhead. Only
cold-start syncs.

---

## Data Flow: Cold Start After Backend Redeploy

```
t=0  App opens
t=1  RehydrationGate: load MMKV → Redux Persist
t=2  loadStoredAuthAsync: tokens + CACHED user from Keychain
     → isUserSynced=false, flowState=AUTHENTICATED
t=3  RootNavigator renders MainStack
t=4  ProtectedRoute: isAuthenticated=true, isUserSynced=false
     → PASSES THROUGH (skips email check)
     → Children render their own skeletons (TanStack queries loading)
t=5  Session middleware starts → Layer 1: checkAndRefreshToken()
     → Token expired? refreshTokenAsync → new tokens
     → Token valid? continues
t=6  dispatch(syncCurrentUserAsync())
     → GET /auth/me with valid access token
t=7  Response arrives (~100-200ms)
     → Redux: state.user = fresh data, isUserSynced=true
     → Keychain: fresh user JSON persisted (background)
     → ProtectedRoute re-evaluates with FRESH isEmailVerified
     → Children already loaded from API (skeletons gone)
```

## Data Flow: Logout → Re-login (Same JS Session)

```
t=0  logoutAsync.fulfilled
     → initialState spread: isUserSynced=false
     → stopSessionManager(): hasPerformedInitialSync=false
     → flowState=UNAUTHENTICATED → AuthStack renders
t=1  User logs in
     → loginAsync.fulfilled: fresh user + isUserSynced=true
     → No redundant /auth/me call needed
```

## Data Flow: Offline Cold Start

```
t=0-4  Same as normal cold start
t=5    checkAndRefreshToken() detects offline → skips refresh, returns early
t=6    hasPerformedInitialSync is false, flowState is AUTHENTICATED
       → dispatch(syncCurrentUserAsync())
       → GET /auth/me fails with network error
       → rejected handler detects network error → isUserSynced=true
       → App works with cached user data (offline-first)
t=7    When connectivity returns, next cold start will sync fresh data
```

---

## Files Changed

| File                                        | Change                                                                                                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `features/auth/types/index.ts`              | Add `isUserSynced: boolean` to `AuthState`                                                                                                                                                                   |
| `features/auth/store/authSlice.ts`          | Add `syncCurrentUserAsync` thunk + reducer cases. Add `isUserSynced` to `initialState`. Set `isUserSynced=true` in `loginAsync.fulfilled`, `registerAsync.fulfilled`, `verifyEmailAsync.fulfilled` reducers. |
| `navigation/ProtectedRoute.tsx`             | Add `&& isUserSynced` to email verification check (line 178)                                                                                                                                                 |
| `store/middleware/authSessionMiddleware.ts` | Add `hasPerformedInitialSync` flag. Dispatch `syncCurrentUserAsync` after Layer 1 check. Reset flag in `stopSessionManager`.                                                                                 |

---

## What This Does NOT Change

- **Backend**: No API changes. `GET /auth/me` already exists and returns full
  user.
- **Token flow**: Refresh logic untouched. Token rotation, single-flight lock,
  backoff — all unchanged.
- **Navigation state machine**: No new `AuthFlowState` values. `AUTHENTICATED`
  still means the same thing.
- **Offline behavior**: App still works offline. Stale user data is trusted when
  network is unavailable.
- **Performance**: One extra `GET /auth/me` call per cold start (~100-200ms). No
  impact on periodic refreshes or app-resume.

---

## Edge Cases

| Scenario                                        | Behavior                                                                                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `/auth/me` returns 401                          | Axios interceptor triggers refresh + retry. If refresh also fails, `forceLocalLogout` fires.                                            |
| `/auth/me` times out (10s)                      | `syncCurrentUserAsync.rejected` with network error → `isUserSynced=true`, trust cache                                                   |
| User verifies email on web, opens mobile        | Cold start syncs fresh `isEmailVerified=true` → no block                                                                                |
| Admin changes user role                         | Cold start syncs fresh role → `hasRequiredRole()` in ProtectedRoute evaluates correctly                                                 |
| User updates profile on second device           | Cold start syncs fresh `profileImage` → photo appears                                                                                   |
| App killed during Keychain write of synced user | Next cold start re-syncs (Keychain still has old data, but tokens are valid)                                                            |
| Two rapid cold starts                           | First start sets `hasPerformedInitialSync=true`. Second start (if JS engine restarted) resets it. If same JS engine, sync already done. |
