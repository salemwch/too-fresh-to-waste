# Design Token Migration

## Why this is a plan and not a commit

`.claude/rules/ui-ux.md` says components must not use raw hex. A survey on
2026-07-27 found **547 raw hex literals across 89 files** in `apps/mobile/src`,
plus **97 hand-written `rgba()` strings**.

That cannot be done as one mechanical pass, for two reasons:

1. **Most values have no token.** The token scale is Material grey
   (`#FAFAFA … #212121`); the components overwhelmingly use Tailwind slate/grey
   (`#64748b`, `#1f2937`, `#9ca3af`, `#6b7280`, `#e2e8f0`). Converting them
   means either inventing mappings — a visual change on nearly every screen — or
   extending the token scale, which is a design decision.
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

## Two decisions to make first

1. **One grey scale or two.** The app uses Material greys in tokens and Tailwind
   greys in components. Converging means shifting one set of surfaces; keeping
   both means the token file stops being the single source of truth. This is a
   design call, not a refactor.
2. **`#22c55e` / `#ef4444` are off-spec.** Components use Tailwind green and red
   for success and error, while `ui-ux.md` and the tokens specify `#2E7D32` and
   `#D32F2F`. These are visibly different colours, not near-matches. Correcting
   them is right but is a visible change to every success and error state.

## Enforcement

No lint rule yet, deliberately. At 547 violations a rule would fire on every
file and be ignored or disabled — worse than none. Add it as `error`, scoped by
directory, as each feature reaches zero. `leaderboard` qualifies now.
