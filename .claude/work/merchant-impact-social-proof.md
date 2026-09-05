---
status: ready-for-dev
scope: cross-app
gate:
  pnpm --filter @foodwaste/backend check:all && pnpm --filter @foodwaste/web
  type-check && pnpm --filter @foodwaste/web test && pnpm --filter
  @foodwaste/web build
---

## Intent

Turn a merchant's impact into a **public, shareable, permanent social object**
so that: they stay (retention), they feel pride and show it (social proof), they
sell Too Fresh To Waste to their own audience (acquisition), the community fund
becomes visible instead of theoretical, and the result is something a competitor
cannot copy in a sprint.

ESG reporting is the byproduct, not the product. The existing ESG page is an
accountant's artifact - it produces a PDF nobody posts. This work produces
things merchants put on Instagram, on their door, and in their Google listing.

## Strategy - the three questions, answered

### Which feature drives the most merchant retention?

**The Public Merchant Impact Profile, by a wide margin. Not the leaderboard.**

Retention comes from switching cost, and a public profile is the only item on
the roadmap that manufactures one. The moment a merchant puts
`toofreshtowaste.com/m/boulangerie-el-menzah` in their Instagram bio, on their
Google Business listing, and on a sticker in their window, churning means
deleting a public asset they have promoted themselves. Nothing else here has
that property. A dashboard widget is forgotten the day they stop logging in.

Ranked for retention:

1. Public profile - manufactures switching cost
2. Monthly recap - the recurring reason to open the dashboard
3. Community fund ledger - the emotional anchor, but a one-time reveal alone
4. Share cards - retention effect is indirect, via the pride loop
5. Leaderboards - **net negative below the median**, see the warning below

### Which feature brings the most new users?

**Shareable Impact Cards, but only because of what they link to.**

The merchant has the audience you do not: local, food-motivated, and already
trusting them. Every card is a free, credible, hyper-local ad. The entire
multiplier lives in the link target - a card pointing at a public impact page
with live offers and an app CTA converts; a card pointing at a login page
converts zero. That is why the profile must ship before the cards, not after.

Second: **Business of the Month**, because people share awards far more than
they share statistics, and an award is press-usable in a way a carbon number
never is.

Underrated, and probably the highest new-users-per-dinar of anything on this
list in the Tunisian market specifically: **the window sticker**. A sticker on a
bakery door in Lac is seen by hundreds of local pedestrians a day, forever, for
roughly 2 TND. It needs no backend, works on a merchant's first day before they
have any numbers, and converts foot traffic that no digital channel reaches.
This is the argument for pulling it out of Phase 3.

### What is a moat against Too Good To Go?

Be honest about what is not a moat. Share cards, badges, tiers, CO2 math and
leaderboards are all copyable in one sprint by a company with 10x the
engineering budget. Do not treat them as defensible.

Three things are genuinely defensible:

1. **The community fund, because it is structural, not a marketing programme.**
   `subtotal * 0.19 * 0.05` is baked into your unit economics, the beneficiary
   goals are locally legible (school kits, medicine, clothing - not carbon
   abstractions), and `distributionHistory` already carries `receipts[]` for
   audit. TGTG's model has no charity redistribution inside its unit economics.
   Matching you means changing their global economics for one small market. They
   will not.
2. **Accumulated public profiles.** Two years of impact history at a stable URL,
   linked from Google and Instagram, is an asset the merchant owns and cannot
   port. It compounds per merchant and gets more expensive to displace every
   month. Same moat mechanism as review counts.
3. **Local legitimacy artifacts** - named Tunisian beneficiary organisations,
   receipts, city-level awards, physical presence in the shop. A global player
   entering the market cannot manufacture two years of local distribution
   history.

Where **not** to over-invest: carbon and water metrics. Everyone has them,
nobody trusts them, and in this market they are the least emotionally resonant
numbers you own. They belong in supporting slots, never as the hero metric.

### Of the profile additions, which drives retention?

**Founding Partner, and it is not close.** It is the only status on the roadmap
that is **unrepeatable** - a merchant who joins next year can never earn it, and
a merchant who leaves can never get it back. Scarcity plus irreversibility is
the strongest retention primitive available, and it costs one boolean.

Second: **Partner since**. Tenure displayed publicly converts time already spent
into a sunk asset. "Partner since 2026" gets more valuable every year the
merchant does nothing, which is the cheapest retention mechanic that exists.

Third: **testimonials**. A merchant who has customer praise on a page they own
comes back to look at it. Nobody re-reads their own carbon number.

### Which drives merchant motivation?

**Progress-based rankings.** Position rewards the merchant who was already
winning; progress rewards anyone who improved this month, which is a reachable
win at any size. A bakery that went from 40 to 55 bags gets the same "Most
improved in Ariana" recognition as the market leader gets for being large, and
it is the only recognition the small merchant could ever have won.

Second: **customers served**, because it is the one number a merchant already
counts in their own head. They know what 300 customers means in their shop. They
have no intuition for 412 kg of CO2.

### Immediate versus deferred

- **Immediate (P0):** backfill, customers served, partner since, Founding
  Partner, window sticker. All are cheap, none depend on scale or on editorial
  capacity.
- **P0, but sequenced after the profile shell:** testimonials, because they need
  correct `ReviewStatus` handling and a moderation-state contract, not just a
  query.
- **Deferred, for a structural reason:** progress rankings **cannot be computed
  at launch**. "Places gained" and "monthly growth" require a prior month to
  compare against, so the first cohort snapshot produces no movement by
  definition. They need one baseline month before they render anything.
- **Deferred, for an operational reason:** Featured Partner is an editorial
  commitment, not a feature. Do not ship it until a named person owns the weekly
  pick. A curation programme that goes stale after three weeks is worse than
  never launching it, because merchants notice being dropped.

## Constraints

- **Hero metric priority, in order**: meals recovered > customers served >
  school kits / medicine packs funded > bags saved > CO2 and environmental
  metrics **last**. CO2, water and trees are supporting metrics only and never
  the hero on any surface.
- **Every shared card links to a public page.** Never `/merchant/...`, never a
  login redirect.
- **Card anatomy is fixed**: one hero metric, two supporting, merchant name, Too
  Fresh To Waste mark, and the short URL rendered as text so a screenshot still
  carries the link.
- **Snapshots are immutable and permanent.** A card posted in March must still
  resolve, with the March numbers, in three years.
- **Copy must say "your sales funded", never "you donated".** The money comes
  from the platform's 19% margin, not the merchant's pocket. A merchant who
  repeats "I donated X" publicly on our wording is a false-claim exposure.
- Design tokens per `DESIGN.md`: dark ground `primary-500 #1E4448`, gold
  `secondary #C4A25A` as the accent on dark ground, coral is not decoration,
  `#017C6E` never on the dark teal. No raw hex outside the card renderers, which
  are satori and cannot read Tailwind - hex there comes from a shared constant,
  never typed inline.
- Three locales including Arabic RTL on every card and public page.
- All coefficients defensible and covered by `__tests__/seo/esg-claims.test.ts`.

## Review: should "customers served" be a first-class metric?

**Yes, promote it to first-class across profile, cards and milestones - with two
guards.** The reasoning matters more than the verdict.

**Why it outranks CO2, water and trees.** Every other impact number on this
platform is an _estimate_ derived from a coefficient: meals from `MEALS_PER_KG`,
CO2 from `carbonPerKg`, family-days from an assumed household size. Customers
served is the only one that is a **counted fact** - distinct `customerId` values
on completed orders. It cannot be challenged as greenwashing, it needs no
methodology footnote, and it is the single number a merchant already tracks in
their own head. They know what 300 customers means in their shop; they have no
intuition for 412 kg of CO2. For consumers it reads as social proof ("300 people
already bought here"), which is the one framing that also drives conversion on
the public page. It is doing three jobs at once, which nothing else here does.

**Guard 1 - it must be distinct customers, never order count.** Counting orders
and calling them customers inflates the number by the repeat rate, which is
exactly the metric a marketplace is most tempted to inflate and most damaged by
if caught. `$group` on `customerId`, then count. Where the repeat rate is worth
showing, show it separately and honestly as "X regulars came back".

**Guard 2 - a public floor.** For a merchant with 12 customers, publishing the
number signals weakness to consumers and hands a competitor a read on our GMV
per merchant. Rule: **publish customers served on the public profile only at 50
or above**; below the floor it is dashboard-only and cards fall through to the
next hero metric in the priority order. The number is never fabricated or
rounded up to clear the floor - it is simply not the metric shown yet.

**Consequences of promoting it.** It becomes a milestone axis of its own (50 /
100 / 500 / 1000 customers served), it becomes a valid hero metric on cards, and
it feeds `peopleHelped`. It also means the snapshot must freeze it, because
distinct-customer counts change as orders arrive and a posted card must not
drift.

## What already exists (verified at HEAD, do not rebuild)

| Capability                                   | Location                                       |
| -------------------------------------------- | ---------------------------------------------- |
| CO2, water, packaging, energy, car-km, trees | `sustainability.service.ts` `getCarbonMetrics` |
| Meals, people served, food kg, TND value     | `sustainability.service.ts` `getSocialImpact`  |
| 5 ESG tiers (Apprenti to Legende)            | `sustainability.service.ts:22-28`              |
| Monthly bag goal + progress                  | `getMonthlyGoal` / `MerchantGoal`              |
| Listing streak + freezes                     | `sustainability/services/streak.service.ts`    |
| A4 PDF report (pdf-lib)                      | `pdf-report.service.ts`, `reporting-bar.tsx`   |
| Image generation, edge runtime, Arabic font  | `app/[locale]/opengraph-image.tsx`             |
| Goal sequence + item prices                  | `goal-sequence.constant.ts`, category prices   |
| Per-order donation record                    | `UserDonation` (`userId`, `orderId`, `amount`) |

`DEFAULT_CATEGORY_PRICES`: TSHIRTS 10, PANTS 15, SHOES 20, CHILDREN_STUDIES 25,
MEDICINE 5 TND per item. TND to items is already solved.

## What is genuinely missing

1. `UserDonation` has **no merchant attribution** - only `userId` and `orderId`.
   Per-merchant fund figures are impossible without a schema change.
2. `Establishment` has **no public slug** and there is **no public read
   endpoint** (`GET /establishments/:id` is authenticated; only
   `check-place/:placeId` is `@Public()`).
3. **No public merchant page exists** anywhere in the web app. `/partners` is a
   marketing page, not a per-merchant profile.
4. No snapshot concept - every impact number today is computed live from an
   `orders` aggregation.
5. No square or story image output. The only visual artifact is an A4 PDF.

## Recommended changes to the proposed phasing

The roadmap as given is sound. Four changes, each with a reason - your call on
all four.

1. **Order Phase 1 internally as: Ledger, Profile, Snapshot, Cards.** The
   profile is the keystone - every card links to it, so a card shipped first has
   nowhere to point. Snapshot must land _with_ the cards, never after: a card
   without an immutable snapshot shows numbers that change after the merchant
   has posted it, which is a correctness bug the day it ships.
2. **Window sticker and printable assets stay in P0** (accepted 2026-09-05). No
   backend dependency, works for a merchant with zero sales, no dependency on
   platform scale, and plausibly the best acquisition-per-dinar item in the plan
   for this market.
3. **Rankings move to progress, not position, and shift to Phase 3.** Two
   reasons beyond the demotivation problem. First, position rewards the merchant
   who was already the largest, which no small merchant can ever win - progress
   is winnable by anyone who improved. Second, **progress metrics cannot be
   computed at launch**: "places gained" and "monthly growth" need a prior month
   to difference against, so the first cohort snapshot is structurally empty.
   One baseline month is a hard prerequisite, not a scheduling preference.
4. **Move "first sale" celebration into Phase 1.** The highest-emotion moment in
   a merchant's life on the platform is their first ever sale. Under the current
   plan it is uncelebrated until they hit 10 bags, weeks later.

## Domain model

### New collection: `MerchantImpactSnapshot`

The immutable, permanently public record behind every share.

```
slug              string   unique, 12-char url-safe, indexed
merchantId        ObjectId
establishmentId   ObjectId
kind              'monthly_recap' | 'milestone' | 'award' | 'annual'
periodStart       Date
periodEnd         Date
periodLabel       string                       // "Septembre 2026"
milestone         number?                      // 10 | 50 | 100 | 500
metrics           { bagsSaved, mealsRecovered, customersServed, peopleHelped,
                    foodKg, co2Kg, waterLiters, showers, familyDays,
                    fundTnd, fundItems: [{category, count}] }
heroMetric        'meals' | 'customers' | 'funded_items' | 'bags'
                                               // resolved at mint, frozen
establishmentName string                       // denormalized on purpose
establishmentCity string
establishmentType string
locale            'en' | 'fr' | 'ar'
viewCount         number
createdAt         Date
```

Denormalizing the establishment name is deliberate: a merchant who renames their
shop must not retroactively change a card posted last year.

**No TTL.** (This corrects an earlier suggestion of mine to expire these -
expiring a snapshot breaks the target of a live Instagram post, which is a
product defect, not a cleanup.)

Indexes: `{ slug: 1 }` unique; `{ merchantId: 1, createdAt: -1 }`;
`{ merchantId: 1, kind: 1, periodLabel: 1 }` unique - this is what makes minting
idempotent, so a double-tap on Share cannot create two URLs for one month.

### Changed: `UserDonation`

Add `merchantId` and `establishmentId`, written at `createDonation` time.
`CreateDonationInput` gains both fields; every caller must pass them.

Denormalized rather than `$lookup`-ed from `orders` on read, because the ledger
is read on every merchant dashboard load, and a join between two of the largest
collections per dashboard mount is exactly the N+1-shaped cost
`.claude/rules/performance.md` rule 7 forbids. With the field present it is one
indexed `$match` plus a `$group`.

New index: `{ merchantId: 1, contributedAt: -1 }`.

Migration: one-time backfill script joining historical `UserDonation.orderId` to
`orders` to populate both fields. Without it the ledger silently reads zero for
every merchant's entire history, which is worse than not shipping it.

### Changed: `Establishment`

Add `publicSlug: string`, generated from `name + city`, collision-suffixed,
immutable once set. Unique index with
`partialFilterExpression: { publicSlug: { $type: 'string' } }` - never `sparse`
alongside a partial filter, per CLAUDE.md.

Add `foundingPartnerAt?: Date` - **persisted, never derived**. A rank-derived
"first 100 merchants" recomputes differently as data changes and as
establishments are deleted; a merchant must not be able to lose Founding Partner
because someone else's record moved. Set once by migration, then never written
again.

`partnerSince` is **not** a new field - it is `createdAt` (the schema already
has `timestamps: true`). For merchants approved long after signup, prefer
`verifiedAt` when present and fall back to `createdAt`, so the public date is
the day they actually became a partner rather than the day they filled a form.

Backfill for existing establishments in the same migration.

### New collection: `MerchantAward` (Phase 3)

```
merchantId, establishmentId, city, category, month ('2026-09'),
kind: 'business_of_the_month' | 'featured_partner',
awardedAt, awardedBy?, editorialNote?, metrics, snapshotSlug
```

Index `{ city, category, month, kind }` unique **only for
`business_of_the_month`** via `partialFilterExpression` - that award is
algorithmic and must have exactly one winner per cohort per month, enforced by
the database rather than application code, for the same PM2-cluster reason
documented on `uniq_single_active_pool`.

**`featured_partner` is deliberately not uniquely constrained.** It is a curated
editorial pick, so the platform must be able to feature two merchants in a week,
or none, without fighting an index. It carries `awardedBy` (the admin) and
`editorialNote` (the reason, shown publicly) because a curated award with no
stated reason reads as favouritism.

### New collection: `MerchantRankingSnapshot` (Phase 3)

Materialized nightly. Never computed live.

```
month, city, category, establishmentId,
bagsSaved, customersServed, mealsRecovered,
rank, prevRank, placesGained, growthPct, cohortSize
```

`placesGained` and `growthPct` are null for a merchant's first month in a
cohort. The UI must render that as "first month, no comparison yet", never as 0%
growth or 0 places gained - a merchant who just joined has not stagnated.

## API surface

### Public (no auth, throttled, cached)

- `GET /api/v1/public/merchants/:slug` - profile payload:

  | Field                             | Source                      | Note                           |
  | --------------------------------- | --------------------------- | ------------------------------ |
  | name, city, type, images          | `Establishment`             |                                |
  | `averageRating`, `totalReviews`   | `Establishment`             | already maintained             |
  | ESG tier                          | `getEsgTier`                |                                |
  | mealsRecovered, bagsSaved, foodKg | `getSocialImpact`           |                                |
  | **customersServed**               | distinct `Order.customerId` | public only at >= 50           |
  | **peopleHelped**                  | documented formula below    | always labelled "estimated"    |
  | fund contribution + funded items  | new ledger aggregation      |                                |
  | **partnerSince**                  | `verifiedAt ?? createdAt`   | year + month only              |
  | **foundingPartner**               | `foundingPartnerAt != null` |                                |
  | **testimonials**                  | top 3 `Review`              | `status: APPROVED` only        |
  | awards                            | `MerchantAward`             | both kinds                     |
  | live offer count                  | `Offer`                     |                                |
  | CO2, water, trees                 | `getCarbonMetrics`          | bottom of the page, never hero |

  **Testimonials are the one field here that can leak.** `ReviewStatus` has six
  values and only `APPROVED` may ever be published - `PENDING`, `FLAGGED`,
  `SPAM`, `HIDDEN` and `REJECTED` all exist precisely because someone decided
  they should not be seen. Select on `status: APPROVED` explicitly; never select
  on "not rejected". Show reviewer first name and initial only, never the full
  name or any contact field. Cap at 3, prefer `isVerified` reviews with a
  non-empty `comment`, and exclude 1- and 2-star reviews from the highlights
  block: this is a merchant's own promotional page, and surfacing their worst
  review on it converts the retention feature into a churn feature. The full
  honest rating and review count stay visible next to it, so the page is not
  misleading - it is edited, which is what every review-carrying profile does.

- `GET /api/v1/public/impact/:slug` - frozen snapshot payload for card
  rendering.

Visibility rules - all four states handled, not just the happy one:

| Establishment state             | Profile | Live offers shown         |
| ------------------------------- | ------- | ------------------------- |
| `ACTIVE` + `isActive`           | 200     | yes                       |
| `subscriptionStatus: suspended` | 200     | no - impact history stays |
| `PENDING` / not yet approved    | 404     | -                         |
| `isDeleted`, `BLOCKED`          | 404     | -                         |

A lapsed subscription must not delete a page the merchant has linked from their
Instagram bio - that is the retention hook, and breaking it punishes exactly the
merchant you are trying to win back. A blocked-for-cause merchant must 404,
because a live award page for them is a liability.

### Merchant (authenticated)

- `GET /api/v1/sustainability/fund-ledger` - their attributed fund total plus
  the item breakdown by goal category.
- `POST /api/v1/sustainability/impact-snapshots` - mint a snapshot, returns the
  slug. Idempotent via the unique index. Throttled per merchant (10/day) so a
  script cannot grow an unbounded public collection.
- `GET /api/v1/sustainability/impact-snapshots` - their share history.

## Web surface

| Route                                           | Purpose                           |
| ----------------------------------------------- | --------------------------------- |
| `(marketing)/m/[slug]/page.tsx`                 | Public impact profile, ISR 3600   |
| `(marketing)/m/[slug]/opengraph-image.tsx`      | Link preview for the profile      |
| `(marketing)/impact/[slug]/page.tsx`            | Share landing - the card's target |
| `(marketing)/impact/[slug]/opengraph-image.tsx` | 1200x630 FB/WhatsApp preview      |
| `api/impact-card/[slug]/square/route.tsx`       | 1080x1080 PNG download            |
| `api/impact-card/[slug]/story/route.tsx`        | 1080x1920 PNG download            |
| `dashboard/merchant/fund-ledger-card.tsx`       | The ledger panel                  |
| `dashboard/merchant/share-sheet.tsx`            | Share + download dialog           |

Three image sizes, one renderer, three different jobs: 1200x630 is what Facebook
and WhatsApp render when the **link** is pasted; 1080x1080 and 1080x1920 are
**downloads** the merchant uploads to Instagram by hand. Instagram has no web
share target, so the download button is a first-class control, not a fallback.

The share landing page is the conversion surface: the card, the merchant's live
offers, "find offers near you", and app store links. It is a marketing page that
happens to be about one merchant.

`(marketing)` route group, so it inherits the public layout and is indexable.
New routes must be added to the sitemap module - guarded by
`__tests__/seo/sitemap-routes.test.ts`.

## Sharing mechanics

- `navigator.share({ url, title })` where available - native Android and iOS
  sheet with WhatsApp, Instagram, Facebook.
- `https://wa.me/?text=` - WhatsApp is the dominant sharing channel in Tunisia
  and deserves its own button, not just a slot in the native sheet.
- `https://www.facebook.com/sharer/sharer.php?u=` - desktop fallback.
- Download PNG (square and story) - the Instagram path.
- Copy link.

## Metric translation table

Every public number needs a defensible coefficient. These go in
`analytics/constants/sustainability.constants.ts` beside `BAG_IMPACT` and are
covered by the ESG claims test.

| Displayed                                 | Formula                              |
| ----------------------------------------- | ------------------------------------ |
| **Customers served**                      | count of distinct `Order.customerId` |
| Meals recovered                           | `foodKg * MEALS_PER_KG` (exists)     |
| **People helped (estimated)**             | `customersServed + totalFundedItems` |
| Family-days of food                       | `meals / 12` (4 people x 3 meals)    |
| Showers of water                          | `waterLiters / 65`                   |
| Days of a car off the road                | `carKmEquivalent / 40`               |
| School kits funded                        | `fundTnd_CHILDREN_STUDIES / 25`      |
| T-shirts / pants / shoes / medicine packs | `/ 10`, `/ 15`, `/ 20`, `/ 5`        |

**Customers served is a count, not an estimate.** Distinct `customerId` on
orders in `PICKED_UP` or `COMPLETED`, matching the status filter every other
impact aggregation already uses. It is the only unqualified number on this
table, which is exactly why it is worth promoting.

**People helped** is stated as: _each customer counted once regardless of how
many times they ordered, plus one person per item the merchant's sales funded._
The formula must be printed on the public page next to the number, not buried in
a methodology link. Two rules follow: no double counting of repeat customers,
and the label always carries "estimated". If either is dropped the number stops
being defensible, and `__tests__/seo/esg-claims.test.ts` is the gate.

**"Family-days", not "families fed".** A merchant posting "I fed 40 families"
when the number means 40 family-days is a false claim we handed them. Label the
unit on the card.

## Rankings: progress over position

Public surfaces show **movement**, not standing:

- "Most improved in Ariana this month" - ranked by `growthPct`, top 5
- "+4 places this month" on a merchant's own profile, only when positive
- Trend arrow over the last 3 months on the merchant dashboard

Never public: a merchant's absolute rank when it is below the cohort median, any
"last place" framing, or a full ordered list of everyone. The merchant's own
absolute position is visible **only to them**, in the dashboard, alongside what
would move them up.

`placesGained` and `growthPct` are null in a merchant's first month. Render
"first month, no comparison yet", never 0%.

Cohorts are city + category, with a **minimum cohort size of 5** before any
ranking renders publicly. Below that, "most improved" identifies a merchant by
elimination and the cohort size itself tells a competitor how thin the network
is in that segment.

## Featured Partner programme

Distinct from Business of the Month, and the distinction has to hold in the
product or both awards lose meaning:

|               | Business of the Month              | Featured Partner                                                 |
| ------------- | ---------------------------------- | ---------------------------------------------------------------- |
| Chosen by     | algorithm, published criteria      | Too Fresh To Waste editorial                                     |
| Cadence       | monthly, one per city+category     | any time, no quota                                               |
| Basis         | measured performance               | story, quality, novelty, local relevance                         |
| Public reason | the criteria                       | `editorialNote`, written per pick                                |
| Surfaces      | profile badge, share card, sticker | homepage placement, social posts, push notification, in-app feed |

Featured Partner is the lever for merchants who will never top a metric: the
tiny bakery with a good story, a new city's first partner, a merchant doing
something worth copying. That reach is the reward, and it costs nothing but
editorial attention.

**It is an operational commitment, not a feature.** A curated programme needs a
named owner and a weekly slot. Merchants notice being dropped, so a programme
that runs for three weeks and stops is worse than one never launched. Do not
ship it until that owner exists.

Admin surface required: pick a merchant, write the note, choose the placements,
schedule. Push notification to consumers must respect the existing notification
preferences and locale - a Featured Partner push is marketing, and marketing
sent to a merchant or a user who opted out is a complaint, not reach.

## Performance

The direct answer: **no measurable slowdown, provided card data comes from a
frozen snapshot and images render on Vercel edge.** Specifically:

- Snapshot read is one indexed `findOne`. No `orders` aggregation on any public
  path. This matters because Facebook, WhatsApp and Instagram crawlers hit an OG
  URL repeatedly and unauthenticated - a popular post would otherwise fire
  hundreds of full-collection aggregations at Render.
- Card images render through `next/og` on Vercel edge and never touch the NestJS
  process. Served `Cache-Control: public, max-age=31536000, immutable`, which is
  only safe _because_ snapshots are immutable.
- Public profile: ISR 3600 plus a Redis cache keyed by slug only. Never key any
  cache by viewer - CLAUDE.md, `CachedOfferPage`.
- Ledger: one `$match` + `$group` on the new `{ merchantId, contributedAt }`
  index, folded into the existing dashboard query with a `staleTime`. No extra
  request on dashboard mount.
- **Do not add image or PDF rendering to the API process.** Related existing
  risk worth recording: `pdf-report.service.ts` runs CPU-bound `pdf-lib` work
  inside the API process under PM2 cluster mode, so each report blocks that
  worker's event loop. Acceptable at current volume; it is the wrong place to
  add more.
- **Customers served is the most expensive metric on the page.** Every other
  impact number is a `$sum` that an index can feed; distinct customers needs a
  `$group` on `customerId` before it can be counted, so the working set is
  proportional to the merchant's distinct buyers rather than to one accumulator.
  It is fine on the profile because the profile is ISR-cached and snapshot-fed.
  It is **not** fine to compute per request, per card render, or inside the
  nightly ranking job without a covering index on
  `{ merchantId: 1, status: 1, customerId: 1 }`.
- Rankings (Phase 3) must be a nightly materialized collection, never a live
  aggregation across all orders per request. With customers served in the cohort
  payload this stops being optional.

## Technical blockers found before coding

Seven, all resolvable, none discovered after work started. Each has a decided
resolution so implementation does not have to improvise.

**1. `OrderCompletedEvent` has `merchantId` but not `establishmentId`, and it
travels over RabbitMQ.** Good news first: `merchantId` is already on the event
(`common/events/order.events.ts:16`), so half the attribution needs no contract
change, and there is exactly **one** caller of `createDonation`
(`donations/listeners/order-events.listener.ts:82`). The problem is
`establishmentId`, which is not on the event. Adding a required field breaks
in-flight messages across a deploy: `handleOrderCompletedRabbitMQ` Nacks with
requeue, so an old-shape message would loop. Resolution: add it as an
**optional** trailing field, and have the listener fall back to a single order
lookup when it is absent. A missing field must never drop a donation.

**2. Web `apiClient` cannot serve the public pages.** It sets
`withCredentials: true`, imports `useAuthStore`, and carries the refresh mutex
and 401 interceptor (`lib/api-client.ts`). Importing it into a server component
or an edge OG route drags the whole auth chain into that bundle, which is the
exact failure `.claude/rules/performance.md` rule 5 describes. Resolution: a
separate minimal `lib/public-api.ts` using `fetch`, no cookies, no interceptors.

**3. `NEXT_PUBLIC_API_URL` may be relative.** In proxy mode it is `/api/v1`,
which resolves in a browser and **not** in server or edge code. Every public
page and card renderer runs server-side. Resolution: resolve an absolute origin
for server use, falling back to the backend origin the config already keeps for
Socket.IO and media. This must be settled before the first fetch is written, or
it fails only in the proxy-mode deployment and passes everywhere locally.

**4. The global throttler will break link previews.** Default is 100 requests
per 60s per IP (`app.module.ts:71-84`). Facebook, WhatsApp and Instagram crawl
from narrow IP ranges, so a single popular share can 429 the OG endpoint and the
preview silently renders blank. Resolution: `@SkipThrottle()` or a high explicit
`@Throttle` on the two public read endpoints, plus long CDN caching. The mint
endpoint keeps a tight per-merchant limit - it writes.

**5. No slug library, and names are in three scripts.** Nothing in
`common/utils/` slugifies, and a naive `[a-z0-9-]` filter turns an Arabic-only
establishment name into an empty string, which then collides with every other
Arabic name. Resolution: pinned `slugify` with locale-aware transliteration,
plus a mandatory non-empty fallback (`<type>-<city>-<short-id>`) and a
uniqueness retry. Test with an Arabic name, a French accented name, and two
identical names in one city.

**6. The sitemap is a hand-maintained static list** (`app/sitemap.ts`), guarded
by `__tests__/seo/sitemap-routes.test.ts`. Per-merchant profiles are dynamic, so
the sitemap gains a fetched segment. Resolution: append approved establishments
at build/revalidate time, and extend the guard test to assert the dynamic
segment's shape rather than a fixed list. Per `.claude/rules/seo.md` rule 5, the
sitemap may only advertise routes that exist - a suspended or deleted merchant
must drop out of it.

**7. `verify:indexes:strict` is a CI gate.** Every index in this spec must be
declared on its schema and applied with `db:create-indexes`. Two traps already
documented in CLAUDE.md apply directly here: never mix `sparse` with
`partialFilterExpression` (the `publicSlug` index), and `required: true` does
nothing for existing documents - `foundingPartnerAt`, `merchantId` and
`establishmentId` on stored records exist only after their migrations run.

## Tasks and acceptance

### P0 - Phase 1: the keystone

- [ ] `UserDonation` gains `merchantId` + `establishmentId`;
      `CreateDonationInput` and all callers updated - a new order writes both
- [ ] **Backfill migration for historical donations - mandatory, ships with the
      ledger or the ledger does not ship.** Acceptance: an established merchant
      with pre-existing orders opens the dashboard on launch day and sees their
      real historical figure, not zero. Dry-run count first, idempotent, and
      re-runnable. This is a release gate, not a follow-up task
- [ ] `Establishment.publicSlug` + unique partial index + backfill - every
      approved establishment resolves at a unique slug
- [ ] `GET /sustainability/fund-ledger` - returns TND and per-category item
      counts for the caller only, verified against a hand-computed fixture
- [ ] Fund ledger card in the merchant dashboard, 3 locales, empty + loading +
      error states - a merchant with zero orders sees a real empty state, not 0s
- [ ] `MerchantImpactSnapshot` collection + idempotent mint endpoint - minting
      twice for the same month returns the same slug
- [ ] `customersServed` aggregation (distinct `customerId`, same status filter
      as every other impact metric) - verified against a fixture with repeat
      customers, so a buyer with 5 orders counts once
- [ ] `Establishment.foundingPartnerAt` + migration setting it for every
      establishment approved and active on or before 2026-12-31. Acceptance: the
      migration is idempotent, and a second run never writes the field twice or
      moves an existing value
- [ ] Founding Partner recognition package: permanent profile badge, dedicated
      share card design, founding-partner window sticker, and a queryable cohort
      (`foundingPartnerAt != null`) for future campaigns. Copy is "Founding
      Partner 2026" in en / fr / ar
- [ ] Public profile endpoint honouring all four visibility states, returning
      customers served (>= 50 floor), people helped, partner since, founding
      partner, and testimonials
- [ ] Testimonials selection: `status: APPROVED` only, 3 max, 3-star and above,
      first name + initial - a `PENDING` or `HIDDEN` review must be provably
      unreachable from the public payload
- [ ] `(marketing)/m/[slug]` profile page, ISR, sitemap entry, 3 locales + RTL,
      with the people-helped formula printed beside the number
- [ ] `(marketing)/impact/[slug]` share landing with offers + app CTA
- [ ] Square + story + OG card renderers, 3 locales, Arabic renders with the
      vendored font - visual check in all three, not only English
- [ ] Share sheet: native share, WhatsApp, Facebook, download PNG, copy link
- [ ] First-sale celebration triggers a snapshot + share prompt
- [ ] Printable window sticker and shelf card PDF - stays in P0, confirmed
      2026-09-05. Must render for a merchant with zero sales
- [ ] Founding Partner variant of the sticker for the early cohort

### P1 - Phase 2

- [ ] Milestone snapshots on two axes, fired once each and idempotent (a
      merchant crossing a threshold twice through refunds gets one card): bags
      at 10 / 50 / 100 / 500, **customers served at 50 / 100 / 500 / 1000**
- [ ] Monthly recap generated on the 1st, notification in-app + email
- [ ] Rankings **deferred to P2** - they cannot compute before a baseline month

### P2 - Phase 3

- [ ] `MerchantRankingSnapshot`, materialized nightly, city + category cohorts,
      minimum cohort size 5
- [ ] Progress surfaces: "most improved" top 5 public, places gained when
      positive, 3-month trend private. First month renders "no comparison yet",
      never 0%
- [ ] Business of the Month: algorithmic, criteria published before the month
      starts, unique per cohort per month
- [ ] Featured Partner: admin curation surface, `editorialNote`, placement
      scheduling, push respecting notification preferences and locale. **Blocked
      on a named editorial owner**
- [ ] Public badges on profile for both award kinds, visually distinguishable
- [ ] Sticker and printable asset pack for winners of both programmes

### P3 - Phase 4

- [ ] Annual certificate PDF with a `/verify/<id>` public resolution page

## Decisions

- **2026-09-05** - Snapshots are permanent, not TTL'd. Reverses an earlier
  suggestion in conversation to expire them. Reason: a snapshot is the target of
  a public post that may outlive any TTL, and deleting it breaks a live link the
  merchant published. Storage cost is negligible; a broken link is not.
- **2026-09-05** - Merchant attribution is denormalized onto `UserDonation`
  rather than `$lookup`-ed from `orders` at read time. Reason: the ledger sits
  on the dashboard hot path. Cost: a backfill migration and two extra fields per
  donation record.
- **2026-09-05** - A lapsed subscription hides live offers but keeps the public
  impact profile. Reason: the profile is the retention hook; deleting it
  punishes the merchant we are trying to win back and breaks inbound links we
  asked them to publish.
- **2026-09-05** - Card copy says "your sales funded", never "you donated". The
  contribution comes from the platform margin.
- **2026-09-05** - Hero metric is never CO2. Meals and funded items first.
- **2026-09-05** - Historical donation backfill is **mandatory and a release
  gate** for the ledger. Resolves the previously open question. Reason: an
  established merchant seeing zero on launch day reads the feature as broken,
  and a first impression of "broken" is not recoverable by a later migration.
- **2026-09-05** - Hero priority revised to: meals > customers served > funded
  items > bags > environmental. Supersedes the 2026-09-05 entry above, which
  omitted customers served.
- **2026-09-05** - Customers served is promoted to a first-class metric on
  profile, cards and milestones. Reason: it is the only counted fact among
  otherwise coefficient-derived estimates, it doubles as consumer social proof,
  and merchants have real intuition for it. Constraints: distinct customers
  only, and a public floor of 50.
- **2026-09-05** - `foundingPartnerAt` is persisted, not derived from rank.
  Reason: a derived "first 100" recomputes as records change, so a merchant
  could silently lose a status that was supposed to be permanent.
- **2026-09-05** - Rankings expose progress, not position. Public shows most
  improved and positive movement only; absolute rank is private to the merchant.
  Reason: position is only winnable by the largest merchant in a cohort, and a
  public ranking that tells the bottom half they are losing is a churn feature.
- **2026-09-05** - Featured Partner is a separate, curated, unconstrained award
  alongside the algorithmic Business of the Month. Reason: it is the only
  recognition available to a merchant who will never top a metric. Gated on a
  named editorial owner rather than on engineering readiness.
- **2026-09-05** - Testimonials on the public profile are `APPROVED` only,
  capped at 3, 3-star and above, first name plus initial. The honest aggregate
  rating and review count stay visible alongside, so the page is edited rather
  than misleading.
- **2026-09-05** - Window sticker and printable assets confirmed in P0.
- **2026-09-05 (approved)** - **Founding Partner cutoff is a fixed date**: every
  establishment approved and active on or before **2026-12-31** qualifies.
  `foundingPartnerAt` is persisted permanently, never revoked, never recomputed
  from ranking. Public wording is **"Founding Partner 2026"** in all three
  locales. Rejected: first-N-merchants, because it changes when records are
  deleted and creates a signup race.
- **2026-09-05 (approved)** - **Founding Partner is a recognition package, not a
  flag**: permanent public profile badge, a dedicated Founding Partner share
  card design, a founding-partner window sticker and printable asset, and
  eligibility for a future Founding Partner collection or campaign. The campaign
  hook is a data requirement now (the cohort must be queryable), not a P0
  deliverable.
- **2026-09-05 (approved)** - **Customers served public floor stays at 50.**
  Below 50 the count is not exposed publicly at all and the hero metric falls
  through to the next eligible one in priority order. At 50+ the exact distinct
  completed-order customer count is shown. Never rounded, never inflated. The
  precise value is always visible in the merchant dashboard regardless of floor.

## Open questions

**Blocking for P0:** none. Both prior blockers were resolved on 2026-09-05 and
are recorded in Decisions.

**Blocking for P2 only:**

- Who signs off Business of the Month criteria, and are they published before
  the month starts?
- Who is the named editorial owner of Featured Partner, and at what cadence?

**Non-blocking:**

- Print budget and fulfilment path for physical stickers in Tunisia.
- Whether the profile URL gets a short domain for the on-card text.
- Whether repeat-customer rate ("X regulars came back") is worth a public slot
  once customers served is established.
