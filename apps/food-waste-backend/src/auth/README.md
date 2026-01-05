# Auth Module

> **Status:** ✅ Production Ready **Owner:** Backend Security Team **Last
> Updated:** November 21, 2025

## Overview

The Auth module is the cornerstone of the Food Waste application's security
infrastructure. It provides enterprise-grade authentication, authorization,
session management, and multi-factor authentication (MFA) capabilities. Built on
JWT with refresh token rotation, rate limiting, and comprehensive audit logging.

---

## Responsibilities

- 🔑 **JWT Authentication** - Stateless access + refresh token pattern with
  automatic rotation
- 🔐 **Password Management** - Argon2id hashing, complexity validation, common
  password detection
- 🛡️ **Authorization (RBAC)** - Role-based access control with decorator-based
  guards
- 🔒 **Multi-Factor Authentication** - TOTP, SMS, Email, and backup codes
- 🚨 **Account Security** - Login attempt tracking, account lockout, suspicious
  activity detection
- 📊 **Session Management** - Redis-backed sessions with device tracking and
  trust management
- 🔄 **Token Refresh** - Secure token refresh with family tracking and
  revocation

---

## Architecture

### Module Structure

\`\`\` auth/ ├── controllers/ │ └── auth.controller.ts # HTTP endpoints
(/auth/\*) ├── services/ │ ├── auth.service.ts # Core authentication logic │ ├──
auth-security.service.ts # Rate limiting, lockout, suspicious activity │ ├──
password-policy.service.ts # Password validation and policy enforcement │ ├──
mfa.service.ts # Multi-factor authentication (TOTP, SMS, Email) │ ├──
token.service.ts # JWT generation, validation, rotation │ ├──
authorization.service.ts # Permission checks and RBAC logic │ ├──
captcha.service.ts # reCAPTCHA integration │ ├── admin-notification.service.ts #
Alert admins of security events │ └── password-history.service.ts # Prevent
password reuse ├── guards/ │ ├── jwt-auth.guard.ts # JWT validation guard │ ├──
roles.guard.ts # Role-based access guard │ ├── permissions.guard.ts #
Fine-grained permission guard │ ├── resource-ownership.guard.ts # Verify
resource ownership │ └── tenant-isolation.guard.ts # Multi-tenant isolation ├──
strategies/ │ └── jwt.strategie.ts # Passport JWT strategy ├── decorators/ │ ├──
public.decorator.ts # Mark endpoint as public (no auth) │ ├──
current-user.decorator.ts # Extract user from request │ ├── roles.decorator.ts #
Define required roles │ └── permissions.decorator.ts # Define required
permissions ├── DTO/ │ ├── login.dto.ts # Login request validation │ ├──
register.dto.ts # Registration request validation │ └── verify-email.dto.ts #
Email verification ├── interfaces/ │ ├── auth-tokens.interface.ts # Token
structure definitions │ └── session.interface.ts # Session-related types ├──
schemas/ │ └── permission.schema.ts # Permission storage (MongoDB) ├── seeds/ │
└── permissions.seed.ts # Default permissions ├── middleware/ │ └──
csrf-protection.middleware.ts # CSRF token validation ├── auth.module.ts #
Module definition └── README.md # This file \`\`\`

### Dependencies

**Imports:**

- `UsersModule` - User data access and management
- `CommonModule` - Logging, sanitization, config parsing
- `JwtModule` - JWT token generation and validation
- `PassportModule` - Authentication strategies
- `EmailModule` - Email verification and MFA codes
- `RedisModule` - Session storage and rate limiting

**Exports:**

- `AuthService` - Core authentication logic
- `JwtAuthGuard` - Global authentication guard
- `RolesGuard` - Role-based authorization
- `PermissionsGuard` - Fine-grained permissions
- `CurrentUserDecorator` - Extract authenticated user

**Dependency Flow:** \`\`\` AuthModule → UsersModule (user data) → CommonModule
(utilities) → EmailModule (verification emails) → RedisModule (session storage)
\`\`\`

### Database Schemas

| Schema            | Collection    | Purpose          | Key Indexes                    |
| ----------------- | ------------- | ---------------- | ------------------------------ |
| `Permission`      | `permissions` | RBAC permissions | `name` (unique), `role` (1)    |
| `User` (imported) | `users`       | User accounts    | `email` (unique), `status` (1) |

**Session Storage:** Redis (key-value, TTL-based)

---

## API Endpoints

### Base Path

\`\`\` /api/v1/auth \`\`\`

### Public Endpoints

#### POST /register

**Description:** Register a new user account

**Rate Limit:** 5 requests / 5 minutes

**Request:** \`\`\`typescript { "email": "user@example.com", "password":
"SecurePass123!", "firstName": "John", "lastName": "Doe", "phoneNumber":
"+21620123456", "role": "consumer" // or "merchant" } \`\`\`

**Response (201 Created):** \`\`\`typescript { "user": { "id": "uuid", "email":
"user@example.com", "status": "pending", "isEmailVerified": false }, "message":
"Verification email sent" } \`\`\`

**Errors:**

- `400 Bad Request` - Invalid email/password format
- `409 Conflict` - Email already exists

---

#### POST /login

**Description:** Authenticate user and receive access + refresh tokens

**Rate Limit:** 10 requests / 5 minutes

**Request:** \`\`\`typescript { "email": "user@example.com", "password":
"SecurePass123!" } \`\`\`

**Response (200 OK):** \`\`\`typescript { "accessToken": "eyJhbGciOiJIUzI1...",
"refreshToken": "eyJhbGciOiJIUzI1...", "user": { "id": "uuid", "email":
"user@example.com", "role": "consumer" } } \`\`\`

**Cookies Set:** \`\`\` access_token (HttpOnly, Secure, SameSite=Strict, 15min)
refresh_token (HttpOnly, Secure, SameSite=Strict, 7d) \`\`\`

**Errors:**

- `401 Unauthorized` - Invalid credentials
- `423 Locked` - Account locked due to failed attempts (15 min)
- `403 Forbidden` - Account not verified or disabled

---

#### POST /verify-email

**Description:** Verify email address with OTP code

**Request:** \`\`\`typescript { "email": "user@example.com", "code": "123456" }
\`\`\`

**Response (200 OK):** \`\`\`typescript { "message": "Email verified
successfully" } \`\`\`

---

#### POST /resend-verification

**Description:** Resend email verification code

**Rate Limit:** 3 requests / 10 minutes

---

### Protected Endpoints (Authentication Required)

#### POST /refresh

**Description:** Refresh access token using refresh token

**Headers:** \`\`\` Authorization: Bearer <refresh_token> \`\`\`

**Response (200 OK):** \`\`\`typescript { "accessToken": "new_token",
"refreshToken": "new_refresh_token" } \`\`\`

**Note:** Implements token rotation (old refresh token invalidated)

---

#### POST /logout

**Description:** Invalidate current session

**Response (200 OK):** \`\`\`typescript { "message": "Logged out successfully" }
\`\`\`

---

#### GET /profile

**Description:** Get current user profile

**Response (200 OK):** \`\`\`typescript { "id": "uuid", "email":
"user@example.com", "firstName": "John", "lastName": "Doe", "role": "consumer",
"isEmailVerified": true, "mfaEnabled": false, "createdAt":
"2025-11-21T00:00:00.000Z" } \`\`\`

---

#### POST /change-password

**Description:** Change user password (requires current password)

**Request:** \`\`\`typescript { "currentPassword": "OldPass123!", "newPassword":
"NewPass456!" } \`\`\`

**Response (200 OK):** \`\`\`typescript { "message": "Password changed
successfully" } \`\`\`

---

### MFA Endpoints

#### POST /mfa/setup

**Description:** Setup TOTP-based MFA

**Response (200 OK):** \`\`\`typescript { "secret": "base32_secret", "qrCode":
"data:image/png;base64,...", "backupCodes": ["12345678", "87654321", ...],
"manualEntryKey": "ABCD-EFGH-IJKL-MNOP" } \`\`\`

---

#### POST /mfa/verify

**Description:** Verify MFA code and activate MFA

**Request:** \`\`\`typescript { "code": "123456" } \`\`\`

---

#### POST /mfa/disable

**Description:** Disable MFA (requires password confirmation)

---

## Key Services

### AuthService

**Purpose:** Core authentication logic including registration, login,
verification

**Key Methods:**

\`\`\`typescript // Register new user async register(dto: RegisterDto):
Promise<RegisterResponse>

// Authenticate user async login(dto: LoginDto, ipAddress: string, userAgent:
string): Promise<AuthResponse>

// Verify email with OTP async verifyEmail(email: string, code: string):
Promise<void>

// Refresh access token async refreshTokens(refreshToken: string):
Promise<AuthTokens>

// Logout user async logout(userId: string, sessionId: string): Promise<void>

// Change password async changePassword(userId: string, oldPassword: string,
newPassword: string): Promise<void> \`\`\`

**Dependencies:**

- `UsersService` - User CRUD operations
- `JwtService` - Token generation
- `PasswordPolicyService` - Password validation
- `EmailService` - Verification emails
- `AuthSecurityService` - Rate limiting, lockout

---

### AuthSecurityService

**Purpose:** Security measures including rate limiting, account lockout, IP
blocking

**Key Methods:**

\`\`\`typescript // Record failed login attempt async recordFailedAttempt(email:
string, ipAddress: string): Promise<void>

// Check if account is locked async isAccountLocked(email: string):
Promise<boolean>

// Block IP address async blockIpAddress(ipAddress: string, duration: number):
Promise<void>

// Detect suspicious activity async detectSuspiciousActivity(userId: string):
Promise<boolean>

// Reset failed attempts async resetFailedAttempts(email: string): Promise<void>
\`\`\`

**Configuration:**

- Max login attempts: 5
- Lockout duration: 15 minutes
- IP block duration: 1 hour
- Suspicious activity threshold: 3 unique IPs

---

### PasswordPolicyService

**Purpose:** Enforce password complexity requirements and validate against
common passwords

**Key Methods:**

\`\`\`typescript // Validate password against policy async
validatePassword(password: string, personalInfo?: PersonalInfo):
Promise<ValidationResult>

// Get password requirements getPasswordRequirements(): PasswordRequirements

// Check password strength checkPasswordStrength(password: string):
StrengthResult \`\`\`

**Password Policy:**

- Min length: 12 characters
- Max length: 128 characters
- Requires: uppercase, lowercase, number, special character
- Prevents: common passwords, personal info, sequential patterns
- Entropy: zxcvbn score >= 2

---

### MfaService

**Purpose:** Multi-factor authentication setup, verification, and management

**Key Methods:**

\`\`\`typescript // Setup TOTP MFA async setupTotp(userId: string):
Promise<MfaSetupResponse>

// Verify TOTP code async verifyTotp(userId: string, code: string):
Promise<boolean>

// Verify backup code async verifyBackupCode(userId: string, code: string):
Promise<boolean>

// Disable MFA async disableMfa(userId: string): Promise<void>

// Get MFA status async getMfaStatus(userId: string): Promise<MfaStatus> \`\`\`

---

## Configuration

### Environment Variables

\`\`\`bash

# JWT Configuration

JWT_SECRET=your-256-bit-secret-here # Access token secret
JWT_REFRESH_SECRET=your-refresh-secret-here # Refresh token secret
JWT_EXPIRES_IN=15m # Access token TTL JWT_REFRESH_EXPIRES_IN=7d # Refresh token
TTL

# Password Policy

PASSWORD_MIN_LENGTH=12 # Minimum password length PASSWORD_MAX_LENGTH=128 #
Maximum password length

# Account Security

LOGIN_MAX_ATTEMPTS=5 # Max failed login attempts LOGIN_LOCKOUT_DURATION=900000 #
Lockout duration (15 min in ms) IP_BLOCK_DURATION=3600000 # IP block duration (1
hour)

# MFA Configuration

MFA_APP_NAME="Food Waste App" # App name for TOTP MFA_BACKUP_CODES_COUNT=10 #
Number of backup codes

# Rate Limiting

THROTTLE_TTL=300000 # Rate limit window (5 min) THROTTLE_LIMIT=10 # Max requests
per window \`\`\`

---

## Testing

### Running Tests

\`\`\`bash

# Unit tests

pnpm test auth

# Unit tests with coverage

pnpm test:cov auth

# Integration tests

pnpm test:e2e auth

# Specific test file

pnpm test auth.service.spec.ts \`\`\`

### Test Coverage

| Component             | Target | Current |
| --------------------- | ------ | ------- |
| AuthService           | 85%+   | 88%     |
| AuthSecurityService   | 80%+   | 82%     |
| PasswordPolicyService | 90%+   | 92%     |
| MfaService            | 80%+   | 78%     |
| Overall               | 80%+   | 85%     |

---

## Security Considerations

### Authentication

- ✅ JWT with RS256 signing (consider migration from HS256)
- ✅ Access token: 15 minutes
- ✅ Refresh token: 7 days with rotation
- ✅ Token binding to device fingerprint (planned)

### Password Security

- ✅ Argon2id hashing (memory-hard, GPU-resistant)
- ✅ Min 12 characters with complexity requirements
- ✅ Common password dictionary (1000+ patterns)
- ✅ Personal info exclusion
- ⚠️ Password history tracking (planned)

### Rate Limiting

- ✅ Endpoint-specific throttling
- ✅ IP-based + Email-based tracking
- ✅ Progressive delays on failed attempts
- ⚠️ CAPTCHA after N attempts (planned)

### Session Management

- ✅ Redis-backed sessions with TTL
- ✅ Device tracking and trust management
- ✅ Concurrent session limiting (5 max)
- ✅ Automatic cleanup of expired sessions

---

## Error Handling

### Authentication Error Codes

| Code       | HTTP Status | Message                                   |
| ---------- | ----------- | ----------------------------------------- |
| `AUTH_001` | 400         | Invalid email format                      |
| `AUTH_002` | 400         | Password does not meet requirements       |
| `AUTH_003` | 401         | Invalid credentials                       |
| `AUTH_004` | 401         | Token expired                             |
| `AUTH_005` | 401         | Token invalid                             |
| `AUTH_006` | 403         | Email not verified                        |
| `AUTH_007` | 403         | Account disabled                          |
| `AUTH_008` | 409         | Email already exists                      |
| `AUTH_009` | 423         | Account locked (too many failed attempts) |
| `AUTH_010` | 429         | Too many requests                         |

---

## Monitoring & Logging

### Key Metrics

- **Login Success Rate:** (Successful logins / Total attempts) \* 100
- **Token Refresh Rate:** Refreshes per hour
- **Account Lockouts:** Lockouts per day
- **MFA Adoption:** Users with MFA enabled / Total users
- **Failed Login Attempts:** By IP and email

### Alerts

- 🚨 CRITICAL: Login success rate < 90%
- ⚠️ WARNING: Account lockouts > 50/hour
- ⚠️ WARNING: Failed attempts > 100/hour from single IP

---

## Related Modules

| Module           | Relationship | Purpose                    |
| ---------------- | ------------ | -------------------------- |
| `UsersModule`    | Imports      | User data access           |
| `CommonModule`   | Imports      | Shared utilities           |
| `EmailModule`    | Imports      | Send verification emails   |
| `RedisModule`    | Imports      | Session storage            |
| `OrdersModule`   | Imported by  | Protects order endpoints   |
| `PaymentsModule` | Imported by  | Protects payment endpoints |

---

## Migration Guides

### Migrating to Unified SessionManagementService (v2.0)

**Breaking Change:** SessionManagementService moved from `auth/services/` to
`common/security/`

**Migration Steps:**

1. Update imports: \`\`\`typescript // Old import { SessionManagementService }
   from './services/session-management.service';

// New import { SessionManagementService } from
'../common/security/session-management.service'; \`\`\`

2. Update auth.module.ts: \`\`\`typescript // Remove SessionManagementService
   from providers // Import from CommonModule instead @Module({ imports:
   [CommonModule], // SessionManagementService now available via CommonModule })
   \`\`\`

3. Run tests: `pnpm test auth`

---

## Owners & Support

### Primary Owner

**Team:** Backend Security Team **Contact:** security@foodwaste.com **Slack:**
#security-team

### On-Call

See [PagerDuty Schedule](https://pagerduty.com/schedules/auth)

---

## Additional Resources

- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Argon2 Specification](https://github.com/P-H-C/phc-winner-argon2)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)

---

**Last Reviewed:** November 21, 2025 **Next Review Due:** February 21, 2026
