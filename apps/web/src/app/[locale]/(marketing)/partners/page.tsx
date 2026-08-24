import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo-metadata';

import type { Locale } from '@/i18n/config';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/layout';
import { Link } from '@/i18n/routing';

interface PartnersPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PartnersPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'partners' });
  return buildPageMetadata({
    path: '/partners',
    locale: locale as Locale,
    title: t('meta.title'),
    description: t('meta.description'),
  });
}

/**
 * Source URLs, paired by index with `stats` in the messages. A URL is not copy
 * and does not belong in three locale files.
 */
const IMPACT_SOURCES = [
  'https://wwf.panda.org/wwf_news/?5131564/',
  'https://www.unep.org/resources/publication/food-waste-index-report-2024',
  'https://www.unep.org/resources/report/unep-food-waste-index-report-2021',
  'https://www.ibm.com/thought-leadership/institute-business-value/en-us/report/2022-consumer-study',
] as const;

interface Stat {
  value: string;
  label: string;
  source: string;
}

interface Step {
  n: string;
  title: string;
  body: string;
}

/** Paired by index with `benefits.items` in the messages. */
const BENEFIT_ICONS = ['💰', '📣', '🤝', '🌿', '🗑️', '📰'] as const;

interface Benefit {
  title: string;
  body: string;
}

/** Paired by index with `whyNow.items`. */
const WHY_NOW_SOURCES = [
  'https://www.unep.org/resources/publication/food-waste-index-report-2024',
  'https://www.fao.org/3/i3991e/i3991e.pdf',
  'https://wrap.org.uk/taking-action/food-drink/hospitality-food-service',
  'https://www.epa.gov/gmi/importance-methane',
] as const;

interface WhyNowItem {
  stat: string;
  label: string;
  source: string;
}

/**
 * Brand names, not copy - Bonépi is Bonépi in every language. The category
 * descriptors are ours, so those live in `founding.categories`.
 */
const FOUNDING_PARTNERS = ['Bonépi', 'BigBen', "L'Opéra", 'Kohn'] as const;

interface WhyUsPoint {
  title: string;
  body: string;
}

export default async function PartnersPage({ params }: PartnersPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'partners' });

  const ticker = t.raw('ticker') as string[];
  const impactStats = t.raw('stats') as Stat[];
  const howItWorks = t.raw('solution.steps') as Step[];
  const benefits = t.raw('benefits.items') as Benefit[];
  const whyNow = t.raw('whyNow.items') as WhyNowItem[];
  const whyUsPoints = t.raw('whyUs.points') as WhyUsPoint[];
  const foundingCategories = t.raw('founding.categories') as string[];

  /** Source anchors for the Problem prose, supplied to the rich-text tags. */
  /**
   * Named rather than an arrow chain, because `react/display-name` reads any
   * function returning JSX as a component and an anonymous one has nothing to
   * show in a stack trace.
   */
  function sourceLink(href: string) {
    return function SourceLink(chunks: React.ReactNode) {
      return (
        <a
          href={href}
          target='_blank'
          rel='noopener noreferrer'
          className='text-brand-green hover:underline font-semibold'
        >
          {chunks}
        </a>
      );
    };
  }

  return (
    <>
      <Header />

      <div className='min-h-screen bg-brand-cream text-brand-deep'>
        {/* ── HERO ──────────────────────────────────────────────────── */}
        <section className='relative'>
          <div className='mx-auto w-full max-w-[1400px] px-4xl py-14 md:py-5xl grid gap-3xl md:grid-cols-12 items-center'>
            <div className='md:col-span-7'>
              <p className='mb-2xl flex items-center gap-md text-xs uppercase tracking-[0.25em] text-brand-deep/75'>
                {t('hero.eyebrow')}
              </p>
              <h1 className='font-heading text-5xl font-light leading-[0.95] text-balance md:text-7xl lg:text-8xl'>
                {t('hero.titleStart')}
                <span className='italic text-brand-green'> {t('hero.titleEm')}</span>.
              </h1>
              <p className='mt-4xl max-w-xl text-lg leading-relaxed text-brand-deep/75'>
                {t('hero.lede')}
              </p>
              <div className='mt-6xl flex flex-wrap gap-lg'>
                <Link
                  href='/partner-kit'
                  className='rounded-full bg-brand-deep px-3xl py-3.5 text-sm text-brand-cream hover:bg-brand-green transition-all'
                >
                  {t('hero.ctaKit')}
                </Link>
                <Link
                  href='/contact'
                  className='rounded-full border border-brand-deep/30 px-3xl py-3.5 text-sm hover:border-brand-green hover:text-brand-green transition-colors'
                >
                  {t('hero.ctaContact')}
                </Link>
              </div>
            </div>

            <div className='md:col-span-5'>
              <div className='grid grid-cols-2 gap-md'>
                {impactStats.slice(0, 4).map((s, i) => (
                  <div
                    key={s.value}
                    className='bg-white/60 border border-brand-deep/10 rounded-sm p-xl hover:bg-brand-green/10 transition-colors'
                  >
                    <p className='font-heading text-4xl font-light text-brand-deep leading-none'>
                      {s.value}
                    </p>
                    <p className='mt-md text-xs leading-relaxed text-brand-deep/70'>{s.label}</p>
                    <a
                      href={IMPACT_SOURCES[i] ?? IMPACT_SOURCES[0]}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='mt-sm block text-[10px] uppercase tracking-wider text-brand-green hover:underline'
                    >
                      {s.source}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ticker */}
          <div className='border-y border-brand-deep/15 bg-brand-deep py-sm text-brand-cream overflow-hidden'>
            <div className='flex w-max animate-marquee-fw gap-3xl whitespace-nowrap'>
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className='flex items-center gap-3xl font-heading text-2xl italic'>
                  {ticker.map(line => (
                    <span key={line} className='flex items-center gap-3xl'>
                      {line}
                      <span className='text-secondary-light'>●</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── THE PROBLEM ───────────────────────────────────────────── */}
        <section className='mx-auto w-full max-w-[1400px] px-4xl py-3xl md:py-4xl'>
          <div className='grid gap-4xl md:grid-cols-12 mb-6xl'>
            <div className='md:col-span-4'>
              <p className='text-xs uppercase tracking-[0.25em] text-brand-green'>
                {t('problem.eyebrow')}
              </p>
              <h2 className='mt-md font-heading text-5xl font-light md:text-6xl'>
                {t('problem.titleStart')} <em>{t('problem.titleEm')}</em>.
              </h2>
            </div>
            <div className='md:col-span-7 md:col-start-6 space-y-xl text-brand-deep/75 leading-relaxed'>
              <p className='text-lg'>
                {t.rich('problem.p1', {
                  b: chunks => <strong className='text-brand-deep'>{chunks}</strong>,
                  wrap: sourceLink(
                    'https://wrap.org.uk/taking-action/food-drink/hospitality-food-service',
                  ),
                })}
              </p>
              <p>
                {t.rich('problem.p2', {
                  fao: sourceLink('https://www.fao.org/3/i3991e/i3991e.pdf'),
                  epa: sourceLink('https://www.epa.gov/gmi/importance-methane'),
                })}
              </p>
              <p>
                {t.rich('problem.p3', {
                  unep: sourceLink(
                    'https://www.unep.org/resources/publication/food-waste-index-report-2024',
                  ),
                })}
              </p>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ──────────────────────────────────────────── */}
        <section className='bg-brand-deep text-brand-cream py-3xl md:py-4xl'>
          <div className='mx-auto w-full max-w-[1400px] px-4xl'>
            <div className='mb-6xl grid gap-4xl md:grid-cols-12'>
              <div className='md:col-span-5'>
                <p className='text-xs uppercase tracking-[0.25em] text-secondary-light mb-md'>
                  {t('solution.eyebrow')}
                </p>
                <h2 className='font-heading text-5xl font-light md:text-6xl'>
                  {t('solution.titleStart')}{' '}
                  <em className='text-secondary-light'>{t('solution.titleEm')}</em>
                </h2>
              </div>
              <p className='md:col-span-6 md:col-start-7 text-lg leading-relaxed text-brand-cream/70 self-end'>
                {t('solution.lede')}
              </p>
            </div>

            <div className='space-y-px'>
              {howItWorks.map(step => (
                <article
                  key={step.n}
                  className='grid gap-2xl border-t border-brand-cream/15 py-xl md:grid-cols-12 group'
                >
                  <p className='md:col-span-2 font-heading text-5xl font-light text-secondary-light'>
                    {step.n}
                  </p>
                  <div className='md:col-span-9'>
                    <h3 className='font-heading text-3xl md:text-4xl'>{step.title}</h3>
                    <p className='mt-md text-brand-cream/70 leading-relaxed max-w-2xl'>
                      {step.body}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── BENEFITS ──────────────────────────────────────────────── */}
        <section className='mx-auto w-full max-w-[1400px] px-4xl py-3xl md:py-4xl'>
          <div className='mb-6xl'>
            <p className='text-xs uppercase tracking-[0.25em] text-brand-green'>
              {t('benefits.eyebrow')}
            </p>
            <h2 className='mt-md font-heading text-5xl font-light md:text-6xl'>
              What partners <em>actually get</em>.
            </h2>
          </div>
          <div className='grid gap-px bg-brand-deep/15 sm:grid-cols-2 lg:grid-cols-3 overflow-hidden rounded-sm'>
            {benefits.map((b, i) => (
              <div
                key={i}
                className='bg-brand-cream p-4xl hover:bg-brand-green/10 transition-colors group'
              >
                <span className='text-3xl'>{BENEFIT_ICONS[i] ?? BENEFIT_ICONS[0]}</span>
                <h3 className='mt-xl font-heading text-2xl'>{b.title}</h3>
                <div className='mt-lg h-px w-10 bg-brand-deep/30 group-hover:bg-brand-deep transition-colors' />
                <p className='mt-xl text-sm leading-relaxed text-brand-deep/70'>{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── WHY NOW ───────────────────────────────────────────────── */}
        <section className='bg-white/40 py-3xl md:py-4xl'>
          <div className='mx-auto w-full max-w-[1400px] px-4xl'>
            <div className='mb-6xl grid gap-4xl md:grid-cols-12'>
              <div className='md:col-span-4'>
                <p className='text-xs uppercase tracking-[0.25em] text-brand-green'>
                  {t('whyNow.eyebrow')}
                </p>
                <h2 className='mt-md font-heading text-5xl font-light md:text-6xl'>
                  {t('whyNow.title')}
                </h2>
              </div>
              <p className='md:col-span-7 md:col-start-6 text-lg leading-relaxed text-brand-deep/75 self-end'>
                {t('whyNow.lede')}
              </p>
            </div>

            <div className='grid gap-px bg-brand-deep/15 sm:grid-cols-2 overflow-hidden rounded-sm'>
              {whyNow.map((w, i) => (
                <div
                  key={w.stat}
                  className='bg-brand-cream p-4xl hover:bg-brand-green/10 transition-colors'
                >
                  <p className='font-heading text-5xl font-light text-brand-deep leading-none'>
                    {w.stat}
                  </p>
                  <div className='mt-xl h-px w-12 bg-brand-deep/30' />
                  <p className='mt-xl leading-relaxed text-brand-deep/75'>{w.label}</p>
                  <a
                    href={WHY_NOW_SOURCES[i] ?? WHY_NOW_SOURCES[0]}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='mt-lg block text-[11px] uppercase tracking-wider text-brand-green hover:underline'
                  >
                    {w.source}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── WHY TFTW ──────────────────────────────────────────────── */}
        <section className='mx-auto w-full max-w-[1400px] px-4xl py-3xl md:py-4xl'>
          <div className='grid gap-6xl md:grid-cols-12 items-start'>
            <div className='md:col-span-5'>
              <p className='text-xs uppercase tracking-[0.25em] text-brand-green'>
                {t('whyUs.eyebrow')}
              </p>
              <h2 className='mt-md font-heading text-5xl font-light md:text-6xl'>
                {t('whyUs.titleStart')} <em>{t('whyUs.titleEm')}</em>
                {t('whyUs.titleEnd')}
              </h2>
              <p className='mt-2xl text-lg leading-relaxed text-brand-deep/75'>{t('whyUs.lede')}</p>
              <div className='mt-4xl'>
                <Link
                  href='/partner-kit'
                  className='inline-block rounded-full bg-brand-green text-white px-3xl py-3.5 text-sm font-medium hover:bg-brand-deep transition-all'
                >
                  {t('whyUs.cta')}
                </Link>
              </div>
            </div>

            <div className='md:col-span-6 md:col-start-7 grid gap-lg'>
              {whyUsPoints.map(item => (
                <div
                  key={item.title}
                  className='flex gap-xl border-b border-brand-deep/10 pb-lg last:border-0'
                >
                  <span className='mt-xs size-1.5 shrink-0 rounded-full bg-brand-green' />
                  <div>
                    <p className='font-semibold text-sm'>{item.title}</p>
                    <p className='text-sm leading-relaxed text-brand-deep/65 mt-xxs'>{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FOUNDING PARTNERS ─────────────────────────────────────── */}
        <section className='bg-brand-deep text-brand-cream py-3xl md:py-4xl'>
          <div className='mx-auto w-full max-w-[1400px] px-4xl'>
            <div className='mb-6xl grid gap-2xl md:grid-cols-12'>
              <div className='md:col-span-5'>
                <p className='text-xs uppercase tracking-[0.25em] text-secondary-light mb-md'>
                  {t('founding.eyebrow')}
                </p>
                <h2 className='font-heading text-5xl font-light md:text-6xl'>
                  {t('founding.titleStart')}{' '}
                  <em className='text-secondary-light'>{t('founding.titleEm')}</em>.
                </h2>
              </div>
              <p className='md:col-span-6 md:col-start-7 text-lg leading-relaxed text-brand-cream/70 self-end'>
                {t('founding.lede')}
              </p>
            </div>

            <div className='grid gap-px bg-brand-cream/15 sm:grid-cols-2 lg:grid-cols-4 overflow-hidden rounded-sm'>
              {FOUNDING_PARTNERS.map((name, i) => (
                <div key={name} className='p-4xl hover:bg-brand-cream/10 transition-colors'>
                  <div className='size-12 rounded-full bg-secondary-light/20 flex items-center justify-center mb-2xl'>
                    <span className='font-heading text-xl text-secondary-light'>
                      {name.charAt(0)}
                    </span>
                  </div>
                  <h3 className='font-heading text-3xl'>{name}</h3>
                  <p className='mt-sm text-sm text-brand-cream/75'>{foundingCategories[i]}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────── */}
        <section className='mx-auto w-full max-w-[1400px] px-4xl py-4xl md:py-6xl text-center'>
          <p className='text-xs uppercase tracking-[0.25em] text-brand-green mb-xl'>
            {t('cta.eyebrow')}
          </p>
          <h2 className='font-heading text-5xl font-light md:text-7xl text-balance max-w-3xl mx-auto'>
            {t('cta.titleStart')} <em>{t('cta.titleEm')}</em>.
          </h2>
          <p className='mt-2xl text-lg text-brand-deep/75 max-w-xl mx-auto leading-relaxed'>
            {t('cta.lede')}
          </p>
          <div className='mt-6xl flex flex-wrap justify-center gap-lg'>
            <Link
              href='/partner-kit'
              className='rounded-full bg-brand-deep px-4xl py-lg text-sm text-brand-cream hover:bg-brand-green transition-all font-medium'
            >
              {t('cta.ctaKit')}
            </Link>
            <Link
              href='/contact'
              className='rounded-full border border-brand-deep/30 px-4xl py-lg text-sm hover:border-brand-green hover:text-brand-green transition-colors'
            >
              {t('cta.ctaContact')}
            </Link>
          </div>
          <p className='mt-4xl text-xs text-brand-deep/75'>{t('cta.footnote')}</p>
        </section>
      </div>
    </>
  );
}
