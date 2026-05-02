# SEO Plan 3: International SEO + Country Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade hreflang from generic language tags (`fr`, `ar`) to
country-region variants (`fr-TN`, `fr-MA`, `ar-SA`, etc.), and build country
landing pages for Tunisia, Morocco, Algeria, UAE, and Saudi Arabia in EN + FR +
AR.

**Architecture:** Country-region hreflang variants are declared in
`seo.config.ts` as a static map keyed by market. The sitemap and
`generateMetadata` use this map. Country pages are static Next.js routes under
`(marketing)/countries/[country]/page.tsx`. Content is one article per language,
country-adapted only in meta description and internal links — not full
localization.

**Tech Stack:** Next.js 15 App Router, TypeScript, next-intl, Jest

**Prerequisite:** Plan 1 complete (uses `getCanonicalUrl`, `getSchemaOrgUrl`,
`WebPageSchema`, `BreadcrumbSchema`)

---

## File Map

**Create:**

- `apps/web/src/config/countries.config.ts` — country metadata (stats, cities,
  charity orgs, hreflang map)
- `apps/web/src/app/[locale]/(marketing)/countries/page.tsx` — countries hub
- `apps/web/src/app/[locale]/(marketing)/countries/[country]/page.tsx` — country
  landing page
- `apps/web/src/__tests__/seo/countries.test.ts`

**Modify:**

- `apps/web/src/config/seo.config.ts` — add `getCountryHreflangAlternates()`
  helper
- `apps/web/src/app/sitemap.ts` — add country pages with country-region hreflang

---

## Task 1: Country configuration data

**Files:** `apps/web/src/config/countries.config.ts`

- [ ] **Step 1: Write tests**

Create `apps/web/src/__tests__/seo/countries.test.ts`:

```typescript
import { getCountryConfig, COUNTRY_SLUGS } from '@/config/countries.config';

describe('countries.config', () => {
  it('has config for all 5 target markets', () => {
    const markets = ['tunisia', 'morocco', 'algeria', 'uae', 'saudi-arabia'];
    markets.forEach(slug => {
      const config = getCountryConfig(slug);
      expect(config).toBeTruthy();
      expect(config?.nameEn).toBeTruthy();
      expect(config?.stats.length).toBeGreaterThan(0);
    });
  });

  it('COUNTRY_SLUGS contains all 5 markets', () => {
    expect(COUNTRY_SLUGS).toHaveLength(5);
  });

  it('each country has hreflang variants', () => {
    const config = getCountryConfig('morocco');
    expect(config?.hreflangVariants.fr).toBe('fr-MA');
    expect(config?.hreflangVariants.ar).toBe('ar-MA');
    expect(config?.hreflangVariants.en).toBe('en');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @foodwaste/web test -- --testPathPattern="seo/countries" --no-coverage
```

Expected: FAIL — module not found

- [ ] **Step 3: Create `countries.config.ts`**

Create `apps/web/src/config/countries.config.ts`:

```typescript
export interface CountryStat {
  value: string;
  label: string;
  source: string;
}

export interface CountryConfig {
  slug: string;
  nameEn: string;
  nameFr: string;
  nameAr: string;
  capital: { en: string; fr: string; ar: string };
  hreflangVariants: { en: string; fr?: string; ar?: string };
  stats: CountryStat[];
  charityOrgs: { name: string; url?: string }[];
  description: { en: string; fr: string; ar: string };
  metaDescription: { en: string; fr: string; ar: string };
}

const COUNTRIES: CountryConfig[] = [
  {
    slug: 'tunisia',
    nameEn: 'Tunisia',
    nameFr: 'Tunisie',
    nameAr: 'تونس',
    capital: { en: 'Tunis', fr: 'Tunis', ar: 'تونس' },
    hreflangVariants: { en: 'en', fr: 'fr-TN', ar: 'ar-TN' },
    stats: [
      {
        value: '30%',
        label: 'of food produced in Tunisia is wasted each year',
        source: 'FAO, 2022',
      },
      {
        value: '400,000 t',
        label: 'of food wasted annually in Tunisia',
        source: 'National Observatory of Agriculture, Tunisia',
      },
      {
        value: '10.5M',
        label: 'people in Tunisia impacted by rising food costs',
        source: 'World Bank, 2023',
      },
    ],
    charityOrgs: [
      {
        name: 'Tunisian Red Crescent',
        url: 'https://www.croissantrouge.org.tn',
      },
      { name: 'Banque Alimentaire de Tunisie' },
    ],
    description: {
      en: 'Too Fresh To Waste launched in Tunisia to help local restaurants and consumers fight the food waste crisis. Every surprise bag sold in Tunisia saves food from landfill and contributes 5% to local charity goals.',
      fr: 'Too Fresh To Waste a été lancé en Tunisie pour aider les restaurants et les consommateurs locaux à lutter contre le gaspillage alimentaire. Chaque surprise bag vendu en Tunisie sauve de la nourriture et contribue 5% aux objectifs caritatifs locaux.',
      ar: 'أُطلقت منصة Too Fresh To Waste في تونس لمساعدة المطاعم والمستهلكين المحليين على مكافحة أزمة هدر الطعام. كل حقيبة مفاجأة تُباع في تونس تُنقذ الطعام وتُساهم بنسبة 5% في أهداف خيرية محلية.',
    },
    metaDescription: {
      en: "Fight food waste in Tunisia — buy surplus food surprise bags from Tunis restaurants at up to 90% off. Too Fresh To Waste, Tunisia's food waste app.",
      fr: "Luttez contre le gaspillage alimentaire en Tunisie — achetez des surprise bags de restaurants tunisiens avec jusqu'à 90% de réduction. Too Fresh To Waste, l'appli anti-gaspillage de Tunisie.",
      ar: 'حارب هدر الطعام في تونس — اشترِ حقائب المفاجأة من مطاعم تونس بخصم يصل إلى 90%. Too Fresh To Waste، تطبيق الحد من هدر الطعام في تونس.',
    },
  },
  {
    slug: 'morocco',
    nameEn: 'Morocco',
    nameFr: 'Maroc',
    nameAr: 'المغرب',
    capital: { en: 'Rabat', fr: 'Rabat', ar: 'الرباط' },
    hreflangVariants: { en: 'en', fr: 'fr-MA', ar: 'ar-MA' },
    stats: [
      {
        value: '4.2M t',
        label: 'of food wasted annually in Morocco',
        source: 'FAO & Moroccan Ministry of Agriculture, 2021',
      },
      {
        value: '34%',
        label: 'of Moroccan households report food insecurity',
        source: 'Haut-Commissariat au Plan, 2022',
      },
      {
        value: '12%',
        label: "of Morocco's GDP lost to food waste annually",
        source: 'World Resources Institute',
      },
    ],
    charityOrgs: [
      { name: 'Banque Alimentaire du Maroc' },
      {
        name: 'Croissant-Rouge Marocain',
        url: 'https://www.croissant-rouge.ma',
      },
    ],
    description: {
      en: 'Morocco wastes over 4 million tonnes of food every year while millions face food insecurity. Too Fresh To Waste connects Moroccan consumers with local surplus food, reducing waste and fighting hunger simultaneously.',
      fr: "Le Maroc gaspille plus de 4 millions de tonnes de nourriture chaque année alors que des millions de personnes souffrent d'insécurité alimentaire. Too Fresh To Waste connecte les consommateurs marocains avec les surplus alimentaires locaux.",
      ar: 'يهدر المغرب أكثر من 4 ملايين طن من الطعام كل عام في حين يعاني الملايين من انعدام الأمن الغذائي. تربط منصة Too Fresh To Waste المستهلكين المغاربة بالطعام الفائض المحلي.',
    },
    metaDescription: {
      en: 'Food waste app Morocco — save money on surplus food from Casablanca and Rabat restaurants. Fight food waste in Morocco with Too Fresh To Waste.',
      fr: 'Application anti-gaspillage Maroc — économisez sur la nourriture en surplus des restaurants de Casablanca et Rabat. Luttez contre le gaspillage alimentaire au Maroc.',
      ar: 'تطبيق الحد من هدر الطعام في المغرب — وفّر المال على الطعام الفائض من مطاعم الدار البيضاء والرباط.',
    },
  },
  {
    slug: 'algeria',
    nameEn: 'Algeria',
    nameFr: 'Algérie',
    nameAr: 'الجزائر',
    capital: { en: 'Algiers', fr: 'Alger', ar: 'الجزائر العاصمة' },
    hreflangVariants: { en: 'en', fr: 'fr-DZ', ar: 'ar-DZ' },
    stats: [
      {
        value: '3.5M t',
        label: 'of food wasted annually in Algeria',
        source: 'FAO, 2022',
      },
      {
        value: '€3.7B',
        label: 'annual economic cost of food waste in Algeria',
        source: 'Algerian Ministry of Commerce',
      },
      {
        value: '30%',
        label: 'of Algerians face food vulnerability',
        source: 'World Food Programme, 2023',
      },
    ],
    charityOrgs: [
      { name: 'Croissant-Rouge Algérien' },
      { name: 'Association El Feth for Food Aid' },
    ],
    description: {
      en: 'Algeria loses billions of dinars to food waste every year. Too Fresh To Waste brings the surprise bag model to Algeria, helping restaurants recover revenue and consumers save money.',
      fr: "L'Algérie perd des milliards de dinars en gaspillage alimentaire chaque année. Too Fresh To Waste apporte le modèle surprise bag en Algérie, aidant les restaurants à récupérer des revenus et les consommateurs à économiser.",
      ar: 'تفقد الجزائر مليارات الدنانير بسبب هدر الطعام كل عام. تجلب منصة Too Fresh To Waste نموذج حقيبة المفاجأة إلى الجزائر.',
    },
    metaDescription: {
      en: 'Food waste app Algeria — buy surplus food bags from Algiers restaurants at discount. Too Fresh To Waste fighting food waste in Algeria.',
      fr: "Application anti-gaspillage Algérie — achetez des bags de nourriture en surplus des restaurants d'Alger à prix réduit. Too Fresh To Waste lutte contre le gaspillage alimentaire en Algérie.",
      ar: 'تطبيق الحد من هدر الطعام في الجزائر — اشترِ حقائب الطعام الفائض من مطاعم الجزائر العاصمة بأسعار مخفضة.',
    },
  },
  {
    slug: 'uae',
    nameEn: 'UAE',
    nameFr: 'Émirats arabes unis',
    nameAr: 'الإمارات العربية المتحدة',
    capital: { en: 'Dubai', fr: 'Dubaï', ar: 'دبي' },
    hreflangVariants: { en: 'en', ar: 'ar-AE' },
    stats: [
      {
        value: '38%',
        label: 'of food purchased in the UAE is wasted',
        source: 'Dubai Municipality, 2022',
      },
      {
        value: 'AED 13B',
        label: 'annual economic cost of food waste in UAE',
        source: 'UAE Ministry of Climate Change, 2023',
      },
      {
        value: '3.27M t',
        label: 'of food wasted in UAE each year',
        source: 'WRAP & UAE Ministry, 2022',
      },
    ],
    charityOrgs: [
      { name: 'UAE Food Bank', url: 'https://www.uaefoodbank.ae' },
      { name: 'Emirates Red Crescent', url: 'https://www.rcuae.ae' },
    ],
    description: {
      en: 'The UAE wastes 38% of all food purchased — one of the highest rates in the world. Too Fresh To Waste brings the surplus food marketplace to Dubai and Abu Dhabi, connecting restaurants with consumers and diverting food from landfill.',
      fr: "Les Émirats arabes unis gaspillent 38% de toute la nourriture achetée, l'un des taux les plus élevés au monde. Too Fresh To Waste apporte le marché des surplus alimentaires à Dubaï et Abu Dhabi.",
      ar: 'تهدر الإمارات 38% من جميع المواد الغذائية المشتراة — أحد أعلى المعدلات في العالم. تجلب منصة Too Fresh To Waste سوق الطعام الفائض إلى دبي وأبوظبي.',
    },
    metaDescription: {
      en: 'Surplus food app Dubai UAE — save up to 90% on restaurant food bags in Dubai and Abu Dhabi. Too Fresh To Waste fighting food waste in the UAE.',
      fr: "Application surplus alimentaire Dubaï EAU — économisez jusqu'à 90% sur les bags de restaurants à Dubaï et Abou Dhabi.",
      ar: 'تطبيق الطعام الفائض دبي الإمارات — وفّر حتى 90% على حقائب الطعام من المطاعم في دبي وأبوظبي.',
    },
  },
  {
    slug: 'saudi-arabia',
    nameEn: 'Saudi Arabia',
    nameFr: 'Arabie saoudite',
    nameAr: 'المملكة العربية السعودية',
    capital: { en: 'Riyadh', fr: 'Riyad', ar: 'الرياض' },
    hreflangVariants: { en: 'en', ar: 'ar-SA' },
    stats: [
      {
        value: '33%',
        label: 'of food is wasted in Saudi Arabia annually',
        source: 'Saudi Ministry of Environment, 2022',
      },
      {
        value: 'SAR 40B',
        label: 'annual cost of food waste in Saudi Arabia',
        source: 'Saudi National Center for Waste Management, 2023',
      },
      {
        value: '4.08M t',
        label: 'of food wasted in KSA per year',
        source: 'Saudi NCWM, 2022',
      },
    ],
    charityOrgs: [
      { name: 'Saudi Food Bank (Etaam)', url: 'https://www.etaam.com.sa' },
      { name: 'Saudi Red Crescent Authority', url: 'https://www.srca.org.sa' },
    ],
    description: {
      en: 'Saudi Arabia wastes over 4 million tonnes of food annually at a cost of SAR 40 billion. Too Fresh To Waste brings its surplus food marketplace to Riyadh and Jeddah, helping restaurants reduce waste and earn more.',
      fr: "L'Arabie saoudite gaspille plus de 4 millions de tonnes de nourriture annuellement pour un coût de 40 milliards de SAR. Too Fresh To Waste apporte son marché de surplus alimentaires à Riyad et Djeddah.",
      ar: 'تهدر المملكة العربية السعودية أكثر من 4 ملايين طن من الطعام سنويًا بتكلفة 40 مليار ريال. تجلب منصة Too Fresh To Waste سوق الطعام الفائض إلى الرياض وجدة.',
    },
    metaDescription: {
      en: 'Food waste app Saudi Arabia — buy surplus food bags from Riyadh and Jeddah restaurants at up to 90% off. Too Fresh To Waste in Saudi Arabia.',
      fr: "Application anti-gaspillage Arabie saoudite — achetez des bags de restaurants de Riyad et Djeddah avec jusqu'à 90% de réduction.",
      ar: 'تطبيق الحد من هدر الطعام في السعودية — اشترِ حقائب الطعام الفائض من مطاعم الرياض وجدة بخصم يصل إلى 90%.',
    },
  },
];

export const COUNTRY_SLUGS = COUNTRIES.map(c => c.slug);

export function getCountryConfig(slug: string): CountryConfig | undefined {
  return COUNTRIES.find(c => c.slug === slug);
}

export function getAllCountries(): CountryConfig[] {
  return COUNTRIES;
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @foodwaste/web test -- --testPathPattern="seo/countries" --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/config/countries.config.ts apps/web/src/__tests__/seo/countries.test.ts
git commit -m "feat(seo): add country configuration data for all 5 MENA target markets"
```

---

## Task 2: Add `getCountryHreflangAlternates` to seo.config

**Files:** `apps/web/src/config/seo.config.ts`

- [ ] **Step 1: Add helper function**

Append to `apps/web/src/config/seo.config.ts`:

```typescript
import { getCountryConfig } from './countries.config';

// Generates country-region hreflang alternates for a given path + country slug.
// E.g. for Morocco + /blog/food-waste-mena:
// { 'fr-MA': '/fr/blog/food-waste-mena', 'ar-MA': '/ar/blog/food-waste-mena', 'en': '/en/...', 'x-default': '/en/...' }
export function getCountryHreflangAlternates(
  path: string,
  countrySlug: string,
): Record<string, string> {
  const country = getCountryConfig(countrySlug);
  if (!country) return {};

  const alternates: Record<string, string> = {
    'x-default': getCanonicalUrl(path, 'en'),
  };

  const { hreflangVariants } = country;
  if (hreflangVariants.en) {
    alternates[hreflangVariants.en] = getCanonicalUrl(path, 'en');
  }
  if (hreflangVariants.fr) {
    alternates[hreflangVariants.fr] = getCanonicalUrl(path, 'fr');
  }
  if (hreflangVariants.ar) {
    alternates[hreflangVariants.ar] = getCanonicalUrl(path, 'ar');
  }

  return alternates;
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm --filter @foodwaste/web type-check
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/config/seo.config.ts
git commit -m "feat(seo): add getCountryHreflangAlternates helper for country-region hreflang"
```

---

## Task 3: Country hub page

**Files:** `apps/web/src/app/[locale]/(marketing)/countries/page.tsx`

- [ ] **Step 1: Create the countries hub**

Create `apps/web/src/app/[locale]/(marketing)/countries/page.tsx`:

```typescript
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { getAllCountries } from '@/config/countries.config';
import { getCanonicalUrl } from '@/config/seo.config';
import { Link } from '@/i18n/routing';
import { BreadcrumbSchema } from '@/components/seo/schemas';
import type { Locale } from '@/i18n/config';

interface CountriesHubProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: CountriesHubProps): Promise<Metadata> {
  const { locale } = await params;
  const canonicalUrl = getCanonicalUrl('/countries', locale as Locale);
  return {
    title: 'Countries — Too Fresh To Waste MENA Markets',
    description:
      'Too Fresh To Waste operates across the MENA region — Tunisia, Morocco, Algeria, UAE, and Saudi Arabia. Find local food waste statistics, charity partners, and app availability.',
    alternates: {
      canonical: canonicalUrl,
      languages: {
        en: getCanonicalUrl('/countries', 'en'),
        fr: getCanonicalUrl('/countries', 'fr'),
        ar: getCanonicalUrl('/countries', 'ar'),
        'x-default': getCanonicalUrl('/countries', 'en'),
      },
    },
  };
}

export default async function CountriesHubPage({ params }: CountriesHubProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const countries = getAllCountries();

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: getCanonicalUrl('/', locale as Locale) },
          { name: 'Countries', url: getCanonicalUrl('/countries', locale as Locale) },
        ]}
      />
      <main className="max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">Our Markets</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Too Fresh To Waste is fighting food waste across North Africa and the Gulf. Explore food
            waste data and local impact for each country we serve.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {countries.map((country) => (
            <Link
              key={country.slug}
              href={`/countries/${country.slug}`}
              className="group border border-border rounded-xl p-6 hover:border-primary/50 hover:shadow-md transition-all bg-card"
            >
              <h2 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                {locale === 'ar'
                  ? country.nameAr
                  : locale === 'fr'
                    ? country.nameFr
                    : country.nameEn}
              </h2>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {country.description[locale as keyof typeof country.description]}
              </p>
              <div className="mt-4 text-xs font-medium text-primary">
                {country.stats.length} food waste stats →
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/[locale]/(marketing)/countries/page.tsx"
git commit -m "feat(seo): add countries hub page listing all 5 MENA markets"
```

---

## Task 4: Country landing pages

**Files:** `apps/web/src/app/[locale]/(marketing)/countries/[country]/page.tsx`

- [ ] **Step 1: Create country landing page**

Create `apps/web/src/app/[locale]/(marketing)/countries/[country]/page.tsx`:

```typescript
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getCountryConfig, COUNTRY_SLUGS } from '@/config/countries.config';
import { getCanonicalUrl, getCountryHreflangAlternates } from '@/config/seo.config';
import { WebPageSchema, BreadcrumbSchema } from '@/components/seo/schemas';
import { Link } from '@/i18n/routing';
import type { Locale } from '@/i18n/config';

interface CountryPageProps {
  params: Promise<{ locale: string; country: string }>;
}

export function generateStaticParams() {
  return COUNTRY_SLUGS.map((country) => ({ country }));
}

export async function generateMetadata({ params }: CountryPageProps): Promise<Metadata> {
  const { locale, country: countrySlug } = await params;
  const country = getCountryConfig(countrySlug);
  if (!country) return {};

  const loc = locale as Locale;
  const canonicalUrl = getCanonicalUrl(`/countries/${countrySlug}`, loc);
  const hreflangAlternates = getCountryHreflangAlternates(`/countries/${countrySlug}`, countrySlug);

  const name = loc === 'ar' ? country.nameAr : loc === 'fr' ? country.nameFr : country.nameEn;

  return {
    title: `Food Waste in ${name} — Statistics, Impact & Solutions | Too Fresh To Waste`,
    description: country.metaDescription[loc],
    alternates: {
      canonical: canonicalUrl,
      languages: hreflangAlternates,
    },
  };
}

export default async function CountryPage({ params }: CountryPageProps) {
  const { locale, country: countrySlug } = await params;
  setRequestLocale(locale);

  const country = getCountryConfig(countrySlug);
  if (!country) notFound();

  const loc = locale as Locale;
  const name = loc === 'ar' ? country.nameAr : loc === 'fr' ? country.nameFr : country.nameEn;
  const canonicalUrl = getCanonicalUrl(`/countries/${countrySlug}`, loc);

  return (
    <>
      <WebPageSchema
        type="WebPage"
        name={`Food Waste in ${name} | Too Fresh To Waste`}
        description={country.metaDescription[loc]}
        url={canonicalUrl}
      />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: getCanonicalUrl('/', loc) },
          { name: 'Countries', url: getCanonicalUrl('/countries', loc) },
          { name, url: canonicalUrl },
        ]}
      />

      <main
        className="max-w-4xl mx-auto px-4 py-12 sm:px-6"
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
      >
        <header className="mb-12">
          <p className="text-sm text-muted-foreground uppercase tracking-widest mb-2">
            Food Waste in
          </p>
          <h1 className="text-4xl font-bold text-foreground mb-4">{name}</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            {country.description[loc]}
          </p>
        </header>

        {/* Food Waste Statistics */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-6">Food Waste Statistics</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {country.stats.map((stat, i) => (
              <div key={i} className="border border-border rounded-xl p-5 bg-card">
                <p className="text-3xl font-bold text-primary mb-2">{stat.value}</p>
                <p className="text-sm text-foreground mb-1">{stat.label}</p>
                <p className="text-xs text-muted-foreground">Source: {stat.source}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How the platform works in this country */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-4">
            How Too Fresh To Waste Works in {name}
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                step: '1',
                title: 'Browse Surprise Bags',
                desc: 'Find surplus food offers from local restaurants and shops near you.',
              },
              {
                step: '2',
                title: 'Purchase & Save',
                desc: 'Buy at 35–90% below the original price. Your order helps reduce food waste.',
              },
              {
                step: '3',
                title: 'Pick Up & Enjoy',
                desc: 'Collect your surprise bag during the pickup window using your order code.',
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                  {step}
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">{title}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Charity Partners */}
        {country.charityOrgs.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              Charity Partners in {name}
            </h2>
            <p className="text-muted-foreground mb-4">
              5% of every order on Too Fresh To Waste is donated to community charity goals. We work
              alongside these organizations in {name}:
            </p>
            <ul className="space-y-2">
              {country.charityOrgs.map((org) => (
                <li key={org.name} className="flex items-center gap-2 text-sm text-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {org.url ? (
                    <a
                      href={org.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary transition-colors"
                    >
                      {org.name}
                    </a>
                  ) : (
                    org.name
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* CTA */}
        <section className="bg-primary/5 border border-primary/20 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-semibold text-foreground mb-3">
            Join the Fight Against Food Waste in {name}
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Download the app or sign up your restaurant. Together we can make {name} a zero food
            waste country.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/consumer"
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Download App
            </Link>
            <Link
              href="/business-signup"
              className="border border-primary text-primary px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/5 transition-colors"
            >
              Register Your Business
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm --filter @foodwaste/web type-check
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/[locale]/(marketing)/countries/"
git commit -m "feat(seo): add country landing pages for Tunisia, Morocco, Algeria, UAE, Saudi Arabia"
```

---

## Task 5: Update sitemap with country pages + country-region hreflang

**Files:** `apps/web/src/app/sitemap.ts`

- [ ] **Step 1: Add country pages to sitemap with country-specific hreflang**

In `apps/web/src/app/sitemap.ts`, add the following import:

```typescript
import { COUNTRY_SLUGS, getCountryConfig } from '@/config/countries.config';
import { getCountryHreflangAlternates } from '@/config/seo.config';
```

Inside the `sitemap()` function, after the blog articles section, add:

```typescript
// Country landing pages with country-region hreflang
COUNTRY_SLUGS.forEach(countrySlug => {
  locales.forEach((locale: Locale) => {
    const path = `/countries/${countrySlug}`;
    entries.push({
      url: getCanonicalUrl(path, locale),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: PRIORITY.country,
      alternates: {
        languages: getCountryHreflangAlternates(path, countrySlug),
      },
    });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
pnpm --filter @foodwaste/web test -- --testPathPattern="seo" --no-coverage
```

Expected: PASS

- [ ] **Step 3: Build to verify no static generation errors**

```bash
pnpm --filter @foodwaste/web build
```

Expected: Successful build, country pages statically generated

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/sitemap.ts
git commit -m "feat(seo): add country pages to sitemap with country-region hreflang alternates"
```

---

## Verification

After all tasks complete:

1. `pnpm --filter @foodwaste/web build` — 0 errors, 5 country × 3 locales = 15
   static pages generated
2. `pnpm --filter @foodwaste/web type-check` — 0 type errors
3. `pnpm --filter @foodwaste/web test -- --no-coverage` — all tests pass
4. Visit `http://localhost:3001/en/countries` — hub shows 5 country cards
5. Visit `http://localhost:3001/en/countries/morocco` — Morocco page with 3
   stats, charity orgs, CTA
6. Visit `http://localhost:3001/ar/countries/saudi-arabia` — RTL layout, Arabic
   content
7. View source of any country page → confirm `hreflang` meta tags use country
   variants (`ar-SA`, `fr-MA`, etc.)
8. Visit `http://localhost:3001/en/sitemap.xml` → confirm country pages with
   country-region alternates
