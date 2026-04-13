# Authentication & Authorization Module - Technical Documentation

> **Technical Reference** | **Status:** Production Ready | **Last Updated:**
> January 15, 2026

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Directory Structure](#directory-structure)
- [Core Components](#core-components)
- [Security Implementations](#security-implementations)
- [Design Patterns](#design-patterns)
- [Testing Strategy](#testing-strategy)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)

---

## Overview

The `auth` module is the security backbone of the Too Fresh To Waste platform.
It implements enterprise-grade authentication, authorization, and session
management using industry best practices and OWASP guidelines.

**For API endpoint documentation, see [README.md](./README.md)**

### Technology Stack

- **JWT Tokens:** Access (15min) + Refresh (7d) with rotation
- **Password Hashing:** Argon2id (primary), bcrypt (legacy)
- **Session Storage:** Redis with TTL-based expiration
- **MFA:** TOTP (RFC 6238) with backup codes
- **Rate Limiting:** Redis-backed throttler with IP + email tracking
- **Security Headers:** Helmet.js (CSP, HSTS, X-Frame-Options)

### Key Features

✅ **Stateless Authentication** - JWT-based with refresh token rotation ✅
**Multi-Factor Authentication** - TOTP, SMS, Email, backup codes ✅ **Session
Management** - Multi-device tracking with selective revocation ✅ **Brute-Force
Protection** - IP + email-based rate limiting with exponential backoff ✅
**Password Security** - NIST 800-63B compliant policies with entropy validation
✅ **CSRF Protection** - Double-submit cookie pattern ✅ **Role-Based Access
Control** - Hierarchical roles with fine-grained permissions ✅ **Tenant
Isolation** - Multi-tenant support for merchants

---

## Architecture

### High-Level Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ POST /auth/login
       ▼
┌─────────────────────────────────────────┐
│     CorrelationIdMiddleware             │ ◄─ Generate unique request ID
├─────────────────────────────────────────┤
│   GlobalSanitizationMiddleware          │ ◄─ XSS prevention
├─────────────────────────────────────────┤
│         Helmet Security                 │ ◄─ Security headers
├─────────────────────────────────────────┤
│       ThrottlerGuard                    │ ◄─ Rate limiting
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│      AuthController.login()             │
│  ├─ Validate DTO (class-validator)      │
│  ├─ Check IP/email blocks               │
│  ├─ Check failed login attempts         │
│  └─ Call AuthService.login()            │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│        AuthService.login()              │
│  ├─ Verify credentials                  │
│  ├─ Check email verification            │
│  ├─ Check MFA requirement                │
│  ├─ Generate JWT tokens                 │
│  └─ Create session                       │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│   SessionManagementService              │
│  ├─ Parse device info (user-agent)      │
│  ├─ Store session in Redis              │
│  └─ Return session ID                    │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│   Response with secure cookies:         │
│   ✓ access_token (HttpOnly, Secure)    │
│   ✓ refresh_token (HttpOnly, Secure)   │
│   ✓ session_id (HttpOnly, Secure)      │
└─────────────────────────────────────────┘
```

### Protected Endpoint Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ GET /offers (Authorization: Bearer <token>)
       ▼
┌─────────────────────────────────────────┐
│         JwtAuthGuard                    │
│  ├─ Extract JWT from header/cookie     │
│  ├─ Verify signature (JWT_SECRET)      │
│  ├─ Check expiration                    │
│  └─ Inject user into request.user       │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│         RolesGuard (if @Roles())        │
│  ├─ Check user.role in allowed roles    │
│  └─ Throw 403 if unauthorized           │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│    PermissionsGuard (if @Permissions()) │
│  ├─ Load user permissions from DB       │
│  ├─ Check required permissions          │
│  └─ Throw 403 if missing permissions    │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  ResourceOwnershipGuard (if @CheckOwn.) │
│  ├─ Extract resource ID from params     │
│  ├─ Verify user owns resource           │
│  └─ Throw 403 if not owner              │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│         Controller Handler              │
│         (Business Logic)                │
└─────────────────────────────────────────┘
```

---

## Directory Structure

```
auth/
├── __tests__/                          # Unit & integration tests
│   └── auth-service-interface.spec.ts  # Service contract tests
│
├── decorators/                         # Custom decorators
│   ├── check-ownership.decorator.ts    # @CheckOwnership() - Resource ownership check
│   ├── get-user.decorator.ts           # @GetUser() - Extract user from request
│   ├── permissions.decorator.ts        # @Permissions() - Fine-grained access control
│   ├── public.decorator.ts             # @Public() - Bypass authentication
│   ├── roles.decorator.ts              # @Roles() - Role-based access control
│   └── tenant-context.decorator.ts     # @TenantContext() - Multi-tenant isolation
│
├── DTO/                                # Data Transfer Objects (validation)
│   ├── forget-password.dto.ts          # Password reset request
│   ├── login.dto.ts                    # Login credentials
│   ├── refresh-token.dto.ts            # Token refresh request
│   ├── register.dto.ts                 # User registration
│   ├── reset-password.dto.ts           # Password reset with token
│   └── verify-email.dto.ts             # Email verification
│
├── events/                             # Event emitters (for auditing)
│   └── security-events.ts              # Security-related events (login, lockout)
│
├── guards/                             # Route guards (authorization)
│   ├── auth-throttler.guard.ts         # Custom throttler with enhanced logic
│   ├── csrf.guard.ts                   # CSRF token validation
│   ├── jwt-auth.guard.ts               # JWT authentication (primary)
│   ├── jwt-refresh.guard.ts            # JWT refresh token validation
│   ├── permissions.guard.ts            # Permission-based authorization
│   ├── resource-ownership.guard.ts     # Ownership verification
│   ├── roles.guard.ts                  # Role-based authorization
│   └── tenant-isolation.guard.ts       # Multi-tenant data isolation
│
├── interfaces/                         # TypeScript interfaces & DI tokens
│   ├── authorization.interface.ts      # Authorization types
│   ├── password-policy-service.interface.ts  # Password policy contract
│   ├── token-service.interface.ts      # Token service contract
│   └── index.ts                        # Barrel export + DI tokens
│
├── middleware/                         # Request middleware
│   └── tenant-context.middleware.ts    # Injects tenant context for merchants
│
├── response-test/                      # Response format examples
│   ├── login-test.md                   # Login response examples
│   ├── register-test.md                # Registration response examples
│   └── verifyEmail-test.md             # Email verification responses
│
├── schemas/                            # MongoDB schemas (Mongoose)
│   ├── permission.schema.ts            # Permissions collection
│   ├── refresh-token.schema.ts         # Refresh token storage (token family)
│   ├── role-permission.schema.ts       # Role-permission mapping
│   └── user-permission.schema.ts       # User-specific permission overrides
│
├── seeds/                              # Database seeders
│   └── permissions.seed.ts             # Default permissions for roles
│
├── services/                           # Business logic services
│   ├── admin-notification.service.ts   # Alert admins of security events
│   ├── authorization.service.ts        # RBAC logic
│   ├── auth-security.service.ts        # Brute-force protection, lockout
│   ├── captcha.service.ts              # reCAPTCHA integration
│   ├── csrf.service.ts                 # CSRF token generation/validation
│   ├── mfa.service.ts                  # Multi-factor authentication
│   ├── password-history.service.ts     # Prevent password reuse
│   ├── password-policy.service.ts      # Password validation & strength
│   ├── session-management.service.ts   # Multi-device session tracking
│   └── token.service.ts                # JWT generation/validation
│
├── strategies/                         # Passport strategies
│   ├── jwt.strategie.ts                # JWT access token strategy
│   └── jwt-refresh.strategie.ts        # JWT refresh token strategy
│
├── utils/                              # Utility functions
│   └── argon2-hash.util.ts             # Argon2 password hashing
│
├── admin-auth.controller.ts            # Admin-specific auth endpoints
├── auth.controller.ts                  # Main auth controller
├── auth-redirect.controller.ts         # OAuth redirect handler
├── auth.module.ts                      # NestJS module definition
├── auth.service.ts                     # Core authentication service
├── auth.service.spec.ts                # Auth service unit tests
├── auth.service.example.ts             # Example implementations
├── README.md                           # API documentation
└── auth.md                             # ← This file (technical docs)
```

---

## Core Components

### 1. Controllers

#### `auth.controller.ts` (Main Controller)

**Purpose:** HTTP endpoint handlers for all authentication operations

**Key Endpoints:**

- `POST /auth/register` - User registration
- `POST /auth/login` - Authentication
- `POST /auth/verify-email` - Email verification
- `POST /auth/refresh` - Token refresh
- `POST /auth/logout` - Session termination
- `POST /auth/forgot-password` - Password reset request
- `POST /auth/reset-password` - Password reset execution
- `GET /auth/sessions` - List active sessions
- `POST /auth/mfa/setup` - MFA enrollment
- `POST /auth/mfa/verify` - MFA verification

**Design Pattern:** Thin controller pattern (business logic delegated to
services)

**Example:**

```typescript
@Post('login')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 900000 } })
async login(
  @Body() loginDto: LoginDto,
  @Request() req: ExpressRequest,
  @Response({ passthrough: true }) res: ExpressResponse,
) {
  // 1. Extract request metadata
  const requestInfo = {
    ipAddress: req.ip || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
  };

  // 2. Security checks (IP blocking, brute-force)
  const ipBlocked = await this.authSecurityService.isIpBlocked(requestInfo.ipAddress);
  if (ipBlocked) {
    throw new ForbiddenException('IP temporarily blocked');
  }

  // 3. Delegate to service
  const loginResponse = await this.authService.login(loginDto, requestInfo);

  // 4. Create session
  const sessionInfo = await this.sessionManagementService.createSession({
    userId: loginResponse.user.userId,
    userAgent: requestInfo.userAgent,
    ipAddress: requestInfo.ipAddress,
  }, loginResponse.tokens);

  // 5. Set secure cookies
  this.setAuthCookies(res, loginResponse.tokens, sessionInfo.sessionId);

  return loginResponse;
}
```

#### `admin-auth.controller.ts`

**Purpose:** Admin-specific authentication endpoints (e.g., admin login with
enhanced security)

#### `auth-redirect.controller.ts`

**Purpose:** OAuth/SSO redirect handling (future: Google, Facebook login)

---

### 2. Services

#### `AuthService` (Core Service)

**Location:** `auth.service.ts`

**Responsibilities:**

- User registration with email verification
- Login with credential validation
- Token generation and refresh
- Password reset flow
- Account activation/deactivation

**Key Methods:**

```typescript
// User registration
async register(dto: RegisterDto): Promise<RegisterResponse> {
  // 1. Validate email uniqueness
  // 2. Validate password strength
  // 3. Hash password with Argon2
  // 4. Create user with PENDING status
  // 5. Generate verification code
  // 6. Send verification email
  // 7. Return user data (no tokens until verified)
}

// User login
async login(dto: LoginDto, requestInfo: RequestInfo): Promise<LoginResponse> {
  // 1. Find user by email
  // 2. Check account status (verified, active, not locked)
  // 3. Verify password (Argon2/bcrypt)
  // 4. Check MFA requirement
  // 5. Generate access + refresh tokens
  // 6. Store refresh token with family tracking
  // 7. Return tokens + user data
}

// Token refresh
async refreshTokens(userId: string, refreshToken: string): Promise<AuthTokens> {
  // 1. Verify refresh token signature
  // 2. Check token family (detect reuse attack)
  // 3. Revoke old token family if reused
  // 4. Generate new access + refresh tokens
  // 5. Rotate refresh token (new family)
  // 6. Return new token pair
}
```

**Dependencies:**

- `UsersService` - User CRUD operations
- `PasswordPolicyService` - Password validation
- `TokenService` - JWT operations
- `EmailService` - Verification emails
- `AuthSecurityService` - Security controls

---

#### `AuthSecurityService`

**Location:** `services/auth-security.service.ts`

**Responsibilities:**

- Brute-force protection (IP + email throttling)
- Account lockout after failed attempts
- Suspicious activity detection
- IP blocking
- Failed attempt tracking

**Implementation:**

```typescript
// Redis key patterns
private readonly FAILED_LOGIN_PREFIX = 'auth:failed:';
private readonly IP_BLOCK_PREFIX = 'auth:blocked:ip:';
private readonly EMAIL_BLOCK_PREFIX = 'auth:blocked:email:';

async recordFailedLoginAttempt(ipAddress: string, email: string): Promise<void> {
  const ipKey = `${this.FAILED_LOGIN_PREFIX}${ipAddress}`;
  const emailKey = `${this.FAILED_LOGIN_PREFIX}${email}`;

  // Increment counters with 15-minute TTL
  await this.redisClient.incr(ipKey, 900);
  await this.redisClient.incr(emailKey, 900);

  // Check if threshold exceeded (10 attempts)
  const ipAttempts = await this.redisClient.get(ipKey);
  const emailAttempts = await this.redisClient.get(emailKey);

  if (ipAttempts >= 10) {
    await this.blockIp(ipAddress, 900000); // 15 min block
    await this.adminNotificationService.alertAdmins({
      type: 'BRUTE_FORCE_DETECTED',
      ipAddress,
      attempts: ipAttempts,
    });
  }

  if (emailAttempts >= 10) {
    await this.lockAccount(email, 900000); // 15 min lockout
  }
}
```

**Configuration:**

- Max attempts: 10 (configurable via env)
- Lockout duration: 15 minutes
- IP block duration: 15 minutes
- Cleanup: TTL-based auto-expiration

---

#### `PasswordPolicyService`

**Location:** `services/password-policy.service.ts`

**Responsibilities:**

- Password strength validation (zxcvbn)
- Common password detection (10k+ patterns)
- Personal info exclusion
- Password generation

**Validation Rules:**

```typescript
export const PASSWORD_POLICY = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  specialCharacters: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  minScore: 2, // zxcvbn score (0-4)
  preventPersonalInfo: true,
  preventCommonPasswords: true,
  preventSequentialChars: true, // e.g., "123456", "abcdef"
};
```

**Example:**

```typescript
const result = await passwordPolicyService.validatePassword('P@ssw0rd123!', {
  email: 'user@example.com',
  firstName: 'John',
  lastName: 'Doe',
});

// Result:
// {
//   isValid: false,
//   score: 1,
//   feedback: ['Add more words that are less common'],
//   suggestions: ['Avoid sequences', 'Use longer passwords'],
//   crackTime: '3 hours',
// }
```

---

#### `TokenService`

**Location:** `services/token.service.ts`

**Responsibilities:**

- JWT generation (access + refresh)
- Token verification
- Token family tracking (refresh token rotation)
- Token revocation

**Implementation:**

```typescript
async generateAccessToken(payload: JwtPayload): Promise<string> {
  return this.jwtService.sign(payload, {
    secret: this.configService.get('JWT_SECRET'),
    expiresIn: '15m',
    algorithm: 'HS256', // TODO: Migrate to RS256 (asymmetric)
  });
}

async generateRefreshToken(payload: JwtPayload): Promise<string> {
  const familyId = uuidv4(); // Token family for rotation tracking

  const refreshPayload = {
    ...payload,
    familyId,
    type: 'refresh',
  };

  const token = this.jwtService.sign(refreshPayload, {
    secret: this.configService.get('JWT_REFRESH_SECRET'),
    expiresIn: '7d',
  });

  // Store in DB for revocation support
  await this.refreshTokenModel.create({
    userId: payload.sub,
    familyId,
    token: await this.hashToken(token),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return token;
}
```

**Security Considerations:**

- Access tokens: Short-lived (15min) to limit blast radius
- Refresh tokens: Long-lived (7d) but revocable
- Token rotation: New refresh token issued on each refresh (prevents replay)
- Token families: Detect refresh token reuse (potential theft)

---

#### `MfaService`

**Location:** `services/mfa.service.ts`

**Responsibilities:**

- TOTP setup (QR code generation)
- TOTP verification (6-digit codes)
- Backup code generation/validation
- Emergency token generation
- MFA disable (with password confirmation)

**Example:**

```typescript
async setupTotp(userId: string): Promise<MfaSetupResponse> {
  // 1. Generate TOTP secret
  const secret = speakeasy.generateSecret({
    name: `Food Waste App (${user.email})`,
    issuer: 'Too Fresh To Waste',
  });

  // 2. Generate QR code
  const qrCode = await QRCode.toDataURL(secret.otpauth_url);

  // 3. Generate backup codes
  const backupCodes = Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString('hex')
  );

  // 4. Store encrypted secret + hashed backup codes
  await this.usersService.updateMfaData(userId, {
    mfaSecret: this.encrypt(secret.base32),
    backupCodes: await Promise.all(
      backupCodes.map(code => bcrypt.hash(code, 10))
    ),
    mfaEnabled: false, // User must verify first
  });

  return {
    qrCode,
    manualEntryKey: secret.base32,
    backupCodes, // Show once, never again
  };
}
```

---

#### `SessionManagementService`

**Location:** `services/session-management.service.ts`

**Responsibilities:**

- Session creation with device tracking
- Multi-device session tracking
- Session revocation (single or all)
- Session activity updates
- Trusted device management

**Data Structure:**

```typescript
interface Session {
  sessionId: string; // UUID
  userId: string; // User ID
  deviceInfo: {
    deviceName: string; // "Chrome on Windows"
    platform: string; // "Windows"
    browser: string; // "Chrome"
    ipAddress: string; // "192.168.1.1"
    isTrusted: boolean; // Trust this device?
  };
  createdAt: Date; // Session start
  lastActivityAt: Date; // Last request timestamp
  expiresAt: Date; // TTL (7 days)
}
```

**Redis Storage:**

```typescript
// Key pattern: session:{sessionId}
// TTL: 7 days (auto-cleanup)

// User session index: user:sessions:{userId}
// Value: Set of session IDs
```

---

### 3. Guards

#### `JwtAuthGuard`

**Location:** `guards/jwt-auth.guard.ts`

**Purpose:** Primary authentication guard using JWT access tokens

**Usage:**

```typescript
// Global (applied to all routes via APP_GUARD)
@Module({
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})

// Bypass authentication for specific routes
@Public()
@Get('public-data')
getPublicData() { ... }
```

**Implementation:**

```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check for @Public() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true; // Skip authentication
    }

    return super.canActivate(context); // Delegate to Passport
  }
}
```

---

#### `RolesGuard`

**Location:** `guards/roles.guard.ts`

**Purpose:** Role-based access control (RBAC)

**Usage:**

```typescript
@Roles('ADMIN', 'MODERATOR')
@UseGuards(JwtAuthGuard, RolesGuard)
@Delete('users/:id')
deleteUser(@Param('id') id: string) { ... }
```

**Implementation:**

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );
    if (!requiredRoles) {
      return true; // No role requirement
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}
```

---

#### `PermissionsGuard`

**Location:** `guards/permissions.guard.ts`

**Purpose:** Fine-grained permission checks (beyond roles)

**Usage:**

```typescript
@Permissions('offers:delete')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Delete('offers/:id')
deleteOffer(@Param('id') id: string) { ... }
```

---

#### `ResourceOwnershipGuard`

**Location:** `guards/resource-ownership.guard.ts`

**Purpose:** Verify user owns the resource being accessed

**Usage:**

```typescript
@CheckOwnership('Order')
@UseGuards(JwtAuthGuard, ResourceOwnershipGuard)
@Get('orders/:id')
getOrder(@Param('id') id: string) { ... }
```

---

### 4. Decorators

#### `@Public()`

**Purpose:** Mark endpoint as public (bypass authentication)

**Implementation:**

```typescript
export const Public = () => SetMetadata('isPublic', true);
```

---

#### `@Roles(...roles: string[])`

**Purpose:** Define required roles for endpoint

**Implementation:**

```typescript
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
```

---

#### `@Permissions(...permissions: string[])`

**Purpose:** Define required permissions for endpoint

**Implementation:**

```typescript
export const Permissions = (...permissions: string[]) =>
  SetMetadata('permissions', permissions);
```

---

#### `@GetUser()`

**Purpose:** Extract authenticated user from request

**Usage:**

```typescript
@Get('profile')
@UseGuards(JwtAuthGuard)
getProfile(@GetUser() user: User) {
  return user;
}
```

**Implementation:**

```typescript
export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
```

---

## Security Implementations

### 1. Password Security

**Hashing Algorithm:** Argon2id (winner of Password Hashing Competition 2015)

**Configuration:**

```typescript
const argon2Config = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3, // 3 iterations
  parallelism: 4, // 4 threads
  hashLength: 32, // 32 bytes
};
```

**Why Argon2id?**

- Memory-hard (resistant to GPU/ASIC attacks)
- Hybrid mode (combines Argon2i and Argon2d)
- Recommended by OWASP for password storage

**Legacy Support:**

```typescript
// Old passwords use bcrypt (gradual migration)
async verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  if (hash.startsWith('$argon2')) {
    return argon2.verify(hash, plaintext);
  }

  // Legacy bcrypt
  return bcrypt.compare(plaintext, hash);
}
```

---

### 2. Token Security

**Access Token Claims:**

```typescript
interface AccessTokenPayload {
  sub: string; // User ID
  email: string; // User email
  role: string; // User role
  iat: number; // Issued at (Unix timestamp)
  exp: number; // Expiration (Unix timestamp)
  jti: string; // JWT ID (for revocation)
}
```

**Refresh Token Claims:**

```typescript
interface RefreshTokenPayload {
  sub: string; // User ID
  type: 'refresh'; // Token type
  familyId: string; // Token family UUID (rotation tracking)
  iat: number; // Issued at
  exp: number; // Expiration
}
```

**Refresh Token Rotation:**

```
User logs in → Token family A created
  ↓
User refreshes → New family B, revoke A
  ↓
User refreshes → New family C, revoke B
  ↓
Attacker uses old token A → Detect reuse, revoke ALL families
```

---

### 3. Rate Limiting

**Throttle Configuration:**

```typescript
// Global default: 50 req/min
ThrottlerModule.forRoot({
  throttlers: [
    {
      ttl: 60000,
      limit: 50,
    },
  ],
});

// Endpoint-specific overrides
@Throttle({ default: { limit: 10, ttl: 900000 } }) // 10 req / 15 min
@Post('login')
```

**IP-Based Blocking:**

- Triggered after 10 failed login attempts
- Block duration: 15 minutes
- Storage: Redis with TTL auto-expiration

---

### 4. CSRF Protection

**Double-Submit Cookie Pattern:**

```typescript
// 1. Client requests CSRF token
GET /auth/csrf-token
→ Response: { token: "abc123" }
→ Cookie: csrf-token=abc123 (HttpOnly: false, SameSite: Strict)

// 2. Client includes token in state-changing requests
POST /auth/login
Headers: X-CSRF-Token: abc123
Cookies: csrf-token=abc123

// 3. Server validates match
if (headerToken !== cookieToken) {
  throw new ForbiddenException('CSRF token mismatch');
}
```

---

### 5. Session Security

**Session Cookie Attributes:**

```typescript
res.cookie('session_id', sessionId, {
  httpOnly: true, // Prevent XSS access
  secure: true, // HTTPS only
  sameSite: 'lax', // Prevent CSRF
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/', // Available to all routes
  domain: '.example.com', // Subdomain sharing (if needed)
});
```

**Concurrent Session Limits:**

- Max sessions per user: 5 (configurable)
- Oldest session revoked when limit exceeded
- User can manually revoke sessions via `/auth/sessions`

---

## Design Patterns

### 1. Dependency Injection (Interface-Based)

**Problem:** Tight coupling between services

**Solution:** Use DI tokens + interfaces

**Implementation:**

```typescript
// interfaces/password-policy-service.interface.ts
export const PASSWORD_POLICY_SERVICE_TOKEN = Symbol('PASSWORD_POLICY_SERVICE');

export interface IPasswordPolicyService {
  validatePassword(password: string, context?: object): ValidationResult;
}

// auth.module.ts
providers: [
  {
    provide: PASSWORD_POLICY_SERVICE_TOKEN,
    useClass: PasswordPolicyService,
  },
]

// auth.service.ts
constructor(
  @Inject(PASSWORD_POLICY_SERVICE_TOKEN)
  private readonly passwordPolicyService: IPasswordPolicyService,
) {}
```

**Benefits:**

- Easy mocking in tests
- Swappable implementations
- Explicit contracts

---

### 2. Guard Composition

**Problem:** Multiple authorization checks needed

**Solution:** Chain guards using `@UseGuards()`

**Example:**

```typescript
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, ResourceOwnershipGuard)
@Roles('MERCHANT')
@Permissions('offers:update')
@CheckOwnership('Offer')
@Patch('offers/:id')
updateOffer(@Param('id') id: string, @Body() dto: UpdateOfferDto) {
  // All checks passed:
  // ✓ User authenticated
  // ✓ User has MERCHANT role
  // ✓ User has 'offers:update' permission
  // ✓ User owns this offer
}
```

**Execution Order:**

1. JwtAuthGuard (authentication)
2. RolesGuard (role check)
3. PermissionsGuard (permission check)
4. ResourceOwnershipGuard (ownership check)
5. Controller handler (business logic)

---

### 3. Strategy Pattern (Passport)

**Problem:** Multiple authentication methods

**Solution:** Passport strategies

**Implementation:**

```typescript
// strategies/jwt.strategie.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    // Called AFTER token verification
    // Return value injected into request.user
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
```

---

### 4. Repository Pattern (Mongoose)

**Problem:** Direct database access in services

**Solution:** Abstract data access

**Example:**

```typescript
// auth.service.ts (NOT using repository - direct access)
constructor(
  @InjectModel(User.name) private userModel: Model<User>,
) {}

async findByEmail(email: string): Promise<User> {
  return this.userModel.findOne({ email }).exec();
}

// BETTER: Use UsersService as repository
constructor(
  private readonly usersService: UsersService, // Abstracts DB access
) {}

async findByEmail(email: string): Promise<User> {
  return this.usersService.findByEmail(email);
}
```

---

## Testing Strategy

### Unit Tests

**Location:** `*.spec.ts` files alongside source

**Tools:**

- Jest (test runner)
- `@nestjs/testing` (TestingModule)
- Mocks for external dependencies

**Example:**

```typescript
describe('AuthService', () => {
  let service: AuthService;
  let mockUsersService: jest.Mocked<UsersService>;
  let mockTokenService: jest.Mocked<TokenService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: {
            generateAccessToken: jest.fn(),
            generateRefreshToken: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    mockUsersService = module.get(UsersService);
    mockTokenService = module.get(TokenService);
  });

  it('should register a new user', async () => {
    mockUsersService.findByEmail.mockResolvedValue(null);
    mockUsersService.create.mockResolvedValue({
      id: '1',
      email: 'test@example.com',
    });

    const result = await service.register({
      email: 'test@example.com',
      password: 'SecurePass123!',
    });

    expect(result.user.email).toBe('test@example.com');
    expect(mockUsersService.create).toHaveBeenCalledTimes(1);
  });
});
```

---

### Integration Tests

**Location:** `__tests__/*.spec.ts`

**Tools:**

- In-memory MongoDB (`mongodb-memory-server`)
- Supertest for HTTP testing

**Example:**

```typescript
describe('AuthController (Integration)', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    const moduleRef = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(uri), AuthModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await mongoServer.stop();
  });

  it('POST /auth/register should create user', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: 'SecurePass123!',
      })
      .expect(201)
      .expect(res => {
        expect(res.body.user.email).toBe('test@example.com');
      });
  });
});
```

---

### E2E Tests

**Location:** `test/*.e2e-spec.ts`

**Coverage:**

- Full user registration flow
- Login → protected route access
- Token refresh flow
- MFA setup and verification

**Example:**

```typescript
describe('Authentication E2E', () => {
  let accessToken: string;

  it('should register → verify → login → access protected route', async () => {
    // 1. Register
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'e2e@example.com', password: 'SecurePass123!' });

    expect(registerRes.status).toBe(201);

    // 2. Verify email (mock verification code retrieval)
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ email: 'e2e@example.com', code: '123456' });

    expect(verifyRes.status).toBe(200);

    // 3. Login
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e@example.com', password: 'SecurePass123!' });

    expect(loginRes.status).toBe(200);
    accessToken = loginRes.body.tokens.accessToken;

    // 4. Access protected route
    const profileRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(profileRes.status).toBe(200);
    expect(profileRes.body.email).toBe('e2e@example.com');
  });
});
```

---

## Common Tasks

### Adding a New Authentication Method

**Example:** Add Google OAuth

1. **Install dependencies:**

```bash
pnpm add @nestjs/passport passport-google-oauth20
pnpm add -D @types/passport-google-oauth20
```

2. **Create strategy:**

```typescript
// strategies/google.strategy.ts
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET'),
      callbackURL: 'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    const { name, emails, photos } = profile;
    const user = {
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      picture: photos[0].value,
      provider: 'google',
    };
    done(null, user);
  }
}
```

3. **Add guard:**

```typescript
// guards/google-auth.guard.ts
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {}
```

4. **Add endpoints:**

```typescript
// auth.controller.ts
@Get('google')
@UseGuards(GoogleAuthGuard)
googleAuth() {
  // Initiates OAuth flow
}

@Get('google/callback')
@UseGuards(GoogleAuthGuard)
async googleAuthCallback(@Request() req, @Response() res) {
  // Handle OAuth callback
  const tokens = await this.authService.loginOrRegisterOAuth(req.user);
  this.setAuthCookies(res, tokens);
  res.redirect('/dashboard');
}
```

5. **Update module:**

```typescript
// auth.module.ts
providers: [..., GoogleStrategy],
```

---

### Adding a New Permission

**Example:** Add `offers:approve` permission

1. **Update permissions seed:**

```typescript
// seeds/permissions.seed.ts
const permissions = [
  {
    name: 'offers:approve',
    description: 'Approve pending offers',
    roles: ['ADMIN', 'MODERATOR'],
  },
  // ...
];
```

2. **Run seeder:**

```bash
pnpm seed:permissions
```

3. **Use in controller:**

```typescript
@Permissions('offers:approve')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Patch('offers/:id/approve')
approveOffer(@Param('id') id: string) { ... }
```

---

### Debugging Authentication Issues

**Enable debug logging:**

```bash
# .env
LOG_LEVEL=debug
DEBUG=passport:*
```

**Check JWT decoding:**

```bash
# Install jwt-cli
npm install -g jwt-cli

# Decode token
jwt decode <your-token>
```

**Check Redis sessions:**

```bash
# Connect to Redis
redis-cli

# List all sessions
KEYS session:*

# Get session data
GET session:<session-id>

# List user sessions
SMEMBERS user:sessions:<user-id>
```

**Common issues:**

- **401 Unauthorized:** Token expired or invalid signature
- **403 Forbidden:** Missing role/permission or account locked
- **423 Locked:** Too many failed login attempts
- **429 Too Many Requests:** Rate limit exceeded

---

## Troubleshooting

### Issue: "Token expired" after 1 minute (not 15 minutes)

**Cause:** System clock skew or wrong TTL configuration

**Solution:**

```bash
# Check .env
JWT_EXPIRES_IN=15m  # Correct
JWT_EXPIRES_IN=900000  # Wrong (milliseconds not supported by JWT)
```

---

### Issue: Refresh token rotation not working

**Cause:** Token family not properly tracked in database

**Debug:**

```typescript
// Check if refresh token stored
const token = await this.refreshTokenModel.findOne({ userId });
console.log('Stored token:', token);
```

**Solution:** Ensure `generateRefreshToken()` stores token in DB

---

### Issue: CSRF token mismatch

**Cause:** Cookie not sent or SameSite attribute blocking

**Debug:**

```typescript
// Check if cookie present
console.log('CSRF cookie:', req.cookies['csrf-token']);
console.log('CSRF header:', req.headers['x-csrf-token']);
```

**Solution:** Ensure frontend reads cookie and sends in header:

```typescript
// Frontend
const csrfToken = document.cookie.match(/csrf-token=([^;]+)/)?.[1];
fetch('/auth/login', {
  headers: { 'X-CSRF-Token': csrfToken },
});
```

---

### Issue: Account lockout not expiring

**Cause:** Redis TTL not set or expired

**Debug:**

```bash
redis-cli
TTL auth:blocked:email:user@example.com
# -1 = no TTL set (manual delete required)
# -2 = key doesn't exist
# > 0 = seconds remaining
```

**Solution:** Ensure TTL set when blocking:

```typescript
await this.redisClient.set(key, '1', 'EX', 900); // 15 min expiry
```

---

## References

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [NIST 800-63B (Password Guidelines)](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [JWT Best Practices (RFC 8725)](https://datatracker.ietf.org/doc/html/rfc8725)
- [Argon2 Specification](https://github.com/P-H-C/phc-winner-argon2)
- [NestJS Guards Documentation](https://docs.nestjs.com/guards)
- [Passport.js Documentation](http://www.passportjs.org/)

---

**Document Version:** 1.0.0 **Last Updated:** January 15, 2026 **Maintained
By:** Backend Security Team **Review Cycle:** Quarterly
