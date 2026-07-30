---
paths:
  - 'apps/mobile/**/*.ts'
  - 'apps/mobile/**/*.tsx'
---

# Mobile Coding Rules

Rules specific to `apps/mobile`. Architecture is documented in project CLAUDE.md
— these are coding-level decisions only.

1. **Tokens in Keychain ONLY** — never Redux, MMKV, or AsyncStorage. MMKV is for
   UI cache only.
2. **No AbortController** on fire-and-forget POST hooks — cleanup aborts the
   in-flight request.
3. **Navigate to OrderDetails** via `CommonActions.reset` with nested
   OrdersStack state — it is NOT in MainStack.
4. **Skeleton loading**: `Animated` + `LinearGradient` shimmer pattern (see
   `SkeletonOfferCard` for reference).
5. **`establishmentId`** in Order can be string OR populated object — always use
   helper functions, never access `.name` directly.
6. **Profile image**: resolve `profileImage > avatar > null`. After upload
   persist to Keychain, not Redux-only.
7. **`exactOptionalPropertyTypes`**: use conditional spread
   `...(val ? { key: val } : {})` instead of `val | undefined`.
8. **pnpm hoisted mode**: `node_modules/` lives at monorepo root. Gradle
   `ext.nodeModulesDir` points there.
9. **New Arch**: every autolinked native module needs `codegenConfig` in its
   `package.json` — modules without it cause CMake errors.
10. **Navigation guard flags** (`isNavigating`, `isLoading`, etc.): React
    Navigation keeps stack screens mounted — a flag set to `true` on navigate
    stays `true` when the user goes back. Always reset guard flags in a
    `navigation.addListener('focus', ...)` listener. Never use a one-shot
    boolean without a focus reset.
11. **Android elevation + circular images**: `elevation` on a view with
    `borderRadius` and `overflow: 'hidden'` renders a rectangular shadow
    outline. Never combine them — use a parent wrapper for shadow or skip
    elevation on circular views.
12. **Never call `Geolocation.getCurrentPosition` directly** — always
    `getCurrentPositionOnce()` from
    `@/services/location/getCurrentPositionOnce`. `PlayServicesLocationManager`
    keeps the single-shot `LocationCallback` in one shared instance field and
    unregisters via that field rather than via `this`, so **any** two
    overlapping single-shot requests — from anywhere in the app — make the
    second delivery call `removeLocationUpdates(null)`. Play Services throws
    `NullPointerException: Listener must not be null` on the main thread and the
    process dies instantly; no JS catch can intercept it. The user sees the app
    vanish and the previous app (the Play Store, on a fresh install) come
    forward, which reads as "it closed itself", not as a crash. Shipped in
    release 70 from two parallel "fast tier / accurate tier" calls inside
    `requestLocationAsync`. `watchPosition` uses a different field and is not
    affected.
13. **The Play Services path ignores `timeout`.** It is parsed into
    `LocationOptions` and never read, and there is no way to cancel a pending
    single-shot request. So a "try fast, then fall back to accurate" design is
    unsafe **in sequence as well as in parallel**: the first request stays
    registered forever and the second recreates the double-registration. Any
    timeout has to be enforced in JS — `getCurrentPositionOnce` already does.
14. **BlueStacks pre-grants runtime location permission at install**, so
    `GrantPermissionsActivity` never launches and any bug behind the permission
    prompt is unreachable. `adb shell pm clear <pkg>` then
    `adb shell pm revoke <pkg> android.permission.ACCESS_FINE_LOCATION` before
    testing first-run location flows. Two earlier investigations concluded "does
    not reproduce" against this rig and wrote fixes against a theory instead.
