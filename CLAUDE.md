# CLAUDE.md

DOMAIN-FIRST DEVELOPMENT RULE

Before creating any code, database schema, API, or infrastructure:

Focus first on:

1. Domain Understanding

- What business problem are we solving?
- What are the core concepts?
- What entities exist?
- What are their relationships?
- What terminology does the business use?

2. Actors & Permissions

- Who interacts with the system?
- What roles exist?
- What can each role do?
- What is forbidden for each role?

3. Business Rules

- What rules define the business?
- What conditions must always be true?
- What actions are allowed?
- What actions are forbidden?
- What validations must happen?

Example questions:

- Can this entity change state?
- Who can perform this action?
- When is this action impossible?
- What happens if something fails?

4. Use Cases For every important action define:

- Who performs it?
- What triggers it?
- What inputs are required?
- What validations happen?
- What is the expected result?
- What errors can occur?

5. Workflows Define complete lifecycle flows:

Example: Created ↓ Approved ↓ Processing ↓ Completed

Include:

- Normal flow
- Failure flow
- Cancellation flow
- Recovery flow

6. State Management For every important entity define:

- Possible states
- Allowed transitions
- Forbidden transitions

Example:

Order: PENDING → CONFIRMED → COMPLETED

Forbidden: COMPLETED → PENDING

7. Edge Cases Think about abnormal situations:

- Duplicate actions
- Network failure
- Payment failure
- User cancellation
- Missing data
- Race conditions
- Fraud attempts

8. Constraints Define technical and business limits:

- Quantity limits
- Time limits
- Permission limits
- Geographic limits
- Financial limits

9. Domain Events Identify important events:

Example:

OrderCreated PaymentCompleted PickupConfirmed FoodExpired

Define:

- What triggers the event?
- Who needs to react?
- What data is included?

10. Data Requirements Before database design:

- What information must be stored?
- What history must be preserved?
- What data must never be deleted?
- What needs auditing?

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

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
in JS memory.

- Middleware (Edge): `jose` JWT verification, redirects unauthenticated users
- AuthProvider: rehydrates via `GET /auth/me`, proactive refresh every 13min,
  cross-tab sync via localStorage event
- AuthGuard/RoleGuard: client-side route protection with loading skeletons

**State**: Zustand stores (`useAuthStore`, `useNotificationStore`). TanStack
Query with centralized query key factories (`dashboardKeys`).

**API client**: Axios with `withCredentials: true` (auto-sends cookies). 401
interceptor triggers refresh + retry. Refresh mutex prevents concurrent refresh
calls.

**i18n**: Locales `en` (default), `fr`, `ar` (RTL). Locale always in URL prefix.
Currency: TND.

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

**Redis**: Rate limiting (ThrottlerModule) + Bull job queues + Socket.IO pub/sub
adapter.

**Response envelope** (all endpoints):

```typescript
{ status: 'success' | 'error', message: string, data: T, meta?: { page, total, limit } }
```

Mobile uses `unwrapBackendResponse()`. Web accesses `response.data.data`
directly.

---

## Key Domain Patterns

### Order Expiration

- `expiresAt = offer.availableUntil + 30 min` (constant:
  `ORDER_GRACE_PERIOD_MS`)
- Pickup code validity = `order.expiresAt`
- Mobile disables pickup input client-side when `expiresAt` is past

### Delivery & the driver role

An order carries `deliveryMode: 'pickup' | 'delivery'` (default `pickup`). The
two modes are **separate status chains** — never assume one is a superset of the
other:

```
pickup:   PENDING → RESERVED → CONFIRMED → READY_FOR_PICKUP → PICKED_UP
delivery: PENDING → CONFIRMED → DRIVER_ASSIGNED → OUT_FOR_DELIVERY → DELIVERED
```

`DRIVER_ASSIGNED` = a driver accepted but has not collected the food yet;
`OUT_FOR_DELIVERY` = the food is with the driver. Both are in `OrderStatus`
(`packages/shared/src/enums/order.enum.ts`).

**Money is computed once at order creation and never recalculated.** All of it
lives in `orders/utils/order-pricing.util.ts` — never inline a fee anywhere
else.

```
Customer pays  =  food (subtotal)  +  deliveryFee

Food      →  merchant 81 %   platform 19 %
Delivery  →  driver 3.00 TND  platform 1.00 TND
```

| Field                        | Source                         | Default |
| ---------------------------- | ------------------------------ | ------- |
| `pricing.deliveryFee`        | `FLAT_DELIVERY_FEE` env        | 4.0 TND |
| `driverEarnings`             | `DRIVER_DELIVERY_EARNINGS` env | 3.0 TND |
| `platformDeliveryCommission` | `deliveryFee - driverEarnings` | 1.0 TND |

- **Pickup is food only.** `deliveryFee` is 0.
- **Payment method is a payment method, not a fee.** Cash never adds a charge.
  There is no `serviceFee` any more — it was a hardcoded 4 TND applied whenever
  `paymentMethod === 'pay_on_delivery'` in _both_ modes, so a cash pickup was
  charged 4 TND while an online-paid delivery was charged nothing. The separate
  `deliveryFee` field was written to the order and never added to `total`, so
  the platform funded every online delivery's 3 TND driver payout from its own
  margin and booked a 1 TND commission it had never collected. Renamed on stored
  orders by `scripts/migrations/rename-service-fee-to-delivery-fee.ts`.
- **Settlement splits `pricing.subtotal`, never `pricing.total`.** `total`
  includes the delivery fee, and the merchant has no part in delivery — 81 % of
  `total` would leave the platform paying a 3 TND driver out of a 0.76 TND
  share. Use `calculateFoodRevenueSplit(order.pricing.subtotal)`.
- **Charity donation**: `subtotal * 0.19 * 0.05` — 5 % of the platform's 19 %
  commission on **food**, i.e. 0.95 % of subtotal. Delivery margin is excluded;
  it funds the driver network. Funded from platform margin, never added to what
  the customer pays.
- **`MAX_DELIVERY_KM`** (default 5) is a hard gate: `haversineKm` between
  establishment and delivery address, `BadRequestException` beyond it. Order
  creation fails — it does not silently fall back to pickup.
- `collectionStartTime = now` (food is already prepared), `collectionEndTime =`
  earliest offer expiry. The driver pool geo-query filters on these.

**Geozones** (`admin/schemas/geozone.schema.ts`) carry their own `deliveryFee`,
`minimumOrder`, `defaultSearchRadius` (5000 m), `timezone` (`Africa/Tunis`) and
currency, plus a boundary polygon. Zone-level config is the intended override
path for the flat env fee.

**Driver profile**: one per user (`userId` unique), with `idCardNumber`,
`address`, `isOnline`, and a GeoJSON `Point` location. Endpoints live under
`/drivers`: `me`, `status`, `location`, `orders/available|active|history`,
`earnings`, and `orders/:id/accept|pickup|deliver|unassign`.

**Stale deliveries auto-release.** A Bull queue (`driver-delivery-timeouts`, job
`auto-unassign-stale-delivery`) unassigns an order whose driver went quiet.
Every unassignment — manual or automatic — appends to an audit array on the
order, with an `auto` flag distinguishing the two. When adding a new
unassignment path, write that audit entry or the trail lies.

### Establishment Population

`order.establishmentId` can be `string` OR populated object. Always use
`getEstablishmentName()` / `getEstablishmentImage()`.

### User Profile Image

Two fields: `avatar` (legacy) + `profileImage` (newer). Resolution:
`profileImage > avatar > null`. After upload, persist to Keychain (mobile) — not
Redux-only.

### Loyalty

- Active action: "Save a Bag" (+10 pts); others show "Coming Soon"
- `totalBagsSaved` tracks bags; `totalOrdersCount` tracks orders
- `addPoints()` only increments counters when `orderId` is present

### Donation Goal Auto-Rotation

Goals follow a fixed sequence defined in
`donations/constants/goal-sequence.constant.ts`:

```
TSHIRTS → PANTS → SHOES → CHILDREN_STUDIES → MEDICINE
```

- **Formula**:
  `subtotal * PLATFORM_FOOD_SHARE(0.19) * DONATION_RATE_OF_COMMISSION(0.05)` =
  0.95% of food subtotal. Single source of truth: constants exported from
  `orders/utils/order-pricing.util.ts`. The `DONATION_CONSTANTS` in
  `donations/interfaces/donation.interface.ts` must mirror these values — never
  inline a separate rate.
- **Auto-rotation**: When a goal's target is reached, the pool status changes to
  `FUNDED` and its `currentAmount` is capped at `targetAmount`. A new `ACTIVE`
  pool is created for the next category in the sequence.
- **Overflow**: If a donation pushes `currentAmount` past `targetAmount`, the
  excess (`currentAmount - targetAmount`) becomes the new pool's starting
  `currentAmount`. Calculated as `Math.max(0, currentAmount - targetAmount)`.
- **Cascade**: If overflow exceeds the next goal's target too, rotation recurses
  through the sequence until the overflow is absorbed or all goals are funded.
- **Season**: One round of all 5 goals = one season. When `MEDICINE` (last goal)
  is funded, the pool status becomes `SEASON_COMPLETE`. Admin must call
  `POST /admin/donations/pool/start-season` to begin a new season — this
  increments the season number, archives all non-archived pools, and resets
  category snapshots.
- **History**: `GET /admin/donations/history` returns all archived/funded/
  season-complete pools grouped by season number, sorted descending.
- **Funded pools are locked**: `currentAmount` is capped at `targetAmount` on
  the funded pool. No code path decrements a `FUNDED` pool.
- **Pool fields**: `season` (number, default 1), `goalIndex` (number, default
  0), `completedGoals` (array of funded categories so far in this season).
- **`DonationPoolStatus`**: `ACTIVE` | `FUNDED` | `SEASON_COMPLETE` | `ARCHIVED`
  | `PAUSED`. `SEASON_COMPLETE` lives in both the backend schema enum and
  `@foodwaste/shared` — keep them in sync.
- **Target per category**: computed from `DEFAULT_CATEGORY_PRICES[category]` as
  `itemPrice * targetCount`. Never hardcoded — admin may override via the
  existing `updatePool` endpoint.

### Data Fetching

- Mobile: `useQueryWithFocus` for screen-level queries (refetch on focus)
- Web: TanStack Query with centralized `dashboardKeys` factory + WebSocket cache
  patching

### Database Indexes — schemas are the only source of truth

`autoIndex` is **off in production** (`app.module.ts`). Declaring an index on a
Mongoose schema therefore does **not** create it in production. Nothing does,
until someone runs the script.

```bash
pnpm --filter @foodwaste/backend db:create-indexes      # additive; never drops
pnpm --filter @foodwaste/backend verify:indexes         # drift report (read-only)
pnpm --filter @foodwaste/backend verify:indexes:strict  # exits 1 on MISSING/MISMATCHED
pnpm --filter @foodwaste/backend db:audit-indexes       # $indexStats usage, before any drop
```

- **Declare every index on its schema.** `scripts/lib/schema-registry.ts`
  discovers all `*.schema.ts` by convention (`<ModelName>Schema` export) and
  both scripts derive from it. There is no hand-maintained index list any more —
  the old `ALL_INDEXES` constant drifted to covering 13 of 58 collections and
  indexed four fields that no longer existed.
- **After adding an index, run `db:create-indexes`.** Otherwise it exists only
  in code. `verify:indexes:strict` is the CI gate that catches this.
- **Reuse the existing index name** when a key pattern is already live under an
  `idx_*` name. MongoDB rejects the same key pattern under a second name
  (`IndexOptionsConflict`), so omitting the name and letting Mongoose generate
  one makes creation fail.
- **Never mix `sparse` with `partialFilterExpression`** — MongoDB rejects the
  index outright and it silently never builds. Use `partialFilterExpression`
  alone.
- **Scope a TTL whenever the collection holds more than one kind of record.** A
  bare `expireAfterSeconds` deletes _every_ document past the date field,
  including ones that are permanent history. `organizationinvitations` was
  deleting `accepted` invitations — the record of who was granted org access —
  along with lapsed `pending` ones. The fix is a `partialFilterExpression`
  naming the transient statuses only (`$in` needs MongoDB 6.0+). Changing that
  filter later requires drop-and-recreate, so it needs a migration:
  `scripts/migrations/scope-invitation-ttl.ts`.
- **Dropping is always manual.** `create-indexes` only adds. Check
  `db:audit-indexes` for real usage first.

### `required: true` does nothing for documents already written

`required` is a **write** validator. It rejects a bad `save()`; it says nothing
about what is already in the collection. So adding a required field to a schema
that already has documents leaves every one of them without that key, and
`.toLocaleString()`, `.map()` or `.length` on it throws.

That is not theoretical: `seasonBagTarget` on `VotingCycle` was
`@Prop({ required: true })` with no default, and one legacy cycle took the whole
admin voting page down — React unmounted the route, so nobody could open the
screen at all.

- **Give the prop a `default`.** Mongoose hydrates a missing path from the
  default on read, which makes every future read safe. Without one there is
  nothing to hydrate from. `minimumBags` and `recipientCount` sit in that same
  schema and were never affected, precisely because they declare defaults.
- **A default does not touch stored documents.** It fixes reads from then on;
  the rows already written still need a backfill migration — see
  `scripts/migrations/backfill-season-bag-target.ts`.
- **Find the real ones before writing migrations.** A static sweep of the source
  finds 272 required-without-default props across 58 schemas, nearly all
  harmless. Only the database knows which are actually absent:

```bash
pnpm --filter @foodwaste/backend audit:missing-required            # every model
pnpm --filter @foodwaste/backend audit:missing-required -- --model=VotingCycle
```

- **Do not let the frontend type claim more than the API delivers.** The web
  `VotingCycleRow` declared these counters as plain `number`, so nothing had to
  handle their absence. Marking them optional turned the compiler into the
  search and surfaced fourteen unguarded reads, six of them in components that
  had not crashed _yet_. Read counts through `formatCount` from `@/lib/format`.

### Embedded arrays — cap them or move them out

An array that grows per event has two valid shapes. Pick one; never leave it
unbounded, because the 16 MB document limit is a hard failure and it arrives
without warning.

**1. Cap it** (for short, bounded history that is read with its parent).
`document-limits.constant.ts` holds the caps (`USER_AUDIT_LOG_MAX`, etc.). Every
write site must apply one **atomically** — `$push` with `$slice` in a single
`updateOne`, never read-modify-`save()`. The read-modify-write form loses
entries when two requests interleave, which for `loginHistory` is a real
scenario (one person, two devices). Covered by
`users/test/session-create-history.spec.ts`.

**2. Move it to its own collection** (for append-only trails, anything needing a
retention policy, or anything not read with its parent). A TTL cannot be applied
to an embedded array — that alone forces this shape for audit data. Examples:
`moderation_action_audit`, `sms_opt_out_audit`, both with `{ parentId, when }`
indexes and a 2-year TTL.

When extracting, three things are easy to get wrong:

- **Grep for `$push` too, not just `.arrayName`.** A raw
  `$push: { auditLog: … }` inside an `updateOne` does not match `\.auditLog`,
  and once the field leaves the schema Mongoose's strict mode **silently
  discards the write** — no error, no type error. Four such sites existed in
  `opt-out-manager.service.ts`.
- **Write the audit row after the parent save, never before.** They are separate
  writes now, so auditing first records events that never happened. Log and
  swallow a failed audit write; do not fail the user's operation for it.
- **Batch the reads.** A trail that was free to read (already embedded) becomes
  a query. Resolve a whole page with one `$in` and look up from a `Map` — see
  `fetchAuditByRecord`. Fetching per row inside a `.map()` is an N+1, and the
  bulk opt-out path runs up to 1000 rows.

### Never put the viewer's id in a cache key

A cache key containing `userId` is not a cache — it is N private caches, and it
stops working at exactly the scale you built it for. A session here is "open the
app, browse, leave", which ends long before a 60–120s TTL can be reused, so the
hit rate collapses toward zero as users grow. Two second-order costs come free
with it: Redis holds N near-identical copies, and every `delByPrefix`
invalidation has to SCAN all of them.

Both discovery lists had this. Split the payload instead:

- **Cache what every viewer shares** — the aggregation result, keyed only by
  `(page, limit)` and whatever genuinely changes the query.
- **Compute the per-viewer fields per request** — `isFavorite` from one indexed
  favourites read, `distance` from arithmetic. Microseconds against a
  multi-stage `$lookup`.

See `CachedOfferPage` and `personalizeOfferPage` in `offers.service.ts`.

- **Key on the _effective_ limit, not the requested one.**
  `Math.min(limit, 100)` belongs in the key, or an attacker mints unbounded
  entries in front of the most expensive query in the product.
- **Check whether "it varies per user" is actually true.** `getUrgentOffers`
  skipped the cache entirely whenever a location was passed, on that reasoning —
  but the pipeline neither filters nor sorts on location, so only a decorated
  `distance` differed. The hottest path in the app was uncached for a reason
  that did not hold. Read the pipeline before believing the comment.
- **`OfferCardDto` carries no coordinates on purpose** (privacy). Distance is
  recomputed from a `coordinates` map cached _beside_ the cards, never by adding
  the address to the DTO.
- **Personalisation must not mutate the cached page.** Today that is defensive —
  `CacheService.set()` snapshots before personalising, and hits are fresh
  `JSON.parse`s. It becomes load-bearing the moment anything holds a page in
  process (an LRU in front of Redis, single-flight coalescing of concurrent
  misses), at which point in-place mutation leaks one user's `isFavorite` to
  everyone. Asserted directly in `discovery-cache-sharing.spec.ts`, since no
  cache shape can demonstrate the consequence yet.

### Backend process model — three numbers that multiply

Node runs one thread, so how the backend is _started_ bounds everything the
query layer does well. The container runs **PM2 in cluster mode**
(`ecosystem.config.js`, started by `pm2-runtime` — plain `pm2 start` daemonises
and exits, which a container reads as a crash). It previously ran
`node dist/main.js`: one core, with all HTTP, 29 `@Cron` jobs and every Bull
processor on one event loop, so a heavy analytics rollup blocked checkout for
its whole runtime.

**`PROCESS_ROLE`** (`src/config/process-role.ts`) decides whether a process runs
scheduled work — `api` | `worker` | `all`, gated centrally inside
`CronLockService.runExclusive`, so it covers all 29 jobs and cannot be forgotten
on a new one.

- **Default is `all`, and must stay that way.** Setting `api` without a `worker`
  process beside it means _no_ scheduled job runs — payouts, order expiry, trial
  expiry all stop — and the service still reports healthy. Split only in pairs.
- **This is not what makes crons safe.** The Redis lock is. The role gate only
  stops API replicas from waking up to lose a lock race they should not enter.

**Sizing is detected, not hardcoded.** `src/config/container-resources.ts` reads
the cgroup CPU and memory limits, so one image is correct on a free 0.1-CPU
instance and on an 8-core paid one. Changing plan is a dashboard action.

- **`os.cpus()` lies inside a container** — it reports the _host's_ cores, not
  this container's share. PM2's `instances: 'max'` is built on it, which is why
  it is never used here: on a 16-core host with a 0.5-CPU limit it forks 16
  workers to fight over half a core, and opens 16× the Mongo pool.
- **Below two whole CPUs the detector returns 1.** Cluster mode there costs
  memory and gains nothing.
- **`--max-old-space-size` must fit the container, divided by worker count.**
  Promise V8 more heap than the cgroup allows and the kernel `SIGKILL`s the
  process — no graceful shutdown, every in-flight request dropped. A hardcoded
  `2048` on a 512 MB instance is a scheduled crash, not a tuning choice.
- **Never bake `WEB_CONCURRENCY` into the Dockerfile.** An explicit value always
  wins over detection, so setting it there disables the whole mechanism
  everywhere.

**Render is defined in `render.yaml`** (Blueprint) — both the `web` API service
and the `worker` service, sharing one env group. Free tier cannot run a
background worker at all, and free web services spin down after ~15 min idle,
which stops every cron with them: they are in-process timers, so those ticks are
lost, not deferred.

**Three settings multiply into one number**, and exceeding the database's
connection limit takes the API down:

```
total Mongo sockets = MONGO_MAX_POOL_SIZE × WEB_CONCURRENCY × replicas
```

`MONGO_MAX_POOL_SIZE` is **per process**, not per service. At the default 100 on
an 8-core host, one container opens 800 sockets. `WEB_CONCURRENCY` is set
explicitly rather than PM2's `instances: 'max'` precisely so the core count
stays visible in that formula.

The same arithmetic bounds queue concurrency
(`common/constants/queue-concurrency.constant.ts`): every `@Process()` without
options runs **one job at a time**, which is what made notification delivery
serial system-wide. Concurrency is now declared per queue and env-overridable,
sized for I/O-bound work — but `sum(concurrency) × processes` draws from the
same pool, so a queue burst that outgrows it starves HTTP handlers and presents
as an unexplained API outage.

---

## Known Issues

- iOS builds require macOS with Xcode — require explicit confirmation.
- Shared package changes require Metro cache reset: `pnpm metro:reset`.
- `src/store/rehydrationOrchestrator.ts` has pre-existing TS errors (JSX in .ts
  file).
- Delivery is implemented (see "Delivery & the driver role" above). The old
  `DELIVERY_SYSTEM_ANALYSIS.md` this section used to point at no longer exists.
- Mobile Android: `edgeToEdgeEnabled=true` is set in `android/gradle.properties`
  and `<StatusBar>` usages must never pass `translucent`/`backgroundColor`
  (they're no-ops under edge-to-edge and trigger RN's deprecated
  `Window.setStatusBarColor()` path). Google Play Console may still flag
  `WindowUtilKt.enableEdgeToEdge` / `StatusBarModule.getTypedExportedConstants`
  as using deprecated edge-to-edge APIs — that's baked into the React Native
  0.81.0 framework AAR itself (not app code) and unresolved upstream as of this
  writing. Tracked at
  https://github.com/react-native-community/upgrade-support/issues/364.

---

## Verification Gates

Run these after **every change** before reporting complete. Never claim a fix is
done without running the relevant check.

| Scope of change          | Command to run                                         |
| ------------------------ | ------------------------------------------------------ |
| Backend only             | `pnpm --filter @foodwaste/backend check:ts`            |
| Web only                 | `pnpm --filter @foodwaste/web type-check`              |
| Mobile only              | `pnpm --filter @foodwaste/mobile type-check`           |
| `packages/shared` change | `pnpm build:deps` → then `pnpm metro:reset` for mobile |
| Before any PR (backend)  | `pnpm --filter @foodwaste/backend check:all`           |
| Cross-app change         | `pnpm type-check` (full monorepo)                      |
| Any `*.schema.ts` index  | `verify:indexes:strict`, then `db:create-indexes`      |
| Any `package.json` edit  | `pnpm check:lockfile`                                  |

`check:ts` covers `scripts/` as well as `src/` and `test/`. Do not narrow that
`include` — migration and index scripts run against production, and while they
sat outside the type-check project one shipped that could not compile at all.

### A manifest edit is not done until the lockfile is regenerated

Nothing you run locally reads `pnpm-lock.yaml`. Type-checks, tests and even a
full `pnpm --filter @foodwaste/web build` all run against a `node_modules` that
is **already installed**, so a `package.json` edited without a matching lockfile
update passes every one of them. CI and Vercel install with `--frozen-lockfile`,
compare specifiers, and fail before a single line is compiled — after the push.

That is how `db2ea3ca` shipped: `@testing-library/jest-dom` was dropped from
`apps/web/package.json` while the lockfile's `apps/web` importer kept it, and
the commit's own verification (knip, three type-checks, 1067 + 108 tests, a web
build) could not see it.

```bash
pnpm check:lockfile   # resolution only, no node_modules written, ~1s
pnpm fix:lockfile     # regenerate after a manifest edit, then `git add` it
```

- **Never reach for `--no-frozen-lockfile`** to get a deploy through. It makes
  the deployed tree differ from the committed lockfile, which is the problem the
  lockfile exists to prevent.
- **Commit the manifest and the lockfile together.** Split across two commits,
  the first one is unbuildable — and `git bisect` lands on it.
- **A lockfile can drift without any manifest edit in your diff.** A rebase or a
  merge resolved by taking one side of `pnpm-lock.yaml` yields a lockfile
  matching neither manifest, which is why the `pre-push` hook checks
  unconditionally rather than only when a `package.json` is staged.
- **Expect peer-suffix churn in the diff.** Adding one root devDependency that
  pulls `ts-node`/`@swc/core` rewrites every `jest@29.7.0(...)` key in the file.
  It is noise, not a version change — confirm by filtering it out and reading
  what is left.

---

## Scenario Coverage — Required Before Completing Any Task

Before marking any task done, explicitly verify behavior for all relevant actor
variants. Do not assume the happy path covers all users.

| Domain                   | Variants to check                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| **Auth flows**           | `authProvider`: local / google / facebook / apple — see `.claude/rules/auth-scenarios.md` |
| **User-facing features** | `isEmailVerified`, `isActive`, `role` (consumer / merchant / admin / moderator)           |
| **Offers / Orders**      | `status` transitions — every terminal state must be handled, not just the success path    |
| **Payments**             | success / failure / timeout / webhook-received-twice (idempotency)                        |
| **Notifications**        | user has notifications disabled / device token missing / locale is Arabic (RTL)           |

If a variant reaches an unhandled code path, either handle it explicitly or
document it as a known limitation in this file — never leave it silent.

---

## Completeness Protocol — Apply to Every Change

Before reporting any task as done, verify these. No exceptions.

### 1. Trace every dependency chain

When you add, rename, or remove anything (field, type, endpoint, translation
key, config var), **grep the entire repo** for all references. Update every
consumer — not just the file you're editing. If something is renamed, zero
matches for the old name must remain.

### 2. Follow existing patterns exactly

Before writing new code, read 2-3 existing examples of the same pattern in the
codebase (queries, service calls, error handling, component structure). Match
them exactly — don't invent a new way to do the same thing.

### 3. Every user-facing path must be covered

For every action gated by a condition (auth, subscription, role, approval
status), identify **all code paths** that allow that action and gate every one.
Don't assume there's only one entry point — grep for the action and check each
call site.

### 4. No technical text reaches the user

Error messages, exceptions, status codes, and stack traces must never appear in
the UI. Every `catch` block that surfaces to the user must show a translated,
human-readable message. Test the error path, not just the happy path.

### 5. Translations are atomic

Adding or modifying a translation key is a single atomic operation across all
locale files and all registration points (namespace arrays in layouts). Never
add a key to one locale without the others.

### 6. Performance by default

- Queries: only select fields you need (`.select()` / `.lean()`)
- Components: avoid re-renders — memoize expensive computations, split state
- API calls: never fetch data you already have in cache; use TanStack Query
  invalidation
- Avoid N+1 queries — batch or populate in a single call

### 7. DRY at the right level

Extract shared logic only when:

- The same code appears 3+ times with the same shape
- A value is used in multiple places (make it a constant)
- A pattern has a bug — centralizing prevents fixing it in one place and missing
  the others

Don't extract prematurely — three similar lines are better than a premature
abstraction that obscures intent.

### 8. Self-review before reporting done

After making changes, re-read every modified file as if reviewing someone else's
PR. Check: unused imports, dead code, inconsistent naming, missing error
handling, hardcoded values that should be constants or translations.

---

## Hard Rules — Never Do These

1. **Never enable `@nestjs/swagger` CLI plugin** in `nest-cli.json` — it
   resolves `@foodwaste/shared` imports to broken relative paths at runtime.
2. **Never use `AbortController`** for fire-and-forget POST hooks — cleanup will
   abort the in-flight request mid-execution.
3. **Never store tokens** outside of HttpOnly cookies (web) or Keychain
   (mobile). localStorage, Redux, MMKV, and sessionStorage are forbidden for
   auth tokens.
4. **Never use raw hex values** in components — use Tailwind tokens or CSS
   variables only.
5. **Never use relative imports** to workspace packages in the backend — always
   `@foodwaste/shared`, never `../../../packages/shared/...`.
6. **Never pass `val | undefined`** to optional object props. Config has
   `exactOptionalPropertyTypes: true`. Use conditional spread instead:
   ```typescript
   // BAD
   updateUser({ firstName: undefined });
   // GOOD
   updateUser({ ...(firstName ? { firstName } : {}) });
   ```

---

## TypeScript Gotchas

### Mongoose `@Prop()` with union types

`reflect-metadata` emits `Object` for union types — Mongoose cannot infer the
right type. Always add explicit `type:` when the TS type is a union:

```typescript
// BAD — crashes at runtime (CannotDetermineTypeError)
@Prop()
expiresAt?: Date | undefined;

// GOOD
@Prop({ type: Date })
expiresAt?: Date | undefined;

@Prop({ type: String })
notes?: string | undefined;
```

### Backend response envelope access

All endpoints return `{ status, message, data: T, meta? }`.

- **Mobile**: always use `unwrapBackendResponse(response)` — never `.data.data`
  directly
- **Web**: access as `response.data.data` for the payload, `response.data.meta`
  for pagination
- `meta` lives on `response.data.meta`, NOT inside `response.data.data`

---

## Web Layout Rules

### Dashboard scroll containment (admin + merchant layouts)

Use `fixed inset-0` on the outermost wrapper — **not** `h-screen`. `h-screen`
causes a double-scrollbar bug when content is tall (body scrolls AND main
scrolls, header disappears).

```tsx
<div className='fixed inset-0 flex flex-col bg-background'>
  <Header /> {/* shrink-0 */}
  <div className='flex flex-1 min-h-0 overflow-hidden'>
    <Sidebar />
    <main className='flex-1 overflow-y-auto overscroll-contain min-h-0'>
      {children}
    </main>
  </div>
</div>
```

Diagnostic: if a Radix dropdown causes an outer scrollbar to disappear, the body
is scrolling — you have a containment bug.

---

## OpenAPI Type Generation

When backend API shapes change, regenerate types (requires backend running on
`localhost:3000`):

```bash
cd packages/shared
pnpm generate          # fetch spec + generate in one step
# or separately:
pnpm spec:fetch        # saves openapi.json
pnpm spec:generate     # generates api.generated.ts (17k+ lines)
```

Always use generated types — never write manual types for API request/response
shapes:

```typescript
import type { ApiSchemas } from '@foodwaste/shared';
type LoginDto = ApiSchemas['LoginDto'];
type CreateOfferDto = ApiSchemas['CreateOfferDto']


for error : always when we get error  do this steps :
 Error
 ↓
Observe
 ↓
Reproduce
 ↓
Trace
 ↓
Understand root cause
 ↓
Fix
 ↓
Prevent recurrence
```
