# Google Sign-In Design

**Date:** 2026-05-19 **Scope:** Mobile (consumer) + Web merchant app
**Provider:** Google only (Facebook deferred) **Approach:** Token Exchange —
frontend obtains Google ID token, backend verifies and issues our own JWT
tokens. No OAuth redirect flow, no Passport strategy.

---

## 1. Backend

### New Endpoint

`POST /auth/google`

```json
{ "idToken": "..." }
```

Accepts from both mobile and web. Single endpoint, no OAuth callback URL.

### Token Verification

Use `google-auth-library` (official Google package). No Passport strategy.

```ts
const ticket = await client.verifyIdToken({
  idToken,
  audience: configService.get('GOOGLE_CLIENT_ID'),
});
const payload = ticket.getPayload();
```

Verify explicitly:

- `aud` — must match our `GOOGLE_CLIENT_ID`
- `iss` — must be `accounts.google.com` or `https://accounts.google.com`
- `exp` — must not be expired (handled by `verifyIdToken`)
- `email_verified === true` — hard reject with `401` if false

Extract from payload:

- `googleId` = `payload.sub` — permanent Google identity, **never use email as
  the primary key**
- `email` = `payload.email`
- `email_verified` = `payload.email_verified`
- `firstName` = `payload.given_name`
- `lastName` = `payload.family_name`
- `picture` = `payload.picture`

### User Resolution Logic

```
1. Find user by googleId
       → found: log in, issue tokens

2. Find user by email, isEmailVerified: true
       → found: existing verified account
               → attach googleId
               → set authProvider = 'google' (or retain 'local' if keeping both)
               → send "Google Sign-In linked to your account" transactional email
               → DO NOT create a duplicate account
               → log in, issue tokens

3. Find user by email, isEmailVerified: false
       → found: squatted account — intentional recovery via Google's verified identity
               → password = null                  (hacker's password is gone)
               → tokenRevocationVersion++          (kills any active session hacker holds)
               → isEmailVerified = true            (Google's verification supersedes ours)
               → googleId = payload.sub
               → log in, issue tokens

4. No account found
       → create new user:
               isEmailVerified: true
               authProvider: 'google'
               googleId: payload.sub
               password: null
               firstName, lastName, email from payload
       → log in, issue tokens
```

Response envelope is identical to `POST /auth/login` — no special handling
needed on clients.

### New Package

```
google-auth-library
```

### User Schema Changes

**`googleId`:**

```ts
@Prop({ type: String, unique: true, sparse: true })
googleId?: string;
```

**`authProvider`:**

```ts
@Prop({ type: String, enum: ['local', 'google', 'facebook', 'apple'], default: 'local' })
authProvider: AuthProvider;
```

Defined as a union type for future expansion:

```ts
type AuthProvider = 'local' | 'google' | 'facebook' | 'apple';
```

**`password`:** Optional at schema level only. `RegisterDto` still enforces
`@IsNotEmpty() password: string` for email/password registration — DTO
validation is the gate, not the schema.

### Cookies After Google Login

Must remain identical to existing login cookies:

- `HttpOnly`
- `Secure`
- `SameSite=Lax`

Reuse the existing auth/session pipeline entirely. No separate session logic for
Google users.

---

## 2. Mobile (React Native — Consumer)

### Package

```
@react-native-google-signin/google-signin
```

### Initialization

Call once in `App.tsx` inside the existing `useEffect` that handles FCM token
setup:

```ts
GoogleSignin.configure({
  webClientId: process.env.GOOGLE_WEB_CLIENT_ID,
});
```

`webClientId` is required. Without it, `idToken` will be `null` and backend
verification will fail.

### Sign-In Flow

```
Tap "Continue with Google"
  → GoogleSignin.hasPlayServices()
  → GoogleSignin.signIn()               (native Google popup)
  → extract idToken from result
  → POST /auth/google { idToken }
  → same response as POST /auth/login
  → store tokens in Keychain (existing logic, unchanged)
  → dispatch loginSuccess to Redux
  → navigate to MainStack
```

### Error Handling

All calls wrapped in try/catch. Never leave loading state hanging.

```ts
import { statusCodes } from '@react-native-google-signin/google-signin';

try {
  await GoogleSignin.hasPlayServices();
  const userInfo = await GoogleSignin.signIn();
  const idToken = userInfo.data?.idToken;

  if (!idToken) throw new Error('missing_id_token');

  await dispatch(googleSignInAsync(idToken));
} catch (error: any) {
  if (error.code === statusCodes.SIGN_IN_CANCELLED) {
    // User dismissed — silent, reset loading state
  } else if (error.code === statusCodes.IN_PROGRESS) {
    // Already signing in — ignore
  } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    // Show toast: Google Play Services unavailable
  } else {
    // Show generic error toast
  }
}
```

Explicit cases handled:

- User cancelled popup
- Missing `idToken`
- Play Services unavailable
- Sign-in already in progress
- Backend verification failure (caught by the Redux thunk's error handling)

### UI Changes

- `RegisterScreen` — Google button below the form, `— or —` divider
- `LoginScreen` — Google button below email/password fields, same divider

### Native Setup (One-Time)

- Add `GOOGLE_WEB_CLIENT_ID` to `.env`
- Place `google-services.json` in `apps/mobile/android/app/` (same Firebase
  project already used for push notifications)
- Register Android SHA-1 fingerprint in Google Cloud Console

### No Changes To

- Redux auth slice (`loginSuccess` action reused as-is)
- Keychain storage logic
- Navigation logic
- TanStack Query setup

---

## 3. Web (Next.js — Merchant)

### Package

```
@react-oauth/google
```

### Provider Setup

Wrap `app/[locale]/layout.tsx` with `GoogleOAuthProvider`:

```tsx
<GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}>
  {/* existing providers */}
</GoogleOAuthProvider>
```

### Sign-In Component

Use `<GoogleLogin />` — not `useGoogleLogin()`. This component returns a
credential JWT (ID token) directly in `onSuccess`, which is what the backend
expects.

```tsx
<GoogleLogin
  onSuccess={credentialResponse => {
    const idToken = credentialResponse.credential;
    // POST /auth/google { idToken }
  }}
  onError={() => {
    // Show error toast
  }}
/>
```

Do NOT use the authorization-code flow or access-token flow.

### Sign-In Flow

```
Click "Continue with Google"
  → Google popup opens
  → credentialResponse.credential = ID token
  → POST /auth/google { idToken }
  → backend sets HttpOnly cookies (same as POST /auth/login)
  → AuthProvider detects session
  → redirect to merchant dashboard
```

### Error Handling

Explicit cases handled:

- `onError` callback — show error toast
- Missing `credentialResponse.credential` — guard before sending to backend
- Backend verification failure — caught by existing Axios 401 interceptor
- Google service unavailable — `onError` callback

Never leave loading state hanging.

### UI Changes

- `/[locale]/(auth)/login/page.tsx` — Google button below email/password form,
  `— or —` divider
- `/[locale]/(merchant-onboarding)/` — Google button on the first step of
  merchant signup

### One-Time Setup

- Add `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to `.env.local`
- Add the web app's domain to "Authorized JavaScript origins" in Google Cloud
  Console (same project as mobile)

### No Changes To

- AuthProvider session/refresh logic
- Axios interceptors and cookie handling
- Edge middleware JWT verification
- Zustand auth store

---

## 4. Security Checklist

- `email_verified: true` checked explicitly — hard `401` if false
- `payload.sub` used as `googleId` — email is never the primary identity key
- `aud`, `iss`, `exp` verified by `google-auth-library`
- Squatted unverified accounts: password nulled + `tokenRevocationVersion`
  bumped
- Existing verified accounts: `googleId` linked, no duplicate account created,
  notification email sent
- Cookies after Google login: `HttpOnly`, `Secure`, `SameSite=Lax` — reuse
  existing pipeline
- `googleId` has sparse unique index — prevents duplicate Google accounts
- `password` optional in schema; `RegisterDto` still enforces it for local
  registration

---

## 5. Out of Scope

- Facebook Sign-In (deferred)
- Apple Sign-In (deferred — `AuthProvider` type already includes `'apple'`)
- "Unlink Google account" / account management settings
- "Set a password" flow for Google-only users
- Web consumer registration (web is merchant/admin only)
- OAuth authorization-code flow or access-token flow
