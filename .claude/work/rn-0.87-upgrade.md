---
status: in-review
scope: cross-app
gate:
  pnpm type-check && pnpm lint && pnpm test && pnpm --filter @foodwaste/web
  build && (cd apps/mobile/android && ./gradlew assembleDevDebug
  bundleProductionRelease) && pnpm check:lockfile
---

## Intent

Move the mobile app from React Native 0.81.0 to 0.87.1 (latest stable,
2026-08-26) with the smallest change set the official Upgrade Helper and release
notes require. 0.81 has had no patch release since 0.81.6 (2026-02-05). Preserve
all behaviour: no business-logic, API, auth, payment, navigation or analytics
change unless the upgrade forces it. Performance and battery audits run AFTER
the upgrade lands, against measurements, as separate work.

Source brief: senior-engineer prompt pasted 2026-10-05 (treated as input to
verify, per `.claude/rules/work-state.md` section 2).

## Inventory (verified 2026-10-05, read-only)

| Item                            | Current                                                                                                                        | Template 0.87.1 (rn-diff-purge 0.81.0..0.87.1)                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| react-native                    | 0.81.0                                                                                                                         | 0.87.1                                                                               |
| react                           | 19.1.0 (root `pnpm.overrides` forces it monorepo-wide; web declares 19.3.0 but resolves 19.1.0)                                | 19.2.3                                                                               |
| Node / pnpm                     | 24.11.1 / 10.17.0                                                                                                              | node >= 22.11.0 (0.87 notes: >= 22.13.0)                                             |
| AGP                             | 8.13.2 (explicit classpath)                                                                                                    | 9.2.1 (RN gradle-plugin libs.versions.toml)                                          |
| Gradle                          | 8.13 (wrapper, -all)                                                                                                           | 9.4.1 (-bin)                                                                         |
| JDK                             | Temurin 17.0.16 (`org.gradle.java.home`)                                                                                       | 17                                                                                   |
| Kotlin                          | 2.0.21 (+ root force of kotlin-stdlib 2.0.21)                                                                                  | 2.2.0                                                                                |
| compileSdk / targetSdk / minSdk | 36 / 36 / 24                                                                                                                   | 37 / 36 / 24                                                                         |
| buildTools                      | 36.0.0                                                                                                                         | 37.0.0                                                                               |
| NDK                             | 27.1.12297006                                                                                                                  | 27.1.12297006 (unchanged)                                                            |
| Hermes                          | `hermesEnabled=true`; `hermesCommand` hardcoded to `react-native/sdks/hermesc/win64-bin/hermesc.exe`                           | Hermes V1 default since 0.84; compiler ships as npm `hermes-compiler@250829098.0.17` |
| New Architecture                | `newArchEnabled=true` (already on; mandatory since 0.82)                                                                       | mandatory                                                                            |
| edge-to-edge                    | `edgeToEdgeEnabled=true`                                                                                                       | true                                                                                 |
| Metro                           | 0.83.x, pinned by 14 root overrides `metro*@^0.83 -> ^0.83.8`; config requires `metro-cache` FileStore + `metro-minify-terser` | 0.87                                                                                 |
| Babel                           | `@react-native/babel-preset` 0.81.0 + module-resolver + transform-remove-console                                               | 0.87.1                                                                               |
| TypeScript                      | 5.9.3; extends `@foodwaste/tsconfig/react-native` (moduleResolution `node`, not `@react-native/typescript-config`)             | ^6.0.3, `@react-native/typescript-config`                                            |
| Jest                            | 29, `preset: 'react-native'` in `packages/jest-config/react-native.js`                                                         | `@react-native/jest-preset`                                                          |
| ESLint                          | flat config + `eslint.legacy.cjs`, `@react-native/eslint-config` 0.81.0                                                        | 0.87.1                                                                               |
| RN CLI                          | 20.2.0 / platform-android 20.1.3 / platform-ios 20.1.3                                                                         | 20.2.0 all                                                                           |
| iOS                             | `project.pbxproj` is EMPTY (0 bytes), no Podfile.lock, no CI job: never built                                                  | Podfile comment only, Gemfile `+ nkf`                                                |

Android native code: `MainApplication.kt` (DefaultReactNativeHost - template
moves to `getDefaultReactHost(context, packageList)` + `loadReactNative`),
`MainActivity.kt`, `ScreenCapture*`, `LastKnownLocation*`, and
`com/facebook/react/internal/featureflags/ReactNativeFeatureFlagsCxxInteropPatch.kt`
(declares `object ReactNativeFeatureFlagsPatch` in RN's internal package;
referenced nowhere, so its `init` never runs - dead code).

pnpm patches: `recyclerlistview@4.2.3` (FlashList v1),
`@react-native-community/geolocation@3.4.0`.

## Breaking changes that touch this repo (from release notes 0.82-0.87)

- JS: `InteractionManager` removed (13 uses in src),
  `StyleSheet.absoluteFillObject` removed (25 uses). No deep
  `react-native/Libraries/` imports, no other removed API found.
- Jest preset package. Metro 0.87 (YAML / .es6 configs removed - not used).
- Android: removed bridge classes - only `react-native-maps` and
  `react-native-screens` reference `NativeViewHierarchyManager`, stubbed (not
  deleted) in 0.85.
- compileSdk 37 requires AGP >= 9.1.1
  (developer.android.com/build/releases/about-agp).

## Constraints

- React Native requires react === its renderer version (19.2.3 for 0.87.1).
- `.claude/rules/dependencies.md`: overrides scoped by major; manifests must
  tell the truth; `pnpm check:lockfile` after any manifest edit; remove the
  `metro@^0.83` family overrides once RN leaves Metro 0.83.
- `linking.test.ts` is the gate for deep-link decoding (decode-uri-component
  note).
- Release AAB + `check:fresh-install` before any release.

## Dependency compatibility (evidence, 2026-10-05)

Rule: change a package only with a sourced reason; everything else stays and is
proven by build + Jest + emulator runtime.

| Package                                                 | From    | To        | Evidence                                                                                                                                                                                          |
| ------------------------------------------------------- | ------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| react-native                                            | 0.81.0  | 0.87.1    | target                                                                                                                                                                                            |
| react, react-test-renderer                              | 19.1.0  | 19.2.3    | RN 0.87.1 peer `^19.2.3`; template pins 19.2.3; renderer must match exactly                                                                                                                       |
| @react-native/{babel-preset,eslint-config,metro-config} | 0.81.0  | 0.87.1    | template                                                                                                                                                                                          |
| @react-native/jest-preset                               | -       | 0.87.1    | 0.85 notes: preset moved to this package                                                                                                                                                          |
| @react-native-community/cli-platform-{android,ios}      | 20.1.3  | 20.2.0    | template (cli already 20.2.0)                                                                                                                                                                     |
| metro-cache (direct dev dep)                            | ^0.83.8 | ^0.87.0   | metro-config 0.87.1 depends on metro ^0.87.0                                                                                                                                                      |
| root overrides `metro*@^0.83` (14)                      | present | removed   | dependencies.md: remove once RN leaves Metro 0.83; selectors would match nothing                                                                                                                  |
| react-native-screens                                    | 4.24.0  | 4.27.0    | README: Fabric >= RN 0.84 needs 4.26.0+; 4.27.0 notes "adds support for React Native 0.87"                                                                                                        |
| react-native-gesture-handler                            | ^2.22.2 | 2.33.0    | 2.33.0 notes: "Support React Native 0.87 on 2.x" (stays on major 2)                                                                                                                               |
| react-native-safe-area-context                          | 5.7.0   | 5.8.1     | 5.8.1 notes: "fix TS under RN 0.87"                                                                                                                                                               |
| react-native-nitro-modules                              | 0.35.9  | 0.36.5    | 0.36.2 notes: "Add support for RN 0.87+"; 0.36.0 has no breaking changes; 0.36.5 = latest patch of that line                                                                                      |
| @sentry/react-native                                    | ^7.13.0 | 8.25.0    | 8.16.0 fixes iOS build on RN 0.87 (7.x ended at 7.13.0 without it); 8.25.0 fixes dropped logs/spans on RN >= 0.86. 8.0 minimums (iOS 15, AGP 7.4, Kotlin 1.8) met; no Sentry Gradle plugin in use |
| @react-native-firebase/{app,messaging}                  | 21.14.0 | unchanged | runs through the interop layer today; 0.82 notes keep interop "for the foreseeable future"; 26.x is 5 majors away with no 0.87-specific requirement found                                         |
| all other native libs                                   | -       | unchanged | no RN-0.87 statement in their notes either way; removed-class scan clean (maps/screens only touch `NativeViewHierarchyManager`, stubbed not removed in 0.85) -> build + runtime is the proof      |

## Android toolchain (evidence)

| Item                                                                                                  | From                                              | To                                               | Evidence                                                                                                                                |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| AGP                                                                                                   | 8.13.2                                            | 9.2.1                                            | RN gradle-plugin 0.87.1 `libs.versions.toml`; compileSdk 37 needs AGP >= 9.1.1                                                          |
| Gradle                                                                                                | 8.13-all                                          | 9.4.1-all                                        | template; AGP 9.2 minimum Gradle 9.4.1                                                                                                  |
| Kotlin (KGP)                                                                                          | 2.0.21                                            | 2.2.0                                            | template + RN gradle plugin                                                                                                             |
| kotlin-stdlib force (root)                                                                            | 2.0.21                                            | 2.2.10                                           | react-android 0.87.1 POM requires 2.2.10; forcing lower risks NoSuchMethodError                                                         |
| compileSdk / buildTools                                                                               | 36 / 36.0.0                                       | 37 / 37.0.0                                      | template                                                                                                                                |
| targetSdk / minSdk / NDK                                                                              | 36 / 24 / 27.1.12297006                           | unchanged                                        | template unchanged                                                                                                                      |
| `android.builtInKotlin=false`, `android.newDsl=false`                                                 | -                                                 | added                                            | template + 0.87 notes (AGP 10 removes them)                                                                                             |
| explicit `hermes-android` dep + `react-android`/`hermes-android` forces + `react-native` substitution | 0.81.0                                            | removed                                          | RN gradle plugin `DependencyUtils` forces both versions and substitutes `react-native`; hermes-android moved to `com.facebook.hermes`   |
| `hermesCommand`                                                                                       | `react-native/sdks/hermesc/win64-bin/hermesc.exe` | `hermes-compiler/hermesc/%OS-BIN%/hermesc[.exe]` | 0.84+ ships hermesc in npm `hermes-compiler`; plugin's default looks under `apps/mobile/node_modules`, which pnpm hoisting leaves empty |
| `MainApplication.kt`                                                                                  | DefaultReactNativeHost                            | `getDefaultReactHost(context, packageList)`      | template                                                                                                                                |

## Baseline measurements on RN 0.81 (commit 846ce91a, same machine)

| Metric                                                   | Value                                                                  | How                                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Cold start TTID, no AOT (emulator API 36.1 x86_64, n=10) | median 1398 ms, min 1249                                               | StartupBenchmarks                                                 |
| Cold start TTID, baseline profile (same)                 | median 1322 ms, min 1158                                               | StartupBenchmarks                                                 |
| Metro production bundle, cold cache, wall time (n=3)     | 61.4 / 55.1 / 58.5 s (median 58.5)                                     | scratchpad `measure-bundle.ps1`                                   |
| Metro peak working set, all node.exe minus idle (n=3)    | 5,459 / 5,715 / 5,926 MB (median 5,715)                                | same, sampled every 250 ms                                        |
| JS bundle (minified, pre-Hermes)                         | 5,583,108 B                                                            | same                                                              |
| Hermes bytecode in AAB (`assets/index.android.bundle`)   | 4,850,168 B                                                            | AAB listing                                                       |
| AAB total                                                | 21,895,366 B                                                           | `app-production-release-rn081-baseline.aab` kept in build outputs |
| DEX                                                      | classes.dex 3,312,256 + classes2.dex 3,094,196                         | AAB listing                                                       |
| arm64 libs                                               | libreactnative 5,881,440; libhermes 2,136,264; libappmodules 2,615,264 | AAB listing                                                       |

## Tasks & Acceptance

- [x] 1. Manifests + lockfile per the tables; `pnpm install`;
      `pnpm check:lockfile`
- [x] 2. Android toolchain + template native changes; `assembleDevDebug` builds
- [x] 3. JS breaking changes: `InteractionManager` (13), `absoluteFillObject`
      (25), jest preset; mobile type-check clean without new suppressions
- [x] 4. Gates: mobile type-check 0 / lint 0 / Jest 160 suites, 2,626 tests, 430
      snapshots (incl. linking.test.ts); web type-check 0, Jest 1,414,
      production build OK; backend + email-templates check:ts 0; 6/6 email
      templates render; check:lockfile OK; check:r8-keep-rules OK
- [x] 5. Release: `bundleProductionRelease` OK; profiles regenerated (21,853 /
      21,400 rules); startup DEX + baseline.prof present; R8 9.2.14
- [x] 6. Runtime (x86_64 emulator, API 36.1): non-minified - 27 launches, 2/2
      generator journeys, 0 FATAL/ANR/JS errors, MMKV 27/27. Minified
      (benchmarkRelease) - first run CRASHED (AGP 9 strict keep rules, fixed in
      proguard-rules.pro), re-run 25 process starts, 0 crashes, 0 MMKV errors.
      Real-device pass (OPPO CPH1937, arm64) NOT done - pending.
- [x] 7. iOS template text changes (Gemfile, Info.plist); marked unverified
- [x] 8a. Baselines captured on 0.81 (table above)
- [x] 8b. After (same machine/emulator): TTID no-AOT median 1398 -> 1367 ms, min
      1249 -> 1218; with profile median 1322 -> 1362, min 1158 -> 1119 (n=10,
      within run-to-run noise). Metro peak 5,715 -> 4,643 MB (-19%), wall 58.5
      -> 65.7 s (+12%). JS bundle 5,583,108 -> 7,129,660 B (+28%; Sentry family
      28% of bundle, @sentry/conventions new). HBC 4.85 -> 6.99 MB. DEX 6.41 ->
      6.21 MB. R8 unoptimized 29.2 -> 26.8%.
- [x] 9. Battery audit (report-only): RN JS timers pause in background
      (JavaTimerManager.onHostPause); RQ refetchIntervalInBackground=false;
      findings - duplicate 60 s session timers (ProtectedRoute + middleware),
      driver high-accuracy watchPosition cleared only on unmount.
- [x] 10. Adversarial review: deletion check clean; verification gap closed with
      utils/appState tests + check:r8-keep-rules (both mutation-checked).
- [ ] 11. iOS build on a Mac (pbxproj must be regenerated first)
- [ ] 12. Real-device pass + `check:fresh-install` on the release build. PARTIAL
      (OPPO CPH1937, Android 11, arm64, production release APK): fresh install
      (uninstall + install; ColorOS blocks `pm clear`), 40 interleaved cold
      starts 0 FATAL / signal / ANR / JS error, onboarding, login (keyboard
      open), register, back navigation, Sentry native + NDK + ANR integrations
      start. NOT done: authenticated customer / merchant / driver flows, FCM
      delivery, location chooser (Home, behind sign-in) - need an owner session
      or test accounts.
- [x] 13. Post-upgrade size work: single `@sentry/core` in the bundle, web
      feedback widget excluded. JS 7,129,706 -> 5,742,745 B; Sentry 2,659 ->
      1,301 KiB; AAB 23,980,993 -> 23,702,701 B.
- [x] 14. `useEffectEvent` in ProtectedRoute; startup telemetry (Web Performance
      APIs) -> one sampled Sentry transaction per cold start.

## Decisions

- 2026-10-05: Target AGP 9.2.1 + Gradle 9.4.1, not the brief's "AGP 9.0.x".
  compileSdk 37 needs AGP >= 9.1.1, and 9.2.1 is the exact version RN 0.87.1's
  gradle plugin is built against. Keep RN's recommended opt-outs
  `android.builtInKotlin=false` / `android.newDsl=false` until every plugin is
  confirmed on the new DSL.
- 2026-10-05: TypeScript stays 5.9.3 unless type-check proves 6.x is required
  (template moves to ^6.0.3; a major bump is not justified by the template
  alone).

- 2026-10-05 (owner): baseline-profile work committed first on
  `perf/android-baseline-profile` (47bac9b3, 846ce91a); this work branches from
  it as `chore/rn-0.87-upgrade`.
- 2026-10-05 (owner): one React 19.2.3 for the whole monorepo - root override
  and web's manifest both move to 19.2.3; web build is part of the gate.
- 2026-10-05 (owner): iOS - apply the Upgrade Helper changes now; the owner
  provides a Mac later to build and verify. Report iOS as unverified until then.

- 2026-10-05 (owner): no hard-coded node_modules paths. settings.gradle resolves
  react-native (from the app) and @react-native/gradle-plugin, codegen,
  hermes-compiler (from react-native) plus nitro/mmkv with Node's
  `require.resolve`, published as `gradle.ext.npmPackageDirs`. Replaces the
  `$rootDir/../../../node_modules` constant in settings and root build.gradle.
  Pitfall found: pluginManagement.includeBuild must get `.path` (String); a File
  silently dispatches to Settings.includeBuild (regular build, not searched for
  settings plugins).
- 2026-10-05: `hermesCommand` = `<hermes-compiler>/hermesc/%OS-BIN%/hermesc`.
  The plugin substitutes %OS-BIN% and runs via `cmd /c` on Windows
  (TaskUtils.kt), which resolves hermesc.exe - verified in RN gradle plugin
  0.87.1 source.
- 2026-10-05: AGP / KGP classpath versionless (template); react-android /
  hermes-android versionless; root react-android/hermes-android forces and
  `react-native` substitution removed (RN DependencyUtils applies them to
  allprojects); dead local maven repos removed; `androidx.core` 1.13.1 force
  removed (its stated reason - AGP < 8.6 - no longer holds); kotlin-stdlib
  forces 2.0.21 -> 2.2.10 (react-android 0.87.1 POM); `rootproject` plugin
  added.
- 2026-10-05: MainApplication -> template (`reactHost by lazy`,
  `loadReactNative`). Generated `loadReactNative` = the same SoLoader /
  DefaultNewArchitectureEntryPoint / edge-to-edge calls. react-native-restart
  still calls getReactNativeHost(); it catches the throw and falls back to
  Activity.recreate() - the path it already took (memory: rtl_direction).
- 2026-10-05: dead `ReactNativeFeatureFlagsCxxInteropPatch.kt` deleted (declared
  an `object` in RN's internal package, referenced nowhere, init never ran).
- 2026-10-05: `@sentry/core` override removed instead of moved. Every Sentry RN
  8.x with the 0.87 fixes needs a newer core (8.25.0 -> 10.73.0); web/backend
  SDKs pin 10.58.0 exactly. Verified per app with `pnpm why`: mobile 10.73.0,
  web 10.58.0, backend 10.58.0.
- 2026-10-05: React 19.2.3 also declared by backend + email-templates (the
  manifest-override check caught them). All 6 email templates render.
- 2026-10-05: InteractionManager (6 call sites) -> `utils/runWhenIdle`
  (requestIdleCallback with a 1 s timeout bound, cancel fn); jest.setup provides
  the global as RN's runtime does. absoluteFillObject (25) -> absoluteFill
  (identical frozen object in 0.87).
- 2026-10-05: Strict TS API. Shared preset adopts the official
  module/moduleResolution/customConditions and noEmit (declaration emit caused
  TS2742; nothing consumes mobile .d.ts). 34 errors fixed with instance types,
  TextInputKeyPressEvent, WithAnimatedValue, AppState null-safety (latent crash:
  `lastAppState.match` on a null currentState), readonly styles, typed test
  helpers. 0 suppressions, 0 casts.
- 2026-10-05: react-native-fast-image 8.6.3 types import
  FlexStyle/ShadowStyleIOS, which the 0.87 strict API no longer exports -> its
  ImageStyle lost layout props. @d11 fork 8.13.0 has the same defect; 8.7-8.31.2
  is a 43-release burst in 5 days (genuine repo, no install scripts, but no
  track record) -> not adopted. Fixed with
  `patches/react-native-fast-image@8.6.3.patch` (types only).
- 2026-10-05: 40 DriverOrdersListScreen snapshots updated - every diff is RN
  0.87 Switch.js's default style (`alignSelf: flex-start` instead of 51x31).
- 2026-10-05: Gradle -bin (template) instead of -all; distributionSha256Sum set
  (checked against two official sources). Wrapper regenerated by Gradle.
- 2026-10-05: Baseline Profile plugin + benchmark 1.4.1 -> 1.5.0 (AGP 9 support;
  the stdlib blocker is gone). uiautomator 2.4.0 to match.
- 2026-10-05: Obsolete-API warnings traced with -Pandroid.debug.obsoleteApi: all
  four from the kotlin-android plugin. Own `applicationVariants` hooks in
  app/build.gradle left as-is (flags must stay for KGP anyway) - follow-up.
- 2026-10-05: iOS: Gemfile gets template pins + Ruby 3.4 gems; Info.plist gets
  CADisableMinimumFrameDurationOnPhone. iPad orientations NOT added (product
  decision; device family unknown - pbxproj empty). Podfile/AppDelegate already
  match. Min iOS 15.1 (RN) >= 15.0 (Sentry 8). Unverified - needs a Mac.

- 2026-10-05 (REVERSAL of the 1.5.0 bump above): Baseline Profile plugin +
  benchmark back to 1.4.1 (uiautomator 2.3.0). 1.5.0 under android.newDsl=false
  writes the literal "app/provider(?)" into the nonMinifiedRelease /
  benchmarkRelease Kotlin source sets ->
  compileProductionNonMinifiedReleaseKotlin InvalidPathException. A/B on the
  same tree via a diagnostic init script: 1.4.1 copies the correct
  src/release/kotlin. No 1.5.x patch exists. 1.4.1's "tested with versions
  below" warning is left visible.
- 2026-10-05: React Native 0.87 dropped `@react-native/assets-registry` from its
  dependencies; @react-native-vector-icons/common 12.4 and react-native-svg
  import it undeclared -> Metro "Unable to resolve". Declared
  `@react-native/assets-registry@0.87.1` in mobile (vector-icons maintainers'
  own remedy; 0.87.1 re-exports RN's AssetRegistry, the store Metro registers
  into). vector-icons 13 (which resolves RN's registry itself) left as
  follow-up.
- 2026-10-05: ScreenCapturePackage / LastKnownLocationPackage ->
  BaseReactPackage (RN 0.87 deprecates ReactPackage.createNativeModules);
  modules now created on first use. MainActivity uses
  DefaultReactActivityDelegate(activity, name) - the flags constructor is
  deprecated and its fabricEnabled argument is unused.
- 2026-10-05: AppState narrowing extracted to utils/appState.ts with tests
  (mutation-checked).

- 2026-10-05: AGP 9 `android.r8.strictFullModeForKeepRules=true` - member-less
  `-keep class` no longer keeps <init>. Minified build crashed
  (WorkDatabase_Impl and Firebase registrars had no constructor - dexdump).
  Fixed per Google's migration with 4 scoped `{ <init>(); }` rules (Room,
  Firebase registrars, WorkManager InputMerger, Glide GlideModule) after
  reviewing all 17 member-less library rules; NOT via the global opt-out.
  Guarded by check:r8-keep-rules.
- 2026-10-05: protobuf-java blanket force(3.25.5) -> per-major security floor
  (3.25.5 / 4.27.5 / 4.28.2, GHSA-735f-pc8j-v9w8). The force downgraded AGP 9.2
  UTP (needs 4.28.x) -> NoClassDefFoundError RuntimeVersion. App runtime ships
  no protobuf.

- 2026-10-05: Removing the `@sentry/core` override (above) let pnpm give each
  mobile Sentry package its own nested 10.73.0, and Metro bundled all four
  (1,779 KiB of core). Fixed in metro.config.js: every `@sentry/core` request
  resolves from the copy `@sentry/react-native` uses, only when the version is
  identical; a different version fails the build (merging two versions is
  unsafe). Rejected: re-adding the root override (forces web/backend onto the
  mobile version) and a hard-coded path alias. Guarded by
  metroSentryCoreDedupe.test.ts. Measured alone: AAB -245,617 B.
- 2026-10-05: `includeWebFeedback: false` - the feedback widget is not used.
  Measured alone: AAB -34,662 B. `@sentry/conventions` (306 KiB) and the core AI
  integrations are kept: stubbing SDK internals is not safe without upgrading.
- 2026-10-05: AAB target (<= 21 MB) not reached, by design. Of 23.70 MB, 9.84 MB
  is BUNDLE-METADATA Play keeps and never ships (native debug symbols 5.9 MB +
  R8 mapping 3.9 MB). Real download for the OPPO (bundletool get-size, arm64):
  0.81 11,797,229 B -> 0.87 12,815,105 B (+1.02 MB: RN / Hermes V1 native libs,
  JS). The only lever to <= 21 MB is `debugSymbolLevel` none, which loses
  symbolicated native crashes in Play Console - owner decision, recommendation
  is to keep the symbols.
- 2026-10-05: `useEffectEvent` (React 19.2) for ProtectedRoute's
  checkAndRefreshToken / triggerSessionLogout: they are called only from effects
  and must read the latest state without restarting the timers. The interval now
  runs once per mount instead of restarting on each auth change. Covered by
  ProtectedRoute.sessionTimers.test.tsx (9 cases).
- 2026-10-05: `<Activity>` NOT adopted. Hidden mode runs effect cleanups, which
  would stop the timers, sockets and location watches screens rely on staying
  alive; React Navigation 7.21 only carries compatibility code for it. No screen
  here has a "pre-render hidden, keep state, pause effects" need.
- 2026-10-05: Startup telemetry via performance.mark / measure,
  PerformanceObserver('longtask') and performance.rnStartupTiming. One Sentry
  transaction per cold start (inherits tracesSampleRate), numbers only, observer
  disconnected after the report, all APIs feature-detected. Native first-frame
  metric unchanged.
- 2026-10-05: Onboarding pages 2 and 3 add `insets.bottom` to the arrow buttons'
  padding (page 1 already did). RN 0.86+ edge-to-edge reports the full window,
  so a fixed padding sat under the navigation bar.
- 2026-10-05: fresh-install-check.ps1 checks `pm clear` output for "Success".
  ColorOS throws SecurityException CLEAR_APP_USER_DATA and the gate used to
  print OK, then validate a warm app as a first run.
- 2026-10-05: OPPO cold start (am start -W TotalTime, speed-profile, two
  interleaved rounds of 10): 0.81 median 582 / 590 ms, 0.87 624 / 622 ms - a
  measured +35-40 ms first-frame regression, not explained yet. Startup
  telemetry will show whether it is native or JS in the field.
- 2026-10-05: Login keyboard on Android: with the keyboard open the form can
  scroll only to its natural end, so the lower part stays under the keyboard
  (`KeyboardAvoidingView` behavior is undefined on Android and adjustResize does
  not resize under edge-to-edge). Identical on the 0.81 build on the same
  device - pre-existing, not a regression; left as a follow-up.

## Open questions

- Non-blocking: iOS `project.pbxproj` is empty; the template's pbxproj diff has
  nothing to apply to. Needs regenerating on the Mac.
