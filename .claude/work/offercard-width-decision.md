---
status: draft
scope: mobile
gate: pnpm --filter @foodwaste/mobile type-check
---

# OfferCard width in full-width lists - decision required

## Intent

`OfferCard` caps itself at `maxWidth: 270` dp. That suits the horizontal
carousels it was designed for and leaves up to 35% of the row empty when the
same card is used in a full-width vertical list. Changing the cap alters three
screens and moves the snapshot baseline, so it is a design decision rather than
a defect to be silently corrected. This entry records the evidence so the call
can be made once.

**Nothing has been changed.** `maxWidth: 270` is still in place.

## Evidence

`src/design-system/components/organisms/OfferCard/OfferCard.tsx`, in
`createStyles`:

```ts
card: {
  flexDirection: isHorizontal ? 'row' : 'column',
  minWidth: isHorizontal ? 160 : 170,
  maxWidth: isHorizontal ? 180 : 270,   // <- this
  ...
}
```

The cap applies to **every vertical `OfferCard`**, regardless of the container.

### Measured on device

BlueStacks, 720 x 1280 at 240 dpi (1 dp = 1.5 px, so 480 dp wide), Favorites
screen, 2026-08-30, via `uiautomator` bounds:

| Quantity                       | Value                             |
| ------------------------------ | --------------------------------- |
| Screen width                   | 720 px (480 dp)                   |
| Screen header ("My Favorites") | 696 px - the screen is full width |
| Card rendered width            | **405 px (270 dp)**               |
| Card position                  | x = 48 to 453, left-aligned       |
| Available row width            | 624 px (416 dp)                   |
| **Unused horizontal space**    | **219 px (146 dp) = 35%**         |

405 px is exactly 270 dp x 1.5, which confirms the cap is what is binding rather
than any container constraint.

Row padding is 64 dp total: `favoritesSection` 16 dp plus `listContainer` 16 dp,
each side.

### Impact by device width

| Width  | Available | Rendered | Used | Unused       | Typical device             |
| ------ | --------- | -------- | ---- | ------------ | -------------------------- |
| 320 dp | 256 dp    | 256 dp   | 100% | 0 dp (0%)    | iPhone SE, low-end Android |
| 390 dp | 326 dp    | 270 dp   | 83%  | 56 dp (17%)  | iPhone 14, Pixel           |
| 430 dp | 366 dp    | 270 dp   | 74%  | 96 dp (26%)  | iPhone Pro Max             |
| 480 dp | 416 dp    | 270 dp   | 65%  | 146 dp (35%) | the test device            |

**The defect is invisible on small phones and worsens with screen width.** At
320 dp the cap never binds. This is why it survived review: it does not
reproduce on the narrowest device, which is the one people usually check.

### Affected screens

| Screen        | Container                        | Affected?                                  |
| ------------- | -------------------------------- | ------------------------------------------ |
| **Favorites** | vertical `FlashList`, full width | **Yes** - the measurement above            |
| **Home**      | horizontal carousels             | No - 270 dp is the intended carousel width |
| **Search**    | list/map results                 | **Likely** - not measured this pass        |

Home is the reason the cap exists. Any change must leave the carousels at their
current width.

### RTL

Not measured. The card is `alignSelf`-neutral and the list uses
`paddingHorizontal`, so under RTL the empty space should mirror to the left edge
rather than disappear - the same 35% gap on the other side. **This needs
confirming on device before the change ships**, because a gap that reads as
"unfinished" in LTR reads the same way mirrored.

## Options

### A. Let the card fill its container, keep the cap for carousels

Drop `maxWidth` from the vertical variant and have the carousel pass an explicit
width, so the constraint lives with the layout that needs it rather than with
the component.

- Fixes Favorites at every width; Home unchanged.
- Touches the 422-snapshot baseline for every vertical `OfferCard`.
- Requires checking Search.

### B. Add an explicit `fullWidth` variant

`<OfferCard fullWidth />` sets `maxWidth: undefined`. Favorites opts in.

- Smallest blast radius; Home and Search untouched.
- Adds a prop that exists only to undo a default, which is a smell: the default
  is wrong for the general case and right for one caller.

### C. Cap higher (e.g. 400 dp) instead of removing it

- Cheap, but arbitrary, and still leaves a gap at 480 dp.

### Recommendation

**Option A.** The cap is a carousel concern that leaked into a component used in
two different layouts. Moving it to the carousel puts the constraint where the
requirement is, and stops the next full-width consumer inheriting the same bug.
B is the safer short-term choice if the snapshot churn is unwelcome this close
to a release.

## Open questions

- Blocking: is 100% row width the wanted look on Favorites, or is a narrower
  centred card the intended design? The measurement says the current result is
  neither - it is full-width-minus-35%, left-aligned, which looks accidental.
- Non-blocking: confirm Search, and confirm the RTL mirror.

## Decisions

- 2026-08-30: recorded, not changed. Raised during the final
  production-readiness pass; classified as a §20 governance item rather than a
  verification fix, because it changes three screens and the snapshot baseline.
