import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo-metadata';
import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { Header } from '@/components/layout';
import { WebPageSchema, BreadcrumbSchema } from '@/components/seo/schemas';
import { getCanonicalUrl } from '@/config/seo.config';
import type { Locale } from '@/i18n/config';

interface ContactPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ContactPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact' });
  return buildPageMetadata({
    path: '/contact',
    locale: locale as Locale,
    title: t('meta.title'),
    description: t('meta.description'),
  });
}

export default async function ContactPage({ params }: ContactPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'contact' });

  return (
    <>
      <WebPageSchema
        type='ContactPage'
        name='Contact Too Fresh To Waste'
        description='Get in touch with the Too Fresh To Waste team. We are here to help consumers, merchants, and partners.'
        url={getCanonicalUrl('/contact', locale as Locale)}
      />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: getCanonicalUrl('/', locale as Locale) },
          { name: 'Contact', url: getCanonicalUrl('/contact', locale as Locale) },
        ]}
      />
      <Header />
      <main className='min-h-screen bg-[#f9f3f0]'>
        {/* Hero */}
        <section className='bg-primary-500 pt-32 pb-16 px-4'>
          <div className='max-w-4xl mx-auto text-center'>
            <h1 className='text-4xl md:text-5xl font-bold text-white mb-3'>{t('hero.title')}</h1>
            <p className='text-white/75 text-base md:text-lg'>{t('hero.subtitle')}</p>
          </div>
        </section>

        {/* Content */}
        <section className='max-w-5xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-8'>
          {/* Provider card */}
          <div className='bg-white rounded-2xl shadow-sm border border-gray-100 p-8'>
            <p className='text-xs font-bold uppercase tracking-widest text-primary-500/60 mb-4'>
              {t('provider.title')}
            </p>
            <h2 className='text-2xl font-bold text-gray-900 mb-6'>{t('provider.name')}</h2>
            <div className='space-y-2 text-gray-600 text-sm'>
              <div className='flex items-start gap-3'>
                <svg
                  className='w-4 h-4 mt-0.5 text-primary-500 shrink-0'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                  aria-hidden='true'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z'
                  />
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M15 11a3 3 0 11-6 0 3 3 0 016 0z'
                  />
                </svg>
                <span>
                  {t('provider.address')}, {t('provider.zip')} {t('provider.city')},{' '}
                  {t('provider.country')}
                </span>
              </div>
            </div>
          </div>

          {/* Contact cards */}
          <div className='space-y-4'>
            {(['0', '1'] as const).map(i => (
              <div
                key={i}
                className='bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-start gap-4'
              >
                <div className='w-10 h-10 rounded-full bg-primary-500/10 flex items-center justify-center shrink-0'>
                  <svg
                    className='w-5 h-5 text-primary-500'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                    aria-hidden='true'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
                    />
                  </svg>
                </div>
                <div>
                  <p className='font-semibold text-gray-900 mb-0.5'>{t(`cards.${i}.title`)}</p>
                  <a
                    href={`mailto:${t(`cards.${i}.email`)}`}
                    className='text-primary-500 font-medium text-sm hover:underline'
                  >
                    {t(`cards.${i}.email`)}
                  </a>
                  <p className='text-gray-500 text-xs mt-1'>{t(`cards.${i}.desc`)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
