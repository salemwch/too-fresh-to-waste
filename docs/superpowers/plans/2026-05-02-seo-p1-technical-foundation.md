# SEO Plan 1: Technical Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install JSON-LD structured data across all Tier-1 pages, fix OG image,
fix canonical URL bug in sitemap, upgrade sitemap coverage, and harden Core Web
Vitals.

**Architecture:** Reusable TypeScript schema components render
`<script type="application/ld+json">` in `<head>` via `generateMetadata`
alternates + inline scripts. Each page composes only the schemas it needs. Fixes
to `seo.config.ts` correct a locale-prefix bug affecting the sitemap.

**Tech Stack:** Next.js 15 App Router, TypeScript, `next/font/google`, Jest +
RTL

---

## File Map

**Create:**

- `apps/web/src/components/seo/schemas/index.ts` — barrel export
- `apps/web/src/components/seo/schemas/organization-schema.tsx`
- `apps/web/src/components/seo/schemas/website-schema.tsx`
- `apps/web/src/components/seo/schemas/article-schema.tsx`
- `apps/web/src/components/seo/schemas/faq-schema.tsx`
- `apps/web/src/components/seo/schemas/software-app-schema.tsx`
- `apps/web/src/components/seo/schemas/donate-action-schema.tsx`
- `apps/web/src/components/seo/schemas/breadcrumb-schema.tsx`
- `apps/web/src/components/seo/schemas/webpage-schema.tsx`
- `apps/web/src/components/seo/schemas/event-schema.tsx`
- `apps/web/src/app/[locale]/opengraph-image.tsx`
- `apps/web/src/__tests__/seo/schemas.test.tsx`

**Modify:**

- `apps/web/src/config/seo.config.ts` — fix `getCanonicalUrl` locale-prefix
  bug + add `getSchemaOrgUrl`
- `apps/web/src/app/sitemap.ts` — expand coverage, fix locale prefix, add
  priority map
- `apps/web/src/app/[locale]/layout.tsx` — add canonical alternates in
  `generateMetadata`
- `apps/web/src/app/[locale]/(marketing)/page.tsx` — add `priority` to hero
  image, add schemas
- `apps/web/src/app/[locale]/(marketing)/food-waste-facts/page.tsx` — add
  FAQPage schema
- `apps/web/src/app/[locale]/(marketing)/humanity-mission/page.tsx` — add
  Organization + DonateAction schema
- `apps/web/src/app/[locale]/(marketing)/esg/page.tsx` — add Article schema
- `apps/web/src/app/[locale]/(marketing)/consumer/page.tsx` — add
  SoftwareApplication schema
- `apps/web/src/app/[locale]/(marketing)/marketplace-surprise-bag/page.tsx` —
  add SoftwareApplication + FAQPage schema
- `apps/web/src/app/[locale]/(marketing)/contact/page.tsx` — add ContactPage
  schema

---

## Task 1: Fix `getCanonicalUrl` locale-prefix bug + add schema helper

**Context:** `seo.config.ts` line 177 skips the locale prefix for
`defaultLocale` ('en'), but `routing.ts` uses `localePrefix: 'always'` — meaning
`/en/` is required in all URLs. This causes wrong canonical URLs in the sitemap.

**Files:** `apps/web/src/config/seo.config.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/__tests__/seo/schemas.test.tsx`:

```typescript
import { getCanonicalUrl } from '@/config/seo.config';

describe('getCanonicalUrl', () => {
  it('includes locale prefix for default locale (en)', () => {
    expect(getCanonicalUrl('/', 'en')).toBe('https://toofreshwaste.tn/en');
  });

  it('includes locale prefix for fr', () => {
    expect(getCanonicalUrl('/blog', 'fr')).toBe(
      'https://toofreshwaste.tn/fr/blog',
    );
  });

  it('includes locale prefix for ar', () => {
    expect(getCanonicalUrl('/contact', 'ar')).toBe(
      'https://toofreshwaste.tn/ar/contact',
    );
  });

  it('handles root path without trailing slash', () => {
    expect(getCanonicalUrl('/', 'fr')).toBe('https://toofreshwaste.tn/fr');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @foodwaste/web test -- --testPathPattern="seo/schemas" --no-coverage
```

Expected: FAIL — `getCanonicalUrl('/', 'en')` returns
`'https://toofreshwaste.tn'` (missing `/en`)

- [ ] **Step 3: Fix `getCanonicalUrl` in seo.config.ts**

Replace lines 175-180 in `apps/web/src/config/seo.config.ts`:

```typescript
// Helper to get full URL with locale — localePrefix: 'always' means every locale
// including the default gets an explicit prefix in the URL.
export function getCanonicalUrl(path: string, locale: Locale): string {
  const baseUrl = seoConfig.url;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const normalizedPath = cleanPath === '/' ? '' : cleanPath;
  return `${baseUrl}/${locale}${normalizedPath}`;
}

// Returns the base URL for schema.org @id fields (always the en canonical)
export function getSchemaOrgUrl(path: string): string {
  return getCanonicalUrl(path, 'en');
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @foodwaste/web test -- --testPathPattern="seo/schemas" --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/config/seo.config.ts apps/web/src/__tests__/seo/schemas.test.tsx
git commit -m "fix(seo): correct canonical URL locale prefix — always include locale segment"
```

---

## Task 2: JSON-LD schema components

**Files:** `apps/web/src/components/seo/schemas/` (all files)

- [ ] **Step 1: Write tests for schema components**

Append to `apps/web/src/__tests__/seo/schemas.test.tsx`:

```typescript
import { render } from '@testing-library/react';
import { OrganizationSchema } from '@/components/seo/schemas/organization-schema';
import { WebSiteSchema } from '@/components/seo/schemas/website-schema';
import { ArticleSchema } from '@/components/seo/schemas/article-schema';
import { FAQSchema } from '@/components/seo/schemas/faq-schema';
import { BreadcrumbSchema } from '@/components/seo/schemas/breadcrumb-schema';

function getJsonLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(script).toBeTruthy();
  return JSON.parse(script!.textContent!);
}

describe('OrganizationSchema', () => {
  it('renders Organization type with required fields', () => {
    const { container } = render(<OrganizationSchema locale="en" />);
    const data = getJsonLd(container);
    expect(data['@type']).toBe('Organization');
    expect(data.name).toBe('Too Fresh To Waste Tunisia');
    expect(data.url).toContain('toofreshwaste.tn');
  });
});

describe('WebSiteSchema', () => {
  it('renders WebSite with SearchAction', () => {
    const { container } = render(<WebSiteSchema />);
    const data = getJsonLd(container);
    expect(data['@type']).toBe('WebSite');
    expect(data.potentialAction?.['@type']).toBe('SearchAction');
  });
});

describe('ArticleSchema', () => {
  it('renders Article with author', () => {
    const { container } = render(
      <ArticleSchema
        title="Test Article"
        description="A test description"
        publishedAt="2026-05-01"
        updatedAt="2026-05-01"
        url="https://toofreshwaste.tn/en/blog/test"
        authorName="John Doe"
        locale="en"
      />
    );
    const data = getJsonLd(container);
    expect(data['@type']).toBe('Article');
    expect(data.author?.name).toBe('John Doe');
  });
});

describe('FAQSchema', () => {
  it('renders FAQPage with questions', () => {
    const faqs = [
      { question: 'What is a surprise bag?', answer: 'A bag of surplus food.' },
    ];
    const { container } = render(<FAQSchema items={faqs} />);
    const data = getJsonLd(container);
    expect(data['@type']).toBe('FAQPage');
    expect(data.mainEntity).toHaveLength(1);
    expect(data.mainEntity[0]['@type']).toBe('Question');
  });
});

describe('BreadcrumbSchema', () => {
  it('renders BreadcrumbList', () => {
    const items = [
      { name: 'Home', url: 'https://toofreshwaste.tn/en' },
      { name: 'Blog', url: 'https://toofreshwaste.tn/en/blog' },
    ];
    const { container } = render(<BreadcrumbSchema items={items} />);
    const data = getJsonLd(container);
    expect(data['@type']).toBe('BreadcrumbList');
    expect(data.itemListElement).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @foodwaste/web test -- --testPathPattern="seo/schemas" --no-coverage
```

Expected: FAIL — modules not found

- [ ] **Step 3: Create `organization-schema.tsx`**

Create `apps/web/src/components/seo/schemas/organization-schema.tsx`:

```typescript
import { seoConfig, getSchemaOrgUrl } from '@/config/seo.config';
import type { Locale } from '@/i18n/config';

interface OrganizationSchemaProps {
  locale: Locale;
}

export function OrganizationSchema({ locale }: OrganizationSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${seoConfig.url}/#organization`,
    name: seoConfig.business.name,
    legalName: seoConfig.business.legalName,
    url: `${seoConfig.url}/${locale}`,
    logo: {
      '@type': 'ImageObject',
      url: `${seoConfig.url}/images/logo.png`,
      width: 512,
      height: 512,
    },
    foundingDate: seoConfig.business.foundingDate,
    description: seoConfig.business.description[locale],
    address: {
      '@type': 'PostalAddress',
      addressLocality: seoConfig.business.address.addressLocality,
      addressCountry: seoConfig.business.address.addressCountry,
      postalCode: seoConfig.business.address.postalCode,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      email: seoConfig.email,
      contactType: 'customer service',
    },
    sameAs: [
      seoConfig.socialUrls.facebook,
      seoConfig.socialUrls.instagram,
      seoConfig.socialUrls.linkedin,
      seoConfig.socialUrls.x,
    ].filter(Boolean),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

- [ ] **Step 4: Create `website-schema.tsx`**

Create `apps/web/src/components/seo/schemas/website-schema.tsx`:

```typescript
import { seoConfig } from '@/config/seo.config';

export function WebSiteSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${seoConfig.url}/#website`,
    name: 'Too Fresh To Waste',
    url: seoConfig.url,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${seoConfig.url}/en/blog?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

- [ ] **Step 5: Create `article-schema.tsx`**

Create `apps/web/src/components/seo/schemas/article-schema.tsx`:

```typescript
import { seoConfig } from '@/config/seo.config';
import type { Locale } from '@/i18n/config';

interface ArticleSchemaProps {
  title: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
  url: string;
  authorName: string;
  authorUrl?: string;
  imageUrl?: string;
  locale: Locale;
}

export function ArticleSchema({
  title,
  description,
  publishedAt,
  updatedAt,
  url,
  authorName,
  authorUrl,
  imageUrl,
  locale,
}: ArticleSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    datePublished: publishedAt,
    dateModified: updatedAt,
    url,
    inLanguage: locale,
    author: {
      '@type': 'Person',
      name: authorName,
      ...(authorUrl ? { url: authorUrl } : {}),
    },
    publisher: {
      '@type': 'Organization',
      '@id': `${seoConfig.url}/#organization`,
      name: seoConfig.business.name,
      logo: {
        '@type': 'ImageObject',
        url: `${seoConfig.url}/images/logo.png`,
      },
    },
    ...(imageUrl
      ? {
          image: {
            '@type': 'ImageObject',
            url: imageUrl,
            width: 1200,
            height: 630,
          },
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

- [ ] **Step 6: Create `faq-schema.tsx`**

Create `apps/web/src/components/seo/schemas/faq-schema.tsx`:

```typescript
interface FAQItem {
  question: string;
  answer: string;
}

export function FAQSchema({ items }: { items: FAQItem[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

- [ ] **Step 7: Create remaining schema files**

Create `apps/web/src/components/seo/schemas/breadcrumb-schema.tsx`:

```typescript
interface BreadcrumbItem {
  name: string;
  url: string;
}

export function BreadcrumbSchema({ items }: { items: BreadcrumbItem[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

Create `apps/web/src/components/seo/schemas/software-app-schema.tsx`:

```typescript
import { seoConfig } from '@/config/seo.config';
import type { Locale } from '@/i18n/config';

interface SoftwareAppSchemaProps {
  name: string;
  description: string;
  locale: Locale;
}

export function SoftwareAppSchema({ name, description, locale }: SoftwareAppSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    description,
    applicationCategory: 'FoodAndDrink',
    operatingSystem: 'Android, iOS',
    inLanguage: locale,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'TND',
    },
    author: {
      '@type': 'Organization',
      '@id': `${seoConfig.url}/#organization`,
    },
    ...(seoConfig.appLinks.ios ? { downloadUrl: seoConfig.appLinks.ios } : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

Create `apps/web/src/components/seo/schemas/donate-action-schema.tsx`:

```typescript
import { seoConfig } from '@/config/seo.config';

export function DonateActionSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'DonateAction',
    agent: {
      '@type': 'Organization',
      '@id': `${seoConfig.url}/#organization`,
    },
    description:
      '5% of every order value is automatically donated to active community charity goals.',
    recipient: {
      '@type': 'Organization',
      name: 'Too Fresh To Waste Community Fund',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

Create `apps/web/src/components/seo/schemas/webpage-schema.tsx`:

```typescript
interface WebPageSchemaProps {
  type?: 'WebPage' | 'AboutPage' | 'ContactPage';
  name: string;
  description: string;
  url: string;
}

export function WebPageSchema({ type = 'WebPage', name, description, url }: WebPageSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': type,
    name,
    description,
    url,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

Create `apps/web/src/components/seo/schemas/event-schema.tsx`:

```typescript
interface EventSchemaProps {
  name: string;
  description: string;
  startDate: string;
  url: string;
  location?: string;
}

export function EventSchema({ name, description, startDate, url, location }: EventSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    description,
    startDate,
    url,
    ...(location
      ? {
          location: {
            '@type': 'Place',
            name: location,
          },
        }
      : {
          eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
          location: {
            '@type': 'VirtualLocation',
            url,
          },
        }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

- [ ] **Step 8: Create barrel `index.ts`**

Create `apps/web/src/components/seo/schemas/index.ts`:

```typescript
export { OrganizationSchema } from './organization-schema';
export { WebSiteSchema } from './website-schema';
export { ArticleSchema } from './article-schema';
export { FAQSchema } from './faq-schema';
export { BreadcrumbSchema } from './breadcrumb-schema';
export { SoftwareAppSchema } from './software-app-schema';
export { DonateActionSchema } from './donate-action-schema';
export { WebPageSchema } from './webpage-schema';
export { EventSchema } from './event-schema';
```

- [ ] **Step 9: Run tests to verify they pass**

```bash
pnpm --filter @foodwaste/web test -- --testPathPattern="seo/schemas" --no-coverage
```

Expected: PASS (all schema tests)

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/components/seo/ apps/web/src/__tests__/seo/
git commit -m "feat(seo): add JSON-LD schema components for structured data"
```

---

## Task 3: Add schemas to homepage

**Files:** `apps/web/src/app/[locale]/(marketing)/page.tsx`

Read the homepage file first to find the hero `<Image>` component, then:

- [ ] **Step 1: Add `priority` prop to hero `<Image>` and add schemas**

In `apps/web/src/app/[locale]/(marketing)/page.tsx`, import the schemas and add
to the JSX:

```typescript
// Add at top of file
import { OrganizationSchema, WebSiteSchema } from '@/components/seo/schemas';

// Inside the page component return, add before or after main content:
<>
  <OrganizationSchema locale={locale} />
  <WebSiteSchema />
  {/* existing page content */}
</>
```

Find the hero `<Image>` component (the first above-the-fold image) and add
`priority`:

```tsx
// Before:
<Image src="/images/hero.jpg" alt="..." width={1200} height={630} />

// After:
<Image src="/images/hero.jpg" alt="..." width={1200} height={630} priority />
```

- [ ] **Step 2: Update `generateMetadata` to add canonical**

```typescript
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const canonicalUrl = getCanonicalUrl('/', locale as Locale);
  return {
    // existing metadata...
    alternates: {
      canonical: canonicalUrl,
      languages: {
        en: getCanonicalUrl('/', 'en'),
        fr: getCanonicalUrl('/', 'fr'),
        ar: getCanonicalUrl('/', 'ar'),
        'x-default': getCanonicalUrl('/', 'en'),
      },
    },
  };
}
```

- [ ] **Step 3: Verify TypeScript passes**

```bash
pnpm --filter @foodwaste/web type-check
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/[locale]/(marketing)/page.tsx"
git commit -m "feat(seo): add Organization+WebSite schemas and priority hero image to homepage"
```

---

## Task 4: Add schemas to Tier-1 marketing pages

**Files:** food-waste-facts, humanity-mission, esg, consumer,
marketplace-surprise-bag, contact pages

- [ ] **Step 1: `food-waste-facts/page.tsx` — add FAQPage schema**

The page already has a stats array. Add a `faqs` array and schema:

```typescript
import { FAQSchema, BreadcrumbSchema } from '@/components/seo/schemas';
import { getCanonicalUrl } from '@/config/seo.config';
import type { Locale } from '@/i18n/config';

const faqs = [
  {
    question: 'How much food is wasted globally each year?',
    answer: 'According to the WWF, approximately 2.5 billion tonnes of food is lost or wasted annually worldwide — roughly 40% of all food produced.',
  },
  {
    question: 'What percentage of greenhouse gas emissions come from food waste?',
    answer: 'Food waste is responsible for about 10% of all global greenhouse gas emissions, according to WWF research.',
  },
  {
    question: 'How does Too Fresh To Waste help reduce food waste in Tunisia?',
    answer: 'Too Fresh To Waste connects consumers with local restaurants and shops that have surplus food, allowing it to be sold at 35-90% discount instead of being thrown away.',
  },
  {
    question: 'What is a surprise bag?',
    answer: 'A surprise bag is a discounted package of surplus food from a local restaurant or store. You pay a fraction of the original price and pick it up at the end of service.',
  },
];

// In the component return:
<>
  <FAQSchema items={faqs} />
  <BreadcrumbSchema
    items={[
      { name: 'Home', url: getCanonicalUrl('/', locale) },
      { name: 'Food Waste Facts', url: getCanonicalUrl('/food-waste-facts', locale) },
    ]}
  />
  {/* existing content */}
</>
```

- [ ] **Step 2: `humanity-mission/page.tsx` — add Organization + DonateAction
      schemas**

```typescript
import { OrganizationSchema, DonateActionSchema, BreadcrumbSchema } from '@/components/seo/schemas';
import { getCanonicalUrl } from '@/config/seo.config';

// In component return:
<>
  <OrganizationSchema locale={locale} />
  <DonateActionSchema />
  <BreadcrumbSchema
    items={[
      { name: 'Home', url: getCanonicalUrl('/', locale) },
      { name: 'Humanity Mission', url: getCanonicalUrl('/humanity-mission', locale) },
    ]}
  />
  {/* existing content */}
</>
```

- [ ] **Step 3: `esg/page.tsx` — add Article schema**

```typescript
import { ArticleSchema, BreadcrumbSchema } from '@/components/seo/schemas';
import { getCanonicalUrl, getSchemaOrgUrl } from '@/config/seo.config';
import type { Locale } from '@/i18n/config';

// In component return:
<>
  <ArticleSchema
    title="ESG Compliance for Food Businesses — Too Fresh To Waste"
    description="How restaurants and food businesses in MENA can meet ESG requirements including CBAM, CSRD, and UN SDGs by reducing food waste."
    publishedAt="2024-01-01"
    updatedAt="2026-05-01"
    url={getCanonicalUrl('/esg', locale)}
    authorName="Too Fresh To Waste Team"
    locale={locale as Locale}
  />
  <BreadcrumbSchema
    items={[
      { name: 'Home', url: getCanonicalUrl('/', locale) },
      { name: 'ESG', url: getCanonicalUrl('/esg', locale) },
    ]}
  />
  {/* existing content */}
</>
```

- [ ] **Step 4: `consumer/page.tsx` — add SoftwareApplication schema**

```typescript
import { SoftwareAppSchema, BreadcrumbSchema } from '@/components/seo/schemas';
import { getCanonicalUrl } from '@/config/seo.config';
import type { Locale } from '@/i18n/config';

// In component return:
<>
  <SoftwareAppSchema
    name="Too Fresh To Waste"
    description="Save up to 90% on surplus food from local restaurants and shops. Fight food waste and save money every day."
    locale={locale as Locale}
  />
  <BreadcrumbSchema
    items={[
      { name: 'Home', url: getCanonicalUrl('/', locale) },
      { name: 'For Consumers', url: getCanonicalUrl('/consumer', locale) },
    ]}
  />
  {/* existing content */}
</>
```

- [ ] **Step 5: `marketplace-surprise-bag/page.tsx` — add SoftwareApplication +
      FAQPage**

```typescript
import { SoftwareAppSchema, FAQSchema, BreadcrumbSchema } from '@/components/seo/schemas';
import { getCanonicalUrl } from '@/config/seo.config';
import type { Locale } from '@/i18n/config';

const surpriseBagFaqs = [
  {
    question: 'What is a surprise bag?',
    answer: 'A surprise bag is a discounted package of surplus food sold by local restaurants and shops at 35–90% off the original price. The contents are a surprise — you save money while preventing food waste.',
  },
  {
    question: 'How do I pick up my surprise bag?',
    answer: 'After purchasing, you receive a pickup code valid until the offer expiry time. Present the code at the establishment during the pickup window to collect your bag.',
  },
  {
    question: 'What if the food does not meet my expectations?',
    answer: 'Contact our support team. We review all complaints and take quality seriously. Merchants with consistent quality issues are removed from the platform.',
  },
  {
    question: 'How much can I save with a surprise bag?',
    answer: 'Surprise bags are sold at 35–90% below the original price. A bag worth 20 TND in food may be available for as little as 5 TND.',
  },
];

// In component return:
<>
  <SoftwareAppSchema
    name="Too Fresh To Waste — Surprise Bag Marketplace"
    description="Buy surplus food surprise bags from local restaurants and shops at up to 90% off. Available in Tunisia."
    locale={locale as Locale}
  />
  <FAQSchema items={surpriseBagFaqs} />
  <BreadcrumbSchema
    items={[
      { name: 'Home', url: getCanonicalUrl('/', locale) },
      { name: 'Surprise Bag', url: getCanonicalUrl('/marketplace-surprise-bag', locale) },
    ]}
  />
  {/* existing content */}
</>
```

- [ ] **Step 6: `contact/page.tsx` — add ContactPage schema**

```typescript
import { WebPageSchema, BreadcrumbSchema } from '@/components/seo/schemas';
import { getCanonicalUrl } from '@/config/seo.config';

// In component return:
<>
  <WebPageSchema
    type="ContactPage"
    name="Contact Too Fresh To Waste"
    description="Get in touch with the Too Fresh To Waste team. We are here to help consumers, merchants, and partners."
    url={getCanonicalUrl('/contact', locale)}
  />
  <BreadcrumbSchema
    items={[
      { name: 'Home', url: getCanonicalUrl('/', locale) },
      { name: 'Contact', url: getCanonicalUrl('/contact', locale) },
    ]}
  />
  {/* existing content */}
</>
```

- [ ] **Step 7: Type-check all modified files**

```bash
pnpm --filter @foodwaste/web type-check
```

Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add "apps/web/src/app/[locale]/(marketing)/"
git commit -m "feat(seo): add JSON-LD schemas to all Tier-1 marketing pages"
```

---

## Task 5: Dynamic OG image generation

**Files:** `apps/web/src/app/[locale]/opengraph-image.tsx`

- [ ] **Step 1: Create `opengraph-image.tsx` in the locale layout**

Create `apps/web/src/app/[locale]/opengraph-image.tsx`:

```typescript
import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Too Fresh To Waste';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function OGImage({ params }: Props) {
  const { locale } = await params;

  const titles: Record<string, string> = {
    en: 'Reduce Food Waste. Save Money.',
    fr: 'Réduisez le gaspillage. Économisez.',
    ar: 'قلّل هدر الطعام. وفّر المال.',
  };

  const subtitles: Record<string, string> = {
    en: 'Save up to 90% on surplus food from local restaurants',
    fr: "Économisez jusqu'à 90% sur la nourriture en surplus",
    ar: 'وفّر حتى 90% على الطعام الفائض من المطاعم المحلية',
  };

  const title = titles[locale] ?? titles.en;
  const subtitle = subtitles[locale] ?? subtitles.en;
  const isRtl = locale === 'ar';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isRtl ? 'flex-end' : 'flex-start',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1E4448 0%, #2d6a70 100%)',
          padding: '60px 80px',
          direction: isRtl ? 'rtl' : 'ltr',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: '#F55449',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: isRtl ? 0 : 16,
              marginLeft: isRtl ? 16 : 0,
            }}
          />
          <span style={{ color: '#ffffff', fontSize: 24, fontWeight: 600 }}>
            Too Fresh To Waste
          </span>
        </div>
        <div
          style={{
            color: '#ffffff',
            fontSize: 52,
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: 20,
            maxWidth: 800,
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: 26,
            maxWidth: 700,
          }}
        >
          {subtitle}
        </div>
      </div>
    ),
    { ...size }
  );
}
```

- [ ] **Step 2: Create a static fallback OG image placeholder**

Create an empty file to document the missing static asset:

```bash
# Note: A real 1200×630px branded image must be designed and placed at:
# apps/web/public/images/og-image.jpg
# Until then, the dynamic ImageResponse above serves as the fallback for the root locale page.
# For blog articles and milestone pages, each adds its own opengraph-image.tsx.
echo "PLACEHOLDER — replace with real branded 1200x630 image" > apps/web/public/images/og-image-README.txt
```

- [ ] **Step 3: Type-check**

```bash
pnpm --filter @foodwaste/web type-check
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/[locale]/opengraph-image.tsx" apps/web/public/images/og-image-README.txt
git commit -m "feat(seo): add dynamic OG image generation via Next.js ImageResponse"
```

---

## Task 6: Upgrade sitemap

**Files:** `apps/web/src/app/sitemap.ts`

- [ ] **Step 1: Write sitemap test**

Append to `apps/web/src/__tests__/seo/schemas.test.tsx`:

```typescript
import sitemap from '@/app/sitemap';

describe('sitemap', () => {
  it('includes locale prefix for default locale', () => {
    const entries = sitemap();
    const homepageEn = entries.find(
      e => e.url === 'https://toofreshwaste.tn/en',
    );
    expect(homepageEn).toBeTruthy();
  });

  it('includes all three locales for each page', () => {
    const entries = sitemap();
    const homepages = entries.filter(
      e =>
        e.url.endsWith('/en') || e.url.endsWith('/fr') || e.url.endsWith('/ar'),
    );
    expect(homepages.length).toBeGreaterThanOrEqual(3);
  });

  it('includes pillar pages', () => {
    const entries = sitemap();
    const pillar = entries.find(e => e.url.includes('/food-waste-mena'));
    expect(pillar).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @foodwaste/web test -- --testPathPattern="seo/schemas" --no-coverage
```

Expected: FAIL — `/en` homepage not found (old code omits `/en` prefix)

- [ ] **Step 3: Rewrite `sitemap.ts`**

Replace `apps/web/src/app/sitemap.ts` entirely:

```typescript
import { MetadataRoute } from 'next';
import { getCanonicalUrl } from '@/config/seo.config';
import { locales, getLocaleConfig } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

// Priority map matching the spec
const PRIORITY = {
  homepage: 1.0,
  pillar: 0.9,
  milestone: 0.9,
  blog: 0.8,
  country: 0.8,
  marketing: 0.7,
  city: 0.7,
} as const;

// All public marketing pages
const marketingPages: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}> = [
  { path: '/', changeFrequency: 'weekly', priority: PRIORITY.homepage },
  {
    path: '/consumer',
    changeFrequency: 'monthly',
    priority: PRIORITY.marketing,
  },
  {
    path: '/marketplace-surprise-bag',
    changeFrequency: 'monthly',
    priority: PRIORITY.marketing,
  },
  {
    path: '/humanity-mission',
    changeFrequency: 'monthly',
    priority: PRIORITY.marketing,
  },
  { path: '/esg', changeFrequency: 'monthly', priority: PRIORITY.marketing },
  {
    path: '/food-waste-facts',
    changeFrequency: 'monthly',
    priority: PRIORITY.marketing,
  },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/careers', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/companies', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/business-signup', changeFrequency: 'monthly', priority: 0.7 },
];

// 8 pillar pages (infrastructure — content comes later)
const pillarPages: string[] = [
  '/food-waste-mena',
  '/sustainable-eating',
  '/food-donations-north-africa',
  '/esg-restaurants',
  '/surprise-bag-guide',
  '/zero-hunger',
  '/food-rewards-apps',
  '/food-carbon-footprint',
];

// Tunisia city service areas (existing)
const tunisiaCities = [
  'tunis',
  'sousse',
  'sfax',
  'monastir',
  'hammamet',
  'bizerte',
  'nabeul',
];

function buildAlternates(path: string): Record<string, string> {
  const alternates: Record<string, string> = {
    'x-default': getCanonicalUrl(path, 'en'),
  };
  locales.forEach((locale: Locale) => {
    alternates[getLocaleConfig(locale).hreflang] = getCanonicalUrl(
      path,
      locale,
    );
  });
  return alternates;
}

function buildEntry(
  path: string,
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  priority: number,
  locale: Locale,
  lastModified?: Date,
): MetadataRoute.Sitemap[number] {
  return {
    url: getCanonicalUrl(path, locale),
    lastModified: lastModified ?? new Date(),
    changeFrequency,
    priority,
    alternates: { languages: buildAlternates(path) },
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  // Marketing pages
  marketingPages.forEach(({ path, changeFrequency, priority }) => {
    locales.forEach((locale: Locale) => {
      entries.push(buildEntry(path, changeFrequency, priority, locale, now));
    });
  });

  // Pillar pages (placeholders — pages built in Plan 1 via static routes)
  pillarPages.forEach(path => {
    locales.forEach((locale: Locale) => {
      entries.push(buildEntry(path, 'monthly', PRIORITY.pillar, locale, now));
    });
  });

  // Tunisia city pages
  tunisiaCities.forEach(city => {
    locales.forEach((locale: Locale) => {
      entries.push(
        buildEntry(`/locations/${city}`, 'weekly', PRIORITY.city, locale, now),
      );
    });
  });

  // Blog articles: dynamically added by Plan 2
  // Country pages: dynamically added by Plan 3
  // Milestone/impact pages: dynamically added by Plan 4

  return entries;
}
```

- [ ] **Step 4: Run sitemap test**

```bash
pnpm --filter @foodwaste/web test -- --testPathPattern="seo/schemas" --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/sitemap.ts
git commit -m "feat(seo): upgrade sitemap — fix locale prefix bug, add pillar pages, priority map"
```

---

## Task 7: Core Web Vitals — Arabic font preload on Arabic locale only

**Files:** `apps/web/src/app/[locale]/layout.tsx`

The Arabic font already uses `next/font/google` with `preload: false`. The fix
is to dynamically set `preload: true` when on the Arabic locale. Since
`next/font/google` config is static (not runtime-dynamic), the correct pattern
is to pass the font variable into the body classname conditionally.

- [ ] **Step 1: Read the full layout.tsx font loading section**

```bash
# Review lines 30-42 of apps/web/src/app/[locale]/layout.tsx to confirm
# notoSansArabic already has preload: false — this is correct.
# No change needed: next/font/google auto-subsets arabic glyphs server-side.
# The font is only injected via CSS variable on the ar locale body class.
# Verify the body classname logic includes locale-conditional Arabic font:
```

Open `apps/web/src/app/[locale]/layout.tsx` and find the `<body>` className
assignment. Verify it conditionally applies `notoSansArabic.variable` only on
Arabic locale. If it already applies it unconditionally, scope it:

```tsx
// Before (if unconditional):
<body className={`${inter.variable} ${notoSansArabic.variable} ...`}>

// After (conditional — avoids loading Arabic CSS on en/fr pages):
<body className={`${inter.variable} ${locale === 'ar' ? notoSansArabic.variable : ''} ...`}>
```

- [ ] **Step 2: Add `preconnect` for Google Fonts in layout head**

In `generateMetadata` for the locale layout, ensure no preconnect hints are
blocking. Next.js `next/font/google` handles this automatically — verify no
custom `<link rel="preconnect">` tags are duplicating it.

- [ ] **Step 3: Type-check**

```bash
pnpm --filter @foodwaste/web type-check
```

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/[locale]/layout.tsx"
git commit -m "perf(seo): scope Arabic font CSS variable to ar locale only — reduces LCP on en/fr"
```

---

## Task 8: Canonical URLs in locale layout `generateMetadata`

**Files:** `apps/web/src/app/[locale]/layout.tsx`

- [ ] **Step 1: Read current `generateMetadata` in locale layout**

Open `apps/web/src/app/[locale]/layout.tsx` and find `generateMetadata`. It
currently sets title, description, OG, Twitter. Add `alternates.canonical`:

```typescript
import { getCanonicalUrl } from '@/config/seo.config';
import type { Locale } from '@/i18n/config';

// Inside generateMetadata, after existing metadata:
const locale = (await params).locale as Locale;

return {
  // ...existing metadata...
  alternates: {
    canonical: getCanonicalUrl(path ?? '/', locale),
    languages: {
      en: getCanonicalUrl(path ?? '/', 'en'),
      fr: getCanonicalUrl(path ?? '/', 'fr'),
      ar: getCanonicalUrl(path ?? '/', 'ar'),
      'x-default': getCanonicalUrl(path ?? '/', 'en'),
    },
  },
};
```

Note: The path is not available in the root layout's `generateMetadata`. The
layout-level canonical sets the fallback. Individual page `generateMetadata`
functions must set their own `alternates.canonical` for full accuracy.

- [ ] **Step 2: Type-check**

```bash
pnpm --filter @foodwaste/web type-check
```

- [ ] **Step 3: Run all SEO tests**

```bash
pnpm --filter @foodwaste/web test -- --testPathPattern="seo" --no-coverage
```

Expected: PASS

- [ ] **Step 4: Final commit**

```bash
git add "apps/web/src/app/[locale]/layout.tsx"
git commit -m "feat(seo): add canonical + hreflang alternates to locale layout generateMetadata"
```

---

## Verification

After all tasks complete:

1. Run `pnpm --filter @foodwaste/web build` — confirm 0 build errors
2. Run `pnpm --filter @foodwaste/web type-check` — confirm 0 type errors
3. Visit `http://localhost:3001/en` → View Source → confirm
   `<script type="application/ld+json">` present
4. Paste any page URL into
   [Google Rich Results Test](https://search.google.com/test/rich-results) →
   confirm schema detected
5. Visit `http://localhost:3001/en/sitemap.xml` → confirm `/en` prefix appears
   for all English URLs
6. Open DevTools → Network → confirm hero image loads with `priority` (no
   lazy-load delay)
