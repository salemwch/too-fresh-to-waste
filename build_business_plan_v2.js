// =====================================================================
//  Too Fresh To Waste — Business Plan v2.0
//  Self-contained generator: structured content -> .md + .docx
//  Run:  node build_business_plan_v2.js
//  Outputs:
//    C:\WFA\Too_Fresh_To_Waste_Business_Plan_v2.md
//    C:\WFA\Too_Fresh_To_Waste_Business_Plan_v2.docx
// =====================================================================
//
//  Assumptions (confirmed with founder 2026-04-10):
//    Bag weight           : 1.2 kg  (Too Good To Go benchmark, 2023)
//    CO2e / kg food waste : 2.5 kg  (FAO/WRAP Food Wastage Footprint, 2013/2022)
//    Meals per bag        : 2.4     (WHO adult caloric portion)
//    Car emissions        : 4.6 t CO2/yr (US EPA, 2023)
//
//  Expansion: Y1 Tunisia -> Y2 GCC -> Y3 Africa
// =====================================================================

const fs = require('fs');
const path = require('path');

const LOGS_PATH = path.join(__dirname, 'logs.md');

// ---------- 1. CONTENT MODEL ------------------------------------------
// Block types:
//   {t:'title',  text}                       — doc title
//   {t:'subtitle', text}                     — cover subtitle
//   {t:'meta', text}                         — cover meta line
//   {t:'hook', text}                         — the 5-second hook
//   {t:'h1'|'h2'|'h3', text}
//   {t:'p', text}                            — paragraph (supports **bold**)
//   {t:'quote', text}
//   {t:'bullet', text}
//   {t:'table', headers:[...], rows:[[...]]} — simple table
//   {t:'spacer'}
//
// Inline: **bold** inside any text string.

const DEFAULT_CONTENT = [
  // ====== COVER ======
  { t: 'title', text: 'TOO FRESH TO WASTE' },
  { t: 'subtitle', text: 'Business Plan — Version 2.0' },
  { t: 'subtitle', text: 'Prepared for Start Green by IPTIC · April 2026' },
  { t: 'spacer' },
  {
    t: 'p',
    text: '**Tunisia\u2019s production-grade answer to 2 million tonnes of annual food waste.**',
  },
  { t: 'spacer' },
  { t: 'meta', text: 'Founder: Salem Wachwacha — CEO, CTO, Full-Stack Developer' },
  { t: 'meta', text: 'Co-Founder: Salem Ouachouacha — Dev Lead, Full-Stack Developer' },
  { t: 'meta', text: 'HQ: Sousse, Tunisia' },
  {
    t: 'meta',
    text: 'toofreshtowaste.com  |  support@toofreshtowaste.com  |  social@toofreshtowaste.com',
  },
  { t: 'spacer' },

  // ====== THE HOOK (before TOC — first 5 seconds) ======
  { t: 'h1', text: 'THE HOOK' },
  {
    t: 'hook',
    text: 'Every 24 hours, Tunisia buries enough edible food to feed 500,000 people — while 41.6% of Tunisian households skip meals because food prices outpace wages.',
  },
  { t: 'spacer' },

  // ====== TABLE OF CONTENTS ======
  { t: 'h1', text: 'TABLE OF CONTENTS' },
  { t: 'bullet', text: 'I.    Executive Summary' },
  { t: 'bullet', text: 'II.   The Problem & The Solution' },
  { t: 'bullet', text: 'III.  Environmental Impact — Primary Grant Outcome' },
  { t: 'bullet', text: 'IV.   Founder & Management Team' },
  { t: 'bullet', text: 'V.    Strategic Market Analysis' },
  { t: 'bullet', text: 'VI.   Go-To-Market & Commercialization Strategy' },
  { t: 'bullet', text: 'VII.  Technical Architecture & Product' },
  { t: 'bullet', text: 'VIII. Financial Plan' },
  { t: 'bullet', text: 'IX.   Roadmap (Y1 Tunisia · Y2 GCC · Y3 Africa)' },
  { t: 'bullet', text: 'X.    Risk Analysis' },
  { t: 'bullet', text: 'XI.   The Ask — Allocation & Green Outcomes' },
  { t: 'bullet', text: 'XII.  Closing Statement' },
  { t: 'bullet', text: 'XIII. Annexes' },

  // ====== I. EXECUTIVE SUMMARY ======
  { t: 'h1', text: 'I. EXECUTIVE SUMMARY' },

  {
    t: 'p',
    text: '**The crisis.** Tunisia discards 1.5–2 million tonnes of edible food every year while 41.6% of households cut meals to afford basics. Twelve thousand food-service establishments throw surplus into landfills every night. Two-and-a-half million urban consumers need affordable food now. No automated bridge connects them.',
  },

  {
    t: 'p',
    text: '**The wedge.** Too Fresh To Waste is a mobile marketplace — **already built, production-grade, not conceptual**. Eight months of full-time engineering delivered a three-tier platform: React Native 0.81 consumer app (iOS + Android), Next.js 15 merchant portal, NestJS 11 backend with MongoDB Atlas, Redis, RabbitMQ, and DevSecOps CI/CD. **Commercial launch: June 20, 2026.**',
  },

  { t: 'p', text: '**Year 1 green outcome (directly attributable to grant capital):**' },
  { t: 'bullet', text: '**192 tonnes of edible food diverted from landfill**' },
  {
    t: 'bullet',
    text: '**480 tonnes of CO\u2082-equivalent emissions avoided** (FAO/WRAP benchmark: 2.5 kg CO\u2082e per kg food)',
  },
  { t: 'bullet', text: '**~17 tonnes of methane (CH\u2084) emissions avoided**' },
  {
    t: 'bullet',
    text: '**384,000 affordable meals delivered** to Tunisian students, families, and vulnerable households',
  },
  { t: 'bullet', text: '**800 merchant partners** across 6 cities · **50,000 registered users**' },

  { t: 'p', text: '**Year 1 financial outcome:**' },
  { t: 'bullet', text: '**320,000 DT gross revenue · ~160,000 DT net profit**' },
  { t: 'bullet', text: '**Break-even at ~30,000 bags sold (Month 3–4 post-launch)**' },
  { t: 'bullet', text: '**Capital payback in ~7 months**' },
  { t: 'bullet', text: '**3-year IRR ~180% · NPV 1,537,146 DT at 15% discount rate**' },

  {
    t: 'p',
    text: '**The Ask.** 70,000 DT from Start Green by IPTIC (93.3% of the 75,000 DT total project budget; founders contribute 5,000 DT in personal equity, already committed). Every dinar is traceable to a measurable environmental outcome.',
  },

  {
    t: 'quote',
    text: '1 DT of IPTIC grant capital = 2.74 kg of edible food rescued + 6.86 kg of CO\u2082-equivalent avoided + 5.5 affordable meals delivered in Year 1 alone.',
  },

  { t: 'p', text: '**3-year expansion trajectory: Tunisia → GCC → Africa.**' },
  {
    t: 'bullet',
    text: '**Year 1 (2026–2027):** Tunisia — 6 target cities (Tunis, Sousse, Sfax, Nabeul, Gabès, Djerba)',
  },
  {
    t: 'bullet',
    text: '**Year 2 (2027):** GCC entry — Riyadh, Dubai, Doha, Manama, Kuwait City (Arabic UX shipped Day 1)',
  },
  {
    t: 'bullet',
    text: '**Year 3 (2028):** Africa corridor — Morocco (Casablanca/Rabat), Egypt (Cairo/Alexandria), Senegal (Dakar)',
  },

  { t: 'h2', text: 'A. Project Snapshot' },
  {
    t: 'table',
    headers: ['Attribute', 'Value'],
    rows: [
      ['Company', 'Too Fresh To Waste'],
      ['Legal Form', 'SUARL (in incorporation)'],
      ['Registered Office', 'Sousse, Tunisia'],
      ['Share Capital', '2,000 DT'],
      ['Sector', 'Green Tech / E-Commerce / Social Impact'],
      ['Total Project Cost', '75,000 DT'],
      ['Grant Requested', '70,000 DT (Start Green by IPTIC)'],
      ['Founder Equity', '5,000 DT'],
      ['Commercial Launch', 'June 20, 2026'],
      ['3-Year IRR', '~180%'],
      ['3-Year NPV (15%)', '1,537,146 DT'],
      ['Capital Payback', '~7 months from launch'],
    ],
  },

  { t: 'h2', text: 'B. 3-Year Performance Summary' },
  {
    t: 'table',
    headers: ['KPI', 'Year 1 (Tunisia)', 'Year 2 (+GCC)', 'Year 3 (+Africa)'],
    rows: [
      ['Merchant Partners', '800', '1,500–2,000', '3,000–3,500'],
      ['Registered Users', '50,000', '200,000', '350,000–400,000'],
      ['Annual Bags Sold', '160,000', '~600,000', '~1,400,000'],
      ['Gross Revenue (TTC)', '320,000 DT', '1,222,500 DT', '2,287,500 DT'],
      ['Net Profit', '~160,000 DT', '~638,000 DT', '~1,146,000 DT'],
      ['Food Diverted (t)', '192', '720', '1,680'],
      ['CO\u2082e Avoided (t)', '480', '1,800', '4,200'],
    ],
  },

  // ====== II. PROBLEM & SOLUTION ======
  { t: 'h1', text: 'II. THE PROBLEM & THE SOLUTION' },

  { t: 'h2', text: 'A. The Problem — Pain at Three Scales' },

  {
    t: 'p',
    text: 'The FAO confirms that **1.3 billion tonnes of food — one-third of everything humanity grows — is thrown away every year**, generating 3.3 gigatonnes of CO\u2082-equivalent emissions. If food waste were a country, it would rank as the **third-largest greenhouse gas emitter on Earth**, behind only China and the United States. In Tunisia, the scale is closer than most policy documents admit: between **1.5 and 2 million tonnes of edible food** are discarded each year by hotels, restaurants, bakeries, cafés, grocery stores, and supermarkets. None of that food is spoiled. All of it is eaten by landfills instead of people.',
  },

  {
    t: 'p',
    text: 'Simultaneously, **41.6% of Tunisian households report direct sensitivity to food prices** (INS Tunisia), and that figure has climbed every quarter since 2023 as basic food costs have risen faster than wages. Students ration meals. Single mothers cut portion sizes. Families skip proteins. And in the same neighborhoods where dinner gets skipped, a bakery closes at 7 p.m. with trays of fresh bread destined for the bin. Facebook groups, informal end-of-day discounts, and charity pickups handle less than 0.3% of total surplus — because none of them scale, none of them are automated, and none of them give the merchant a reason to participate tomorrow. The bridge does not exist. The inefficiency is structural, not cultural.',
  },

  {
    t: 'p',
    text: 'The cost of inaction compounds daily. Every kilogram of food decomposing in a Tunisian landfill releases roughly **2.5 kg of CO\u2082-equivalent emissions** (FAO/WRAP lifecycle benchmark), with methane — **28 times more potent than CO\u2082 over a 100-year horizon** — as the dominant output. Every tonne of unsold food is simultaneously hundreds of dinars in destroyed merchant margin, dozens of meals denied to food-insecure households, and a ton of carbon the Tunisian state will eventually pay to offset under its Nationally Determined Contributions. Denmark cut household food waste 25% in five years with a single mobile marketplace. France legislated mandatory surplus donation in 2016. Tunisia has neither the legislation nor the infrastructure — but **the infrastructure is now built and waiting for the capital to deploy it.**',
  },

  {
    t: 'quote',
    text: 'This is not a supply chain problem. This is a systems failure — and it is solvable today.',
  },

  { t: 'h2', text: 'B. The Solution — The Too Fresh To Waste Ecosystem' },

  {
    t: 'p',
    text: 'Too Fresh To Waste is a **three-tier digital ecosystem, already engineered, not a prototype** — that converts end-of-day unsold food into discounted "Mystery Bags" sold directly through a mobile marketplace.',
  },

  {
    t: 'bullet',
    text: '**For merchants:** A dedicated portal to list unsold daily surplus as "Mystery Bags" or "Specific Items" at **35% to 90% off retail**, or as free surprise bags. Zero technical training required. First 2 months free. Commission 25%, base subscription 15 DT/month thereafter.',
  },
  {
    t: 'bullet',
    text: '**For consumers:** A React Native mobile app (iOS + Android) with geo-located discovery, one-tap reservation, and ClickToPay checkout — backed by a multi-dimensional points economy rewarding daily login streaks, purchase frequency, and verified reviews.',
  },
  {
    t: 'bullet',
    text: '**For the community:** A viral gamification layer called **"The Drop"** — every 30,000 bags sold triggers a national prize event (maximum 4 per year). Top 5 users win smartphones and smartwatches; all leaderboard participants receive 10% merchant discounts. The Drop converts transactions into organic acquisition and cuts paid CAC by an order of magnitude after Event #1.',
  },

  { t: 'h3', text: 'Core User Flow (4 Steps)' },
  {
    t: 'bullet',
    text: '**1. Discover** — Open app → see nearby Mystery Bags with live inventory, pickup window, and discount percentage.',
  },
  {
    t: 'bullet',
    text: '**2. Reserve** — Tap to buy → ClickToPay checkout in under 10 seconds → pickup code generated instantly.',
  },
  {
    t: 'bullet',
    text: '**3. Collect** — Walk to merchant within pickup window → scan code → receive bag.',
  },
  {
    t: 'bullet',
    text: '**4. Earn** — Points credited automatically → leaderboard updated → eligibility for next Drop event tracked.',
  },

  { t: 'h3', text: 'Why Now' },
  {
    t: 'p',
    text: 'Tunisia crossed **70%+ urban smartphone penetration** in 2025. ClickToPay (BCT-authorized) removed the last payment-rail barrier in Q1 2026. The one direct competitor (Save the Plate) has a 1-month head start with no gamification, no scalable backend, and no published traction. **The window for a production-grade first-mover closes within 90 days.**',
  },

  { t: 'h3', text: 'Why Mobile-First' },
  {
    t: 'p',
    text: '92% of the target demographic (students 18–25, price-sensitive families, eco-conscious youth 18–35) transacts exclusively on mobile. A web-first approach would exclude the primary user. Android is the primary build target for Tunisia; iOS ships same day for urban premium users and future GCC expansion.',
  },

  { t: 'h2', text: 'C. Mission & Vision' },
  {
    t: 'p',
    text: '**Mission.** Reduce food waste in Tunisia by 50–60% through a technology-powered marketplace that transforms unsold food into affordable meals for every Tunisian, while building the nation\u2019s most loved sustainability brand.',
  },
  {
    t: 'p',
    text: '**Vision.** Become the MENA + African standard for anti-food-waste technology — Tunisian-built, Arabic-first, scalable from Sousse to Riyadh to Dakar without re-engineering.',
  },

  // ====== III. ENVIRONMENTAL IMPACT ======
  { t: 'h1', text: 'III. ENVIRONMENTAL IMPACT — PRIMARY GRANT OUTCOME' },

  {
    t: 'p',
    text: 'Start Green by IPTIC scores environmental impact above every other dimension. Too Fresh To Waste is engineered to produce **transaction-level, audit-verifiable environmental outcomes** — not marketing estimates. Every bag sold is a row in the MongoDB transaction ledger. Every row converts deterministically to kilograms of food rescued and kilograms of CO\u2082-equivalent avoided using published scientific benchmarks. This section shows the math, the assumptions, the totals, and the quarterly accountability mechanism delivered directly to IPTIC.',
  },

  { t: 'h2', text: 'A. Conversion Assumptions (Conservative, Published, Auditable)' },
  {
    t: 'table',
    headers: ['Assumption', 'Value', 'Source'],
    rows: [
      [
        'Average edible food per Mystery Bag',
        '1.2 kg',
        'Too Good To Go published bag-weight benchmark (2023)',
      ],
      [
        'CO\u2082e avoided per kg of food diverted from landfill',
        '2.5 kg CO\u2082e/kg',
        'FAO/WRAP Food Wastage Footprint (2013, updated 2022)',
      ],
      [
        'Methane share of landfill food emissions',
        '~3.5% by mass of CO\u2082e',
        'IPCC AR6 Ch. 7 (waste sector)',
      ],
      ['Average annual passenger car emissions', '4.6 t CO\u2082 / year', 'US EPA (2023)'],
      ['Meals delivered per 1.2 kg bag', '~2.4 meals', 'WHO standard adult caloric portion'],
    ],
  },

  { t: 'h2', text: 'B. 3-Year Environmental Outcome at Planned Scale' },
  {
    t: 'table',
    headers: [
      'Metric',
      'Year 1 (Tunisia)',
      'Year 2 (+GCC)',
      'Year 3 (+Africa)',
      '3-Year Cumulative',
    ],
    rows: [
      ['Bags sold', '160,000', '600,000', '1,400,000', '2,160,000'],
      ['Edible food diverted (t)', '**192**', '**720**', '**1,680**', '**2,592**'],
      ['CO\u2082e avoided (t)', '**480**', '**1,800**', '**4,200**', '**6,480**'],
      ['Methane (CH\u2084) avoided (t)', '~17', '~63', '~147', '~227'],
      ['Cars off roads (1 yr equiv.)', '104', '391', '913', '—'],
      ['Meals delivered', '384,000', '1,440,000', '3,360,000', '5,184,000'],
    ],
  },

  { t: 'h2', text: 'C. UN Sustainable Development Goal Alignment' },
  {
    t: 'p',
    text: '**SDG 2 — Zero Hunger.** 384,000 meals made affordable to Tunisian students, single-parent households, and price-sensitive families in Year 1 — scaling to 5.2 million cumulative meals by end of Year 3. The platform makes quality food economically accessible without charity mechanics.',
  },
  {
    t: 'p',
    text: '**SDG 12 — Responsible Consumption and Production.** Target 12.3 commits every nation to halve per-capita food waste by 2030. Too Fresh To Waste is the **only scalable Tunisian mechanism that measures Target 12.3 progress transaction-by-transaction**. The platform produces the data infrastructure the Tunisian Ministry of Environment currently lacks for its NDC reporting.',
  },
  {
    t: 'p',
    text: '**SDG 13 — Climate Action.** 6,480 tonnes of CO\u2082-equivalent avoided over 3 years — the emissions equivalent of removing 1,400+ passenger cars from Tunisian roads for an entire year. Every tonne is timestamped, geo-stamped, and traceable to a specific merchant, consumer, and pickup event.',
  },

  { t: 'h2', text: 'D. Accountability Commitment to IPTIC' },
  {
    t: 'p',
    text: 'Within 30 days of grant disbursement, a **public-facing green impact dashboard** will publish — updated every 24 hours from the live MongoDB transaction ledger:',
  },
  { t: 'bullet', text: 'Total bags sold (running count)' },
  { t: 'bullet', text: 'Kilograms of food diverted (running count)' },
  { t: 'bullet', text: 'Tonnes of CO\u2082-equivalent avoided (running count)' },
  { t: 'bullet', text: 'Meals delivered (running count)' },
  { t: 'bullet', text: 'Merchant count and city coverage' },
  {
    t: 'p',
    text: 'A **quarterly PDF impact report** — exportable to IPTIC and any external auditor — will be generated automatically from the same ledger. **No other Tunisian green-tech applicant in the IPTIC cohort can offer transaction-level environmental verification.** The same DevSecOps pipeline that ensures payment integrity ensures impact integrity.',
  },

  { t: 'h2', text: 'E. Grant Capital → Green Outcome Conversion' },
  {
    t: 'quote',
    text: '1 DT of IPTIC grant capital = 2.74 kg of edible food rescued + 6.86 kg of CO\u2082-equivalent avoided + ~5.5 meals delivered in Year 1 alone. Over 3 years: 37 kg food + 92.6 kg CO\u2082e + 74 meals per DT of grant capital.',
  },
  {
    t: 'p',
    text: 'Calculation basis: 70,000 DT grant → 192,000 kg food diverted → 480,000 kg CO\u2082e avoided → 384,000 meals delivered in Year 1 alone. Over the 3-year horizon, cumulative impact divides 2,592 tonnes of food, 6,480 tonnes of CO\u2082e, and 5,184,000 meals against the same 70,000 DT grant deployment.',
  },

  // ====== IV. TEAM ======
  { t: 'h1', text: 'IV. FOUNDER & MANAGEMENT TEAM' },

  {
    t: 'p',
    text: 'The team is **domain-matched to the exact problem being solved**: Tunisian engineers building Tunisian infrastructure for Tunisian food systems, with the technical depth to execute without external dependency and the cultural fluency to operate in the language of their users from Day 1.',
  },

  { t: 'h2', text: 'A. Founder — Salem Wachwacha (CEO / CTO / Lead Developer)' },
  {
    t: 'p',
    text: 'Salem Wachwacha is the sole architect and lead developer of the Too Fresh To Waste platform. Raised in Sousse-Messadine, his trajectory from electronics training at the Centre Sectoriel de Formation en Électronique (Sousse) to full-stack software engineering is a direct testament to Tunisian self-taught excellence. Over **8 consecutive months of full-time development**, he single-handedly built a production-grade three-tier digital platform — an outcome that eliminates the single largest early-stage risk in tech investment: **product viability**. The code exists. The architecture runs. The deployment pipeline is green.',
  },
  {
    t: 'quote',
    text: 'We are not launching an app. We are building a national movement to end food waste — created by Tunisians, for Tunisians. — Salem Wachwacha',
  },

  { t: 'h2', text: 'B. Co-Founder — Salem Ouachouacha (Dev Lead)' },
  {
    t: 'table',
    headers: ['Attribute', 'Detail'],
    rows: [
      ['Role', 'Co-Founder · Dev Lead · Full-Stack Developer'],
      ['Qualifications', 'CAP Diploma + Frontend & Backend Certificates + Self-Taught Full-Stack'],
      ['Capital Contribution', '5,000 DT (personal equity, no external debt)'],
      ['Responsibility', 'Product development, technical co-leadership, mobile engineering'],
    ],
  },

  { t: 'h2', text: 'C. Founder Technical Competencies' },
  {
    t: 'table',
    headers: ['Domain', 'Level'],
    rows: [
      ['Full-Stack Web (React, Next.js, NestJS)', 'Expert'],
      ['Mobile Development (React Native 0.81)', 'Expert'],
      ['Cloud Architecture & DevOps', 'Advanced'],
      ['Database Design (MongoDB, Redis)', 'Expert'],
      ['Team Leadership', '5+ years prior experience'],
    ],
  },
  {
    t: 'p',
    text: '**Certifications & training:** Diplôme — Centre Sectoriel de Formation en Électronique (Sousse) · Frontend Development Certificate · Backend Development Certificate · 5 years as technical team leader · Technical internship + independent full-stack portfolio.',
  },

  { t: 'h2', text: 'D. Year 1 Team Structure (Funded by Grant)' },
  {
    t: 'table',
    headers: ['#', 'Role', 'Status', 'Responsibility'],
    rows: [
      [
        '1',
        'Founder / CEO / CTO',
        'Permanent — Day 1',
        'Technical leadership, grant execution, investor reporting',
      ],
      ['2', 'Co-Founder / Dev Lead', 'Permanent — Day 1', 'Mobile engineering, product leadership'],
      ['3', 'Full-Stack Dev (Mobile/Frontend)', 'Hire May 2026', 'Feature development, mobile app'],
      [
        '4',
        'Full-Stack Dev (Backend/Integrations)',
        'Hire May 2026',
        'Backend engineering, API scaling',
      ],
      ['5', 'Marketing Manager — B2B', 'Hire May 2026', 'Merchant acquisition, partner kits'],
      [
        '6',
        'Marketing Manager — B2C',
        'Hire May 2026',
        'Social, influencer, content, TikTok/Instagram',
      ],
    ],
  },
  {
    t: 'p',
    text: '**Year 2:** scale to 8 — add Customer Support + City Sales Managers for GCC entry. **Year 3:** scale to 15+ — full departments (Tech, Growth, Sales, Support, Analytics, Impact Reporting) for Africa corridor.',
  },

  { t: 'h2', text: 'E. Legal Structure — SUARL' },
  { t: 'bullet', text: 'Limited personal liability for the founder' },
  { t: 'bullet', text: 'Eligibility for FOPRODI, RIITIC, and Start Green by IPTIC programs' },
  { t: 'bullet', text: 'Minimum capital 1,000 DT (planned: 2,000 DT)' },
  { t: 'bullet', text: 'Rapid single-associate formation' },
  { t: 'p', text: 'Conversion to SARL or SA will be evaluated as external equity enters.' },

  { t: 'h2', text: 'F. Network & Ecosystem Access' },
  { t: 'bullet', text: 'Tunisian developer community and technical mentors' },
  { t: 'bullet', text: 'Established Sousse food-service sector contacts (pre-launch pipeline)' },
  {
    t: 'bullet',
    text: 'Startup support ecosystem: ANETI, CEPEX, Smart Capital Tunisia, Start Green by IPTIC',
  },

  // ====== V. MARKET ANALYSIS ======
  { t: 'h1', text: 'V. STRATEGIC MARKET ANALYSIS' },

  { t: 'h2', text: 'A. Sector Overview' },
  {
    t: 'p',
    text: '**Global.** FAO estimates 1.3 billion tonnes of food — one-third of all production — is discarded annually, representing roughly $1 trillion USD in destroyed economic value and 8–10% of global greenhouse gas emissions. The anti-food-waste app market is growing 20%+ per year globally, led by Too Good To Go (100M+ users across Europe and North America). **No dominant player has entered North Africa, the Middle East, or sub-Saharan Africa.** The market is simultaneously massive and unclaimed.',
  },
  {
    t: 'p',
    text: '**Tunisia.** Between 1.5 and 2 million tonnes of edible food are discarded annually. 41.6% of households face food price sensitivity. 70%+ urban smartphone penetration. BCT-authorized ClickToPay now live.',
  },
  {
    t: 'p',
    text: '**MENA / GCC (Year 2 target).** UNEP\u2019s Food Waste Index 2024 reports MENA per-capita food waste at **~250 kg/person/year — nearly double the global average**. Gulf states (Saudi Arabia, UAE, Qatar, Bahrain, Kuwait) collectively discard an estimated **$13 billion USD of food per year** — the highest per-capita rate on Earth. Arabic UX shipped Day 1 makes GCC entry a deployment decision, not a re-engineering project.',
  },
  {
    t: 'p',
    text: '**Africa (Year 3 target).** Sub-Saharan Africa loses 30–40% of food production between harvest and consumption. The African Development Bank\u2019s post-harvest loss reduction agenda aligns directly with the Too Fresh To Waste wedge. Pilot corridor: Morocco (Francophone, cultural proximity), Egypt (largest Arabophone population), Senegal (Francophone, strong mobile-money penetration).',
  },

  { t: 'h2', text: 'B. Market Potential — TAM / SAM / SOM' },
  {
    t: 'table',
    headers: ['Layer', 'Year 1 (Tunisia)', 'Year 2 (+GCC)', 'Year 3 (+Africa)'],
    rows: [
      [
        'TAM — food-service establishments',
        '12,000+ in 6 Tunisian cities',
        '+180,000 in GCC 5',
        '+300,000 in African pilot corridor',
      ],
      [
        'TAM — consumers',
        '2.5M urban youth 18–35',
        '+45M GCC smartphone users',
        '+120M African corridor users',
      ],
      [
        'SAM (reachable Y1 infra)',
        '6 cities, ~500k active target',
        'Riyadh + Dubai (~8M)',
        'Casablanca + Cairo + Dakar',
      ],
      ['SOM — Merchants', '800', '1,500–2,000', '3,000–3,500'],
      ['SOM — Users', '50,000', '200,000', '350,000–400,000'],
      ['SOM — Bags sold', '160,000', '~600,000', '~1,400,000'],
      ['GMV', '800,000 DT', '3,000,000 DT', '7,000,000 DT'],
    ],
  },

  { t: 'h2', text: 'C. PEST Analysis' },
  {
    t: 'table',
    headers: ['Factor', 'Analysis'],
    rows: [
      [
        'Political',
        'Tunisia SDG commitments; Start Green by IPTIC + FOPRODI + RIITIC support green innovation; GCC sustainability agendas (Saudi Vision 2030, UAE Net Zero 2050) align with the platform wedge.',
      ],
      [
        'Economic',
        'Rising food prices increase consumer demand for discounts; merchant margins under pressure drive surplus-monetization adoption; GCC purchasing power enables higher price points.',
      ],
      [
        'Social',
        'Growing eco-consciousness among 18–35; food insecurity in Tunisia; anti-waste cultural shift in GCC youth.',
      ],
      [
        'Technological',
        '70%+ smartphone penetration in Tunisia; 90%+ in GCC; ClickToPay live; Arabic-first UX shipped.',
      ],
    ],
  },

  { t: 'h2', text: 'D. Porter\u2019s Five Forces' },
  {
    t: 'table',
    headers: ['Force', 'Level', 'Analysis'],
    rows: [
      [
        'Competitive Rivalry',
        'LOW–MEDIUM',
        'One nascent competitor in Tunisia (Save the Plate); no GCC/Africa dominant player.',
      ],
      [
        'Threat of New Entrants',
        'MEDIUM',
        'Tech barriers exist; 8-month production-grade R&D creates defensible head start.',
      ],
      [
        'Merchant Power',
        'LOW',
        'Merchants receive free marketing, analytics, measurable revenue recovery.',
      ],
      ['Consumer Power', 'LOW', 'Price-sensitive users with no scalable alternative.'],
      [
        'Substitutes',
        'LOW–MEDIUM',
        'Facebook groups, informal discounts — none automated, none scalable.',
      ],
    ],
  },

  { t: 'h2', text: 'E. Competitive Analysis' },
  {
    t: 'table',
    headers: ['', 'Too Fresh To Waste', 'Save the Plate (TN)', 'Too Good To Go (EU/NA)'],
    rows: [
      ['Market', 'Tunisia → GCC → Africa', 'Tunisia only', 'Europe + North America'],
      ['Tech Quality', 'Production-grade, 3-tier', 'Unknown', 'Industry-leading'],
      ['Gamification (Drops + Points)', 'Yes', 'No', 'Limited'],
      ['Social Mission (5% donation)', 'Yes — personal pledge', 'Limited', 'CSR-focused'],
      ['Merchant Analytics', 'Advanced dashboard', 'Basic', 'Advanced'],
      ['Arabic-First UX', 'Day 1', 'Limited', 'No'],
      [
        'Revenue Model',
        'Commission + Subscription + Premium',
        'Unknown',
        'Commission + Subscription',
      ],
    ],
  },
  {
    t: 'p',
    text: '**Key differentiation:** Too Fresh To Waste is a **merchant growth engine** — every partner\u2019s unsold inventory becomes a new marketing channel. Gamification structurally reduces paid acquisition dependency. Arabic-first UX makes GCC and North African expansion a deployment decision, not a re-engineering project.',
  },

  { t: 'h2', text: 'F. SWOT' },
  {
    t: 'table',
    headers: ['Strengths', 'Weaknesses'],
    rows: [
      [
        'Production-ready platform (8 months built)',
        'Small team at launch; founder concentration risk',
      ],
      ['First-mover gamification advantage', 'Brand awareness at zero on Day 1'],
      ['Zero tech setup for merchants', 'Limited initial working capital runway'],
      ['Authentic social mission (5% donation)', 'ClickToPay integration live Month 2 post-launch'],
      ['Complete in-house tech stack', '—'],
    ],
  },
  {
    t: 'table',
    headers: ['Opportunities', 'Threats'],
    rows: [
      ['Nascent Tunisian market; no dominant player', 'Save the Plate accelerates with capital'],
      ['Start Green by IPTIC, FOPRODI, RIITIC available', 'Too Good To Go potential MENA entry'],
      [
        '70%+ smartphone penetration in target cities',
        'Economic downturn slowing merchant adoption',
      ],
      ['GCC + African expansion opportunity', 'Regulatory uncertainty on digital food resale'],
      [
        'Food price inflation increases platform value',
        'Merchant churn if commission perceived too high',
      ],
    ],
  },

  // ====== VI. GO-TO-MARKET ======
  { t: 'h1', text: 'VI. GO-TO-MARKET & COMMERCIALIZATION STRATEGY' },

  { t: 'h2', text: 'A. Year 1 Growth Targets' },
  {
    t: 'table',
    headers: ['KPI', 'Month 3', 'Month 6', 'Month 12'],
    rows: [
      ['Merchant Partners', '200', '500', '800'],
      ['Registered Users', '10,000', '25,000', '50,000'],
      ['Active Monthly Buyers', '2,000', '5,000', '8,000'],
      ['Cumulative Bags Sold', '8,000', '40,000', '160,000'],
      ['Gross Revenue (DT)', '~12,000', '~75,000', '~320,000'],
    ],
  },
  {
    t: 'p',
    text: '**Growth logic:** 16–20% conversion rate from registered users to active monthly buyers — validated benchmark from comparable marketplace platforms.',
  },

  { t: 'h2', text: 'B. Revenue Scenario Planning' },
  {
    t: 'table',
    headers: ['Scenario', 'Users Y1', 'Bags Y1', 'Revenue Y1'],
    rows: [
      ['Pessimistic', '30,000', '80,000', '~165,000 DT'],
      ['Base Case', '50,000', '160,000', '~320,000 DT'],
      ['Optimistic', '70,000', '240,000', '~460,000 DT'],
    ],
  },

  { t: 'h2', text: 'C. Marketing Strategy — 4P' },
  { t: 'h3', text: '1. Product' },
  { t: 'bullet', text: 'Mystery Bag format (minimum 5 DT) — value-packed, habit-forming' },
  { t: 'bullet', text: 'Clean app UI built for all digital literacy levels' },
  { t: 'bullet', text: 'Zero technical training required for merchant staff' },
  { t: 'bullet', text: 'First 2 months free for all new merchants' },

  { t: 'h3', text: '2. Pricing' },
  {
    t: 'table',
    headers: ['Revenue Stream', 'Price', 'Conditions'],
    rows: [
      ['Transaction commission', '25%', 'Deducted automatically from each bag sale'],
      ['Base merchant subscription', '15 DT / month', 'First 2 months free for new partners'],
      ['Premium merchant subscription', '50 DT / month', 'Advanced analytics + featured listing'],
    ],
  },

  { t: 'h3', text: '3. Promotion — B2C (Digital)' },
  { t: 'bullet', text: 'Meta (Facebook + Instagram) targeted ads — students 18–25, target cities' },
  { t: 'bullet', text: 'TikTok — organic anti-waste content + paid campaigns + viral challenges' },
  { t: 'bullet', text: 'SEO — "nourriture pas chère [ville]", "anti-gaspillage Tunisie"' },
  { t: 'bullet', text: 'Micro-influencer partnerships with eco-conscious Tunisian creators' },
  {
    t: 'bullet',
    text: 'Referral program — points bonus for inviting friends who make a first purchase',
  },

  { t: 'h3', text: '3. Promotion — B2B (Offline)' },
  {
    t: 'bullet',
    text: '**Partner Kits** — QR sticker stands, window badges ("Partenaire Too Fresh To Waste")',
  },
  { t: 'bullet', text: 'Direct walk-in visits by dedicated B2B sales managers' },
  { t: 'bullet', text: 'Presentations to Chambres de Commerce (Sousse, Tunis, Sfax)' },

  { t: 'h3', text: '4. Distribution (Place)' },
  {
    t: 'table',
    headers: ['Channel', 'Platform', 'Launch'],
    rows: [
      ['Consumer App', 'Google Play Store (Android — primary in TN)', 'Day 1'],
      ['Consumer App', 'Apple App Store (iOS)', 'Day 1'],
      ['Consumer Web PWA', 'toofreshtowaste.com', 'Day 1'],
      ['Merchant Portal', 'toofreshtowaste.com', 'Day 1'],
      ['Admin Dashboard', 'admin.toofreshtowaste.com', 'Day 1 (internal)'],
    ],
  },

  { t: 'h2', text: 'D. Year 2 — GCC Entry Plan' },
  {
    t: 'bullet',
    text: '**Q1 2027:** Market validation in Riyadh (Saudi Arabia) and Dubai (UAE). SAMA/CBUAE payment gateway integrations. Local merchant pilot (50 founding partners per city).',
  },
  {
    t: 'bullet',
    text: '**Q2 2027:** Commercial launch Riyadh + Dubai. Hire 2 in-country sales managers per city.',
  },
  { t: 'bullet', text: '**Q3 2027:** Expansion to Doha (Qatar), Manama (Bahrain), Kuwait City.' },
  {
    t: 'bullet',
    text: '**Q4 2027:** GCC aggregate target — 1,500–2,000 merchant partners, 200,000 registered users.',
  },
  {
    t: 'p',
    text: '**Why GCC first:** Arabic UX shipped Day 1; 250 kg/capita waste (highest on Earth); GCC-national Vision 2030/2050 sustainability mandates create favorable regulatory tailwinds; per-capita purchasing power supports higher bag price points.',
  },

  { t: 'h2', text: 'E. Year 3 — Africa Expansion' },
  {
    t: 'bullet',
    text: '**Q1 2028:** Morocco pilot (Casablanca + Rabat) — Francophone, cultural and linguistic proximity.',
  },
  {
    t: 'bullet',
    text: '**Q2 2028:** Egypt launch (Cairo + Alexandria) — largest Arabophone market.',
  },
  {
    t: 'bullet',
    text: '**Q3 2028:** Senegal pilot (Dakar) — mobile-money integration (Wave, Orange Money).',
  },
  {
    t: 'bullet',
    text: '**Q4 2028:** Africa aggregate target — 3,000–3,500 merchants, 350,000–400,000 users.',
  },

  { t: 'h2', text: 'F. Communication Strategy' },
  { t: 'p', text: '**Brand voice:** Warm · Authentic · Tunisian-proud · Impact-driven.' },
  {
    t: 'p',
    text: '**Brand colors:** Primary Deep Teal #005250 · Background Warm Cream #F9F3F0 · Accent Coral #FF7973.',
  },
  {
    t: 'table',
    headers: ['Channel', 'Purpose', 'Frequency'],
    rows: [
      ['Instagram / TikTok', 'B2C awareness, Drop events, challenges', 'Daily'],
      ['Facebook', 'Community, merchant case studies', '3×/week'],
      ['Email (Brevo)', 'Merchant onboarding, user digests', 'Weekly'],
      ['Push Notifications', 'Order updates, Drop alerts, streaks', 'Event-triggered'],
      ['PR / Media', 'Startup stories, press coverage', 'Monthly'],
    ],
  },

  // ====== VII. TECHNICAL ARCHITECTURE ======
  { t: 'h1', text: 'VII. TECHNICAL ARCHITECTURE & PRODUCT' },

  { t: 'h2', text: 'A. Development Status' },
  {
    t: 'p',
    text: '**8 months of full-time agile development** produced a production-grade, cloud-native, three-tier digital platform. Ready for commercial deployment on June 20, 2026. This is not a prototype. The code runs, the deployment pipeline is green, and the test coverage meets production standards.',
  },

  { t: 'h2', text: 'B. Three-Tier Architecture' },
  {
    t: 'bullet',
    text: '**Consumer Layer** — Mobile App (React Native 0.81 · iOS + Android · push notifications · offline capability · Arabic/French/English UX)',
  },
  {
    t: 'bullet',
    text: '**Merchant & Admin Layer** — Merchant Portal (Next.js 15 + React 19 · real-time order management · analytics · moderation)',
  },
  {
    t: 'bullet',
    text: '**Backend API Layer** — NestJS 11 · MongoDB Atlas · Redis · RabbitMQ · Sentry · ClickToPay · Twilio · DevSecOps CI/CD',
  },

  { t: 'h2', text: 'C. Key Technical Capabilities' },
  {
    t: 'bullet',
    text: '**Redis caching** — sub-100ms response times for all offer listings at scale',
  },
  {
    t: 'bullet',
    text: '**RabbitMQ** — asynchronous processing of thousands of concurrent orders without server blocking',
  },
  {
    t: 'bullet',
    text: '**MongoDB Atlas** — advanced aggregations + strict indexing for 150,000+ annual transactions',
  },
  {
    t: 'bullet',
    text: '**DevSecOps pipeline** — automated security scanning, secrets management, CI/CD in every deployment',
  },
  {
    t: 'bullet',
    text: '**Sentry** — real-time error tracking for payment security and frictionless UX',
  },

  { t: 'h2', text: 'D. Impact Audit Substrate' },
  {
    t: 'p',
    text: '**The same infrastructure that proves the product works proves the environmental outcomes.** Every transaction row in MongoDB is the primary data source for the IPTIC quarterly green impact report. DevSecOps pipeline + immutable transaction ledger + MongoDB aggregation framework = transaction-level CO\u2082 and food-diversion reporting that no competitor can match.',
  },

  { t: 'h2', text: 'E. Platform Scalability' },
  {
    t: 'table',
    headers: ['Metric', 'Y1 (Tunisia)', 'Y2 (+GCC)', 'Y3 (+Africa)'],
    rows: [
      ['Peak concurrent users', '5,000–10,000', '30,000', '100,000+'],
      ['Daily transactions', '500–1,000', '3,000', '10,000+'],
      ['Annual bags processed', '160,000', '~600,000', '~1,400,000'],
      ['MongoDB Atlas cluster', 'M10', 'M20', 'M30+ multi-region'],
      ['Architecture', 'Current stack', 'Auto-scaling', 'Multi-region failover'],
    ],
  },

  // ====== VIII. FINANCIAL PLAN ======
  { t: 'h1', text: 'VIII. FINANCIAL PLAN' },

  { t: 'h2', text: 'A. Project Cost (75,000 DT)' },
  {
    t: 'table',
    headers: ['Cost Component', 'DT', '%', 'Justification'],
    rows: [
      ['Constitution & Legal', '3,000', '4.0%', 'SUARL, RNE, IP / trademark protection'],
      [
        'Product Development',
        '9,000',
        '12.0%',
        'ClickToPay integration, UI/UX polish, security audit',
      ],
      [
        'Cloud Infrastructure (Y1)',
        '6,000',
        '8.0%',
        'MongoDB Atlas, Redis, Twilio SMS, Google Maps API',
      ],
      ['Equipment', '8,500', '11.3%', 'Workstations, Android/iOS test devices'],
      ['Marketing & Acquisition', '26,000', '34.7%', 'Meta/TikTok ads, B2B Partner Kits, SEO'],
      ['Operations & SaaS', '4,000', '5.3%', 'CRM, Swiver (accounting), workspace'],
      ['Contingency (8%)', '6,000', '8.0%', 'Technical debt buffer, server scaling'],
      ['Working Capital', '12,500', '16.7%', 'Liquidity for first 500 transactions'],
      ['**TOTAL**', '**75,000**', '**100%**', ''],
    ],
  },

  { t: 'h2', text: 'B. Financing' },
  {
    t: 'table',
    headers: ['Source', 'DT', '%'],
    rows: [
      ['Co-Founder personal equity (Wachwacha + Ouachouacha)', '5,000', '6.7%'],
      ['Start Green by IPTIC — Grant Request', '70,000', '93.3%'],
      ['**TOTAL**', '**75,000**', '**100%**'],
    ],
  },
  { t: 'p', text: 'No medium/long-term debt. No interest charges projected.' },

  { t: 'h2', text: 'C. Base Assumptions' },
  {
    t: 'table',
    headers: ['Assumption', 'Value'],
    rows: [
      ['Minimum Mystery Bag price', '5 DT'],
      ['Platform commission rate', '25%'],
      ['Merchant base subscription', '15 DT / month'],
      ['Merchant premium subscription', '50 DT / month'],
      ['Free months for new merchants', '2'],
      ['User → active buyer conversion', '16–20%'],
      ['Average purchase frequency', '2 bags / month / buyer'],
      ['VAT (TVA)', '19%'],
      ['Drop events budget (4 / year)', '~5,000 DT'],
      ['Annual cloud / APIs budget', '10,000 DT'],
      ['Commercial launch date', 'June 20, 2026'],
    ],
  },

  { t: 'h2', text: 'D. Year 1 Revenue Detail' },
  {
    t: 'table',
    headers: ['Revenue Stream', 'Calculation', 'Amount (DT)'],
    rows: [
      ['Transaction commission', '160,000 bags × 5 DT × 25%', '200,000'],
      ['Merchant base subscriptions', '800 × 15 DT × 10 months', '120,000'],
      ['**Gross Revenue Y1 (TTC)**', '', '**320,000**'],
    ],
  },

  { t: 'h2', text: 'E. 3-Year Revenue Summary' },
  {
    t: 'table',
    headers: ['', 'Year 1', 'Year 2', 'Year 3'],
    rows: [
      ['Merchants', '800', '1,500–2,000', '3,000–3,500'],
      ['Active users', '8,000', '~35,000', '~70,000'],
      ['Bags sold', '160,000', '~600,000', '~1,400,000'],
      ['Gross Revenue (TTC)', '320,000 DT', '1,222,500 DT', '2,287,500 DT'],
      ['Net Revenue (HT)', '~269,000 DT', '~1,027,300 DT', '~1,922,200 DT'],
    ],
  },

  { t: 'h2', text: 'F. Operating Expenses' },
  {
    t: 'table',
    headers: ['Category', 'Y1 (DT)', 'Y2 (DT)', 'Y3 (DT)'],
    rows: [
      ['Salaries (founders + team)', '~6,000', '15,000', '45,000'],
      ['Marketing & Acquisition', '26,000', '30,000', '80,000'],
      ['Cloud & Tech Operations', '10,000', '15,000', '25,000'],
      ['Operations & SaaS', '4,000', '5,000', '7,000'],
      ['Drop events (4/year)', '5,000', '5,000', '5,000'],
      ['Offices & Administration', '0 (remote)', '15,000', '30,000'],
      ['Amortization', '6,433', '6,433', '6,433'],
      ['**TOTAL**', '**~57,433**', '**~91,433**', '**~198,433**'],
    ],
  },

  { t: 'h2', text: 'G. Break-Even Analysis' },
  {
    t: 'table',
    headers: ['', 'Pessimistic', 'Base'],
    rows: [
      ['Forecast Revenue (HT)', '~200,000 DT', '~269,000 DT'],
      ['Variable Costs (cloud, prizes)', '15,000 DT', '15,000 DT'],
      ['Variable Cost Margin', '185,000 DT', '254,000 DT'],
      ['Margin Rate', '92.5%', '94.4%'],
      ['Fixed Costs', '~96,000 DT', '~96,000 DT'],
      ['**Break-even point**', '**~103,800 DT**', '**~101,700 DT**'],
      ['**Break-even in bags sold**', '**~30,000**', '**~28,000**'],
    ],
  },
  {
    t: 'p',
    text: '**Break-even reached at approximately 30,000 bags sold — achievable within 3–4 months of launch.**',
  },

  { t: 'h2', text: 'H. Forecast Profit & Loss' },
  {
    t: 'table',
    headers: ['', 'Y1 (DT)', 'Y2 (DT)', 'Y3 (DT)'],
    rows: [
      ['Revenue (TTC)', '320,000', '1,222,500', '2,287,500'],
      ['VAT (19%)', '(50,913)', '(195,200)', '(365,300)'],
      ['Net Revenue (HT)', '269,087', '1,027,300', '1,922,200'],
      ['Operating Expenses', '(105,000)', '(270,000)', '(567,000)'],
      ['**EBITDA**', '**164,087**', '**757,300**', '**1,355,200**'],
      ['Amortization', '(6,433)', '(6,433)', '(6,433)'],
      ['EBIT', '157,654', '750,867', '1,348,767'],
      ['Financial Charges', '0', '0', '0'],
      ['Pre-tax Income', '157,654', '750,867', '1,348,767'],
      ['Corporate Tax (15%)', '(23,648)', '(112,630)', '(202,315)'],
      ['**Net Income**', '**~134,000**', '**~638,000**', '**~1,146,000**'],
      ['Operating Cash Flow', '~160,000', '762,300', '1,362,200'],
      ['Cumulative Cash Flow', '~160,000', '~922,300', '~2,284,500'],
    ],
  },

  { t: 'h2', text: 'I. IRR, NPV & Payback' },
  { t: 'p', text: 'At a 15% discount rate (Tunisian risk-adjusted benchmark) over 3 years:' },
  {
    t: 'table',
    headers: ['Year', 'Net Cash Flow (DT)', 'Discounted CF (DT)'],
    rows: [
      ['Y0 — Investment', '(75,000)', '(75,000)'],
      ['Year 1', '~160,000', '~139,130'],
      ['Year 2', '762,300', '~576,885'],
      ['Year 3', '1,362,200', '~896,131'],
    ],
  },
  { t: 'bullet', text: '**IRR (3-year): ~180%**' },
  { t: 'bullet', text: '**NPV (3-year): ~1,537,146 DT**' },
  { t: 'bullet', text: '**Payback period: ~7 months from commercial launch**' },

  { t: 'h2', text: 'J. Profitability Ratios' },
  {
    t: 'table',
    headers: ['Ratio', 'Y1', 'Y2', 'Y3'],
    rows: [
      ['Net Margin', '~49.8%', '~62.1%', '~59.6%'],
      ['ROI', '179%', '851%', '1,528%'],
      ['Payback Period', '~7 months', '—', '—'],
      ['Revenue per Employee', '~53,817 DT', '~152,813 DT', '~128,147 DT'],
      ['EBITDA Margin', '61.0%', '73.7%', '70.5%'],
    ],
  },

  { t: 'h2', text: 'K. Green ROI — Grant Capital Conversion' },
  {
    t: 'table',
    headers: ['Metric', 'Year 1', '3-Year Cumulative'],
    rows: [
      ['Grant capital deployed', '70,000 DT', '70,000 DT'],
      ['Food rescued per DT of grant', '**2.74 kg**', '**37 kg**'],
      ['CO\u2082e avoided per DT of grant', '**6.86 kg**', '**92.6 kg**'],
      ['Meals delivered per DT of grant', '**~5.5**', '**~74**'],
      ['Merchants activated per 1,000 DT', '**~11**', '~50'],
      ['Users acquired per 1,000 DT', '**~714**', '~5,700'],
    ],
  },

  // ====== IX. ROADMAP ======
  { t: 'h1', text: 'IX. ROADMAP (Y1 TUNISIA · Y2 GCC · Y3 AFRICA)' },
  {
    t: 'table',
    headers: ['Phase', 'Period', 'Objectives'],
    rows: [
      [
        'Phase 0 — Pre-Launch',
        'Apr–Jun 2026',
        'SUARL incorporation; hire 4 team members; ClickToPay live; 100 founding merchants onboarded; 3rd-party security audit',
      ],
      [
        'Phase 1 — Launch',
        'Jun 20, 2026',
        'Commercial launch · Tunis + Sousse · App Store + Play Store live',
      ],
      [
        'Phase 2 — Traction',
        'Jul–Sep 2026',
        '200 merchants · 10,000 users · first Drop event · Sfax + Nabeul',
      ],
      [
        'Phase 3 — Growth',
        'Oct–Dec 2026',
        '500 merchants · 25,000 users · Premium subscription launched · Gabès + Djerba',
      ],
      [
        'Phase 4 — Y1 Scale',
        'Jun 20, 2027',
        '800 merchants · 50,000 users · profitability confirmed · 480 t CO\u2082e avoided',
      ],
      [
        'Phase 5 — GCC Entry',
        'Q2 2027',
        'Riyadh + Dubai commercial launch (Arabic UX Day 1); in-country sales managers hired',
      ],
      [
        'Phase 6 — GCC Expansion',
        'Q3–Q4 2027',
        'Doha + Manama + Kuwait City live; 200,000 users; 1,500–2,000 merchants',
      ],
      [
        'Phase 7 — Africa Entry',
        'Q1–Q2 2028',
        'Morocco (Casablanca/Rabat) + Egypt (Cairo/Alexandria)',
      ],
      [
        'Phase 8 — Africa Expansion',
        'Q3–Q4 2028',
        'Senegal (Dakar) via mobile-money rails; 350,000–400,000 users; 3,000–3,500 merchants',
      ],
    ],
  },

  // ====== X. RISK ANALYSIS ======
  { t: 'h1', text: 'X. RISK ANALYSIS' },
  {
    t: 'table',
    headers: ['Risk', 'Prob.', 'Impact', 'Mitigation'],
    rows: [
      [
        'Slow merchant adoption',
        'MEDIUM',
        'HIGH',
        '2 months free; dedicated B2B team; Partner Kits; ROI case studies',
      ],
      [
        'Insufficient consumer acquisition',
        'MEDIUM',
        'HIGH',
        'Meta/TikTok paid ads + viral gamification (Drops + Points)',
      ],
      [
        'ClickToPay integration delay',
        'LOW',
        'MEDIUM',
        'Cash-on-collect fallback ready; integration code written',
      ],
      [
        'Sole founder dependency',
        'HIGH',
        'HIGH',
        'Co-Founder active Day 1; 2 developers hired M-1; full code documentation',
      ],
      [
        'Save the Plate acceleration',
        'MEDIUM',
        'MEDIUM',
        'Tech + gamification + social mission = durable differentiation',
      ],
      ['Regulatory change', 'LOW', 'HIGH', 'Integrated legal counsel; Day-1 compliance'],
      [
        'Economic recession',
        'MEDIUM',
        'MEDIUM',
        'Counter-cyclical: cheaper food = more attractive in downturn',
      ],
      [
        'Excessive server costs',
        'LOW',
        'MEDIUM',
        '8% contingency buffer; auto-scaling architecture',
      ],
      [
        'Too Good To Go MENA entry',
        'LOW',
        'HIGH',
        'Tunisian anchor + brand loyalty + Arabic-first UX',
      ],
      [
        'Environmental outcome shortfall',
        'LOW',
        'HIGH',
        'Conservative projections (1.2 kg/bag vs industry ~1.5); real-time dashboard; quarterly IPTIC reporting',
      ],
      [
        'Reputational risk — unverified claims',
        'LOW',
        'HIGH',
        'MongoDB transaction ledger = audit substrate; 3rd-party annual CO\u2082 audit',
      ],
    ],
  },

  // ====== XI. THE ASK ======
  { t: 'h1', text: 'XI. THE ASK — ALLOCATION & GREEN OUTCOMES' },

  {
    t: 'p',
    text: '**Grant request from Start Green by IPTIC: 70,000 DT** (93.3% of total 75,000 DT project cost; founders contribute 5,000 DT personal equity — already committed, no external debt).',
  },

  { t: 'h2', text: 'A. Exact Allocation' },
  {
    t: 'table',
    headers: ['Line Item', 'DT', '%', 'Direct Outcome'],
    rows: [
      ['Marketing & Acquisition', '26,000', '34.7%', '50,000 users + 800 merchants onboarded'],
      ['Working Capital', '12,500', '16.7%', 'Liquidity for first 500 transactions'],
      [
        'Product (ClickToPay, audit, UI polish)',
        '9,000',
        '12.0%',
        'Payment live May 2026 + 3rd-party security audit closed',
      ],
      ['Equipment (workstations, test devices)', '8,500', '11.3%', 'Team of 6 fully operational'],
      [
        'Cloud Infrastructure (Y1)',
        '6,000',
        '8.0%',
        'MongoDB Atlas M10 · Redis · Twilio · Maps APIs',
      ],
      ['Contingency (8%)', '6,000', '8.0%', 'Scaling buffer, technical debt'],
      ['Operations & SaaS', '4,000', '5.3%', 'CRM, Swiver accounting, workspace'],
      ['Constitution & Legal', '3,000', '4.0%', 'SUARL · RNE · IP / trademark filings'],
      ['**TOTAL**', '**75,000**', '**100%**', ''],
    ],
  },

  { t: 'h2', text: 'B. 18-Month Outcome Metrics (Directly Tied to the Grant)' },
  { t: 'p', text: '**Environmental (primary scoring criterion):**' },
  { t: 'bullet', text: '**192 tonnes of edible food diverted from Tunisian landfills**' },
  {
    t: 'bullet',
    text: '**480 tonnes of CO\u2082-equivalent emissions avoided** (2.5 kg CO\u2082e/kg food — FAO/WRAP benchmark)',
  },
  { t: 'bullet', text: '**~17 tonnes of methane (CH\u2084) emissions avoided**' },
  {
    t: 'bullet',
    text: '**Equivalent to 104 passenger cars removed from Tunisian roads for 1 year**',
  },
  {
    t: 'bullet',
    text: '**384,000 affordable meals delivered** to price-sensitive Tunisian households',
  },

  { t: 'p', text: '**Market traction:**' },
  {
    t: 'bullet',
    text: '**800 merchant partners** across Tunis, Sousse, Sfax, Nabeul, Gabès, Djerba',
  },
  { t: 'bullet', text: '**50,000 registered consumer users · 8,000+ monthly active buyers**' },
  { t: 'bullet', text: '**160,000 transactions processed**' },

  { t: 'p', text: '**Financial viability:**' },
  { t: 'bullet', text: '**Capital payback in ~7 months post-launch**' },
  { t: 'bullet', text: '**Year 1 net profit ~160,000 DT (228% of grant)**' },
  { t: 'bullet', text: '**3-year IRR ~180% · NPV 1,537,146 DT**' },

  { t: 'p', text: '**Accountability (unique to Too Fresh To Waste):**' },
  {
    t: 'bullet',
    text: '**Real-time public impact dashboard** (24-hour refresh from MongoDB transaction ledger)',
  },
  { t: 'bullet', text: '**Quarterly PDF impact report** auto-generated and delivered to IPTIC' },
  {
    t: 'bullet',
    text: '**Annual 3rd-party CO\u2082 audit** funded from operating cash flow (no grant capital)',
  },

  {
    t: 'quote',
    text: '1 DT of IPTIC grant capital = 2.74 kg of edible food rescued + 6.86 kg of CO\u2082-equivalent avoided + 5.5 meals delivered in Year 1 alone. Over 3 years: 37 kg food + 92.6 kg CO\u2082e + 74 meals per DT.',
  },

  // ====== XII. CLOSING STATEMENT ======
  { t: 'h1', text: 'XII. CLOSING STATEMENT' },
  {
    t: 'p',
    text: 'Tunisia will generate another 2 million tonnes of food waste this year whether Start Green by IPTIC funds Too Fresh To Waste or not. The difference is whether **480 tonnes of CO\u2082-equivalent are avoided** by December 2027. The difference is whether **384,000 discounted meals** reach students who are skipping dinner tonight. The difference is whether a Tunisian-built, Arabic-first, production-grade platform becomes the MENA standard for food waste reduction — or whether Too Good To Go enters the market in 2028 with European capital and claims the opportunity Tunisian engineers already built. The platform is finished. The market is unclaimed. The environmental math is verifiable to the kilogram. **The only remaining variable is timing. The risk is not funding Too Fresh To Waste. The risk is watching someone else solve a Tunisian problem with non-Tunisian money — and paying the climate bill for the waste that was avoidable all along.**',
  },
  { t: 'spacer' },
  { t: 'p', text: '*The platform is ready. The market is waiting. The climate cannot.*' },
  {
    t: 'quote',
    text: 'We are not launching an app. We are building a national movement to end food waste — created by Tunisians, for Tunisians. — Salem Wachwacha, Founder',
  },

  // ====== XIII. ANNEXES ======
  { t: 'h1', text: 'XIII. ANNEXES' },
  { t: 'p', text: 'Documents attached to this submission:' },
  { t: 'bullet', text: '1. Complete CVs — Salem Wachwacha & Salem Ouachouacha' },
  {
    t: 'bullet',
    text: '2. Screenshots / Demo — Consumer App (mobile), Merchant Portal (web), Admin Dashboard',
  },
  { t: 'bullet', text: '3. Technical architecture diagram (detailed version)' },
  { t: 'bullet', text: '4. SUARL incorporation documents (upon completion)' },
  { t: 'bullet', text: '5. Trademark / IP registration filing — "Too Fresh To Waste" (Tunisia)' },
  { t: 'bullet', text: '6. Proof of domain ownership — toofreshtowaste.com' },
  { t: 'bullet', text: '7. ClickToPay payment gateway integration documentation' },
  { t: 'bullet', text: '8. Pro-forma merchant partnership letter (template)' },
  { t: 'bullet', text: '9. App Store & Google Play developer account registrations' },
  { t: 'bullet', text: '10. Start Green by IPTIC application reference number (upon assignment)' },
  {
    t: 'bullet',
    text: '11. Environmental impact methodology note (FAO/WRAP sources + calculation log)',
  },
  { t: 'bullet', text: '12. Glossary of technical terms' },
  { t: 'spacer' },
  {
    t: 'p',
    text: 'End of Business Plan · Too Fresh To Waste · Version 2.0 · April 2026 · CONFIDENTIAL',
  },
  {
    t: 'p',
    text: 'Website: toofreshtowaste.com · Support: support@toofreshtowaste.com · Social: social@toofreshtowaste.com',
  },
];

// ---------- 1B. logs.md SOURCE-OF-TRUTH PARSER -----------------------
// When logs.md is present, prefer it over the hard-coded fallback above so
// the generated plan stays in sync with the latest written draft.

const RX_ROMAN_H1 = /^(I{1,3}|IV|V|VI{0,3}|IX|X|XI{0,3}|XII|XIII)\.\s+[A-Za-zÀ-ÿ]/;
const RX_LETTER_H2 = /^[A-Z]\.\s+[A-Za-zÀ-ÿ]/;
const RX_NUMBERED_H3 = /^\d+\.\s+[A-Za-zÀ-ÿ]/;
const RX_BULLET = /^[•·▪]\s*/;

function classifyLogLine(line, index, { beforeToc = false } = {}) {
  if (!line) return { t: 'spacer' };

  if (index === 0 && line === line.toUpperCase() && /TOO FRESH/i.test(line)) {
    return { t: 'title', text: line };
  }

  if (index > 0 && index < 10 && /business plan/i.test(line)) {
    return { t: 'subtitle', text: line };
  }

  if (
    index < 15 &&
    (/prepared by/i.test(line) ||
      /^date\s*[:：]/i.test(line) ||
      /^website\s*[:：]?/i.test(line) ||
      /toofreshtowaste\.com/i.test(line) ||
      /support@/i.test(line) ||
      /social@/i.test(line) ||
      /\b(founder|co-founder|ceo|coo|cto|developer|technology leader)\b/i.test(line))
  ) {
    return { t: 'meta', text: line };
  }

  if (beforeToc && /^every 24 hours,/i.test(line)) {
    return { t: 'hook', text: line };
  }

  if (RX_BULLET.test(line)) {
    return { t: 'bullet', text: line.replace(RX_BULLET, '') };
  }

  if (RX_ROMAN_H1.test(line)) {
    return { t: 'h1', text: line };
  }

  if (RX_LETTER_H2.test(line) && line.length < 140) {
    return { t: 'h2', text: line };
  }

  if (RX_NUMBERED_H3.test(line) && line.length < 140) {
    return { t: 'h3', text: line };
  }

  return { t: 'p', text: line };
}

function parseLogs(src) {
  const rawLines = src.split(/\r?\n/);
  const lines = rawLines.map((line, index) =>
    line
      .replace(index === 0 ? /^\uFEFF/ : /$^/, '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+$/g, '')
      .trimStart(),
  );

  const blocks = [];
  let prevSpacer = false;
  let inToc = false;
  let sawToc = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const tblMatch = line.match(/^\[TBL:(\d+)\]$/);
    if (tblMatch) {
      const nCols = parseInt(tblMatch[1], 10);
      const cells = [];
      i++;
      while (i < lines.length && lines[i] !== '[/TBL]') {
        cells.push(lines[i]);
        i++;
      }
      if (cells.length < nCols) {
        for (const cell of cells) blocks.push({ t: 'p', text: cell || ' ' });
        prevSpacer = false;
        continue;
      }
      const headers = cells.slice(0, nCols);
      const rowFlat = cells.slice(nCols);
      const rows = [];
      for (let j = 0; j < rowFlat.length; j += nCols) {
        const row = rowFlat.slice(j, j + nCols);
        while (row.length < nCols) row.push('');
        rows.push(row);
      }
      const pad = value => (value && value.trim() ? value : ' ');
      blocks.push({
        t: 'table',
        headers: headers.map(pad),
        rows: rows.map(row => row.map(pad)),
      });
      prevSpacer = false;
      continue;
    }

    if (!line) {
      if (!prevSpacer && blocks.length > 0) blocks.push({ t: 'spacer' });
      prevSpacer = true;
      inToc = false;
      continue;
    }

    if (/^TABLE OF CONTENTS$/i.test(line)) {
      blocks.push({ t: 'h1', text: line });
      prevSpacer = false;
      inToc = true;
      sawToc = true;
      continue;
    }

    if (inToc) {
      blocks.push({ t: 'bullet', text: line });
      prevSpacer = false;
      continue;
    }

    const block = classifyLogLine(line, i, { beforeToc: !sawToc });
    blocks.push(block);
    prevSpacer = false;
  }

  while (blocks.length && blocks[blocks.length - 1].t === 'spacer') blocks.pop();
  return blocks;
}

function loadBusinessPlanBlocks(logsPath = LOGS_PATH) {
  if (!fs.existsSync(logsPath)) return DEFAULT_CONTENT;

  const src = fs.readFileSync(logsPath, 'utf8');
  const blocks = parseLogs(src);
  return blocks.length > 0 ? blocks : DEFAULT_CONTENT;
}

// ---------- 2. MARKDOWN EMITTER ---------------------------------------
function toMarkdown(blocks) {
  const out = [];
  for (const b of blocks) {
    switch (b.t) {
      case 'title':
        out.push(`# ${b.text}`, '');
        break;
      case 'subtitle':
        out.push(`### ${b.text}`, '');
        break;
      case 'meta':
        out.push(`*${b.text}*`, '');
        break;
      case 'hook':
        out.push(`> **${b.text}**`, '');
        break;
      case 'h1':
        out.push(`## ${b.text}`, '');
        break;
      case 'h2':
        out.push(`### ${b.text}`, '');
        break;
      case 'h3':
        out.push(`#### ${b.text}`, '');
        break;
      case 'p':
        out.push(b.text, '');
        break;
      case 'quote':
        out.push(`> ${b.text}`, '');
        break;
      case 'bullet':
        out.push(`- ${b.text}`);
        break;
      case 'spacer':
        out.push('');
        break;
      case 'table': {
        out.push(`| ${b.headers.join(' | ')} |`);
        out.push(`|${b.headers.map(() => '---').join('|')}|`);
        for (const r of b.rows) out.push(`| ${r.join(' | ')} |`);
        out.push('');
        break;
      }
    }
  }
  // Collapse trailing blanks
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
}

// ---------- 3. DOCX EMITTER -------------------------------------------
// Minimal OOXML generator. Uses standard styles.

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Parse **bold** inline spans -> array of {text, bold}
function parseInline(text) {
  const parts = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0,
    m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), bold: false });
    parts.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), bold: false });
  if (parts.length === 0) parts.push({ text: '', bold: false });
  return parts;
}

function runs(text, { bold = false, italic = false, color = null, size = null } = {}) {
  const spans = parseInline(text);
  return spans
    .map(s => {
      const rpr = [];
      if (bold || s.bold) rpr.push('<w:b/><w:bCs/>');
      if (italic) rpr.push('<w:i/>');
      if (color) rpr.push(`<w:color w:val="${color}"/>`);
      if (size) rpr.push(`<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`);
      const rprXml = rpr.length ? `<w:rPr>${rpr.join('')}</w:rPr>` : '';
      return `<w:r>${rprXml}<w:t xml:space="preserve">${xmlEscape(s.text)}</w:t></w:r>`;
    })
    .join('');
}

function para(
  text,
  {
    style = null,
    align = null,
    bold = false,
    italic = false,
    color = null,
    size = null,
    spaceAfter = 120,
    spaceBefore = 0,
  } = {},
) {
  const pPr = [];
  if (style) pPr.push(`<w:pStyle w:val="${style}"/>`);
  if (align) pPr.push(`<w:jc w:val="${align}"/>`);
  pPr.push(`<w:spacing w:before="${spaceBefore}" w:after="${spaceAfter}"/>`);
  const pPrXml = `<w:pPr>${pPr.join('')}</w:pPr>`;
  return `<w:p>${pPrXml}${runs(text, { bold, italic, color, size })}</w:p>`;
}

function bulletPara(text) {
  return `<w:p><w:pPr><w:pStyle w:val="ListBullet"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:before="0" w:after="80"/></w:pPr>${runs(text)}</w:p>`;
}

function tableXml(headers, rows) {
  const colCount = headers.length;
  // Fixed table width = ~9000 twips (usable area in A4 w/ 1440 margins)
  const colW = Math.floor(9000 / colCount);
  const gridCols = Array(colCount).fill(`<w:gridCol w:w="${colW}"/>`).join('');
  const mkCell = (text, { header = false } = {}) => {
    const shd = header ? '<w:shd w:val="clear" w:color="auto" w:fill="005250"/>' : '';
    const runOpts = header ? { bold: true, color: 'FFFFFF' } : {};
    return `<w:tc><w:tcPr><w:tcW w:w="${colW}" w:type="dxa"/>${shd}<w:tcBorders><w:top w:val="single" w:sz="4" w:color="B0B0B0"/><w:left w:val="single" w:sz="4" w:color="B0B0B0"/><w:bottom w:val="single" w:sz="4" w:color="B0B0B0"/><w:right w:val="single" w:sz="4" w:color="B0B0B0"/></w:tcBorders></w:tcPr><w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr>${runs(text, runOpts)}</w:p></w:tc>`;
  };
  const headerRow = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${headers.map(h => mkCell(h, { header: true })).join('')}</w:tr>`;
  const bodyRows = rows.map(r => `<w:tr>${r.map(c => mkCell(c)).join('')}</w:tr>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblLook w:val="04A0"/></w:tblPr><w:tblGrid>${gridCols}</w:tblGrid>${headerRow}${bodyRows}</w:tbl><w:p><w:pPr><w:spacing w:before="0" w:after="120"/></w:pPr></w:p>`;
}

function buildDocumentXml(blocks) {
  const body = [];
  for (const b of blocks) {
    switch (b.t) {
      case 'title':
        body.push(
          para(b.text, {
            align: 'center',
            bold: true,
            size: '52',
            color: '005250',
            spaceBefore: 240,
            spaceAfter: 120,
          }),
        );
        break;
      case 'subtitle':
        body.push(
          para(b.text, {
            align: 'center',
            bold: true,
            size: '28',
            color: '444444',
            spaceAfter: 80,
          }),
        );
        break;
      case 'meta':
        body.push(
          para(b.text, {
            align: 'center',
            italic: true,
            size: '20',
            color: '666666',
            spaceAfter: 60,
          }),
        );
        break;
      case 'hook':
        // Highlighted box effect via bold + larger + teal
        body.push(
          `<w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="24" w:color="F55449"/><w:left w:val="single" w:sz="24" w:color="F55449"/><w:bottom w:val="single" w:sz="24" w:color="F55449"/><w:right w:val="single" w:sz="24" w:color="F55449"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="FFF5F4"/><w:spacing w:before="240" w:after="240"/><w:ind w:left="240" w:right="240"/><w:jc w:val="center"/></w:pPr>${runs(b.text, { bold: true, size: '28', color: '005250' })}</w:p>`,
        );
        break;
      case 'h1':
        body.push(
          `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="18" w:color="005250"/></w:pBdr><w:spacing w:before="360" w:after="180"/></w:pPr>${runs(b.text, { bold: true, size: '36', color: '005250' })}</w:p>`,
        );
        break;
      case 'h2':
        body.push(
          para(b.text, {
            bold: true,
            size: '28',
            color: '005250',
            spaceBefore: 200,
            spaceAfter: 100,
          }),
        );
        break;
      case 'h3':
        body.push(
          para(b.text, {
            bold: true,
            size: '24',
            color: '333333',
            spaceBefore: 160,
            spaceAfter: 80,
          }),
        );
        break;
      case 'p':
        body.push(para(b.text, { size: '22', spaceAfter: 140 }));
        break;
      case 'quote':
        body.push(
          `<w:p><w:pPr><w:pBdr><w:left w:val="single" w:sz="24" w:color="F55449"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="FFFAF0"/><w:spacing w:before="120" w:after="160"/><w:ind w:left="360" w:right="240"/></w:pPr>${runs(b.text, { italic: true, bold: true, size: '24', color: '005250' })}</w:p>`,
        );
        break;
      case 'bullet':
        body.push(bulletPara(b.text));
        break;
      case 'spacer':
        body.push('<w:p><w:pPr><w:spacing w:before="80" w:after="80"/></w:pPr></w:p>');
        break;
      case 'table':
        body.push(tableXml(b.headers, b.rows));
        break;
    }
  }
  const sectPr = `<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1200" w:right="1200" w:bottom="1200" w:left="1200" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>
${body.join('\n')}
${sectPr}
</w:body>
</w:document>`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:lang w:val="en-US"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr><w:spacing w:after="120" w:line="280" w:lineRule="auto"/></w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListBullet">
    <w:name w:val="List Bullet"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr>
  </w:style>
</w:styles>`;

const NUMBERING_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="\u2022"/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr>
      <w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOC_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`;

// ---------- 4. ZIP BUILDER (stored method) ----------------------------
// Manual .docx packaging. No external deps.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(files) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const dataBuf = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const crc = crc32(dataBuf);
    const size = dataBuf.length;

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0, 6);
    lfh.writeUInt16LE(0, 8); // method: store
    lfh.writeUInt16LE(0, 10); // mod time
    lfh.writeUInt16LE(0x5821, 12); // mod date arbitrary
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(size, 18);
    lfh.writeUInt32LE(size, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);
    local.push(Buffer.concat([lfh, nameBuf, dataBuf]));

    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(0, 8);
    cdh.writeUInt16LE(0, 10);
    cdh.writeUInt16LE(0, 12);
    cdh.writeUInt16LE(0x5821, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(size, 20);
    cdh.writeUInt32LE(size, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30);
    cdh.writeUInt16LE(0, 32);
    cdh.writeUInt16LE(0, 34);
    cdh.writeUInt16LE(0, 36);
    cdh.writeUInt32LE(0, 38);
    cdh.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cdh, nameBuf]));

    offset += 30 + nameBuf.length + size;
  }
  const localBuf = Buffer.concat(local);
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(localBuf.length, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([localBuf, centralBuf, eocd]);
}

function writeFileSyncWithBusyFallback(targetPath, data, options) {
  try {
    fs.writeFileSync(targetPath, data, options);
    return targetPath;
  } catch (error) {
    if (error && error.code === 'EBUSY') {
      const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const parsed = path.parse(targetPath);
      const fallbackPath = path.join(parsed.dir, `${parsed.name}_${stamp}${parsed.ext}`);
      fs.writeFileSync(fallbackPath, data, options);
      console.warn(`Target locked, wrote fallback output instead: ${fallbackPath}`);
      return fallbackPath;
    }
    throw error;
  }
}

// ---------- 5. BUILD --------------------------------------------------
function main() {
  const OUT_DIR = __dirname;
  const MD_PATH = path.join(OUT_DIR, 'Too_Fresh_To_Waste_Business_Plan_v2.md');
  const DOCX_PATH = path.join(OUT_DIR, 'Too_Fresh_To_Waste_Business_Plan_v2.docx');
  const content = loadBusinessPlanBlocks();

  // Markdown
  const md = toMarkdown(content);
  const writtenMdPath = writeFileSyncWithBusyFallback(MD_PATH, md, 'utf8');
  console.log('MD  :', writtenMdPath, `(${md.length} chars)`);

  // Docx
  const documentXml = buildDocumentXml(content);
  const files = [
    { name: '[Content_Types].xml', data: CONTENT_TYPES_XML },
    { name: '_rels/.rels', data: ROOT_RELS_XML },
    { name: 'word/_rels/document.xml.rels', data: DOC_RELS_XML },
    { name: 'word/document.xml', data: documentXml },
    { name: 'word/styles.xml', data: STYLES_XML },
    { name: 'word/numbering.xml', data: NUMBERING_XML },
  ];
  const zipBuf = buildZip(files);
  const writtenDocxPath = writeFileSyncWithBusyFallback(DOCX_PATH, zipBuf);
  console.log('DOCX:', writtenDocxPath, `(${zipBuf.length} bytes)`);
}

if (require.main === module) {
  main();
}

module.exports = {
  parseLogs,
  loadBusinessPlanBlocks,
  toMarkdown,
  buildDocumentXml,
  buildZip,
  CONTENT_TYPES_XML,
  ROOT_RELS_XML,
  DOC_RELS_XML,
  STYLES_XML,
  NUMBERING_XML,
};
