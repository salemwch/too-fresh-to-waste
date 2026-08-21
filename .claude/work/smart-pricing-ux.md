---
status: done
scope: cross-app
gate:
  pnpm --filter @foodwaste/backend check:ts && pnpm --filter @foodwaste/web
  type-check
---

## Intent

The merchant "Smart Pricing Insights" card is unreadable for the merchants it
targets. A pastry-shop owner could not tell what it was saying or why. Three
root causes: the advice sentences are generated as hardcoded English in the
backend (so fr/ar merchants read English inside an RTL page), the suggested
price range is derived purely from a city-wide average that mixes restaurants
with pastry shops (and includes the merchant's own offers), and the suggestion
never appears where the price is actually chosen. Outcome: advice that is
translated, like-for-like, honest about its sample, and present at the moment of
the pricing decision.

## Constraints

- No user-facing text may cross the API boundary. Backend emits
  `{ type, impact, params }` with numeric params only; web renders translated
  copy per `type`. (`.claude/rules/web.md` #12/#13)
- All three locale files updated together; `dashboard` namespace already
  registered in `(merchant)/layout.tsx` MERCHANT_NAMESPACES.
- Peer comparison must never be a mirror of the merchant's own offers.
- No fabricated statistics in copy ("2x faster", "40% higher fill rates" are
  invented).
- Day/hour aggregation must use `Africa/Tunis`, not UTC.
  `TimezoneUtil.DEFAULT_TIMEZONE`.
- `exactOptionalPropertyTypes`: use `null`, not optional-undefined, for absent
  range.

## Tasks & Acceptance

- [x] Backend `PricingInsight` becomes
      `{ type, impact, params: Record<string, number> }` — no `message` field
      anywhere in the response
- [x] Zone stats exclude own offers and prefer same `EstablishmentType` in same
      city; degrade city-wide, then to `scope: 'none'`
- [x] `suggestedPriceRange` derives from own sold-out history when >= 3 samples,
      else zone, else `null`; carries `basis`
- [x] `$dayOfWeek`/`$hour` pass `timezone: 'Africa/Tunis'`; hour falls back to
      `createdAt` when `publishedAt` missing
- [x] best*day/best_hour/low*\* insights suppressed below
      MIN_SAMPLE_FOR_INSIGHTS (3)
- [x] Web renders every insight from `messages/*.json` in en/fr/ar — grep shows
      no English string literals in the panel
- [x] Panel shows what "fill rate" and "zone" mean, plus sample size and window
- [x] Suggested range appears inside the create-offer panel next to the price
      input
- [x] Panel renders a first-run explainer instead of vanishing when the merchant
      has no data

## Decisions

- Peer group keyed on `EstablishmentType` (has `PASTRY_SHOP`, `BAKERY`,
  `RESTAURANT`…) rather than `Offer.categories` (free-form string array) or
  `cuisineTypes` (array, messy). Rejected `OfferType` — a pastry shop and a
  restaurant both list `surprise_bag`, so it does not separate the populations
  the merchant actually competes with.
- `params` typed `Record<string, number>` rather than a formatted string: forces
  the formatting/pluralisation into next-intl where the locale is known, and
  makes it structurally impossible to reintroduce untranslated backend copy.
- Range basis prefers own history over zone. A merchant's own sold-out prices
  are direct evidence of what their customers pay; the zone average is a proxy
  that is only useful before that evidence exists.

## Open questions

- Non-blocking: `surprise-bag-panel.tsx` has no i18n at all (every label is a
  hardcoded English literal). Out of scope here — new strings added by this
  change are translated, the pre-existing ones are not. Flagged to the user.

## Verification run

- `pnpm --filter @foodwaste/backend check:ts` — clean
- `pnpm --filter @foodwaste/web type-check` — clean
- backend jest: 88 suites / 1557 tests pass (22 new in
  `offers/__tests__/pricing-suggestions.spec.ts`)
- web jest: 9 suites / 259 tests pass (112 new in
  `__tests__/i18n/pricing-messages.test.ts`)
- `pnpm --filter @foodwaste/web build` — all locales prerender
- prettier clean on every touched file; lint adds no new errors
- Mutation-checked: dropping the `$ne` exclusion, switching the timezone to UTC,
  removing the min/max clamp, and deleting one `fr` key each fail exactly the
  test written for them, and nothing else.

## Second pass — closing the stated gaps

Two of the three gaps recorded above are now closed; the third is recorded with
the reason it cannot be closed from here.

- **Create-offer panel fully translated.** `surprise-bag-panel.tsx` had no i18n
  at all: every label, every validation error, and the customer-facing
  description it pre-fills into the offer were hardcoded English. A French
  merchant filled an English form and published an English description to
  Tunisian customers. New `dashboard.surpriseBag` namespace in all three
  locales; the panel now holds no user-facing string literal. Covered by
  `__tests__/i18n/surprise-bag-messages.test.ts` (156 assertions), which also
  pins that every pre-filled description clears the backend's 20-character
  minimum.
- **Both new components have render tests.** `smart-pricing-panel.test.tsx` (17)
  and `price-guidance.test.tsx` (11) render the real components against the real
  `en.json`, so a key renamed on one side only fails here instead of shipping as
  a dotted path. They cover the range boundaries, the scope and basis variants,
  day index 0, an out-of-range day index, and the deploy-skew payload.
- **Closed: the aggregations now execute against a real MongoDB.**
  `pricing-suggestions.integration.spec.ts` runs the real pipelines against the
  local `rs0` replica set — `$facet` with five sub-pipelines, `$lookup` carrying
  both `localField`/`foreignField` and a `pipeline`, `$in` as an aggregation
  expression inside `$cond`, and `$dayOfWeek`/`$hour` with an explicit timezone.
  It runs from its own config (`pnpm --filter @foodwaste/backend test:db`) and
  `jest.config.js` excludes `*.integration.spec.ts` so `pnpm test` still runs
  without Docker. There is deliberately **no skip path**: a missing database
  fails the suite rather than reporting green.

  Writing it paid for itself immediately — the first run failed the best-hour
  assertion because three fixture offers shared an hour and outvoted the one
  under test. The production code was right; the fixture was proving nothing.
  The bag that crosses midnight in Tunis now carries the most sold units, so it
  wins on volume rather than on a tie-break.

## Second verification run

- backend `check:ts` clean; web `type-check` clean;
  `pnpm --filter @foodwaste/web build` compiles and prerenders all 266 pages
- web jest: 12 suites / 483 tests pass
- Mutation-checked the new component tests: collapsing the
  `peersHelp`/`peersHelpCity` branch, switching `?? -1` to `|| -1` in the day
  lookup, and moving the range floor from `<` to `<=` each fail exactly one test
  and nothing else
