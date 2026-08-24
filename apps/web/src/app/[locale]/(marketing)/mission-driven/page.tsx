'use client';

import { useTranslations } from 'next-intl';

import { useState } from 'react';
import { Header } from '@/components/layout';
import { Link } from '@/i18n/routing';

// ── Tension card ─────────────────────────────────────────────────────────────

/**
 * Every tension leans right - toward impact, care and accessibility. That is
 * the page's argument, not a per-item setting, so it is a constant rather than
 * a field three translators could disagree about.
 */
const TENSION_LEAN = 'right' as const;

interface TensionData {
  left: string;
  right: string;
  leftDesc: string;
  rightDesc: string;
  navigation: string;
}

function TensionCard({
  data,
  navigationLabel,
  leanLabel,
}: {
  data: TensionData;
  navigationLabel: string;
  leanLabel: string;
}) {
  const [active, setActive] = useState<'left' | 'right'>(TENSION_LEAN);

  return (
    <div className='bg-white rounded-3xl overflow-hidden border-2 border-primary-500/10 hover:border-primary-500/15 transition-colors'>
      {/* Toggle row */}
      <div className='grid grid-cols-2 relative'>
        {/* Sliding indicator */}
        <div
          className='absolute inset-y-0 w-1/2 bg-primary-500 transition-transform duration-300 ease-out'
          style={{ transform: active === 'right' ? 'translateX(100%)' : 'translateX(0)' }}
          aria-hidden='true'
        />

        <button
          onClick={() => setActive('left')}
          className={`relative z-10 py-lg text-sm font-black uppercase tracking-widest transition-colors duration-300 ${
            active === 'left' ? 'text-white' : 'text-primary-500/40 hover:text-primary-500/70'
          }`}
        >
          {data.left}
        </button>
        <button
          onClick={() => setActive('right')}
          className={`relative z-10 py-lg text-sm font-black uppercase tracking-widest transition-colors duration-300 ${
            active === 'right' ? 'text-white' : 'text-primary-500/40 hover:text-primary-500/70'
          }`}
        >
          {data.right}
        </button>
      </div>

      {/* Description */}
      <div className='px-2xl pt-xl pb-md min-h-[72px]'>
        <p className='text-sm text-primary-500/65 leading-relaxed transition-all duration-200'>
          {active === 'left' ? data.leftDesc : data.rightDesc}
        </p>
      </div>

      {/* Navigation */}
      <div className='mx-2xl mb-2xl bg-cream rounded-2xl px-xl py-lg border border-primary-500/10'>
        <p className='text-[10px] font-black uppercase tracking-widest text-primary-500/40 mb-1.5'>
          {navigationLabel}
        </p>
        <p className='text-sm font-medium text-primary-500 leading-relaxed'>{data.navigation}</p>
      </div>

      {/* Lean indicator */}
      <div className='px-2xl pb-xl flex items-center gap-sm'>
        <span className='text-[10px] font-black uppercase tracking-widest text-primary-500/30'>
          {leanLabel}
        </span>
        <span className='text-[10px] font-black uppercase tracking-widest bg-primary-500/10 text-primary-500 px-2.5 py-xs rounded-full'>
          {data.right}
        </span>
        <span className='text-[10px] text-primary-500/30 italic'>- but we hold the tension</span>
      </div>
    </div>
  );
}

// ── Door CTA ─────────────────────────────────────────────────────────────────

function Door({
  href,
  label,
  tagline,
  index,
}: {
  href: string;
  label: string;
  tagline: string;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);
  const num = String(index + 1).padStart(2, '0');

  return (
    <Link
      href={href}
      className='group block border-b border-primary-500/10 last:border-b-0'
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={`flex items-center justify-between px-4xl lg:px-4xl transition-all duration-500 ease-out ${hovered ? 'py-4xl bg-primary-500' : 'py-2xl bg-white'}`}
      >
        <div className='flex items-center gap-2xl lg:gap-6xl min-w-0'>
          <span
            className={`font-heading text-sm font-bold tabular-nums transition-colors duration-500 shrink-0 ${hovered ? 'text-white/30' : 'text-primary-500/20'}`}
          >
            {num}
          </span>
          <div className='min-w-0'>
            <p
              className={`font-heading text-2xl lg:text-4xl font-bold leading-none transition-colors duration-500 ${hovered ? 'text-white' : 'text-primary-500'}`}
            >
              {label}
            </p>
            <p
              className={`text-sm mt-1.5 transition-all duration-500 leading-snug ${hovered ? 'text-white/60 max-h-10 opacity-100' : 'text-primary-500/0 max-h-0 opacity-0'}`}
            >
              {tagline}
            </p>
          </div>
        </div>
        <svg
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth={1.5}
          strokeLinecap='round'
          strokeLinejoin='round'
          className={`w-6 h-6 shrink-0 transition-all duration-500 ${hovered ? 'text-brand-green translate-x-sm' : 'text-primary-500/40 translate-x-0'}`}
          aria-hidden='true'
        >
          <path d='M5 12h14M12 5l7 7-7 7' />
        </svg>
      </div>
    </Link>
  );
}

// ── Static data ───────────────────────────────────────────────────────────────

// ── Page ─────────────────────────────────────────────────────────────────────

interface ProofItem {
  n: string;
  title: string;
  body: string;
}

interface Door {
  label: string;
  tagline: string;
}

/** Destinations for the three closing doors, paired by index with the copy. */
const DOOR_HREFS = ['/careers', '/esg', '/consumer'] as const;

export default function MissionDrivenPage() {
  const t = useTranslations('missionDriven');

  const proofItems = t.raw('proof.items') as ProofItem[];
  const tensions = t.raw('tensions.items') as TensionData[];
  const forUs = t.raw('audience.forUs') as string[];
  const notForUs = t.raw('audience.notForUs') as string[];
  const doors = t.raw('invitation.doors') as Door[];

  return (
    <>
      <Header />

      <main className='min-h-screen bg-white text-primary-500'>
        {/* ── MANIFESTO HERO ───────────────────────────────────────────────── */}
        <section className='bg-primary-500 relative overflow-hidden min-h-[85vh] flex flex-col justify-center'>
          {/* Subtle noise texture via radial layers */}
          {/* Ghost text */}
          <p
            className='absolute bottom-0 right-0 text-[clamp(80px,14vw,180px)] font-black text-white/[0.03] select-none pointer-events-none leading-none tracking-tight whitespace-nowrap'
            aria-hidden='true'
          >
            {t('watermark')}
          </p>

          <div className='relative mx-auto max-w-5xl px-2xl lg:px-4xl py-5xl lg:py-32'>
            {/* Eyebrow */}
            <div className='mb-6xl'>
              <span className='text-secondary-light text-xs font-black uppercase tracking-[0.35em]'>
                {t('hero.eyebrow')}
              </span>
            </div>

            {/* Main headline - stacked for maximum typographic impact */}
            <h1 className='font-heading font-bold text-white leading-[0.95] mb-0'>
              <span className='block text-[clamp(42px,8vw,96px)]'>{t('hero.line1')}</span>
              <span className='block text-[clamp(42px,8vw,96px)] text-secondary-light italic'>
                {t('hero.line2')}
              </span>
              <span className='block text-[clamp(42px,8vw,96px)] mt-sm'>{t('hero.line3')}</span>
              <span className='block text-[clamp(42px,8vw,96px)] text-secondary-light italic'>
                {t('hero.line4')}
              </span>
            </h1>

            <div className='mt-6xl max-w-2xl'>
              <p className='text-white/75 text-base lg:text-xl leading-relaxed'>{t('hero.lede')}</p>
            </div>

            {/* Scroll cue */}
            <div className='mt-14'>
              <p className='text-white/75 text-xs uppercase tracking-widest'>
                {t('hero.scrollCue')}
              </p>
            </div>
          </div>
        </section>

        {/* ── THE ORIGIN ───────────────────────────────────────────────────── */}
        <section className='bg-white py-5xl lg:py-28'>
          <div className='mx-auto max-w-4xl px-2xl lg:px-4xl'>
            <p className='text-xs font-black uppercase tracking-[0.3em] text-brand-green mb-4xl'>
              {t('origin.eyebrow')}
            </p>

            <div className='space-y-2xl text-primary-500'>
              <p className='font-heading text-2xl lg:text-3xl font-bold leading-snug'>
                {t('origin.p1')}
              </p>

              <p className='text-base lg:text-lg text-primary-500/75 leading-relaxed'>
                {t('origin.p2')}
              </p>

              <p className='text-base lg:text-lg text-primary-500/75 leading-relaxed'>
                {t('origin.p3')}
              </p>

              <p className='text-base lg:text-lg text-primary-500/75 leading-relaxed'>
                {t('origin.p4')}
              </p>
            </div>

            {/* Pull quote */}
            <div className='mt-3xl border-l-4 border-brand-green pl-3xl'>
              <p className='font-heading text-xl lg:text-2xl font-bold text-primary-500 italic leading-snug'>
                &ldquo;{t('origin.quote')}&rdquo;
              </p>
            </div>
          </div>
        </section>

        {/* ── WHAT MISSION-DRIVEN MEANS HERE ───────────────────────────────── */}
        <section className='bg-cream py-4xl lg:py-6xl'>
          <div className='mx-auto max-w-7xl px-2xl lg:px-4xl'>
            <div className='grid lg:grid-cols-[1fr_1.6fr] gap-6xl lg:gap-4xl items-start'>
              <div className='lg:sticky lg:top-6xl'>
                <p className='text-xs font-black uppercase tracking-[0.3em] text-brand-green mb-xl'>
                  {t('proof.eyebrow')}
                </p>
                <h2 className='font-heading text-3xl lg:text-4xl xl:text-5xl font-bold text-primary-500 leading-tight'>
                  {t('proof.titleClaim')}
                  <br />
                  <span className='text-brand-green italic'>{t('proof.titleEm')}</span>
                </h2>
                <p className='text-primary-500/75 text-base mt-xl leading-relaxed'>
                  {t('proof.lede')}
                </p>
              </div>

              <div className='space-y-lg'>
                {proofItems.map(item => (
                  <div
                    key={item.n}
                    className='bg-white rounded-3xl p-3xl border border-primary-500/10 hover:border-primary-500/20 hover:shadow-md transition-all duration-300'
                  >
                    <div className='flex items-start gap-xl'>
                      <span className='font-heading text-2xl font-bold text-primary-500/15 shrink-0 leading-none mt-xxs'>
                        {item.n}
                      </span>
                      <div>
                        <h3 className='font-bold text-base text-primary-500 mb-sm leading-snug'>
                          {item.title}
                        </h3>
                        <p className='text-sm text-primary-500/60 leading-relaxed'>{item.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── THE THREE TENSIONS ───────────────────────────────────────────── */}
        <section className='bg-white py-4xl lg:py-6xl'>
          <div className='mx-auto max-w-7xl px-2xl lg:px-4xl'>
            <div className='text-center mb-xl'>
              <p className='text-xs font-black uppercase tracking-[0.3em] text-brand-green mb-lg'>
                {t('tensions.eyebrow')}
              </p>
              <h2 className='font-heading text-3xl lg:text-5xl font-bold text-primary-500 leading-tight mb-lg'>
                {t('tensions.title')}
                <br />
                <span className='text-brand-green italic'>{t('tensions.titleEm')}</span>
              </h2>
              <p className='text-primary-500/75 text-base max-w-xl mx-auto leading-relaxed'>
                {t('tensions.lede')}
              </p>
            </div>

            {/* Instruction hint */}
            <div className='flex justify-center mb-4xl'>
              <div className='inline-flex items-center gap-sm bg-cream border border-primary-500/10 rounded-full px-lg py-sm'>
                <svg
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={2}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='w-3.5 h-3.5 text-primary-500/40'
                  aria-hidden='true'
                >
                  <path d='M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5' />
                </svg>
                <span className='text-xs text-primary-500/40 font-bold uppercase tracking-wider'>
                  {t('tensions.hint')}
                </span>
              </div>
            </div>

            <div className='grid md:grid-cols-3 gap-xl lg:gap-2xl'>
              {tensions.map(item => (
                <TensionCard
                  key={item.left}
                  data={item}
                  navigationLabel={t('tensions.navigationLabel')}
                  leanLabel={t('tensions.leanLabel')}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── WHO WE'RE FOR / NOT FOR ───────────────────────────────────────── */}
        <section className='bg-cream py-4xl lg:py-6xl relative overflow-hidden'>
          <div className='mx-auto max-w-7xl px-2xl lg:px-4xl'>
            <div className='text-center mb-14'>
              <p className='text-xs font-black uppercase tracking-[0.3em] text-brand-green mb-lg'>
                {t('audience.eyebrow')}
              </p>
              <h2 className='font-heading text-3xl lg:text-5xl font-bold text-primary-500 leading-tight'>
                {t('audience.title')}
              </h2>
            </div>

            <div className='grid lg:grid-cols-2 gap-xl lg:gap-2xl'>
              {/* Built for */}
              <div className='bg-primary-500 rounded-3xl p-4xl lg:p-6xl'>
                <div className='flex items-center gap-md mb-3xl'>
                  <div className='w-3 h-3 rounded-full bg-secondary-light' aria-hidden='true' />
                  <p className='text-secondary-light text-xs font-black uppercase tracking-[0.3em]'>
                    {t('audience.forLabel')}
                  </p>
                </div>
                <ul className='space-y-lg'>
                  {forUs.map(item => (
                    <li key={item} className='flex items-start gap-md'>
                      <svg
                        viewBox='0 0 20 20'
                        fill='currentColor'
                        className='w-4 h-4 text-secondary-light shrink-0 mt-xxs'
                        aria-hidden='true'
                      >
                        <path
                          fillRule='evenodd'
                          d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                          clipRule='evenodd'
                        />
                      </svg>
                      <p className='text-sm text-white/75 leading-snug'>{item}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Not for */}
              <div className='bg-white rounded-3xl p-4xl lg:p-6xl border-2 border-primary-500/10'>
                <div className='flex items-center gap-md mb-3xl'>
                  <div className='w-3 h-3 rounded-full bg-primary-500/20' aria-hidden='true' />
                  <p className='text-primary-500/75 text-xs font-black uppercase tracking-[0.3em]'>
                    {t('audience.notForLabel')}
                  </p>
                </div>
                <ul className='space-y-lg'>
                  {notForUs.map(item => (
                    <li key={item} className='flex items-start gap-md'>
                      <svg
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth={2}
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        className='w-4 h-4 text-primary-500/25 shrink-0 mt-xxs'
                        aria-hidden='true'
                      >
                        <line x1='18' y1='6' x2='6' y2='18' />
                        <line x1='6' y1='6' x2='18' y2='18' />
                      </svg>
                      <p className='text-sm text-primary-500/75 leading-snug'>{item}</p>
                    </li>
                  ))}
                </ul>

                <div className='mt-4xl pt-2xl border-t border-primary-500/10'>
                  <p className='text-xs text-primary-500/75 italic leading-relaxed'>
                    {t('audience.footnote')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── THE INVITATION - doors ────────────────────────────────────────── */}
        <section className='bg-white py-4xl lg:py-5xl'>
          <div className='mx-auto max-w-5xl px-2xl lg:px-4xl mb-3xl text-center'>
            <p className='text-xs font-black uppercase tracking-[0.3em] text-brand-green mb-lg'>
              {t('invitation.eyebrow')}
            </p>
            <h2 className='font-heading text-3xl lg:text-5xl font-bold text-primary-500 leading-tight'>
              {t('invitation.title')}
            </h2>
          </div>

          <div className='border-t border-primary-500/10'>
            {doors.map((door, i) => (
              <Door
                key={door.label}
                href={DOOR_HREFS[i] ?? DOOR_HREFS[0]}
                label={door.label}
                tagline={door.tagline}
                index={i}
              />
            ))}
          </div>

          {/* Final line */}
          <div className='mx-auto max-w-5xl px-2xl lg:px-4xl pt-14 text-center'>
            <p className='font-heading text-lg lg:text-2xl text-primary-500/75 italic'>
              &ldquo;{t('invitation.finalQuote')}&rdquo;
            </p>
            <p className='text-brand-green text-xs font-black uppercase tracking-widest mt-lg'>
              - {t('invitation.finalAttribution')}
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
