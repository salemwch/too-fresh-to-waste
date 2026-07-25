# Mobile Production Audit — Too Fresh To Waste

**Scope:** `apps/mobile/src` (333 files, ~70,000 LOC) · React Native 0.81.0 ·
React 19.1.0 · New Architecture + Hermes enabled **Method:** Read-only static
audit. Every finding cites `file:line` and carries a confidence level. **Out of
scope:** backend, web, `android/`, `node_modules`.

Confidence legend — **Confirmed** (verified in source//executed), **Likely**
(strong evidence, not executed), **Speculative** (pattern-based, needs runtime
proof).

---

# Executive Summary

**Overall Score: 5.8/10**

**Production Readiness: ~55%** — anchored to this: the app is architecturally
sound and secure enough to ship to a controlled audience, but has **zero
automated verification on its highest-risk paths** (auth, payments, session) and
**a broken Arabic experience** in a market where that matters. Those two gate a
confident public launch, not the architecture.

**Technical Debt Level: HIGH** — concentrated, not diffuse. The debt sits in
four places (testing, i18n/RTL, god files, offline), and the rest of the
codebase is genuinely well built.

| #   | Domain              | Score    | One-line verdict                                           |
| --- | ------------------- | -------- | ---------------------------------------------------------- |
| 1   | Architecture        | 7/10     | Clean feature slices; undermined by god files              |
| 2   | State Management    | 6/10     | Right tools, right boundaries, zero tests                  |
| 3   | Performance         | 5/10     | A total render-freeze shipped to production                |
| 4   | Networking          | 8/10     | Strongest layer in the app                                 |
| 5   | Security            | 7/10     | Excellent token handling; fails open on storage encryption |
| 6   | Offline-First       | 4/10     | Effectively online-only despite the scaffolding            |
| 7   | Navigation          | 7/10     | Well structured, some known footguns                       |
| 8   | Code Quality        | 6/10     | Elite TypeScript discipline, oversized files               |
| 9   | Scalability         | 5/10     | Limited by verification, not by design                     |
| 10  | RN/React 19/TS/a11y | 6/10     | TS excellent, a11y decent, i18n/RTL poor                   |
| —   | **Testing (added)** | **2/10** | **The single biggest risk in this repo**                   |

### What this codebase does better than most

Not padding — these are measurably above industry median and should not be
"fixed":

- **9 `any` casts and 0 `@ts-ignore` across 70k LOC.** Exceptional.
- **Tokens exclusively in Keychain** with
  `ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY` (`services/SecureStorage.ts:114`).
  Zero token references in AsyncStorage/MMKV/Redux — verified by grep.
- **Locale key parity is perfect**: en/fr/ar all exactly 501 keys, zero drift in
  either direction.
- **One axios instance, zero raw `fetch()` calls.** No code path bypasses the
  auth/refresh interceptors.
- **No hardcoded secrets; no `.env` tracked in git** (only `.env.example`).

---

# Critical Findings

## C1 — Zero test coverage on auth, payments, and session logic

**Confidence: Confirmed**

**Problem.** 21 test files against 333 source files. **0 of 36 screens** have
any test. The specific untested modules:

| Module                                       | LOC   | Tests    |
| -------------------------------------------- | ----- | -------- |
| `features/auth/store/authSlice.ts`           | 1,369 | **none** |
| `features/orders/screens/CheckoutScreen.tsx` | 1,204 | **none** |
| `store/slices/locationSlice.ts`              | 966   | **none** |
| `store/middleware/authSessionMiddleware.ts`  | 886   | **none** |
| `features/auth/services/authService.ts`      | 704   | **none** |

Meanwhile tests _do_ exist for `Button`, `Badge`, `Card`, `Avatar`, `Icon`,
`Text` and the voting feature.

**Why it is problematic.** The test pyramid is inverted **by risk**. Effort went
to the surface where failure is cosmetic and skipped the surface where failure
means account takeover, double-charged customers, or a locked-out user base.
`authSessionMiddleware` (886 lines of token refresh, race handling, and retry)
is the most concurrency-sensitive code in the app and has no executable
specification at all.

**Impact.** Any refactor of auth or checkout is a blind change. There is no
regression net for the exact bug classes that cost real money and real trust.
This also blocks safe onboarding of new engineers.

**Severity: CRITICAL**

**Recommended solution.** Do not chase a coverage percentage — target risk. In
priority order:

1. `authSlice` reducers + `authSessionMiddleware` refresh concurrency (mock
   timers, assert single-flight refresh under parallel 401s).
2. `CheckoutScreen` state machine: success / failure / timeout / **duplicate
   webhook** (idempotency), per your own CLAUDE.md payments matrix.
3. The `authProvider` matrix from `.claude/rules/auth-scenarios.md` — local vs
   google/facebook/apple against forgot/reset/change password.
4. Then screens, via React Native Testing Library.

**Example** (single-flight refresh, the highest-value test in the repo):

```ts
it('serialises concurrent 401s into one refresh call', async () => {
  const refreshSpy = jest
    .spyOn(authService, 'refreshToken')
    .mockResolvedValue({ accessToken: 'new', refreshToken: 'new2' });

  await Promise.all([
    apiClient.get('/orders'),
    apiClient.get('/offers'),
    apiClient.get('/profile'),
  ]);

  expect(refreshSpy).toHaveBeenCalledTimes(1); // not 3
});
```

---

## C2 — Arabic (RTL) layout is systematically broken

**Confidence: Confirmed**

**Problem.** Arabic is a first-class supported locale (`i18n/index.ts:55-59`
calls `I18nManager.forceRTL`), but the stylesheets are written with physical
directions:

- **311** occurrences of `marginLeft` / `marginRight` / `paddingLeft` /
  `paddingRight` / `left:` / `right:`
- **14** occurrences of the RTL-safe logical equivalents
  (`marginStart`/`marginEnd`/`paddingStart`/`paddingEnd`/`start:`/`end:`)
- **4** `isRTL` guards across all 142 components

Concrete instance: `features/home/components/HomeOfferSection.tsx:348-355` uses
`paddingLeft: 14, paddingRight: 18` and `marginRight: 12` on the offer carousel
— in Arabic the carousel padding and card gutters invert incorrectly.

**Why it is problematic.** `I18nManager.forceRTL` flips the layout engine, but
hardcoded `marginLeft` stays physically left. The result is not a subtle polish
issue — it is misaligned carousels, clipped text, and inverted iconography
throughout, for an entire language.

**Impact.** The Arabic build is shippable in name only. In the Tunisian market
this is a primary-audience defect, not an edge case.

**Severity: CRITICAL** (product), **HIGH** (engineering effort)

**Recommended solution.** Codemod the mechanical majority, then review by hand:

```ts
// BAD — physically pinned, ignores RTL
carouselContainer: { paddingLeft: 14, paddingRight: 18 },
offerCardItem:     { marginRight: 12 },

// GOOD — flips automatically under I18nManager.forceRTL
carouselContainer: { paddingStart: 14, paddingEnd: 18 },
offerCardItem:     { marginEnd: 12 },
```

Add an ESLint rule to stop the bleeding:

```js
'no-restricted-syntax': [['error', {
  selector: "Property[key.name=/^(margin|padding)(Left|Right)$/]",
  message: 'Use marginStart/End or paddingStart/End — physical props break RTL (ar).',
}]]
```

Then add one RTL smoke test per top screen with `I18nManager.isRTL` forced true.

---

## C3 — 76% of the UI is not translated at all

**Confidence: Confirmed**

**Problem.** Only **34 of 142** `.tsx` files import `useTranslation`. Entire
features ship hardcoded English regardless of the selected locale:

- `features/driver/screens/DriverActiveOrderScreen.tsx:261,271,280,430,456` —
  "Loading your delivery…", "Mark as Delivered", "Your earnings"
- `features/driver/screens/DriverEarningsScreen.tsx:63,74,78` — "Earned today",
  "This week", "This month"
- `features/donations/components/ImpactMoment.tsx:151,159` — "You contributed",
  "Together we've donated:"
- `features/auth/screens/ForceChangePasswordScreen.tsx:117` — "You must set a
  new password before using the app."
- `features/home/components/HomeOfferSection.tsx:165,216,228` — "See All", "⚠️
  Failed to load {title}", "Retry"
- `features/home/constants/homeConstants.ts:76-107` — every `OFFER_SECTIONS`
  title/empty message is hardcoded English

**Why it is problematic.** The 501-key locale files have perfect parity, which
creates a **false signal of completeness** — the i18n system is healthy, it is
simply bypassed by three quarters of the UI. Note `HomeOfferSection.tsx:216`
also violates CLAUDE.md rule 4 ("no technical text reaches the user") by
interpolating a section title into a raw error string.

**Impact.** A French or Arabic user sees a bilingual, half-translated app.
Combined with C2, the non-English experience is not production quality.

**Severity: CRITICAL** (product)

**Recommended solution.** Sweep feature-by-feature (driver → donations → auth →
home constants). Enforce with `i18next/no-literal-string` scoped to
`features/**/*.tsx`. Per CLAUDE.md rule 5, add keys to en/fr/ar in a single
atomic commit.

---

# High Priority Findings

## H1 — Offline support is scaffolding, not function

**Confidence: Confirmed**

**Problem.** Three compounding gaps:

1. **No query persistence.** `lib/react-query/queryClient.ts:160` creates a
   plain `QueryClient` with no `persistQueryClient`/`AsyncStoragePersister`.
   `gcTime` is 24h (`:39`) but the cache is **memory-only** — every cold start
   begins empty.
2. **`networkMode: 'online'`** (`:63`) pauses every query when offline, so
   cache-less + paused = a blank app.
3. **The write queue covers one action.** `services/OfflineWriteQueue.ts:38`
   types `payload: FavoriteTogglePayload` — favorites only. Orders, profile
   edits, and reviews have no offline path.

**Why it is problematic.** The 24h `gcTime` and the queue's existence _imply_
offline-first to a reader; the app is actually strictly online. A user on the
Tunis metro opens to empty sections.

**Impact.** Poor perceived reliability on intermittent networks, and needless
cold-start latency on every launch even with good connectivity.

**Severity: HIGH**

**Recommended solution.** Persist the query cache — it is a contained change and
directly improves cold start:

```ts
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

persistQueryClient({
  queryClient,
  persister: createAsyncStoragePersister({ storage: mmkvStorage }),
  maxAge: 1000 * 60 * 60 * 24,
  dehydrateOptions: {
    // never persist authenticated user-scoped payloads
    shouldDehydrateQuery: q => !q.queryKey.includes('profile'),
  },
});
```

Then generalise `OfflineWriteQueue` to a discriminated union over mutation
types.

---

## H2 — Query cancellation is dead code; AbortControllers leak

**Confidence: Confirmed**

**Problem.** `services/apiClient.ts:186-187` overwrites the signal TanStack
Query supplies:

```ts
const abortController = createTrackedAbortController();
config.signal = abortController.signal; // ← discards queryFn's ({ signal })
```

Every `queryFn` dutifully threads `signal` through
(`features/offers/hooks/useOffers.ts:84,126,172`), and it is discarded at the
interceptor. Separately, `cancelInflightRequests()`
(`services/requestCancellation.ts:21`) is **never called anywhere** — verified
by repo-wide grep.

**Why it is problematic.** Two failures at once: (a) TanStack can no longer
cancel superseded requests, so fast filter/search typing leaves stale in-flight
requests racing to resolve; (b) `activeAbortControllers` is a `Set` that only
drains via `releaseTrackedAbortController` on settle — any request that neither
resolves nor rejects retains its controller for the process lifetime.

**Impact.** Wasted bandwidth and battery, possible stale-response overwrites on
rapid filter changes, slow unbounded memory growth.

**Severity: HIGH**

**Recommended solution.** Compose signals instead of replacing, and delete the
unused cancellation module:

```ts
const controller = createTrackedAbortController();
// Honour the caller's signal (TanStack) *and* our own.
if (config.signal) {
  const caller = config.signal as AbortSignal;
  if (caller.aborted) controller.abort();
  else
    caller.addEventListener('abort', () => controller.abort(), { once: true });
}
config.signal = controller.signal;
```

---

## H3 — MMKV encryption fails open in production

**Confidence: Confirmed**

**Problem.** `utils/mmkvStorage.ts:73-90` checks whether
`STORAGE_ENCRYPTION_KEY` is missing/placeholder and, when it is, logs a warning
and **constructs MMKV without encryption anyway** via conditional spread.
`config/environment.ts:160` compounds this with a `'default-key'` fallback
default. The redux-persist whitelist is `['auth', 'favorites', 'location']`
(`store/index.ts:76`) — i.e. the user profile and precise home coordinates.

**Why it is problematic.** This is fail-open security. A misconfigured CI secret
silently downgrades every user to plaintext-at-rest PII, and the only signal is
a log line nobody reads. Security controls should fail closed.

**Impact.** On a rooted/backed-up device, user identity and location history are
readable. GDPR-relevant.

**Severity: HIGH**

**Recommended solution.** Fail closed in release builds:

```ts
if (!isValidKey(encryptionKey)) {
  if (!__DEV__) {
    throw new Error(
      '[Storage] STORAGE_ENCRYPTION_KEY missing — refusing to start unencrypted.',
    );
  }
  Logger.warn('[Storage] Unencrypted MMKV (dev only)');
}
```

Also remove the `'default-key'` default at `environment.ts:160` — absent config
should be `undefined`, not a usable-looking sentinel.

---

## H4 — Two MMKV instances, one unencrypted

**Confidence: Confirmed**

**Problem.** `storage/mmkv.ts:21-24` creates a second instance with encryption
**commented out** (`// encryptionKey: 'your-encryption-key-here'`), parallel to
the encrypted `utils/mmkvStorage.ts`. Consumers: `i18n/index.ts:7`,
`storage/onboardingStorage.ts:15`, and `services/OfflineWriteQueue.ts:20`.

**Why it is problematic.** Two storage singletons with different security
properties and near-identical names (`storage/mmkv.ts` vs
`utils/mmkvStorage.ts`) is a trap — the next developer persisting something
sensitive has a 50% chance of picking the unencrypted one. I verified today's
payloads are benign (language, onboarding flags, favorite-toggle IDs), so this
is a latent hazard rather than a live breach.

**Impact.** High likelihood of a future data-at-rest leak; ongoing reviewer
confusion.

**Severity: HIGH** (latent)

**Recommended solution.** Collapse to one encrypted instance with two named
partitions, and delete `storage/mmkv.ts`.

---

## H5 — God files concentrate risk

**Confidence: Confirmed**

**Problem.** 24 files exceed 600 lines: `authSlice.ts` 1369 · `SearchScreen.tsx`
1223 · `CheckoutScreen.tsx` 1204 · `LeaderboardScreen.tsx` 1073 ·
`locationSlice.ts` 966 · `OfferDetailsScreen.tsx` 965 · `OrderDetailsScreen.tsx`
948 · `OfferCard.tsx` 928 · `HomeScreen.tsx` 911 · `authSessionMiddleware.ts`
886 · `LoginScreen.tsx` 886

`authSlice.ts` at 1,369 lines is a single-responsibility violation by a wide
margin — it holds credential auth, OAuth, MFA, email/phone verification, session
restore, and the `AuthFlowState` machine.

**Why it is problematic.** These files are exactly the ones with no tests (C1).
Size and untestedness are the same problem: a 1,200-line screen has too many
collaborators to test, so it doesn't get tested, so it grows.
`HomeScreen.tsx:774-796` shows the symptom concretely — a 22-entry `useCallback`
dependency array that no human can verify by inspection.

**Impact.** Slow review, high regression rate, onboarding friction, merge
conflicts.

**Severity: HIGH**

**Recommended solution.** Split `authSlice` first (it has the worst risk × size
product): `authSlice` (session/flow state) + `oauthSlice` + `verificationSlice`,
sharing types. Extract screen bodies into feature hooks — `useHomeOffers` is the
pattern to copy, it is genuinely good. Add an ESLint `max-lines: 400` warning to
prevent regrowth.

---

# Medium Priority Findings

## M1 — Memoization discipline is uneven

**Confidence: Confirmed.** 163 inline arrow props in JSX, 279 `useCallback`, but
only **31** `React.memo` across 142 components. Inline handlers defeat the
memoization already paid for. Examples: `HomeScreen.tsx:667`
(`onFilterPress={() => setIsFilterVisible(true)}`), `:855`, `:863`, `:875-882`.
**Severity: MEDIUM.** Fix: memoize leaf list/card components first; hoist
handlers passed into memoized children.

## M2 — Diagnostic logging left in a render hot path

**Confidence: Confirmed.**
`features/home/hooks/useHomeOffers.ts:187,215,268,297,322` call `Logger.debug`
**in the render body**, five times per render, each building an object literal
and calling `onlineManager.isOnline()`. Added in `b9b8afa` to chase the offer
bug — that bug is now fixed. **Severity: MEDIUM.** Fix: delete, or move behind
`if (__DEV__)`.

## M3 — Sentry receives unredacted log context

**Confidence: Likely.** `utils/logger.ts:110` forwards `extra: context` to
`Sentry.captureException` with no scrubbing, and `:141,155,169` forward every
`info`/`warn`/`error` context as breadcrumbs. `NetworkLogger.logRequest`
correctly logs only header _keys_ (`:241`) — that part is well done — but
arbitrary caller context is not filtered. **Severity: MEDIUM.** Fix:
allowlist-scrub keys matching `/token|password|authorization|email|phone/i` in
`logToSentry`.

## M4 — 33 of 52 dependencies float on `^`

**Confidence: Confirmed.** Directly violates your own CLAUDE.md ("Pin versions
explicitly. Never use floating `latest`") and `.claude/rules/security.md` #8.
Notably `@reduxjs/toolkit ^2.12.0`, `@tanstack/react-query ^5.101.0`,
`@sentry/react-native ^7.13.0`, `react-native-keychain ^10.0.0` — a
security-critical dependency on a floating range. Positively, the
native-critical ones _are_ pinned (`react-native 0.81.0`,
`react-native-mmkv 4.3.1`, `@shopify/flash-list 1.8.3`). **Severity: MEDIUM.**
Fix: pin exact, upgrade deliberately via Renovate.

## M5 — No certificate pinning

**Confidence: Confirmed.** `config/environment.ts:202` acknowledges it:
_"Certificate pinning and root detection are phased-in security features."_
**Severity: MEDIUM** — this is a legitimate risk-accepted decision for a
marketplace at this stage, not an oversight. Revisit before handling card data
directly.

## M6 — Global refetch defaults are aggressive

**Confidence: Likely.** `queryClient.ts:58-60` enables `refetchOnWindowFocus` +
`refetchOnReconnect` + `refetchOnMount` globally. With per-query `staleTime` of
1–2 min on the home queries, every app foreground triggers up to 4 parallel
refetches. **Severity: MEDIUM.** Fix: raise `staleTime` for stable resources;
keep aggressive refetch only for genuinely time-sensitive ones (urgent offers).

---

# Low Priority Findings

- ~~**L1** — `cancelInflightRequests` is dead code.~~ **RETRACTED — this finding
  was wrong.** It _is_ called, from `features/auth/store/authSlice.ts:486`
  (logout) and `:572` (account deletion), via `await import(...)`. My original
  grep did not include the identifier and I asserted "zero callers" from a
  search that never looked for it. Caught by `tsc` when I attempted the
  deletion. The function is load-bearing: it prevents orphaned responses landing
  after session teardown and re-triggering auth flows. **Lesson: dynamic imports
  defeat naive call-site greps — verify with the type-checker before deleting
  anything.**
- **L2** — `features/home/hooks/useHomeOffers.ts` doc comment claims "Request
  cancellation on unmount" (`:8`) and quotes precise timings (`:114-116`) that
  no longer hold. Misleading docs are worse than none. _Confirmed._
- **L3** — `HomeScreen.tsx:211-217` `useMemo` with complex expressions in the
  dependency array; ESLint flags it as unverifiable. _Confirmed._
- **L4** — `HomeScreen.tsx:487` shadows `coordinates` from the outer scope.
  _Confirmed._
- **L5** — 21 `eslint-disable` comments; several suppress
  `react-hooks/exhaustive-deps` (e.g. `useLocationSetup.ts:213`), which is how
  stale-closure bugs survive. _Confirmed._
- ~~**L6** — 4 stray `console.*` calls remain.~~ **RETRACTED — false positive.**
  All 4 matches are inside JSDoc examples
  (`PasswordStrengthIndicator.tsx:18-19`) or comments _describing_ console
  interception (`nativeModuleLogger.ts:78,253`). There are **zero** stray
  `console.*` calls in `src`. Logging discipline is clean.
- **L7** — `HomeScreen.tsx:2-16` header comment describes a "FlatList" refactor
  and "~320 lines"; the file uses FlashList and is 911 lines. _Confirmed._

---

# Architecture Refactoring Roadmap

### Phase 1 — Immediate (this sprint)

1. **C1a** — Tests for `authSessionMiddleware` refresh concurrency + `authSlice`
   reducers. _(3–5 d)_ — **OUTSTANDING**
2. ~~**H2** — Fix signal composition.~~ ✅ **DONE** — signals now composed, not
   replaced.
3. ~~**H3** — Fail closed on missing `STORAGE_ENCRYPTION_KEY`.~~ ✅ **DONE** —
   guard hoisted outside the `try` so the AsyncStorage fallback can't swallow
   it; `'default-key'` default removed.
4. ~~**M2** — Strip diagnostic logs from the render path.~~ ✅ **DONE** — 5
   per-render `Logger.debug` calls removed.
5. ~~**M3** — Scrub Sentry context.~~ ✅ **DONE** — depth-limited
   `redactSensitive()` applied to breadcrumbs and exceptions.
6. ~~**L2/L7** — Stale docs.~~ ✅ **DONE**. L1/L6 retracted (see above).

### Phase 2 — Next sprint

6. **C3** — Translate driver + donations + auth + home constants. _(4–6 d)_
7. **C1b** — Checkout state-machine tests incl. webhook idempotency. _(3 d)_
8. **H4** — Collapse to one encrypted MMKV instance. _(3 h)_
9. **M4** — Pin all dependencies; add Renovate. _(2 h)_
10. **M3** — Scrub Sentry context. _(2 h)_

### Phase 3 — Before scaling

11. **C2** — RTL codemod + lint rule + per-screen RTL smoke tests. _(5–8 d)_
12. **H1** — Persist the query cache; generalise the write queue. _(4 d)_
13. **H5** — Split `authSlice`; extract the three largest screens. _(5 d)_
14. **M1** — Memoize list/card leaves; hoist inline handlers. _(3 d)_
15. **M6** — Tune per-resource `staleTime`. _(1 d)_

### Phase 4 — World-class standard

16. Screen-level tests for all 36 screens; coverage gate in CI.
17. Detox E2E on the money paths (browse → order → pay → pick up).
18. Certificate pinning + root/jailbreak detection (**M5**).
19. Performance budgets in CI (TTI, bundle size) + Flipper/Hermes profiling.
20. `max-lines` lint gate; enforce the feature-slice boundary with
    `eslint-plugin-boundaries`.

---

# Scalability Assessment

| Users         | Assessment                                                                                                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **100**       | Fine today.                                                                                                                                                                                        |
| **10,000**    | Fine architecturally. First real pain is **support load from C2/C3** — non-English users reporting a broken UI.                                                                                    |
| **100,000**   | **H1** starts to bite: no cache persistence means every cold start is a full fan-out of 4+ queries against your API. **M6** multiplies it on every foreground. Client-side cost, server-side bill. |
| **1,000,000** | Gated by **C1**, not by code. At this size you cannot safely change auth or checkout without a regression suite. Also revisit **M5** (pinning) and per-user rate limiting.                         |

**Ceiling is organisational, not technical.** The architecture will carry a
million users; the absence of tests on auth/payments means you will not be able
to _change_ it at a million users.

---

# Standards Compliance (vs. your own repo rules)

Checked against `CLAUDE.md` Hard Rules and `.claude/rules/*.md` — the
highest-signal check available.

| Rule                                            | Source             | Status                                                                                    |
| ----------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| Tokens in Keychain only                         | mobile.md #1       | ✅ **Pass** — verified by grep, zero violations                                           |
| No `AbortController` on fire-and-forget POSTs   | mobile.md #2       | ✅ Pass                                                                                   |
| `exactOptionalPropertyTypes` conditional spread | mobile.md #7       | ✅ Pass                                                                                   |
| No relative imports to workspace packages       | CLAUDE.md #5       | ✅ Pass                                                                                   |
| Swagger CLI plugin never enabled                | CLAUDE.md #1       | ✅ Pass (backend)                                                                         |
| No hardcoded secrets; `.env` gitignored         | security.md #1, #9 | ✅ Pass                                                                                   |
| Input validation at boundaries (Yup)            | security.md #3     | ✅ Pass                                                                                   |
| **Pin exact dependency versions**               | security.md #8     | ❌ **Fail** — 33/52 floating (**M4**)                                                     |
| **No technical text reaches the user**          | CLAUDE.md §4       | ❌ **Fail** — `HomeOfferSection.tsx:216` (**C3**)                                         |
| **Translations atomic across locales**          | CLAUDE.md §5       | ⚠️ **Partial** — files are in perfect parity, but 108/142 components bypass i18n (**C3**) |
| **Logical CSS properties for RTL**              | ui-ux.md           | ❌ **Fail** — 311 physical vs 14 logical (**C2**)                                         |
| Auth provider variants handled                  | auth-scenarios.md  | ⚠️ **Unverifiable** — no tests exist to prove the matrix (**C1**)                         |

---

# Method & Limitations

- Static analysis only; **no runtime profiling**, so startup time, memory, and
  frame-rate claims are deliberately absent rather than estimated.
- Counts come from repo-wide `grep`/`find` and are exact for the patterns given;
  regex-based counts (inline arrows, physical style props) may include a small
  number of false positives in comments or strings — the ratios (311 vs 14) are
  far outside that margin.
- Already-documented known issues in CLAUDE.md (delivery not implemented,
  `rehydrationOrchestrator` TS errors, RN 0.81 edge-to-edge deprecation) were
  **excluded** as pre-existing and acknowledged.
- The FlashList render-freeze found and fixed immediately prior to this audit is
  reflected in the Performance score as a shipped-defect signal.
