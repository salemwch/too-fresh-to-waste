# Cold-Start User Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fetch fresh user data from `GET /auth/me` on every cold start so stale
Keychain data never blocks the user with false "Email Verification Required"
errors or missing profile photos after backend redeploys.

**Architecture:** Add `isUserSynced` boolean to auth state +
`syncCurrentUserAsync` thunk that calls the existing
`authService.getCurrentUser()`. Session middleware dispatches it once after the
first successful token check on cold start. ProtectedRoute skips the
email-verification gate while `isUserSynced` is false — children screens show
their own TanStack Query skeletons naturally.

**Tech Stack:** Redux Toolkit (createAsyncThunk), React Native Keychain
(SecureStorage), existing authService/apiClient

**Spec:** `docs/superpowers/specs/2026-05-08-cold-start-user-sync-design.md`

---

## File Map

| File                                                        | Action                                 | Responsibility                                                                                                                                                             |
| ----------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/src/features/auth/types/index.ts`              | Modify (line 68-95)                    | Add `isUserSynced` to `AuthState` interface                                                                                                                                |
| `apps/mobile/src/features/auth/store/authSlice.ts`          | Modify                                 | Add `syncCurrentUserAsync` thunk, add `isUserSynced` to initialState, add reducer cases, add selector, set `isUserSynced=true` in login/register/verify fulfilled reducers |
| `apps/mobile/src/navigation/ProtectedRoute.tsx`             | Modify (line 52, 178)                  | Read `isUserSynced` from state, gate email check on it                                                                                                                     |
| `apps/mobile/src/store/middleware/authSessionMiddleware.ts` | Modify (lines 45-49, 376-377, 423-427) | Import `syncCurrentUserAsync`, add `hasPerformedInitialSync` flag, dispatch sync after Layer 1, reset flag in `stopSessionManager`                                         |

---

### Task 1: Add `isUserSynced` to AuthState interface

**Files:**

- Modify: `apps/mobile/src/features/auth/types/index.ts:68-95`

- [ ] **Step 1: Add the field to the AuthState interface**

In `apps/mobile/src/features/auth/types/index.ts`, add `isUserSynced` after the
`isRecoveringSession` field (line 94). Insert before the closing `}` of
AuthState:

```typescript
  // True once the app has fetched fresh user data from GET /auth/me on
  // cold start (or received fresh data via login/register/verifyEmail).
  // ProtectedRoute defers the email-verification gate until this is true
  // so stale Keychain data doesn't falsely block the user.
  readonly isUserSynced: boolean;
```

The full AuthState interface ending (lines 91-96) becomes:

```typescript
  // True while the session middleware is running post-resume token recovery.
  // Protected queries should wait on this flag before firing so they don't
  // race the refresh and trigger a 401 flood.
  readonly isRecoveringSession: boolean;

  // True once the app has fetched fresh user data from GET /auth/me on
  // cold start (or received fresh data via login/register/verifyEmail).
  // ProtectedRoute defers the email-verification gate until this is true
  // so stale Keychain data doesn't falsely block the user.
  readonly isUserSynced: boolean;
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `cd apps/mobile && pnpm type-check`

Expected: FAIL — `initialState` in authSlice.ts is missing `isUserSynced`. This
confirms the type change propagated correctly.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/auth/types/index.ts
git commit -m "feat(mobile): add isUserSynced to AuthState interface"
```

---

### Task 2: Add `isUserSynced` to initialState and create `syncCurrentUserAsync` thunk

**Files:**

- Modify: `apps/mobile/src/features/auth/store/authSlice.ts:21-40`
  (initialState)
- Modify: `apps/mobile/src/features/auth/store/authSlice.ts:527-528` (after
  loadStoredAuthAsync, before updateProfileAsync)

- [ ] **Step 1: Add `isUserSynced: false` to initialState**

In `apps/mobile/src/features/auth/store/authSlice.ts`, add after line 39
(`isRecoveringSession: false,`):

```typescript
  // Cold-start user sync (fresh data from /auth/me)
  isUserSynced: false,
```

The initialState block (lines 38-40) becomes:

```typescript
  // Post-resume token-recovery gate (see authSessionMiddleware)
  isRecoveringSession: false,
  // Cold-start user sync (fresh data from /auth/me)
  isUserSynced: false,
};
```

- [ ] **Step 2: Add `syncCurrentUserAsync` thunk after `loadStoredAuthAsync`**

Insert after line 527 (`);` closing `loadStoredAuthAsync`) and before line 529
(`export const updateProfileAsync`):

```typescript
export const syncCurrentUserAsync = createAsyncThunk(
  'auth/syncCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const accessToken = await SecureStorage.getAccessToken();

      if (accessToken == null || accessToken === '') {
        throw new Error('No access token available');
      }

      Logger.info('[AUTH] Syncing user data from server');
      const user = await authService.getCurrentUser(accessToken);

      backgroundStorage.execute('sync-user-data', async () => {
        await SecureStorage.setUserData(JSON.stringify(user));
      });

      Logger.info('[AUTH] User data synced successfully', {
        userId: user.userId,
      });
      return user;
    } catch (error) {
      Logger.warn('[AUTH] User sync failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      let errorMessage = 'User sync failed';
      let statusCode: number | undefined;

      if (error !== null && error !== undefined && typeof error === 'object') {
        const errObj = error as Record<string, unknown>;
        if (typeof errObj['message'] === 'string') {
          errorMessage = errObj['message'];
        }
        if (typeof errObj['statusCode'] === 'number') {
          statusCode = errObj['statusCode'];
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      const isNetworkError =
        errorMessage === 'Network request failed' ||
        errorMessage.toLowerCase().includes('network') ||
        errorMessage.toLowerCase().includes('timeout') ||
        errorMessage.toLowerCase().includes('econnrefused') ||
        errorMessage.toLowerCase().includes('econnaborted') ||
        (error !== null &&
          typeof error === 'object' &&
          'type' in error &&
          (error as { type: string }).type === 'NETWORK');

      const isServerError =
        statusCode !== undefined && statusCode >= 500 && statusCode < 600;

      const isAuthError = statusCode === 401 || statusCode === 403;

      return rejectWithValue({
        message: errorMessage,
        isNetworkError,
        isServerError,
        isAuthError,
      });
    }
  },
);
```

- [ ] **Step 3: Verify type-check passes**

Run: `cd apps/mobile && pnpm type-check`

Expected: FAIL — reducer cases for `syncCurrentUserAsync` don't exist yet.
That's Task 3. But `initialState` should now satisfy the `AuthState` interface.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/features/auth/store/authSlice.ts
git commit -m "feat(mobile): add syncCurrentUserAsync thunk and isUserSynced to initialState"
```

---

### Task 3: Add reducer cases for `syncCurrentUserAsync` and set `isUserSynced=true` in existing fulfilled reducers

**Files:**

- Modify: `apps/mobile/src/features/auth/store/authSlice.ts` (extraReducers
  section + existing fulfilled cases)

- [ ] **Step 1: Set `isUserSynced = true` in `loginAsync.fulfilled`**

In the `loginAsync.fulfilled` reducer (line 693), add after line 716
(`state.mfaToken = undefined;`):

```typescript
state.isUserSynced = true;
```

- [ ] **Step 2: Set `isUserSynced = true` in `verifyEmailAsync.fulfilled`**

In the `verifyEmailAsync.fulfilled` reducer (line 788), add after line 801
(`state.pendingVerificationEmail = undefined;`):

```typescript
state.isUserSynced = true;
```

- [ ] **Step 3: Set `isUserSynced = true` in `verifyMFAAsync.fulfilled`**

In the `verifyMFAAsync.fulfilled` reducer (line 820), add after line 832
(`state.mfaToken = undefined;`):

```typescript
state.isUserSynced = true;
```

- [ ] **Step 4: Set `isUserSynced = false` in `loadStoredAuthAsync.pending`**

In the `loadStoredAuthAsync.pending` reducer (line 942), add after line 943
(`state.isLoading = true;`):

```typescript
state.isUserSynced = false;
```

- [ ] **Step 5: Add `syncCurrentUserAsync` reducer cases**

Insert after the `loadStoredAuthAsync.rejected` reducer block (after line 991
`});`) and before line 993 (`// Update Profile`):

```typescript
// Sync Current User (cold-start /auth/me)
builder.addCase(syncCurrentUserAsync.fulfilled, (state, action) => {
  state.user = action.payload;
  state.isUserSynced = true;
  Logger.info('[AUTH] User data synced from server', {
    userId: action.payload.userId,
  });
});

builder.addCase(syncCurrentUserAsync.rejected, (state, action) => {
  const payload = action.payload as
    | {
        isNetworkError?: boolean;
        isServerError?: boolean;
        isAuthError?: boolean;
      }
    | undefined;

  if (payload?.isAuthError === true) {
    // 401/403: interceptor will handle logout — don't touch isUserSynced
    return;
  }

  // Network errors, 5xx server errors, or any other failure:
  // trust cached data, don't leave the flag stuck at false
  state.isUserSynced = true;
});
```

- [ ] **Step 6: Add selector for `isUserSynced`**

At the bottom of the file, after line 1046 (`selectIsRecoveringSession`), add:

```typescript
export const selectIsUserSynced = (state: RootState): boolean =>
  state.auth.isUserSynced;
```

- [ ] **Step 7: Verify type-check passes**

Run: `cd apps/mobile && pnpm type-check`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/features/auth/store/authSlice.ts
git commit -m "feat(mobile): add syncCurrentUserAsync reducer cases and isUserSynced lifecycle"
```

---

### Task 4: Update ProtectedRoute to defer email check during sync

**Files:**

- Modify: `apps/mobile/src/navigation/ProtectedRoute.tsx:52-54,178`

- [ ] **Step 1: Read `isUserSynced` from Redux state**

In `apps/mobile/src/navigation/ProtectedRoute.tsx`, modify line 52-54 to include
`isUserSynced`:

Replace:

```typescript
const { isAuthenticated, isLoading, user, sessionExpiresAt } = useAppSelector(
  state => state.auth,
);
```

With:

```typescript
const { isAuthenticated, isLoading, user, sessionExpiresAt, isUserSynced } =
  useAppSelector(state => state.auth);
```

- [ ] **Step 2: Gate the email verification check on `isUserSynced`**

Modify line 178:

Replace:

```typescript
  if (user?.isEmailVerified !== true) {
```

With:

```typescript
  if (user?.isEmailVerified !== true && isUserSynced) {
```

- [ ] **Step 3: Verify type-check passes**

Run: `cd apps/mobile && pnpm type-check`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/navigation/ProtectedRoute.tsx
git commit -m "feat(mobile): defer email verification gate until user data synced from server"
```

---

### Task 5: Dispatch `syncCurrentUserAsync` from session middleware

**Files:**

- Modify: `apps/mobile/src/store/middleware/authSessionMiddleware.ts`

- [ ] **Step 1: Add import for `syncCurrentUserAsync`**

Modify the import block at line 45-49. Replace:

```typescript
import {
  forceLocalLogout,
  sessionRecoveryStarted,
  sessionRecoveryFinished,
} from '@/features/auth/store/authSlice';
```

With:

```typescript
import {
  forceLocalLogout,
  sessionRecoveryStarted,
  sessionRecoveryFinished,
  syncCurrentUserAsync,
} from '@/features/auth/store/authSlice';
```

- [ ] **Step 2: Add `hasPerformedInitialSync` module-scoped flag**

Insert after line 151 (`hasRehydrated: false,` + `};`) — right after the
`sessionManagerState` object, before the rate-limited logger:

```typescript
/**
 * Module-scoped flag: has the initial user sync fired for this session?
 * NOT in SessionManagerState — no component needs this. Reset in stopSessionManager
 * so re-login in the same JS engine session triggers a fresh sync.
 */
let hasPerformedInitialSync = false;
```

- [ ] **Step 3: Modify `startSessionManager` to dispatch sync after Layer 1**

Replace the Layer 1 call at line 376-377:

Replace:

```typescript
// LAYER 1: Check immediately on start
void checkAndRefreshToken(dispatch, getState);
```

With:

```typescript
// LAYER 1: Check immediately on start + sync user data on first cold start
void (async () => {
  await checkAndRefreshToken(dispatch, getState);

  if (
    !hasPerformedInitialSync &&
    getState().auth.flowState === AuthFlowState.AUTHENTICATED
  ) {
    hasPerformedInitialSync = true;
    Logger.info(
      '[AUTH-MIDDLEWARE] Dispatching initial user sync from /auth/me',
    );
    dispatch(syncCurrentUserAsync());
  }
})();
```

- [ ] **Step 4: Reset `hasPerformedInitialSync` in `stopSessionManager`**

In `stopSessionManager`, add after line 427
(`sessionManagerState.refreshRetryCount = 0;`):

```typescript
hasPerformedInitialSync = false;
```

The reset block (lines 423-428) becomes:

```typescript
// Reset state
sessionManagerState.isRefreshing = false;
sessionManagerState.lastAppState = AppState.currentState;
sessionManagerState.isManagerRunning = false;
sessionManagerState.refreshRetryCount = 0;
hasPerformedInitialSync = false;
```

- [ ] **Step 5: Verify type-check passes**

Run: `cd apps/mobile && pnpm type-check`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/store/middleware/authSessionMiddleware.ts
git commit -m "feat(mobile): dispatch syncCurrentUserAsync on cold start after token check"
```

---

### Task 6: Full integration verification

**Files:**

- All four modified files

- [ ] **Step 1: Run full type-check**

Run: `cd apps/mobile && pnpm type-check`

Expected: PASS — all four files compile cleanly together.

- [ ] **Step 2: Run lint**

Run: `cd apps/mobile && pnpm lint`

Expected: PASS (or only pre-existing warnings unrelated to our changes).

- [ ] **Step 3: Run existing tests**

Run: `cd apps/mobile && pnpm test`

Expected: All existing tests pass (design-system component tests).

- [ ] **Step 4: Manual smoke test**

1. Start backend: `cd apps/food-waste-backend && pnpm dev`
2. Start Metro: `cd apps/mobile && pnpm dev`
3. Login as consumer → verify home screen loads
4. Kill the backend process → restart it (`pnpm dev`)
5. Force-kill the mobile app → reopen it
6. **Expected**: app shows home screen with skeletons briefly, then loads data.
   No "Email Verification Required" screen. Profile photo appears correctly.
7. Navigate to My Profile → verify photo and email status are correct
8. Navigate to Points/other protected screens → verify no verification error

- [ ] **Step 5: Test offline fallback**

1. While logged in, enable airplane mode
2. Force-kill the app → reopen it
3. **Expected**: app loads with cached data, no email verification error,
   screens show offline indicators. `isUserSynced` becomes `true` (from the
   network-error rejection path).

- [ ] **Step 6: Test logout → re-login flow**

1. Log out from the app
2. Log back in as same or different user
3. **Expected**: `isUserSynced` is immediately `true` (loginAsync.fulfilled sets
   it). No redundant `/auth/me` call. Profile data is fresh from login response.

- [ ] **Step 7: Commit final state**

If any lint/type-check issues were fixed during verification:

```bash
git add -A
git commit -m "fix(mobile): resolve lint/type issues from cold-start user sync"
```
