import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Image from 'next/image';
import { Header } from '@/components/layout';
import { Link } from '@/i18n/routing';
import { AppDownloadButton } from '@/components/sections/AppDownloadButton';
import { SoftwareAppSchema, BreadcrumbSchema } from '@/components/seo/schemas';
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
  const t = await getTranslations({ locale, namespace: 'consumer' });
  return buildPageMetadata({
    path: '/consumer',
    locale: locale as Locale,
    title: t('meta.title'),
    description: t('meta.description'),
  });
}

// ── Inline SVG icons ─────────────────────────────────────────────────────────

function WalletIcon({ className }: { className?: string }) {
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
      <path d='M20 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z' />
      <path d='M16 3H8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z' />
      <circle cx='17' cy='13' r='1.5' fill='currentColor' stroke='none' />
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

function TrophyIcon({ className }: { className?: string }) {
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
      <path d='M6 9H4a2 2 0 01-2-2V5h4' />
      <path d='M18 9h2a2 2 0 002-2V5h-4' />
      <path d='M8 21h8M12 17v4' />
      <path d='M6 5h12v7a6 6 0 01-12 0V5z' />
    </svg>
  );
}

function DropletIcon({ className }: { className?: string }) {
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
      <path d='M12 2.69l5.66 5.66a8 8 0 11-11.31 0z' />
    </svg>
  );
}

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

function ShareIcon({ className }: { className?: string }) {
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
      <circle cx='18' cy='5' r='3' />
      <circle cx='6' cy='12' r='3' />
      <circle cx='18' cy='19' r='3' />
      <path d='M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49' />
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

// ── Static data ───────────────────────────────────────────────────────────────

/**
 * Icons and their surface colours, paired by index with `quickWins.items` in
 * the messages. Copy lives there; nothing here is translatable.
 */
const QUICK_WIN_ICONS = [
  { Icon: WalletIcon, iconBg: 'bg-brand-green/10', iconColor: 'text-brand-green' },
  { Icon: GlobeIcon, iconBg: 'bg-primary-500/10', iconColor: 'text-primary-500' },
  { Icon: TrophyIcon, iconBg: 'bg-brand-teal/10', iconColor: 'text-brand-teal' },
] as const;

/** Paired by index with `referral.steps` in the messages. */
const REFERRAL_ICONS = [ShareIcon, TrophyIcon, WalletIcon] as const;

interface QuickWin {
  stat: string;
  label: string;
  body: string;
}

/** Paired by index with `howItWorks.steps` in the messages. */
const HOW_IT_WORKS_ART = [
  { icon: '/icons/browsing.png', colorClass: 'bg-primary-500' },
  { icon: '/icons/booking.png', colorClass: 'bg-brand-green' },
  { icon: '/icons/order.png', colorClass: 'bg-brand-teal' },
] as const;

interface HowItWorksStep {
  n: string;
  title: string;
  body: string;
  iconAlt: string;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ConsumerPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'consumer' });

  const ticker = t.raw('ticker') as string[];
  const quickWins = t.raw('quickWins.items') as QuickWin[];
  const howItWorksSteps = t.raw('howItWorks.steps') as HowItWorksStep[];
  const walletBullets = t.raw('wallet.bullets') as string[];
  const referralSteps = t.raw('referral.steps') as string[];

  return (
    <>
      <SoftwareAppSchema
        name='Too Fresh To Waste'
        description={t('schema.appDescription')}
        locale={locale as Locale}
      />
      <BreadcrumbSchema
        items={[
          { name: t('breadcrumb.home'), url: getCanonicalUrl('/', locale as Locale) },
          { name: t('breadcrumb.current'), url: getCanonicalUrl('/consumer', locale as Locale) },
        ]}
      />
      <Header />

      <main className='min-h-screen bg-white text-primary-500'>
        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <section className='bg-primary-500 relative overflow-hidden'>
          {/* Decorative radial glows */}

          <div className='relative mx-auto max-w-7xl px-2xl lg:px-4xl pt-3xl pb-0 lg:pt-4xl'>
            <div className='grid lg:grid-cols-2 gap-6xl lg:gap-4xl items-center'>
              {/* Left - copy */}
              <div className='pb-6xl lg:pb-4xl'>
                {/* Eyebrow */}
                <h1 className='font-heading text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight mb-xl'>
                  {t('hero.titleStart')}{' '}
                  <span className='text-secondary-light italic'>{t('hero.titleEm')}</span>{' '}
                  {t('hero.titleEnd')}
                </h1>

                <p className='text-white/70 text-base lg:text-lg leading-relaxed mb-4xl max-w-lg'>
                  {t('hero.lede')}
                </p>

                {/* Download CTAs */}
                <div className='flex flex-col sm:flex-row gap-md mb-xl'>
                  {/* App Store */}
                  <AppDownloadButton
                    platform='ios'
                    className='inline-flex items-center gap-md bg-white text-primary-500 font-bold px-2xl py-3.5 rounded-full hover:bg-cream transition-colors shadow-lg text-sm'
                    aria-label={t('common.appStore')}
                  >
                    <svg
                      viewBox='0 0 24 24'
                      className='w-5 h-5 shrink-0'
                      fill='currentColor'
                      aria-hidden='true'
                    >
                      <path d='M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z' />
                    </svg>
                    {t('common.appStore')}
                  </AppDownloadButton>

                  {/* Google Play */}
                  <AppDownloadButton
                    platform='android'
                    className='inline-flex items-center gap-md border border-white/40 text-white font-bold px-2xl py-3.5 rounded-full hover:border-white/70 hover:bg-white/5 transition-colors text-sm'
                    aria-label={t('common.googlePlay')}
                  >
                    <svg
                      viewBox='0 0 24 24'
                      className='w-5 h-5 shrink-0'
                      fill='currentColor'
                      aria-hidden='true'
                    >
                      <path d='M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11.109 11.04c.28.106.591.108.87-.004l13.052-7.176-2.813-3.86z' />
                    </svg>
                    {t('common.googlePlay')}
                  </AppDownloadButton>
                </div>
              </div>

              {/* Right - PickUpToday illustration */}
              <div className='flex justify-center lg:justify-end items-end relative'>
                <Image
                  src='/images/PickUpToday.svg'
                  alt={t('hero.imageAlt')}
                  width={520}
                  height={480}
                  className='w-full max-w-[260px] lg:max-w-[360px] h-auto object-contain drop-shadow-2xl'
                  priority
                />
              </div>
            </div>
          </div>

          {/* Wave into cream */}
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
        </section>

        {/* ── MARQUEE TICKER ───────────────────────────────────────────────── */}
        <div className='bg-brand-green py-md overflow-hidden' aria-hidden='true'>
          <div className='flex w-max animate-marquee-fw gap-4xl whitespace-nowrap'>
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className='flex items-center gap-4xl font-bold text-white text-xs uppercase tracking-[0.2em]'
              >
                {ticker.map(line => (
                  <span key={line} className='flex items-center gap-4xl'>
                    {line}
                    <span className='text-white/75'>✦</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── QUICK WINS ───────────────────────────────────────────────────── */}
        <section className='bg-cream py-4xl lg:py-5xl'>
          <div className='mx-auto max-w-7xl px-2xl lg:px-4xl'>
            <div className='text-center mb-6xl'>
              <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-green mb-sm'>
                {t('quickWins.eyebrow')}
              </p>
              <h2 className='font-heading text-3xl lg:text-4xl font-bold text-primary-500'>
                {t('quickWins.title')}
              </h2>
            </div>

            <div className='grid md:grid-cols-3 gap-xl'>
              {quickWins.map((w, i) => {
                const art = QUICK_WIN_ICONS[i] ?? QUICK_WIN_ICONS[0];
                const Icon = art.Icon;
                return (
                  <div
                    key={w.stat}
                    className='bg-white rounded-3xl p-3xl border border-primary-500/10 hover:border-brand-green/25 hover:shadow-lg transition-all duration-300 group'
                  >
                    <div
                      className={`w-14 h-14 rounded-2xl ${art.iconBg} flex items-center justify-center mb-xl ${art.iconColor} group-hover:scale-110 transition-transform duration-300`}
                    >
                      <Icon className='w-7 h-7' />
                    </div>
                    <p className='text-xl font-black text-primary-500 mb-xs leading-tight'>
                      {w.stat}
                    </p>
                    <p className='text-xs font-bold uppercase tracking-widest text-brand-green mb-md'>
                      {w.label}
                    </p>
                    <p className='text-sm text-primary-500/75 leading-relaxed'>{w.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
        <section className='bg-white py-4xl lg:py-5xl'>
          <div className='mx-auto max-w-7xl px-2xl lg:px-4xl'>
            <div className='text-center mb-3xl'>
              <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-green mb-md'>
                {t('howItWorks.eyebrow')}
              </p>
              <h2 className='font-heading text-4xl lg:text-5xl font-bold text-primary-500'>
                {t('howItWorks.titleStart')}{' '}
                <span className='text-brand-green italic'>{t('howItWorks.titleEm')}</span>
              </h2>
            </div>

            <div className='grid md:grid-cols-3 gap-2xl'>
              {howItWorksSteps.map((step, i) => {
                const art = HOW_IT_WORKS_ART[i] ?? HOW_IT_WORKS_ART[0];
                return (
                  <div
                    key={step.n}
                    className='group bg-cream rounded-3xl p-3xl hover:shadow-md transition-all duration-300 border border-transparent hover:border-brand-green/20 relative overflow-hidden'
                  >
                    {/* Step number badge */}
                    <div
                      className={`w-14 h-14 rounded-2xl ${art.colorClass} flex items-center justify-center mb-xl shadow-md`}
                    >
                      <span className='text-white font-black text-xl font-heading'>{step.n}</span>
                    </div>

                    {/* Icon */}
                    <div className='w-12 h-12 mb-lg'>
                      <Image
                        src={art.icon}
                        alt={step.iconAlt}
                        width={48}
                        height={48}
                        className='w-full h-full object-contain'
                      />
                    </div>

                    <h3 className='font-bold text-lg text-primary-500 mb-md leading-snug'>
                      {step.title}
                    </h3>
                    <p className='text-sm text-primary-500/75 leading-relaxed'>{step.body}</p>

                    {/* Connector line on desktop */}
                    {i < howItWorksSteps.length - 1 && (
                      <div
                        className='hidden md:block absolute top-6xl -right-md w-6 h-px bg-primary-500/15 z-10'
                        aria-hidden='true'
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── WALLET STORY ─────────────────────────────────────────────────── */}
        <section className='bg-primary-500 py-4xl lg:py-6xl relative overflow-hidden'>
          {/* Top wave from white */}
          <div className='absolute top-0 left-0 right-0' aria-hidden='true'>
            <svg
              viewBox='0 0 1440 72'
              xmlns='http://www.w3.org/2000/svg'
              className='block w-full'
              preserveAspectRatio='none'
            >
              <path d='M0,32 C360,0 1080,64 1440,32 L1440,0 L0,0 Z' className='fill-white' />
            </svg>
          </div>
          {/* Bottom wave to cream */}
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

          {/* Glow */}

          <div className='relative mx-auto max-w-7xl px-2xl lg:px-4xl pt-6xl'>
            <div className='grid lg:grid-cols-2 gap-3xl lg:gap-4xl items-center'>
              {/* Left - copy */}
              <div>
                <p className='text-xs font-bold uppercase tracking-[0.25em] text-secondary-light mb-lg'>
                  {t('wallet.eyebrow')}
                </p>
                <h2 className='font-heading text-4xl lg:text-5xl font-bold text-white leading-tight mb-xl'>
                  {t('wallet.title')}
                </h2>
                <p className='text-white/75 text-base lg:text-lg leading-relaxed mb-3xl'>
                  {t('wallet.lede')}
                </p>

                <ul className='space-y-md mb-4xl'>
                  {walletBullets.map(item => (
                    <li key={item} className='flex items-center gap-md text-sm text-white/75'>
                      <span className='w-5 h-5 rounded-full bg-secondary-light/25 text-secondary-light flex items-center justify-center shrink-0'>
                        <CheckIcon className='w-3 h-3' />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>

                <AppDownloadButton
                  className='inline-flex items-center gap-sm bg-brand-green text-white font-bold px-3xl py-3.5 rounded-full hover:opacity-90 transition-opacity shadow-lg text-sm'
                  aria-label={t('wallet.cta')}
                >
                  {t('wallet.cta')}
                  <svg
                    className='w-4 h-4'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                    aria-hidden='true'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M17 8l4 4m0 0l-4 4m4-4H3'
                    />
                  </svg>
                </AppDownloadButton>
              </div>

              {/* Right - price comparison card */}
              <div className='flex justify-center lg:justify-end'>
                <div className='relative w-full max-w-[320px]'>
                  {/* Main card */}
                  <div className='bg-white rounded-3xl shadow-2xl p-2xl relative overflow-hidden'>
                    {/* Header */}
                    <div className='bg-primary-500 rounded-2xl p-xl mb-xl text-center relative overflow-hidden bg-grain'>
                      <p className='relative text-white/75 text-[10px] uppercase tracking-[0.3em] mb-xs'>
                        {t('wallet.card.brand')}
                      </p>
                      <p className='relative font-heading text-2xl font-bold text-white mb-xs'>
                        {t('wallet.card.name')}
                      </p>
                      <p className='relative text-white/75 text-sm'>{t('wallet.card.subtitle')}</p>
                    </div>

                    {/* Price comparison */}
                    <div className='flex items-center justify-between bg-cream rounded-2xl p-lg mb-md'>
                      <div>
                        <p className='text-xs text-primary-500/75 mb-xs'>
                          {t('wallet.card.originalLabel')}
                        </p>
                        <p className='text-xl font-bold text-primary-500/75 line-through'>
                          {t('wallet.card.originalValue')}
                        </p>
                      </div>
                      <div className='h-8 w-px bg-primary-500/10' aria-hidden='true' />
                      <div className='text-end'>
                        <p className='text-xs text-primary-500/75 mb-xs'>
                          {t('wallet.card.payLabel')}
                        </p>
                        <p className='text-2xl font-black text-brand-green'>
                          {t('wallet.card.payValue')}
                        </p>
                      </div>
                    </div>

                    {/* You save highlight */}
                    <div className='bg-brand-green/10 border border-brand-green/20 rounded-2xl p-lg text-center'>
                      <p className='text-brand-green text-[10px] uppercase tracking-widest font-bold mb-xs'>
                        {t('wallet.card.saveLabel')}
                      </p>
                      <p className='text-brand-green text-3xl font-black font-heading'>
                        {t('wallet.card.saveValue')}
                      </p>
                      <p className='text-brand-green text-xs mt-xs'>{t('wallet.card.savePer')}</p>
                    </div>
                  </div>

                  {/* Save badge */}
                  <div
                    className='absolute -top-lg -right-lg bg-brand-green text-white rounded-full w-16 h-16 flex flex-col items-center justify-center shadow-xl rotate-[12deg]'
                    aria-label={`${t('wallet.card.badgeLabel')} ${t('wallet.card.badgeValue')}`}
                  >
                    <span className='text-[10px] font-bold leading-tight'>
                      {t('wallet.card.badgeLabel')}
                    </span>
                    <span className='text-base font-black leading-tight'>
                      {t('wallet.card.badgeValue')}
                    </span>
                  </div>

                  {/* Bottom label */}
                  <p className='text-center text-white/75 text-xs mt-lg'>
                    {t('wallet.card.disclaimer')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── PLANET STORY ─────────────────────────────────────────────────── */}
        <section className='bg-cream py-4xl lg:py-6xl relative overflow-hidden'>
          <div className='mx-auto max-w-7xl px-2xl lg:px-4xl'>
            <div className='grid lg:grid-cols-2 gap-3xl lg:gap-4xl items-center'>
              {/* Left - impact numbers */}
              <div className='space-y-2xl'>
                {/* Big stat */}
                <div className='bg-white rounded-3xl p-4xl border border-primary-500/10 shadow-teal-sm'>
                  <p className='text-xs font-bold uppercase tracking-widest text-primary-500/75 mb-sm'>
                    {t('planet.globalLabel')}
                  </p>
                  <p className='font-heading text-7xl font-bold text-primary-500 leading-none mb-sm'>
                    {t('planet.globalValue')}
                  </p>
                  <p className='text-primary-500/75 text-base leading-relaxed'>
                    {t('planet.globalBody')}
                  </p>
                </div>

                {/* Two mini stats */}
                <div className='grid grid-cols-2 gap-lg'>
                  <div className='bg-white rounded-2xl p-xl border border-primary-500/10'>
                    <div className='w-10 h-10 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center mb-md'>
                      <LeafIcon className='w-5 h-5' />
                    </div>
                    <p className='font-black text-primary-500 text-base leading-tight mb-xs'>
                      {t('planet.co2Value')}
                    </p>
                    <p className='text-xs text-primary-500/75 leading-relaxed'>
                      {t('planet.co2Label')}
                    </p>
                  </div>
                  <div className='bg-white rounded-2xl p-xl border border-primary-500/10'>
                    <div className='w-10 h-10 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center mb-md'>
                      <DropletIcon className='w-5 h-5' />
                    </div>
                    <p className='font-black text-primary-500 text-base leading-tight mb-xs'>
                      {t('planet.waterValue')}
                    </p>
                    <p className='text-xs text-primary-500/75 leading-relaxed'>
                      {t('planet.waterLabel')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right - copy */}
              <div>
                <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-green mb-lg'>
                  {t('planet.eyebrow')}
                </p>
                <h2 className='font-heading text-4xl lg:text-5xl font-bold text-primary-500 leading-tight mb-xl'>
                  {t('planet.titleStart')}{' '}
                  <span className='text-brand-green italic'>{t('planet.titleEm')}</span>
                </h2>
                <p className='text-primary-500/75 text-base lg:text-lg leading-relaxed mb-2xl'>
                  {t('planet.body1')}
                </p>
                <p className='text-primary-500/75 text-base leading-relaxed mb-4xl'>
                  {t('planet.body2')}
                </p>

                <Link
                  href='/food-waste-facts'
                  className='inline-flex items-center gap-sm text-primary-500 font-bold text-sm hover:text-brand-green transition-colors'
                >
                  {t('planet.link')}
                  <svg
                    className='w-4 h-4'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                    aria-hidden='true'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M17 8l4 4m0 0l-4 4m4-4H3'
                    />
                  </svg>
                </Link>
              </div>
            </div>
          </div>

          {/* Wave into white */}
          <div className='absolute bottom-0 left-0 right-0' aria-hidden='true'>
            <svg
              viewBox='0 0 1440 72'
              xmlns='http://www.w3.org/2000/svg'
              className='block w-full'
              preserveAspectRatio='none'
            >
              <path d='M0,40 C360,72 1080,8 1440,40 L1440,72 L0,72 Z' className='fill-white' />
            </svg>
          </div>
        </section>

        {/* ── REFERRAL ─────────────────────────────────────────────────────── */}
        <section className='bg-white py-4xl lg:py-5xl'>
          <div className='mx-auto max-w-7xl px-2xl lg:px-4xl'>
            <div className='grid lg:grid-cols-2 gap-3xl lg:gap-4xl items-center'>
              {/* Left - copy */}
              <div>
                <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-green mb-lg'>
                  {t('referral.eyebrow')}
                </p>
                <h2 className='font-heading text-4xl lg:text-5xl font-bold text-primary-500 leading-tight mb-xl'>
                  {t('referral.titleStart')}{' '}
                  <span className='text-brand-green italic'>{t('referral.titleEm')}</span>
                </h2>
                <p className='text-primary-500/75 text-base lg:text-lg leading-relaxed mb-2xl'>
                  {t('referral.lede')}
                </p>

                <div className='space-y-1.5 mb-4xl'>
                  {referralSteps.map((text, i) => {
                    const Icon = REFERRAL_ICONS[i] ?? REFERRAL_ICONS[0];
                    return (
                      <div key={text} className='flex items-center gap-2.5'>
                        <div className='w-7 h-7 rounded-lg bg-primary-500/10 text-primary-500 flex items-center justify-center shrink-0'>
                          <Icon className='w-4 h-4' />
                        </div>
                        <p className='text-sm text-primary-500/75'>{text}</p>
                      </div>
                    );
                  })}
                </div>

                <AppDownloadButton
                  className='inline-flex items-center gap-sm bg-primary-500 text-white font-bold px-3xl py-3.5 rounded-full hover:bg-primary-600 transition-colors text-sm'
                  aria-label={t('referral.cta')}
                >
                  {t('referral.cta')}
                </AppDownloadButton>
              </div>

              {/* Right - referral card mockup */}
              <div className='flex justify-center lg:justify-end'>
                <div className='w-full max-w-[320px]'>
                  {/* Card */}
                  <div className='bg-cream rounded-3xl p-2xl border-2 border-dashed border-primary-500/20 relative overflow-hidden'>
                    {/* Glow top-right */}

                    {/* Share row */}
                    <div className='flex items-center gap-md mb-xl'>
                      <div className='flex items-center gap-sm flex-1'>
                        <Image
                          src='/icons/earn-points.png'
                          alt=''
                          width={32}
                          height={32}
                          className='w-8 h-8 object-contain'
                          aria-hidden='true'
                        />
                        <div>
                          <p className='text-xs font-bold text-primary-500'>
                            {t('referral.cardPoints')}
                          </p>
                          <p className='text-[10px] text-primary-500/75'>
                            {t('referral.cardNote')}
                          </p>
                        </div>
                      </div>
                      <Image
                        src='/icons/share.png'
                        alt=''
                        width={32}
                        height={32}
                        className='w-8 h-8 object-contain opacity-60'
                        aria-hidden='true'
                      />
                    </div>

                    {/* Bottom note */}
                    <div className='pt-lg border-t border-primary-500/10'>
                      <p className='text-[10px] text-primary-500/75 text-center'>
                        {t('referral.cardFooter')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
        <section className='bg-primary-500 relative overflow-hidden py-5xl lg:py-28'>
          {/* Top wave from white */}
          <div className='absolute top-0 left-0 right-0' aria-hidden='true'>
            <svg
              viewBox='0 0 1440 72'
              xmlns='http://www.w3.org/2000/svg'
              className='block w-full'
              preserveAspectRatio='none'
            >
              <path d='M0,32 C360,0 1080,64 1440,32 L1440,0 L0,0 Z' className='fill-white' />
            </svg>
          </div>

          {/* Decorative glows */}

          <div className='relative mx-auto max-w-3xl px-2xl text-center pt-6xl'>
            <p className='text-white/75 text-xs font-bold uppercase tracking-[0.3em] mb-lg'>
              {t('finalCta.eyebrow')}
            </p>
            <h2 className='font-heading text-4xl lg:text-6xl font-bold text-white leading-tight mb-xl'>
              {t('finalCta.titleStart')}{' '}
              <span className='text-secondary-light'>{t('finalCta.titleEm')}</span>
            </h2>
            <p className='text-white/75 text-base lg:text-lg leading-relaxed mb-6xl max-w-xl mx-auto'>
              {t('finalCta.body')}
            </p>

            {/* Download buttons */}
            <div className='flex flex-col sm:flex-row gap-lg justify-center mb-2xl'>
              <AppDownloadButton
                platform='ios'
                className='inline-flex items-center justify-center gap-md bg-white text-primary-500 font-black text-sm px-4xl py-lg rounded-full hover:bg-cream transition-colors shadow-xl'
                aria-label={t('common.appStore')}
              >
                <svg
                  viewBox='0 0 24 24'
                  className='w-5 h-5 shrink-0'
                  fill='currentColor'
                  aria-hidden='true'
                >
                  <path d='M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z' />
                </svg>
                {t('common.appStore')}
              </AppDownloadButton>
              <AppDownloadButton
                platform='android'
                className='inline-flex items-center justify-center gap-md border-2 border-white text-white font-black text-sm px-4xl py-lg rounded-full hover:bg-white/10 transition-colors'
                aria-label={t('common.googlePlay')}
              >
                <svg
                  viewBox='0 0 24 24'
                  className='w-5 h-5 shrink-0'
                  fill='currentColor'
                  aria-hidden='true'
                >
                  <path d='M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11.109 11.04c.28.106.591.108.87-.004l13.052-7.176-2.813-3.86z' />
                </svg>
                {t('common.googlePlay')}
              </AppDownloadButton>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
