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

- 2026-09-25 (after commit): the event-flow suite
  (orders/**tests**/pickup-refund-event-flow.integration.spec.ts) found two
  defects in confirmPickup, both from reading business state off the detail view
  (ORDER_DETAIL_FIELDS), which projects neither field:
  - paymentControl: every pickup after COMMISSION_MODEL_EFFECTIVE_AT booked no
    commission and the online payout fell back to 100%. Introduced by c44a0417.
    Fixed by reading it from `claimed`, the full document read in the pickup
    transaction.
  - pickupLocked: the 5-attempt pickup-code lockout never blocked a locked
    order. Pre-existing on master. Fixed by projecting pickupLocked /
    pickupLockedAt (additive on GET /orders/:id) and by adding
    `pickupLocked: { $ne: true }` to the atomic claim filter. Both
    mutation-checked. The atomic-filter guard only matters in a race and is not
    separately tested.
- 2026-09-25 correction: the close-out report said the local stack could not
  boot because it runs production config. Wrong. docker-compose.yml starts PM2
  with --env development; in development only JWT_SECRET and JWT_REFRESH_SECRET
  fail (weak-secret denylist, already on master). Verified by validating the
  container env against the real schema, and by booting the new image with
  throwaway random JWT secrets.

- 2026-09-26: security follow-up (login attempt limit and auth logs).
  - Lockout keyed on (email, IP), not email alone: the email-only block let
    anyone lock any account out with ten wrong passwords, repeatable every five
    minutes. Model: Auth0 brute-force protection, OWASP Authentication Cheat
    Sheet. The per-IP counter and the /auth/login route throttle (10 / 15 min /
    IP) still bound one source. Rejected: keep the email-wide block at a higher
    threshold (still a lockout lever), and CAPTCHA (disabled; no client sends a
    token). Not covered: guessing spread over many IPs, bounded only by the
    12-character policy and argon2 cost.
  - The key is lower-cased and trimmed. The raw string made every change of
    letter case a fresh budget of ten guesses.
  - A failing Redis command now counts in the in-memory fallback instead of
    reading as zero attempts; the fallback map is capped at 10,000 keys.
  - Auth logs carry userId where the account is known and a masked email
    (s***@domain) where it is not. The security-event payload keeps the email:
    it is the audit record admins act on.
  - Removed dead code with the old rules: AuthService.validateUser (no dummy
    hash, no counter, distinct inactive error) and
    AuthSecurityService.isCaptchaRequired (email-only key). Neither had a
    caller.

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

## Verification (2026-09-25, after the event-flow fix)

- The "NOT run" line above is superseded: test:db and the live check both ran.
- Gates on the final tree: shared build + 41 tests; lockfile; backend check:ts,
  139 suites / 2,342 unit tests, 15 suites / 152 test:db (real Mongo replica set
  - Redis); mobile tsc, 157 suites / 2,593 tests / 430 snapshots; web tsc, 45
    suites / 1,333 tests; check:design. Backend lint: the same 5 errors in
    test/security/route-inventory.ts, none in a changed file.
- Live check: image wfa-backend:closeout-2026-09-25 booted in a throwaway
  container (dev PM2 env, random JWT secrets never written to disk, PROCESS_ROLE
  api), liveness 200 in ~25s. POST /auth/login with an unknown email: 401
  INVALID_CREDENTIALS in en / fr / ar (0.48-0.69s, dummy argon2 work); the 10th
  failed attempt: 429 LOGIN_TEMPORARILY_BLOCKED with details.blockedUntil +5min.
  A curl user agent is refused first with 403 ACCESS_BLOCKED_SUSPICIOUS (bot
  defence, blocks the IP 5 minutes) - by design.
