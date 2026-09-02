# CLAUDE.md

## Domain-First Development

Before creating code, schema, API, or infrastructure — understand the domain
first: business problem, entities & relationships, actors & permissions,
business rules, use cases (who/trigger/inputs/validations/result/errors),
workflows (normal/failure/cancellation/recovery), state machines (states,
allowed & forbidden transitions), edge cases (duplicates, failures, race
conditions, fraud), constraints (quantity/time/permission/geographic/financial),
domain events (trigger/reactor/data), and data requirements
(storage/history/audit).

This file provides guidance to Claude Code when working with this repository.

## Project

**Too Fresh To Waste** — Food waste reduction marketplace (Tunisia market).
Monorepo: `apps/mobile` (React Native 0.81) + `apps/web` (Next.js 15) +
`apps/food-waste-backend` (NestJS 11) + `packages/shared` + `packages/ui`.
**Node**: 24.11.1 | **pnpm**: 10.17.0 | **Turborepo**: 2.6

---

## Commands

### Root (run from `C:\WFA`)

```bash
pnpm install                   # Install all workspace deps
pnpm build:deps                # Build shared + ui packages first (required before apps)
pnpm build                     # Build all apps via Turborepo
pnpm dev                       # Start Metro + NestJS + Next.js concurrently
pnpm lint / pnpm lint:fix      # ESLint across entire monorepo
pnpm type-check                # tsc --noEmit across all apps
pnpm test / pnpm test:ci       # Jest across monorepo (test:ci adds coverage)
pnpm clean                     # Remove dist/, .turbo, Metro cache

# Scoped shortcuts
pnpm --filter @foodwaste/mobile <script>
pnpm --filter @foodwaste/web <script>
pnpm --filter @foodwaste/backend <script>
```

### Mobile (`apps/mobile`)

```bash
pnpm dev                       # Metro bundler
pnpm dev:android               # Run on Android device/emulator
pnpm metro:reset               # Metro with cache cleared
pnpm type-check                # TypeScript check (no emit)
pnpm test / test:watch         # Jest + RTL
pnpm build:android:debug       # Debug APK
pnpm clean                     # Full clean (Metro + Gradle)

# Android Product Flavors (dev / staging / production)
cd android
./gradlew assembleDevDebug                # Dev APK (emulator, .env.development)
./gradlew assembleStagingRelease          # Staging APK (.env.staging)
./gradlew bundleProductionRelease         # Production AAB (.env.production)
```

### Web (`apps/web`)

```bash
pnpm dev                       # Next.js dev on port 3001
pnpm build                     # Production build
pnpm start                     # Production server on port 3001
pnpm type-check                # TypeScript check
pnpm lint / pnpm lint:fix      # ESLint (next lint)
pnpm test / pnpm test:ci       # Jest
```

### Backend (`apps/food-waste-backend`)

```bash
pnpm dev                       # NestJS watch mode
pnpm build                     # Compile to dist/
pnpm start:prod                # Run compiled app
pnpm check:ts                  # TypeScript check (backend has no `type-check`)
pnpm test / pnpm test:unit / pnpm test:integration
pnpm check:all                 # ts + lint + format + test + docs (full gate)
pnpm seed:admin                # Seed initial admin user
pnpm verify:indexes            # Validate MongoDB indexes
```

---

## Architecture

### Monorepo Layout

```
C:\WFA/
├── apps/
│   ├── mobile/                # @foodwaste/mobile — React Native 0.81
│   ├── web/                   # @foodwaste/web — Next.js 15 (App Router)
│   └── food-waste-backend/    # @foodwaste/backend — NestJS 11
├── packages/
│   ├── shared/                # @foodwaste/shared — types, enums, generated API types
│   └── ui/                    # @foodwaste/ui — shared UI components
├── turbo.json
├── pnpm-workspace.yaml
└── tsconfig.base.json         # Strict TS, path aliases
```

**`packages/shared` and `packages/ui` must be built (`pnpm build:deps`) before
starting any app.**

### Path Aliases

- Mobile: `@/` → `apps/mobile/src/`, `@foodwaste/shared` → `packages/shared/src`
- Web: `@/` → `apps/web/src/`, `@foodwaste/shared`, `@foodwaste/ui`
- Backend: relative imports only — no path aliases

---

### Mobile — `apps/mobile/src/`

**Provider hierarchy** (App.tsx):

```
GestureHandlerRootView → SafeAreaProvider → ReduxProvider → PersistGate (MMKV)
  → QueryProvider (TanStack) → ThemeProvider → RootNavigator → Toast
```

**Navigation** driven by `AuthFlowState` enum in Redux (`store/authSlice`):

| AuthFlowState                | Screen                           |
| ---------------------------- | -------------------------------- |
| `AUTHENTICATED`              | MainStack → BottomTabs           |
| `UNAUTHENTICATED`            | AuthStack → Login                |
| `EMAIL_VERIFICATION_PENDING` | AuthStack → VerifyEmail          |
| `PHONE_VERIFICATION_PENDING` | AuthStack → VerifyPhone          |
| `MFA_REQUIRED`               | AuthStack → MFAVerification      |
| `SESSION_EXPIRED`            | AuthStack → Login (with message) |

**Stack structure:**

```
RootNavigator
├── AuthStack       (Welcome, Login, Register, ForgotPassword, ResetPassword,
│                    VerifyEmail, VerifyPhone, MFAVerification)
└── MainStack       (modal-style screens + BottomTabNavigator)
    └── BottomTabs  (Home, Search, Favorites, Orders, Profile)
        └── OrdersStack → OrdersList → OrderDetails (nested; NOT in MainStack)
```

> **Critical**: `OrderDetails` lives inside `OrdersStack`. Navigate from outside
> via `CommonActions.reset` with nested state.

**State**: Redux Toolkit (auth, location, favorites) + TanStack Query v5 (server
state) + MMKV (persistence) + Keychain (tokens/secrets).

**Feature modules**: Vertical slices under `features/<name>/` (screens,
components, hooks, services, store, types).

**Design system**: Atomic design in `design-system/` — tokens → atoms →
molecules → organisms.

---

### Web — `apps/web/src/`

**Framework**: Next.js 15 App Router + React 19 + next-intl 4.7 + Zustand 5 +
TanStack Query 5.

**Provider hierarchy** (app/[locale]/layout.tsx):

```
NextIntlClientProvider → QueryProvider → ThemeProvider → AuthProvider → TooltipProvider → Toaster
```

**Route groups** under `app/[locale]/`:

| Group                   | Purpose                                              | Protection                              |
| ----------------------- | ---------------------------------------------------- | --------------------------------------- |
| `(marketing)`           | Landing, business-signup, coming-soon                | Public                                  |
| `(auth)`                | Login, register, verify-email, forgot/reset-password | Public                                  |
| `(merchant-onboarding)` | Merchant signup flow                                 | Public                                  |
| `(merchant)`            | Dashboard, offers, orders, analytics, settings       | AuthGuard + RoleGuard(MERCHANT)         |
| `(admin)`               | Admin dashboard, users, moderation, settings         | AuthGuard + RoleGuard(ADMIN, MODERATOR) |

**Auth**: HttpOnly cookies (access + refresh tokens set by backend). No tokens
in JS memory. Middleware (Edge): `jose` JWT verification. AuthProvider:
rehydrates via `GET /auth/me`, proactive refresh every 13min, cross-tab sync.

**State**: Zustand stores (`useAuthStore`, `useNotificationStore`). TanStack
Query with centralized query key factories (`dashboardKeys`).

**API client**: Axios with `withCredentials: true`. 401 interceptor triggers
refresh + retry. Refresh mutex prevents concurrent refresh calls.

**i18n**: Locales `en` (default), `fr`, `ar` (RTL). Currency: TND.

**Real-time**: Socket.IO for merchant order notifications. Zod-validates
incoming events. Patches TanStack Query cache on updates.

---

### Backend — `apps/food-waste-backend/src/`

**Bootstrap** (`main.ts`): Sentry → HTTPS → Filters → Interceptors → URI
versioning (`/api/v1/...`) → Helmet CSP → CORS → ValidationPipe → Swagger
(`/api/v1/api-docs`) → Redis IO adapter → graceful shutdown.

**Module map**: Auth, Users, Establishments, Offers, Orders, Payment, Reviews,
Notifications, Geolocation, Favorites, Donations, Loyalty, Inventory, Analytics,
Moderation, Admin, Drivers, WebSocket, Search, Archive, Health.

**Global middleware**: `CorrelationIdMiddleware` (request tracing) +
`GlobalSanitizationMiddleware` (XSS prevention).

**MongoDB**: maxPoolSize=100, minPoolSize=10, zstd compression, write concern
`w:'majority'`, journaling in production.

**Redis**: Rate limiting (ThrottlerModule) + Bull job queues + Socket.IO
pub/sub.

**Response envelope** (all endpoints):

```typescript
{ status: number; message: string; data: T; meta?: { page, limit, total, totalPages, hasNext, hasPrev }; timestamp: string; }
```

`status` is a **number** (e.g. 200), not `'success'`/`'error'`.

**Login nests its tokens.** `POST /auth/login` returns
`data: { success, user, tokens: { accessToken, refreshToken } }` — tokens are
under `data.tokens`, not `data`, and the id field is `user.userId`, not
`user._id`.

Mobile uses `unwrapBackendResponse()`. Web accesses `response.data.data`
directly.

---

## Key Domain Patterns

### Order Expiration

- `expiresAt = offer.availableUntil + 30 min` (`ORDER_GRACE_PERIOD_MS`)
- Pickup code validity = `order.expiresAt`

### Delivery & the driver role

`deliveryMode: 'pickup' | 'delivery'` (default `pickup`). Separate status
chains:

```
pickup:   PENDING → RESERVED → CONFIRMED → READY_FOR_PICKUP → PICKED_UP
delivery: PENDING → CONFIRMED → DRIVER_ASSIGNED → OUT_FOR_DELIVERY → DELIVERED
```

**Pricing** (computed once at order creation in
`orders/utils/order-pricing.util.ts`):

```
Customer pays = subtotal + deliveryFee
Food → merchant 81%, platform 19%    Delivery → driver 3.00 TND, platform 1.00 TND
```

- Pickup: `deliveryFee` is 0. Settlement splits `pricing.subtotal`, never
  `total`.
- Charity donation: `subtotal * 0.19 * 0.05` = 0.95% of subtotal (from platform
  margin).
- `MAX_DELIVERY_KM` (default 5): hard gate, fails with `BadRequestException`.

**Geozones** carry their own `deliveryFee`, `minimumOrder`,
`defaultSearchRadius`, `timezone`, currency, and boundary polygon.

**Stale deliveries auto-release** via Bull queue
(`auto-unassign-stale-delivery`). Every unassignment appends to an audit array
with an `auto` flag.

### Establishment Population

`order.establishmentId` can be `string` OR populated object. Always use
`getEstablishmentName()` / `getEstablishmentImage()`.

### User Profile Image

Two fields: `avatar` (legacy) + `profileImage` (newer). Resolution:
`profileImage > avatar > null`.

### Loyalty

- "Save a Bag" (+10 pts); `totalBagsSaved` tracks bags; `totalOrdersCount`
  tracks orders
- `addPoints()` only increments counters when `orderId` is present

### Donation Goal Auto-Rotation

Goals: `TSHIRTS → PANTS → SHOES → CHILDREN_STUDIES → MEDICINE`. One round = one
season. Formula: `subtotal * 0.19 * 0.05`. Overflow cascades to next goal.
`DonationPoolStatus`: `ACTIVE | FUNDED | SEASON_COMPLETE | ARCHIVED | PAUSED`.

### Local MongoDB is a single-node replica set

Required for `session.withTransaction()`. `docker-compose.yml` runs
`mongod --replSet rs0` with keyfile auth. `mongo-init` initiates the set and
waits for PRIMARY. `DATABASE_URL` needs `replicaSet=rs0&directConnection=true`.

### PM2 cluster mode — startup code races with itself

PM2 forks one worker per core. Anything in constructors/`onModuleInit` runs
concurrently across workers. Use unique indexes + treat E11000 as the losing
worker's normal path (see `uniq_single_active_pool` on `DonationPoolSchema`).

### Native addons in Docker

`pnpm -r rebuild` (not `npm rebuild` or `pnpm rebuild` without `-r`) is required
to walk all workspace projects. The Dockerfile asserts `.node` files exist after
rebuild.

### Load and concurrency testing

`tests/k6/`: `journeys/` (load) vs `smoke/` (functional) — never merge them.

```bash
ALLOW_LOADTEST_SEED=true PAYMENT_PROVIDER=stub \
  pnpm --filter @foodwaste/backend seed:loadtest
k6 run tests/k6/suites/gate.js --env ENV=docker
k6 run tests/k6/suites/concurrency.js --env ENV=docker
pnpm --filter @foodwaste/backend verify:loadtest-invariants
```

- `PAYMENT_PROVIDER=stub` required for checkout tests.
- `THROTTLE_LIMIT` raised in load-test environments only.

### Database Indexes — schemas are the only source of truth

`autoIndex` is off in production. Declare indexes on schemas; run
`db:create-indexes` to apply. `verify:indexes:strict` is the CI gate. Never mix
`sparse` with `partialFilterExpression`. Scope TTLs with
`partialFilterExpression` when collections hold multiple record kinds.

### `required: true` does nothing for existing documents

`required` is a write validator only. Give props a `default` so Mongoose
hydrates missing paths on read. Backfill with a migration for stored documents.

```bash
pnpm --filter @foodwaste/backend audit:missing-required
```

### Embedded arrays — cap or move them

1. **Cap**: `$push` with `$slice` atomically (constants in
   `document-limits.constant.ts`)
2. **Move**: own collection with TTL for append-only/audit data

When extracting: grep for `$push` too; write audit after parent save; batch
reads with `$in` + `Map` (no N+1).

### Never put the viewer's id in a cache key

Cache the shared aggregation result keyed by `(page, limit)`. Compute per-viewer
fields (`isFavorite`, `distance`) per request. See `CachedOfferPage` and
`personalizeOfferPage`. Personalisation must not mutate the cached page.

### Backend process model

PM2 cluster mode (`ecosystem.config.js`, started by `pm2-runtime`).
`PROCESS_ROLE` (`api | worker | all`, default `all`) gates cron jobs via
`CronLockService.runExclusive`. `container-resources.ts` detects cgroup limits.

```
total Mongo sockets = MONGO_MAX_POOL_SIZE × WEB_CONCURRENCY × replicas
```

`os.cpus()` lies in containers — never use PM2 `instances: 'max'`.
`--max-old-space-size` must fit `container memory / worker count`.

### Lockfile hygiene

```bash
pnpm check:lockfile   # ~1s, no install
pnpm fix:lockfile     # regenerate after manifest edit
```

Commit manifest + lockfile together. Never use `--no-frozen-lockfile`. After
rebase/merge, regenerate and verify.

---

## Known Issues

- iOS builds require macOS with Xcode — require explicit confirmation.
- Shared package changes require Metro cache reset: `pnpm metro:reset`.
- `src/store/rehydrationOrchestrator.tsx` no longer has TS errors. This entry
  used to say it did, and named the wrong extension;
  `pnpm --filter @foodwaste/mobile type-check` is clean at HEAD. Do not add new
  `@ts-expect-error` on its account.
- Mobile edge-to-edge: `edgeToEdgeEnabled=true`, never pass
  `translucent`/`backgroundColor` to `<StatusBar>`.

---

## Verification Gates

| Scope of change          | Command to run                                               |
| ------------------------ | ------------------------------------------------------------ |
| Backend only             | `pnpm --filter @foodwaste/backend check:ts`                  |
| Web only                 | `pnpm --filter @foodwaste/web type-check`                    |
| Mobile only              | `pnpm --filter @foodwaste/mobile type-check`                 |
| `packages/shared` change | `pnpm build:deps` → then `pnpm metro:reset` for mobile       |
| Before any PR (backend)  | `pnpm --filter @foodwaste/backend check:all`                 |
| Cross-app change         | `pnpm type-check` (full monorepo)                            |
| Any `*.schema.ts` index  | `verify:indexes:strict`, then `db:create-indexes`            |
| Any `package.json` edit  | `pnpm check:lockfile`                                        |
| Web UI change            | `pnpm --filter @foodwaste/web check:design`                  |
| Mobile UI change         | `pnpm --filter @foodwaste/mobile test` (422 style snapshots) |

`check:ts` covers `scripts/` as well as `src/` and `test/`.

The gate is necessary, not sufficient. After it passes, run the review lenses in
`.claude/rules/adversarial-review.md` — a green type-check proves nothing about
unhandled branches or coverage that only looks like coverage.

Multi-session or cross-app work carries a spec file with an explicit `status`;
see `.claude/rules/work-state.md`.

---

## Scenario Coverage — Required Before Completing Any Task

| Domain                   | Variants to check                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| **Auth flows**           | `authProvider`: local / google / facebook / apple — see `.claude/rules/auth-scenarios.md` |
| **User-facing features** | `isEmailVerified`, `isActive`, `role` (consumer / merchant / admin / moderator)           |
| **Offers / Orders**      | `status` transitions — every terminal state must be handled                               |
| **Payments**             | success / failure / timeout / webhook-received-twice (idempotency)                        |
| **Notifications**        | disabled / device token missing / locale is Arabic (RTL)                                  |

---

## Completeness Protocol

1. **Trace every dependency chain** — grep the entire repo for all references
   when adding/renaming/removing anything.
2. **Follow existing patterns** — read 2-3 examples before writing new code.
3. **Cover all user-facing paths** — grep for the action and gate every call
   site.
4. **No technical text reaches the user** — every `catch` must show a translated
   message.
5. **Translations are atomic** — add keys to all locale files + namespace arrays
   together.
6. **Performance by default** — `.select()`/`.lean()`, memoize, no N+1, use
   Query invalidation.
7. **DRY at the right level** — extract only at 3+ repetitions or shared
   bug-prone logic.
8. **Adversarial review, not self-review** — re-reading your own diff confirms
   the intent you already had. Run the four lenses in
   `.claude/rules/adversarial-review.md` (edge cases, deletions, claims,
   verification gaps) as a separate pass before reporting done.

---

## Hard Rules — Never Do These

1. Never enable `@nestjs/swagger` CLI plugin in `nest-cli.json`.
2. Never use `AbortController` for fire-and-forget POST hooks.
3. Never store tokens outside HttpOnly cookies (web) or Keychain (mobile).
4. Never use raw hex values - use Tailwind tokens or CSS variables. The only
   accepted exceptions are listed in `DESIGN.md` §19-E11.
5. Never use relative imports to workspace packages in the backend.
6. Never pass `val | undefined` to optional props
   (`exactOptionalPropertyTypes`). Use conditional spread.
7. Never invent a design value. Colour, spacing, radius, shadow, duration and
   component sizes all come from `DESIGN.md`. A value that does not exist there
   is a §20 governance event, not a local decision.
8. Never overload Tailwind's numeric spacing keys with a semantic scale. See
   `DESIGN.md` §4.2 and `DESIGN_AUDIT_REPORT.md` Part 1 for why.
9. Never ship a screen without its empty, loading and error states.

---

## TypeScript Gotchas

### Mongoose `@Prop()` with union types

`reflect-metadata` emits `Object` for unions. Always add explicit `type:`:

```typescript
@Prop({ type: Date })
expiresAt?: Date | undefined;
```

### Backend response envelope access

- **Mobile**: `unwrapBackendResponse(response)` — never `.data.data`
- **Web**: `response.data.data` for payload, `response.data.meta` for pagination

---

## Frontend Design System - DESIGN.md is binding

**All UI work is governed by [`DESIGN.md`](./DESIGN.md).** Read it before
writing any component, screen, or style. It is the single source of truth for
colour, typography, spacing, sizing, radius, elevation, motion, states,
responsive behaviour, RTL, accessibility, component anatomy, and UX behaviour.

**Before any UI task:**

1. Read `DESIGN.md` §14 (UX Standards) for a screen, or §13 (Component
   Standards) for a component.
2. Use only approved tokens. Never invent a colour, spacing, radius or shadow
   value.
3. Check §19 (Known Exceptions) - several rules describe a target the code has
   not reached yet, and §19 says which.

**Before reporting any UI work complete**, run the §18 Pre-Completion
Self-Review in full. It covers visual, UX, engineering, accessibility and
localization (en / fr / ar + RTL). This is mandatory, not advisory.

**Introducing a new design decision** (a new token value, component, variant, or
interaction pattern) is a governance event. Follow §20: decide whether it
belongs in the system, update the token/component rule and `DESIGN.md`
**first**, then implement. Never ship a reusable decision only inside one page.

**Deliberate deviations go in §19 Known Exceptions.** An undocumented deviation
is a defect.

**For the current state, read
[`DESIGN_SYSTEM_MIGRATION_FINAL_REPORT.md`](./DESIGN_SYSTEM_MIGRATION_FINAL_REPORT.md).**
It supersedes the counts in [`DESIGN_AUDIT_REPORT.md`](./DESIGN_AUDIT_REPORT.md)
(web) and [`MOBILE_DESIGN_AUDIT_REPORT.md`](./MOBILE_DESIGN_AUDIT_REPORT.md)
(mobile), both of which describe the codebase **before** the migration and are
kept as history.

`DESIGN.md` §19 remains the authoritative status of every exception.

**§19-E1 and §19-E5 are resolved.** This file previously warned that dark mode
could not render and that Tailwind's numeric spacing keys were overridden, so
`p-4` meant 24px. Both were fixed on 2026-08-24 and re-verified at HEAD: `body`
uses `bg-background text-foreground`, and `tailwind.config.ts` defines only the
named scale, so **`p-4` is Tailwind's default 16px**. Do not code around either.

What does affect everyday work:

- **Mobile production is light-only.** `DARK_MODE_ENABLED = false` in
  `design-system/providers/themeRollout.ts`; `App.tsx` passes `lockToLight`. The
  dark palette and its half of the snapshot matrix still exist and are tested,
  but dark mode has **never been verified on a device**. Do not enable it
  without that pass. (§19-E27)
- **Web visual coverage is component-deep, not route-wide.** 192 Playwright
  baselines exist (`pnpm --filter @foodwaste/web test:visual`) covering 13
  components across 12 viewport x theme x locale combinations, but only **3
  routes**. No authenticated route has a baseline. (§19-E17, §19-E30)
- **Mobile spacing and typography are partially migrated**, not finished: the
  residue is values with no token (6/10/14 px spacing, 11/13/15 px type). Adding
  one is a §20 governance event, not a local decision.
- **Mobile radius is not migrated**, and the web/mobile radius scales are still
  transposed. §6.1 declares mobile's canonical; the code does not follow it yet.
  (§19-E6)
- **Decisions, not defects:** D4, D5, D6 and D8 in
  [`DESIGN_DECISIONS_PENDING.md`](./DESIGN_DECISIONS_PENDING.md) are verified
  real and deliberately unimplemented - each needs a product, brand or design
  call. D1, D2, D3 and D7 are resolved.

> **Note on `.claude/rules/ui-ux.md`:** it is stale on fonts, the component
> list, the `secondary` value, and the status-badge pattern. Where it disagrees
> with `DESIGN.md`, `DESIGN.md` wins. See `DESIGN.md` §21 for each contradiction
> and its resolution.

### Web layout

Dashboard layouts: `fixed inset-0` (not `h-screen`) on the outermost wrapper.
`min-h-0` is required on both the flex row and the `main`, or the scroll
container never forms.

```tsx
<div className='fixed inset-0 flex flex-col bg-background'>
  <Header />
  <div className='flex flex-1 min-h-0 overflow-hidden'>
    <Sidebar />
    <main className='flex-1 overflow-y-auto overscroll-contain min-h-0'>
      {children}
    </main>
  </div>
</div>
```

---

## OpenAPI Type Generation

```bash
cd packages/shared
pnpm generate          # fetch spec + generate in one step
```

Always use generated types — never write manual API types:

```typescript
import type { ApiSchemas } from '@foodwaste/shared';
type LoginDto = ApiSchemas['LoginDto'];
```

For errors: Observe → Reproduce → Trace → Understand root cause → Fix → Prevent
recurrence.
