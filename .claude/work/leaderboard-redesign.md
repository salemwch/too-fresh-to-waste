---
status: in-review
scope: mobile
gate:
  pnpm --filter @foodwaste/mobile type-check && pnpm --filter @foodwaste/mobile
  lint && pnpm --filter @foodwaste/mobile test
---

## Intent

Restyle the Leaderboard screen to the design approved on 2026-09-02 (mockup:
`leaderboard-redesign.html`, EN and FR). The screen moves from its current dark
surface to a light cream one, gains a Grand Prize hero card carrying a trophy
illustration, cuts the podium from five places to three, and makes the winning
band legible in the rankings list. This is a visual change: no data, query,
claim or navigation behaviour changes.

## Constraints

- **Nothing is removed.** The mockup does not draw the countdown, end date,
  floating position bar, neighborhood footer, skeleton or any of the four
  modals. All of them stay. The countdown and end date move into the hero card
  rather than disappearing with the old header.
- `DESIGN.md` is binding. Tokens only; the four warm neutrals the design needs
  follow the precedent `CHAMPION_GOLD` already sets in `constants/palette.ts` -
  screen-local, documented, promoted only when a second consumer appears.
- New copy lands in `en`, `fr` **and** `ar` together (CLAUDE.md), plus namespace
  arrays.
- Trophy master is gitignored in `assets-src/`; only generated @1x-@4x webp is
  committed, via `scripts/optimize-assets.js`.
- Mobile production is light-only (`DARK_MODE_ENABLED = false`), so the light
  surface does not need a dark counterpart.

## Tasks & Acceptance

- [x] `constants/palette.ts` inverted to the light surface, keeping the gold
      accent. Acceptance: no component imports a removed export.
- [x] Trophy asset: master to `assets-src/`, JOB entry, @1x-@4x webp emitted.
      Acceptance: `assets:check` passes, variants committed.
- [x] `ChallengeHeader` becomes the Grand Prize hero (title, subtitle, body,
      trophy) and still renders `ChallengeCountdown` + end date.
- [x] `PrizeTierCards` restyled: icon circle, subtitle, footer line, badge that
      cannot overlap the title.
- [x] `PodiumTop5` -> `PodiumTop3`. Acceptance: its test drives 3 places and the
      ranks-4/5 cases are gone, not silently passing.
- [x] `LeaderboardRow` gains rank chip, avatar, subtitle; ranks 1-3 carry the
      podium metals.
- [x] `LeaderboardScreen`: light container, winning-band label, cutoff rule.
- [x] 8 new i18n keys x 3 locales.
- [x] Gate green; 422 style snapshots reviewed rather than blanket-updated.

## Decisions

- **2026-09-02 - warm neutrals stay screen-local.** The design needs four warm
  values (`#FAF7F0` ground, `#FDF7E9` gold card, `#EAF5EE` mint card, `#F3ECDD`
  podium) with no token. Rather than a global token addition, they go in
  `constants/palette.ts` with rationale, which is exactly what that file already
  does for `CHAMPION_GOLD` ("no token because nothing else in the app uses it").
  Promote if a second screen needs them. Alternative rejected: adding four
  global tokens for one screen, which inflates the palette for no reuse.
- **2026-09-02 - trophy ships as supplied, cyan confetti included.** User's
  call, made explicitly. It puts a non-palette hue on the dark hero, so it is a
  deliberate deviation and belongs in `DESIGN.md` §19 Known Exceptions. A
  gold-harmonised variant is kept at `assets-src/prizeTrophy-gold.png`.
- **2026-09-02 - badge keeps `yourTierBadge` semantics.** The mockup drew "Your
  Vote", but the existing key means "the tier you are on track for" ("✓ You" /
  "✓ Vous"). Changing the string would change its meaning; the design is
  followed visually and the existing semantics kept.

## Verification (2026-09-03)

mobile type-check clean; eslint clean; 123 suites / 1945 tests / 422 snapshots
pass; production AAB builds at 21,383,417 B (+177 KiB for the trophy across five
densities, of which Play ships one per device).

Not verified: nothing has been seen on a device. The redesign is a surface
change to a screen with no visual-regression coverage, so a manual pass is still
required before release.

## Open questions

- Non-blocking: `MonthlyBagGoalBanner.handlePress` on Home is an empty stub
  while announcing "Opens more details". Natural destination is this screen. Out
  of scope here unless asked.
