# Mobile Design Regression Matrix

The gate that makes the mobile token migration safe to attempt. See
`MOBILE_DESIGN_AUDIT_REPORT.md` M9.

---

## Read this first: it is not a screenshot harness

It renders **no pixels**. It cannot tell you that a screen looks cramped, that
Arabic text overflows its container, that a touch target is too small, or that
the keyboard covers a field. Those need a device, and the audit lists them as
outstanding under "What still needs a device".

**What it does cover** is the set of things the audit actually found broken, all
of which are resolved style values:

| Audit finding                        | Caught by this gate                             |
| ------------------------------------ | ----------------------------------------------- |
| M1 raw values instead of tokens      | yes - the value changes                         |
| M2 foreign grey palette              | yes - the colour changes                        |
| M3 Checkout's parallel palette       | yes                                             |
| M4 screens that never read the theme | yes - light and dark snapshots become identical |
| M8 off-scale font sizes              | yes                                             |
| M10/M11 off-grid spacing and radius  | yes                                             |
| Cramped layout, overflow, clipping   | **no - needs a device**                         |

A device-based screenshot harness (Detox, or Maestro) is still worth building.
This exists because it runs in CI today with no emulator, and because a
migration touching thousands of literals cannot wait for one.

---

## Running

```bash
# whole suite, matrix included
pnpm --filter @foodwaste/mobile test

# just the matrix specs
pnpm --filter @foodwaste/mobile test -- matrix

# regenerate baselines - deliberately, never to make a red run green
pnpm --filter @foodwaste/mobile test -- matrix -u
```

Baselines live in `__snapshots__/` beside each spec and **are committed**. They
are the contract.

---

## The matrix

`device (small | standard | large) x theme (light | dark) x locale (en | fr | ar)`

| Device     | Size    | Stands for                      |
| ---------- | ------- | ------------------------------- |
| `small`    | 320x568 | iPhone SE - narrowest supported |
| `standard` | 390x844 | iPhone 14 / Pixel 7 class       |
| `large`    | 430x932 | iPhone 15 Pro Max class         |

`DEFAULT_CASES` is six cells, not eighteen. Theme and locale are independent - a
dark RTL bug is a dark bug or an RTL bug - so each axis is exercised once
against the standard device, plus small and large for layout. Pass an explicit
`cases` array where a component genuinely needs more.

`ar` sets `I18nManager.isRTL`, which is how the app itself switches direction
(via `forceRTL` + restart in `SettingsScreen`).

---

## Writing a matrix spec

```tsx
import { matrixSnapshot } from '@/test-utils/visualMatrix';
import { Button } from './Button';

matrixSnapshot(
  'Button / primary',
  <Button variant='primary' testID='btn'>
    Save
  </Button>,
);
```

**The component must carry a `testID`.** Styles are captured per `testID`, not
by tree position, so moving a wrapper `<View>` does not churn the baseline -
only a change to the contract does.

For a screen with states, drive the mock and group by state:

```tsx
describe('error', () => {
  beforeAll(() => setState({ error: new Error('failed') }));
  matrixSnapshot('error', screen(), CASES);
});
```

`OrdersScreen.matrix.test.tsx` is the worked example: loading, error and empty
across four cells.

---

## What gets captured

Only the properties this gate is responsible for - colours, type, spacing,
radius, borders, dimensions, opacity, elevation, flex direction. The full list
is `TRACKED` in `visualMatrix.tsx`.

Deliberately narrow: capturing the whole style object would make every baseline
churn on unrelated edits, and **a baseline nobody trusts gets regenerated on
sight rather than read.**

---

## Proving it works

It was mutation-tested before being relied on. Changing `primary[500]` from
`#1E4448` to `#1E4449` - a one-digit change - turned **10 of 24** Button
baselines red, and exactly the right ten: the light-theme cases. Dark cases use
`primary[300]` and correctly stayed green. The token was then restored and all
24 passed again.

If you extend this harness, do the same. A gate that cannot be shown to fail is
not a gate.

---

## Current coverage

| Spec                           | Cells | What                                  |
| ------------------------------ | ----- | ------------------------------------- |
| `Button.matrix.test.tsx`       | 24    | primary, secondary, outline, disabled |
| `Atoms.matrix.test.tsx`        | 42    | Card x2, Badge x3, Input x2           |
| `OrdersScreen.matrix.test.tsx` | 12    | loading, error, empty                 |

**Not yet covered**, in rough priority order: Checkout (M3 - the highest-stakes
screen and the worst palette offender), Home, Search, Favorites, Profile,
Settings, and the driver screens if they stay in scope (MD4). Each needs its
query and navigation dependencies mocked the way `OrdersScreen.matrix` does.
