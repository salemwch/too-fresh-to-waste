---
status: ready-for-dev
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

## Options

- **A. Drop `fallback` from Quicksand/Comfortaa.** `adjustFontFallback: true`
  already generates a size-matched local fallback face, so the hand-written
  array is mostly redundant. Smallest change; needs checking that the generated
  face still covers the "webfont failed to load" case the array was added for.
- **B. Put `var(--font-noto-arabic)` first in the Tailwind stacks.** Matching is
  per character, so Latin would fall through Noto to Quicksand. Risk: Noto Sans
  Arabic does carry Latin digits and basic Latin, which would then render in
  Noto rather than Quicksand.
- **C. Locale-conditional stack**, applying an Arabic-first family on `ar` only.
  Explicitly rejected when the current stack was written; revisit only if A and
  B both fail.

Recommendation: A, verified with the same browser probe used above, then
re-baseline the Arabic screenshots.

## Tasks & Acceptance

- [ ] Decide A / B / C and record it in `DESIGN.md` §3.1
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

## Open questions

- Non-blocking: does `adjustFontFallback` on Noto Sans Arabic size-match against
  the right Arabic metrics, or is it matching Latin metrics? Worth measuring
  once A is in.
