import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/layout';
import { Link } from '@/i18n/routing';
import { ArticleSchema, BreadcrumbSchema } from '@/components/seo/schemas';
import { buildPageMetadata } from '@/lib/seo-metadata';
import { getCanonicalUrl } from '@/config/seo.config';
import type { Locale } from '@/i18n/config';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'esg' });
  return buildPageMetadata({
    path: '/esg',
    locale: locale as Locale,
    title: t('meta.title'),
    description: t('meta.description'),
  });
}

// ── SVG icons ─────────────────────────────────────────────────────────────────

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M11 20A7 7 0 014 13c0-5 4-9 8-11 4 2 8 6 8 11a7 7 0 01-7 7c-1 0-1.4-.1-2-.3' />
      <path d='M12 9c0 5-4 9-8 11' />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2' />
      <circle cx='9' cy='7' r='4' />
      <path d='M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' />
    </svg>
  );
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' />
      <line x1='12' y1='9' x2='12' y2='13' />
      <line x1='12' y1='17' x2='12.01' y2='17' />
    </svg>
  );
}

function TrendingUpIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <polyline points='23 6 13.5 15.5 8.5 10.5 1 18' />
      <polyline points='17 6 23 6 23 12' />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 20 20' fill='currentColor' className={className} aria-hidden='true'>
      <path
        fillRule='evenodd'
        d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
        clipRule='evenodd'
      />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={2}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M5 12h14M12 5l7 7-7 7' />
    </svg>
  );
}

function ScaleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M12 3v18M3 9l9-6 9 6M3 9l4 8a5 5 0 0010 0l4-8' />
    </svg>
  );
}

function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <rect x='2' y='7' width='20' height='14' rx='2' ry='2' />
      <path d='M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16' />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <circle cx='12' cy='12' r='10' />
      <path d='M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20' />
    </svg>
  );
}

function ZapIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2' />
    </svg>
  );
}

// ── Static data ───────────────────────────────────────────────────────────────

/** Paired by index with `fundamentals.pillars`. Letters are not translated. */
const PILLAR_ART = [
  {
    letter: 'E',
    icon: LeafIcon,
    color: 'text-primary-500',
    bg: 'bg-primary-500/10',
    border: 'border-primary-500/20',
    accent: 'bg-primary-500',
  },
  {
    letter: 'S',
    icon: UsersIcon,
    color: 'text-brand-teal',
    bg: 'bg-brand-teal/10',
    border: 'border-brand-teal/20',
    accent: 'bg-brand-teal',
  },
  {
    letter: 'G',
    icon: ShieldIcon,
    color: 'text-brand-green',
    bg: 'bg-brand-green/10',
    border: 'border-brand-green/20',
    accent: 'bg-brand-green',
  },
] as const;

/** Paired by index with `hero.stats`. */
const HERO_STAT_BORDERS = [
  'border-secondary-light/30',
  'border-secondary-light/25',
  'border-white/20',
] as const;

interface Pillar {
  label: string;
  headline: string;
  body: string;
  metrics: string[];
}

/**
 * Urgency ranks, paired by index with `regulations.items`. The rank is a
 * judgement we make, not copy - three translators should not be able to
 * disagree about whether CBAM is Immediate.
 */
type Urgency = 'immediate' | 'high' | 'medium';
const REGULATION_URGENCY: readonly Urgency[] = [
  'immediate',
  'immediate',
  'medium',
  'medium',
  'medium',
];

/** Paired by index with `businessCase.items`. */
const BUSINESS_ICONS = [
  GlobeIcon,
  TrendingUpIcon,
  ShieldIcon,
  UsersIcon,
  BriefcaseIcon,
  ZapIcon,
] as const;

interface Regulation {
  code: string;
  full: string;
  status: string;
  deadline: string;
  summary: string;
  impact: string;
}

/** Paired by index with `tunisia.reasons`. */
const TUNISIA_ICONS = [
  GlobeIcon,
  BriefcaseIcon,
  ScaleIcon,
  TrendingUpIcon,
  ZapIcon,
  AlertTriangleIcon,
] as const;

interface TunisiaReason {
  title: string;
  body: string;
}

/** Paired by index with `contribution.items`. */
const CONTRIBUTION_COLORS = ['bg-primary-500', 'bg-brand-teal', 'bg-brand-green'] as const;

interface Contribution {
  pillar: string;
  title: string;
  body: string;
  metric: string;
  metricLabel: string;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ESGPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'esg' });

  const heroStats = t.raw('hero.stats') as { value: string; label: string }[];
  const pillars = t.raw('fundamentals.pillars') as Pillar[];
  const businessCase = t.raw('businessCase.items') as {
    title: string;
    body: string;
    badge: string;
  }[];
  const regulations = t.raw('regulations.items') as Regulation[];
  const tunisiaReasons = t.raw('tunisia.reasons') as TunisiaReason[];
  const contributions = t.raw('contribution.items') as Contribution[];

  return (
    <>
      <ArticleSchema
        title={t('meta.schemaTitle')}
        description={t('meta.schemaDescription')}
        publishedAt='2024-01-01'
        updatedAt='2026-08-23'
        url={getCanonicalUrl('/esg', locale as Locale)}
        authorName='Too Fresh To Waste Team'
        locale={locale as Locale}
      />
      <BreadcrumbSchema
        items={[
          { name: t('breadcrumb.home'), url: getCanonicalUrl('/', locale as Locale) },
          { name: t('breadcrumb.current'), url: getCanonicalUrl('/esg', locale as Locale) },
        ]}
      />
      <Header />

      <main className='min-h-screen bg-white text-primary-500'>
        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <section className='bg-primary-500 relative overflow-hidden'>
          {/* Decorative acronym ghost */}
          <div
            className='absolute bottom-lg right-lg text-[200px] font-black text-white/[0.025] select-none pointer-events-none leading-none tracking-tighter hidden lg:block'
            aria-hidden='true'
          >
            ESG
          </div>

          <div className='relative mx-auto max-w-7xl px-2xl lg:px-4xl pt-4xl pb-0 lg:pt-6xl'>
            <div className='grid lg:grid-cols-2 gap-3xl lg:gap-5xl items-center'>
              {/* Left - copy */}
              <div className='pb-4xl lg:pb-6xl'>
                <h1 className='font-heading text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight mb-xl'>
                  {t('hero.titleStart')}{' '}
                  <span className='text-secondary-light italic'>{t('hero.titleEm1')}</span>
                  <br />
                  {t('hero.titleMid')}{' '}
                  <span className='text-secondary-light italic'>{t('hero.titleEm2')}</span>
                </h1>

                <p className='text-white/65 text-base lg:text-lg leading-relaxed mb-4xl max-w-xl'>
                  {t('hero.lede')}
                </p>

                <div className='flex flex-wrap gap-md'>
                  <a
                    href='#what-is-esg'
                    className='inline-flex items-center gap-sm bg-white text-primary-500 font-bold px-2xl py-3.5 rounded-full hover:bg-cream transition-colors shadow-lg text-sm'
                  >
                    {t('hero.ctaUnderstand')}
                    <ArrowRightIcon className='w-4 h-4' />
                  </a>
                  <a
                    href='#eu-regulations'
                    className='inline-flex items-center gap-sm border border-white/30 text-white font-bold px-2xl py-3.5 rounded-full hover:border-white/60 hover:bg-white/5 transition-colors text-sm'
                  >
                    {t('hero.ctaLaws')}
                    <ArrowRightIcon className='w-4 h-4' />
                  </a>
                </div>
              </div>

              {/* Right - stat cards */}
              <div className='hidden lg:flex flex-col gap-lg pb-4xl'>
                {heroStats.map((s, i) => (
                  <div
                    key={s.value}
                    className={`bg-white/10 border ${HERO_STAT_BORDERS[i] ?? HERO_STAT_BORDERS[0]} rounded-2xl px-2xl py-xl`}
                  >
                    <p className='font-heading text-3xl font-bold text-white mb-xs'>{s.value}</p>
                    <p className='text-white/75 text-sm leading-snug'>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Wave */}
          <div className='absolute bottom-0 left-0 right-0' aria-hidden='true'>
            <svg
              viewBox='0 0 1440 72'
              xmlns='http://www.w3.org/2000/svg'
              className='block w-full'
              preserveAspectRatio='none'
            >
              <path d='M0,40 C360,72 1080,8 1440,40 L1440,72 L0,72 Z' fill='white' />
            </svg>
          </div>
        </section>

        {/* ── WHAT IS ESG ──────────────────────────────────────────────────── */}
        <section id='what-is-esg' className='bg-white py-4xl lg:py-6xl scroll-mt-20'>
          <div className='mx-auto max-w-7xl px-2xl lg:px-4xl'>
            <div className='text-center mb-14'>
              <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-green mb-md'>
                {t('fundamentals.eyebrow')}
              </p>
              <h2 className='font-heading text-4xl lg:text-5xl font-bold text-primary-500 mb-lg'>
                {t('fundamentals.title')}
              </h2>
              <p className='text-primary-500/75 text-base lg:text-lg max-w-2xl mx-auto leading-relaxed'>
                {t('fundamentals.lede')}
              </p>
            </div>

            <div className='grid md:grid-cols-3 gap-2xl lg:gap-4xl'>
              {pillars.map((pillar, i) => {
                const art = PILLAR_ART[i] ?? PILLAR_ART[0];
                const PillarIcon = art.icon;
                return (
                  <div
                    key={art.letter}
                    className={`relative bg-cream rounded-3xl p-4xl border-2 ${art.border} hover:shadow-lg transition-all duration-300 group overflow-hidden`}
                  >
                    {/* Large letter bg */}
                    <div
                      className={`absolute -bottom-lg -right-sm text-[120px] font-black leading-none select-none pointer-events-none ${art.color} opacity-5`}
                      aria-hidden='true'
                    >
                      {art.letter}
                    </div>

                    {/* Icon */}
                    <div
                      className={`w-14 h-14 rounded-2xl ${art.bg} ${art.color} flex items-center justify-center mb-xl group-hover:scale-110 transition-transform duration-300`}
                    >
                      <PillarIcon className='w-7 h-7' />
                    </div>

                    {/* Pillar badge */}
                    <div className='flex items-center gap-sm mb-md'>
                      <span
                        className={`w-8 h-8 rounded-xl ${art.accent} text-white font-black text-base flex items-center justify-center`}
                      >
                        {art.letter}
                      </span>
                      <p className={`text-xs font-black uppercase tracking-widest ${art.color}`}>
                        {pillar.label}
                      </p>
                    </div>

                    <h3 className='font-heading text-xl font-bold text-primary-500 mb-md leading-snug'>
                      {pillar.headline}
                    </h3>
                    <p className='text-sm text-primary-500/75 leading-relaxed mb-xl'>
                      {pillar.body}
                    </p>

                    <ul className='space-y-sm'>
                      {pillar.metrics.map((m, mi) => (
                        <li
                          key={mi}
                          className='flex items-center gap-sm text-xs text-primary-500/70'
                        >
                          <span
                            className={`w-4 h-4 rounded-full ${art.bg} ${art.color} flex items-center justify-center shrink-0`}
                          >
                            <CheckIcon className='w-2.5 h-2.5' />
                          </span>
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* One-liner callout */}
            <div className='mt-6xl bg-primary-500 rounded-3xl px-4xl py-3xl text-center'>
              <p className='font-heading text-xl lg:text-2xl font-bold text-white leading-snug'>
                {t('fundamentals.calloutStart')}{' '}
                <span className='text-secondary-light italic'>{t('fundamentals.calloutEm')}</span>
              </p>
            </div>
          </div>
        </section>

        {/* ── WHY YOU NEED IT ──────────────────────────────────────────────── */}
        <section className='bg-cream py-4xl lg:py-6xl relative overflow-hidden'>
          <div className='mx-auto max-w-7xl px-2xl lg:px-4xl'>
            <div className='text-center mb-14'>
              <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-green mb-md'>
                {t('businessCase.eyebrow')}
              </p>
              <h2 className='font-heading text-4xl lg:text-5xl font-bold text-primary-500 mb-lg'>
                {t('businessCase.titleStart')}{' '}
                <span className='text-brand-green italic'>{t('businessCase.titleEm')}</span>
              </h2>
            </div>

            <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-xl'>
              {businessCase.map((item, i) => {
                const CardIcon = BUSINESS_ICONS[i] ?? BUSINESS_ICONS[0];
                return (
                  <div
                    key={item.title}
                    className='bg-white rounded-3xl p-3xl border border-primary-500/10 hover:shadow-md hover:border-primary-500/20 transition-all duration-300 group'
                  >
                    <div className='flex items-start justify-between mb-lg'>
                      <div className='w-12 h-12 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-300'>
                        <CardIcon className='w-6 h-6' />
                      </div>
                      <span className='text-[10px] font-black uppercase tracking-widest px-2.5 py-xs rounded-full bg-brand-green text-white'>
                        {item.badge}
                      </span>
                    </div>
                    <h3 className='font-bold text-base text-primary-500 mb-sm leading-snug'>
                      {item.title}
                    </h3>
                    <p className='text-sm text-primary-500/75 leading-relaxed'>{item.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── EU REGULATIONS ───────────────────────────────────────────────── */}
        <section id='eu-regulations' className='bg-white py-4xl lg:py-6xl scroll-mt-20'>
          <div className='mx-auto max-w-7xl px-2xl lg:px-4xl'>
            <div className='text-center mb-14'>
              <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-green mb-md'>
                {t('regulations.eyebrow')}
              </p>
              <h2 className='font-heading text-4xl lg:text-5xl font-bold text-primary-500 mb-lg'>
                {t('regulations.titleStart')}
                <br />
                <span className='text-brand-green italic'>{t('regulations.titleEm')}</span>
              </h2>
              <p className='text-primary-500/75 text-base lg:text-lg max-w-2xl mx-auto leading-relaxed'>
                {t('regulations.lede')}
              </p>
            </div>

            <div className='space-y-xl'>
              {regulations.map((reg, i) => {
                const urgency = REGULATION_URGENCY[i] ?? 'medium';
                return (
                  <div
                    key={reg.code}
                    className='bg-cream rounded-3xl p-3xl lg:p-4xl border border-primary-500/10 hover:border-primary-500/15 hover:shadow-md transition-all duration-300'
                  >
                    <div className='flex flex-wrap items-start gap-lg mb-xl'>
                      {/* Code badge */}
                      <div className='shrink-0'>
                        <span className='inline-flex items-center gap-1.5 bg-primary-500 text-white text-sm font-black px-lg py-sm rounded-full'>
                          {reg.code}
                        </span>
                      </div>

                      <div className='flex-1 min-w-0'>
                        <div className='flex flex-wrap items-center gap-md mb-xs'>
                          <h3 className='font-bold text-base lg:text-lg text-primary-500'>
                            {reg.full}
                          </h3>
                          <span className='text-[10px] font-black uppercase tracking-widest px-2.5 py-xs rounded-full border text-white bg-brand-green border-brand-green'>
                            {reg.status}
                          </span>
                        </div>
                        <p className='text-xs font-bold text-primary-500/75 uppercase tracking-wider'>
                          {reg.deadline}
                        </p>
                      </div>

                      {/* Urgency pill */}
                      <span
                        className={`shrink-0 text-[10px] font-black uppercase tracking-widest px-md py-1.5 rounded-full ${
                          urgency === 'immediate'
                            ? 'bg-error text-white'
                            : urgency === 'high'
                              ? 'bg-primary-500 text-white'
                              : 'bg-primary-500/10 text-primary-500'
                        }`}
                      >
                        {urgency === 'immediate'
                          ? t('regulations.urgencyImmediate')
                          : urgency === 'high'
                            ? t('regulations.urgencyHigh')
                            : t('regulations.urgencyMedium')}{' '}
                        {t('regulations.urgencyLabel')}
                      </span>
                    </div>

                    <div className='grid lg:grid-cols-[1fr_auto] gap-xl'>
                      <p className='text-sm text-primary-500/75 leading-relaxed'>{reg.summary}</p>
                      <div className='lg:w-72 shrink-0 bg-white rounded-2xl p-lg border border-primary-500/10'>
                        <p className='text-[10px] font-black uppercase tracking-widest text-primary-500/75 mb-sm'>
                          {t('regulations.impactLabel')}
                        </p>
                        <p className='text-sm font-bold text-primary-500 leading-snug'>
                          {reg.impact}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom note */}
            <div className='mt-4xl flex items-start gap-md bg-error/10 border border-error/25 rounded-2xl p-xl'>
              <AlertTriangleIcon className='w-5 h-5 text-error shrink-0 mt-xxs' />
              <p className='text-sm text-primary-500/75 leading-relaxed'>
                {t.rich('regulations.footnote', {
                  b: chunks => <strong className='text-primary-500'>{chunks}</strong>,
                })}
              </p>
            </div>
          </div>
        </section>

        {/* ── WHY TUNISIA ──────────────────────────────────────────────────── */}
        <section className='bg-primary-500 py-4xl lg:py-6xl relative overflow-hidden'>
          {/* Waves */}
          <div className='absolute top-0 left-0 right-0' aria-hidden='true'>
            <svg
              viewBox='0 0 1440 72'
              xmlns='http://www.w3.org/2000/svg'
              className='block w-full'
              preserveAspectRatio='none'
            >
              <path d='M0,32 C360,0 1080,64 1440,32 L1440,0 L0,0 Z' fill='white' />
            </svg>
          </div>
          <div className='absolute bottom-0 left-0 right-0' aria-hidden='true'>
            <svg
              viewBox='0 0 1440 72'
              xmlns='http://www.w3.org/2000/svg'
              className='block w-full'
              preserveAspectRatio='none'
            >
              <path d='M0,40 C360,72 1080,8 1440,40 L1440,72 L0,72 Z' className='fill-cream' />
            </svg>
          </div>

          <div className='relative mx-auto max-w-7xl px-2xl lg:px-4xl pt-6xl pb-4xl'>
            <div className='text-center mb-14'>
              <p className='text-xs font-bold uppercase tracking-[0.25em] text-secondary-light mb-md'>
                {t('tunisia.eyebrow')}
              </p>
              <h2 className='font-heading text-4xl lg:text-5xl font-bold text-white mb-lg'>
                {t('tunisia.titleStart')}{' '}
                <span className='text-secondary-light italic'>{t('tunisia.titleEm')}</span>
              </h2>
              <p className='text-white/65 text-base lg:text-lg max-w-2xl mx-auto leading-relaxed'>
                {t('tunisia.lede')}
              </p>
            </div>

            <div className='grid sm:grid-cols-2 lg:grid-cols-3 gap-xl'>
              {tunisiaReasons.map((item, i) => {
                const ReasonIcon = TUNISIA_ICONS[i] ?? TUNISIA_ICONS[0];
                return (
                  <div
                    key={item.title}
                    className='bg-white/10 border border-white/15 rounded-3xl p-3xl hover:bg-white/15 hover:border-white/20 transition-all duration-300 group'
                  >
                    <div className='w-12 h-12 rounded-xl bg-secondary-light/15 text-secondary-light flex items-center justify-center mb-lg group-hover:scale-110 transition-transform duration-300'>
                      <ReasonIcon className='w-6 h-6' />
                    </div>
                    <h3 className='font-bold text-base text-white mb-md leading-snug'>
                      {item.title}
                    </h3>
                    <p className='text-sm text-white/65 leading-relaxed'>{item.body}</p>
                  </div>
                );
              })}
            </div>

            {/* Flag + context */}
            <div className='mt-6xl bg-white/10 border border-white/15 rounded-3xl p-3xl lg:p-4xl flex flex-col lg:flex-row items-center gap-2xl text-center lg:text-left'>
              <div className='text-6xl shrink-0'>🇹🇳</div>
              <div>
                <p className='font-heading text-xl lg:text-2xl font-bold text-white mb-sm'>
                  {t('tunisia.calloutTitle')}
                </p>
                <p className='text-white/65 text-sm lg:text-base leading-relaxed'>
                  {t('tunisia.calloutBody')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW TFTW HELPS YOUR ESG ──────────────────────────────────────── */}
        <section className='bg-cream py-4xl lg:py-6xl'>
          <div className='mx-auto max-w-7xl px-2xl lg:px-4xl'>
            <div className='text-center mb-14'>
              <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-green mb-md'>
                {t('contribution.eyebrow')}
              </p>
              <h2 className='font-heading text-4xl lg:text-5xl font-bold text-primary-500 mb-lg'>
                {t('contribution.titleStart')}{' '}
                <span className='text-brand-green italic'>{t('contribution.titleEm')}</span>
              </h2>
              <p className='text-primary-500/75 text-base lg:text-lg max-w-2xl mx-auto leading-relaxed'>
                {t('contribution.lede')}
              </p>
            </div>

            <div className='grid md:grid-cols-3 gap-2xl lg:gap-4xl mb-6xl'>
              {contributions.map((item, i) => (
                <div
                  key={item.pillar}
                  className='bg-white rounded-3xl p-4xl border border-primary-500/10 hover:shadow-lg transition-all duration-300 group relative overflow-hidden'
                >
                  <div
                    className='bg-brand-teal absolute -bottom-2xl -right-2xl h-32 w-32 rounded-full opacity-5 pointer-events-none'
                    aria-hidden='true'
                  />
                  <div className='flex items-center gap-md mb-xl'>
                    <span
                      className={`w-10 h-10 rounded-xl ${CONTRIBUTION_COLORS[i] ?? CONTRIBUTION_COLORS[0]} text-white font-black text-lg flex items-center justify-center shrink-0`}
                    >
                      {item.pillar}
                    </span>
                    <div>
                      <p className='font-black text-2xl text-primary-500 leading-none'>
                        {item.metric}
                      </p>
                      <p className='text-xs text-primary-500/75 leading-tight'>
                        {item.metricLabel}
                      </p>
                    </div>
                  </div>
                  <h3 className='font-bold text-base text-primary-500 mb-md leading-snug'>
                    {item.title}
                  </h3>
                  <p className='text-sm text-primary-500/75 leading-relaxed'>{item.body}</p>
                </div>
              ))}
            </div>

            {/* Reporting frameworks row */}
            <div className='bg-white rounded-3xl p-3xl lg:p-4xl border border-primary-500/10'>
              <p className='text-xs font-bold uppercase tracking-widest text-primary-500/75 mb-xl text-center'>
                {t('contribution.frameworksLabel')}
              </p>
              <div className='flex flex-wrap justify-center gap-md lg:gap-xl'>
                {[
                  'GRI Standards',
                  'SASB',
                  'CSRD / ESRS',
                  'UN SDGs',
                  'CDP',
                  'TCFD',
                  'ISO 14001',
                ].map((f, fi) => (
                  <span
                    key={fi}
                    className='text-xs font-bold text-primary-500/70 bg-cream border border-primary-500/10 px-lg py-sm rounded-full'
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
        <section className='bg-white py-4xl lg:py-6xl relative overflow-hidden'>
          <div className='mx-auto max-w-4xl px-2xl lg:px-4xl text-center'>
            <div className='bg-primary-500 rounded-3xl px-4xl lg:px-4xl py-14 lg:py-4xl relative overflow-hidden'>
              {/* Glow */}

              <div className='relative'>
                <p className='text-white/65 text-xs font-bold uppercase tracking-[0.3em] mb-lg'>
                  {t('cta.eyebrow')}
                </p>
                <h2 className='font-heading text-3xl lg:text-5xl font-bold text-white leading-tight mb-xl'>
                  {t('cta.titleStart')}{' '}
                  <span className='text-secondary-light italic'>{t('cta.titleEm')}</span>
                </h2>
                <p className='text-white/65 text-base lg:text-lg leading-relaxed mb-6xl max-w-xl mx-auto'>
                  {t('cta.body')}
                </p>
                <div className='flex flex-col sm:flex-row gap-lg justify-center'>
                  <Link
                    href='/contact'
                    className='inline-flex items-center justify-center gap-sm bg-white text-primary-500 font-black text-sm px-4xl py-lg rounded-full hover:bg-cream transition-colors shadow-xl'
                  >
                    {t('cta.ctaTeam')}
                    <ArrowRightIcon className='w-4 h-4' />
                  </Link>
                  <Link
                    href='/companies'
                    className='inline-flex items-center justify-center gap-sm border-2 border-white/30 text-white font-black text-sm px-4xl py-lg rounded-full hover:border-white/60 hover:bg-white/10 transition-colors'
                  >
                    {t('cta.ctaEnterprise')}
                    <ArrowRightIcon className='w-4 h-4' />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
