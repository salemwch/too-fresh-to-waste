# Admin Create Driver — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins create driver accounts from the web dashboard, generating a
one-time temporary password and forcing the driver to change it on first mobile
login before accessing the app.

**Architecture:** Backend adds `DriverProfile` schema + two admin endpoints +
one auth endpoint. JWT payload gains `requiresPasswordChange` so mobile can gate
routing synchronously. Mobile adds a `PASSWORD_CHANGE_REQUIRED` `AuthFlowState`
and a hard-wall `ForceChangePasswordScreen`. Web admin gets a new
`/admin/drivers` page with a creation form (Zod-validated) and a drivers table.

**Tech Stack:** NestJS 11 + Mongoose (MongoDB transactions), React Native 0.81
(BackHandler, KeyboardAvoidingView), Next.js 15 App Router + TanStack Query +
react-hook-form + Zod

**Spec:** `docs/superpowers/specs/2026-05-13-admin-create-driver.md`

---

## File Map

| Action | File                                                                          |
| ------ | ----------------------------------------------------------------------------- |
| Modify | `apps/food-waste-backend/src/users/schemas/user.schema.ts`                    |
| Create | `apps/food-waste-backend/src/drivers/schemas/driver-profile.schema.ts`        |
| Modify | `apps/food-waste-backend/src/drivers/drivers.module.ts`                       |
| Modify | `apps/food-waste-backend/src/admin/admin.module.ts`                           |
| Create | `apps/food-waste-backend/src/admin/dto/create-driver.dto.ts`                  |
| Modify | `apps/food-waste-backend/src/admin/services/user-management.service.ts`       |
| Modify | `apps/food-waste-backend/src/admin/controllers/user-management.controller.ts` |
| Modify | `apps/food-waste-backend/src/auth/services/token.service.ts`                  |
| Modify | `apps/food-waste-backend/src/auth/auth.service.ts`                            |
| Create | `apps/food-waste-backend/src/auth/DTO/force-password-change.dto.ts`           |
| Modify | `apps/food-waste-backend/src/auth/auth.controller.ts`                         |
| Modify | `apps/mobile/src/features/auth/types/index.ts`                                |
| Modify | `apps/mobile/src/features/auth/store/authSlice.ts`                            |
| Modify | `apps/mobile/src/navigation/types.ts`                                         |
| Modify | `apps/mobile/src/navigation/RootNavigator.tsx`                                |
| Create | `apps/mobile/src/features/auth/screens/ForceChangePasswordScreen.tsx`         |
| Modify | `apps/web/src/services/admin.service.ts`                                      |
| Create | `apps/web/src/hooks/use-drivers.ts`                                           |
| Create | `apps/web/src/app/[locale]/(admin)/admin/drivers/page.tsx`                    |

---

## Task 1: User Schema + DriverProfile Schema

**Files:**

- Modify: `apps/food-waste-backend/src/users/schemas/user.schema.ts`
- Create: `apps/food-waste-backend/src/drivers/schemas/driver-profile.schema.ts`
- Modify: `apps/food-waste-backend/src/drivers/drivers.module.ts`

- [ ] **Step 1: Add `requiresPasswordChange` to User schema**

  Read the file first to find the last `@Prop()` declaration in the `User`
  class. Add this field after it (before any index calls):

  ```ts
  @Prop({ type: Boolean, default: false })
  requiresPasswordChange!: boolean;
  ```

  Backend rule: `@Prop` with no union type — no explicit `type:` needed here
  since it's a plain Boolean with no `| undefined`.

- [ ] **Step 2: Create `driver-profile.schema.ts`**

  ```ts
  import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
  import { HydratedDocument, Types } from 'mongoose';

  @Schema({ timestamps: true })
  export class DriverProfile {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
    userId!: Types.ObjectId;

    @Prop({ type: String, required: true })
    idCardNumber!: string;

    @Prop({ type: String, required: true })
    address!: string;
  }

  export const DriverProfileSchema =
    SchemaFactory.createForClass(DriverProfile);
  export type DriverProfileDocument = HydratedDocument<DriverProfile>;
  ```

- [ ] **Step 3: Register DriverProfile in DriversModule**

  Read `apps/food-waste-backend/src/drivers/drivers.module.ts`. Add
  `DriverProfile` and `DriverProfileSchema` to the `MongooseModule.forFeature`
  array:

  ```ts
  import { DriverProfile, DriverProfileSchema } from './schemas/driver-profile.schema';

  // Inside @Module imports array:
  MongooseModule.forFeature([
    { name: Order.name, schema: OrderSchema },
    { name: DriverProfile.name, schema: DriverProfileSchema }, // ← add
  ]),
  ```

  Also add `MongooseModule` to `exports` so AdminModule can import it:

  ```ts
  exports: [MongooseModule],
  ```

- [ ] **Step 4: Type-check**

  ```
  pnpm --filter @foodwaste/backend type-check
  ```

  Expected: 0 errors.

- [ ] **Step 5: Commit**

  ```
  git add apps/food-waste-backend/src/users/schemas/user.schema.ts apps/food-waste-backend/src/drivers/schemas/driver-profile.schema.ts apps/food-waste-backend/src/drivers/drivers.module.ts
  git commit -m "feat(backend): add requiresPasswordChange to User, create DriverProfile schema"
  ```

---

## Task 2: Add `requiresPasswordChange` to JWT Payload

**Files:**

- Modify: `apps/food-waste-backend/src/auth/services/token.service.ts`

- [ ] **Step 1: Read `token.service.ts`**

  Read the file to confirm the `TokenPayload` interface location and the
  `generateTokenPair` method signature. Note the exact parameter order.

- [ ] **Step 2: Update `TokenPayload` interface**

  Add `requiresPasswordChange` to the interface:

  ```ts
  export interface TokenPayload {
    sub: string;
    email: string;
    role: UserRole;
    jti: string;
    iat: number;
    exp: number;
    familyId?: string;
    ver?: number;
    requiresPasswordChange?: boolean; // ← add
  }
  ```

- [ ] **Step 3: Add parameter to `generateTokenPair`**

  Add `requiresPasswordChange: boolean = false` as the **last** parameter of
  `generateTokenPair`. All existing callers don't pass it, so they get `false`
  by default.

  ```ts
  async generateTokenPair(
    userId: string,
    email: string,
    role: UserRole,
    deviceInfo?: DeviceInfo,
    parentJti?: string,
    existingFamilyId?: string,
    tokenRevocationVersion: number = 0,
    rememberMe: boolean = false,
    requiresPasswordChange: boolean = false, // ← add last
  ): Promise<TokenPair>
  ```

- [ ] **Step 4: Add to `accessPayload` inside `generateTokenPair`**

  Find where `accessPayload` is built and add the field:

  ```ts
  const accessPayload = {
    sub: userId,
    email,
    role,
    jti: uuidv4(),
    ver: tokenRevocationVersion,
    requiresPasswordChange, // ← add
  };
  ```

  Do NOT add it to `refreshPayload` — the refresh token is long-lived and
  shouldn't carry this flag.

- [ ] **Step 5: Type-check**

  ```
  pnpm --filter @foodwaste/backend type-check
  ```

  Expected: 0 errors.

- [ ] **Step 6: Commit**

  ```
  git add apps/food-waste-backend/src/auth/services/token.service.ts
  git commit -m "feat(backend): add requiresPasswordChange to JWT access token payload"
  ```

---

## Task 3: Admin Service — createDriver + getDrivers

**Files:**

- Create: `apps/food-waste-backend/src/admin/dto/create-driver.dto.ts`
- Modify:
  `apps/food-waste-backend/src/admin/services/user-management.service.ts`
- Modify: `apps/food-waste-backend/src/admin/admin.module.ts`

- [ ] **Step 1: Create `create-driver.dto.ts`**

  ```ts
  import {
    IsEmail,
    IsNotEmpty,
    IsString,
    Length,
    Matches,
  } from 'class-validator';

  export class CreateDriverDto {
    @IsString()
    @IsNotEmpty()
    firstName!: string;

    @IsString()
    @IsNotEmpty()
    lastName!: string;

    @IsEmail()
    email!: string;

    @IsString()
    @IsNotEmpty()
    phoneNumber!: string;

    @IsString()
    @Length(8, 8, { message: 'Tunisian CIN must be exactly 8 digits' })
    @Matches(/^\d{8}$/, { message: 'CIN must contain only digits' })
    idCardNumber!: string;

    @IsString()
    @IsNotEmpty()
    address!: string;
  }
  ```

- [ ] **Step 2: Read `user-management.service.ts`**

  Read the file to understand: current constructor injections, what models are
  already injected, and how the service connects to MongoDB (check if
  `Connection` is injected for transactions).

- [ ] **Step 3: Add DriverProfile model + Connection injection to the service**

  At the top of `UserManagementService`, add two injections if not already
  present:

  ```ts
  import { InjectModel } from '@nestjs/mongoose';
  import { InjectConnection } from '@nestjs/mongoose';
  import { Connection, Model } from 'mongoose';
  import { DriverProfile, DriverProfileDocument } from '../../drivers/schemas/driver-profile.schema';

  // Inside constructor:
  @InjectModel(DriverProfile.name)
  private readonly driverProfileModel: Model<DriverProfileDocument>,
  @InjectConnection()
  private readonly connection: Connection,
  ```

- [ ] **Step 4: Add `createDriver` method to `UserManagementService`**

  ```ts
  import * as crypto from 'crypto';
  import * as bcrypt from 'bcrypt';
  import { UserRole, UserStatus } from '@foodwaste/shared';

  async createDriver(dto: CreateDriverDto): Promise<{
    driver: { _id: string; firstName: string; lastName: string; email: string; role: string; requiresPasswordChange: boolean };
    driverProfile: { idCardNumber: string; address: string };
    temporaryPassword: string;
  }> {
    const temporaryPassword = `Drv-${crypto.randomBytes(3).toString('hex')}-${crypto.randomBytes(3).toString('hex')}`;
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const [user] = await this.userModel.create(
        [
          {
            firstName: dto.firstName,
            lastName: dto.lastName,
            email: dto.email,
            phoneNumber: dto.phoneNumber,
            password: hashedPassword,
            role: UserRole.DRIVER,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            requiresPasswordChange: true,
          },
        ],
        { session },
      );

      const [driverProfile] = await this.driverProfileModel.create(
        [
          {
            userId: user._id,
            idCardNumber: dto.idCardNumber,
            address: dto.address,
          },
        ],
        { session },
      );

      await session.commitTransaction();

      return {
        driver: {
          _id: (user._id as { toString(): string }).toString(),
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          requiresPasswordChange: user.requiresPasswordChange,
        },
        driverProfile: {
          idCardNumber: driverProfile.idCardNumber,
          address: driverProfile.address,
        },
        temporaryPassword,
      };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
  ```

  **Note on `UserStatus`:** Check if `UserStatus` is exported from
  `@foodwaste/shared`. If not, import it from `../../users/schemas/user.schema`
  or wherever it's defined in the backend. Use the same value used elsewhere in
  the codebase for active users.

- [ ] **Step 5: Add `getDrivers` method to `UserManagementService`**

  ```ts
  async getDrivers(): Promise<Array<{
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
    requiresPasswordChange: boolean;
    createdAt: Date;
    driverProfile: { idCardNumber: string; address: string } | null;
  }>> {
    const drivers = await this.userModel
      .find({ role: UserRole.DRIVER, deletedAt: null })
      .select('firstName lastName email phoneNumber requiresPasswordChange createdAt')
      .lean()
      .exec();

    const profiles = await this.driverProfileModel
      .find({ userId: { $in: drivers.map(d => d._id) } })
      .lean()
      .exec();

    const profileMap = new Map(
      profiles.map(p => [p.userId.toString(), p]),
    );

    return drivers.map(d => ({
      _id: (d._id as { toString(): string }).toString(),
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      phoneNumber: d.phoneNumber,
      requiresPasswordChange: d.requiresPasswordChange ?? false,
      createdAt: d.createdAt as Date,
      driverProfile: profileMap.get((d._id as { toString(): string }).toString()) ?? null,
    }));
  }
  ```

- [ ] **Step 6: Register DriverProfile schema in AdminModule**

  Read `apps/food-waste-backend/src/admin/admin.module.ts`. Add to
  `MongooseModule.forFeature`:

  ```ts
  import { DriverProfile, DriverProfileSchema } from '../drivers/schemas/driver-profile.schema';

  // Inside MongooseModule.forFeature([...]):
  { name: DriverProfile.name, schema: DriverProfileSchema },
  ```

- [ ] **Step 7: Type-check**

  ```
  pnpm --filter @foodwaste/backend type-check
  ```

  Expected: 0 errors. Fix any type mismatches on User fields before continuing.

- [ ] **Step 8: Commit**

  ```
  git add apps/food-waste-backend/src/admin/dto/create-driver.dto.ts apps/food-waste-backend/src/admin/services/user-management.service.ts apps/food-waste-backend/src/admin/admin.module.ts
  git commit -m "feat(backend): add createDriver and getDrivers to UserManagementService"
  ```

---

## Task 4: Admin Controller — POST + GET /admin/drivers

**Files:**

- Modify:
  `apps/food-waste-backend/src/admin/controllers/user-management.controller.ts`

- [ ] **Step 1: Read the controller**

  Read
  `apps/food-waste-backend/src/admin/controllers/user-management.controller.ts`.
  Note the existing guard setup (uses `AdminOnlyGuard`, not `RolesGuard`) and
  the exact import paths.

- [ ] **Step 2: Add two endpoints**

  Add these two methods to `UserManagementController`. Place them at the bottom
  of the class before the closing `}`:

  ```ts
  import { Body, Post, HttpCode, HttpStatus } from '@nestjs/common'; // add if not already imported
  import { CreateDriverDto } from '../dto/create-driver.dto';

  @Post('drivers')
  @HttpCode(HttpStatus.CREATED)
  async createDriver(@Body() dto: CreateDriverDto) {
    const result = await this.userManagementService.createDriver(dto);
    return {
      status: 'success',
      message: 'Driver account created',
      data: result,
    };
  }

  @Get('drivers')
  async getDrivers() {
    const drivers = await this.userManagementService.getDrivers();
    return {
      status: 'success',
      message: 'Drivers retrieved',
      data: drivers,
    };
  }
  ```

  The `AdminOnlyGuard` already applies to the whole controller class — no
  per-method guards needed.

- [ ] **Step 3: Type-check**

  ```
  pnpm --filter @foodwaste/backend type-check
  ```

  Expected: 0 errors.

- [ ] **Step 4: Commit**

  ```
  git add apps/food-waste-backend/src/admin/controllers/user-management.controller.ts
  git commit -m "feat(backend): add POST /admin/drivers and GET /admin/drivers endpoints"
  ```

---

## Task 5: Auth — Force Password Change Endpoint

**Files:**

- Create: `apps/food-waste-backend/src/auth/DTO/force-password-change.dto.ts`
- Modify: `apps/food-waste-backend/src/auth/auth.service.ts`
- Modify: `apps/food-waste-backend/src/auth/auth.controller.ts`

- [ ] **Step 1: Create `force-password-change.dto.ts`**

  ```ts
  import { IsString, MinLength } from 'class-validator';

  export class ForcePasswordChangeDto {
    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    newPassword!: string;
  }
  ```

- [ ] **Step 2: Read `auth.service.ts`**

  Read the file to understand: how `UsersService` is used, how
  `TokenService.generateTokenPair` is called in the `login` method, and the
  return type of login (to match it in the new method).

- [ ] **Step 3: Update the `login` method to pass `requiresPasswordChange` to
      `generateTokenPair`**

  Find the `login` method in `auth.service.ts`. The user document is fetched
  from the DB during login (it has `requiresPasswordChange` now). Find the
  `generateTokenPair` call and add `user.requiresPasswordChange ?? false` as the
  last argument:

  ```ts
  // Before (find the actual generateTokenPair call and add the last arg):
  const tokens = await this.tokenService.generateTokenPair(
    user._id.toString(),
    user.email,
    user.role,
    deviceInfo,
    undefined,
    undefined,
    user.tokenRevocationVersion ?? 0,
    dto.rememberMe ?? false,
    user.requiresPasswordChange ?? false, // ← add last
  );
  ```

- [ ] **Step 4: Add `forcePasswordChange` method to `AuthService`**

  ```ts
  import * as bcrypt from 'bcrypt'; // already imported — verify
  import { ForbiddenException } from '@nestjs/common'; // already imported — verify

  async forcePasswordChange(
    userId: string,
    newPassword: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: object }> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.requiresPasswordChange) {
      throw new ForbiddenException('Password change is not required for this account');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.usersService.updateUser(userId, {
      password: hashedPassword,
      requiresPasswordChange: false,
    });

    const tokens = await this.tokenService.generateTokenPair(
      userId,
      user.email,
      user.role,
      undefined,
      undefined,
      undefined,
      user.tokenRevocationVersion ?? 0,
      false,
      false, // requiresPasswordChange is now false
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        _id: userId,
        email: user.email,
        role: user.role,
        requiresPasswordChange: false,
      },
    };
  }
  ```

  **Note on `usersService.updateUser`:** Check the actual method name in
  `UsersService` for updating a user. It may be `update`, `updateById`, or
  `updateUser`. Read `apps/food-waste-backend/src/users/user.service.ts` briefly
  if needed and use the correct method name.

- [ ] **Step 5: Add endpoint to `auth.controller.ts`**

  Read `auth.controller.ts` to find where `JwtAuthGuard` is imported and how
  existing `@Post` endpoints are structured. Then add:

  ```ts
  import { ForcePasswordChangeDto } from './DTO/force-password-change.dto';

  @Post('force-password-change')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async forcePasswordChange(
    @Request() req: { user: { userId: string } },
    @Body() dto: ForcePasswordChangeDto,
  ) {
    const result = await this.authService.forcePasswordChange(
      req.user.userId,
      dto.newPassword,
    );
    return {
      status: 'success',
      message: 'Password changed successfully',
      data: result,
    };
  }
  ```

- [ ] **Step 6: Type-check + run tests**

  ```
  pnpm --filter @foodwaste/backend type-check
  pnpm --filter @foodwaste/backend test -- --no-coverage
  ```

  Expected: 0 type errors, all existing tests pass.

- [ ] **Step 7: Commit**

  ```
  git add apps/food-waste-backend/src/auth/DTO/force-password-change.dto.ts apps/food-waste-backend/src/auth/auth.service.ts apps/food-waste-backend/src/auth/auth.controller.ts
  git commit -m "feat(backend): add POST /auth/force-password-change endpoint"
  ```

---

## Task 6: Mobile — AuthFlowState + authSlice

**Files:**

- Modify: `apps/mobile/src/features/auth/types/index.ts`
- Modify: `apps/mobile/src/features/auth/store/authSlice.ts`

- [ ] **Step 1: Add `PASSWORD_CHANGE_REQUIRED` to `AuthFlowState`**

  Read `apps/mobile/src/features/auth/types/index.ts`. Find the `AuthFlowState`
  enum and add the new value:

  ```ts
  export enum AuthFlowState {
    // ...all existing values unchanged...
    PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED', // ← add
  }
  ```

- [ ] **Step 2: Update `loginAsync.fulfilled` in `authSlice.ts`**

  Read `apps/mobile/src/features/auth/store/authSlice.ts`. Find the
  `loginAsync.fulfilled` case. The login response includes a `user` object. Add
  a check **before** the existing `AUTHENTICATED` assignment:

  ```ts
  builder.addCase(loginAsync.fulfilled, (state, action) => {
    state.isLoading = false;
    state.error = undefined;

    if (action.payload.requiresMFA === true) {
      state.flowState = AuthFlowState.MFA_REQUIRED;
      state.mfaToken = action.payload.mfaToken;
      return;
    }

    // ← Add this block before the AUTHENTICATED assignment:
    if (action.payload.user?.requiresPasswordChange === true) {
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.flowState = AuthFlowState.PASSWORD_CHANGE_REQUIRED;
      return;
    }

    // existing AUTHENTICATED logic below — unchanged
    state.user = action.payload.user;
    state.isAuthenticated = true;
    state.lastLoginTime = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + action.payload.tokens.expiresIn * 1000,
    );
    state.sessionExpiresAt = expiresAt.toISOString();
    state.flowState = AuthFlowState.AUTHENTICATED;
    state.pendingVerificationEmail = undefined;
    state.mfaToken = undefined;
    state.isUserSynced = true;
  });
  ```

  The `user.requiresPasswordChange` value comes from the login response body
  (the backend returns the user object after login — it now includes
  `requiresPasswordChange`). No JWT decoding needed — the response already has
  it.

- [ ] **Step 3: Type-check mobile**

  ```
  pnpm --filter @foodwaste/mobile type-check
  ```

  Expected: 0 errors.

- [ ] **Step 4: Commit**

  ```
  git add apps/mobile/src/features/auth/types/index.ts apps/mobile/src/features/auth/store/authSlice.ts
  git commit -m "feat(mobile): add PASSWORD_CHANGE_REQUIRED AuthFlowState and login gate"
  ```

---

## Task 7: Mobile — Navigation + ForceChangePasswordScreen

**Files:**

- Modify: `apps/mobile/src/navigation/types.ts`
- Modify: `apps/mobile/src/navigation/RootNavigator.tsx`
- Create: `apps/mobile/src/features/auth/screens/ForceChangePasswordScreen.tsx`

- [ ] **Step 1: Add `ForceChangePassword` to AuthStack navigation types**

  Read `apps/mobile/src/navigation/types.ts`. Find `AuthStackParamList` and add:

  ```ts
  export type AuthStackParamList = {
    // ...existing screens unchanged...
    ForceChangePassword: undefined; // ← add
  };
  ```

- [ ] **Step 2: Update `RootNavigator.tsx`**

  Read `apps/mobile/src/navigation/RootNavigator.tsx`. Find the
  switch/conditional that renders based on `flowState`. Add a new case for
  `PASSWORD_CHANGE_REQUIRED`. Also verify `AuthFlowState` is imported from the
  correct path (`@/features/auth/types` or similar):

  ```ts
  import { AuthFlowState } from '@/features/auth/types';

  // Inside the render switch — add before or after the AUTHENTICATED case:
  case AuthFlowState.PASSWORD_CHANGE_REQUIRED:
    return <AuthStack initialRouteName="ForceChangePassword" />;
  ```

  The `AUTHENTICATED` case already routes `DRIVER` role to `DriverStack` and
  others to `MainStack` — leave it unchanged.

- [ ] **Step 3: Create `ForceChangePasswordScreen.tsx`**

  ```tsx
  import React, { useEffect, useCallback } from 'react';
  import {
    ActivityIndicator,
    Alert,
    BackHandler,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
  } from 'react-native';
  import { useForm, Controller } from 'react-hook-form';
  import { useAppDispatch } from '@/hooks/redux';
  import { AuthFlowState } from '../types';
  import { setFlowState } from '../store/authSlice';
  import { apiClient } from '@/lib/api/apiClient';
  import { saveTokens } from '@/lib/keychain';

  interface FormData {
    newPassword: string;
  }

  export default function ForceChangePasswordScreen() {
    const dispatch = useAppDispatch();
    const {
      control,
      handleSubmit,
      formState: { errors, isSubmitting },
    } = useForm<FormData>();

    // Disable Android hardware back button — hard wall
    useEffect(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, []);

    const onSubmit = useCallback(
      async (data: FormData) => {
        try {
          const res = await apiClient.post('/auth/force-password-change', {
            newPassword: data.newPassword,
          });
          const { accessToken, refreshToken } = res.data.data;
          await saveTokens(accessToken, refreshToken);
          dispatch(setFlowState(AuthFlowState.AUTHENTICATED));
        } catch {
          Alert.alert('Error', 'Failed to change password. Please try again.');
        }
      },
      [dispatch],
    );

    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps='handled'
        >
          <Text style={styles.title}>Set Your Password</Text>
          <Text style={styles.subtitle}>
            You must set a new password before using the app.
          </Text>

          <Controller
            control={control}
            name='newPassword'
            rules={{
              required: 'Password is required',
              minLength: { value: 8, message: 'Minimum 8 characters' },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, errors.newPassword && styles.inputError]}
                placeholder='New password (min. 8 characters)'
                secureTextEntry
                autoCapitalize='none'
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
          {errors.newPassword && (
            <Text style={styles.errorText}>{errors.newPassword.message}</Text>
          )}

          <TouchableOpacity
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color='#fff' />
            ) : (
              <Text style={styles.buttonText}>Save Password</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const styles = StyleSheet.create({
    flex: { flex: 1 },
    container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: '#1E4448',
      marginBottom: 8,
    },
    subtitle: { fontSize: 14, color: '#666', marginBottom: 32 },
    input: {
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      marginBottom: 8,
      backgroundColor: '#fff',
    },
    inputError: { borderColor: '#D32F2F' },
    errorText: { color: '#D32F2F', fontSize: 12, marginBottom: 16 },
    button: {
      backgroundColor: '#1E4448',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 16,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
  ```

  **Note on imports:** Check the actual path for `saveTokens` (Keychain helper)
  and `setFlowState` action in the existing codebase. Read
  `apps/mobile/src/lib/keychain.ts` (or similar) and `authSlice.ts` to confirm
  the exact export names. Adapt if different.

- [ ] **Step 4: Add `ForceChangePassword` screen to `AuthStack` navigator**

  Read the file that defines `AuthStack` navigator (likely
  `apps/mobile/src/navigation/AuthStack.tsx`). Add:

  ```tsx
  import ForceChangePasswordScreen from '@/features/auth/screens/ForceChangePasswordScreen';

  // Inside Stack.Navigator:
  <Stack.Screen
    name='ForceChangePassword'
    component={ForceChangePasswordScreen}
    options={{ headerShown: false }}
  />;
  ```

- [ ] **Step 5: Type-check**

  ```
  pnpm --filter @foodwaste/mobile type-check
  ```

  Expected: 0 errors.

- [ ] **Step 6: Commit**

  ```
  git add apps/mobile/src/navigation/types.ts apps/mobile/src/navigation/RootNavigator.tsx apps/mobile/src/features/auth/screens/ForceChangePasswordScreen.tsx
  git commit -m "feat(mobile): add ForceChangePasswordScreen with hard-wall enforcement"
  ```

---

## Task 8: Web — Admin Drivers Page

**Files:**

- Modify: `apps/web/src/services/admin.service.ts`
- Create: `apps/web/src/hooks/use-drivers.ts`
- Create: `apps/web/src/app/[locale]/(admin)/admin/drivers/page.tsx`

- [ ] **Step 1: Add driver methods to `admin.service.ts`**

  Read `apps/web/src/services/admin.service.ts` to find the import for
  `apiClient` and the existing method pattern. Add at the bottom:

  ```ts
  export interface CreateDriverPayload {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    idCardNumber: string;
    address: string;
  }

  export interface DriverRow {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
    requiresPasswordChange: boolean;
    createdAt: string;
    driverProfile: { idCardNumber: string; address: string } | null;
  }

  export interface CreateDriverResponse {
    driver: { _id: string; firstName: string; lastName: string; email: string };
    driverProfile: { idCardNumber: string; address: string };
    temporaryPassword: string;
  }

  // Inside the adminService object (or as standalone exports — match the existing pattern):
  async createDriver(payload: CreateDriverPayload): Promise<CreateDriverResponse> {
    const res = await apiClient.post('/admin/drivers', payload);
    return res.data.data as CreateDriverResponse;
  },

  async getDrivers(): Promise<DriverRow[]> {
    const res = await apiClient.get('/admin/drivers');
    return res.data.data as DriverRow[];
  },
  ```

- [ ] **Step 2: Create `use-drivers.ts`**

  ```ts
  'use client';

  import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
  import {
    adminService,
    type CreateDriverPayload,
  } from '@/services/admin.service';

  export const driverKeys = {
    all: ['drivers'] as const,
  };

  export function useDrivers() {
    return useQuery({
      queryKey: driverKeys.all,
      queryFn: () => adminService.getDrivers(),
    });
  }

  export function useCreateDriver() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (payload: CreateDriverPayload) =>
        adminService.createDriver(payload),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: driverKeys.all });
      },
    });
  }
  ```

- [ ] **Step 3: Create `drivers/page.tsx`**

  ```tsx
  'use client';

  import { useState } from 'react';
  import { useForm } from 'react-hook-form';
  import { zodResolver } from '@hookform/resolvers/zod';
  import { z } from 'zod';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Badge } from '@/components/ui/badge';
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
  } from '@/components/ui/dialog';
  import { useDrivers, useCreateDriver } from '@/hooks/use-drivers';
  import type { CreateDriverResponse } from '@/services/admin.service';

  const createDriverSchema = z.object({
    firstName: z.string().min(1, 'Required'),
    lastName: z.string().min(1, 'Required'),
    email: z.string().email('Invalid email'),
    phoneNumber: z
      .string()
      .transform(v => v.replace(/\s+/g, ''))
      .pipe(z.string().min(8, 'Invalid phone number')),
    idCardNumber: z
      .string()
      .length(8, 'CIN must be exactly 8 digits')
      .regex(/^\d{8}$/, 'CIN must contain only digits'),
    address: z.string().min(1, 'Required'),
  });

  type CreateDriverForm = z.infer<typeof createDriverSchema>;

  export default function DriversPage() {
    const { data: drivers = [], isLoading } = useDrivers();
    const { mutateAsync: createDriver, isPending } = useCreateDriver();
    const [createdResult, setCreatedResult] =
      useState<CreateDriverResponse | null>(null);
    const [copied, setCopied] = useState(false);

    const {
      register,
      handleSubmit,
      reset,
      formState: { errors },
    } = useForm<CreateDriverForm>({
      resolver: zodResolver(createDriverSchema),
    });

    const onSubmit = async (data: CreateDriverForm) => {
      const result = await createDriver(data);
      setCreatedResult(result);
      reset();
    };

    const handleCopy = async () => {
      if (!createdResult) return;
      await navigator.clipboard.writeText(createdResult.temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className='p-6 space-y-8'>
        <h1 className='text-2xl font-bold text-primary'>Driver Accounts</h1>

        {/* Create Driver Form */}
        <section className='bg-card rounded-xl border p-6 space-y-4'>
          <h2 className='text-lg font-semibold'>Create Driver Account</h2>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className='grid grid-cols-2 gap-4'
          >
            {[
              { name: 'firstName' as const, label: 'First Name' },
              { name: 'lastName' as const, label: 'Last Name' },
              { name: 'email' as const, label: 'Email' },
              { name: 'phoneNumber' as const, label: 'Phone Number' },
              { name: 'idCardNumber' as const, label: 'CIN (8 digits)' },
              { name: 'address' as const, label: 'Address' },
            ].map(({ name, label }) => (
              <div key={name} className='space-y-1'>
                <Label htmlFor={name}>{label}</Label>
                <Input id={name} {...register(name)} />
                {errors[name] && (
                  <p className='text-destructive text-xs'>
                    {errors[name]?.message}
                  </p>
                )}
              </div>
            ))}
            <div className='col-span-2'>
              <Button type='submit' disabled={isPending} className='w-full'>
                {isPending ? 'Creating…' : 'Create Driver Account'}
              </Button>
            </div>
          </form>
        </section>

        {/* Drivers Table */}
        <section className='bg-card rounded-xl border'>
          <table className='w-full text-sm'>
            <thead className='border-b bg-muted/50'>
              <tr>
                {[
                  'Name',
                  'Email',
                  'Phone',
                  'CIN',
                  'Address',
                  'Status',
                  'Created',
                ].map(h => (
                  <th
                    key={h}
                    className='text-left px-4 py-3 font-medium text-muted-foreground'
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td
                    colSpan={7}
                    className='text-center py-8 text-muted-foreground'
                  >
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && drivers.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className='text-center py-8 text-muted-foreground'
                  >
                    No drivers yet.
                  </td>
                </tr>
              )}
              {drivers.map(d => (
                <tr
                  key={d._id}
                  className='border-b last:border-0 hover:bg-muted/30'
                >
                  <td className='px-4 py-3 font-medium'>
                    {d.firstName} {d.lastName}
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>{d.email}</td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {d.phoneNumber ?? '—'}
                  </td>
                  <td className='px-4 py-3 font-mono text-xs'>
                    {d.driverProfile?.idCardNumber ?? '—'}
                  </td>
                  <td className='px-4 py-3 text-muted-foreground max-w-[160px] truncate'>
                    {d.driverProfile?.address ?? '—'}
                  </td>
                  <td className='px-4 py-3'>
                    {d.requiresPasswordChange ? (
                      <Badge
                        variant='outline'
                        className='border-yellow-400 text-yellow-600 bg-yellow-50'
                      >
                        Pending Setup
                      </Badge>
                    ) : (
                      <Badge
                        variant='outline'
                        className='border-green-500 text-green-700 bg-green-50'
                      >
                        Active
                      </Badge>
                    )}
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {new Date(d.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Temporary Password Modal — never auto-dismisses */}
        <Dialog open={!!createdResult} onOpenChange={() => {}}>
          <DialogContent
            onInteractOutside={e => e.preventDefault()}
            onEscapeKeyDown={e => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>✅ Driver Account Created</DialogTitle>
            </DialogHeader>
            <div className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                Share this temporary password with the driver. It will{' '}
                <span className='font-semibold text-destructive'>
                  never be shown again
                </span>
                .
              </p>
              <div className='flex items-center gap-3 bg-muted rounded-lg p-4'>
                <code className='flex-1 text-sm font-mono font-bold tracking-wider'>
                  {createdResult?.temporaryPassword}
                </code>
                <Button size='sm' variant='outline' onClick={handleCopy}>
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <Button className='w-full' onClick={() => setCreatedResult(null)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
  ```

- [ ] **Step 4: Type-check web**

  ```
  pnpm --filter @foodwaste/web type-check
  ```

  Expected: 0 errors. If `Dialog` components need different import paths, check
  `apps/web/src/components/ui/` for the exact filenames.

- [ ] **Step 5: Commit**

  ```
  git add apps/web/src/services/admin.service.ts apps/web/src/hooks/use-drivers.ts "apps/web/src/app/[locale]/(admin)/admin/drivers/page.tsx"
  git commit -m "feat(web): add admin drivers page with create form and drivers table"
  ```

---

## Task 9: Final Verification Gate

**No new files.**

- [ ] **Step 1: Full backend type-check**

  ```
  pnpm --filter @foodwaste/backend type-check
  ```

  Expected: 0 errors.

- [ ] **Step 2: Backend tests**

  ```
  pnpm --filter @foodwaste/backend test -- --no-coverage
  ```

  Expected: all driver-related tests pass, no regressions.

- [ ] **Step 3: Backend build**

  ```
  pnpm --filter @foodwaste/backend build
  ```

  Expected: clean build.

- [ ] **Step 4: Mobile type-check**

  ```
  pnpm --filter @foodwaste/mobile type-check
  ```

  Expected: 0 errors.

- [ ] **Step 5: Web type-check**

  ```
  pnpm --filter @foodwaste/web type-check
  ```

  Expected: 0 errors.

- [ ] **Step 6: Commit if any fixes were needed**

  ```
  git commit -m "fix(driver-account): final verification fixes"
  ```
