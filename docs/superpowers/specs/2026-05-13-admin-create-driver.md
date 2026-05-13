# Admin Create Driver — Technical Design Spec

**Date:** 2026-05-13  
**Status:** Approved — ready for implementation  
**Scope:** MVP — NestJS backend (new endpoint + DriverProfile schema), React
Native mobile (hard password enforcement), Next.js admin web UI

---

## 1. Overview

Admins create driver accounts from the web dashboard. The system generates a
temporary password, returns it once, and forces the driver to change it on first
mobile login before accessing the app.

Flow:

```
Admin fills form → POST /admin/drivers
  → User (role=DRIVER) + DriverProfile created transactionally
  → Temporary password shown once in UI
  → Admin sends password to driver (WhatsApp/SMS)
  → Driver opens mobile app → logs in with temp password
  → JWT payload contains requiresPasswordChange: true
  → RootNavigator → ForceChangePasswordScreen (hard wall)
  → Driver submits new password → POST /auth/force-password-change
  → Fresh JWT (requiresPasswordChange: false) → DriverStack
```

---

## 2. Data Model Changes

### 2.1 User Schema (`apps/food-waste-backend/src/users/schemas/user.schema.ts`)

Add one field:

```ts
@Prop({ type: Boolean, default: false })
requiresPasswordChange!: boolean;
```

Set to `true` when admin creates the account. Flipped to `false` after driver
successfully changes password via `POST /auth/force-password-change`.

### 2.2 New DriverProfile Schema

**File:** `apps/food-waste-backend/src/drivers/schemas/driver-profile.schema.ts`

```ts
@Schema({ timestamps: true })
export class DriverProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  idCardNumber!: string;

  @Prop({ type: String, required: true })
  address!: string;
}

export const DriverProfileSchema = SchemaFactory.createForClass(DriverProfile);
export type DriverProfileDocument = HydratedDocument<DriverProfile>;
```

**Index:** `{ userId: 1 }` unique (enforced by `unique: true` on the field).

Future fields (`vehicleType`, `vehiclePlate`, `rating`, `documents[]`) slot in
here without touching `User`.

---

## 3. Backend — New Endpoints

### 3.1 `POST /api/v1/admin/drivers`

**Guard:** `JwtAuthGuard → RolesGuard([UserRole.ADMIN])`  
**Location:** New method in
`apps/food-waste-backend/src/admin/controllers/admin-user-management.controller.ts`

**Request body (`CreateDriverDto`):**

```ts
firstName: string; // @IsString, @IsNotEmpty
lastName: string; // @IsString, @IsNotEmpty
email: string; // @IsEmail
phoneNumber: string; // @IsString, @IsNotEmpty
idCardNumber: string; // @IsString, @IsNotEmpty, @Length(8, 8) — Tunisian CIN is exactly 8 digits
address: string; // @IsString, @IsNotEmpty
```

**Logic:**

1. Generate temporary password:
   `Drv-${crypto.randomBytes(3).toString('hex')}-${crypto.randomBytes(3).toString('hex')}`
   (e.g., `Drv-3a7f2c-9b1e4d`)
2. Hash with bcrypt
3. **Open MongoDB session → start transaction**
4. Create `User`:
   `{ firstName, lastName, email, phoneNumber, password: hashed, role: DRIVER, status: ACTIVE, isEmailVerified: true, requiresPasswordChange: true }`
5. Create `DriverProfile`: `{ userId: newUser._id, idCardNumber, address }`
6. **Commit transaction**
7. **On any failure:** abort transaction (User + DriverProfile both rolled back
   automatically). If sessions unavailable, use manual rollback: delete the User
   if DriverProfile save fails.
8. Return:
   `{ driver: { _id, firstName, lastName, email, role, requiresPasswordChange }, driverProfile: { idCardNumber, address }, temporaryPassword: "Drv-..." }`

The plaintext password is returned **once** and never stored anywhere.

### 3.2 `GET /api/v1/admin/drivers`

**Guard:** `JwtAuthGuard → RolesGuard([UserRole.ADMIN])`

Returns all users with `role: DRIVER`, each joined with their `DriverProfile`.
Response shape per driver:

```ts
{
  _id, firstName, lastName, email, phoneNumber,
  requiresPasswordChange,   // drives the Status column in the UI
  createdAt,
  driverProfile: { idCardNumber, address }
}
```

### 3.3 `POST /api/v1/auth/force-password-change`

**Guard:** `JwtAuthGuard` (any authenticated user — driver logs in with temp
password first)  
**Location:** `apps/food-waste-backend/src/auth/auth.controller.ts`

**Request body:**

```ts
newPassword: string; // @IsString, @MinLength(8)
```

**Logic:**

1. Verify `req.user.requiresPasswordChange === true` — throw
   `ForbiddenException` if false (prevents misuse)
2. Hash `newPassword` with bcrypt
3. Update User: `{ password: hashed, requiresPasswordChange: false }`
4. Sign and return a **fresh JWT** with `requiresPasswordChange: false` in the
   payload
5. Return:
   `{ accessToken, refreshToken, user: { ...profile, requiresPasswordChange: false } }`

The fresh JWT allows the mobile app to transition directly to `AUTHENTICATED`
without a second login.

### 3.4 JWT Payload Update

**File:** wherever `JwtStrategy` / `AuthService.signToken()` lives.

Add `requiresPasswordChange` to the JWT payload:

```ts
{
  sub: user._id,
  email: user.email,
  role: user.role,
  requiresPasswordChange: user.requiresPasswordChange,  // ← new
}
```

This allows the mobile app to decode it **synchronously** — no `/auth/me`
waterfall request.

---

## 4. Mobile — Hard Password Enforcement

### 4.1 AuthFlowState

Add to `apps/mobile/src/store/authSlice.ts`:

```ts
export enum AuthFlowState {
  // ...existing values unchanged...
  PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED',
}
```

### 4.2 Login Flow Change

After successful login, decode the JWT payload. If
`requiresPasswordChange === true`, dispatch
`flowState: PASSWORD_CHANGE_REQUIRED` instead of `AUTHENTICATED`. Driver cannot
reach `DriverStack`.

### 4.3 RootNavigator

New case added to the switch:

```ts
case AuthFlowState.PASSWORD_CHANGE_REQUIRED:
  return <AuthStack initialRouteName="ForceChangePassword" />;
```

Full routing table:

| AuthFlowState                       | Destination                           |
| ----------------------------------- | ------------------------------------- |
| `PASSWORD_CHANGE_REQUIRED`          | AuthStack → ForceChangePasswordScreen |
| `AUTHENTICATED` + `role === DRIVER` | DriverStack                           |
| `AUTHENTICATED` + other roles       | MainStack                             |
| `UNAUTHENTICATED`                   | AuthStack → Login                     |
| _(all other existing states)_       | _(unchanged)_                         |

### 4.4 Navigation Types

Add to `DriverStackParamList` / `AuthStackParamList` in
`apps/mobile/src/navigation/types.ts`:

```ts
ForceChangePassword: undefined;
```

### 4.5 ForceChangePasswordScreen

**File:** `apps/mobile/src/features/auth/screens/ForceChangePasswordScreen.tsx`

- `KeyboardAvoidingView` + `ScrollView` wrapping the entire screen — keyboard
  never covers the submit button
- **Single** password field (no confirm field — consistent with registration
  screen)
- `BackHandler.addEventListener('hardwareBackPress', () => true)` in `useEffect`
  — Android back button disabled entirely
- Calls `POST /auth/force-password-change` with the new password
- On success: store fresh JWT in Keychain, dispatch `flowState: AUTHENTICATED` →
  RootNavigator routes to `DriverStack` automatically
- No "skip" button, no back navigation — hard wall

---

## 5. Web — Admin Drivers Page

**File:** `apps/web/src/app/[locale]/(admin)/admin/drivers/page.tsx`

Page has two sections:

### 5.1 Create Driver Form

Fields: First Name, Last Name, Email, Phone, ID Card Number, Address

**Zod validation schema:**

```ts
z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phoneNumber: z
    .string()
    .transform(v => v.replace(/\s+/g, ''))
    .pipe(z.string().min(8)),
  idCardNumber: z
    .string()
    .length(8, 'Tunisian CIN must be exactly 8 digits')
    .regex(/^\d{8}$/, 'CIN must be 8 digits'),
  address: z.string().min(1),
});
```

On success: modal (non-auto-dismissing) displays:

```
✅ Driver account created

Temporary password:   Drv-3a7f2c-9b1e4d   [Copy]

Share this with the driver — it will never be shown again.
                                        [Close]
```

`[Copy]` uses `navigator.clipboard.writeText()`. Modal only closes on explicit
`[Close]` click — never auto-dismisses.

### 5.2 Drivers Table

Fetched from `GET /admin/drivers`. Columns: Name, Email, Phone, ID Card,
Address, Status, Created.

**Status column** driven by `requiresPasswordChange`:

| `requiresPasswordChange` | Badge         | Color  |
| ------------------------ | ------------- | ------ |
| `true`                   | Pending Setup | Yellow |
| `false`                  | Active        | Green  |

This gives admins an instant view of who has completed onboarding vs. who still
holds the temp password.

### 5.3 Cache Invalidation

`useCreateDriver` mutation calls:

```ts
onSuccess: () => {
  void queryClient.invalidateQueries({ queryKey: ['drivers'] });
};
```

New driver appears in the table immediately when the modal is closed — no manual
refresh needed.

### 5.4 New Files

| Action | File                                                                            |
| ------ | ------------------------------------------------------------------------------- |
| Create | `apps/web/src/app/[locale]/(admin)/admin/drivers/page.tsx`                      |
| Create | `apps/web/src/hooks/use-drivers.ts` — `useCreateDriver`, `useDrivers` hooks     |
| Modify | `apps/web/src/services/admin.service.ts` — add `createDriver()`, `getDrivers()` |

---

## 6. Files Changed (Summary)

| Action | File                                                                                | Reason                                                                         |
| ------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Modify | `packages/shared/src/enums/user.enum.ts`                                            | Verify `DRIVER` present (done in driver MVP)                                   |
| Modify | `apps/food-waste-backend/src/users/schemas/user.schema.ts`                          | Add `requiresPasswordChange` field                                             |
| Create | `apps/food-waste-backend/src/drivers/schemas/driver-profile.schema.ts`              | New DriverProfile schema                                                       |
| Modify | `apps/food-waste-backend/src/drivers/drivers.module.ts`                             | Register DriverProfile schema                                                  |
| Modify | `apps/food-waste-backend/src/admin/controllers/admin-user-management.controller.ts` | Add `POST /admin/drivers`, `GET /admin/drivers`                                |
| Create | `apps/food-waste-backend/src/admin/dto/create-driver.dto.ts`                        | Request DTO                                                                    |
| Modify | `apps/food-waste-backend/src/auth/auth.controller.ts`                               | Add `POST /auth/force-password-change`                                         |
| Modify | `apps/food-waste-backend/src/auth/auth.service.ts`                                  | `forcePasswordChange()` method + JWT payload update                            |
| Modify | `apps/mobile/src/store/authSlice.ts`                                                | Add `PASSWORD_CHANGE_REQUIRED` state, decode `requiresPasswordChange` from JWT |
| Modify | `apps/mobile/src/navigation/RootNavigator.tsx`                                      | New case for `PASSWORD_CHANGE_REQUIRED`                                        |
| Modify | `apps/mobile/src/navigation/types.ts`                                               | Add `ForceChangePassword` to AuthStack params                                  |
| Create | `apps/mobile/src/features/auth/screens/ForceChangePasswordScreen.tsx`               | Hard wall screen                                                               |
| Create | `apps/web/src/app/[locale]/(admin)/admin/drivers/page.tsx`                          | Admin drivers page                                                             |
| Create | `apps/web/src/hooks/use-drivers.ts`                                                 | TanStack Query hooks                                                           |
| Modify | `apps/web/src/services/admin.service.ts`                                            | Add driver API calls                                                           |

---

## 7. Security Notes

- Temporary password is generated with `crypto.randomBytes` — not `Math.random`
- Plaintext password never stored; returned in response body once only over
  HTTPS
- `POST /auth/force-password-change` verifies `requiresPasswordChange === true`
  server-side — cannot be called by already-active users
- `requiresPasswordChange` lives in JWT payload — decoded synchronously, no
  waterfall `/auth/me` call
- `BackHandler` prevents navigation back from `ForceChangePasswordScreen` — no
  state loop possible

---

## 8. Out of Scope (this spec)

- Driver profile edit (admin edits idCardNumber, address after creation)
- Driver suspension / deactivation from admin dashboard
- "Become a Driver" public web form (separate feature, separate spec)
- Vehicle information fields on DriverProfile
- Driver document uploads (ID card photo, license scan)
