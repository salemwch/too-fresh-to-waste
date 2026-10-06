---
status: in-review
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

- [x] npm: manifests + overrides, lockfile regenerated, `check:lockfile` OK
- [x] Every resolved version in the lockfile is at or above its fix (grep)
- [x] `pnpm audit` clean except accepted GHSAs
- [x] Gate: type-check, backend check:ts, all three test suites, web build
- [x] Ruby: constraints resolve and CocoaPods / fastlane load (Docker, Ruby 3.3)
- [x] PR #103 merged (264b6e15); 50 alerts closed, production deploys healthy
- [ ] Second wave (9 alerts raised by the post-merge scan) - this branch

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

- 2026-10-06: Gates passed - type-check 7/7, backend check:ts, backend 159
  suites / 2,528 tests, web 53 / 1,414, mobile 163 / 2,659, web production
  build, lint, check:lockfile. `pnpm audit`: 0 unaccepted.
- 2026-10-06: The Gemfile on master does not resolve. `f4abf86d` (the RN 0.87
  upgrade, marked unverified) copied the template's `xcodeproj < 1.26.0` next to
  the project's `cocoapods ~> 1.16`, and every CocoaPods 1.16+ requires
  xcodeproj >= 1.26. Proven in Ruby 3.3: master fails
  (`version solving has failed`), the pre-upgrade Gemfile resolves.
  `android-release.yml` runs `bundle install` there (`bundler-cache`), so the
  Android release job is broken on master; the Actions billing lock hid it. Fix:
  drop the `xcodeproj` pin (a CocoaPods 1.15 hotfix, RN#47237) and replace the
  `concurrent-ruby < 1.3.4` pin with a security floor (the pin guarded
  ActiveSupport < 7.1 from 1.3.5's missing `logger` require, RN#48966;
  activesupport >= 7.2.3.1 and the declared `logger` cover it). Rejected:
  adopting the template's `cocoapods >= 1.13` (it pins CocoaPods to 1.15.2, a
  downgrade, and keeps concurrent-ruby vulnerable).
- 2026-10-06: Ruby verified in Docker (ruby:3.3): resolves (130 gems),
  activesupport 7.2.4, concurrent-ruby 1.3.8, cocoapods 1.17.0, xcodeproj
  1.28.1, fastlane 2.240.1; `ActiveSupport::Logger` instantiates with
  concurrent-ruby loaded, `require "cocoapods"`, `pod --version` and
  `fastlane --version` all succeed. The first attempts stalled on Docker
  Desktop's network: Bundler's 23 MB compact index never finished inside its
  timeout and it fell back to the full index. Seeding the index file from the
  host fixed that; it was never the Gemfile.

- 2026-10-06: The scan triggered by merging #103 raised 9 alerts (#255-#263),
  none caused by it (all 9 packages resolved identically before and after).
  Fixed in-major: proxy-addr, shell-quote, compression, joi, sharp,
  source-map-js, smol-toml. postcss-selector-parser crossed 6 -> 7 under
  Tailwind 3.4, accepted only after the emitted CSS matched rule for rule (only
  Google Fonts unicode-ranges differed, from a cleared next/font cache).
  sprintf-js has no fix and is never loaded (only js-yaml's CLI requires
  argparse); accepted. Gates: check:lockfile, type-check, backend check:ts,
  backend 2,528 / web 1,414 / mobile 2,659 tests, lint, web build; pnpm audit 0
  unaccepted. Details in .claude/rules/dependencies.md.

## Open questions

- Non-blocking: 40 open Dependabot PRs. Those superseded by this change close
  themselves when it merges; the remainder need triage one by one.
