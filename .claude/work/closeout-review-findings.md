---
status: in-review
scope: cross-app
gate:
  pnpm --filter @foodwaste/backend check:ts && backend jest + test:db && pnpm
  --filter @foodwaste/mobile type-check && mobile jest && pnpm --filter
  @foodwaste/web type-check && web jest && check:design && pnpm check:lockfile
---

## Intent

Close out the uncommitted work (charity + ledger, error codes, password policy,
login security) before committing: fix what the four-lens adversarial review
(2026-09-25) found real, record what is not fixed and why. No new features.

## Constraints

- No unrelated changes. Backward compatible with installed app versions.
- No secrets in logs. No production DB operations. Do not commit until the user
  approves the commit plan.
- Every fix gets a test that fails without it (mutation-checked).

## Tasks & Acceptance

Regressions caused by this work:

- [x] F1 POST /orders error body: top-level code + localized message + real
      status (403 was 500); keep legacy `details` (with code/message/flags) so
      installed apps still open the phone modal with `requiresPhoneSetup`.
- [x] F2 /reviews: drop the controller-level GlobalExceptionFilter so the global
      envelope applies (message was becoming an object).
- [x] F6 readApiError: a non-JSON (string/HTML) body yields no message, so the
      translated fallback shows, never a proxy page.
- [x] F7 password @Matches messages -> catalog code; weak/common/zxcvbn failures
      get their own code instead of PASSWORD_POLICY's "12 chars + symbol" text.
- [x] F13 mobile Google sign-in lockout matched by code, not English text.

Password policy (12 everywhere):

- [x] F8 env PASSWORD_MIN_LENGTH may raise, never lower, the shared minimum;
      .env.example 12; CreateUserDto 12; web accept-invitation / reset /
      merchant signup use the shared web policy; web reset form reads
      PASSWORD_REUSED by code.
- [x] F9 USER_PASSWORD_HASH_OPTIONS at every user-password hash (invites, driver
      management, seeds).
- [x] F12 forcePasswordChange + invitation accept run PasswordPolicyService;
      resetPassword refuses a non-mailable (disabled) account.

Login hardening:

- [x] F10 argon2.verify on a non-argon2 stored value -> mismatch, not 500;
      dummy-hash failure is not memoised.
- [x] F11 forgot/resend: token write moves into the background job with the
      mail.
- [x] F3 web refresh 403: suspended/inactive detected by code.

Charity / ledger:

- [x] F15 donation listener rethrows so RabbitMQ retries; skips a refunded order
      (refund-before-complete race); guards NaN subtotal; E11000 on a concurrent
      duplicate is the normal path.
- [x] F16 CommissionService.reverseForOrder reverses platform revenue even when
      the establishment is gone.

Verification gaps:

- [x] F19 (done except pickup + online-refund emit tests: no harness for
      confirmPickup; listed) tests: login verifies against the dummy hash (not
      just "verify called"); pickup emits order.completed; admin refund emits
      order.refunded; LoginScreen opens the locked modal; replace the
      tautological donation idempotency test; checkout error envelope.
- [x] F17 k6 auth-security suite tells a lockout 429 from a throttler 429 by
      code.
- [x] F18 docs: auth-scenarios.md (OAuth login row), login-test.md, commission
      comment "at completion", drivers unassign docstring.

## Decisions

- 2026-09-25: Checkout per-offer validation reasons stay off the wire (internal
  ids/stock numbers, English). Client shows ORDER_OFFERS_UNAVAILABLE,
  translated.
- 2026-09-25: Pickup no longer releases the wallet for a legacy COMPLETED
  Konnect payment. Not restored: no code writes COMPLETED for order payments any
  more (schema marks it legacy), and a pre-HELD order awaiting pickup expired
  long ago.
- 2026-09-25: An OAuth-only account that types a password gets
  INVALID_CREDENTIALS (enumeration). The provider hint is delivered by the
  forgot-password email. auth-scenarios.md updated to say so.
- 2026-09-25: resolveErrorLocale keeps first-listed-tag matching (documented;
  clients send one tag).

## Not fixed (recorded, with reason)

See the close-out report. Redis fail-open, no outbox for order events,
EventEmitter-mode retries, integration specs outside CI (and CI Mongo has no
replica set), pool rotation race, reversal not undoing contributor counts /
badges / loyalty, web login has no countdown/resend (feature), SSR locale,
ratchet blind to identifiers, same-constraint params.

## Open questions

- (blocking for commit) User approval of the commit plan.

## Verification (2026-09-25)

- Green on the final code: shared build + 41 tests; lockfile; backend tsc, 139
  suites / 2,342 unit tests; mobile tsc, 157 suites / 2,593 tests / 430
  snapshots; web tsc, 45 suites / 1,333 tests; check:design.
- Backend lint over the whole project: 5 errors, all in the committed
  test/security/route-inventory.ts (7b8238fd); none in a changed file.
- Every fix mutation-checked: broken on purpose, the new test failed, restored
  byte-for-byte (cmp).
- NOT run: test:db (13 suites + the new Redis and duplicate-donation cases) and
  the live curl check. The docker stack was stopped (clean exit 0) mid-session,
  and the backend image rebuild failed on `apk add` (gcc extract I/O / integrity
  error). Blocked on the user.
