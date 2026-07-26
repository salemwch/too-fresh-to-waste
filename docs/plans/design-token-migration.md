# Design Token Migration

## Why this is a plan and not a commit

`.claude/rules/ui-ux.md` says components must not use raw hex. A survey on
2026-07-27 found **547 raw hex literals across 89 files** in `apps/mobile/src`,
plus **97 hand-written `rgba()` strings**.

That cannot be done as one mechanical pass, for two reasons:

1. **Most values have no token** — see "The actual problem" below for the real
   numbers. Converting them means either inventing mappings, which is a visual
   change on nearly every screen, or first deciding what the palette should be,
   which is a design exercise.
2. **A colour change is invisible to every gate we have.** `tsc`, ESLint and
   Jest all pass whether a surface is `#E0E0E0` or `#e2e8f0`. Only a device
   shows it.

So it proceeds feature by feature, each slice verified against the values it
replaced.

## The mechanism

`withAlpha(token, alpha)` in `design-system/tokens/colors.ts` derives tints from
tokens, replacing hand-rolled `rgba()`. It clamps alpha, and returns unusable
input unchanged so a mistake stays visible on screen rather than rendering
transparent.

## Verification pattern

Every slice gets a parity test that pins the literal pre-conversion values — see
`features/leaderboard/constants/__tests__/paletteParity.test.ts`. Without one,
"no visual change" is an assertion nobody checked.

## Status

| Area          | Raw hex                          | State                                                        |
| ------------- | -------------------------------- | ------------------------------------------------------------ |
| `leaderboard` | 0 outside `constants/palette.ts` | **done** — palette derived from tokens, 29 parity assertions |
| `orders`      | 134                              | not started                                                  |
| `loyalty`     | 81                               | not started                                                  |
| `home`        | 37                               | not started                                                  |
| `donations`   | 30                               | not started                                                  |
| `offers`      | 29                               | not started                                                  |
| `voting`      | 22                               | not started                                                  |
| `auth`        | 18                               | not started                                                  |
| `favorites`   | 18                               | not started                                                  |
| `search`      | 17                               | not started                                                  |
| `profile`     | 11                               | not started                                                  |

## Order

`orders` and `loyalty` first — together they are 40% of the total, and both were
recently decomposed, so the colours are already gathered into few files rather
than scattered through screens.

## The actual problem (corrected 2026-07-27)

An earlier draft framed this as "one grey scale or two". That was wrong, and it
understated the problem. Measured properly:

- **214 occurrences (18 colours) have an exact token equivalent** — converting
  those is provably zero-change.
- **522 occurrences span 200 distinct colours with no token at all.**

Two hundred colours is not a palette that needs reconciling; it is the absence
of one. Adding all 200 as tokens would institutionalise the mess and deliver no
design value. Mapping them to nearest neighbours would shift surfaces on every
screen with nothing able to verify it.

So the blocking question is not a refactor question:

> **What should the palette be?** Pick the ~15–20 colours the product actually
> needs, then map the 200 onto them.

Until that exists, migration can only clear values that already have an exact
token. Everything else is guesswork wearing a refactor's clothes.

## Two colours that are simply wrong

`#22c55e` and `#ef4444` are used for success and error, where `ui-ux.md` and the
tokens specify `#2E7D32` and `#D32F2F`. Visibly different colours, not
near-matches. Git history shows they arrived in the original scaffold commit
rather than as a later decision, so this is drift, not an override.

Deliberately **not** corrected in the same commit as a refactor: it changes
every success and error state on screen, and belongs in a change that can be
looked at on a device.

## Enforcement

No lint rule, deliberately. At this volume a rule fires on every file and gets
disabled within a day — worse than none.

Instead `design-system/tokens/__tests__/rawColorBudget.test.ts` pins the current
count as a ceiling: existing debt is tolerated, new debt fails the suite. It
also fails if the ceiling drifts more than 25 above reality, so it cannot
quietly go stale as debt is paid. Lower the number when you clear some; never
raise it.

A scoped `error`-level lint rule becomes worthwhile per-directory once a feature
reaches zero. None has yet — `leaderboard` is closest, with its raw values
confined to `constants/palette.ts`.
