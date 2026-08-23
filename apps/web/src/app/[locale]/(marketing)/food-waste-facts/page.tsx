import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/layout';
import { Link } from '@/i18n/routing';
import { FAQSchema, BreadcrumbSchema } from '@/components/seo/schemas';
import { buildPageMetadata } from '@/lib/seo-metadata';
import { getCanonicalUrl } from '@/config/seo.config';
import type { Locale } from '@/i18n/config';

interface FoodWasteFactsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'foodWasteFacts' });
  return buildPageMetadata({
    path: '/food-waste-facts',
    locale: locale as Locale,
    title: t('meta.title'),
    description: t('meta.description'),
  });
}

/**
 * The images are the only part of these lists that is not copy, so they stay in
 * the component. Pairing is by index against `journey.chapters`, which the
 * locale test pins at three entries in every language - a fourth chapter added
 * to the messages and not here would render without an image.
 */
const CHAPTER_IMAGES = [
  '/images/food-waste/tomato.jpg',
  '/images/food-waste/bread.jpg',
  '/images/food-waste/hero-waste.jpg',
];

interface Stat {
  value: string;
  label: string;
  source: string;
}
interface Chapter {
  n: string;
  title: string;
  text: string;
}
interface Suspect {
  sector: string;
  item: string;
  note: string;
}
interface Faq {
  question: string;
  answer: string;
}

export default async function FoodWasteFactsPage({ params }: FoodWasteFactsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'foodWasteFacts' });

  const ticker = t.raw('ticker') as string[];
  const stats = t.raw('scale.stats') as Stat[];
  const chapters = t.raw('journey.chapters') as Chapter[];
  const suspects = t.raw('suspects.items') as Suspect[];
  const faqs = t.raw('faqs') as Faq[];

  return (
    <>
      <FAQSchema items={faqs} />
      <BreadcrumbSchema
        items={[
          { name: t('breadcrumb.home'), url: getCanonicalUrl('/', locale as Locale) },
          {
            name: t('breadcrumb.current'),
            url: getCanonicalUrl('/food-waste-facts', locale as Locale),
          },
        ]}
      />
      <Header />

      <div className='min-h-screen bg-brand-cream text-brand-deep'>
        {/* ── HERO ──────────────────────────────────────────────────── */}
        <section className='relative'>
          <div className='mx-auto w-full max-w-[1400px] px-8 grid gap-12 py-10 md:grid-cols-12 md:py-16'>
            {/* Left copy */}
            <div className='md:col-span-7 animate-rise'>
              <p className='mb-6 flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-brand-deep/75'>
                {t('hero.eyebrow')}
              </p>
              <h1 className='font-heading text-5xl font-light leading-[0.95] text-balance md:text-7xl lg:text-8xl'>
                {t('hero.headlineStart')}
                <span className='italic text-brand-green'> {t('hero.headlineEm')} </span>
                {t('hero.headlineEnd')}
              </h1>
              <p className='mt-8 max-w-xl text-lg leading-relaxed text-brand-deep/75'>
                {t('hero.lede')}
              </p>
              <div className='mt-10 flex flex-wrap gap-4'>
                <Link
                  href='#scale'
                  className='rounded-full bg-brand-deep px-7 py-3.5 text-sm text-brand-cream hover:bg-brand-green transition-all'
                >
                  {t('hero.ctaNumbers')}
                </Link>
                <Link
                  href='#act'
                  className='rounded-full border border-brand-deep/30 px-7 py-3.5 text-sm hover:border-brand-green hover:text-brand-green transition-colors'
                >
                  {t('hero.ctaAct')}
                </Link>
              </div>
            </div>

            {/* Right image */}
            <div className='md:col-span-5 relative'>
              <div className='relative overflow-hidden rounded-sm shadow-soft h-full min-h-[420px]'>
                <Image
                  src='/images/food-waste/hero-waste.jpg'
                  alt={t('hero.imageAlt')}
                  fill
                  className='object-cover'
                  sizes='(max-width: 768px) 100vw, 42vw'
                  priority
                />
                <div className='absolute inset-0 bg-gradient-to-t from-brand-deep/60 via-transparent to-transparent' />
                <div className='absolute bottom-6 left-6 right-6 text-brand-cream'>
                  <p className='font-heading text-3xl italic leading-tight'>
                    &ldquo;{t('hero.caption')}&rdquo;
                  </p>
                </div>
              </div>
              <div className='absolute -bottom-6 -left-6 hidden md:block bg-brand-green text-white px-6 py-4 rotate-[-4deg] shadow-soft'>
                <p className='font-heading text-2xl font-medium'>{t('hero.stamp')}</p>
              </div>
            </div>
          </div>

          {/* Marquee ticker */}
          <div className='border-y border-brand-deep/15 bg-brand-deep py-2 text-brand-cream overflow-hidden'>
            <div className='flex w-max animate-marquee-fw gap-12 whitespace-nowrap'>
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className='flex items-center gap-12 font-heading text-2xl italic'>
                  {ticker.map(line => (
                    <span key={line} className='flex items-center gap-12'>
                      {line}
                      <span className='text-secondary-light'>●</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── THE SCALE ─────────────────────────────────────────────── */}
        <section id='scale' className='mx-auto w-full max-w-[1400px] px-8 py-10 md:py-14'>
          <div className='mb-8 grid gap-8 md:grid-cols-12'>
            <div className='md:col-span-4'>
              <p className='text-xs uppercase tracking-[0.25em] text-brand-green'>
                {t('scale.chapter')}
              </p>
              <h2 className='mt-3 font-heading text-5xl font-light md:text-6xl'>
                {t('scale.title')}
              </h2>
            </div>
            <p className='md:col-span-7 md:col-start-6 text-lg leading-relaxed text-brand-deep/75'>
              {t('scale.ledeBefore')} <em>{t('scale.ledeReport')}</em> {t('scale.ledeAfter')}
            </p>
          </div>

          <div className='grid gap-px bg-brand-deep/15 md:grid-cols-2 lg:grid-cols-4 overflow-hidden rounded-sm'>
            {stats.map(s => (
              <div key={s.label} className='bg-brand-cream p-8 transition-colors group'>
                <p className='font-heading text-6xl font-light leading-none md:text-7xl'>
                  {s.value}
                </p>
                <div className='mt-6 h-px w-12 bg-brand-deep/40' />
                <p className='mt-6 text-sm leading-relaxed'>{s.label}</p>
                <p className='mt-4 text-[11px] uppercase tracking-wider text-brand-deep/75'>
                  {s.source}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── JOURNEY ───────────────────────────────────────────────── */}
        <section id='journey' className='bg-brand-deep text-brand-cream py-10 md:py-14 bg-grain'>
          <div className='mx-auto w-full max-w-[1400px] px-8'>
            <div className='mb-10'>
              <p className='text-xs uppercase tracking-[0.25em] text-secondary-light mb-3'>
                {t('journey.chapter')}
              </p>
              <div className='grid gap-8 md:grid-cols-12'>
                <h2 className='md:col-span-5 font-heading text-5xl font-light md:text-6xl'>
                  {t('journey.titleStart')}{' '}
                  <em className='text-secondary-light'>{t('journey.titleEm')}</em>{' '}
                  {t('journey.titleEnd')}
                </h2>
                <p className='md:col-span-6 md:col-start-7 text-lg leading-relaxed text-brand-cream/75'>
                  {t('journey.lede')}
                </p>
              </div>
            </div>

            <div className='space-y-px'>
              {chapters.map((c, i) => (
                <article
                  key={c.n}
                  className='grid gap-6 border-t border-brand-cream/15 py-4 md:grid-cols-12 md:py-5 group'
                >
                  <p className='md:col-span-2 font-heading text-5xl font-light text-secondary-light'>
                    {c.n}
                  </p>
                  <div className='md:col-span-5'>
                    <h3 className='font-heading text-3xl md:text-4xl'>{c.title}</h3>
                    <p className='mt-4 text-brand-cream/75 leading-relaxed'>{c.text}</p>
                  </div>
                  <div className='md:col-span-5 overflow-hidden rounded-sm relative h-36'>
                    <Image
                      src={CHAPTER_IMAGES[i] ?? CHAPTER_IMAGES[0] ?? ''}
                      alt={c.title}
                      fill
                      className='object-cover transition-transform duration-700 group-hover:scale-105'
                      sizes='(max-width: 768px) 100vw, 42vw'
                    />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── PULL QUOTE ────────────────────────────────────────────── */}
        <section className='mx-auto w-full max-w-[1400px] px-8 py-10 md:py-14'>
          <blockquote className='mx-auto max-w-4xl text-center'>
            <p className='font-heading text-4xl font-light italic leading-tight md:text-6xl text-balance'>
              &ldquo;{t('quote.before')}
              <span className='text-brand-green'> {t('quote.em')} </span>
              {t('quote.after')}&rdquo;
            </p>
            <footer className='mt-8 text-xs uppercase tracking-[0.25em] text-brand-deep/75'>
              - {t('quote.attribution')}
            </footer>
          </blockquote>
        </section>

        {/* ── CHAPTER III - WHAT GETS WASTED ────────────────────────── */}
        <section
          id='act'
          className='mx-auto w-full max-w-[1400px] px-8 pt-10 md:pt-14 pb-4 md:pb-6'
        >
          <div className='mb-8 grid gap-8 md:grid-cols-12'>
            <div className='md:col-span-5'>
              <p className='text-xs uppercase tracking-[0.25em] text-brand-green'>
                {t('suspects.chapter')}
              </p>
              <h2 className='mt-3 font-heading text-5xl font-light md:text-6xl'>
                {t('suspects.titleStart')}{' '}
                <em className='text-brand-green'>{t('suspects.titleEm')}</em>.
              </h2>
            </div>
            <p className='md:col-span-6 md:col-start-7 text-lg leading-relaxed text-brand-deep/75'>
              {t('suspects.ledeBefore')}{' '}
              <a
                href='https://www.sciencedirect.com/'
                target='_blank'
                rel='noopener noreferrer'
                className='underline decoration-brand-green underline-offset-4 hover:text-brand-green'
              >
                {t('suspects.ledeLink')}
              </a>
              .
            </p>
          </div>

          <div className='grid gap-px bg-brand-deep/15 md:grid-cols-2 lg:grid-cols-3 overflow-hidden rounded-sm'>
            {suspects.map((w, i) => (
              <article key={w.item} className='bg-brand-cream p-4 transition-colors group'>
                <p className='font-heading text-5xl font-light text-brand-deep/40'>0{i + 1}</p>
                <p className='mt-4 text-[11px] uppercase tracking-[0.2em] text-brand-green'>
                  {w.sector}
                </p>
                <h3 className='mt-3 font-heading text-3xl leading-tight'>{w.item}</h3>
                <div className='mt-5 h-px w-12 bg-brand-deep/40' />
                <p className='mt-5 text-sm leading-relaxed text-brand-deep/75'>{w.note}</p>
              </article>
            ))}
          </div>

          <p className='mt-8 text-xs uppercase tracking-[0.2em] text-brand-deep/75'>
            {t('suspects.footnote')}
          </p>
        </section>
      </div>
    </>
  );
}
