# SEO Standards & Keyword Strategy

Organic search is the cheapest acquisition channel this product has. Every
marketing route is an entry point, and a route without metadata is a route
Google titles for you.

---

## The honest targeting position

The bare head terms — **"food waste"**, **"waste management"**, **"green"**,
**"sustainability"** — are informational queries owned globally by UNEP, FAO,
the EPA, WRAP and Wikipedia. They carry decades of domain authority and
near-zero purchase intent. A Tunisian marketplace will not take them, and budget
spent chasing them returns nothing.

What is winnable, and worth owning completely:

| Cluster                               | Example queries                                                         | Where it lives                   |
| ------------------------------------- | ----------------------------------------------------------------------- | -------------------------------- |
| **Local commercial** (highest intent) | `anti gaspi Tunis`, `panier surprise Tunisie`, `أكل رخيص تونس`          | `/locations/*`                   |
| **Brand + comparison**                | `Too Good To Go Tunisie`, `application anti gaspillage Tunisie`         | `/`, `/consumer`                 |
| **Merchant acquisition**              | `vendre invendus restaurant`, `que faire des invendus`                  | `/business-signup`, `/companies` |
| **Informational long-tail**           | `combien de nourriture gaspillée en Tunisie`, `how much food is wasted` | `/food-waste-facts`, `/blog/*`   |
| **ESG / corporate**                   | `réduction gaspillage alimentaire entreprise`, `RSE Tunisie`            | `/esg`, `/companies`             |

The strategy is **topical authority through the local angle**: rank for the
Tunisia × food-waste intersection first, let that build domain authority, then
push outward into the broader informational cluster. Head terms are an outcome
of authority, never an input.

---

## Non-negotiables

1. **Every indexable page exports metadata.** Use `buildPageMetadata` /
   `buildLocalizedPageMetadata` from `@/lib/seo-metadata`. It emits canonical +
   all three hreflang alternates + `x-default` + Open Graph in one call.
2. **A `'use client'` page cannot export metadata.** Add a co-located server
   `layout.tsx` that exports `generateMetadata` and returns `children`. See
   `(marketing)/careers/layout.tsx`.
3. **Private areas carry `NOINDEX_METADATA`.** `robots.txt` only asks a crawler
   not to fetch; it does not prevent indexing of a URL something links to.
   `noindex` is the binding instruction — private route groups need both.
4. **Routes are locale-prefixed, so robots.txt rules must be too.** `/admin/`
   never matches the real URL `/en/admin/dashboard`. Use the `/*/admin` form.
5. **The sitemap may only advertise routes that exist.** Drive it from the same
   module the route renders from. A sitemap full of soft-404s costs crawl budget
   and trust. Guarded by `__tests__/seo/sitemap-routes.test.ts`.
6. **Structured data must describe what is actually on the page.** The homepage
   `FAQPage` schema reads the same translation keys `Section5` renders. Schema
   that describes invisible content gets the rich result revoked.
7. **Never emit `LocalBusiness` for a city we have no premises in.** We are a
   marketplace, not a branch. Use `Service` + `areaServed` (see
   `service-area-schema.tsx`). Inventing addresses is a manual-action risk.
8. **Meta descriptions ≤ ~160 chars (en/fr).** Past that Google truncates and
   the click-through pitch is wasted. Arabic is measured by pixel width, not
   code points, and is exempt from the character cap.
9. **City pages must stay genuinely differentiated.** Templated near-duplicates
   are doorway pages, which Google demotes. Each needs real local context,
   neighbourhoods and FAQs.
10. **New page → add it to the sitemap and link it internally.** A sitemap entry
    alone leaves a page orphaned; internal links are what pass authority.

---

## The multilingual trap

Three locales means every page exists three times. Without complete
`alternates.languages` covering `en`, `fr-TN`, `ar-TN` **and** `x-default`,
Google treats them as duplicates competing against each other and picks one
arbitrarily. This is the single most expensive technical mistake available on
this site — which is why the block lives in exactly one function.

French is the primary commercial language for Tunisian search volume; Arabic
carries growing mobile volume; English is the smallest of the three. Write
French copy first and translate outward, not the reverse.

---

## Roadmap — highest leverage first

Ordered by expected return, not effort:

1. **Blog cadence on the informational cluster.** Five posts exist. This is the
   only lever that builds authority for the broader terms. Target one post per
   week against long-tail questions with real search volume: _"que faire des
   invendus de boulangerie"_, _"combien de pain jeté en Tunisie"_, _"réduire le
   gaspillage alimentaire à la maison"_. Answer the question in the first
   paragraph — that block is what gets lifted into a featured snippet.
2. **Neighbourhood pages, but only where there is real content.**
   `/locations/ tunis/lac` is worth building when it has genuinely distinct
   partner density and copy. Generating one per neighbourhood mechanically would
   tip the whole cluster into doorway-page territory and risk what already
   works.
3. **Merchant-side content.** `vendre invendus` queries convert to supply, and
   supply is what makes the consumer side rank and retain. Underweighted today.
4. **Backlinks from Tunisian media and ESG directories.** Domain authority is
   the binding constraint on everything above. A handful of links from Tunisian
   press, university sustainability pages and startup directories moves more
   than any on-page change left to make.
5. **Real reviews with `AggregateRating`.** Only once genuine reviews exist —
   fabricated review markup is a manual action, not a shortcut.

---

## Verification

```bash
pnpm --filter @foodwaste/web type-check
pnpm --filter @foodwaste/web test          # includes __tests__/seo
pnpm --filter @foodwaste/web build         # confirms routes prerender
```

After deploying, validate externally:

- `https://toofreshtowaste.com/sitemap.xml` — every URL returns 200
- `https://toofreshtowaste.com/robots.txt` — private paths disallowed
- Google Rich Results Test — on `/`, `/locations/tunis`, `/food-waste-facts`
- Search Console → Coverage — soft-404 count should be 0
