---
status: in-progress
scope: cross-app
gate:
  pnpm check:lockfile && pnpm audit && pnpm type-check && pnpm --filter
  @foodwaste/backend check:ts && pnpm test && pnpm lint && pnpm --filter
  @foodwaste/web build (+ Android release build and OPPO smoke for batch B)
---

## Intent

Work through the 35 open Dependabot **version-update** PRs (not security
alerts - those are at 0 after #103 / #107). Close what is a duplicate or
obsolete, take the minor/patch updates in two tested batches instead of 30
separate merges, and handle each major on its own with its migration read.

## Constraints

- `.claude/rules/dependencies.md`: stay inside the major for routine bumps, test
  consumers when a major moves, update manifests and lockfile together.
- Mobile native-module bumps need an APK rebuild and a device run (memory:
  nitro_module_bump_needs_apk_rebuild).
- Sentry: web and backend share the hoisted `@sentry/core`; mobile's copy is
  deduplicated by `metro.config.js`, which fails the build on a version split.
- CI cannot run (GitHub Actions billing lock), so CI-only changes can't be
  verified.

## Inventory (2026-10-07)

| PR              | Update                                                                 | Class      | Plan                    |
| --------------- | ---------------------------------------------------------------------- | ---------- | ----------------------- |
| #82             | @radix-ui/react-tooltip (duplicate of #59)                             | duplicate  | close                   |
| #83             | @react-native-vector-icons/ionicons (duplicate of #62)                 | duplicate  | close                   |
| #84             | kotlin-stdlib-jdk7 2.0.21 -> 2.4.20                                    | obsolete   | close                   |
| #94             | node 24.11.1-alpine -> 26.10.0-alpine (backend Dockerfile)             | major      | decline                 |
| #95             | NestJS core group 11.2.5 -> 11.2.6, throttler 6.7.1                    | minor      | batch A                 |
| #69             | @sentry/node 10.58 -> 10.75                                            | minor      | batch A                 |
| #79             | @supabase/storage-js 2.108 -> 2.116                                    | minor      | batch A                 |
| #73             | libphonenumber-js 1.13.6 -> 1.13.13                                    | patch      | batch A                 |
| #17             | helmet 8.2 -> 8.3 (+ class-validator, see majors)                      | minor      | batch A                 |
| #75-77          | @types/multer, @types/luxon, @types/sanitize-html                      | patch      | batch A                 |
| #65             | @tanstack/react-query(-devtools) 5.102.8 -> 5.103.1 (web)              | minor      | batch A                 |
| #67             | next-intl 4.13 -> 4.14.5                                               | minor      | batch A                 |
| #68             | postcss 8.5.23 -> 8.5.28                                               | patch      | batch A                 |
| #72,70          | @radix-ui/react-separator, react-tabs (web)                            | patch      | batch A                 |
| #61,59          | @radix-ui/react-dropdown-menu, react-tooltip (packages/ui)             | patch      | batch A                 |
| #100            | ts-jest 29.4.11 -> 29.4.14 (packages/shared)                           | patch      | batch A                 |
| #102            | React Navigation 7.x group                                             | minor      | batch B                 |
| #54             | @react-native-google-signin/google-signin 16.1.2 -> 16.1.5             | patch      | batch B                 |
| #66             | react-native-permissions 5.6.1 -> 5.6.2                                | patch      | batch B                 |
| #62             | @react-native-vector-icons/ionicons 12.4.1 -> 12.5.0                   | minor      | batch B                 |
| #58             | @tanstack/query-sync-storage-persister                                 | minor      | batch B                 |
| #81             | react-hook-form 7.79 -> 7.88 (mobile)                                  | minor      | batch B                 |
| #88,86          | play-services-base 18.11.0, play-services-location 21.4.0              | minor      | batch B                 |
| #17             | class-validator 0.14 -> 0.15                                           | major(0.x) | own PR                  |
| #78             | argon2 0.44 -> 0.45                                                    | major(0.x) | own PR                  |
| #56             | lucide-react 0.468 -> 0.577                                            | major(0.x) | own PR                  |
| #53,55,57,60,64 | CI actions (setup-node 7, build-push 7, sbom 0.24, codecov 7, login 4) | major      | deferred: CI cannot run |

## Tasks & Acceptance

- [x] Step 1: close #82, #83, #84, #94 with the reason on each (35 -> 31 open)
- [ ] Batch A PR: gate green, merged, Dependabot closes the covered PRs
- [ ] Batch B PR: gate green + Android release build + OPPO smoke, merged
- [ ] Majors: one PR each, with the migration notes read and consumers tested
- [ ] CI-action majors: recorded as deferred until Actions can run

## Decisions

- 2026-10-07: #84 closed. `build.gradle` forces kotlin-stdlib(-jdk7/-jdk8)
  2.2.10 because react-android 0.87.1's POM requires it; a Kotlin 2.2 compiler
  cannot read 2.4 library metadata. Kotlin moves with React Native.
- 2026-10-07: #94 declined. Every manifest declares `node: 24.x`, `.nvmrc` is
  24.11.1, and CI uses 24; moving only the production image to 26 would run a
  runtime nothing is tested on. A Node major is a monorepo-wide change.

- 2026-10-07: Batch A. Web and backend Sentry moved together (@sentry/node,
  @sentry/profiling-node, @sentry/nextjs -> 10.76.1), so the hoisted
  @sentry/core stays single for both; mobile keeps its SDK's 10.73.0, and the
  Metro dedupe rule did not fire (production bundle builds).
- 2026-10-07: The root override `postcss: ^8.5.18` held web's `^8.5.28` at
  8.5.23 - the manifest and tree disagreed. Floor raised to ^8.5.28.
- 2026-10-07: @nestjs/throttler 6.7.1 and @nestjs/platform-socket.io (after
  11.2.5) added `protected logger` to ThrottlerGuard and IoAdapter. Our
  AuthThrottlerGuard and RedisIoAdapter declared `private readonly logger`, so
  backend check:ts failed (TS2415/TS4114) while all 2,528 tests still passed -
  ts-jest does not type-check. Fixed with `protected override readonly logger`
  (one logger; base warnings carry our class name). Rejected: a renamed field
  (two loggers). No spec covers either class directly.
- 2026-10-07: Release notes read for behaviour changes: throttler 6.7.1 now
  rejects non-numeric limit/ttl (ours are Number.parseInt), honours explicit 0
  (none used), masks IPv6 to /64 in the default tracker (both our guards use
  custom trackers; storage is Redis); helmet 8.3 only tightens useDefaults:false
  (not used); next-intl 4.13-4.14.9 bug fixes incl. Next 16.3 compatibility.
- 2026-10-07: Mobile bundle +6 KiB (axios 1.20, from #103), no new copies. A
  6.19 MB reading was a gate command without NODE_ENV=production.

## Open questions

- Non-blocking: should Dependabot's config ignore the Node major in Docker and
  the Kotlin stdlib (React Native owns it), so they stop reopening?
