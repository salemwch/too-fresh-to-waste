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

4. Use Cases
For every important action define:
- Who performs it?
- What triggers it?
- What inputs are required?
- What validations happen?
- What is the expected result?
- What errors can occur?

5. Workflows
Define complete lifecycle flows:

Example:
Created
↓
Approved
↓
Processing
↓
Completed

Include:
- Normal flow
- Failure flow
- Cancellation flow
- Recovery flow

6. State Management
For every important entity define:
- Possible states
- Allowed transitions
- Forbidden transitions

Example:

Order:
PENDING → CONFIRMED → COMPLETED

Forbidden:
COMPLETED → PENDING

7. Edge Cases
Think about abnormal situations:

- Duplicate actions
- Network failure
- Payment failure
- User cancellation
- Missing data
- Race conditions
- Fraud attempts

8. Constraints
Define technical and business limits:

- Quantity limits
- Time limits
- Permission limits
- Geographic limits
- Financial limits

9. Domain Events
Identify important events:

Example:

OrderCreated
PaymentCompleted
PickupConfirmed
FoodExpired

Define:
- What triggers the event?
- Who needs to react?
- What data is included?

10. Data Requirements
Before database design:

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
pnpm type-check                # TypeScript check
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
Moderation, Admin, WebSocket, Search, Archive, Health.

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

### Data Fetching

- Mobile: `useQueryWithFocus` for screen-level queries (refetch on focus)
- Web: TanStack Query with centralized `dashboardKeys` factory + WebSocket cache
  patching

---

## Known Issues

- iOS builds require macOS with Xcode — require explicit confirmation.
- Shared package changes require Metro cache reset: `pnpm metro:reset`.
- `src/store/rehydrationOrchestrator.ts` has pre-existing TS errors (JSX in .ts
  file).
- Delivery system: NOT IMPLEMENTED — pickup-only. See
  `DELIVERY_SYSTEM_ANALYSIS.md`.
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
| Backend only             | `pnpm --filter @foodwaste/backend type-check`          |
| Web only                 | `pnpm --filter @foodwaste/web type-check`              |
| Mobile only              | `pnpm --filter @foodwaste/mobile type-check`           |
| `packages/shared` change | `pnpm build:deps` → then `pnpm metro:reset` for mobile |
| Before any PR (backend)  | `pnpm --filter @foodwaste/backend check:all`           |
| Cross-app change         | `pnpm type-check` (full monorepo)                      |

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