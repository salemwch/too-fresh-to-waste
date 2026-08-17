import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/layout';
import { Link } from '@/i18n/routing';
import { BreadcrumbSchema } from '@/components/seo/schemas';
import { getCanonicalUrl } from '@/config/seo.config';
import { locales, getLocaleConfig } from '@/i18n/config';
import { cities, t } from '@/content/locations';

import type { Locale } from '@/i18n/config';

const PATH = '/locations';

interface LocationsPageProps {
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return locales.map(locale => ({ locale }));
}

const COPY = {
  en: {
    title: 'Where We Operate in Tunisia — Anti-Waste Food by City',
    description:
      'Too Fresh To Waste rescues surplus food in Tunis, Sousse, Sfax, Monastir, Hammamet, Bizerte and Nabeul. Find surprise bags near you and save up to 70%.',
    heading: 'Cities we serve across Tunisia',
    intro:
      'Too Fresh To Waste connects you with bakeries, restaurants, hotels and grocers that have good food left at the end of the day. Choose your city to see how food waste works locally and what a surprise bag typically contains.',
    cta: 'View city',
    listHeading: 'All cities',
  },
  fr: {
    title: 'Où Nous Opérons en Tunisie — Anti-Gaspi par Ville',
    description:
      "Too Fresh To Waste sauve les invendus à Tunis, Sousse, Sfax, Monastir, Hammamet, Bizerte et Nabeul. Trouvez des paniers surprise près de chez vous jusqu'à -70%.",
    heading: 'Les villes que nous couvrons en Tunisie',
    intro:
      'Too Fresh To Waste vous met en relation avec les boulangeries, restaurants, hôtels et épiceries qui ont de la bonne nourriture invendue en fin de journée. Choisissez votre ville pour découvrir la situation locale et ce que contient généralement un panier surprise.',
    cta: 'Voir la ville',
    listHeading: 'Toutes les villes',
  },
  ar: {
    title: 'أين نعمل في تونس — مكافحة هدر الطعام حسب المدينة',
    description:
      'ينقذ Too Fresh To Waste الطعام الفائض في تونس وسوسة وصفاقس والمنستير والحمامات وبنزرت ونابل. اعثر على سلال مفاجأة بالقرب منك.',
    heading: 'المدن التي نخدمها في تونس',
    intro:
      'يربطك Too Fresh To Waste بالمخابز والمطاعم والفنادق والبقالات التي لديها طعام جيد غير مباع في نهاية اليوم. اختر مدينتك لمعرفة المزيد.',
    cta: 'عرض المدينة',
    listHeading: 'كل المدن',
  },
} as const;

export async function generateMetadata({ params }: LocationsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const loc = locale as Locale;
  const copy = COPY[loc] ?? COPY.en;

  const alternateLanguages: Record<string, string> = {
    'x-default': getCanonicalUrl(PATH, 'en'),
  };
  locales.forEach(l => {
    alternateLanguages[getLocaleConfig(l).hreflang] = getCanonicalUrl(PATH, l);
  });

  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: getCanonicalUrl(PATH, loc),
      languages: alternateLanguages,
    },
    openGraph: {
      type: 'website',
      title: copy.title,
      description: copy.description,
      url: getCanonicalUrl(PATH, loc),
    },
  };
}

export default async function LocationsPage({ params }: LocationsPageProps) {
  const { locale } = await params;
  const loc = locale as Locale;
  const copy = COPY[loc] ?? COPY.en;

  setRequestLocale(locale);

  // ItemList tells Google this is the canonical index of the city cluster,
  // which helps it treat the children as a set rather than seven unrelated pages.
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: copy.heading,
    itemListElement: cities.map((city, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: t(city.name, loc),
      url: getCanonicalUrl(`/locations/${city.slug}`, loc),
    })),
  };

  return (
    <>
      <script
        type='application/ld+json'
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: getCanonicalUrl('/', loc) },
          { name: 'Locations', url: getCanonicalUrl(PATH, loc) },
        ]}
      />

      <Header />

      <main role='main'>
        <section className='bg-primary-500 px-4 py-16 md:py-24' aria-labelledby='locations-heading'>
          <div className='mx-auto max-w-3xl text-center'>
            <h1 id='locations-heading' className='text-3xl font-bold text-white md:text-5xl'>
              {copy.heading}
            </h1>
            <p className='mt-6 text-md leading-relaxed text-white/90 md:text-lg'>{copy.intro}</p>
          </div>
        </section>

        <section className='px-4 py-12 md:py-16' aria-labelledby='city-list-heading'>
          <div className='mx-auto max-w-5xl'>
            <h2 id='city-list-heading' className='sr-only'>
              {copy.listHeading}
            </h2>
            <ul className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
              {cities.map(city => (
                <li key={city.slug}>
                  <Link
                    href={`/locations/${city.slug}`}
                    className='block h-full rounded border border-border bg-card p-6 transition-colors hover:border-primary-500'
                  >
                    <h3 className='text-lg font-semibold'>{t(city.name, loc)}</h3>
                    <p className='mt-1 text-sm text-muted-foreground'>{t(city.region, loc)}</p>
                    <p className='mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground'>
                      {t(city.intro, loc)}
                    </p>
                    <span className='mt-4 inline-block text-sm font-medium text-primary-500'>
                      {copy.cta} →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </>
  );
}
