---
status: in-review
scope: mobile
gate:
  pnpm --filter @foodwaste/mobile type-check && pnpm --filter @foodwaste/mobile
  test && (cd apps/mobile/android && ./gradlew bundleProductionRelease)
---

## Intent

Act on two Play Console "Memory usage" notices for release 89 (1.0.0): "bitmap
image optimisation" and "R8 optimisation". Fix what is real, record what is not,
and add the one performance lever the release does not use yet: a Baseline
Profile with a Startup Profile (DEX layout).

## Constraints

- RN 0.81 / AGP 8.13.2 / Kotlin 2.0.21. AGP 9 is out of reach (needs RN 0.87+),
  see memory `android-r8-optimization-ceiling`.
- Supabase is on the Free plan (confirmed by the owner 2026-10-05), so
  `/storage/v1/render/image/` transforms are unavailable.
- Release ABI is `arm64-v8a` only (gradle.properties). Profiles are DEX-level
  and ABI-independent, so generating on an x86_64 emulator is valid.
- Pin every new dependency (no `+`, no `latest`).

## Tasks & Acceptance

- [x] Image transforms behind one switch, off - every caller receives the stored
      URL; tests cover both switch states (25 pass; switch flipped on -> 6 fail;
      mobile suite 157/2604/430 green, type-check clean)
- [x] `:baselineprofile` module (com.android.test) + `androidx.baselineprofile`
      plugin on `:app`, `profileinstaller` dependency, `dexLayoutOptimization`
- [x] Generator covers cold start through the first rendered screen
- [x] `baseline-prof.txt` (21,251 rules) + `startup-prof.txt` (20,714) generated
      on API 36.1 x86_64 emulator; both generator tests passed
- [x] Startup macrobenchmark: `CompilationMode.None` vs
      `Partial(BaselineProfile)` - emulator, 10 cold starts each,
      timeToInitialDisplay median 1398 -> 1322 ms (-5.4%), min 1249 -> 1158 ms
      (-7.3%). Emulator numbers: relative only.
- [x] Release AAB: `r8.json` reports `classes.dex` startup:true (3.3 MB) +
      `classes2.dex`; `baseline.prof` 2.2 KB -> 9.9 KB (11,738 rules after R8)
- [x] Release build fails if either profile file is missing (proved by hiding
      startup-prof.txt: `preProductionReleaseBuild` FAILED; restored: passes)
- [x] OfferCard no longer retries an identical URL on image error (4 tests; old
      condition restored -> 1 fails)
- [ ] Run `/code-review` on the diff before merging
- [ ] Rebuild the release AAB from the committed tree before uploading

## Decisions

- 2026-10-05: The bitmap notice is a static scan. Every flagged frame
  (deobfuscated with release 89's own `proguard.map`) is library code: Fresco
  (RN core), Glide (react-native-fast-image), react-native-image-picker,
  androidx `IconCompat`, android-maps-utils `KmlRenderer`. It cannot be cleared
  without removing React Native's own image pipeline. Decode memory is already
  bounded: uploads are resized server-side (offers 800x600, profiles 400x400),
  Glide downsamples to view size, all network images go through fast-image.
- 2026-10-05: Transforms switched off rather than the six raw call sites
  switched on. On the Free plan every transformed request fails: OfferCard paid
  a failed request then re-downloaded the original; Avatar fell to initials with
  no retry. Rejected: deleting the helper and its six callers (loses the upgrade
  path and spreads the change across six files for no behavioural gain).
- 2026-10-05: R8 is at its ceiling for this toolchain (full mode, optimization,
  repackaging, optimized resource shrinking all on in release 89's `r8.json`).
  No R8 change made.
- 2026-10-05: Benchmark libraries pinned to 1.4.1, not 1.5.0: 1.5.0 needs
  kotlin-stdlib 2.1.20 and the root build forces 2.0.21 everywhere.
- 2026-10-05: `mergeIntoMain = false`. Merging leaves only the aggregate task,
  which also generates for dev (localhost API) and staging. Profile lives in
  `src/productionRelease/` because only that variant ships.
- 2026-10-05: Every generator/benchmark command sets `ENVFILE=.env.production`
  and `ANDROID_SERIAL=emulator-5554`. react-native-config infers the env file
  from the first task name and does not match all plugin tasks; connected tasks
  install and uninstall on every attached device, and a physical phone with the
  production app was attached.
- 2026-10-05: `@LargeTest` dropped (androidx.test:runner not on the classpath);
  the plugin selects tests by `enabledRules`, not by size annotation.

## Open questions

- Non-blocking: if Supabase moves to Pro, flip
  `SUPABASE_IMAGE_TRANSFORMS_ENABLED` and run a real device pass on avatars and
  offer cards.
