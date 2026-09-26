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
password error - **except where saying so would reveal the account**.

**Login is that exception (2026-09-25).** An unauthenticated caller must not be
able to tell an unknown email from a social-only account, so a password typed
for a Google/Facebook/Apple account gets the same 401 `INVALID_CREDENTIALS` as a
wrong password, after the same argon2 work (dummy hash), and counts as a failed
attempt. The provider hint reaches the real owner privately: the forgot-password
flow emails "sign in with <provider>". The engineer-approved enumeration
requirements and the decision record are in
`.claude/work/backend-error-messages-i18n.md`.

### Email verification state

| Variant    | Field                       |
| ---------- | --------------------------- |
| Verified   | `isEmailVerified === true`  |
| Unverified | `isEmailVerified === false` |

**Rule**: Password-sensitive flows (reset, change) must check verification
state. An unverified OAuth user has a different UX path than an unverified local
user.

### Account state

There is **no `isActive` field on the User schema** — account state lives in
`status: UserStatus`. Guard on that.

| Variant                                | Field                                                 |
| -------------------------------------- | ----------------------------------------------------- |
| Active                                 | `status === UserStatus.ACTIVE`                        |
| Registered, not yet verified           | `status === UserStatus.PENDING`                       |
| Suspended / blocked / deleted / anon'd | `SUSPENDED` \| `BLOCKED` \| `DELETED` \| `ANONYMIZED` |

**Rule**: Never send auth emails (reset, verification) to a disabled account.
Use `MAILABLE_STATUSES` in `auth.service.ts` — `ACTIVE` and `PENDING` only.
`PENDING` is included on purpose: an unverified user is exactly who needs a
verification or reset link.

**Rule**: the response for unknown / disabled / OAuth / local must be
byte-identical, or the endpoint becomes an oracle for which emails have accounts
and how they sign in.

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

> **Clearing a token is not the same as assigning `undefined`.** Mongoose
> deletes `undefined` keys from an update before it reaches MongoDB, so
> `{ passwordResetToken: undefined }` is a silent no-op and the token stays
> valid for the rest of its window. Always `$unset`. Covered by
> `users/test/user-update-password.spec.ts`.

If you cannot answer all five from the code, the implementation is incomplete.

---

## Known provider-specific restrictions (keep updated)

| Flow                | Local               | Google                                                                                                       | Facebook                               | Apple                               |
| ------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------- | ----------------------------------- |
| Forgot password     | ✅ sends reset link | ✅ sends "sign in with Google" email                                                                         | ✅ sends "sign in with Facebook" email | ✅ sends "sign in with Apple" email |
| Reset password      | ✅                  | ❌ blocked in `updatePassword` (`authProvider !== 'local'` guard in `forgotPassword` prevents reaching this) | same                                   | same                                |
| Change password     | ✅                  | ❌ `updatePassword` throws — UI must hide this option for OAuth users                                        | same                                   | same                                |
| Login with password | ✅                  | ❌ generic `INVALID_CREDENTIALS` (no hint - enumeration), counted as a failed attempt                        | same                                   | same                                |
| Delete account      | ✅                  | ✅ (no password confirmation needed)                                                                         | ✅                                     | ✅                                  |

### Login attempt limit (2026-09-26)

Failures are counted per **(email, IP)** pair and per **IP**; 10 on either
blocks with 429 `LOGIN_TEMPORARILY_BLOCKED`. There is no email-wide block: it
would let anyone lock any account out. The email in the key is lower-cased and
trimmed. A successful sign-in clears that pair and that IP; an admin unlock
(`clearLoginAttempts('*', email)`) clears the email on every IP. If Redis
commands fail, the in-memory fallback keeps counting. Covered by
`auth/__tests__/login-attempt-limit.integration.spec.ts` (real Redis) and
`auth/services/__tests__/auth-security.fallback.spec.ts`.
