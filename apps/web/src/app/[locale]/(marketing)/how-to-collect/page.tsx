import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo-metadata';

import type { Locale } from '@/i18n/config';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/layout';
import { Link } from '@/i18n/routing';
import { AppDownloadButton } from '@/components/sections/AppDownloadButton';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'howToCollect' });
  return buildPageMetadata({
    path: '/how-to-collect',
    locale: locale as Locale,
    title: t('meta.title'),
    description: t('meta.description'),
  });
}

/**
 * Screenshots pair with `steps` by index. They are not copy, so they stay here
 * rather than going into the messages - but the pairing means a step added in
 * one place and not the other renders without its screen, which the locale test
 * catches by pinning the count at seven in all three languages.
 */
const STEP_SCREENS = [
  { image: '/images/buy-screen-onoarding/home-screen.webp', altKey: 'browse' },
  { image: '/images/buy-screen-onoarding/offer-details.webp', altKey: 'details' },
  { image: '/images/buy-screen-onoarding/reserve.webp', altKey: 'reserve' },
  { image: '/images/buy-screen-onoarding/checkout.webp', altKey: 'checkout' },
  { image: '/images/buy-screen-onoarding/order-summary.webp', altKey: 'summary' },
  { image: '/images/buy-screen-onoarding/code-order-summary.webp', altKey: 'code' },
  { image: '/images/buy-screen-onoarding/MY-Points.webp', altKey: 'points' },
] as const;

interface Step {
  n: string;
  title: string;
  body: string;
  bullets: string[];
  tip: string | null;
}

export default async function HowToCollectPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'howToCollect' });

  const steps = t.raw('steps') as Step[];

  return (
    <>
      <Header />

      <main className='min-h-screen bg-white text-primary-500'>
        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section className='bg-primary-500 pt-5xl pb-4xl'>
          <div className='mx-auto max-w-4xl px-2xl text-center'>
            <div className='inline-flex items-center gap-sm bg-white/10 border border-white/20 text-white/75 text-[10px] font-bold uppercase tracking-[0.25em] px-lg py-sm rounded-full mb-2xl'>
              {t('hero.eyebrow')}
            </div>
            <h1 className='font-heading text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight mb-xl'>
              {t('hero.titleStart')}{' '}
              <span className='text-secondary-light italic'>{t('hero.titleEm')}</span>
            </h1>
            <p className='text-white/75 text-base lg:text-lg leading-relaxed max-w-2xl mx-auto'>
              {t('hero.lede')}
            </p>
          </div>
        </section>

        {/* Wave */}
        <div className='bg-primary-500' aria-hidden='true'>
          <svg viewBox='0 0 1440 48' className='block w-full' preserveAspectRatio='none'>
            <path d='M0,24 C360,48 1080,0 1440,24 L1440,48 L0,48 Z' className='fill-white' />
          </svg>
        </div>

        {/* ── STEPS ────────────────────────────────────────────────────── */}
        <section className='py-4xl lg:py-6xl'>
          <div className='mx-auto max-w-6xl px-2xl lg:px-4xl'>
            <div className='space-y-4xl lg:space-y-5xl'>
              {steps.map((step, i) => {
                const screen = STEP_SCREENS[i];
                return (
                  <div key={step.n} className='grid lg:grid-cols-2 gap-6xl lg:gap-4xl items-start'>
                    {/* LEFT - text */}
                    <div className='order-2 lg:order-1'>
                      <div className='flex items-center gap-md mb-xl'>
                        <span className='flex items-center justify-center w-10 h-10 rounded-full bg-primary-500 text-white font-black text-sm font-heading shrink-0'>
                          {step.n}
                        </span>
                        <div className='h-px flex-1 bg-primary-500/10' />
                      </div>

                      <h2 className='font-heading text-2xl lg:text-3xl font-bold text-primary-500 leading-snug mb-lg'>
                        {step.title}
                      </h2>

                      <p className='text-primary-500/75 text-base leading-relaxed mb-xl'>
                        {step.body}
                      </p>

                      <ul className='space-y-2.5 mb-xl'>
                        {step.bullets.map(bullet => (
                          <li
                            key={bullet}
                            className='flex items-start gap-md text-sm text-primary-500/75'
                          >
                            <span className='mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-green shrink-0' />
                            {bullet}
                          </li>
                        ))}
                      </ul>

                      {step.tip !== null && step.tip !== '' && (
                        <div className='flex items-start gap-md bg-primary-500/5 border border-primary-500/10 rounded-xl px-lg py-md'>
                          <span className='text-brand-green font-bold text-sm shrink-0 mt-xxs'>
                            {t('tipLabel')}
                          </span>
                          <p className='text-sm text-primary-500/75 leading-relaxed'>{step.tip}</p>
                        </div>
                      )}

                      {/* Step connector on mobile */}
                      {i < steps.length - 1 && (
                        <div className='flex lg:hidden items-center gap-sm mt-4xl text-primary-500/75'>
                          <div className='h-px flex-1 bg-primary-500/10' />
                          <span className='text-xs uppercase tracking-widest'>{t('nextStep')}</span>
                          <div className='h-px flex-1 bg-primary-500/10' />
                        </div>
                      )}
                    </div>

                    {/* RIGHT - screen */}
                    <div className='order-1 lg:order-2 flex justify-center lg:justify-end'>
                      <div className='bg-brand-teal relative rounded-[2.5rem] p-2xl flex items-center justify-center'>
                        {screen && (
                          <Image
                            src={screen.image}
                            alt={step.title}
                            width={280}
                            height={560}
                            className='relative w-[200px] lg:w-[240px] h-auto drop-shadow-2xl'
                            sizes='280px'
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <section className='bg-primary-500 py-4xl lg:py-5xl'>
          <div className='mx-auto max-w-2xl px-2xl text-center'>
            <h2 className='font-heading text-3xl lg:text-4xl font-bold text-white mb-lg'>
              {t('cta.title')}
            </h2>
            <p className='text-white/75 text-base leading-relaxed mb-4xl'>{t('cta.body')}</p>
            <div className='flex flex-col sm:flex-row gap-md justify-center'>
              <AppDownloadButton
                className='inline-flex items-center justify-center gap-md bg-white text-primary-500 font-bold px-2xl py-3.5 rounded-full hover:opacity-90 transition-opacity shadow-lg text-sm'
                aria-label={t('cta.appStore')}
              >
                {t('cta.appStore')}
              </AppDownloadButton>
              <AppDownloadButton
                className='inline-flex items-center justify-center gap-md border border-white/40 text-white font-bold px-2xl py-3.5 rounded-full hover:border-white/70 hover:bg-white/5 transition-colors text-sm'
                aria-label={t('cta.googlePlay')}
              >
                {t('cta.googlePlay')}
              </AppDownloadButton>
            </div>
            <Link
              href='/blog/how-to-collect-surprise-bag'
              className='inline-block mt-2xl text-white/75 text-xs hover:text-white transition-colors'
            >
              {t('cta.article')}
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
