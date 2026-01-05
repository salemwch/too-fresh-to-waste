Tunisia SEO Implementation Strategy for "Too Fresh To Waste"

Executive Summary

Goal: Achieve maximum visibility in Tunisia's digital market (10.5M internet
users, 84.9% penetration) across Arabic, French, and English search ecosystems.

Market Context:

- Tunisia population: ~12.4 million | Internet users: 10.5M (85%)
- Mobile connections: 15.7M (128% of population) - Mobile-first critical
- Search behavior: Arabic + French + English (multilingual market)
- Competitors: Glovo (market leader), Yassir, MenuTium

---

Phase 1: Multilingual Architecture (Priority: Critical)

1.1 Language Strategy

| Language | Code  | Target Audience                     | Priority  |
| -------- | ----- | ----------------------------------- | --------- |
| French   | fr-TN | Business users, urban professionals | Primary   |
| Arabic   | ar-TN | Mass market, local consumers        | Primary   |
| English  | en    | International, tech-savvy users     | Secondary |

1.2 URL Structure Options

Option A: Subdirectories (Recommended) toofreshwaste.tn/ → French (default)
toofreshwaste.tn/ar/ → Arabic toofreshwaste.tn/en/ → English

- Pros: Single domain authority, easier maintenance, lower cost
- Cons: Slightly less geo-targeting signal

Option B: Subdomains fr.toofreshwaste.tn ar.toofreshwaste.tn

- Pros: Clear language separation
- Cons: Split domain authority, more complex setup

Option C: ccTLD (Country Code) toofreshwaste.tn → Tunisia-specific domain

- Pros: Strongest local signal, instant trust in Tunisia
- Cons: Requires .tn domain registration

  1.3 Next.js i18n Configuration

// next.config.js const nextConfig = { i18n: { locales: ['fr-TN', 'ar-TN',
'en'], defaultLocale: 'fr-TN', localeDetection: true, }, // RTL support for
Arabic }

1.4 Hreflang Implementation

  <link rel="alternate" hreflang="fr-TN" href="https://toofreshwaste.tn/" />
  <link rel="alternate" hreflang="ar-TN" href="https://toofreshwaste.tn/ar/" />
  <link rel="alternate" hreflang="en" href="https://toofreshwaste.tn/en/" />
  <link rel="alternate" hreflang="x-default" href="https://toofreshwaste.tn/" />

---

Phase 2: Local SEO for Tunisia

2.1 Google Business Profile Setup

Critical for 46% of searches with local intent

Business Name: Too Fresh To Waste Tunisia Category: Primary: Food Delivery
Service Secondary: Restaurant, Environmental Conservation Organization

Service Area: - Tunis (Greater Tunis) - Sousse - Sfax - Monastir - Hammamet

Languages: French, Arabic, English

Attributes: - Mobile app available - Online ordering - Contactless delivery -
Eco-friendly

2.2 Tunisia-Specific Keywords (Trilingual)

French Keywords: | Keyword | Search Intent | Monthly Volume (Est.) |
|--------------------------------|---------------|-----------------------| |
gaspillage alimentaire tunisie | informational | Medium | | nourriture pas cher
tunis | transactional | High | | resto surplus tunis | transactional | Medium |
| anti gaspillage alimentaire | informational | Medium | | repas à petit prix
tunisie | transactional | High | | livraison nourriture tunis | transactional |
Very High |

Arabic Keywords: | Keyword | Transliteration | Intent |
|---------------------|-----------------------------|---------------| | هدر
الطعام تونس | hadr al-ta'am tunis | informational | | طعام رخيص تونس | ta'am
rakhis tunis | transactional | | توصيل طعام تونس | tawsil ta'am tunis |
transactional | | وجبات بأسعار منخفضة | wajabat bi-as'ar munkhafida |
transactional | | تطبيق طعام تونس | tatbiq ta'am tunis | transactional |

English Keywords:

- food waste app tunisia
- cheap food delivery tunis
- surplus food deals tunisia
- restaurant discounts tunisia

  2.3 Local Citations (NAP+W Consistency)

Priority Directories for Tunisia:

1. Google Business Profile (Critical)
2. Facebook Business Page (7.25M social users)
3. Instagram Business
4. Foursquare/Swarm
5. TripAdvisor Tunisia
6. Local directories: Tunisie-annuaire.com, Annuaire-tunisie.net
7. Industry: Just Eat, Talabat (regional presence)

---

Phase 3: Technical SEO Excellence

3.1 Core Web Vitals Targets

| Metric                          | Target  | Current Status |
| ------------------------------- | ------- | -------------- |
| LCP (Largest Contentful Paint)  | < 2.5s  | Audit needed   |
| INP (Interaction to Next Paint) | < 200ms | Audit needed   |
| CLS (Cumulative Layout Shift)   | < 0.1   | Audit needed   |

3.2 Mobile-First Optimizations

// Priority optimizations for Tunisia's mobile-dominant market // Average mobile
speed: 26.56 Mbps

1. Image optimization:
   - WebP/AVIF formats (already configured ✓)
   - Lazy loading with blur placeholders
   - Responsive srcset for device sizes

2. Font optimization:
   - Arabic: Noto Sans Arabic (variable font)
   - French: Inter or system fonts
   - Font-display: swap

3. JavaScript optimization:
   - Dynamic imports for non-critical features
   - Route-based code splitting
   - Tree shaking

3.3 Updated Structured Data

FoodEstablishment + MobileApplication Schema:

{ "@context": "https://schema.org", "@type": "MobileApplication", "name": "Too
Fresh To Waste", "operatingSystem": "Android, iOS", "applicationCategory":
"FoodApplication", "offers": { "@type": "Offer", "price": "0", "priceCurrency":
"TND" }, "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8",
"ratingCount": "1250" }, "availableLanguage": ["fr", "ar", "en"], "areaServed":
{ "@type": "Country", "name": "Tunisia" } }

LocalBusiness Schema for Tunisia:

{ "@context": "https://schema.org", "@type": "FoodEstablishment", "name": "Too
Fresh To Waste Tunisia", "image": "https://toofreshwaste.tn/images/logo.png",
"@id": "https://toofreshwaste.tn", "url": "https://toofreshwaste.tn",
"telephone": "+216-XX-XXX-XXX", "address": { "@type": "PostalAddress",
"streetAddress": "[Your Tunisia Address]", "addressLocality": "Tunis",
"addressRegion": "Tunis", "postalCode": "1000", "addressCountry": "TN" }, "geo":
{ "@type": "GeoCoordinates", "latitude": 36.8065, "longitude": 10.1815 },
"openingHoursSpecification": [...], "servesCuisine": "Multi-cuisine",
"priceRange": "TND", "acceptsReservations": false, "hasMenu":
"https://toofreshwaste.tn/offers", "potentialAction": { "@type": "OrderAction",
"target": { "@type": "EntryPoint", "urlTemplate":
"https://toofreshwaste.tn/order", "inLanguage": ["fr", "ar", "en"],
"actionPlatform": [ "http://schema.org/DesktopWebPlatform",
"http://schema.org/MobileWebPlatform", "http://schema.org/AndroidPlatform",
"http://schema.org/IOSPlatform" ] } } }

---

Phase 4: Content Strategy for Tunisia

4.1 Content Pillars (4-6 Max for Topical Authority)

1. Food Waste Education (Arabic + French)


    - هدر الطعام في تونس / Le gaspillage alimentaire en Tunisie
    - Statistics, environmental impact, solutions

2. Local Restaurant Partners


    - Restaurant profiles in Tunis, Sousse, Sfax
    - User reviews and ratings (Arabic-first)

3. Money-Saving Tips


    - كيف توفر المال على الطعام / Comment économiser sur la nourriture
    - Budget meal guides for Tunisian families

4. App Guides & How-To


    - Step-by-step guides in all 3 languages
    - Video content for Arabic audience

4.2 Content Calendar Framework

| Week | French Content               | Arabic Content  | Format        |
| ---- | ---------------------------- | --------------- | ------------- |
| 1    | Partner restaurant spotlight | نفس المحتوى     | Blog + Social |
| 2    | Food saving tips             | نصائح للتوفير   | Video + Blog  |
| 3    | User success story           | قصة نجاح مستخدم | Social + Blog |
| 4    | Sustainability facts         | حقائق الاستدامة | Infographic   |

4.3 E-E-A-T Signals for Tunisia

- Author profiles with local credentials
- Partnerships with Tunisian NGOs (environmental)
- Press mentions in La Presse, Tunisie Numerique
- Local expert quotes and interviews
- User-generated reviews and testimonials

---

Phase 5: Performance Monitoring

5.1 KPIs Dashboard

| Metric                    | Tool               | Target (6 months) |
| ------------------------- | ------------------ | ----------------- |
| Organic Traffic (Tunisia) | GA4 + GSC          | +300%             |
| Local Pack Rankings       | BrightLocal        | Top 3 in Tunis    |
| Core Web Vitals Pass      | PageSpeed Insights | All green         |
| Keyword Rankings (fr-TN)  | Ahrefs/SEMrush     | 50 in Top 10      |
| Keyword Rankings (ar-TN)  | Ahrefs/SEMrush     | 30 in Top 10      |
| GBP Profile Views         | GBP Insights       | 10K/month         |
| App Store Ranking         | App Annie          | Top 10 Food       |

5.2 Tools Setup

Analytics: - Google Analytics 4 (with Tunisia segment) - Google Search Console
(verify .tn domain)

Rank Tracking: - Ahrefs (Arabic + French tracking) - BrightLocal (local pack
monitoring)

Technical: - Google PageSpeed Insights - Lighthouse CI - Screaming Frog
(multilingual crawl)

Local: - Google Business Profile Manager - Whitespark (citation audit)

---

Phase 6: Implementation Roadmap

Week 1-2: Foundation

- Register .tn domain (toofreshwaste.tn)
- Set up Next.js i18n with next-intl
- Create Google Business Profile
- Update seo.config.ts for Tunisia

Week 3-4: Technical

- Implement hreflang tags
- Add RTL support for Arabic
- Update structured data schemas
- Core Web Vitals audit and fixes

Week 5-6: Content

- Translate homepage (French + Arabic)
- Create location-specific landing pages
- Build local citation profile
- Set up social media (Facebook, Instagram)

Week 7-8: Launch & Monitor

- Submit sitemap to Google
- Configure GA4 + GSC
- Launch GBP optimization
- Begin content marketing

---

Updated SEO Configuration for Tunisia

Here's the proposed update to your seo.config.ts:

export const seoConfig = { // Base metadata - Trilingual title: { fr: 'Too Fresh
To Waste - Réduisez le Gaspillage, Économisez', ar: 'Too Fresh To Waste - قلل
الهدر، وفر المال', en: 'Too Fresh To Waste - Reduce Food Waste, Save Money', },
description: { fr: 'Connectez-vous aux restaurants locaux en Tunisie pour sauver
la nourriture en surplus. Économisez de l\'argent tout en luttant contre le
gaspillage alimentaire.', ar: 'تواصل مع المطاعم المحلية في تونس لإنقاذ الطعام
الفائض. وفر المال وساهم في مكافحة هدر الطعام.', en: 'Connect with local
restaurants in Tunisia to rescue surplus food. Save money while fighting food
waste.', },

    // Tunisia-specific keywords
    keywords: {
      fr: 'gaspillage alimentaire tunisie, nourriture pas cher tunis, resto surplus, anti gaspillage, livraison nourriture tunisie',
      ar: 'هدر الطعام تونس، طعام رخيص تونس، توصيل طعام، وجبات بأسعار منخفضة',
      en: 'food waste tunisia, cheap food tunis, surplus food, food delivery tunisia',
    },

    // URLs
    url: 'https://toofreshwaste.tn',
    siteName: 'Too Fresh To Waste Tunisia',
    locales: ['fr-TN', 'ar-TN', 'en'],
    defaultLocale: 'fr-TN',

    // Contact - Tunisia
    email: 'contact@toofreshwaste.tn',
    phone: '+216-XX-XXX-XXX',

    // Business info for structured data
    business: {
      name: 'Too Fresh To Waste Tunisia',
      legalName: 'Too Fresh To Waste SARL',
      foundingDate: '2024',
      address: {
        streetAddress: '[Tunisia Address]',
        addressLocality: 'Tunis',
        addressRegion: 'Tunis',
        postalCode: '1000',
        addressCountry: 'TN',
      },
      geo: {
        latitude: 36.8065,
        longitude: 10.1815,
      },
      serviceAreas: ['Tunis', 'Sousse', 'Sfax', 'Monastir', 'Hammamet'],
    },

    // Social media
    social: {
      facebook: 'toofreshwastetunisie',
      instagram: '@toofreshwaste_tn',
      linkedin: 'company/too-fresh-to-waste-tunisia',
    },

} as const;

---

Sources

- https://firstpagesage.com/seo-blog/seo-best-practices/
- https://backlinko.com/seo-strategy
- https://mapsofarabia.com/seo-agency-in-tunisia/
- https://thatware.co/seo-services-tunisia/
- https://datareportal.com/reports/digital-2025-tunisia
- https://developers.google.com/search/docs/appearance/structured-data/local-business
- https://befoundonline.com/blog/why-schema-markup-is-crucial-for-restaurant-seo-in-2025
- https://nextjs.org/docs/pages/guides/internationalization
- https://nextjs.org/learn/seo/web-performance
- https://sensortower.com/blog/2024-q3-unified-top-5-food%20delivery%20services-units-tn-63da96fbe1714cfff1c1e5a1
