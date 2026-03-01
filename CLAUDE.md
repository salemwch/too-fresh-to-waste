# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Too Fresh To Waste** — Food waste reduction marketplace.
Monorepo: `apps/mobile` (React Native 0.81) + `apps/food-waste-backend` (NestJS 11) + `packages/shared`.
**Node**: 24.11.1 | **pnpm**: 10.17.0 | **Turborepo**: 2.6

---

## Commands

### Root (run from `C:\WFA`)

```bash
pnpm install                   # Install all workspace deps
pnpm build:deps                # Build shared package first (required before mobile/backend)
pnpm build                     # Build all apps via Turborepo
pnpm dev                       # Start Metro + NestJS concurrently (Turborepo persistent)
pnpm lint / pnpm lint:fix      # ESLint across entire monorepo
pnpm type-check                # tsc --noEmit across all apps
pnpm test / pnpm test:ci       # Jest across monorepo (test:ci adds coverage)
pnpm clean                     # Remove dist/, .turbo, Metro cache

# Scoped shortcuts
pnpm --filter @foodwaste/mobile <script>
pnpm --filter @foodwaste/backend <script>
```

### Mobile (`apps/mobile`)

```bash
pnpm dev                       # Metro bundler
pnpm dev:android               # Run on Android device/emulator
pnpm dev:ios                   # Run on iOS simulator (macOS only)
pnpm metro:reset               # Metro with cache cleared
pnpm type-check                # TypeScript check (no emit)
pnpm test / test:watch         # Jest + RTL
pnpm build:android:debug       # Debug APK → android/app/build/outputs/apk/debug/
pnpm build:android:release     # Release APK
pnpm bundle:android            # JS bundle for distribution
pnpm clean                     # Full clean (Metro + Gradle)
pnpm android:clean             # Gradle clean only
```

### Backend (`apps/food-waste-backend`)

```bash
pnpm dev                       # NestJS watch mode
pnpm build                     # Compile to dist/
pnpm start:prod                # Run compiled app
pnpm type-check                # TypeScript check
pnpm lint / pnpm lint:fix      # ESLint
pnpm test                      # Jest
pnpm test:unit                 # Unit tests only
pnpm test:integration          # Integration tests
pnpm test:ci                   # CI mode with coverage
pnpm check:all                 # ts + lint + format + test + docs (full gate)
pnpm seed:admin                # Seed initial admin user
pnpm verify:indexes            # Validate MongoDB indexes
pnpm deps:graph                # Visualize module dependency graph
```

---

## Architecture

### Monorepo Layout

```
C:\WFA/
├── apps/
│   ├── mobile/                # @foodwaste/mobile — React Native
│   └── food-waste-backend/    # @foodwaste/backend — NestJS
├── packages/
│   └── shared/                # @foodwaste/shared — shared types/enums
├── turbo.json                 # Task pipeline + Turborepo caching
├── pnpm-workspace.yaml
└── tsconfig.base.json         # Strict TS, path aliases
```

**`packages/shared` must be built (`pnpm build:deps`) before starting mobile or backend.**

### Path Aliases

Defined in `tsconfig.base.json`, `babel.config.js`, and `metro.config.js`:

```typescript
import { Foo } from '@foodwaste/shared';   // packages/shared/src
import { Foo } from '@/services/api';      // apps/mobile/src/services/api
```

Backend uses relative imports, not path aliases.

---

### Mobile — `apps/mobile/src/`

**Provider hierarchy** (App.tsx):
```
GestureHandlerRootView → SafeAreaProvider → ReduxProvider → PersistGate (MMKV)
  → QueryProvider (TanStack) → ThemeProvider → RootNavigator → Toast
```

**Navigation** is driven by `AuthFlowState` enum in Redux (`store/authSlice`):

| AuthFlowState | Renders |
|---|---|
| `AUTHENTICATED` | MainStack → BottomTabs |
| `UNAUTHENTICATED` | AuthStack → Login |
| `EMAIL_VERIFICATION_PENDING` | AuthStack → VerifyEmail |
| `PHONE_VERIFICATION_PENDING` | AuthStack → VerifyPhone |
| `MFA_REQUIRED` | AuthStack → MFAVerification |
| `SESSION_EXPIRED` | AuthStack → Login (with message) |

**Stack structure:**
```
RootNavigator
├── AuthStack       (Welcome, Login, Register, ForgotPassword, ResetPassword,
│                    VerifyEmail, VerifyPhone, MFAVerification)
└── MainStack       (modal-style screens + BottomTabNavigator)
    └── BottomTabs
        ├── HomeStack
        ├── SearchStack
        ├── FavoritesStack
        ├── OrdersStack     ← OrdersList → OrderDetails (nested; NOT in MainStack)
        └── ProfileStack    ← ProfileMain → EditProfile
```

> **Critical**: `OrderDetails` lives inside `OrdersStack`. Navigate to it from outside
> via `CommonActions.reset` with nested state — do not add it to `MainStack`.

**State management:**
- **Redux Toolkit** (`store/`): `authSlice`, `locationSlice`, `favoritesSlice`
- **Persistence**: MMKV (encrypted, 10-100× faster than AsyncStorage) — UI cache
- **Authoritative secrets**: React Native Keychain — tokens + user profile
- **Server state**: TanStack Query v5 — all API data fetching
- **Auth session middleware**: Proactively refreshes tokens before expiry; auto-logout on expired tokens
- **Forms**: React Hook Form + Yup/Zod

**Feature module layout** (vertical slice):
```
features/<name>/
├── screens/
├── components/
├── hooks/
├── services/     # API calls
├── store/        # Redux slice (if needed)
└── types/
```

**Design system** (`design-system/`):
- Atomic design: tokens → atoms → molecules → organisms
- `import { Button, Text, Card, useTheme } from '@/design-system'`
- Typography variants: `display.large`, `headline.medium`, `body.medium`, `label.small`
- Button variants: `primary | secondary | tertiary | ghost | outline | danger | success`
- Test helper: `renderWithTheme(<Component />)` from `@/design-system/setupTests`

**Storage layer:**
- `react-native-keychain` — access/refresh tokens, user profile (source of truth)
- MMKV — warm UI cache, Redux persist backend
- `react-native-fast-image` — disk-cached network images

---

### Backend — `apps/food-waste-backend/src/`

**Bootstrap order** (`main.ts`): Sentry → HTTPS → Filters → Interceptors → URI versioning (`/api/v1/...`) → Helmet CSP → CORS → ValidationPipe → Swagger (`/api/v1/api-docs`) → Redis IO adapter → graceful shutdown.

**Module map** (`app.module.ts`):
```
AuthModule, UsersModule, EstablishmentsModule, OffersModule,
OrdersModule, PaymentModule, ReviewsModule, NotificationsModule,
GeolocationModule, FavoritesModule, DonationsModule, LoyaltyModule,
InventoryModule, AnalyticsModule, ModerationModule, AdminModule,
WebSocketModule, SearchModule, ArchiveModule, HealthModule
```

Global middleware: `CorrelationIdMiddleware` (request tracing) + `GlobalSanitizationMiddleware` (XSS prevention).

**MongoDB** (enterprise config):
- Pool: maxPoolSize=100, minPoolSize=10
- Compression: zstd primary, snappy/zlib fallback
- Write concern: `w:'majority'` + journaling in production
- Read concern: `level:'majority'`

**Redis**: Rate limiting (ThrottlerModule) + Bull job queues + Socket.IO pub/sub adapter.

**Response envelope** (all endpoints):
```typescript
{ status: 'success' | 'error', message: string, data: T, meta?: { page, total, limit } }
```
Mobile uses `unwrapBackendResponse()` to extract `data`. Access `meta` directly via `response.data.meta` (typed as `PaginationMeta | undefined`).

---

## Key Domain Patterns

### Order Expiration
- `expiresAt = offer.availableUntil + 30 min` (constant: `ORDER_GRACE_PERIOD_MS = 30 * 60 * 1000`)
- Pickup code validity = `order.expiresAt`
- Mobile disables pickup input client-side when `expiresAt` is past
- Fields exposed in: `ORDER_LIST_FIELDS`, `ORDER_DETAIL_FIELDS`, response DTOs

### Establishment Population
`order.establishmentId` can be a `string` OR a populated object. Always use:
```typescript
getEstablishmentName(order.establishmentId)
getEstablishmentImage(order.establishmentId)
```

### User Profile Image
Two fields exist: `avatar` (legacy) + `profileImage` (newer). Resolution: `profileImage > avatar > null`.
After upload, persist to **Keychain** (not Redux-only — stale after restart).

### Loyalty
- Active action: "Save a Bag" (+10 pts); others show "Coming Soon"
- `totalBagsSaved` schema field tracks bags; `totalOrdersCount` tracks orders
- `addPoints()` only increments counters when `orderId` is present
- `useLoginStreak` fires on `LoyaltyScreen` mount — fire-and-forget POST, **no AbortController**

### Skeleton / Loading UI
Use `Animated` + `LinearGradient` shimmer pattern (see `SkeletonOfferCard`).

### Data Fetching Hooks
Use `useQueryWithFocus` for screen-level queries that should refetch when the screen regains focus.

---

## Known Issues

- iOS builds require macOS with Xcode — all iOS changes need explicit confirmation.
- Shared package changes require Metro cache reset: `pnpm clean:metro` or `pnpm metro:reset`.
