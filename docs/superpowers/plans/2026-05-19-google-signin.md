# Google Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google Sign-In (token-exchange flow) to the NestJS backend, React
Native consumer app, and Next.js merchant web app — no OAuth redirects, no
Passport strategy, one endpoint.

**Architecture:** Frontend calls the Google SDK → receives an ID token → POSTs
`{ idToken }` to `POST /api/v1/auth/google` → backend verifies with
`google-auth-library`, resolves or creates the user through a 4-case decision
tree, then issues our own JWT tokens using the existing `TokenService` —
identical session pipeline to email/password login.

**Tech Stack:** `google-auth-library` (backend),
`@react-native-google-signin/google-signin` (mobile), `@react-oauth/google`
(web)

**Spec:** `docs/superpowers/specs/2026-05-19-google-signin-design.md`

---

## Phase 1 — Backend

### Task 1: Install `google-auth-library` and register env vars

**Files:**

- Modify: `apps/food-waste-backend/package.json` (via pnpm)
- Modify: `apps/food-waste-backend/.env` (add `GOOGLE_CLIENT_ID`)
- Modify: `apps/food-waste-backend/.env.example` (add placeholder)

- [ ] **Step 1: Install the package**

```bash
pnpm --filter @foodwaste/backend add google-auth-library
```

Expected: `google-auth-library` appears in
`apps/food-waste-backend/package.json` dependencies.

- [ ] **Step 2: Add the env var**

In `apps/food-waste-backend/.env` add:

```
GOOGLE_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com
```

In `apps/food-waste-backend/.env.example` add:

```
GOOGLE_CLIENT_ID=
```

- [ ] **Step 3: Commit**

```bash
git add apps/food-waste-backend/package.json pnpm-lock.yaml apps/food-waste-backend/.env.example
git commit -m "chore(backend): add google-auth-library dependency"
```

---

### Task 2: Update User schema — add `googleId`, `authProvider`, make `password` optional

**Files:**

- Modify: `apps/food-waste-backend/src/users/schemas/user.schema.ts`

Current state (lines 55–56):

```typescript
@Prop({ required: true })
password!: string;
```

- [ ] **Step 1: Make `password` optional at schema level**

In `apps/food-waste-backend/src/users/schemas/user.schema.ts`, replace the
`password` prop (line 55–56):

```typescript
@Prop({ required: false })
password?: string;
```

- [ ] **Step 2: Add `googleId` field after `password`**

After the (now-optional) `password` prop, add:

```typescript
@Prop({ type: String })
googleId?: string;

@Prop({
  type: String,
  enum: ['local', 'google', 'facebook', 'apple'],
  default: 'local',
})
authProvider!: string;
```

- [ ] **Step 3: Add sparse unique index for `googleId` at the bottom of the
      file**

After the existing index declarations (after line ~892 in `user.schema.ts`),
add:

```typescript
UserSchema.index({ googleId: 1 }, { unique: true, sparse: true });
```

- [ ] **Step 4: Run type-check to verify no regressions**

```bash
pnpm --filter @foodwaste/backend type-check
```

Expected: 0 errors. If there are errors about `password` being possibly
undefined, they are in `auth.service.ts` `login()` — fix in Task 3.

- [ ] **Step 5: Commit**

```bash
git add apps/food-waste-backend/src/users/schemas/user.schema.ts
git commit -m "feat(backend): add googleId + authProvider to User schema, make password optional"
```

---

### Task 3: Guard email/password login against Google-only accounts

**Files:**

- Modify: `apps/food-waste-backend/src/auth/auth.service.ts`

The `login()` method currently calls
`argon2.verify(user.password, loginDto.password)`. If `user.password` is
`undefined` (Google-only user), `argon2.verify` throws. Add a null-guard before
it.

- [ ] **Step 1: Locate the argon2.verify call in auth.service.ts**

Search for `argon2.verify` in
`apps/food-waste-backend/src/auth/auth.service.ts`. It will be inside the
`login()` method.

- [ ] **Step 2: Add null-guard before argon2.verify**

Immediately before the `argon2.verify` call, add:

```typescript
if (!user.password) {
  throw new UnauthorizedException(
    'This account uses Google Sign-In. Please sign in with Google.',
  );
}
```

- [ ] **Step 3: Run type-check**

```bash
pnpm --filter @foodwaste/backend type-check
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/food-waste-backend/src/auth/auth.service.ts
git commit -m "fix(backend): guard login endpoint against Google-only accounts"
```

---

### Task 4: Add Google-specific methods to `UsersService`

**Files:**

- Modify: `apps/food-waste-backend/src/users/user.service.ts`

Add four methods at the end of the public API section (after line ~466
`findByEmail`).

- [ ] **Step 1: Add `findByGoogleId()`**

```typescript
async findByGoogleId(googleId: string): Promise<UserDocument | null> {
  return this.userModel.findOne({ googleId, deletedAt: null }).exec();
}
```

- [ ] **Step 2: Add `linkGoogleId()` — for existing verified accounts**

```typescript
async linkGoogleId(userId: string, googleId: string): Promise<UserDocument> {
  const updated = await this.userModel
    .findByIdAndUpdate(
      userId,
      { $set: { googleId, authProvider: 'google' } },
      { new: true },
    )
    .exec();
  if (!updated) throw new NotFoundException(`User ${userId} not found`);
  return updated;
}
```

- [ ] **Step 3: Add `linkGoogleToSquattedAccount()` — for unverified (squatted)
      accounts**

```typescript
async linkGoogleToSquattedAccount(userId: string, googleId: string): Promise<UserDocument> {
  const updated = await this.userModel
    .findByIdAndUpdate(
      userId,
      {
        $set: {
          googleId,
          authProvider: 'google',
          isEmailVerified: true,
          password: undefined,
        },
        $inc: { tokenRevocationVersion: 1 },
        $unset: { password: '' },
      },
      { new: true },
    )
    .exec();
  if (!updated) throw new NotFoundException(`User ${userId} not found`);
  return updated;
}
```

- [ ] **Step 4: Add `createGoogleUser()` — for brand-new social accounts**

`UserRole` and `UserStatus` are already imported at the top of `user.service.ts`
(re-exported from `user.schema.ts`). Use them directly.

````typescript
async createGoogleUser(data: {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
}): Promise<UserDocument> {
  const user = new this.userModel({
    email: data.email.trim().toLowerCase(),
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    googleId: data.googleId,
    authProvider: 'google',
    isEmailVerified: true,
    role: UserRole.CONSUMER,
    status: UserStatus.ACTIVE,
    refreshTokens: [],
    tokenRevocationVersion: 0,
  });
  return user.save();
}

- [ ] **Step 5: Run type-check**

```bash
pnpm --filter @foodwaste/backend type-check
````

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/food-waste-backend/src/users/user.service.ts
git commit -m "feat(backend): add Google-specific user methods to UsersService"
```

---

### Task 5: Add `sendGoogleLinkedEmail` to `EmailService`

**Files:**

- Modify: `apps/food-waste-backend/src/email/email.service.ts`

- [ ] **Step 1: Add the method after `sendWelcomeEmail`**

In `apps/food-waste-backend/src/email/email.service.ts`, add after the
`sendWelcomeEmail` method:

```typescript
async sendGoogleLinkedEmail(email: string, firstName: string): Promise<boolean> {
  const appUrl = this.getFrontendUrl();
  return this.sendEmail({
    to: email,
    subject: 'Google Sign-In linked to your account',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2>Google Sign-In linked</h2>
        <p>Hi ${firstName},</p>
        <p>Google Sign-In has been linked to your Too Fresh To Waste account (<strong>${email}</strong>).</p>
        <p>You can now sign in with either your password or Google.</p>
        <p>If you did not request this, please <a href="${appUrl}/contact">contact support</a> immediately.</p>
      </div>
    `,
    text: `Hi ${firstName}, Google Sign-In was linked to your Too Fresh To Waste account (${email}). If you did not request this, contact support immediately.`,
  });
}
```

- [ ] **Step 2: Run type-check**

```bash
pnpm --filter @foodwaste/backend type-check
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/food-waste-backend/src/email/email.service.ts
git commit -m "feat(backend): add sendGoogleLinkedEmail notification"
```

---

### Task 6: Create `GoogleAuthDto` and `GoogleAuthService`

**Files:**

- Create: `apps/food-waste-backend/src/auth/DTO/google-auth.dto.ts`
- Create: `apps/food-waste-backend/src/auth/services/google-auth.service.ts`

- [ ] **Step 1: Create the DTO**

Create `apps/food-waste-backend/src/auth/DTO/google-auth.dto.ts`:

```typescript
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleAuthDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}
```

- [ ] **Step 2: Create `GoogleAuthService`**

Create `apps/food-waste-backend/src/auth/services/google-auth.service.ts`:

```typescript
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

import { UserRole, UserStatus } from '@foodwaste/shared';
import { EmailService } from 'src/email/email.service';
import { UsersService } from 'src/users/user.service';

import { TokenService } from './token.service';
import type { UserDocument } from 'src/users/schemas/user.schema';
import type { UserResponse, AuthTokens } from '../auth.service';

export interface GoogleSignInResult {
  user: UserResponse;
  tokens: AuthTokens;
}

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly oauth2Client: OAuth2Client;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
  ) {
    this.oauth2Client = new OAuth2Client(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  async signIn(
    idToken: string,
    requestInfo: { ipAddress: string; userAgent: string },
  ): Promise<GoogleSignInResult> {
    // 1. Verify token with Google
    let payload: Awaited<
      ReturnType<OAuth2Client['verifyIdToken']>
    > extends Promise<infer R>
      ? R
      : never;
    try {
      const ticket = await this.oauth2Client.verifyIdToken({
        idToken,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });
      payload = ticket.getPayload();
    } catch (err) {
      this.logger.warn('Google token verification failed', {
        error: (err as Error).message,
      });
      throw new UnauthorizedException('Invalid Google token');
    }

    if (!payload) {
      throw new UnauthorizedException('Empty Google token payload');
    }

    // 2. Explicit email_verified check (spec requirement)
    if (!payload.email_verified) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    const googleId = payload.sub;
    const email = payload.email!;
    const firstName = payload.given_name ?? '';
    const lastName = payload.family_name ?? '';

    // 3. Resolve user via 4-case decision tree
    let user = await this.usersService.findByGoogleId(googleId);

    if (!user) {
      const existing = await this.usersService.findByEmail(email);

      if (existing) {
        if (existing.isEmailVerified) {
          // Case 2: existing verified account — link and notify
          user = await this.usersService.linkGoogleId(
            existing._id.toString(),
            googleId,
          );
          void this.emailService
            .sendGoogleLinkedEmail(email, existing.firstName)
            .catch(err =>
              this.logger.warn('Failed to send Google-linked email', {
                error: (err as Error).message,
              }),
            );
        } else {
          // Case 3: squatted unverified account — recover and link
          user = await this.usersService.linkGoogleToSquattedAccount(
            existing._id.toString(),
            googleId,
          );
        }
      } else {
        // Case 4: no account — create fresh Google user
        user = await this.usersService.createGoogleUser({
          googleId,
          email,
          firstName,
          lastName,
        });
      }
    }
    // Case 1: user found by googleId — fall through to token generation

    // 4. Generate JWT tokens using existing TokenService pipeline
    const tokenPair = await this.tokenService.generateTokenPair(
      user._id.toString(),
      user.email,
      user.role as UserRole,
      { ipAddress: requestInfo.ipAddress, userAgent: requestInfo.userAgent },
      undefined,
      undefined,
      user.tokenRevocationVersion ?? 0,
      false,
    );

    return {
      user: this.toUserResponse(user),
      tokens: {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: 900,
        tokenType: 'Bearer',
      },
    };
  }

  private toUserResponse(user: UserDocument): UserResponse {
    return {
      userId: user._id.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role as UserRole,
      status: user.status as UserStatus,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      profileImage: user.profileImage ?? null,
      phoneNumber: user.phoneNumber,
      createdAt: user.createdAt ?? new Date(),
      updatedAt: user.updatedAt ?? new Date(),
      lastLoginAt: user.lastLoginAt,
    };
  }
}
```

- [ ] **Step 3: Run type-check**

```bash
pnpm --filter @foodwaste/backend type-check
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/food-waste-backend/src/auth/DTO/google-auth.dto.ts \
        apps/food-waste-backend/src/auth/services/google-auth.service.ts
git commit -m "feat(backend): add GoogleAuthDto and GoogleAuthService"
```

---

### Task 7: Register `GoogleAuthService` in `AuthModule` and add `POST /auth/google` endpoint

**Files:**

- Modify: `apps/food-waste-backend/src/auth/auth.module.ts`
- Modify: `apps/food-waste-backend/src/auth/auth.controller.ts`

- [ ] **Step 1: Register `GoogleAuthService` in `AuthModule`**

In `apps/food-waste-backend/src/auth/auth.module.ts`:

Add to imports at top of file:

```typescript
import { GoogleAuthService } from './services/google-auth.service';
```

In the `providers` array, add `GoogleAuthService` after `MfaService`:

```typescript
GoogleAuthService,
```

In the `exports` array, add:

```typescript
GoogleAuthService,
```

- [ ] **Step 2: Inject `GoogleAuthService` in `AuthController`**

In `apps/food-waste-backend/src/auth/auth.controller.ts`:

Add import at the top:

```typescript
import { GoogleAuthService } from './services/google-auth.service';
import { GoogleAuthDto } from './DTO/google-auth.dto';
```

In the constructor (after `private readonly usersService: UsersService,`), add:

```typescript
private readonly googleAuthService: GoogleAuthService,
```

- [ ] **Step 3: Add `POST /auth/google` endpoint**

In `apps/food-waste-backend/src/auth/auth.controller.ts`, add this method after
the `register()` method (around line 169):

```typescript
@Post('google')
@Public()
@HttpCode(HttpStatus.OK)
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 600000 } })
@ApiOperation({ summary: 'Sign in or register with Google ID token' })
async googleSignIn(
  @Body() dto: GoogleAuthDto,
  @Request() req: ExpressRequest,
  @Response({ passthrough: true }) res: ExpressResponse,
) {
  const requestInfo = {
    ipAddress: req.ip ?? req.socket?.remoteAddress ?? 'unknown',
    userAgent: req.get('User-Agent') ?? 'unknown',
  };

  const { user, tokens } = await this.googleAuthService.signIn(dto.idToken, requestInfo);

  const sessionInfo = await this.sessionManagementService.createSession({
    userId: user.userId,
    userAgent: requestInfo.userAgent,
    ipAddress: requestInfo.ipAddress,
    rememberMe: false,
  });

  this.setAuthCookies(res, tokens, sessionInfo.sessionId);

  return {
    success: true,
    message: 'Google sign-in successful',
    user,
    tokens,
    sessionId: sessionInfo.sessionId,
    deviceInfo: {
      deviceName: sessionInfo.deviceInfo.deviceName,
      platform: sessionInfo.deviceInfo.platform,
      browser: sessionInfo.deviceInfo.browser,
    },
  };
}
```

- [ ] **Step 4: Run type-check**

```bash
pnpm --filter @foodwaste/backend type-check
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/food-waste-backend/src/auth/auth.module.ts \
        apps/food-waste-backend/src/auth/auth.controller.ts
git commit -m "feat(backend): add POST /auth/google endpoint"
```

---

### Task 8: Unit tests for `GoogleAuthService`

**Files:**

- Create:
  `apps/food-waste-backend/src/auth/services/google-auth.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/food-waste-backend/src/auth/services/google-auth.service.spec.ts`:

```typescript
import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

import { GoogleAuthService } from './google-auth.service';
import { TokenService } from './token.service';
import { UsersService } from 'src/users/user.service';
import { EmailService } from 'src/email/email.service';
import { UserRole, UserStatus } from '@foodwaste/shared';

jest.mock('google-auth-library');

const mockPayload = {
  sub: 'google-uid-123',
  email: 'user@gmail.com',
  email_verified: true,
  given_name: 'John',
  family_name: 'Doe',
};

const mockUserDoc = (overrides = {}) => ({
  _id: { toString: () => 'user-db-id' },
  email: 'user@gmail.com',
  firstName: 'John',
  lastName: 'Doe',
  role: UserRole.CONSUMER,
  status: UserStatus.ACTIVE,
  isEmailVerified: true,
  isPhoneVerified: false,
  tokenRevocationVersion: 0,
  profileImage: null,
  ...overrides,
});

const mockTokenPair = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  jti: 'jti',
  familyId: 'fid',
};

const requestInfo = { ipAddress: '127.0.0.1', userAgent: 'jest' };

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;
  let usersService: jest.Mocked<UsersService>;
  let tokenService: jest.Mocked<TokenService>;
  let emailService: jest.Mocked<EmailService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GoogleAuthService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('google-client-id') },
        },
        {
          provide: UsersService,
          useValue: {
            findByGoogleId: jest.fn(),
            findByEmail: jest.fn(),
            linkGoogleId: jest.fn(),
            linkGoogleToSquattedAccount: jest.fn(),
            createGoogleUser: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: {
            generateTokenPair: jest.fn().mockResolvedValue(mockTokenPair),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendGoogleLinkedEmail: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get(GoogleAuthService);
    usersService = module.get(UsersService);
    tokenService = module.get(TokenService);
    emailService = module.get(EmailService);

    // Mock OAuth2Client.verifyIdToken to return our mock payload
    (OAuth2Client as jest.MockedClass<typeof OAuth2Client>).mockImplementation(
      () =>
        ({
          verifyIdToken: jest.fn().mockResolvedValue({
            getPayload: () => mockPayload,
          }),
        }) as unknown as OAuth2Client,
    );
  });

  it('rejects when email_verified is false', async () => {
    (OAuth2Client as jest.MockedClass<typeof OAuth2Client>).mockImplementation(
      () =>
        ({
          verifyIdToken: jest.fn().mockResolvedValue({
            getPayload: () => ({ ...mockPayload, email_verified: false }),
          }),
        }) as unknown as OAuth2Client,
    );

    await expect(service.signIn('id-token', requestInfo)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('Case 1: logs in when user found by googleId', async () => {
    usersService.findByGoogleId.mockResolvedValue(mockUserDoc() as any);

    const result = await service.signIn('id-token', requestInfo);

    expect(usersService.findByEmail).not.toHaveBeenCalled();
    expect(result.user.email).toBe('user@gmail.com');
    expect(result.tokens.accessToken).toBe('access-token');
  });

  it('Case 2: links googleId and notifies when existing verified account', async () => {
    usersService.findByGoogleId.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue(
      mockUserDoc({ isEmailVerified: true }) as any,
    );
    usersService.linkGoogleId.mockResolvedValue(mockUserDoc() as any);

    await service.signIn('id-token', requestInfo);

    expect(usersService.linkGoogleId).toHaveBeenCalledWith(
      'user-db-id',
      'google-uid-123',
    );
    expect(emailService.sendGoogleLinkedEmail).toHaveBeenCalledWith(
      'user@gmail.com',
      'John',
    );
  });

  it('Case 3: nulls password and revokes tokens for squatted unverified account', async () => {
    usersService.findByGoogleId.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue(
      mockUserDoc({ isEmailVerified: false }) as any,
    );
    usersService.linkGoogleToSquattedAccount.mockResolvedValue(
      mockUserDoc() as any,
    );

    await service.signIn('id-token', requestInfo);

    expect(usersService.linkGoogleToSquattedAccount).toHaveBeenCalledWith(
      'user-db-id',
      'google-uid-123',
    );
    expect(emailService.sendGoogleLinkedEmail).not.toHaveBeenCalled();
  });

  it('Case 4: creates new user when no account exists', async () => {
    usersService.findByGoogleId.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue(null);
    usersService.createGoogleUser.mockResolvedValue(mockUserDoc() as any);

    await service.signIn('id-token', requestInfo);

    expect(usersService.createGoogleUser).toHaveBeenCalledWith({
      googleId: 'google-uid-123',
      email: 'user@gmail.com',
      firstName: 'John',
      lastName: 'Doe',
    });
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail (TDD red)**

```bash
pnpm --filter @foodwaste/backend test -- --testPathPattern=google-auth.service.spec
```

Expected: tests fail because `GoogleAuthService` is not yet complete or imports
are unresolved. (If they pass, verify the mocks are actually isolating the real
implementations.)

- [ ] **Step 3: Run tests again after Task 6 is complete**

```bash
pnpm --filter @foodwaste/backend test -- --testPathPattern=google-auth.service.spec
```

Expected: all 5 tests pass (1 rejection + 4 resolution cases).

- [ ] **Step 4: Commit**

```bash
git add apps/food-waste-backend/src/auth/services/google-auth.service.spec.ts
git commit -m "test(backend): unit tests for GoogleAuthService (4 resolution paths)"
```

---

## Phase 2 — Mobile (React Native Consumer)

### Task 9: Install `@react-native-google-signin/google-signin` and add env var

**Files:**

- Modify: `apps/mobile/package.json` (via pnpm)
- Modify: `apps/mobile/.env` (add `GOOGLE_WEB_CLIENT_ID`)

- [ ] **Step 1: Install the package**

```bash
pnpm --filter @foodwaste/mobile add @react-native-google-signin/google-signin
```

Expected: package appears in `apps/mobile/package.json`.

- [ ] **Step 2: Add env var**

In `apps/mobile/.env`:

```
GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

> **Important:** This is the **Web** client ID (not Android), even on Android
> devices. The web client ID is required for `idToken` generation.

- [ ] **Step 3: Add `google-services.json`**

Download `google-services.json` from Firebase Console (same project used for
push notifications) and place it at:

```
apps/mobile/android/app/google-services.json
```

Verify `apps/mobile/android/app/build.gradle` already has
`apply plugin: 'com.google.gms.google-services'` at the bottom. If not, add it.

- [ ] **Step 4: Register Android SHA-1 fingerprint**

In Google Cloud Console → OAuth 2.0 credentials → Android client → add your
debug keystore SHA-1:

```bash
# Get debug SHA-1
cd apps/mobile/android && ./gradlew signingReport 2>&1 | grep -A2 "Variant: debug"
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/package.json pnpm-lock.yaml
git commit -m "chore(mobile): add @react-native-google-signin/google-signin"
```

---

### Task 10: Add `googleSignIn()` to mobile `authService`

**Files:**

- Modify: `apps/mobile/src/features/auth/services/authService.ts`

- [ ] **Step 1: Add the method**

In `apps/mobile/src/features/auth/services/authService.ts`, find the `login()`
method and add `googleSignIn` immediately after:

```typescript
async googleSignIn(idToken: string): Promise<LoginResponse> {
  return this.makeRequest<LoginResponse>('POST', '/google', { idToken });
}
```

The `LoginResponse` type is already imported from `'../types'`.

- [ ] **Step 2: Run type-check**

```bash
pnpm --filter @foodwaste/mobile type-check
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/auth/services/authService.ts
git commit -m "feat(mobile): add googleSignIn method to authService"
```

---

### Task 11: Add `googleSignInAsync` thunk and reducers to `authSlice`

**Files:**

- Modify: `apps/mobile/src/features/auth/store/authSlice.ts`

- [ ] **Step 1: Add the thunk after `loginAsync`**

In `apps/mobile/src/features/auth/store/authSlice.ts`, after the `loginAsync`
thunk (around line 119), add:

```typescript
export const googleSignInAsync = createAsyncThunk(
  'auth/googleSignIn',
  async (idToken: string, { rejectWithValue }) => {
    try {
      const response = await authService.googleSignIn(idToken);

      // Fire-and-forget persistence — same pattern as loginAsync
      backgroundStorage.execute('google-login-persist', async () => {
        const expiresAt = new Date(
          Date.now() + response.tokens.expiresIn * 1000,
        );
        await Promise.all([
          SecureStorage.setTokens(
            response.tokens.accessToken,
            response.tokens.refreshToken,
          ),
          SecureStorage.setUserData(JSON.stringify(response.user)),
          SecureStorage.setSessionMetadata(
            expiresAt.toISOString(),
            new Date().toISOString(),
          ),
        ]);
      });

      return response;
    } catch (error) {
      Logger.error('Google sign-in failed', {}, error as Error);

      let errorMessage = 'Google sign-in failed';
      if (error !== null && error !== undefined && typeof error === 'object') {
        const errObj = error as Record<string, unknown>;
        if (typeof errObj['message'] === 'string') {
          errorMessage = errObj['message'];
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return rejectWithValue({ message: errorMessage });
    }
  },
);
```

- [ ] **Step 2: Add reducers in `extraReducers`**

In the `extraReducers` builder section (after `loginAsync.rejected`), add:

```typescript
// Google Sign-In
builder.addCase(googleSignInAsync.pending, state => {
  state.isLoading = true;
  state.error = undefined;
});

builder.addCase(googleSignInAsync.fulfilled, (state, action) => {
  state.isLoading = false;
  state.error = undefined;
  state.user = action.payload.user as User;
  state.isAuthenticated = true;
  state.lastLoginTime = Date.now();
  state.sessionExpiresAt = Date.now() + action.payload.tokens.expiresIn * 1000;
  state.flowState = AuthFlowState.AUTHENTICATED;
  state.pendingVerificationEmail = undefined;
  state.pendingVerificationPhone = undefined;
  state.mfaToken = undefined;
  state.isUserSynced = true;
});

builder.addCase(googleSignInAsync.rejected, (state, action) => {
  state.isLoading = false;
  const payload = action.payload as { message?: string } | undefined;
  state.error =
    payload?.message != null && payload.message !== ''
      ? payload.message
      : 'Google sign-in failed';
  state.isAuthenticated = false;
  state.user = null;
  state.flowState = AuthFlowState.UNAUTHENTICATED;
});
```

- [ ] **Step 3: Export `googleSignInAsync` if not already exported**

The `export const googleSignInAsync` declaration in step 1 already exports it.

- [ ] **Step 4: Run type-check**

```bash
pnpm --filter @foodwaste/mobile type-check
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/auth/store/authSlice.ts
git commit -m "feat(mobile): add googleSignInAsync thunk to authSlice"
```

---

### Task 12: Configure `GoogleSignin` in `App.tsx`

**Files:**

- Modify: `apps/mobile/src/App.tsx`

- [ ] **Step 1: Add import at the top of `App.tsx`**

```typescript
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Config } from 'react-native-config';
```

(`Config` is already imported — skip that line if it exists.)

- [ ] **Step 2: Add `GoogleSignin.configure()` inside `AppContent`**

In `AppContent()`, after the existing `localLocationService.initialize()`
useEffect (around line 103), add a new one-time `useEffect`:

```typescript
useEffect(() => {
  GoogleSignin.configure({
    webClientId: Config['GOOGLE_WEB_CLIENT_ID'] ?? '',
  });
}, []);
```

- [ ] **Step 3: Run type-check**

```bash
pnpm --filter @foodwaste/mobile type-check
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/App.tsx
git commit -m "feat(mobile): configure GoogleSignin in App.tsx"
```

---

### Task 13: Add Google Sign-In button to `LoginScreen` and `RegisterScreen`

**Files:**

- Create: `apps/mobile/src/features/auth/components/GoogleSignInButton.tsx`
- Modify: `apps/mobile/src/features/auth/screens/LoginScreen.tsx`
- Modify: `apps/mobile/src/features/auth/screens/RegisterScreen.tsx`

- [ ] **Step 1: Create `GoogleSignInButton` component**

Create `apps/mobile/src/features/auth/components/GoogleSignInButton.tsx`:

```typescript
import React, { useState } from 'react';
import { Pressable, View, StyleSheet, ActivityIndicator } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

import Toast from 'react-native-toast-message';
import { Text } from '@/design-system/components/atoms';
import { useAppDispatch } from '@/hooks/redux';
import { Logger } from '@/utils/logger';

import { googleSignInAsync } from '../store/authSlice';

export function GoogleSignInButton() {
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        Toast.show({ type: 'error', text1: 'Sign-in failed', text2: 'Could not retrieve Google token. Please try again.' });
        return;
      }

      await dispatch(googleSignInAsync(idToken)).unwrap();
      // Navigation is driven by AuthFlowState — no explicit navigate() needed
    } catch (error: any) {
      if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
        // User dismissed — silent
      } else if (error?.code === statusCodes.IN_PROGRESS) {
        // Already in progress — silent
      } else if (error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Toast.show({ type: 'error', text1: 'Sign-in unavailable', text2: 'Google Play Services is not available on this device.' });
      } else {
        Logger.error('Google sign-in error', {}, error);
        Toast.show({ type: 'error', text1: 'Sign-in failed', text2: error?.message ?? 'An unexpected error occurred.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      onPress={handleGoogleSignIn}
      disabled={isLoading}
      accessibilityRole='button'
      accessibilityLabel='Continue with Google'
    >
      {isLoading ? (
        <ActivityIndicator size='small' color='#4285F4' />
      ) : (
        <View style={styles.row}>
          {/* Google 'G' icon as text — replace with an SVG asset if available */}
          <Text style={styles.gIcon}>G</Text>
          <Text style={styles.label}>Continue with Google</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    minHeight: 48,
  },
  buttonPressed: {
    backgroundColor: '#F5F5F5',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: '#3C4043',
  },
});
```

- [ ] **Step 2: Add Google button to `LoginScreen`**

In `apps/mobile/src/features/auth/screens/LoginScreen.tsx`, add the import at
the top:

```typescript
import { GoogleSignInButton } from '../components/GoogleSignInButton';
```

Find the bottom of the login form (after the submit button and before the
"Register" link). Add the divider and Google button:

```tsx
{/* ─── or divider ────────────────────────────────────── */}
<View style={styles.dividerRow}>
  <View style={styles.dividerLine} />
  <Text style={styles.dividerText}>or</Text>
  <View style={styles.dividerLine} />
</View>

<GoogleSignInButton />
```

Add to the `styles` object:

```typescript
dividerRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginVertical: 16,
  gap: 8,
},
dividerLine: {
  flex: 1,
  height: 1,
  backgroundColor: '#E0E0E0',
},
dividerText: {
  fontSize: 12,
  color: '#9E9E9E',
},
```

- [ ] **Step 3: Add Google button to `RegisterScreen`**

In `apps/mobile/src/features/auth/screens/RegisterScreen.tsx`, add the same
import:

```typescript
import { GoogleSignInButton } from '../components/GoogleSignInButton';
```

Find the bottom of the registration form (after the submit button). Add the same
divider and button:

```tsx
{/* ─── or divider ────────────────────────────────────── */}
<View style={styles.dividerRow}>
  <View style={styles.dividerLine} />
  <Text style={styles.dividerText}>or</Text>
  <View style={styles.dividerLine} />
</View>

<GoogleSignInButton />
```

Add the same `dividerRow`, `dividerLine`, `dividerText` styles.

- [ ] **Step 4: Run type-check**

```bash
pnpm --filter @foodwaste/mobile type-check
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/auth/components/GoogleSignInButton.tsx \
        apps/mobile/src/features/auth/screens/LoginScreen.tsx \
        apps/mobile/src/features/auth/screens/RegisterScreen.tsx
git commit -m "feat(mobile): add Google Sign-In button to Login and Register screens"
```

---

## Phase 3 — Web (Next.js Merchant)

### Task 14: Install `@react-oauth/google` and add env var

**Files:**

- Modify: `apps/web/package.json` (via pnpm)
- Modify: `apps/web/.env.local`

- [ ] **Step 1: Install the package**

```bash
pnpm --filter @foodwaste/web add @react-oauth/google
```

- [ ] **Step 2: Add env var**

In `apps/web/.env.local`:

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

> **Google Cloud Console:** Add the web app's domain (e.g.
> `https://yourdomain.com`) to **Authorized JavaScript origins** in the same
> OAuth client used by mobile.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add @react-oauth/google dependency"
```

---

### Task 15: Add `googleSignIn()` to web `authService` and `useAuth` hook

**Files:**

- Modify: `apps/web/src/services/auth.service.ts`
- Modify: `apps/web/src/hooks/use-auth.ts`

- [ ] **Step 1: Add method to `authService`**

In `apps/web/src/services/auth.service.ts`, add after `login()`:

```typescript
googleSignIn(idToken: string) {
  return apiClient.post<ApiResponse<LoginResponse>>(`${AUTH_BASE}/google`, { idToken });
},
```

`LoginResponse` is already imported from `@foodwaste/shared`.

- [ ] **Step 2: Add `googleSignIn` to `useAuth` hook**

In `apps/web/src/hooks/use-auth.ts`, add after the `login` callback:

```typescript
const googleSignIn = useCallback(
  async (idToken: string) => {
    store.setLoading(true);
    try {
      const response = await authService.googleSignIn(idToken);
      const { user } = response.data.data;
      // Backend sets HttpOnly cookies — no JS token storage
      store.setAuthenticated(true);
      store.setUser(user);
      return response.data.data;
    } finally {
      store.setLoading(false);
    }
  },
  [store],
);
```

Add `googleSignIn` to the return object:

```typescript
return {
  user: store.user,
  isAuthenticated: store.isAuthenticated,
  isLoading: store.isLoading,
  login,
  googleSignIn, // ← add this
  register,
  logout,
};
```

- [ ] **Step 3: Run type-check**

```bash
pnpm --filter @foodwaste/web type-check
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/services/auth.service.ts \
        apps/web/src/hooks/use-auth.ts
git commit -m "feat(web): add googleSignIn to authService and useAuth hook"
```

---

### Task 16: Wrap `AppProviders` with `GoogleOAuthProvider`

**Files:**

- Modify: `apps/web/src/components/providers/app-providers.tsx`

- [ ] **Step 1: Add the provider**

In `apps/web/src/components/providers/app-providers.tsx`:

Add import at the top:

```typescript
import { GoogleOAuthProvider } from '@react-oauth/google';
```

Wrap the existing content with `GoogleOAuthProvider`:

```tsx
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider
      clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''}
    >
      <QueryProvider>
        <ThemeProvider>
          <AuthProvider>
            <TooltipProvider>
              {children}
              <Toaster position='top-right' richColors closeButton />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryProvider>
    </GoogleOAuthProvider>
  );
}
```

- [ ] **Step 2: Run type-check**

```bash
pnpm --filter @foodwaste/web type-check
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/providers/app-providers.tsx
git commit -m "feat(web): wrap AppProviders with GoogleOAuthProvider"
```

---

### Task 17: Add `<GoogleLogin />` to web login page

**Files:**

- Modify: `apps/web/src/app/[locale]/(auth)/login/page.tsx`

- [ ] **Step 1: Add imports**

In `apps/web/src/app/[locale]/(auth)/login/page.tsx`, add at the top:

```typescript
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { toast } from 'sonner';
```

- [ ] **Step 2: Add `handleGoogleSuccess` and `handleGoogleError` callbacks in
      `LoginFormInner`**

After the existing `handleSubmit` function, add:

```typescript
const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
  const idToken = credentialResponse.credential;
  if (!idToken) {
    toast.error(t('googleSignInError'));
    return;
  }
  try {
    const result = await googleSignIn(idToken);
    if (callbackUrl) {
      router.push(callbackUrl);
    } else if (
      result.user.role === UserRole.ADMIN ||
      result.user.role === UserRole.MODERATOR
    ) {
      router.push(`/${locale}/admin/dashboard`);
    } else if (result.user.role === UserRole.MERCHANT) {
      router.push(`/${locale}/merchant/dashboard`);
    } else {
      router.push(`/${locale}`);
    }
  } catch {
    toast.error(t('googleSignInError'));
  }
};

const handleGoogleError = () => {
  toast.error(t('googleSignInError'));
};
```

Destructure `googleSignIn` from `useAuth()`:

```typescript
const { login, googleSignIn } = useAuth();
```

Add the translation key — in `messages/en.json` under the `auth` namespace:

```json
"googleSignInError": "Google sign-in failed. Please try again."
```

Repeat for `messages/fr.json` and `messages/ar.json`.

- [ ] **Step 3: Add the `<GoogleLogin />` button in the JSX**

Find the submit button section in the JSX. After the submit button but before
the "sign up" link, add:

```tsx
{/* ─── or divider ─────────────────────────────────────── */}
<div className='relative my-4'>
  <div className='absolute inset-0 flex items-center'>
    <span className='w-full border-t border-border' />
  </div>
  <div className='relative flex justify-center text-xs uppercase'>
    <span className='bg-background px-2 text-muted-foreground'>or</span>
  </div>
</div>

<div className='flex justify-center'>
  <GoogleLogin
    onSuccess={handleGoogleSuccess}
    onError={handleGoogleError}
    useOneTap={false}
    shape='rectangular'
    theme='outline'
    size='large'
    width='100%'
  />
</div>
```

- [ ] **Step 4: Run type-check and lint**

```bash
pnpm --filter @foodwaste/web type-check
pnpm --filter @foodwaste/web lint
```

Expected: 0 errors, 0 lint issues.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/[locale]/\(auth\)/login/page.tsx \
        apps/web/messages/en.json \
        apps/web/messages/fr.json \
        apps/web/messages/ar.json
git commit -m "feat(web): add Google Sign-In button to merchant login page"
```

---

## Final Verification

- [ ] **Backend:** `pnpm --filter @foodwaste/backend test:unit` — all tests pass
      including `google-auth.service.spec`
- [ ] **Backend:** `pnpm --filter @foodwaste/backend type-check` — 0 errors
- [ ] **Mobile:** `pnpm --filter @foodwaste/mobile type-check` — 0 errors
- [ ] **Web:** `pnpm --filter @foodwaste/web type-check` — 0 errors
- [ ] **Integration smoke test:** Start backend locally, POST
      `{ idToken: "<valid-google-token>" }` to
      `http://localhost:3000/api/v1/auth/google` — expect
      `200 { success: true, user: {...}, tokens: {...} }`
