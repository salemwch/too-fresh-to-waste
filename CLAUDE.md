# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

Too Fresh To Waste - Production-ready food waste reduction marketplace monorepo
with React Native mobile app and NestJS backend.

**Stack:** Node.js 24.11.1 | pnpm 10.17.0 | TypeScript 5.8-5.9 | Turborepo 2.6.1

## Commands

### Development

```bash
pnpm install                # Install all dependencies (runs husky + builds shared)
pnpm dev                    # Start Metro bundler + backend dev servers
pnpm backend:dev            # Backend API only (watch mode)
pnpm mobile:dev             # Mobile Metro only
pnpm mobile:android         # Run Android app
pnpm mobile:ios             # Run iOS app (macOS only)
```

### Quality Checks

```bash
pnpm lint                   # ESLint across monorepo
pnpm lint:fix               # ESLint autofix
pnpm type-check             # TypeScript validation (builds shared first)
pnpm test                   # Run all tests
pnpm test:ci                # CI mode with coverage
```

### Build & Production

```bash
pnpm build                  # Build all packages
pnpm backend:build          # Build backend for production
pnpm backend:start          # Run production backend
pnpm prepare-release        # Full pre-release validation (build + test + security)
```

### Package-Scoped Commands

```bash
pnpm backend <cmd>          # Run command in @foodwaste/backend
pnpm mobile <cmd>           # Run command in @foodwaste/mobile
pnpm shared <cmd>           # Run command in @foodwaste/shared
```

### Android Direct Commands (CI/CD)

```bash
pnpm dev:android            # Gradle assembleDebug
pnpm dev:android:clean      # Gradle clean
pnpm dev:android:release    # Gradle assembleRelease
pnpm dev:metro              # Metro with cache reset
```

## Architecture

```
apps/
├── food-waste-backend/     # NestJS 11 API (MongoDB, Redis, Bull queues)
│   └── CLAUDE.md           # Backend-specific guidance
├── mobile/                 # React Native 0.81 (Redux, TanStack Query, React Navigation)
│   └── CLAUDE.md           # Mobile-specific guidance
packages/
└── shared/                 # @foodwaste/shared - utilities, types, API client
```

### Backend (apps/food-waste-backend)

NestJS modular architecture with feature-based organization:

- `src/auth/` - JWT auth, MFA, password policies, sessions, CSRF
- `src/users/` - User profiles, roles, privacy compliance
- `src/orders/` - Order state machine (xstate), payments
- `src/offers/` - Surplus food listings
- `src/establishments/` - Merchant management
- `src/notifications/` - Push (Firebase) + SMS (Twilio)
- `src/common/` - Guards, filters, interceptors, middleware

API versioning: `/api/v1/...` | Swagger: `http://localhost:3000/api/v1/api-docs`

### Mobile (apps/mobile)

Provider hierarchy:
`GestureHandlerRootView → SafeAreaProvider → Redux → PersistGate → QueryProvider → ThemeProvider → RootNavigator`

- `src/design-system/` - Atomic design (atoms/molecules/organisms) with tokens
- `src/features/` - Vertical feature slices (auth, orders, offers, profile,
  etc.)
- `src/navigation/` - State-driven auth routing via `AuthFlowState` enum
- `src/store/` - Redux Toolkit + redux-persist
- `src/services/` - API clients, biometric auth, secure storage

### Shared Package

Import as `@foodwaste/shared` - builds from source for hot reloading.

## Path Aliases

```typescript
// From anywhere
import { ApiClient } from '@foodwaste/shared';

// Mobile app
import { Button } from '@/design-system';
import { LoginScreen } from '@/features/auth/screens';
import { useAuth } from '@/hooks/useAuth';

// Backend
import { AuthService } from 'src/auth/auth.service';
```

## Git Workflow

**Conventional Commits** enforced via commitlint:

```
feat(scope): description   # New feature
fix(scope): description    # Bug fix
docs, style, refactor, perf, test, build, ci, chore, security, deps
```

**Pre-commit hooks** (Husky + lint-staged): ESLint fix → Prettier → tsc → Jest
on related files

## Key Patterns

### Request Flow (Backend)

1. CorrelationIdMiddleware (tracing)
2. GlobalSanitizationMiddleware (XSS prevention)
3. Helmet (security headers)
4. CORS (whitelist-based)
5. ValidationPipe (class-validator DTOs)
6. Guards chain: JwtAuthGuard → RolesGuard → PermissionsGuard →
   ResourceOwnershipGuard

### State Management (Mobile)

- **Redux Toolkit** - Global state, auth persisted to AsyncStorage
- **TanStack Query** - Server state (API data fetching/caching)
- **React Hook Form + Yup** - Form state and validation

### Navigation (Mobile)

State-driven by `AuthFlowState`:

- `AUTHENTICATED` → MainStack
- `UNAUTHENTICATED` → Login
- `EMAIL_VERIFICATION_PENDING` → VerifyEmail
- `PHONE_VERIFICATION_PENDING` → VerifyPhone
- `MFA_REQUIRED` → MFA screen

## Environment

Backend: Copy `.env.example` to `.env` in `apps/food-waste-backend/`

- `DATABASE_URL`, `REDIS_HOST/PORT/PASSWORD`, `JWT_SECRET`,
  `JWT_REFRESH_SECRET`, `SENTRY_DSN`

Mobile: Uses `react-native-config` with `.env` files

- `API_BASE_URL`, `WEBSOCKET_URL`, `ENVIRONMENT`

## Known Issues

- `src/reviwes/` folder has typo (should be `reviews`)
- `src/proccessors/` folder has typo (should be `processors`)
- iOS builds require macOS with Xcode + `pod install`
- Android builds require JDK 17+ and Android SDK
- Shared package changes may require Metro cache reset:
  `pnpm mobile metro:reset`

## Monitoring

Backend health endpoints:

- `GET /health` - Full health check (DB + Redis + memory)
- `GET /health/liveness` - K8s liveness probe
- `GET /health/readiness` - K8s readiness probe
- `GET /metrics` - Prometheus metrics
