---
status: in-progress
scope: cross-app
gate:
  pnpm install && pnpm check:lockfile && pnpm audit && pnpm type-check && pnpm
  --filter @foodwaste/backend check:ts && pnpm test && pnpm --filter
  @foodwaste/web build
---

## Intent

Clear the 45 open Dependabot security alerts on `master` (2 critical, 16 high,
24 medium, 3 low; GitHub, 2026-10-06) without crossing a major version, as
`.claude/rules/dependencies.md` requires. They come from 16 packages.

## Constraints

- Lowest patched version inside the major already in use.
- Transitive packages go through `pnpm.overrides`, bounded with `^` so a future
  release cannot float across a major (the 2026-09-09 nodemailer lesson).
- Direct dependencies are fixed in the app manifest too (the 2026-09-21 lesson:
  Dependabot reads the declaration, `pnpm audit` reads the tree).
- `pnpm why <pkg> -P` per app, never only at the root.

## Inventory (2026-10-06)

| Package         | Alerts | Path (production unless noted)       | Was         | Fix                 |
| --------------- | ------ | ------------------------------------ | ----------- | ------------------- |
| next            | 2 crit | web direct                           | 16.3.5      | 16.3.6              |
| axios           | 12     | backend, web, mobile direct          | 1.18.0      | ^1.20.0             |
| nodemailer      | 10     | backend direct, never loaded         | 9.1.1       | removed (see below) |
| @fastify/busboy | 2      | backend: firebase-admin              | 3.2.0       | ^3.2.1              |
| @grpc/grpc-js   | 2      | backend: terminus, firestore; mobile | 1.14.4      | ^1.14.5             |
| engine.io       | 1      | backend: socket.io                   | 6.6.9       | ^6.6.10             |
| ip-address      | 4      | backend: geoip-lite                  | 10.4.0      | ^10.7.1             |
| js-yaml (v5)    | 1      | backend: @nestjs/swagger             | 5.3.0       | ^5.4.1              |
| moment          | 1      | backend: winston-daily-rotate-file   | 2.30.1      | ^2.31.0             |
| multer          | 1      | backend: @nestjs/platform-express    | 2.3.0       | ^2.4.0              |
| brace-expansion | 2      | dev only                             | 2.1.4/5.0.9 | ^2.1.7 / ^5.0.12    |
| fast-uri        | 1      | dev only                             | 4.1.4       | ^4.1.5              |
| activesupport   | 3      | apps/mobile/Gemfile (iOS tooling)    | >= 6.1.7.5  | >= 7.2.3.1          |
| concurrent-ruby | 3      | apps/mobile/Gemfile (iOS tooling)    | < 1.3.4     | >= 1.3.7            |

## Tasks & Acceptance

- [ ] npm: manifests + overrides, lockfile regenerated, `check:lockfile` OK
- [ ] Every resolved version in the lockfile is at or above its fix (grep)
- [ ] `pnpm audit` clean except accepted GHSAs
- [ ] Gate: type-check, backend check:ts, all three test suites, web build
- [ ] Ruby: constraints resolve and CocoaPods / fastlane load (Docker, Ruby 3.3)
- [ ] PR; Dependabot alerts close after merge

## Decisions

- 2026-10-06: `nodemailer` removed from the backend's dependencies instead of
  bumped 9 -> 10. The backend only does
  `import type Mail from 'nodemailer/lib/mailer'` for `Mail.Attachment`, which
  comes from `@types/nodemailer` (devDependency); email is sent through axios to
  an HTTP API, and nothing `require`s nodemailer at runtime. 9.1.1 is the last
  9.x release and none of the 5 advisories has a 9.x fix, so the alternative was
  a major bump of a package that never runs. The root override
  `nodemailer: ">=9.1.1 <10.0.0"` goes with it.
- 2026-10-06: Existing open-ended overrides (`>=x`) are rewritten as `^x` on the
  same major, so the fix cannot float across a major later.

## Open questions

- Non-blocking: 40 open Dependabot PRs. Those superseded by this change close
  themselves when it merges; the remainder need triage one by one.
