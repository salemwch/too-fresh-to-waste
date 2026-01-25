# Users Module Documentation

## Overview

The Users module is a production-ready, enterprise-grade user management system implementing comprehensive authentication, authorization, privacy compliance, and security features for the Too Fresh To Waste platform.

**Module Path:** `apps/food-waste-backend/src/users/`

**Key Features:**
- User lifecycle management (CRUD operations)
- Multi-role authorization (Consumer, Merchant, Admin, Moderator)
- Privacy compliance (Tunisia Law No. 2004-63, GDPR, CCPA)
- Account security (lockout protection, audit logging)
- Phone verification (SMS-based with rate limiting)
- Profile management with image upload
- Soft delete with GDPR compliance
- Session and device tracking

---

## Architecture

### Design Patterns

- **Interface-based Dependency Injection**: `IUsersService` interface with `USERS_SERVICE_TOKEN` for testability and loose coupling
- **Service Layer Pattern**: Business logic isolated in services
- **Repository Pattern**: Mongoose models as data access layer
- **Audit Logging Pattern**: Comprehensive action tracking for compliance
- **Soft Delete Pattern**: GDPR-compliant data retention

### Module Structure

```
users/
├── user.module.ts                    # Module definition with providers
├── user.controller.ts                # Main REST API endpoints
├── user.service.ts                   # Core user business logic (1,477 LOC)
├── controllers/
│   └── privacy.controller.ts         # Privacy/GDPR compliance endpoints
├── services/
│   ├── mfa.service.ts                # Multi-factor authentication
│   ├── password-validation.service.ts # NIST/OWASP password validation
│   ├── privacy-compliance.service.ts # Privacy consent management
│   ├── session-management.service.ts # Multi-device session tracking
│   └── user-preferences.service.ts   # User preferences management
├── schemas/
│   └── user.schema.ts                # Mongoose schema (809 LOC)
├── DTO/
│   ├── create-user.dto.ts            # Registration input validation
│   ├── update-user.dto.ts            # Profile update validation
│   ├── send-phone-verification.dto.ts # Phone verification request
│   ├── verify-phone.dto.ts           # Phone verification code
│   ├── mfa.dto.ts                    # MFA-related DTOs
│   ├── privacy-consent.dto.ts        # Privacy consent DTOs
│   └── user-preferences.dto.ts       # User preferences DTOs
├── interfaces/
│   ├── users-service.interface.ts    # Service contract
│   └── privacy-consent.interface.ts  # Privacy compliance types
├── guards/
│   └── (to be populated)             # Custom authorization guards
├── decorators/
│   └── (to be populated)             # Custom decorators
└── utils/
    └── (to be populated)             # Utility functions
```

---

## Core Components

### 1. User Schema (`user.schema.ts`)

**Database Model:** MongoDB with Mongoose ODM

#### Core Fields

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| `email` | String | User email (lowercase normalized) | Required, unique index |
| `password` | String | Argon2id hashed password | Required, select: false |
| `firstName` | String | First name | Required |
| `lastName` | String | Last name | Required |
| `phoneNumber` | String | E.164 format phone | Optional, unique, sparse index |
| `role` | Enum | User role | CONSUMER, MERCHANT, ADMIN, MODERATOR |
| `status` | Enum | Account status | PENDING, ACTIVE, SUSPENDED, BLOCKED, DELETED, ANONYMIZED |
| `isEmailVerified` | Boolean | Email verification status | Default: false |
| `isPhoneVerified` | Boolean | Phone verification status | Default: false |
| `profileImage` | String | Profile image URL | Optional |

#### Security Fields

| Field | Type | Description |
|-------|------|-------------|
| `password` | String | Argon2id hash (memoryCost: 2^16, timeCost: 3) |
| `refreshTokens` | String[] | Active refresh tokens (rotation-based) |
| `lastTokenInvalidation` | Date | Timestamp for token fixation prevention |
| `tokenRevocationVersion` | Number | Global logout version counter |
| `emailVerificationToken` | String | Verification token |
| `phoneVerificationCode` | String | Hashed 6-digit code (Argon2id) |
| `phoneVerificationExpires` | Date | Code expiration (10 minutes) |
| `phoneVerificationAttempts` | Number | Failed verification attempts (max: 5) |
| `passwordResetToken` | String | Password reset token |
| `passwordResetExpires` | Date | Reset token expiration |
| `failedLoginAttempts` | Number | Failed login counter (max: 10) |
| `accountLockedUntil` | Date | Progressive lockout timestamp |
| `auditLog` | Array | Comprehensive action log (last 1,000 entries) |
| `loginHistory` | Array | Last 50 login records |

#### Privacy Compliance Fields

**Tunisia Compliance (Law No. 2004-63)**
- `tunisianCompliance.dataProcessingConsent`: Boolean
- `tunisianCompliance.locationTrackingConsent`: Boolean
- `tunisianCompliance.communicationConsent`: Boolean
- `tunisianCompliance.consentGivenAt`: Date
- `tunisianCompliance.consentVersion`: String
- `tunisianCompliance.legalBasisTunisia`: Enum (LegalBasis)

**International Compliance (GDPR/CCPA)**
- `internationalCompliance.marketingOptIn`: Boolean
- `internationalCompliance.analyticsOptIn`: Boolean
- `internationalCompliance.gdprConsentGiven`: Boolean
- `internationalCompliance.ccpaOptOutRequested`: Boolean
- `consentRecords`: Array of consent history
- `dataSubjectRights`: Deletion, portability, restriction requests

#### MFA Settings

```typescript
mfaSettings: {
  isEnabled: boolean;
  methods: Array<{
    type: 'totp' | 'sms' | 'email' | 'backup_codes';
    isActive: boolean;
    secret?: string;
    backupCodes?: string[];
    verified: boolean;
  }>;
  lastAuthAt?: Date;
  trustDeviceDays: number; // Default: 30
}
```

#### User Preferences

```typescript
preferences: {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  currency: string;
  notifications: {
    email: { marketing, orderUpdates, newOffers, weeklyDigest, securityAlerts };
    push: { orderUpdates, nearbyOffers, favoriteStoreOffers, newMessages };
    sms: { orderConfirmation, securityAlerts };
  };
  privacy: {
    profileVisibility: 'public' | 'friends' | 'private';
    showOnlineStatus: boolean;
    allowDataAnalytics: boolean;
  };
  discovery: {
    maxDistance: number; // meters
    preferredCategories: string[];
    minDiscount: number;
  };
}
```

#### Database Indexes (Performance Optimized)

```typescript
// Single Field Indexes
{ email: 1 } (unique)
{ phoneNumber: 1 } (sparse)
{ lastLoginAt: 1 } (sparse)
{ accountLockedUntil: 1 } (sparse)
{ deletedAt: 1 } (sparse)

// Compound Indexes
{ phoneNumber: 1, isPhoneVerified: 1 } (sparse)
{ status: 1, role: 1 }
{ role: 1, status: 1, createdAt: -1 }
{ failedLoginAttempts: 1, status: 1 }
{ isEmailVerified: 1, createdAt: -1 }
{ isAnonymized: 1, anonymizedAt: 1 } (sparse)

// Geospatial Index
{ 'address.coordinates.coordinates': '2dsphere' }

// Audit & Security Indexes
{ 'auditLog.timestamp': 1 }
{ 'mfaSettings.isEnabled': 1 }
{ 'privacySettings.dataSubjectRights.deletionRequested': 1 } (sparse)
```

---

### 2. User Service (`user.service.ts`)

**Implementation:** `IUsersService` interface with 1,477 lines of production code

#### Core Methods

##### User CRUD Operations

```typescript
create(createUserDto, auditData?): Promise<UserDocument>
  - Input validation (required fields, email format)
  - Email normalization (lowercase, trim)
  - Phone number normalization (E.164 format via libphonenumber)
  - Password strength validation (zxcvbn-based)
  - Duplicate check (email AND phone number)
  - Argon2id hashing (memoryCost: 2^16, timeCost: 3)
  - Privacy settings initialization
  - Security settings initialization
  - Audit log entry

findAll(page, limit, includeDeleted?): Promise<{ users, total, pagination }>
  - Pagination (max 100 per page)
  - Soft delete filtering
  - Performance: Uses .lean() for 50% memory reduction
  - Excludes sensitive fields (password, tokens)

findOne(id, includeDeleted?): Promise<User>
  - By MongoDB ObjectId
  - Soft delete aware
  - Returns sanitized user (no password/tokens)

update(id, updateUserDto): Promise<User>
  - Partial updates allowed
  - Returns updated user (sanitized)

softDelete(id, reason, auditData): Promise<void>
  - GDPR-compliant soft delete
  - Sets status to DELETED
  - Sets deletedAt timestamp
  - Records deletion reason
  - Audit log entry

restore(id, auditData): Promise<User>
  - Restores soft-deleted users
  - Sets status to ACTIVE
  - Clears deletedAt and deletionReason
  - Audit log entry

hardDelete(id): Promise<void>
  - Permanent deletion (GDPR right to erasure)
  - Irreversible operation
  - Logs warning
```

##### Authentication & Security Methods

```typescript
findByEmail(email): Promise<UserDocument>
  - Normalized email matching
  - Excludes soft-deleted users

updatePassword(userId, newPassword, auditData?): Promise<void>
  - Password history validation (prevents reuse)
  - Argon2id hashing
  - Resets failed login attempts
  - Clears account lockout
  - Updates password history (last N passwords)
  - Audit log entry

recordFailedLogin(userId, ipAddress, userAgent): Promise<{ isLocked, attemptsRemaining }>
  - @deprecated: Use AuthSecurityService instead
  - Increments failed attempt counter
  - Progressive lockout: 5min → 15min → 30min
  - Suspends account after 10 attempts
  - Audit log entry

resetFailedLoginAttempts(userId): Promise<void>
  - Resets attempt counter
  - Clears lockout timestamp
  - Reactivates account

isAccountLocked(userId): Promise<boolean>
  - Checks lockout expiration
  - Auto-unlocks expired locks

unlockAccount(userId, adminUserId, auditData): Promise<void>
  - Admin-initiated unlock
  - Resets attempts and lockout
  - Audit log entry with admin ID

updateLastLogin(userId, ipAddress, userAgent, location?): Promise<void>
  - Updates lastLoginAt timestamp
  - Appends to loginHistory (last 50)
  - Appends to auditLog (last 1,000)

markTokenInvalidation(userId): Promise<void>
  - Sets lastTokenInvalidation timestamp
  - Prevents token fixation attacks

incrementTokenRevocationVersion(userId): Promise<void>
  - Forces logout from all devices
  - Used for password change, account compromise
```

##### Phone Verification Methods

```typescript
sendPhoneVerificationCode(userId, phoneNumber, auditData?): Promise<IPhoneVerificationResult>
  - Generates secure 6-digit code (crypto.randomInt)
  - Hashes code with Argon2id
  - Normalizes phone to E.164 format
  - Rate limiting: 5 requests per hour
  - Duplicate phone check (across all users)
  - Expiration: 10 minutes
  - Sends SMS via Twilio
  - Audit log entry

verifyPhoneCode(userId, phoneNumber, code, auditData?): Promise<IPhoneVerificationResult>
  - Timing-safe code verification (Argon2.verify)
  - Attempt limiting: 5 attempts per code
  - Expiration check
  - Phone number match validation
  - Sets isPhoneVerified on success
  - Clears verification data
  - Audit log entry

resendPhoneVerificationCode(userId, phoneNumber, auditData?): Promise<IPhoneVerificationResult>
  - Wrapper around sendPhoneVerificationCode
  - Subject to same rate limiting
```

##### Privacy & Compliance Methods

```typescript
getComplianceSummary(userId): Promise<ComplianceSummary>
  - Tunisia compliance status
  - GDPR compliance status
  - CCPA compliance status
  - Last consent update timestamp
  - Pending actions list

searchUsers(query, page, limit): Promise<{ users, total }>
  - Case-insensitive regex search
  - Searches: firstName, lastName, email
  - Pagination support
  - Excludes soft-deleted users
  - Performance: Uses .lean()
```

##### Session & Device Management

```typescript
updateDeviceInfo(userId, deviceInfo): Promise<void>
  - Tracks user devices
  - Device fingerprinting
  - Updates last active timestamp
  - Device trust management (90-day expiration)
  - Audit log entry

addRefreshToken(userId, refreshToken): Promise<void>
  - Stores refresh token (replaces old)

removeRefreshToken(userId, refreshToken): Promise<void>
  - Removes specific refresh token

clearAllRefreshTokens(userId): Promise<void>
  - Clears all refresh tokens (logout from all devices)
```

##### MFA Methods (Backward Compatibility)

```typescript
findById(id): Promise<UserDocument | null>
activateMfa(userId, mfaData): Promise<void>
updateMfaSettings(userId, mfaUpdate): Promise<void>
updateMfaLastUsed(userId): Promise<void>
disableMfa(userId): Promise<void>
```

##### Analytics & Reporting

```typescript
getAuthenticationStats(fromDate, toDate): Promise<AuthStats>
  - Total users count
  - Active users (logged in within period)
  - Successful login count
  - Failed login count
  - Currently locked accounts
  - New registrations in period
  - Uses MongoDB aggregation pipeline

getAuditLog(userId, limit?): Promise<IAuditLogEntry[]>
  - Retrieves audit log entries
  - Sorted by timestamp (descending)
  - Default limit: 100
```

---

### 3. User Controller (`user.controller.ts`)

**Base Path:** `/api/v1/users`
**Security:** JWT Bearer authentication (except public endpoints)
**Swagger Tag:** `👥 User Management`

#### Endpoints

##### POST `/users` - Create User
- **Auth:** Public (no JWT required)
- **Body:** `CreateUserDto` (multipart/form-data)
- **File Upload:** Optional `profileImage` (max 5MB)
- **Image Processing:** Resizes to 400x400, JPEG format, 85% quality
- **Storage:** Local storage via `LocalStorageService`
- **Returns:** Created user with status 201
- **Errors:** 400 (validation), 409 (duplicate email/phone)

##### GET `/users` - List All Users (Admin Only)
- **Auth:** JWT + Admin role
- **Query Params:** `page` (default: 1), `limit` (default: 10, max: 100)
- **Returns:** Paginated user list with metadata
- **Response:**
  ```json
  {
    "statusCode": 200,
    "message": "Users retrieved successfully",
    "data": {
      "users": [...],
      "total": 150,
      "pagination": {
        "page": 1,
        "limit": 10,
        "totalPages": 15,
        "hasNext": true,
        "hasPrev": false
      }
    }
  }
  ```

##### GET `/users/profile` - Get Current User Profile
- **Auth:** JWT (authenticated user)
- **Returns:** Current user's profile
- **Errors:** 401 (unauthorized), 404 (user not found)

##### GET `/users/:id` - Get User by ID (Admin Only)
- **Auth:** JWT + Admin role
- **Params:** `id` (MongoDB ObjectId)
- **Returns:** User details
- **Errors:** 404 (user not found)

##### PATCH `/users/profile` - Update Own Profile
- **Auth:** JWT (authenticated user)
- **Body:** `UpdateUserDto` (partial updates)
- **Returns:** Updated user profile
- **Note:** TransformInterceptor adds statusCode and timestamp

##### PATCH `/users/profile/image` - Upload Profile Image
- **Auth:** JWT (authenticated user)
- **Body:** `profileImage` file (multipart/form-data)
- **Accepts:** JPEG, PNG, WebP (max 5MB)
- **Processing:** Resize to 400x400, convert to JPEG, 85% quality
- **Returns:** New profile image URL
- **Errors:** 400 (no file or invalid file)

##### PATCH `/users/:id` - Update User by ID (Admin Only)
- **Auth:** JWT + Admin role
- **Params:** `id` (MongoDB ObjectId)
- **Body:** `UpdateUserDto`
- **Returns:** Updated user
- **Errors:** 404 (user not found)

##### PATCH `/users/:id/status` - Update User Status (Admin Only)
- **Auth:** JWT + Admin role
- **Params:** `id` (MongoDB ObjectId)
- **Body:** `{ status: UserStatus }`
- **Returns:** Updated user
- **Errors:** 404 (user not found)

##### POST `/users/phone/verify-request` - Send Phone Verification Code
- **Auth:** JWT (authenticated user)
- **Body:** `SendPhoneVerificationDto` (`phoneNumber`)
- **Rate Limit:** 5 requests per hour
- **SMS Provider:** Twilio
- **Code:** 6-digit secure random code
- **Expiration:** 10 minutes
- **Returns:**
  ```json
  {
    "success": true,
    "message": "Verification code sent successfully. Please check your phone.",
    "attemptsRemaining": 4
  }
  ```
- **Errors:** 400 (rate limit, invalid phone), 409 (phone already registered)

##### POST `/users/phone/verify` - Verify Phone Number
- **Auth:** JWT (authenticated user)
- **Body:** `VerifyPhoneDto` (`phoneNumber`, `code`)
- **Attempt Limit:** 5 attempts per code
- **Returns:**
  ```json
  {
    "success": true,
    "message": "Phone number verified successfully"
  }
  ```
- **Errors:** 400 (invalid/expired code, max attempts exceeded)

##### POST `/users/phone/resend-code` - Resend Verification Code
- **Auth:** JWT (authenticated user)
- **Body:** `SendPhoneVerificationDto` (`phoneNumber`)
- **Rate Limit:** 5 requests per hour (shared with verify-request)
- **Returns:** Same as verify-request
- **Errors:** 400 (rate limit exceeded)

##### DELETE `/users/:id` - Delete User (Admin Only)
- **Auth:** JWT + Admin role
- **Params:** `id` (MongoDB ObjectId)
- **Behavior:** Soft delete (sets deletedAt, status=DELETED)
- **Returns:** 204 No Content
- **Errors:** 404 (user not found)
- **Note:** Hard delete available via service method for GDPR compliance

---

### 4. Privacy Controller (`privacy.controller.ts`)

**Base Path:** `/api/v1/users/privacy`
**Handles:** GDPR, CCPA, Tunisia Law compliance

#### Key Endpoints (Expected)
- Privacy consent management
- Data portability requests
- Right to erasure (GDPR Article 17)
- Data access requests
- Consent withdrawal
- Cookie consent management

---

### 5. Supporting Services

#### MfaService (`mfa.service.ts`)
- TOTP-based multi-factor authentication
- Backup codes generation
- Emergency tokens
- Device trust management

#### PasswordValidationService (`password-validation.service.ts`)
- NIST SP 800-63B compliance
- OWASP password guidelines
- zxcvbn-based strength scoring
- Dictionary/pattern detection
- User info validation (prevents using name, email in password)

#### PrivacyComplianceService (`privacy-compliance.service.ts`)
- Consent record management
- Legal basis tracking
- Data subject rights handling
- Compliance reporting
- Audit trail for privacy actions

#### SessionManagementService (`session-management.service.ts`)
- Multi-device session tracking
- Session revocation
- Concurrent session limits
- Device fingerprinting
- Suspicious activity detection

#### UserPreferencesService (`user-preferences.service.ts`)
- Notification preferences
- Theme/language settings
- Privacy preferences
- Discovery preferences
- Preference validation

---

## Security Model

### Password Security

**Hashing Algorithm:** Argon2id (winner of Password Hashing Competition)

**Parameters:**
```typescript
{
  type: argon2.argon2id,  // Hybrid of Argon2i and Argon2d
  memoryCost: 2 ** 16,    // 64 MiB memory cost
  timeCost: 3,            // 3 iterations
  parallelism: 1          // Single thread
}
```

**Password Validation:**
- Minimum 8 characters (configurable)
- Strength scoring (0-4 via zxcvbn)
- Dictionary attack prevention
- Pattern detection (keyboard patterns, repeated chars)
- Personal info validation (name, email, phone not in password)
- Password history enforcement (last N passwords)

### Account Lockout Protection

**Progressive Lockout Strategy:**
- **Threshold:** 10 failed login attempts (increased from 5 for usability)
- **First lockout (10-19 attempts):** 5 minutes
- **Second lockout (20-29 attempts):** 15 minutes
- **Third+ lockout (30+ attempts):** 30 minutes

**Auto-unlock:** Account automatically unlocks when lockout period expires

**Admin Override:** Admins can manually unlock accounts via `/users/:id/unlock` endpoint

### Phone Verification Security

**Code Generation:** Cryptographically secure 6-digit code (`crypto.randomInt(100000, 999999)`)

**Code Storage:** Hashed with Argon2id (never stored plain text)

**Security Measures:**
- Rate limiting: 5 requests per hour
- Attempt limiting: 5 verification attempts per code
- Expiration: 10 minutes
- Timing-safe comparison (Argon2.verify)
- Duplicate phone prevention
- Audit logging

### Token Security

**JWT Configuration:**
- Access token: Short-lived (15 minutes)
- Refresh token: Long-lived (7 days)
- Token rotation on refresh
- Token fixation prevention via `lastTokenInvalidation`
- Global revocation via `tokenRevocationVersion`

**Storage:**
- Access token: HttpOnly cookie (CSRF-protected)
- Refresh token: Stored in database (hashed)

### Audit Logging

**Comprehensive Action Tracking:**
- User registration
- Login success/failure
- Password changes
- Phone verification
- Account lockout/unlock
- Profile updates
- Device changes
- Privacy consent changes
- Admin actions

**Log Retention:** Last 1,000 entries per user (circular buffer)

**Audit Log Structure:**
```typescript
{
  action: string;           // Action identifier
  timestamp: Date;          // UTC timestamp
  ipAddress: string;        // Client IP
  userAgent: string;        // Client user agent
  details: {                // Action-specific metadata
    [key: string]: any;
  };
}
```

---

## Privacy & Compliance

### Tunisia Law No. 2004-63

**Required Consents:**
- Data processing consent
- Location tracking consent
- Communication consent

**Legal Basis Options:**
- Consent
- Contract execution
- Legal obligation
- Vital interests
- Public interest
- Legitimate interests

### GDPR Compliance (EU)

**Data Subject Rights:**
- Right to access (Article 15)
- Right to rectification (Article 16)
- Right to erasure (Article 17)
- Right to restriction (Article 18)
- Right to data portability (Article 20)
- Right to object (Article 21)

**Consent Management:**
- Freely given, specific, informed, unambiguous
- Granular consent (marketing, analytics, profiling)
- Withdrawable at any time
- Consent records with timestamps

### CCPA Compliance (California)

**Consumer Rights:**
- Right to know
- Right to delete
- Right to opt-out of sale
- Right to non-discrimination

**Opt-Out Mechanisms:**
- `ccpaOptOutRequested` flag
- Third-party sharing controls

### Data Retention & Deletion

**Soft Delete:**
- User data marked deleted but retained for legal compliance
- Status changed to DELETED
- `deletedAt` timestamp recorded
- Deletion reason logged

**Hard Delete (GDPR Article 17):**
- Permanent deletion from database
- Irreversible operation
- Used for right to erasure requests
- Logged with warning

**Anonymization:**
- PII removal while retaining analytics data
- `isAnonymized` flag
- `anonymizedAt` timestamp
- GDPR-compliant data retention

---

## Integration Points

### Dependencies (Other Modules)

```typescript
@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    OrdersModule,           // User order history
    FavoritesModule,        // User favorites
    forwardRef(() => ReviewsModule),  // User reviews (circular dependency)
    NotificationsModule,    // Notification preferences
    CommonModule,           // Shared utilities
  ]
})
```

### Service Exports

```typescript
exports: [
  MongooseModule,                   // User model for other modules
  USERS_SERVICE_TOKEN,              // Interface-based injection
  UsersService,                     // Concrete class (backward compat)
  PrivacyComplianceService,         // Privacy operations
  MfaService,                       // MFA operations
  SessionManagementService,         // Session tracking
  PasswordValidationService,        // Password validation
  UserPreferencesService            // Preferences management
]
```

### External Services

**SMS Notifications:**
- Provider: Twilio
- Service: `SmsNotificationService`
- Used for: Phone verification codes

**Phone Number Validation:**
- Library: libphonenumber-js
- Service: `PhoneNumberService`
- Format: E.164 international format

**Image Processing:**
- Service: `LocalStorageService`
- Operations: Resize, format conversion, quality optimization
- Storage: Local file system with URL generation

**Password Strength:**
- Library: zxcvbn (Dropbox)
- Service: `PasswordValidationService`
- Scoring: 0 (weak) to 4 (strong)

**Logging:**
- Service: `AppLoggerService`
- Format: Structured JSON logs
- Correlation ID: Request tracing

---

## API Usage Examples

### 1. User Registration

```bash
POST /api/v1/users
Content-Type: multipart/form-data

{
  "email": "consumer@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+21612345678",
  "role": "consumer",
  "profileImage": <file>
}

Response 201:
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": "64a1b2c3d4e5f6789a0b1c2d",
    "email": "consumer@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "consumer",
    "status": "pending",
    "isEmailVerified": false,
    "isPhoneVerified": false,
    "profileImage": "https://api.example.com/uploads/profile-images/abc123.jpg",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. Get User Profile

```bash
GET /api/v1/users/profile
Authorization: Bearer <access_token>

Response 200:
{
  "status": 200,
  "message": "User profile retrieved successfully",
  "data": {
    "id": "64a1b2c3d4e5f6789a0b1c2d",
    "email": "consumer@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "consumer",
    "status": "active",
    "isEmailVerified": true,
    "isPhoneVerified": true,
    "phoneNumber": "+21612345678",
    "profileImage": "https://api.example.com/uploads/profile-images/abc123.jpg",
    "preferences": { ... },
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-20T15:45:00.000Z"
  }
}
```

### 3. Update Profile

```bash
PATCH /api/v1/users/profile
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "firstName": "John Updated",
  "preferences": {
    "theme": "dark",
    "language": "fr"
  }
}

Response 200:
{
  "message": "Profile updated successfully",
  "statusCode": 200,
  "timestamp": "2024-01-20T15:50:00.000Z",
  "data": { ... }
}
```

### 4. Phone Verification Flow

**Step 1: Request verification code**
```bash
POST /api/v1/users/phone/verify-request
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "phoneNumber": "+21698765432"
}

Response 200:
{
  "success": true,
  "message": "Verification code sent successfully. Please check your phone.",
  "attemptsRemaining": 4
}
```

**Step 2: Verify code**
```bash
POST /api/v1/users/phone/verify
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "phoneNumber": "+21698765432",
  "code": "123456"
}

Response 200:
{
  "success": true,
  "message": "Phone number verified successfully"
}
```

### 5. Admin: List All Users

```bash
GET /api/v1/users?page=1&limit=20
Authorization: Bearer <admin_access_token>

Response 200:
{
  "statusCode": 200,
  "message": "Users retrieved successfully",
  "data": {
    "users": [...],
    "total": 150,
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

## Testing Guidelines

### Unit Tests

**File Naming:** `*.spec.ts` alongside source files

**Test Categories:**
- Service method tests (happy path + error cases)
- DTO validation tests
- Schema validation tests
- Utility function tests

**Example Test Structure:**
```typescript
describe('UsersService', () => {
  let service: UsersService;
  let model: Model<UserDocument>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        // ... other providers
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('create', () => {
    it('should create a new user with normalized email', async () => {
      // Test implementation
    });

    it('should throw ConflictException for duplicate email', async () => {
      // Test implementation
    });

    it('should validate password strength', async () => {
      // Test implementation
    });
  });

  describe('sendPhoneVerificationCode', () => {
    it('should generate and send verification code', async () => {
      // Test implementation
    });

    it('should enforce rate limiting', async () => {
      // Test implementation
    });
  });
});
```

### Integration Tests

**File Naming:** `*.e2e-spec.ts` in `test/` directory

**Test Scenarios:**
- Full registration flow
- Login and authentication
- Phone verification flow
- Profile update flow
- Admin operations

### Manual Testing

**Swagger UI:** `http://localhost:3000/api/v1/api-docs`

**Test Users:**
```bash
# Create test admin user
pnpm seed:admin

# Environment: .env
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=TestPassword123!
```

---

## Performance Considerations

### Database Query Optimization

**Indexes:** 15+ indexes covering all common query patterns

**Query Patterns:**
- Use `.lean()` for read-only queries (50% memory reduction)
- Exclude sensitive fields in selects
- Use pagination (max 100 per page)
- Use sparse indexes for optional fields

**Example:**
```typescript
// ✅ GOOD: Lean query with field selection
await this.userModel
  .find({ status: 'active' })
  .select('-password -refreshTokens')
  .lean()
  .exec();

// ❌ BAD: No lean, no field selection
await this.userModel.find({ status: 'active' }).exec();
```

### Audit Log Management

**Circular Buffer:** Last 1,000 entries per user
```typescript
$push: {
  auditLog: {
    $each: [newEntry],
    $slice: -1000  // Keep only last 1,000
  }
}
```

**Login History:** Last 50 entries per user
```typescript
$push: {
  loginHistory: {
    $each: [loginData],
    $slice: -50  // Keep only last 50
  }
}
```

### Caching Strategies

**Redis Integration:** Via `RedisModule`
- Session data caching
- Rate limiting counters
- Device fingerprints

**Cache Keys:**
- `user:session:{userId}`
- `ratelimit:phone:{userId}`
- `device:{deviceFingerprint}`

---

## Known Issues & Technical Debt

### Folder Naming
- `src/reviwes/` should be `src/reviews` (typo)
- Affects imports in `user.module.ts:17`

### Deprecated Methods
- `recordFailedLogin()` - Use `AuthSecurityService.recordFailedLoginAttempt()` instead
- `remove()` - Use `softDelete()` for GDPR compliance

### Circular Dependencies
```typescript
forwardRef(() => ReviewsModule)  // In user.module.ts
```

### TypeScript Strict Mode
- Disabled for gradual adoption
- Enable incrementally per file

---

## Migration & Maintenance

### Database Migrations

**Phone Number Normalization:**
```bash
# Dry run (preview changes)
pnpm migration:normalize-phones

# Execute migration
pnpm migration:normalize-phones:execute
```

**Index Verification:**
```bash
# Verify all indexes are created
pnpm verify:indexes
```

### Monitoring Commands

```bash
# Check TypeScript errors
pnpm check:ts

# Run linter
pnpm check:lint

# Run all checks
pnpm check:all

# View test coverage
pnpm test:cov
```

---

## Security Checklist

### Pre-Production Verification

- [ ] All environment variables configured (`.env` from `.env.example`)
- [ ] JWT secrets generated (64+ character random strings)
- [ ] Database indexes verified (`pnpm verify:indexes`)
- [ ] Rate limiting enabled (Redis required)
- [ ] Sentry DSN configured for error tracking
- [ ] CORS whitelist configured (no wildcard in production)
- [ ] Helmet security headers enabled
- [ ] SSL/TLS enabled (HTTPS only)
- [ ] Password policy validated (NIST/OWASP compliant)
- [ ] Phone verification SMS provider configured (Twilio)
- [ ] Email verification provider configured
- [ ] Audit logging enabled
- [ ] Session management configured
- [ ] MFA available for high-privilege users
- [ ] Privacy policy URL configured
- [ ] GDPR data retention policy documented
- [ ] Backup strategy implemented
- [ ] Monitoring and alerting configured

### Security Testing

- [ ] Brute force protection tested (account lockout)
- [ ] SQL injection prevention tested (Mongoose protects)
- [ ] XSS prevention tested (global sanitization middleware)
- [ ] CSRF protection tested (CsrfService)
- [ ] JWT token validation tested
- [ ] Refresh token rotation tested
- [ ] Phone verification rate limiting tested
- [ ] Password strength validation tested
- [ ] Sensitive data exposure tested (no passwords in responses)
- [ ] Audit log integrity tested

---

## Future Enhancements

### Planned Features
1. **OAuth Integration** - Google, Facebook, Apple Sign In
2. **Passwordless Authentication** - Magic links, WebAuthn
3. **Advanced MFA** - Hardware tokens (YubiKey), biometric
4. **User Impersonation** - Admin support feature
5. **Bulk Operations** - CSV import/export for admins
6. **Advanced Analytics** - User behavior tracking
7. **Geo-fencing** - Location-based access control
8. **Risk-Based Authentication** - Adaptive MFA
9. **Session Replay** - Security investigation tool
10. **Compliance Dashboard** - Real-time compliance metrics

### Technical Improvements
- Implement event-driven architecture (Bull queues)
- Add GraphQL support
- Implement CQRS pattern for read/write separation
- Add Redis caching layer
- Implement full-text search (Elasticsearch)
- Add real-time notifications (WebSockets)

---

## Support & Resources

### Documentation
- [NestJS Official Docs](https://docs.nestjs.com/)
- [Mongoose Documentation](https://mongoosejs.com/docs/guide.html)
- [Argon2 Security](https://www.argon2.com/)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [OWASP Cheat Sheets](https://cheatsheetseries.owasp.org/)

### Compliance Resources
- [GDPR Official Text](https://gdpr-info.eu/)
- [CCPA Official Site](https://oag.ca.gov/privacy/ccpa)
- [Tunisia Data Protection Law](https://www.inpdp.tn/)

### Contact
For technical questions or bug reports, create an issue in the project repository.

---

**Last Updated:** 2026-01-15
**Module Version:** 1.0.0
**NestJS Version:** 11.x
**MongoDB Version:** 6.18.x
**Node.js Version:** 24.11.1
