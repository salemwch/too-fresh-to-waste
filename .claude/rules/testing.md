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

## Running

```bash
pnpm --filter @foodwaste/mobile test
npx jest <pattern> --runInBand      # a single suite
```

Run `tsc --noEmit` **after** the last test file is written — running it earlier
means the type-checker never sees the new code.
