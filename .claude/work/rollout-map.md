---
status: done
scope: cross-app
gate:
  pnpm --filter @foodwaste/backend check:ts && pnpm --filter @foodwaste/backend
  test:db && pnpm --filter @foodwaste/web type-check
---

## Intent

A public rollout map that turns "we are not in your city yet" from the most
disappointing state on the site into the most motivating one. Admin pins which
city is live and which is unlocking next; every other announced city is ranked
by how many people are waiting for it, so the published order moves on its own
as sign-ups land. Plus `/dream`, the page carrying the argument the homepage has
no room for.

## Constraints

- No user-facing text crosses the API boundary; the client owns all copy in
  en/fr/ar.
- No invented figures. Where there is nothing to report the UI shows a dash or
  hides the element — never a zero presented as a fact.
- Admin controls the map through the geozone screen that already exists. No new
  admin surface.

## What shipped

- `GET /public/impact`, `GET /public/geozones`, `POST /public/waitlist`
  (`src/public/`), all declared in the authorization matrix with why they may be
  anonymous.
- `Geozone` gains `foundingTarget`, `foundingSignedCount`, `launchedAt`.
- `RolloutMap` section + `/dream` page, en/fr/ar, RTL.
- `seed:geozones` and `migrate:waitlist-zone`, both dry-run by default.

## Decisions

- **The queue is demand, not a plan.** Admin pins `active` and the first
  `coming_soon`; everything else sorts by waiting count. There is deliberately
  no `launchOrder` field — adding one would let the roadmap be curated, which is
  the thing that makes roadmaps dead.
- **`inactive` means unpublished**, not "queued". Queued cities are
  `coming_soon` with `foundingTarget: 0`. Three statuses cover four display
  states because the client derives the role from position, not from the enum.
- **Catchments, not municipal boundaries.** Circles around real city centres.
  This is a pickup marketplace, so the question is whether a customer can
  collect before closing — a distance, not an administrative border. Drawing
  borders would have meant inventing data.
- **One waiting list.** The global pre-launch list and the per-city list share a
  collection, unique on `{ email, zone }` with a missing zone meaning global.
  Merged while there were no real users; it would not have been free later.

## Three bugs the real data found that the tests had not

Every one of these passed a green suite before production data existed. Recorded
because the pattern repeats: fixtures encode the case the author already had in
mind.

1. **Every `coming_soon` city claimed to be next.** The client derived its row
   treatment from `zone.status`, so a queue of announced cities showed several
   raised cards and several progress meters. The existing test counted the
   panel, which is rendered outside the loop and was always singular — it looked
   like coverage. Fixed by computing an explicit display role from server order.

2. **The city with the unlock campaign sorted fourth.** Announced cities were
   separated only by waiting counts, which are all zero the day a rollout is
   published, so the name tiebreaker decided: Gabès took second place and would
   have been announced as "unlocking next" with no meter. A founding target now
   sorts above the merely announced. The unit fixtures never caught it because
   they gave every queued city a _different_ waiting count.

3. **Attribution by city string lost 73% of the data.** `address.city` was
   compared to the zone name lowercased. "Gabès" never equalled "Gabes", a shop
   filed as "Sousse Ville" matched nothing, an Arabic spelling matched nothing.
   Now `$geoWithin` against the 2dsphere index on `address.coordinates` —
   MongoDB's own spherical geometry rather than a second, subtly different
   answer implemented here. The same membership replaced
   `Geozone.establishmentCount`, a denormalised counter nothing maintains, which
   would have shown every city as having zero partners.

## The public bag total was 56% orphaned rows

Diagnosing (3) surfaced something larger: 47 of 141 fulfilled orders pointed at
establishments that no longer exist — 868 of 1550 bags on the homepage, from
April–June 2026, every one titled "Delicious Surprise Bag" (the create-panel
default). Merchant records had been cleaned up; their orders had not.

Decided with the user: the total counts orders whose establishment **still
exists**, not whether it is currently active — a merchant suspended this week
did not un-rescue food sold last month, and tying a public figure to `status`
makes it jump whenever an account is paused. 1550 → 682, which is also what the
rollout map sums to (416 in Sousse + 266 at approved shops in unopened cities).
Two views of the same data now reconcile.

The orphaned orders were left in place. Whether they are development leftovers
worth purging is a separate question from whether they belong in a marketing
number.

## Open

- `verify:indexes:strict` fails on pre-existing drift (1 missing, 3 mismatched,
  13 extra). None of it from this work; wants its own pass.
- Seeded polygons are placeholder catchments. Fine for the map, not for routing
  deliveries or geofencing.
- The 47 orphaned orders are still in the database.
