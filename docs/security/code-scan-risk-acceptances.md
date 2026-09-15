# Snyk Code - Risk Acceptances and False-Positive Audit

**Scope:** the 14 High and 3 Medium Snyk Code findings open as of 2026-09-10.
**Owner:** repository maintainer. **Review trigger:** before any change to the
production security baseline, and whenever a listed file is modified.

Findings are **not** suppressed. No `.snyk` policy file exists, no Snyk rule has
been weakened, and no finding is excluded from scanning. The Snyk report still
shows all 17. This document records why each is not a defect, so a future reader
reaches the same conclusion without repeating the investigation.

Two categories follow: **accepted development-only risks** (section 1) and
**verified false positives** (section 2).

---

## 1. Accepted development-only risks

Three findings involve real string literals that resemble credentials. They are
accepted rather than dismissed, because the reasoning depends on runtime guards
rather than on the values being self-evidently inert.

### 1.1 `apps/mobile/src/dev/devSession.ts:119` and `:121`

`javascript/HardcodedNonCryptoSecret` (CWE-547), High.

```
DEV_ACCESS_TOKEN  = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJkZXYtZml4dHVyZSJ9.not-a-real-signature'
DEV_REFRESH_TOKEN = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJkZXYtZml4dHVyZS1yZWZyZXNoIn0.not-a-real-signature'
```

**Why non-production.** They seed an authenticated session against a local mock
API so UI work does not require a live backend.

**Why the values are not usable credentials.** The header decodes to
`{"alg":"none"}` and the signature segment is the literal string
`not-a-real-signature`. No server that verifies signatures accepts either token,
including this project's own backend, which requires HS256 with a secret that
`env.validation.ts` now denylists development literals from.

**Guards preventing production use.**
`devSessionBlockedReason(isDev, flag, apiUrl)` returns a non-null reason unless
all three hold:

1. `__DEV__` is true - false in every release build
2. an explicit opt-in environment flag equals exactly `"true"`
3. `API_BASE_URL` points at localhost - a production or LAN URL is refused

**Evidence.** `apps/mobile/src/dev/__tests__/devSession.test.ts` exercises all
three gates including the negative cases: `'not a development build'`, a
production API URL, and the `https://localhost.attacker.test/api/v1`
hostname-confusion case. The same file asserts at lines 141-146 that the app
entry point loads this module through
`if (__DEV__) { require('./src/dev/devSession') }` and **not** a top-level
`import`, which is what lets Metro eliminate it from a release bundle. That
assertion is the load-bearing one: without it the module would be bundled even
though its code paths are unreachable.

### 1.2 `apps/mobile/tools/dev-mock-api/server.mjs:400`

`javascript/HardcodedNonCryptoSecret` (CWE-547), High.

```
ok({ accessToken: 'dev-access-token', refreshToken: 'dev-refresh-token' })
```

**Why non-production.** A local mock HTTP server under `tools/`, started by hand
during UI development. It is not imported by application source, so Metro never
reaches it and it cannot enter any bundle.

**Why the values are not usable credentials.** They are the literal strings
`dev-access-token` and `dev-refresh-token`, returned by a server the developer
started on their own machine. They are not JWTs and carry no signature.

**Guards preventing production use.** The file is not referenced from
`apps/mobile/src/**`. Reaching it requires starting it deliberately and pointing
the app at localhost, which is itself gated by the `devSessionBlockedReason`
localhost check above.

**Evidence.** `git grep dev-mock-api -- apps/mobile/src` returns nothing, and
the literal `dev-access-token` is absent from the R8-minified release JS bundle
(see 1.3 for the method).

### 1.3 `apps/mobile/tools/dev-mock-api/server.mjs:760`

`javascript/HttpToHttps` (CWE-319), Medium.

```
const server = createServer((req, res) => { ... })
```

Snyk reports that `node:http.createServer` transmits in cleartext. That is
accurate: this server speaks plain HTTP.

**Why non-production.** It is the same local mock server as 1.2. It binds
localhost, is started by hand, and exists so UI work can proceed without a
backend. It is not part of the app, not part of the API, and not deployed.

**Why the exposure is bounded.** Traffic never leaves the developer's machine,
and the data carried is fixture data the file itself defines. Terminating TLS on
a localhost mock would add a certificate-trust problem to every developer's
setup and protect nothing.

**Guards preventing production use.** The mobile client refuses a non-localhost
API URL through `devSessionBlockedReason`, so pointing a build at this server
over a network is blocked on the client side as well.

### Shipped-artifact evidence for section 1

All three acceptances were checked against the **R8-minified release build**
(`assembleDevRelease`), not the debug build, using a positive control to prove
the search method works:

| String                                       | Release JS bundle |
| -------------------------------------------- | ----------------- |
| `toofreshtowaste` (control, must be present) | **PRESENT**       |
| `not-a-real-signature` (1.1 fixture)         | absent            |
| `devSessionBlockedReason` (1.1 guard itself) | absent            |
| `dev-access-token` (1.2 fixture)             | absent            |

The guard predicate's own name being absent shows the entire module is
eliminated from the release bundle, which is stronger than the unit tests alone:
the code is not merely unreachable, it is not shipped.

---

## 2. Verified false positives

### 2.1 NoSQL Injection - `javascript/NoSqli` (CWE-943), 4 High

| File                                                                       | Line |
| -------------------------------------------------------------------------- | ---- |
| `apps/food-waste-backend/scripts/migrations/fix-wrongly-expired-orders.js` | 57   |
| `apps/food-waste-backend/scripts/migrations/fix-wrongly-expired-orders.js` | 70   |
| `apps/food-waste-backend/src/seeds/create-admin-direct.ts`                 | 48   |
| `apps/food-waste-backend/src/seeds/reset-admin-password.ts`                | 52   |

**These are manually executed maintenance and seed scripts.** None is registered
in `package.json` scripts. Each documents its own invocation in a header comment
and is run by an operator with `node` or `npx ts-node`. They are not routes, not
jobs, and not reachable from the running API.

**Inputs originate from environment configuration or database-returned values.**
Every input is read from `process.env`: `DATABASE_URL`, `ADMIN_EMAIL`,
`NEW_ADMIN_PASSWORD`. There is no HTTP request, no request body, no query
string, and no `process.argv` parsing anywhere in these files.

**There is no attacker-controlled source.** Snyk's SARIF `codeFlows` show step 0
of all four traces as `new MongoClient(...)`. The analyser classifies the
database connection itself as a remote source, so every value read back out of
Mongo is marked tainted. The "unsanitized input" in the report is the driver's
own return value.

**The update filters use `ObjectId` values returned by the driver.** Each sink
is `updateOne({ _id: <doc>._id }, ...)` where `<doc>` came from a `find()` or
`findOne()` on the same collection moments earlier. `_id` is a BSON `ObjectId`
instance, not a string, so it cannot carry a query operator: the `$`-prefixed
keys that make NoSQL injection possible require an attacker-supplied object or
string reaching the filter, and neither exists on these paths.

**Exploiting them would already require privileged database access.** To
influence the `_id` reaching `updateOne`, an attacker must first write to the
collection the script reads. Anyone able to do that can modify the documents
directly and has no reason to route through a maintenance script an operator
runs by hand.

**Reproduction.** The finding was reproduced in a nine-line standalone file
containing no user input at all, confirming the rule fires on a database-sourced
`_id` alone rather than on anything specific to this codebase.

### 2.2 Remaining false positives

| File:line                        | Rule                     | What is actually there                                                                                                                                                                  |
| -------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.controller.ts:288`, `:495` | HardcodedNonCryptoSecret | Swagger `@ApiResponse` examples containing `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`, the public base64 of the JWT header `{"alg":"HS256","typ":"JWT"}`, truncated with an ellipsis     |
| `cookie-security.util.ts:20`     | HardcodedNonCryptoSecret | Cookie **names** (`__Host-access_token`), RFC 6265bis prefixes                                                                                                                          |
| `cookie-security.util.ts:199`    | HardcodedNonCryptoSecret | The `getSecurityConfig` diagnostics block. Not a secret - but it did carry a genuine defect, a stale `'365 days'` literal, fixed separately. The values are now read from configuration |
| `BiometricAuth.ts:90`            | HardcodedNonCryptoSecret | A Keychain **key name**, `biometric_auth_verification`                                                                                                                                  |
| `SecureStorage.ts:18`            | HardcodedNonCryptoSecret | Storage **key names** such as `auth_access_token`                                                                                                                                       |
| `spacing-snapshot.mjs:154`       | HardcodedNonCryptoSecret | A Tailwind spacing-token regex                                                                                                                                                          |
| `user.controller.ts:74`, `:85`   | NoHardcodedPasswords     | OpenAPI `@ApiBody` request examples rendered into Swagger UI                                                                                                                            |

**Correction (2026-09-10).** An earlier revision listed
`dev-mock-api/server.mjs:760` here as a false positive, described as a
`new URL()` parsing base. That was a misreading. Snyk's message is
_"node:http.createServer uses HTTP which is an insecure protocol"_ — it flags
the plain-HTTP server, and the report is correct. It has been moved to section
1.3 as an accepted development-only risk. Recording the error rather than
editing it away: a triage that quietly reclassifies its own mistakes is not
auditable.

---

## Deliberately not done

- **No `.snyk` policy file.** Snyk Code ignores are not supported there.
  `snyk ignore --help` states: _"Ignoring issues or vulnerabilities using the
  .snyk file is not supported for Snyk Code"_. The only local alternative,
  `exclude:`, removes whole files from scanning, which would hide future real
  findings in security-sensitive scripts.
- **No rule weakening.** No Snyk or Semgrep rule was relaxed to make the report
  green.
- **No global suppression.** Per-finding ignores in the Snyk platform UI remain
  an option, documented but deliberately not applied, so the decision stays
  explicit and reviewable.
