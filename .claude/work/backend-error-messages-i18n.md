---
status: in-review
scope: cross-app
gate:
  pnpm --filter @foodwaste/backend check:all && pnpm type-check && pnpm --filter
  @foodwaste/web test && pnpm --filter @foodwaste/mobile test
---

## Intent

Backend error messages reach users verbatim and are English-only: a French or
Arabic user who hits a validation error, a 404 or a business rule reads English.
Clients that want to react to a specific error match on English text (39 sites
across web and mobile), which breaks the moment copy changes.

Outcome: every error carries a stable machine-readable `code`, and its `message`
is in the requester's language (en / fr / ar). Clients branch on the code and
display the message.

## Constraints

- Response envelope stays `{ status, message, ... }`; `code` (and `params` when
  useful) are added, never replacing `message`.
- `exception.message` inside the backend stays English, so code that inspects it
  (listeners, retries, tests) keeps working.
- Locale from `Accept-Language`: `ar*` -> ar, `fr*` -> fr, anything else -> en.
  Mobile already sends it; web must send the page locale (the browser's own
  header is the browser language, not the `/fr/...` the user chose).
- No new dependency: the catalogue is TypeScript, so `fr` and `ar` typed
  `Record<ErrorCode, string>` make a missing translation a compile error.
- User-facing copy only (backend rule 12): no internal ids, no developer
  instructions ("Use ISO 8601 format"), no stack detail.
- 5xx stay generic in production, now also translated.

## Tasks & Acceptance

- [x] Catalogue + `appError(code, params)` + locale resolution, unit-tested
- [x] Filter emits `code` and a localised `message`; 4xx defaults (Unauthorized,
      Forbidden resource, Not Found, ThrottlerException) mapped to codes
- [x] ValidationPipe: per-constraint localised messages, `VALIDATION_FAILED`
      with a field list
- [x] Codemod migrates literal `throw new XException('...')` sites to codes
- [x] Ratchet test: raw-literal throw sites per file can only go down
- [x] Web sends `Accept-Language` from the page locale
- [x] The 39 client sites that match English text branch on `code`
- [ ] Gate green; adversarial review

## Decisions

- 2026-09-25: codes + backend localisation, not client-side catalogues. One
  catalogue serves web, mobile and any future client; clients keep a code only
  where they must branch. Rejected: translating on each client (three copies
  that drift), gettext-style keys by English text (breaks on any copy edit and
  gives clients nothing stable to branch on).
- 2026-09-25: TypeScript catalogue, not JSON: completeness is compiler-checked
  and nothing extra has to be copied into dist.

## Decisions (continued)

- 2026-09-25: 366 codes; 780+ throw sites migrated by an AST codemod plus hand
  edits for the structured sites. Ratchet (no-raw-error-messages.spec.ts) is at
  zero.
- 2026-09-25: `details` is an allowlist (blockedUntil, field, type,
  attemptsRemaining...), never on a 5xx. Several sites attached raw error text
  or internal stats; the old filter happened to drop them, the new one must not
  start sending them.
- 2026-09-25: catch-and-rethrow sites use `toHttpException` - an HttpException
  passes through (a 404 stays a 404), anything else becomes a coded 500.
  user.controller and privacy.controller used to turn every error into a 400/500
  carrying `error.message`.
- 2026-09-25: clients read errors through `readApiError` in @foodwaste/shared.
  Mobile still parses the old shapes during rollout.
- 2026-09-25: dead auth branches for `UserNotFoundError` / `PasswordPolicyError`
  removed - nothing threw them, and the first would have been an
  account-enumeration oracle.

- 2026-09-25 (login enumeration): the password is verified FIRST, against the
  account hash or a memoised dummy argon2id hash with identical parameters
  (USER_PASSWORD_HASH_OPTIONS). Every failure before it is proven - unknown
  email, wrong password, unverified, suspended, blocked, locked, social-only -
  returns the same 401 INVALID_CREDENTIALS with no details; the real reason
  (USER_NOT_FOUND / INVALID_PASSWORD / SOCIAL_LOGIN_ONLY) is only logged. The
  attempt limit answers 429 LOGIN_TEMPORARILY_BLOCKED, identical for known and
  unknown emails (Redis counters are keyed on the email string).
- 2026-09-25: account state (EMAIL_NOT_VERIFIED, ACCOUNT_SUSPENDED,
  ACCOUNT_INACTIVE, ACCOUNT_LOCKED) is disclosed ONLY after the correct
  password. Rejected: generic error even with the right password - it discloses
  nothing an attacker without the password can see, and it would leave
  unverified users with no way to learn they must verify.
- 2026-09-25: forgot-password and resend-verification send mail in the
  background (sendAuthEmailInBackground) so response time does not reveal an
  account; resend answers an already-verified account neutrally instead of an
  error.

## Open questions

- RESOLVED 2026-09-25 (login enumeration) - see Decisions.
- (non-blocking) Live check against the Docker image needs a rebuild:
  `docker compose build backend && docker compose up -d backend`.
