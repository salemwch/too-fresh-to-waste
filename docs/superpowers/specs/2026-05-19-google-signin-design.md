# Google Sign-In Design

**Date:** 2026-05-19 **Scope:** Mobile (consumer) + Web merchant app
**Provider:** Google only (Facebook deferred) **Approach:** Token Exchange —
frontend obtains Google ID token, sends to backend, backend verifies and issues
our own JWT tokens

---

## 1. Backend

### New Endpoint

`POST /auth/google`

Accepts `{ idToken: string }` from mobile or web. No session redirect, no OAuth
callback URL.

### Token Verification

Use `google-auth-library` (official Google package) to verify the ID token
server-side.

After verification, explicitly check `email_verified: true` in the token
payload. Reject with `401` if false.

Extract from payload: `googleId` (sub), `email`, `email_verified`, `firstName`
(given_name), `lastName` (family_name), `picture`.

### User Resolution Logic

```
1. Find user by googleId
       → found: log in, issue tokens

2. Find user by email, isEmailVerified: true
       → found: link googleId to account
               → send "Google Sign-In linked to your account" transactional email
               → log in, issue tokens

3. Find user by email, isEmailVerified: false
       → found: account was squatted (hacker registered the email without verifying)
               → null the password field          (hacker's password is gone)
               → bump tokenRevocationVersion       (kills any active session hacker holds)
               → set isEmailVerified: true         (Google's verification supersedes ours)
               → link googleId
               → log in, issue tokens

4. No account found
       → create new user:
               isEmailVerified: true (Google verified)
               authProvider: 'google'
               googleId: <from token>
               password: null
               firstName, lastName, email from token
       → log in, issue tokens
```

Response envelope is identical to `POST /auth/login` — no special handling
needed on clients.

### User Schema Changes

| Field          | Type                                | Notes                                                                                                |
| -------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `googleId`     | `string` (optional)                 | Sparse unique index                                                                                  |
| `authProvider` | `'local' \| 'google'`               | Default `'local'`                                                                                    |
| `password`     | `string` (optional at schema level) | Still required in `RegisterDto` for email/password flow — DTO validation is the gate, not the schema |

`password` optionality is a DB concern only. `POST /auth/register` uses
`RegisterDto` with `@IsNotEmpty() password: string` — a regular user cannot
register without a password via the API.

### New Package

```
google-auth-library
```

No new Passport strategy needed.

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
GoogleSignin.configure({ webClientId: process.env.GOOGLE_WEB_CLIENT_ID });
```

### Sign-In Flow

```
Tap "Continue with Google"
  → GoogleSignin.hasPlayServices()        (checks device compatibility)
  → GoogleSignin.signIn()                 (native Google popup)
  → extract idToken from result
  → POST /auth/google { idToken }
  → same response as POST /auth/login
  → store tokens in Keychain (existing logic, unchanged)
  → dispatch loginSuccess to Redux
  → navigate to MainStack
```

### Cancellation & Error Handling

All calls wrapped in try/catch with explicit cancellation detection:

```ts
import { statusCodes } from '@react-native-google-signin/google-signin';

try {
  await GoogleSignin.hasPlayServices();
  const userInfo = await GoogleSignin.signIn();
  // send idToken to backend
} catch (error: any) {
  if (error.code === statusCodes.SIGN_IN_CANCELLED) {
    // User dismissed popup — silent, no error shown
  } else {
    // Show error toast
  }
}
```

Without this, a cancelled popup leaves a stuck loading spinner.

### UI Changes

- `RegisterScreen` — Google button below the form, separated by `— or —` divider
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

Wrap `app/[locale]/layout.tsx` with `GoogleOAuthProvider` (outermost position,
no conflict with existing providers):

```tsx
<GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}>
  {/* existing providers */}
</GoogleOAuthProvider>
```

### Sign-In Flow

```
Click "Continue with Google"
  → useGoogleLogin hook triggers Google popup
  → receive credential (ID token)
  → POST /auth/google { idToken }
  → backend sets HttpOnly cookies (same as POST /auth/login)
  → AuthProvider detects session
  → redirect to merchant dashboard
```

### UI Changes

- `/[locale]/(auth)/login/page.tsx` — Google button below email/password form,
  `— or —` divider
- `/[locale]/(merchant-onboarding)/` — Google button on the first step of
  merchant signup

### Native Setup (One-Time)

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

- `email_verified: true` checked before any account action — hard reject if
  false
- Unverified squatted accounts: password nulled + tokens revoked on Google link
- `tokenRevocationVersion` bumped on squatted account link — kills hacker's
  active sessions
- "Account linked" email sent when Google is linked to an existing verified
  account
- `googleId` stored with a sparse unique index — prevents duplicate Google
  accounts
- `password` field in DB can be null for Google users — `RegisterDto` still
  enforces it for email/password registrations via class-validator

---

## 5. Out of Scope

- Facebook Sign-In (deferred)
- Apple Sign-In
- "Unlink Google account" / account management settings
- "Set a password" flow for Google-only users
- Web consumer registration (web is merchant/admin only)
