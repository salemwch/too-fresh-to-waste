# Global SEO Strategy — Too Fresh To Waste

**Date:** 2026-05-02  
**Status:** Approved  
**Markets:** Tunisia, Morocco, Algeria, UAE, Saudi Arabia → Global  
**Languages:** Arabic (ar-TN, ar-MA, ar-DZ, ar-SA, ar-AE), French (fr-TN, fr-MA,
fr-DZ), English (en)  
**Goal:** Dominate organic search for food waste, sustainability, charity,
rewards, and food topics across MENA — and grow globally.

---

## Context

The platform is live but brand new with zero domain authority and zero organic
traffic. The technical SEO foundation (metadata, sitemap, robots, hreflang) is
partially in place. Critical gaps: no JSON-LD structured data, no blog/content
section, missing OG image, Tunisia-only focus.

**Strategy:** Pillar-Cluster content architecture (Approach B) + Viral Milestone
content layered on top. Zero paid PR budget — all authority built through unique
platform data, real human impact stories, and AI-generated + human-reviewed
content.

---

## Section 1 — Technical SEO Foundation

### 1.1 JSON-LD Structured Data

Add schema markup to every page type. This is the single highest-leverage
technical change.

| Page                  | Schema Type                                      | Notes                                                                                      |
| --------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Homepage              | `Organization` + `WebSite` + `SearchAction`      | Safe, well-supported, unlocks sitelinks search box                                         |
| Blog articles         | `Article` + `BreadcrumbList` + `Person` (author) | Standard; author `Person` is required for E-E-A-T signals                                  |
| Pillar pages          | `Article` + `FAQPage`                            | FAQPage only if ≥3 real Q&A pairs exist on the page                                        |
| Marketplace/app page  | `SoftwareApplication` + `WebPage`                | No `AggregateRating` until legitimate review data exists — fake or premature ratings hurt  |
| Humanity/ESG pages    | `Organization` + `DonateAction`                  | `NGO` is a valid schema.org type but poorly supported by Google; `Organization` is safer   |
| Milestone event pages | `NewsArticle` + `Event`                          | `Event` only when a milestone has a real date and location (e.g. award ceremony)           |
| Country landing pages | `WebPage` + `Organization`                       | No `LocalBusiness` unless a real local office/address exists for that country              |
| Competition pages     | `ItemList` + `Event`                             | `Contest` has minimal Google support; `Event` + `ItemList` for winner lists is safer       |
| Impact reports        | `Dataset` + `NewsArticle`                        | `Dataset` requires a real data download or API — add only once backend contract is defined |
| About/contact pages   | `AboutPage` / `ContactPage`                      | Low effort, signals site completeness to crawlers                                          |

Implementation: reusable React components (`<OrganizationSchema />`,
`<ArticleSchema />`, etc.) that render `<script type="application/ld+json">` in
`<head>`. Props-driven, typed with TypeScript. Each page imports and composes
the schemas it needs.

### 1.2 OG Image Fix

`/public/images/og-image.jpg` is missing — every shared link shows a blank card.

- Create static branded 1200×630px fallback image
- Add dynamic OG image generation via Next.js `ImageResponse` at
  `app/[locale]/opengraph-image.tsx`
- Blog articles and milestone pages get article-specific OG images (title +
  category + brand)
- Arabic OG images use RTL layout

### 1.3 Sitemap Upgrade

Extend `app/sitemap.ts` to cover:

- All blog articles (auto-added on MDX file creation via `fs.readdirSync`)
- All 8 pillar pages
- All milestone event pages
- All country landing pages
- All author bio pages
- `lastmod` from MDX frontmatter `updatedAt` field
- Priority scores: Homepage 1.0, Pillars 0.9, Blog 0.8, Country pages 0.8,
  Milestone 0.9

### 1.4 Core Web Vitals

| Fix                        | Target metric   | Implementation                                                                                                                                      |
| -------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero image preload         | LCP             | `priority` prop on homepage `<Image>` + `<link rel="preload">`                                                                                      |
| Arabic font subsetting     | LCP + load time | Use `next/font/local` with `preload: true` + run `pyftsubset` (fonttools) to strip unused glyphs from the TTF before committing to `/public/fonts/` |
| Blog image CLS elimination | CLS             | Explicit `width`/`height` on all `<Image>` in articles                                                                                              |
| Lazy load below fold       | INP             | `loading="lazy"` audit on all non-hero images                                                                                                       |

### 1.5 Bing Webmaster Tools

Submit `sitemap.xml` to Bing Webmaster Tools (free, covers Bing + DuckDuckGo +
Yahoo). 10-minute task, captures secondary search engine traffic across MENA
markets.

---

## Section 2 — Content Architecture

### 2.1 Blog Route

New route group inside existing `(marketing)` group:

```
app/[locale]/(marketing)/blog/
  page.tsx                    → Hub: all articles, filterable by topic/language
  [slug]/page.tsx             → Individual article (generateStaticParams from MDX)
  category/[category]/page.tsx → Category archive
  author/[author]/page.tsx    → Author bio + article list (E-E-A-T anchor)
  tag/[tag]/page.tsx          → Tag archive
```

**Content storage:** MDX files in `/content/blog/[locale]/[slug].mdx`

```
content/
  blog/
    en/
      food-waste-ramadan-guide.mdx
      what-is-a-surprise-bag.mdx
    fr/
      gaspillage-alimentaire-ramadan-tunisie.mdx
    ar/
      هدر-الطعام-رمضان.mdx
```

**MDX frontmatter schema:**

```yaml
---
title: 'string'
description: 'string (max 155 chars)'
author: 'author-slug'
publishedAt: '2026-05-15'
updatedAt: '2026-05-15'
locale: 'en | fr | ar'
hreflang:
  en: 'what-is-a-surprise-bag'
  fr: 'quest-ce-quun-surprise-bag'
  ar: 'ما-هي-حقيبة-المفاجأة'
category: 'food-waste | sustainability | charity | business | rewards | food'
tags: ['string']
pillar: 'pillar-slug' # links article to its parent pillar
readTime: 7 # minutes
ogImage: '/images/blog/slug.jpg'
featured: false
---
```

Pages are statically generated at build time via `generateStaticParams`. No
database needed.

**Content model — explicit decision:** One master article per language (EN, FR,
AR). Content is **not** fully localized per country-market. The same French
article serves fr-TN, fr-MA, and fr-DZ. The same Arabic article serves ar-TN,
ar-MA, ar-DZ, ar-SA, and ar-AE. Country-specific adaptation happens only in:

- Meta description (swap city/country name)
- hreflang alternate links (per-country targets)
- Internal links (country pages link to market-specific anchors)

A fully per-country content model (e.g. a separate article for Tunisia vs
Morocco in French) is out of scope until traffic data justifies the investment.
Canonical URL for translated articles always points to the language-primary URL
(`/fr/blog/[slug]`), not a country variant.

### 2.2 The 8 Pillar Pages

Standalone marketing pages — not blog posts. 3,000+ words each. Updated
quarterly with fresh data. Live at top-level routes inside `(marketing)`:

| #   | Pillar                                | Route                          | Primary Locale | Target Market  |
| --- | ------------------------------------- | ------------------------------ | -------------- | -------------- |
| 1   | Food Waste in MENA                    | `/food-waste-mena`             | EN + AR + FR   | Regional       |
| 2   | Sustainable Eating Guide              | `/sustainable-eating`          | FR + AR        | Maghreb        |
| 3   | Food Donations & Charity North Africa | `/food-donations-north-africa` | FR + AR + EN   | Maghreb + Gulf |
| 4   | ESG for Restaurants                   | `/esg-restaurants`             | EN + FR        | Gulf + Tunisia |
| 5   | Surprise Bag Complete Guide           | `/surprise-bag-guide`          | AR + FR + EN   | All markets    |
| 6   | Zero Hunger North Africa              | `/zero-hunger`                 | AR + FR        | Maghreb + Gulf |
| 7   | Food Rewards & Loyalty Apps           | `/food-rewards-apps`           | EN + AR        | Gulf           |
| 8   | Food Carbon Footprint Guide           | `/food-carbon-footprint`       | EN + FR + AR   | Global         |

Each pillar includes:

- FAQPage JSON-LD (10+ Q&A pairs targeting long-tail questions)
- Table of contents with anchor links
- Internal links to 10-15 cluster articles
- Real citations (FAO, WHO, World Bank data)
- CTA to app download / merchant signup

### 2.3 Archive Pages — Thin Content Protection

Blog archive pages (category, tag, author) can become low-value crawl traps if
indexed before enough content exists. Rules:

| Archive type                        | Default                    | Indexable when                                                                                  |
| ----------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------- |
| Tag archives                        | `noindex, nofollow` always | Never indexed — tags are internal navigation only                                               |
| Category archives                   | `noindex` until threshold  | Index only when ≥8 published articles in that category                                          |
| Author pages                        | `noindex` until threshold  | Index only when author has ≥3 published articles AND a complete bio (photo, title, credentials) |
| Blog hub (`/blog`)                  | Always indexed             | From day 1 — even 1 article is enough                                                           |
| Paginated archives (`/blog?page=2`) | Canonical to page 1        | Never independently indexed; use `rel="next"` / `rel="prev"`                                    |

These rules are enforced via `generateMetadata` per route — not via robots.txt,
so individual pages can be promoted once they meet threshold without a config
change.

### 2.4 E-E-A-T Infrastructure

**Author pages** at `/blog/author/[slug]`:

- Full name + professional photo
- Title + credentials (e.g., "Food Systems Researcher", "Sustainability
  Consultant")
- 2-3 sentence bio with specific expertise signals
- Institution/affiliation if available
- Links to all published articles
- `Person` JSON-LD schema with `sameAs` links to LinkedIn

**Per-article trust signals:**

- Author byline with photo + credentials
- `publishedAt` + `updatedAt` dates (always visible)
- Sources cited with external links (FAO, World Bank, UNEP)
- Article reviewed badge for high-stakes health/nutrition content

**Author strategy:** AI drafts → named human expert (team member, NGO partner,
guest researcher) reviews, edits, and publishes under their real byline. Minimum
1 real author per pillar.

### 2.5 Content Calendar

| Phase         | Duration  | Output                                                                                      | Notes                                                                                       |
| ------------- | --------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Foundation    | Month 1-2 | 8 pillars × 3 locales = 24 pieces                                                           | Human review mandatory on every piece                                                       |
| Cluster Build | Month 2-4 | Target: up to 1 cluster/pillar/week across locales                                          | Actual velocity depends on review queue capacity — do not publish without reviewer sign-off |
| Scale         | Month 4-6 | Up to 60 articles/month — only once review pipeline, translation process, and QA are proven | This is a ceiling, not a commitment. Quality gates override volume targets.                 |
| Viral Layer   | Month 3+  | Milestone + impact + competition pages                                                      | Triggered by real platform events only — no speculative publishing                          |

**Editorial quality gate (non-negotiable):** No article ships without a named
human reviewer sign-off, regardless of pipeline speed. A published article with
a factual error or keyword-stuffed AI prose causes more SEO damage than a missed
publish date.

---

## Section 3 — Keyword Strategy

### 3.1 Maghreb Markets (FR + AR)

**French clusters (Tunisia, Morocco, Algeria):**

- `gaspillage alimentaire [country]` — food waste + country
- `application alimentation durable` — sustainable food app
- `réduire déchets alimentaires restaurant` — reduce restaurant food waste
- `don alimentaire [city]` — food donation + city
- `manger moins cher [city]` — eat cheaper + city
- `programme fidélité restaurant` — restaurant loyalty program
- `alimentation durable Maghreb` — sustainable food Maghreb
- `ESG restoration Tunisie/Maroc` — ESG food business

**Arabic clusters (Maghreb dialect-aware):**

- `هدر الطعام [country]` — food waste
- `تطبيق طعام مستدام` — sustainable food app
- `تبرعات الطعام [country]` — food donations
- `توفير المال على الطعام` — saving money on food
- `برنامج مكافآت المطاعم` — restaurant rewards
- `الاستدامة الغذائية` — food sustainability

### 3.2 Gulf Markets (AR + EN)

**English clusters (UAE, Saudi Arabia):**

- `food waste app Dubai / Riyadh / UAE / Saudi Arabia`
- `sustainable food platform Middle East`
- `ESG compliance food business Gulf`
- `surprise bag food app MENA`
- `food charity app UAE`
- `restaurant loyalty rewards app Gulf`
- `win smartphone food app` ← unique to competition
- `food waste statistics Saudi Arabia`

**Arabic clusters (Gulf MSA):**

- `هدر الطعام الإمارات / السعودية`
- `تطبيق مستدام دبي / الرياض`
- `الامتثال البيئي للمطاعم الخليج`
- `برنامج ولاء الطعام الإمارات`
- `تبرع الطعام الإمارات`

### 3.3 Global English Long-Tail

Target broad informational searches with zero geographic constraint:

```
"what happens to unsold restaurant food"
"how do surprise bags work"
"food waste CO2 impact statistics"
"apps that fight food waste"
"restaurants that donate food to charity"
"how to reduce food waste at home"
"food waste and hunger connection"
"loyalty rewards food app comparison"
"win phone from food app competition"
"food waste during Ramadan"
"sustainable food startup Africa"
"food waste charity 5 percent donation"
```

### 3.4 Semantic Cluster Example (Pillar 1)

```
Pillar: "Food Waste in MENA"
  ├── What percentage of food is wasted in Tunisia?
  ├── Top 10 causes of food waste in North Africa restaurants
  ├── How restaurants in Morocco reduce food waste profitably
  ├── Food waste laws and regulations in Algeria
  ├── Food waste vs hunger: the paradox in MENA
  ├── Food waste during Ramadan: the hidden crisis
  ├── CO₂ impact of food waste in the Middle East
  ├── How technology is solving food waste in Tunisia
  ├── Interview: Tunis restaurant owner on reducing waste
  ├── Food waste statistics: MENA vs Europe vs Asia
  ├── What is a surprise bag? (beginner explainer)
  ├── Food waste and children: teaching sustainability
  └── Food waste and the UN Sustainable Development Goals
```

### 3.5 Seasonal Content Calendar

| Event                    | Publish 3 weeks before | Target Keywords                                                 |
| ------------------------ | ---------------------- | --------------------------------------------------------------- |
| Ramadan                  | 3 weeks before start   | "food waste Ramadan", "iftar leftovers", "ramadan charity food" |
| Eid al-Adha              | 2 weeks before         | "meat waste Eid", "qurbani food donation"                       |
| World Food Day (Oct 16)  | Oct 1                  | "World Food Day 2026", "food waste awareness"                   |
| Earth Day (Apr 22)       | Apr 10                 | "Earth Day food waste", "sustainable eating challenge"          |
| Zero Hunger Day (Oct 16) | Oct 1                  | "Zero Hunger Day", "food insecurity MENA"                       |
| Back to School (Sep)     | Aug 20                 | "children food waste", "school lunch sustainability"            |

---

## Section 4 — Viral & Milestone Content System

**Rule: infrastructure built now, content published only when data is real.**

### 4.1 What Launches Day 1 (No Data Required)

- **Live impact counter** on homepage — real-time API data, starts at 0, grows
  honestly
  - Schema: `Dataset` JSON-LD with `measurementTechnique`
  - Displays: bags saved, kg CO₂ avoided, TND donated to charity
- **`/impact` hub page** — explains 5% charity mechanism, 4 humanitarian
  pillars, how impact is calculated. Evergreen content, no numbers needed.
- **`/competitions` landing page** — explains rewards program: 30k bag milestone
  trigger, consumer prizes (phones → smartwatches for top 5+5), business prizes
  (2 free sponsor days for top 10), max 4 cycles/year

### 4.2 Milestone Pages (Triggered at 30k, 60k, 90k, 120k bags)

Route: `/milestones/[milestone-slug]` (e.g., `/milestones/30000-bags-saved`)

Each page includes:

- Exact bags saved + timestamp
- CO₂ avoided (bags × 2.5kg)
- Total charity distributed (TND amount + which goals funded)
- Competition winner announcement (Top 5 phones, next 5 smartwatches, Top 10
  businesses)
- Winner stories with photos (opt-in consent required)
- Share-ready social copy pre-generated
- Schema: `NewsArticle` + `Event` + `ItemList`

### 4.3 Monthly Impact Reports (First Full Month of Real Orders)

Route: `/impact/[year]/[month]` (e.g., `/impact/2026/june`)

Content:

- Bags saved that month + cumulative total
- CO₂ avoided monthly + total
- Charity goal progress (item type, % funded, items distributed)
- Leaderboard snapshot (top 3 merchants, anonymous option respected)
- New users + merchants joined
- Schema: `Dataset` + `NewsArticle`

### 4.4 Competition Winner Pages (Post Each Cycle)

Route: `/competitions/cycle-[n]-winners`

Content:

- Winner profiles (name, tier achieved, bags saved count)
- Journey narrative (how they went from Bronze to Platinum)
- Prize photo/handoff moment
- Quote from winner
- Schema: `NewsArticle` + `Person` + `ItemList`

**SEO effect:** Winners share their page organically → free social backlinks.
Journalists covering sustainability/startups in MENA cite winner stories →
editorial backlinks.

### 4.5 Backend Data Contract (Hard Requirement)

No milestone, impact report, or competition winner page may be published unless
the backend provides a verified data payload meeting all of the following:

| Field                | Required for             | Contract rule                                                                            |
| -------------------- | ------------------------ | ---------------------------------------------------------------------------------------- |
| `totalBagsSaved`     | Milestone + impact pages | Exact integer from DB aggregate — not estimated                                          |
| `co2AvoidedKg`       | Milestone + impact pages | Derived from `totalBagsSaved × 2.5` — formula must be documented in backend              |
| `charityAmountTND`   | Milestone + impact pages | Sum of confirmed `DonationPool.distributed` records — not pending                        |
| `milestoneTimestamp` | Milestone pages          | UTC timestamp of when threshold was crossed, stored in DB                                |
| `winners[]`          | Competition pages        | Array of `{ userId, displayName, tier, bagsSaved, prizeType }` from leaderboard snapshot |
| `winnerConsentAt`    | Competition pages        | Each winner must have a stored consent timestamp before name/photo appears publicly      |
| `goalFunded[]`       | Impact reports           | Array of `{ goalType, itemCount, distributedAt }` from DonationPool records              |

**Publishing gate:** A backend endpoint
(`GET /api/v1/milestones/:id/publish-readiness`) must return `{ ready: true }` —
confirming all required fields are present, consent is recorded, and data is
final — before the page generation job runs. No editorial override of this gate.

---

## Section 5 — International SEO

### 5.1 hreflang Upgrade

**Current:** `en`, `fr`, `ar` — generic  
**Target:** Country-region variants

| Locale code | Market         | hreflang value       |
| ----------- | -------------- | -------------------- |
| `fr-TN`     | Tunisia French | `fr-TN`              |
| `fr-MA`     | Morocco French | `fr-MA`              |
| `fr-DZ`     | Algeria French | `fr-DZ`              |
| `ar-TN`     | Tunisia Arabic | `ar-TN`              |
| `ar-MA`     | Morocco Arabic | `ar-MA`              |
| `ar-DZ`     | Algeria Arabic | `ar-DZ`              |
| `ar-SA`     | Saudi Arabia   | `ar-SA`              |
| `ar-AE`     | UAE            | `ar-AE`              |
| `en`        | Global English | `en`                 |
| —           | Fallback       | `x-default` → `/en/` |

Update `apps/web/src/i18n/routing.ts` and `sitemap.ts` to emit country-region
alternate links.

### 5.2 Country Landing Pages

Route: `/[locale]/countries/[country-slug]`

One page per target market:

- `/en/countries/tunisia`, `/fr/countries/tunisie`, `/ar/countries/تونس`
- `/en/countries/morocco`, `/fr/countries/maroc`, `/ar/countries/المغرب`
- `/en/countries/algeria`, `/fr/countries/algerie`, `/ar/countries/الجزائر`
- `/en/countries/uae`, `/ar/countries/الإمارات`
- `/en/countries/saudi-arabia`, `/ar/countries/السعودية`

Each page contains:

- Local food waste statistics (FAO/World Bank sourced)
- Platform availability + how it works in that country
- Local restaurant partner showcase (when available)
- Local charity organizations supported
- Testimonials in local language
- `LocalBusiness` JSON-LD with country address
- Internal links to relevant pillar pages

### 5.3 Arabic SEO Rules

- Write keyword-targeted Arabic **without diacritics (tashkeel)** — matches how
  users actually search
- Use Modern Standard Arabic (MSA) for body content — understood across all
  markets
- Include Maghrebi darija terms as secondary keywords in meta descriptions for
  TN/MA/DZ pages
- Include Gulf dialect terms in meta descriptions for SA/UAE pages
- RTL layout already handled by next-intl — do not override `dir` attribute
  manually

### 5.4 Google Search Console Configuration

- Single GSC property for the domain (path-based i18n, not subdomain)
- Set geographic targeting per locale section in GSC International Targeting
  report
- Submit updated sitemap after each major content publish
- Monitor "Coverage" report weekly during first 6 months

### 5.5 Bing Webmaster Tools

Submit sitemap to Bing Webmaster Tools (free). Covers Bing + DuckDuckGo + Yahoo
simultaneously. Estimated additional traffic: 8-12% on top of Google in Gulf
markets.

---

## Section 6 — On-Page Optimization & Internal Linking

### 6.1 Existing Pages — Priority Tiers

**Tier 1 — Optimize immediately:**

| Page                        | Target Keyword                  | Missing                      |
| --------------------------- | ------------------------------- | ---------------------------- |
| Homepage                    | "food waste app Tunisia MENA"   | JSON-LD, OG image, LCP       |
| `/food-waste-facts`         | "food waste statistics MENA"    | FAQPage schema, citations    |
| `/humanity-mission`         | "food charity platform Tunisia" | NGO schema                   |
| `/esg`                      | "ESG food compliance MENA"      | Article schema, B2B keywords |
| `/consumer`                 | "save money food Tunisia"       | SoftwareApp schema, ratings  |
| `/marketplace-surprise-bag` | "surprise bag app Tunisia"      | Product schema, FAQ          |
| `/contact`                  | brand navigational              | LocalBusiness schema         |

**Tier 2 — Month 2:** `/careers`, `/companies`, `/mission-driven`  
**Tier 3 — Monitor only:** Auth routes, dashboard routes (no public SEO value)

### 6.2 Internal Linking Rules

Every page must receive links from ≥2 other pages. Every page must link to ≥1
pillar.

```
Homepage → all 8 pillars + /impact + /competitions
Pillar → 10-15 cluster articles + cross-links to 2-3 other pillars + 1 product CTA
Blog article → parent pillar (always) + 2-3 related articles + 1 product CTA
Country page → relevant pillar + homepage + signup
Milestone page → /competitions + /impact + homepage
```

**Anchor text rule:** Always descriptive and keyword-rich. Never "click here",
"read more", or "here".

### 6.3 URL Structure

```
✅ /en/blog/food-waste-ramadan-tunisia
✅ /fr/blog/gaspillage-alimentaire-ramadan-tunisie
✅ /ar/blog/هدر-الطعام-رمضان-تونس
✅ /en/milestones/30000-bags-saved
✅ /en/impact/2026/june
✅ /en/countries/morocco

❌ /blog/post-1234          (no locale prefix)
❌ /blog/article?id=45      (no keyword slug)
```

Note: `localePrefix: 'always'` in `i18n/routing.ts` means every URL has an
explicit locale segment. All internal links must include the locale prefix.

- Lowercase, hyphen-separated
- Keywords in URL (not IDs)
- No trailing slashes (already configured in next.config)
- Arabic blog URLs use transliterated slugs OR Arabic characters (both work; be
  consistent per locale)

### 6.4 Canonical URLs & Pagination

**Canonical rules — every page must declare its canonical explicitly via Next.js
`alternates.canonical` in `generateMetadata`:**

| Page type                                          | Canonical URL                   | Rationale                                                                                      |
| -------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------- |
| Blog article (EN)                                  | `/en/blog/[slug]`               | Language-primary URL is canonical                                                              |
| Blog article (FR)                                  | `/fr/blog/[slug]`               | Each language version is its own canonical — no cross-language canonical                       |
| Blog article (AR)                                  | `/ar/blog/[slug]`               | Same                                                                                           |
| Pillar page                                        | `/[locale]/[pillar-slug]`       | One canonical per locale; no cross-locale pointing                                             |
| Country page                                       | `/[locale]/countries/[country]` | Canonical to itself — country pages are distinct, not duplicates                               |
| Filtered blog hub (`/en/blog?category=food-waste`) | `/en/blog/category/food-waste`  | Query-param filters get 301-redirected to clean category URLs — never crawlable query strings  |
| Paginated archives (`/en/blog?page=2`)             | `/en/blog` (page 1)             | All paginated pages canonicalize to page 1; use `rel="next"` / `rel="prev"` for crawl chaining |

**Pagination rules:**

- Blog hub, category archives, and tag archives (when indexed) use cursor or
  page-number pagination
- Paginated pages beyond page 1:
  `<meta name="robots" content="noindex, follow">` — Google crawls the chain but
  only indexes page 1
- Sitemap includes only page 1 of any paginated series
- No infinite scroll on SEO-critical archive pages — crawlers cannot execute
  JS-triggered pagination

**Duplicate content guard:**

- `www` vs non-`www`: enforce one via 301 at CDN/Vercel level; canonical
  reflects the chosen form
- Trailing slash: `trailingSlash: false` already set in `next.config` —
  canonical URLs must match
- HTTP vs HTTPS: enforce HTTPS via HSTS (already configured via Helmet headers)

### 6.5 Meta Title & Description Formula

**Title:** `[Primary Keyword] — [Unique Value Prop] | Too Fresh To Waste`

- Max 60 characters. Primary keyword first. Brand name last.

**Description:** `[Hook with keyword] + [specific benefit/number] + [CTA]`

- Max 155 characters. Include a number when possible. Culturally adapted per
  locale (not direct translation).

**Examples:**

```
EN: Food Waste App Tunisia — Save Up to 90% on Meals | Too Fresh To Waste
FR: Application Anti-Gaspillage Tunis — Économisez 90% sur vos repas | Too Fresh To Waste
AR: تطبيق الحد من هدر الطعام تونس — وفّر حتى 90% على وجباتك | Too Fresh To Waste
```

### 6.6 Page Speed Improvements

| Optimization               | Metric     | Implementation                                                       |
| -------------------------- | ---------- | -------------------------------------------------------------------- |
| Hero image `priority` prop | LCP        | Add `priority` to homepage `<Image>` above fold                      |
| Arabic font subsetting     | LCP + load | Use `pyftsubset` to strip unused glyphs; serve via `next/font/local` |
| Explicit image dimensions  | CLS        | All blog `<Image>` tags get explicit `width`/`height`                |
| Lazy load below fold       | FID        | Audit all non-hero images for `loading="lazy"`                       |

---

## Implementation Phases

| Phase                            | Duration  | Key Deliverables                                                   |
| -------------------------------- | --------- | ------------------------------------------------------------------ |
| **Phase 0 — Technical**          | Week 1-2  | JSON-LD components, OG image, sitemap upgrade, font subsetting     |
| **Phase 1 — Foundation Content** | Week 2-6  | 8 pillar pages (EN+FR+AR), blog route, author infrastructure       |
| **Phase 2 — Cluster Content**    | Month 2-4 | 8 cluster articles/week × 3 locales, country landing pages         |
| **Phase 3 — hreflang Upgrade**   | Month 2   | Country-region locales, GSC configuration                          |
| **Phase 4 — Viral System**       | Month 3+  | Impact counter, /impact hub, /competitions page (data-ready)       |
| **Phase 5 — Scale**              | Month 4+  | 60+ articles/month, seasonal content, milestone pages as triggered |

## Success Metrics (12-Month Targets)

| Metric                 | 3 months | 6 months | 12 months |
| ---------------------- | -------- | -------- | --------- |
| Indexed pages          | 100+     | 400+     | 1,000+    |
| Organic sessions/month | 500+     | 5,000+   | 30,000+   |
| Ranking keywords       | 50+      | 300+     | 1,500+    |
| Top-3 rankings         | 5+       | 30+      | 150+      |
| Backlinks (earned)     | 10+      | 40+      | 150+      |
| GSC CTR                | >2%      | >3%      | >4%       |

---

## Constraints & Non-Negotiables

1. **No fake data** — impact counters, charity numbers, and milestone pages only
   go live with real platform data
2. **E-E-A-T mandatory** — every published article must have a named human
   author, not "AI" or "Admin"
3. **No keyword stuffing** — articles must read naturally; density check before
   publish
4. **Citations required** — all statistics must link to FAO, World Bank, UNEP,
   or peer-reviewed sources
5. **Privacy** — competition winners must opt-in before their name/photo appears
   on any public page
6. **Dialect consistency** — Maghreb Arabic content uses MSA body + darija meta
   keywords; Gulf content uses MSA body + Gulf dialect meta keywords. Never mix
   in body text.
7. **Milestone data contract** — milestone, impact, and winner pages require
   backend `publish-readiness` confirmation (Section 4.5) before any page
   generation runs. No exceptions.
