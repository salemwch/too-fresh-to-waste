import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/layout';
import { Link } from '@/i18n/routing';
import { FAQSchema, BreadcrumbSchema, ServiceAreaSchema } from '@/components/seo/schemas';
import { getCanonicalUrl } from '@/config/seo.config';
import { locales, getLocaleConfig } from '@/i18n/config';
import { getCityBySlug, getCityStaticParams, t } from '@/content/locations';

import type { Locale } from '@/i18n/config';

interface CityPageProps {
  params: Promise<{ locale: string; city: string }>;
}

// Prerender all locale × city combinations at build time. These pages are pure
// static content, so serving them as cached HTML is both the fastest option and
// the one crawlers index most reliably.
export function generateStaticParams() {
  return getCityStaticParams(locales);
}

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const { locale, city: slug } = await params;
  const loc = locale as Locale;
  const city = getCityBySlug(slug);

  if (!city) return {};

  const path = `/locations/${city.slug}`;
  const alternateLanguages: Record<string, string> = {
    'x-default': getCanonicalUrl(path, 'en'),
  };
  locales.forEach(l => {
    alternateLanguages[getLocaleConfig(l).hreflang] = getCanonicalUrl(path, l);
  });

  const title = t(city.metaTitle, loc);
  const description = t(city.metaDescription, loc);

  return {
    title,
    description,
    alternates: {
      canonical: getCanonicalUrl(path, loc),
      languages: alternateLanguages,
    },
    openGraph: {
      type: 'website',
      title,
      description,
      url: getCanonicalUrl(path, loc),
    },
  };
}

export default async function CityPage({ params }: CityPageProps) {
  const { locale, city: slug } = await params;
  const loc = locale as Locale;

  setRequestLocale(locale);

  const city = getCityBySlug(slug);
  if (!city) notFound();

  const cityName = t(city.name, loc);
  const nearbyCities = city.nearby
    .map(getCityBySlug)
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const faqItems = city.faqs.map(f => ({
    question: t(f.question, loc),
    answer: t(f.answer, loc),
  }));

  return (
    <>
      <ServiceAreaSchema city={city} locale={loc} />
      <FAQSchema items={faqItems} />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: getCanonicalUrl('/', loc) },
          { name: 'Locations', url: getCanonicalUrl('/locations', loc) },
          { name: cityName, url: getCanonicalUrl(`/locations/${city.slug}`, loc) },
        ]}
      />

      <Header />

      <main role='main'>
        {/* Hero — the H1 and the answer-first paragraph a snippet can lift */}
        <section className='bg-primary-500 px-4 py-16 md:py-24' aria-labelledby='city-heading'>
          <div className='mx-auto max-w-3xl text-center'>
            <p className='text-sm font-medium uppercase tracking-widest text-white/70'>
              Too Fresh To Waste · Tunisia
            </p>
            <h1 id='city-heading' className='mt-4 text-3xl font-bold text-white md:text-5xl'>
              {t(city.heading, loc)}
            </h1>
            <p className='mt-6 text-md leading-relaxed text-white/90 md:text-lg'>
              {t(city.intro, loc)}
            </p>
          </div>
        </section>

        {/* Local context — the unique-value block that keeps this off the
            doorway-page pile */}
        <section className='px-4 py-12 md:py-16' aria-labelledby='context-heading'>
          <div className='mx-auto max-w-3xl'>
            <h2 id='context-heading' className='text-2xl font-semibold md:text-3xl'>
              Why food waste matters in {cityName}
            </h2>
            <p className='mt-4 text-base leading-relaxed text-muted-foreground'>
              {t(city.localContext, loc)}
            </p>

            <h3 className='mt-10 text-xl font-semibold'>What you will find in a bag</h3>
            <p className='mt-3 text-base leading-relaxed text-muted-foreground'>
              {t(city.cuisine, loc)}
            </p>
          </div>
        </section>

        {/* Neighbourhoods — long-tail surface for "anti gaspi [quartier]" */}
        <section className='bg-muted px-4 py-12 md:py-16' aria-labelledby='areas-heading'>
          <div className='mx-auto max-w-3xl'>
            <h2 id='areas-heading' className='text-2xl font-semibold md:text-3xl'>
              Areas we cover in {cityName}
            </h2>
            <ul className='mt-6 flex flex-wrap gap-2'>
              {city.neighborhoods.map(area => (
                <li
                  key={area}
                  className='rounded-full border border-border bg-card px-4 py-2 text-sm'
                >
                  {area}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ — rendered visibly so the FAQPage schema describes real content */}
        {faqItems.length > 0 && (
          <section className='px-4 py-12 md:py-16' aria-labelledby='faq-heading'>
            <div className='mx-auto max-w-3xl'>
              <h2 id='faq-heading' className='text-2xl font-semibold md:text-3xl'>
                Frequently asked questions about {cityName}
              </h2>
              <dl className='mt-8 space-y-6'>
                {faqItems.map(item => (
                  <div key={item.question} className='border-b border-border pb-6'>
                    <dt className='text-md font-semibold'>{item.question}</dt>
                    <dd className='mt-2 text-base leading-relaxed text-muted-foreground'>
                      {item.answer}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        )}

        {/* Internal linking — distributes authority across the city cluster
            instead of letting each page sit orphaned */}
        {nearbyCities.length > 0 && (
          <section className='bg-muted px-4 py-12 md:py-16' aria-labelledby='nearby-heading'>
            <div className='mx-auto max-w-3xl'>
              <h2 id='nearby-heading' className='text-2xl font-semibold md:text-3xl'>
                Nearby cities
              </h2>
              <ul className='mt-6 grid gap-4 sm:grid-cols-3'>
                {nearbyCities.map(nearby => (
                  <li key={nearby.slug}>
                    <Link
                      href={`/locations/${nearby.slug}`}
                      className='block rounded border border-border bg-card p-4 transition-colors hover:border-primary-500'
                    >
                      <span className='text-md font-semibold'>{t(nearby.name, loc)}</span>
                      <span className='mt-1 block text-sm text-muted-foreground'>
                        {t(nearby.region, loc)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className='mt-8 text-sm'>
                <Link href='/locations' className='underline hover:text-primary-500'>
                  See all cities we serve in Tunisia
                </Link>
              </p>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
