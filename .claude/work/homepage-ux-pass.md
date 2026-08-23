---
status: done
scope: web
gate:
  pnpm --filter @foodwaste/web type-check && pnpm --filter @foodwaste/web test
  && pnpm --filter @foodwaste/web build
---

## Intent

Act on the homepage audit. The page currently promises a merchant a business in
the hero and then shows them a consumer app tour, and several sections stack a
title, a subtitle and a description that all say the same thing. Outcome: one
clear doorway per audience, one idea per block, and headings that carry
information when scanned.

## Files modified

| File                       | Change                                                    |
| -------------------------- | --------------------------------------------------------- |
| `(marketing)/page.tsx`     | drop the slogan line from the hero; mount `AudienceSplit` |
| `sections/Section2.tsx`    | drop the subtitle block                                   |
| `sections/Section4.tsx`    | `STEP_CARDS` 6 → 3                                        |
| `sections/Section5.tsx`    | remove the outer `h2`, leaving one per section            |
| `sections/index.ts`        | export the two new sections                               |
| `(marketing)/layout.tsx`   | register the two new namespaces                           |
| `messages/{en,fr,ar}.json` | all copy below                                            |

## New components

- **`sections/AudienceSplit.tsx`** - two doorways directly under the hero. "I
  have surplus food" → `/business-signup`, "I want cheaper food" → `/consumer`.
  Both routes already exist; this is the fix for the audience whiplash, and it
  is why the hero is allowed to stay merchant-facing.
- **`sections/Rewards.tsx`** - carries what used to be steps 5 and 6. Points and
  rewards are not steps in getting a bag; presenting them as such is what made
  the flow read as six steps long.

## Copy, per locale (en / fr / ar)

- `hero.tagline` - no longer rendered in the hero. Key kept: it is the company
  slogan and belongs somewhere, just not between the headline and the sentence
  that explains the product.
- `section2.subtitle` - deleted outright. "A social impact company on a mission
  to inspire and empower everyone" said nothing the title had not.
- `section3.titleLine1/2` - "WHY USE / TOO FRESH TO WASTE" → leads with the
  informative words instead of the brand name.
- `section3.benefits.getRewards` - "GET REWARDS BY REDEEM YOUR POINT" is
  ungrammatical.
- `section3.benefits.earnPoints` - "HELP OTHERS LIVE" overstates what buying a
  bag does.
- `section4.title` - "HOW TO USE THE APP & GET POINTS" → names the three steps
  and drops the points, which are no longer part of this section.
- `section4.slides.step1-3` - rewritten as browse / reserve / collect.
- `section4.slides.step4-6` - deleted; their content moves to `rewards`.
- `section5.title` - "Looking for answers?" → informative first word.
- `section5.mainTitle.*` - deleted with the second `h2`.
- new `audienceSplit.*` and `rewards.*` namespaces.

## Decisions

- **Hero stays merchant-facing.** The audit offered a choice. Supply is what
  makes the consumer side work, the merchant headline is the sharpest copy on
  the site, and the split immediately below means a shopper is never more than
  one screen from their own door.
- **All-caps headings left as they are.** Checked against the research rather
  than assumed: uppercase is not a legibility barrier in headings, and for
  glancing at a single word can be read faster than lowercase. The problem with
  the benefit headings was grammar, not case.
- **A new Rewards section rather than folding rewards into the FAQ.** The FAQ
  answers "how does the Big Prize work"; the section shows that points exist at
  all. Different jobs, and the FAQ is below the fold for most readers.

## Tasks & Acceptance

- [x] Hero renders exactly four blocks: headline, supporting text, proof chips,
      CTA
- [x] `AudienceSplit` sits directly below the hero with two working
      locale-prefixed links
- [x] Section 2 renders title + one paragraph, no subtitle
- [x] No ungrammatical heading anywhere in `section3.benefits`
- [x] Section 4 renders three steps; `STEP_CARDS` and the copy cannot disagree
- [x] `Rewards` carries the points and rewards content
- [x] Exactly one `h2` per section, `h1` still unique
- [x] Every new key present in en, fr and ar

## Verification

- type-check clean; 531 tests pass (22 new in
  `__tests__/i18n/homepage-structure.test.ts`); build prerenders 269 pages
- Heading outline after the pass: one `h1` on the page, exactly one `h2` per
  section, `h3` nested inside three of them. Section 5 went from two to one.
- Section order: Hero, AudienceSplit, Section2, Section3, Section4, Rewards,
  Section5, InfiniteMarquee.
- Mutation-checked: adding a fourth step to fr alone, and reintroducing the "by
  redeem" construction, fails three tests and nothing else.
