# Auth state ownership — Phase 0 audit

**Status:** audit complete, no code changed.
**Scope:** `apps/mobile`. Roles in scope: **consumer AND driver** (`MOBILE_ALLOWED_ROLES`).

---

## 1. Redux auth state fields

| Field | Kind | Notes |
|---|---|---|
| `user` | **server** | The migration candidate. See §5 — it is not a simple mirror. |
| `isAuthenticated` | client | Derived session flag |
| `isLoading` | client | Thunk progress |
| `error` | client | Last auth error |
| `lastLoginTime` | client | |
| `sessionExpiresAt` | client | Local expiry clock, drives proactive refresh |
| `flowState` | **client — critical** | RootNavigator switches on it |
| `pendingVerificationEmail/Phone` | client | Transient flow data |
| `mfaToken`, `passwordResetToken` | client | Transient secrets |
| `isRecoveringSession` | client | **write-only, see §6** |
| `isUserSynced` | client | Gates the email-verification check |

Only `user` is server state. Everything else is genuine client state and stays in Redux.

## 2. Consumers

**`auth.user`** — 11 sites:

| Site | Use | Risk |
|---|---|---|
| `navigation/RootNavigator.tsx:321` | `user?.role === DRIVER` → DriverStack vs MainStack | 🔴 **critical** |
| `navigation/ProtectedRoute.tsx:59,183` | `requiredRoles.includes(user.role)`, email-verified gate | 🔴 critical |
| `store/index.ts:124-146` | persist transform + location/user consistency check | 🟠 non-React |
| `features/orders/screens/CheckoutScreen.tsx:71` | order payload | 🟠 |
| `features/orders/components/PhoneVerificationModal.tsx:60` | phone verification | 🟠 |
| `features/profile/screens/SecurityScreen.tsx:89` | profile display | 🟢 |
| `features/loyalty/components/PremiumPointsCard.tsx:41` | display | 🟢 |
| `features/voting/components/VotingCard.tsx:220` | first name | 🟢 |
| `hooks/useUserProfile.ts:41` | shared profile hook | 🟢 |
| `App.tsx:184` | `userId` for analytics/socket identity | 🟠 |

**`isAuthenticated`** — `useAuth`, `useDonations`, `useFavoritesInfinite`, `useLocationSetup`, ProtectedRoute. All `enabled:` gates. Stays in Redux.

**`flowState`** — `App.tsx` (×8), `RootNavigator`. Stays in Redux.

**`isUserSynced`** — `ProtectedRoute:183` only.

## 3. Token storage, refresh, restore, logout

- **Tokens:** Keychain only (`SecureStorage`), never Redux. Correct per `.claude/rules/security.md`.
- **Refresh:** single-flight via `services/authRefresh.ts` → `refreshTokenSafe`. Callers: session middleware, `ProtectedRoute`, apiClient 401 interceptor.
- **Restore:** `loadStoredAuthAsync` reads **tokens + userJson + session metadata** from Keychain in parallel. **If any of the three is missing it returns null and there is no session.**
- **Logout:** `logoutAsync` (single-flight via `logoutLock`) and `forceLocalLogout` (no API call, breaks the 401 loop).

## 4. Cross-module dependencies (PM's explicit checklist)

Checked `NotificationService`, `socketService`, `analytics`, `OfflineWriteQueue`, `useCreateOrder`, `storeAccessor`:

**None of them read `auth.user` from Redux.** They take `userId` as a parameter or read tokens straight from Keychain. `storeAccessor` exposes only `getAppDispatch`, not `getState`.

→ **No cross-module migration blockers.** The dependency the PM was worried about does not exist.

## 5. 🔴 The finding that changes the recommendation

**`user` lives in four places, not three:**

1. Redux `auth.user`
2. redux-persist → MMKV
3. **Keychain** (`SecureStorage.setUserData` / `getUserData`) — written on every login, register, verify, profile update
4. Server (`GET /auth/me` via `syncCurrentUserAsync`)

The Keychain copy is **load-bearing**, and this is not accidental duplication:

- `loadStoredAuthAsync` **requires** it to restore a session. No userJson → no session, even with valid tokens.
- It is the only identity source available on an **offline cold start**.
- `isUserSynced` exists precisely to reconcile the possibly-stale Keychain copy against fresh `/auth/me`. The two-tier design — *Keychain for fast/offline identity, `/auth/me` for freshness* — is already deliberate.

**Why the favorites analogy does not transfer:**

`RootNavigator` picks DriverStack vs MainStack from `user.role` at the moment `flowState` becomes `AUTHENTICATED`. Redux rehydrates **synchronously**; a React Query read has a window where `data` is `undefined`. During that window a **driver would be routed into the consumer MainStack**. Same hazard in `ProtectedRoute`'s role check.

Making the query cover that window would mean persisting user data to the query cache — but `persister.ts` deliberately excludes `auth`/`profile` from disk as a security boundary. Keychain (hardware-backed, encrypted) is the *correct* place for it; the query cache is not.

## 6. Incidental finding

`selectIsRecoveringSession` is exported and has **zero consumers**. `isRecoveringSession` is written by two reducers and read by nothing — the middleware only references it in comments. Same write-only pattern as the offline fields removed in `fa289df`. Not part of this migration; flagged for separate cleanup.

## 7. Recommendation

Proceed with **Phase 1 as instructed** — a parallel read path is safe and useful, and the validation matrix will confirm the two sources agree.

For Phase 3, the audit does **not** support removing `auth.user` wholesale. Recommended end state:

- **Keep** Redux + Keychain as the *synchronous identity* for `RootNavigator`, `ProtectedRoute`, and anything role-gated. Losing synchronous role resolution is a driver-misrouting bug, not a refactor.
- **Migrate** the 🟢 display-only consumers (SecurityScreen, PremiumPointsCard, VotingCard, useUserProfile) to `useCurrentUser`, so profile edits made on another device appear without a relaunch.
- **Delete** `syncCurrentUserAsync` once `useCurrentUser` owns freshness — that is the actual hand-rolled cache sync, and the part worth removing.

That removes the duplication that causes staleness bugs while keeping the property the app depends on. Final call is the team's; this section is a recommendation, not a decision.

## 8. Phase 1 plan

Add `useCurrentUser` (`['auth','me']`, `enabled` on auth readiness, **not persisted**) returning the same `User` shape. Redux untouched. Add a dev-only equality assertion so any divergence surfaces during validation.

Validation matrix — cold start · killed and reopened · token refresh · expired access token · logout/login · offline startup · session recovery · **driver login routes to DriverStack** · **consumer login routes to MainStack**.
