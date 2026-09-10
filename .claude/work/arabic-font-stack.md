---
status: draft
blocked-on: product decision - locale-conditional font stack for ar
scope: web
gate: pnpm --filter @foodwaste/web test:visual
---

## Intent

Arabic text on the web app never renders in Noto Sans Arabic. It falls back to
whatever the operating system's UI font provides. The font is imported, self
hosted and shipped - it is simply never selected, because families that always
match sit ahead of it in the composed stack.

Found while classifying the 20 Playwright failures after the Next 16 upgrade.
Next 16 did not cause it; it changed `adjustFontFallback` metrics, which changed
how the _wrong_ font renders, which is what made the diffs appear.

## Evidence

Measured in a real browser against a production build, `/en/visual-harness`:

```
arabic sample button
  computed font-family:
    Quicksand, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    Roboto, sans-serif, "Noto Sans Arabic", Tahoma, Arial, sans-serif,
    system-ui, sans-serif
  document.fonts loaded families: ["Quicksand", "Comfortaa"]
```

`Noto Sans Arabic` is absent from the loaded set even though the page renders
Arabic glyphs. The browser never requested it.

## Cause

`tailwind.config.ts` is correct on its face:

```ts
sans: [
  'var(--font-quicksand)',
  'var(--font-noto-arabic)',
  'system-ui',
  'sans-serif',
];
```

The problem is inside the first variable. `next/font` bakes the `fallback` array
into the CSS variable, so `var(--font-quicksand)` expands to the whole chain
`Quicksand, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
before `var(--font-noto-arabic)` is ever reached.

CSS font matching is per character, and it stops at the first family that has a
glyph. For an Arabic codepoint the walk hits, in order:

| Family in front of Noto | Covers Arabic?                             |
| ----------------------- | ------------------------------------------ |
| `Quicksand`             | no - correctly falls through               |
| `system-ui`             | **yes** on Windows, macOS, iOS and Android |
| `Segoe UI`              | **yes** on Windows                         |
| `Roboto`                | **yes** on Android                         |
| `sans-serif`            | **yes** - a generic always resolves        |

So the walk terminates at `system-ui` at the latest, and Noto is unreachable on
every mainstream platform.

This means the comment in `tailwind.config.ts` - "Noto Sans Arabic sits in both
stacks rather than behind a locale conditional: neither Latin face carries
Arabic glyphs, so the browser falls through per character and Arabic resolves on
its own" - describes an intent the code does not achieve. The premise is right;
what it misses is that the _fallback_ families in front of Noto do carry Arabic.
Same for `.claude/rules/web.md` rule 9 and `DESIGN.md` §3.1.

## Why it matters

Arabic is one of three supported locales and, per `.claude/rules/seo.md`, the
one with growing mobile volume. Those users get a system font the design system
never chose, with metrics nobody reviewed. It also means every Arabic visual
baseline in the suite records a fallback rendering rather than the intended one.

## Constraints

This is a §20 governance event, not a local fix: it changes which typeface
renders for a whole locale. `DESIGN.md` §3.1 has to be updated before the code.

Removing the trailing `'sans-serif'` from the `fallback` arrays is **not**
sufficient on its own - `system-ui` at position 2 still blocks. Any fix has to
get `var(--font-noto-arabic)` in front of the Latin face's entire fallback
chain.

## Options - A and B were built, measured, and both fail

Both were implemented against a real production build and reverted. What the
experiment established, in order:

**1. next/font's generated fallback faces carry no `unicode-range`.** Removing
an explicit `fallback` makes next/font emit
`@font-face{font-family:Noto Sans Arabic Fallback;src:local(Arial);size-adjust:121.35%}`.
Because it is unranged it matches _every_ codepoint, so wherever it sits it
swallows everything after it. This is what kills **option A**: dropping
`fallback` from Quicksand/Comfortaa just puts an unranged `Quicksand Fallback`
in front of Noto, and Arabic is blocked exactly as before.

**2. `adjustFontFallback: false` does not suppress that face in next 16.3.4.**
The docs say it should ("A boolean value that sets whether an automatic fallback
font should be used"). Verified on a clean build with `.next` and
`node_modules/.cache` both deleted: the face is still emitted and still lands in
the variable. Only supplying an explicit `fallback` suppresses it.

**3. Noto Sans Arabic is not Arabic-only.** Its face 4 declares `U+??`, which is
U+0000-U+00FF - the whole of Basic Latin and Latin-1. So **option B** does not
work either: with `var(--font-noto-arabic)` first, Latin text renders in Noto.
Measured at 200px on `/en`, string `Handgloves`:

```
  rendered   1110      <- what the page actually painted
  quicksand  1103
  noto       1110      <- rendered === noto
  arial      1054
```

That is the whole Latin site silently restyled, which is a far worse regression
than the one being fixed.

This also corrects the premise in the source comment a second time. It is not
only that the Latin fallbacks carry Arabic - Noto carries Latin too. The two
families overlap in both directions, so **no single shared stack can order them
correctly**. Whichever goes first captures text that belongs to the other.

- **C. Locale-conditional stack** - put an Arabic-first family on `ar` only, and
  leave en/fr exactly as they are. Now the only remaining option, because the
  overlap above makes a shared stack unsolvable by ordering.

Recommendation: C, but it is a **product decision, not a defect fix**. The
current stack's defining choice was "no locale conditional", and C reverses it.
That needs a `DESIGN.md` §3.1 call before any code changes, which is why nothing
was implemented here.

## Tasks & Acceptance

- [ ] **Product/design call required first**: accept a locale-conditional font
      stack for `ar`, reversing the "no locale conditional" decision. Nothing
      below can start until this is answered.
- [ ] Record the decision in `DESIGN.md` §3.1
- [ ] Implement, then re-run the probe: `document.fonts` must list
      `Noto Sans Arabic` after rendering an Arabic glyph
- [ ] Confirm Latin rendering is unchanged on `en` and `fr` baselines
- [ ] Re-baseline the Arabic screenshots and say in the commit which changed
- [ ] Correct the claim in `tailwind.config.ts`, `.claude/rules/web.md` rule 9
      and `DESIGN.md` §3.1

## Decisions

- 2026-09-09: Not fixed inside the Next 16 migration. The migration scope was
  frozen deliberately, and this is a typeface change for an entire locale that
  needs a design call first. The 12 Arabic-related baselines were updated to the
  current (still-wrong) rendering so the suite is green and future regressions
  are visible; they will need updating again when this is fixed. Recorded rather
  than silently carried.

- 2026-09-10: Options A and B implemented against a production build, measured,
  and reverted. See the Options section - A is defeated by next/font's unranged
  generated fallback faces, B by Noto Sans Arabic declaring `U+??` and therefore
  covering Latin-1. `adjustFontFallback: false` does not suppress the generated
  face in 16.3.4 despite the documented contract. No code from either attempt
  was kept; `git status` was clean afterwards.

  The conclusion is stronger than "not now": because the two families overlap in
  **both** directions, a single shared stack cannot be ordered correctly at all.
  Option C is the only remaining route and it reverses a documented design
  decision, so it stops here for a product call rather than being introduced
  inside the Next 16 migration.

## Open questions

- Non-blocking: does `adjustFontFallback` on Noto Sans Arabic size-match against
  the right Arabic metrics, or is it matching Latin metrics? Worth measuring
  once A is in.
