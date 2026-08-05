# Testing Standards

A test suite that only proves the happy path works is not coverage — it is
decoration. Every unit must be tested against **every scenario that can actually
occur**, success and failure, so no real input can break it in production.

---

## Enumerate before writing

For each unit, list the cases first, then write one test per case:

| Category                   | What to cover                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| **Empty / absent**         | `[]`, `null`, `undefined`, no data yet, first render                                           |
| **Malformed**              | missing fields, wrong shape from a native module or backend, unparseable dates producing `NaN` |
| **Boundaries**             | exactly at a cutoff, one either side, zero, the last item                                      |
| **Transitions**            | A → B → A, data arriving late, a list changing underneath the component                        |
| **Idempotence**            | the same event fired repeatedly must not compound                                              |
| **Unavailable dependency** | ref not attached, query still loading, request failed                                          |
| **Actor variants**         | consumer vs driver, in-list vs not, each `authProvider`, every terminal status                 |

Actor variants are non-negotiable — see `.claude/rules/auth-scenarios.md` and
the Scenario Coverage table in CLAUDE.md.

---

## Rules

1. **A failed dependency leaves state unchanged.** Never half-applied: if a
   lookup fails, nothing is written, nothing moves. Assert that explicitly.
2. **Assert the reason a path is safe**, not merely that it "does not throw".
   `expect(fn).not.toThrow()` alone documents nothing.
3. **Name the behaviour, not the implementation.** "appears when the row scrolls
   out of view" survives a refactor; "sets userRowVisible to false" does not.
4. **Say when a branch is unreachable.** If a defensive guard cannot be hit by
   construction, write that in the comment rather than implying the test covers
   it.
5. **Mutation-check what matters.** Break the code, confirm the test fails, put
   it back. A test that passes against broken code is worse than none — it
   licenses the bug.
6. **Test the seam you actually changed.** When two paths must agree, drive both
   from the same table (`describe.each`) so they cannot drift.

---

## What good coverage caught here

Each of these was found by writing the failure case, not the happy one:

- `getCountdown` returned `{days: NaN, …}` for an unparseable date — `NaN <= 0`
  is `false`, so the guard let it through.
- The search dropdown skipped the zoom clamp that every other camera move
  applied.
- The leaderboard's floating bar never appeared for an off-screen row: React
  bails out of re-rendering when state is written with its current value, so a
  ref flipped in the same callback was never re-read.

---

## First run is its own test surface (mobile)

A device that has already run the app is not a new user's device. It has Redux
state in MMKV, a warm query cache, tokens in the Keychain, and granted
permissions. Nothing in the normal loop — dev builds, unit tests, a hot-reloaded
emulator — ever starts without those, so the first-run path is effectively
untested by default.

Emulators make it worse rather than better: the BlueStacks image **pre-grants
runtime permissions**, so permission-dependent branches cannot be reached there
at all. See `android_repro_rig_bluestacks` in project memory.

Three production bugs came from this in one week, each invisible locally and
each found only after a real Play Store install:

| Bug                                            | Why only on first run                                                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Empty `<Stack.Navigator>` crash (`699633aa`)   | nothing persisted, so `flowState` was still `INITIALIZING`; a second launch rehydrates a real value and cannot reproduce it |
| Phantom Sentry timeout (`235663e4`)            | the local-cities early return fires before the race, leaving a timer armed — a success path, not a failure one              |
| Notification prompt at cold start (`c2b2deb1`) | Android 13+ gives one prompt per install; a device that already answered never shows it again                               |

**Before any release build, run the gate:**

```bash
pnpm --filter @foodwaste/mobile check:fresh-install
```

It force-stops the app, `pm clear`s it (wiping MMKV, AsyncStorage and Keychain
together), revokes every runtime permission, clears logcat, launches cold and
watches for fatal, unhandled and React-Native-error signatures. It is a release
gate, not a unit test — point it at the build you intend to ship.

It proves the app _launches_ cleanly, not that the first-run UI is right. Still
confirm by hand that the location chooser appears and that **no permission
dialog is shown before sign-in**.

**When writing tests, model the cold state rather than the warm one.** The
navigator regression is covered without a device by driving the decision as a
pure predicate over every `AuthFlowState` — see
`navigation/__tests__/canRenderNavigator.test.ts`. Prefer that shape: extract
the decision, then assert it across the whole enum, so a state added later fails
in CI instead of in the Play Store.

---

## Running

```bash
pnpm --filter @foodwaste/mobile test
npx jest <pattern> --runInBand      # a single suite
```

Run `tsc --noEmit` **after** the last test file is written — running it earlier
means the type-checker never sees the new code.
