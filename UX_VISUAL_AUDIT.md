# UX and Visual Audit - apps/web

**Date:** 2026-08-24 **Method:** Playwright, production build (`next build` +
`next start`), Chromium. Every route listed was actually loaded and rendered;
findings come from those renders and from DOM probes against the same pages.
**Scope:** the 22 publicly reachable routes. **No fixes applied.**

---

## What was actually opened

| Matrix cell        | Routes captured | Notes                            |
| ------------------ | --------------- | -------------------------------- |
| `desktop-light-en` | 22 / 22         | complete                         |
| `desktop-dark-en`  | 21 / 22         | complete bar one capture timeout |
| `mobile-light-en`  | 22 / 22         | complete, 360px                  |
| `desktop-light-ar` | 16 / 22         | RTL                              |
| `tablet-light-en`  | 11 / 22         | partial, 768px                   |
| `desktop-light-fr` | 7 / 22          | partial                          |

Full-page screenshots at 360 / 768 / 1280, plus a DOM accessibility probe run
against all 22 routes at 1280.

**Not audited, and not claimed:** every authenticated route. The 26 `(admin)`
and 19 `(merchant)` routes need a seeded session and a live backend; none was
opened. They are the densest UI in the product and remain unaudited.

**Partial coverage is marked as partial.** Where a finding was seen in one cell
only, the report says which.

---

## Summary

| Rank   | Count | Meaning                    |
| ------ | ----- | -------------------------- |
| **P0** | 3     | Broken / blocks production |
| **P1** | 11    | Important UX or visual     |
| **P2** | 8     | Polish / consistency       |

Two things are worth saying before the list.

**The design system is largely holding.** Every one of the 22 routes has exactly
one `<h1>`, **zero heading-level skips**, `alt` on every image, and an
accessible name on every button and link. That is unusual and it is the
foundation working.

**`/food-waste-facts` is the strongest page in the product** - real chapter
structure, cited sources (WWF, ScienceDirect), gold-on-teal used exactly as the
palette intends. It is the reference the weaker pages should be measured
against.

---

# P0 - blocks production

### P0-1. `/careers` advertises jobs restricted by gender

**Observed:** four open roles, each carrying a gender tag rendered as a job
attribute alongside location and work mode.

DOM text of the first card, verbatim:

```
"MaleRemote · TunisiaBackend DeveloperThe architect of the engine that feeds
thousands. ..."
```

Tags found on the page: `["Male", "Male", "Female", "Female"]`. Visible in the
768px capture on all four cards: Backend Developer and Growth & Marketing tagged
Male; Brand & Community and Frontend Developer tagged Female.

**Why P0:** advertising a role with a sex requirement is unlawful in Tunisia
(Labour Code art. 5bis), the EU, the UK and the US, outside narrow genuine
occupational requirements that do not apply to software or marketing roles. The
page is public and indexable. This is legal exposure, not a styling defect.

**Routes:** `/careers`, all locales (the tags render in `en`; `fr`/`ar` not
individually confirmed). **Fix owner:** product/legal decision, not a CSS
change.

### P0-2. `/companies` partner form is unusable with a screen reader

**Observed** via DOM probe: 13 inputs on the page, **12 unlabelled**. Every
field of the partner form has `id: null`, no `<label for>`, no `aria-label`, no
`aria-labelledby`, and **no placeholder**:

| Field          | id     | label | aria-label | placeholder | size   |
| -------------- | ------ | ----- | ---------- | ----------- | ------ |
| `businessName` | `null` | no    | no         | `null`      | 286x35 |
| `email`        | `null` | no    | no         | `null`      | 286x35 |
| `firstName`    | `null` | no    | no         | `null`      | 135x35 |
| `lastName`     | `null` | no    | no         | `null`      | 135x35 |
| `phone`        | `null` | no    | no         | `null`      | 286x35 |
| `message`      | `null` | no    | no         | `null`      | 286x52 |

A screen reader announces each as "edit text" with no indication of what to
type. Visible `<label>`-styled text ("Company Name _", "Work Email _") is
rendered but is **not programmatically associated** with its input.

The same six fields appear twice in the DOM, both instances laid out with
non-zero boxes - hence 12.

**Why P0:** this is the merchant acquisition funnel, and it fails WCAG 3.3.2 and
4.1.2 outright.

**Route:** `/companies`, 1280 (probe). Form also present at 768/360.

### P0-3. `/login` in dark mode renders an invisible button

**Observed:** at `desktop-dark-en`, the secondary CTA "Sign up your food
business" is legible in light mode and **effectively invisible in dark** - the
outline button renders as an empty pill.

The right-hand panel is still white in dark mode, i.e. the page hardcodes light
surfaces, while the button's label follows the theme token. Near-white text on a
hardcoded white background.

This is the failure mode predicted by partial dark-mode adoption: a page that
half-responds to the theme is worse than one that ignores it.

**Route:** `/login`, 1280 dark. Same page in light mode is fine.

---

# P1 - important

### P1-1. No skip-to-content link anywhere

**Observed:** 0 of 22 routes expose a skip link. Every marketing page puts 30-49
links before `<main>`, so a keyboard or screen-reader user traverses the entire
header and nav on every page. WCAG 2.4.1.

### P1-2. Four routes have no `<main>` landmark

**Observed:** `main` count = 0 on `/companies`, `/food-waste-facts`,
`/partners`, `/blog`. The other 18 have exactly one.

### P1-3. `/companies` inputs are 35px tall

Below the 44px touch floor in `DESIGN.md` §11.4 and below the 44px input height
in §5.1. Measured: `286x35`, `135x35`.

### P1-4. Password visibility toggle sits outside its input

**Observed at 360, 1280, and in RTL:** the eye icon renders below and to the
right of the password field, overlapping the input's bottom border rather than
sitting inside it. Consistent across viewports, so it is not a breakpoint issue.

**Route:** `/login`.

### P1-5. Auth hero stat labels are truncated

**Observed:** "Revenue boo..", "Strategic gro.." at 1280; worse at 360 ("Revenue
bo..", "Strategic gr.."). The card is too narrow for its label at every width
tested.

Not reproduced in Arabic, where the labels are shorter and fit - so this is a
Latin-locale issue and will be worse in French.

**Routes:** `/login`, `/forgot-password`.

### P1-6. RTL: the back chevron does not mirror

**Observed** on `/ar/login`: the panels swap correctly and text is
right-aligned, but the back affordance still points **left**. In RTL, back
points right.

The password eye icon also stays on the right edge in RTL, i.e. it does not
mirror to the trailing side.

### P1-7. Locale variants make different factual claims

**Observed** on `/login`:

- English hero body: "Turn your surplus into your greatest competitive
  advantage! Join the movement..."
- Arabic hero body: "انضم إلى أكثر من 2,000 متجر" - "join **more than 2,000
  stores**".

Both pages carry the same stat card reading **"2+ / Stores joined"**. So the
Arabic page claims 2,000 stores directly above a stat saying 2.

The testimonials also differ: English attributes a quote to "Industry Standard";
Arabic attributes one to "سارة ك." at "Green Grocers".

### P1-8. Embedded app screenshots are English in every locale

**Observed** on `/ar/consumer`: the phone mockup shows "Urgent Deals", "See
All", "No urgent deals right now", "Hottest Deals", "TND5.00" - untranslated,
inside an otherwise fully Arabic RTL page. The mockups are raster images, so
they cannot localise.

### P1-9. `/locations` repeats the city name as its own subtitle

**Observed at 1280:** every card shows the city, then the same word again as
subtitle - "Tunis / Tunis", "Sousse / Sousse", "Sfax / Sfax", "Nabeul / Nabeul".
Only Monastir and Hammamet differ (governorate), which suggests the subtitle is
meant to be the governorate and coincides for 5 of 7.

Reads as a rendering bug even though it is data.

### P1-10. Dark mode is absent on some routes and partial on others

**Observed** by comparing `desktop-light-en` against `desktop-dark-en`
byte-for-byte. Six routes are **byte-identical** in dark mode - they ignore the
theme entirely:

`/esg`, `/careers`, `/contact`, `/blog`, `/mission-driven`, `/forgot-password`

The remainder "differ", but differing is not the same as working: `/login`
differs _because_ a button became invisible (P0-3), and `/coming-soon` differs
only in incidental elements while its teal/cream section grounds stay put.

The product currently has three dark-mode behaviours - correct, ignored, and
half-applied - and the half-applied case is the one that breaks.

### P1-11. `/contact` offers no way to contact anyone

**Observed at 360:** the page is titled "Contact Us / We're here to help. Reach
out anytime" and contains two email addresses as plain text plus a newsletter
signup. The only form on the page, and the only prominent CTA, is "Subscribe
now" - a mailing-list signup, not a contact channel.

---

# P2 - polish and consistency

### P2-1. "∞" used as a statistic

**Observed** on `/login` (third hero stat, paired with the truncated "Strategic
gro..") and in the `/careers` stat row ("∞ / IMPACT IF WE WIN"). An infinity
glyph next to "34%" and "2+" reads as a placeholder that was never filled in.

### P2-2. Coral heading text on cream fails AA

**Observed** on `/coming-soon`: "WITH EVERY BAG" set in coral on the cream
section. Coral measures 3.38:1 on white and lower on cream - below the 4.5
required for text at that size. Consistent with the ban already recorded in
`DESIGN.md` §2.3.

### P2-3. `/locations` copy truncates mid-sentence and uses em dashes

Card descriptions clamp at awkward points ("close with…", "restaurants around
the…"), and the underlying copy contains em dashes ("surplus — and both mea…",
"perfectly good —…") which the project's own rule bans in favour of a spaced
hyphen.

### P2-4. The newsletter block repeats on nearly every marketing page

"Get Updated / A special surprise awaits our first 1,000 users" appears on `/`,
`/coming-soon`, `/contact`, `/locations`, `/companies`, `/careers`,
`/food-waste-facts` and more - identical each time, and on `/contact` it is the
primary CTA (see P1-11).

### P2-5. `/companies` hides 15% of its text without JavaScript

**Observed** with `javaScriptEnabled: false`: 476 of 3,201 characters across 6
blocks compute to `opacity < 0.05`. `/esg` and `/food-waste-facts` hide **0%**
under the same test, so this is specific to `/companies`, not a house pattern.
Affects no-JS users and, potentially, crawlers.

### P2-6. Paused marquees clip their own text

**Observed** on `/food-waste-facts` with animation disabled: the statistics
strip reads "of all food wasted • ... • 1.2 billio" - the leading number is
scrolled off the left edge and the trailing figure is cut. Users with
`prefers-reduced-motion` see a frozen, partially-legible strip.

### P2-7. Header is dense at 1280 and the login control is misaligned

Six nav items (two with dropdowns) plus "DOWNLOAD APP", "SIGN UP AS BUSINESS", a
language pill and Login. The Login control stacks its label under its icon while
every other nav item is a single text baseline, so it sits visually lower than
the rest of the row.

### P2-8. `/locations` grid ends ragged

Seven city cards in a three-column grid leave one card alone on the final row
with two empty cells and no visual resolution.

---

## Excluded: a finding I could not substantiate

Full-page captures of `/companies`, `/esg` and `/partners` showed large blank
regions - on `/companies`, roughly 60% of a 4,939px page. **This is not reported
as a defect**, because I could not reproduce it as something a user would see:

- The DOM contains the text (one "blank" region holds 1,000 characters).
- A slow-scroll pass found **0** sections at `opacity < 0.05`.
- With JavaScript disabled only 15% of `/companies` text is hidden, not 60%.
- A viewport screenshot at the same scroll offset renders the content correctly.
- `window.scrollTo()` and mouse-wheel both leave `scrollY` at 0 in this harness,
  so the capture's scroll pass never ran.

The most likely explanation is a `fullPage` stitching artefact on these pages,
not a page bug. **It needs a human scrolling a real browser to settle**, and
until then it is not a finding.

Two method notes follow from it: full-page captures on animation-heavy marketing
pages are not trustworthy in this harness, and the audit's scroll step did not
actually scroll.

---

## What this audit did not cover

- **All 45 authenticated routes** (`(admin)`, `(merchant)`). Not opened.
- **`/blog/[slug]`, `/locations/[city]`, `/r/[code]`, `/partner-kit`,
  `/merchant-signup`** and the remaining legal pages - not in the captured set.
- **French at 360 and 768**, and **Arabic at 768** - not captured.
- **Interaction states.** Hover, focus-visible, loading, empty, error and
  success states were not exercised on real routes; only the static first paint
  was captured. The component-level suite covers focus rings and a Dialog/Select
  open state, but no route-level flow was driven.
- **Per-pixel contrast sampling.** Contrast figures quoted are computed from
  tokens, not sampled from these renders.
- **Real assistive technology.** The probe reads the DOM; no screen reader was
  run.

---

## Reproducing this

```bash
# capture (writes to tests/visual/.audit, gitignored)
VISUAL_AUDIT=1 npx playwright test audit --project=desktop-light-en --workers=1

# DOM accessibility probe across all public routes
VISUAL_AUDIT=1 npx playwright test a11y-probe --project=desktop-light-en --workers=1
```

`audit.spec.ts`, `a11y-probe.spec.ts` and `probe-detail.spec.ts` are excluded
from regression runs by `testIgnore` unless `VISUAL_AUDIT=1` is set, so they
never gate CI.
