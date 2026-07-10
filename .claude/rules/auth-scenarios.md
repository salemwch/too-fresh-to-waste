# Auth Flow Scenario Coverage

When touching **any** auth-related code (forgot-password, reset-password,
change-password, login, register, verify-email, resend-verification,
delete-account, link-provider, update-email), you MUST explicitly reason through
every actor variant below before writing or reviewing code. If a variant is not
handled, flag it and fix it — do not leave it as a known gap.

---

## Actor Variants — check all of these for every auth flow

### Auth provider

| Variant          | Field                         | When present        |
| ---------------- | ----------------------------- | ------------------- |
| Local (password) | `authProvider === 'local'`    | Manual registration |
| Google OAuth     | `authProvider === 'google'`   | Google Sign-In      |
| Facebook OAuth   | `authProvider === 'facebook'` | Facebook Sign-In    |
| Apple OAuth      | `authProvider === 'apple'`    | Apple Sign-In       |

**Rule**: Any flow that touches passwords (forgot, reset, change, login with
password) must guard on `authProvider !== 'local'` **before** running password
logic. OAuth users must receive a provider-specific response — never a generic
password error.

### Email verification state

| Variant    | Field                       |
| ---------- | --------------------------- |
| Verified   | `isEmailVerified === true`  |
| Unverified | `isEmailVerified === false` |

**Rule**: Password-sensitive flows (reset, change) must check verification
state. An unverified OAuth user has a different UX path than an unverified local
user.

### Account state

| Variant                  | Field                |
| ------------------------ | -------------------- |
| Active                   | `isActive === true`  |
| Soft-deleted / suspended | `isActive === false` |

**Rule**: Never send auth emails (reset, verification) to inactive accounts.

### Role

Roles: `consumer`, `merchant`, `admin`, `moderator`. Most auth flows are
role-agnostic, but confirm before assuming.

---

## Required check when writing auth code

Before marking any auth-related task done, answer:

1. **Local user** — does the happy path work?
2. **Google/Facebook/Apple user** — what happens? Is it blocked gracefully with
   a clear user-facing message (email or error)?
3. **Unverified user** — does the flow handle them or lock them out silently?
4. **Inactive user** — is the account gated before any processing?
5. **Token expiry / reuse** — what happens if the link is clicked twice or after
   the expiry time?

If you cannot answer all five from the code, the implementation is incomplete.

---

## Known provider-specific restrictions (keep updated)

| Flow                | Local               | Google                                                                                                       | Facebook                               | Apple                               |
| ------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------- | ----------------------------------- |
| Forgot password     | ✅ sends reset link | ✅ sends "sign in with Google" email                                                                         | ✅ sends "sign in with Facebook" email | ✅ sends "sign in with Apple" email |
| Reset password      | ✅                  | ❌ blocked in `updatePassword` (`authProvider !== 'local'` guard in `forgotPassword` prevents reaching this) | same                                   | same                                |
| Change password     | ✅                  | ❌ `updatePassword` throws — UI must hide this option for OAuth users                                        | same                                   | same                                |
| Login with password | ✅                  | ❌ no password field                                                                                         | same                                   | same                                |
| Delete account      | ✅                  | ✅ (no password confirmation needed)                                                                         | ✅                                     | ✅                                  |
