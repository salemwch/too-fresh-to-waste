# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Too Fresh To Waste - NestJS v11 backend API for a food waste reduction marketplace platform. Monorepo member (`@foodwaste/backend`) with shared packages at `../../packages/shared`.

**Stack:** Node.js 24.11.1 | pnpm 10.17.0 | TypeScript 5.9 | MongoDB 6.18 (Mongoose 8.18) | Redis 5.8 | Bull queues

## Build & Development Commands

```bash
# Development
pnpm dev                    # Start with watch mode
pnpm start:debug            # Debug with watch mode

# Build & Production
pnpm build                  # Compile TypeScript
pnpm start:prod             # Run compiled dist/main.js

# Quality Checks (run before commits)
pnpm check:all              # Full suite: TypeScript + ESLint + Prettier + tests + docs
pnpm check:ts               # TypeScript compilation check (tsc --noEmit)
pnpm check:lint             # ESLint validation
pnpm check:format           # Prettier check

# Testing
pnpm test                   # Run all tests
pnpm test:unit              # Unit tests (*.spec.ts)
pnpm test:integration       # Controller tests
pnpm test:e2e               # E2E tests (60s timeout, separate jest config)
pnpm test:cov               # Generate coverage report
pnpm test:watch             # Watch mode for TDD

# Database
pnpm seed:admin             # Create initial admin user
pnpm verify:indexes         # Verify MongoDB indexes
pnpm migration:normalize-phones          # Dry run phone normalization
pnpm migration:normalize-phones:execute  # Execute phone normalization
```

## Architecture

### Module Structure

The app uses NestJS modular architecture with feature-based organization:

```
src/
├── main.ts                 # Bootstrap with Sentry, Helmet, CORS, Swagger
├── app.module.ts           # Root module with middleware configuration
├── auth/                   # JWT auth, MFA, password policies, sessions
├── users/                  # User profiles, roles, privacy compliance
├── establishments/         # Restaurant/merchant management
├── offers/                 # Surplus food listings
├── orders/                 # Order processing (state machine via xstate)
├── payments/               # Payment processing (SMT Tunisia)
├── reviwes/                # Reviews (note: typo in folder name)
├── notifications/          # Push (Firebase) + SMS (Twilio)
├── geolocation/            # Nominatim-based location services
├── analytics/              # Business intelligence + enhanced analytics
├── admin/                  # Admin operations
├── common/                 # Shared utilities, guards, filters, interceptors
├── health/                 # K8s liveness/readiness probes at /health/*
└── redis/                  # Shared Redis connection pool
```

### Request Flow

1. **CorrelationIdMiddleware** - Generates unique request IDs for tracing
2. **GlobalSanitizationMiddleware** - Sanitizes all input (XSS prevention)
3. **Helmet** - Security headers (CSP, HSTS, X-Frame-Options)
4. **CORS** - Whitelist-based origin validation
5. **ValidationPipe** - class-validator DTOs with whitelist mode
6. **Guards** - JwtAuthGuard → RolesGuard → PermissionsGuard → ResourceOwnershipGuard
7. **Business Logic**

### API Versioning

All endpoints use URI versioning: `/api/v1/...`

Swagger documentation: `http://localhost:3000/api/v1/api-docs`

### Key Services

- `AuthService` - Registration, login, email verification, password reset
- `TokenService` - JWT generation with refresh token rotation
- `PasswordPolicyService` - NIST/OWASP-compliant password validation
- `MfaService` - TOTP-based multi-factor authentication
- `SessionManagementService` - Multi-device session tracking with revocation
- `AppLoggerService` - Structured Winston logging with correlation IDs
- `PrometheusMetricsService` - `/metrics` endpoint for monitoring
- `SentryService` - Error tracking integration

### Database Patterns

- **Mongoose schemas** with validation, indexes, and 2dsphere geolocation
- **Connection pooling**: 100 max / 10 min (production), 20 max / 5 min (development)
- **Read/write concerns**: `majority` in production for consistency
- **Index verification**: Run `pnpm verify:indexes` after schema changes

### Security Model

- **Authentication**: JWT Bearer tokens + refresh token rotation
- **Password hashing**: Argon2 (primary), bcrypt (legacy support)
- **Rate limiting**: 5 req/5min (auth), 50 req/1min (public), 200 req/1min (authenticated)
- **Input sanitization**: Global middleware + `@Sanitize()` decorator
- **CSRF protection**: CsrfService for state-changing operations
- **Roles**: CONSUMER, MERCHANT, ADMIN, MODERATOR

## Configuration

Copy `.env.example` to `.env` and configure. Key variables:

- `DATABASE_URL` - MongoDB connection string
- `REDIS_HOST/PORT/PASSWORD` - Redis for caching and Bull queues
- `JWT_SECRET/JWT_REFRESH_SECRET` - Generate with `crypto.randomBytes(64).toString('hex')`
- `SENTRY_DSN` - Error tracking (disabled in development)

## Testing Conventions

- **Unit tests**: `*.spec.ts` files alongside source
- **E2E tests**: `test/*.e2e-spec.ts` with `jest-e2e.config.js`
- **Test timeout**: 10s (unit), 60s (E2E)
- **In-memory DB**: Uses `mongodb-memory-server` for isolation
- **Module mapper**: `src/*` → `<rootDir>/src/$1`

## ESLint Rules

Key enforced rules:
- `@typescript-eslint/no-floating-promises: error` - Must await or handle all promises
- `@typescript-eslint/await-thenable: error` - No awaiting non-promise values
- `require-await: error` - Async functions must contain await
- `no-eval: error` - Security: No eval or implied eval
- Unused vars: Error unless prefixed with `_`

## Monitoring Endpoints

- `GET /health` - Full health check (DB + Redis + memory)
- `GET /health/liveness` - K8s liveness probe
- `GET /health/readiness` - K8s readiness probe
- `GET /metrics` - Prometheus metrics

## Known Issues

- `src/reviwes/` folder has a typo (should be `reviews`)
- `src/proccessors/` folder has a typo (should be `processors`)
- TypeScript strict mode is disabled for gradual adoption

## Path Aliases

```typescript
import { Something } from '@foodwaste/shared';     // ../../packages/shared/src
import { Something } from 'src/common/utils';      // ./src/common/utils
```
