'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { FormEvent } from 'react';
import { Header } from '@/components/layout';

// ── Inline SVG Icons ──────────────────────────────────────────────────────────

function RocketIcon({ className }: { className?: string }) {
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
      <path d='M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z' />
      <path d='M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z' />
      <path d='M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5' />
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

function HeartIcon({ className }: { className?: string }) {
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
      <path d='M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z' />
    </svg>
  );
}

function CodeIcon({ className }: { className?: string }) {
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
      <polyline points='16 18 22 12 16 6' />
      <polyline points='8 6 2 12 8 18' />
    </svg>
  );
}

function MegaphoneIcon({ className }: { className?: string }) {
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
      <path d='M3 11l19-9-9 19-2-8-8-2z' />
    </svg>
  );
}

function LayoutIcon({ className }: { className?: string }) {
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
      <rect x='3' y='3' width='18' height='18' rx='2' ry='2' />
      <line x1='3' y1='9' x2='21' y2='9' />
      <line x1='9' y1='21' x2='9' y2='9' />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
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
      <path d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z' />
      <circle cx='12' cy='10' r='3' />
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

function CheckCircleIcon({ className }: { className?: string }) {
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
      <path d='M22 11.08V12a10 10 0 11-5.93-9.14' />
      <polyline points='22 4 12 14.01 9 11.01' />
    </svg>
  );
}

// ── Static data ───────────────────────────────────────────────────────────────

/**
 * Flags and colours, paired by index with `vision.stages` in the messages.
 * The active flag marks Tunisia, which is chapter one everywhere.
 */
const EXPANSION_ART = [
  { flag: '🇹🇳', textColor: 'text-primary-500', borderColor: 'border-primary-500', active: true },
  { flag: '🌍', textColor: 'text-brand-teal', borderColor: 'border-brand-teal', active: false },
  { flag: '🌍', textColor: 'text-brand-green', borderColor: 'border-brand-green', active: false },
  {
    flag: '🌏',
    textColor: 'text-primary-500',
    borderColor: 'border-primary-500/60',
    active: false,
  },
] as const;

/** Paired by index with `vision.countries`. */
const GCC_FLAGS = ['🇸🇦', '🇦🇪', '🇶🇦', '🇰🇼', '🇴🇲', '🇧🇭'] as const;

interface ExpansionStage {
  region: string;
  subtitle: string;
  desc: string;
}

/**
 * Everything about a role that is not copy, paired by index with
 * `positions.items`. The role name stays here on purpose - see the file header.
 */
const POSITION_META = [
  {
    id: 'backend-dev',
    role: 'Backend Developer',
    Icon: CodeIcon,
    isFemale: false,
    accentBg: 'bg-primary-500/10',
    accentText: 'text-primary-500',
    accentBorder: 'border-primary-500/20',
    badgeBg: 'bg-primary-500',
  },
  {
    id: 'marketing-male',
    role: 'Growth & Marketing',
    Icon: MegaphoneIcon,
    isFemale: false,
    accentBg: 'bg-brand-green/10',
    accentText: 'text-brand-green',
    accentBorder: 'border-brand-green/20',
    badgeBg: 'bg-brand-green',
  },
  {
    id: 'marketing-female',
    role: 'Brand & Community',
    Icon: HeartIcon,
    isFemale: true,
    accentBg: 'bg-primary-500/10',
    accentText: 'text-primary-500',
    accentBorder: 'border-primary-500/20',
    badgeBg: 'bg-primary-500',
  },
  {
    id: 'frontend-dev',
    role: 'Frontend Developer - Mobile & Web',
    Icon: LayoutIcon,
    isFemale: true,
    accentBg: 'bg-brand-green/10',
    accentText: 'text-brand-green',
    accentBorder: 'border-brand-green/20',
    badgeBg: 'bg-brand-green',
  },
] as const;

interface Position {
  tagline: string;
  skills: string[];
  description: string;
  dream: string;
}

// ── Application Form Component ────────────────────────────────────────────────

function ApplicationForm() {
  const t = useTranslations('careers.form');
  const tPositions = useTranslations('careers.positions');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    position: '',
    letter: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate submission — replace with real API call when backend endpoint is ready
    await new Promise(res => setTimeout(res, 1200));
    setLoading(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className='flex flex-col items-center justify-center py-4xl gap-xl text-center'>
        <div className='w-20 h-20 rounded-full bg-primary-500/10 flex items-center justify-center'>
          <CheckCircleIcon className='w-10 h-10 text-primary-500' />
        </div>
        <h3 className='font-heading text-3xl font-bold text-primary-500'>{t('successTitle')}</h3>
        <p className='text-primary-500/75 text-base max-w-md leading-relaxed'>{t('successBody')}</p>
        <p className='text-brand-green font-bold text-sm'>{t('successSignature')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-2xl' noValidate>
      <div className='grid sm:grid-cols-2 gap-xl'>
        {/* Full Name */}
        <div className='flex flex-col gap-1.5'>
          <label
            htmlFor='name'
            className='text-xs font-bold uppercase tracking-widest text-primary-500/60'
          >
            {t('nameLabel')} <span className='text-error'>*</span>
          </label>
          <input
            id='name'
            name='name'
            type='text'
            required
            value={formData.name}
            onChange={handleChange}
            placeholder={t('namePlaceholder')}
            className='w-full bg-cream border border-primary-500/15 rounded-xl px-lg py-md text-sm text-primary-500 placeholder:text-primary-500/35 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/40 transition-all'
          />
        </div>

        {/* Email */}
        <div className='flex flex-col gap-1.5'>
          <label
            htmlFor='email'
            className='text-xs font-bold uppercase tracking-widest text-primary-500/60'
          >
            {t('emailLabel')} <span className='text-error'>*</span>
          </label>
          <input
            id='email'
            name='email'
            type='email'
            required
            value={formData.email}
            onChange={handleChange}
            placeholder={t('emailPlaceholder')}
            className='w-full bg-cream border border-primary-500/15 rounded-xl px-lg py-md text-sm text-primary-500 placeholder:text-primary-500/35 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/40 transition-all'
          />
        </div>
      </div>

      <div className='grid sm:grid-cols-2 gap-xl'>
        {/* Phone */}
        <div className='flex flex-col gap-1.5'>
          <label
            htmlFor='phone'
            className='text-xs font-bold uppercase tracking-widest text-primary-500/60'
          >
            {t('phoneLabel')} <span className='text-error'>*</span>
          </label>
          <input
            id='phone'
            name='phone'
            type='tel'
            required
            value={formData.phone}
            onChange={handleChange}
            placeholder={t('phonePlaceholder')}
            className='w-full bg-cream border border-primary-500/15 rounded-xl px-lg py-md text-sm text-primary-500 placeholder:text-primary-500/35 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/40 transition-all'
          />
        </div>

        {/* Position */}
        <div className='flex flex-col gap-1.5'>
          <label
            htmlFor='position'
            className='text-xs font-bold uppercase tracking-widest text-primary-500/60'
          >
            {t('positionLabel')} <span className='text-error'>*</span>
          </label>
          <select
            id='position'
            name='position'
            required
            value={formData.position}
            onChange={handleChange}
            className='w-full bg-cream border border-primary-500/15 rounded-xl px-lg py-md text-sm text-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/40 transition-all appearance-none cursor-pointer'
          >
            <option value='' disabled>
              {t('positionPlaceholder')}
            </option>
            {POSITION_META.map(meta => (
              <option key={meta.id} value={meta.id}>
                {meta.role} ({meta.isFemale ? tPositions('genderFemale') : tPositions('genderMale')}
                )
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Motivation Letter */}
      <div className='flex flex-col gap-1.5'>
        <label
          htmlFor='letter'
          className='text-xs font-bold uppercase tracking-widest text-primary-500/60'
        >
          {t('letterLabel')} <span className='text-error'>*</span>
        </label>
        <textarea
          id='letter'
          name='letter'
          required
          rows={7}
          value={formData.letter}
          onChange={handleChange}
          placeholder={t('letterPlaceholder')}
          className='w-full bg-cream border border-primary-500/15 rounded-xl px-lg py-md text-sm text-primary-500 placeholder:text-primary-500/35 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/40 transition-all resize-none leading-relaxed'
        />
        <p className='text-xs text-primary-500/75'>{t('letterHint')}</p>
      </div>

      <button
        type='submit'
        disabled={
          loading ||
          !formData.name ||
          !formData.email ||
          !formData.phone ||
          !formData.position ||
          !formData.letter
        }
        className='w-full sm:w-auto inline-flex items-center justify-center gap-md bg-primary-500 text-white font-black text-sm px-6xl py-lg rounded-full hover:bg-primary-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl'
      >
        {loading ? (
          <>
            <svg
              className='w-4 h-4 animate-spin'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={2}
              aria-hidden='true'
            >
              <path d='M21 12a9 9 0 11-18 0 9 9 0 0118 0z' strokeOpacity={0.25} />
              <path d='M12 3a9 9 0 019 9' />
            </svg>
            Sending…
          </>
        ) : (
          <>
            {t('submit')}
            <ArrowRightIcon className='w-4 h-4' />
          </>
        )}
      </button>
    </form>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CareersPage() {
  const t = useTranslations('careers');

  const heroStats = t.raw('hero.stats') as { stat: string; label: string }[];
  const stages = t.raw('vision.stages') as ExpansionStage[];
  const countries = t.raw('vision.countries') as string[];
  const positions = t.raw('positions.items') as Position[];

  return (
    <>
      <Header />

      <main className='min-h-screen bg-white text-primary-500'>
        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <section className='bg-primary-500 relative overflow-hidden'>
          {/* Decorative glows */}

          {/* Floating decorative numbers */}
          <div
            className='absolute top-5xl left-[5%] text-[120px] font-black text-white/[0.03] select-none pointer-events-none leading-none'
            aria-hidden='true'
          >
            01
          </div>
          <div
            className='absolute bottom-6xl right-[4%] text-[180px] font-black text-white/[0.03] select-none pointer-events-none leading-none'
            aria-hidden='true'
          >
            ∞
          </div>

          <div className='relative mx-auto max-w-5xl px-2xl lg:px-4xl pt-4xl pb-0 lg:pt-6xl text-center'>
            {/* Eyebrow */}
            <div className='inline-flex items-center gap-sm bg-secondary-light/20 border border-secondary-light/40 text-secondary-light text-xs font-black uppercase tracking-[0.3em] px-lg py-sm rounded-full mb-4xl'>
              <RocketIcon className='w-3.5 h-3.5' />
              {t('hero.badge')}
            </div>

            <h1 className='font-heading text-4xl sm:text-5xl lg:text-7xl font-bold text-white leading-tight mb-2xl'>
              {t('hero.titleStart')}{' '}
              <span className='text-secondary-light italic'>{t('hero.titleEm1')}</span>
              <br />
              {t('hero.titleMid')}{' '}
              <span className='text-secondary-light italic'>{t('hero.titleEm2')}</span>
            </h1>

            <p className='text-white/75 text-base lg:text-xl leading-relaxed max-w-3xl mx-auto mb-6xl'>
              {t('hero.lede')}
            </p>

            {/* Stats row */}
            <div className='flex flex-wrap justify-center gap-4xl lg:gap-4xl pb-4xl'>
              {heroStats.map(item => (
                <div key={item.label} className='text-center'>
                  <p className='font-heading text-3xl lg:text-4xl font-bold text-white'>
                    {item.stat}
                  </p>
                  <p className='text-white/75 text-xs uppercase tracking-widest mt-xs'>
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Wave into white */}
          <div className='relative' aria-hidden='true'>
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

        {/* ── THE DREAM ────────────────────────────────────────────────────── */}
        <section className='bg-white py-4xl lg:py-6xl'>
          <div className='mx-auto max-w-4xl px-2xl lg:px-4xl text-center'>
            <p className='text-xs font-bold uppercase tracking-[0.3em] text-brand-green mb-2xl'>
              {t('dream.eyebrow')}
            </p>
            <blockquote className='font-heading text-3xl lg:text-5xl font-bold text-primary-500 leading-tight mb-4xl'>
              &ldquo;{t('dream.quote')}&rdquo;
            </blockquote>
            <p className='text-primary-500/75 text-base lg:text-lg leading-relaxed max-w-2xl mx-auto'>
              {t('dream.body')}
            </p>
          </div>
        </section>

        {/* ── VISION & EXPANSION ───────────────────────────────────────────── */}
        <section className='bg-cream py-4xl lg:py-6xl relative overflow-hidden'>
          <div className='relative mx-auto max-w-7xl px-2xl lg:px-4xl'>
            <div className='text-center mb-14'>
              <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-green mb-md'>
                {t('vision.eyebrow')}
              </p>
              <h2 className='font-heading text-4xl lg:text-5xl font-bold text-primary-500'>
                {t('vision.titleStart')}{' '}
                <span className='text-brand-green italic'>{t('vision.titleEm')}</span>
              </h2>
              <p className='text-primary-500/75 text-base lg:text-lg mt-lg max-w-2xl mx-auto leading-relaxed'>
                {t('vision.lede')}
              </p>
            </div>

            {/* Expansion timeline */}
            <div className='relative'>
              {/* Connecting line (desktop) */}
              <div
                className='hidden lg:block absolute top-3xl left-[12.5%] right-[12.5%] h-px bg-primary-500/10'
                aria-hidden='true'
              />

              <div className='grid sm:grid-cols-2 lg:grid-cols-4 gap-2xl'>
                {stages.map((stage, i) => {
                  const art = EXPANSION_ART[i] ?? EXPANSION_ART[0];
                  return (
                    <div key={stage.region} className='relative'>
                      {/* Step dot */}
                      <div
                        className={`hidden lg:flex absolute -top-[3px] left-xs/2 -translate-x-xs/2 w-6 h-6 rounded-full border-2 border-white items-center justify-center shadow-md z-10 ${art.active ? 'bg-brand-teal' : 'bg-primary-500/25'}`}
                        aria-hidden='true'
                      />

                      <div
                        className={`mt-0 lg:mt-6xl bg-white rounded-3xl p-2xl border-2 ${art.active ? `${art.borderColor} shadow-lg` : 'border-transparent'} transition-all hover:shadow-md`}
                      >
                        <div className='text-3xl mb-md leading-none'>{art.flag}</div>
                        <div className='flex items-center gap-sm mb-xs'>
                          <h3 className='font-bold text-base text-primary-500 leading-tight'>
                            {stage.region}
                          </h3>
                          {art.active && (
                            <span className='text-[9px] font-black uppercase tracking-widest bg-primary-500 text-white px-sm py-xxs rounded-full leading-none'>
                              {t('vision.nowBadge')}
                            </span>
                          )}
                        </div>
                        <p
                          className={`text-xs font-bold uppercase tracking-wider ${art.textColor} mb-md`}
                        >
                          {stage.subtitle}
                        </p>
                        <p className='text-sm text-primary-500/75 leading-relaxed'>{stage.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* GCC country flags detail */}
            <div className='mt-6xl bg-white rounded-3xl p-2xl lg:p-4xl border border-primary-500/10'>
              <p className='text-xs font-bold uppercase tracking-widest text-primary-500/50 mb-xl text-center'>
                {t('vision.gccLabel')}
              </p>
              <div className='flex flex-wrap justify-center gap-lg lg:gap-4xl'>
                {countries.map((name, i) => (
                  <div key={name} className='flex flex-col items-center gap-1.5'>
                    <span className='text-3xl leading-none'>{GCC_FLAGS[i]}</span>
                    <span className='text-xs font-bold text-primary-500/75 text-center'>
                      {name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── WHO WE NEED ──────────────────────────────────────────────────── */}
        <section className='bg-white py-4xl lg:py-6xl'>
          <div className='mx-auto max-w-7xl px-2xl lg:px-4xl'>
            <div className='text-center mb-14'>
              <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-green mb-md'>
                {t('positions.eyebrow')}
              </p>
              <h2 className='font-heading text-4xl lg:text-5xl font-bold text-primary-500'>
                {t('positions.titleStart')}{' '}
                <span className='text-brand-green italic'>{t('positions.titleEm')}</span>
              </h2>
              <p className='text-primary-500/75 text-base lg:text-lg mt-lg max-w-xl mx-auto leading-relaxed'>
                {t('positions.lede')}
              </p>
            </div>

            <div className='grid md:grid-cols-2 gap-2xl lg:gap-4xl'>
              {positions.map((pos, i) => {
                const meta = POSITION_META[i] ?? POSITION_META[0];
                const PositionIcon = meta.Icon;
                return (
                  <div
                    key={meta.id}
                    className={`group relative bg-cream rounded-3xl p-3xl lg:p-4xl border-2 ${meta.accentBorder} hover:shadow-xl transition-all duration-300 overflow-hidden`}
                  >
                    {/* Background pattern */}
                    <div
                      className='absolute -bottom-4xl -right-4xl w-40 h-40 rounded-full opacity-5 pointer-events-none'
                      style={{ backgroundColor: 'currentColor' }}
                      aria-hidden='true'
                    />

                    {/* Header */}
                    <div className='flex items-start justify-between mb-xl'>
                      <div
                        className={`w-14 h-14 rounded-2xl ${meta.accentBg} ${meta.accentText} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
                      >
                        <PositionIcon className='w-7 h-7' />
                      </div>
                      <div className='flex flex-col items-end gap-1.5'>
                        <span
                          className={`text-[10px] font-black uppercase tracking-widest ${meta.badgeBg} text-white px-md py-xs rounded-full`}
                        >
                          {meta.isFemale ? t('positions.genderFemale') : t('positions.genderMale')}
                        </span>
                        <span className='text-[10px] font-bold uppercase tracking-widest text-primary-500/40 flex items-center gap-xs'>
                          <MapPinIcon className='w-3 h-3' />
                          {t('positions.location')}
                        </span>
                      </div>
                    </div>

                    <h3 className='font-heading text-xl lg:text-2xl font-bold text-primary-500 mb-xs leading-snug'>
                      {meta.role}
                    </h3>
                    <p className={`text-sm font-bold italic ${meta.accentText} mb-lg`}>
                      {pos.tagline}
                    </p>
                    <p className='text-sm text-primary-500/65 leading-relaxed mb-xl'>
                      {pos.description}
                    </p>

                    {/* What you dream */}
                    <div
                      className={`${meta.accentBg} rounded-2xl p-lg mb-xl border ${meta.accentBorder}`}
                    >
                      <p className='text-xs font-bold uppercase tracking-wider text-primary-500/50 mb-xs'>
                        {t('positions.dreamLabel')}
                      </p>
                      <p className={`text-sm font-medium ${meta.accentText} leading-relaxed`}>
                        {pos.dream}
                      </p>
                    </div>

                    {/* Skills */}
                    <div className='flex flex-wrap gap-sm'>
                      {pos.skills.map((skill, si) => (
                        <span
                          key={si}
                          className='text-xs font-bold text-primary-500/70 bg-white border border-primary-500/10 px-md py-xs rounded-full'
                        >
                          {skill}
                        </span>
                      ))}
                    </div>

                    {/* Apply anchor */}
                    <a
                      href='#apply'
                      className={`mt-2xl inline-flex items-center gap-sm text-sm font-black ${meta.accentText} hover:opacity-75 transition-opacity`}
                    >
                      {t('positions.applyCta')}
                      <ArrowRightIcon className='w-4 h-4' />
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── VALUES BANNER ────────────────────────────────────────────────── */}
        <section className='bg-primary-500 py-14 lg:py-5xl relative overflow-hidden'>
          {/* Top wave */}
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
          {/* Bottom wave */}
          <div className='absolute bottom-0 left-0 right-0' aria-hidden='true'>
            <svg
              viewBox='0 0 1440 72'
              xmlns='http://www.w3.org/2000/svg'
              className='block w-full'
              preserveAspectRatio='none'
            >
              <path d='M0,40 C360,72 1080,8 1440,40 L1440,72 L0,72 Z' fill='#f9f3f0' />
            </svg>
          </div>

          <div className='relative mx-auto max-w-5xl px-2xl lg:px-4xl pt-4xl text-center'>
            <GlobeIcon className='w-10 h-10 text-secondary-light mx-auto mb-2xl' />
            <h2 className='font-heading text-3xl lg:text-5xl font-bold text-white mb-xl leading-tight'>
              {t('culture.titleStart')}
              <br />
              <span className='text-secondary-light italic'>{t('culture.titleEm')}</span>
            </h2>
            <p className='text-white/75 text-base lg:text-lg leading-relaxed max-w-2xl mx-auto'>
              {t('culture.body')} <em className='text-white'>{t('culture.bodyEm')}</em>
            </p>
          </div>
        </section>

        {/* ── APPLICATION FORM ─────────────────────────────────────────────── */}
        <section id='apply' className='bg-cream py-4xl lg:py-6xl scroll-mt-20'>
          <div className='mx-auto max-w-3xl px-2xl lg:px-4xl'>
            <div className='text-center mb-3xl'>
              <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-green mb-md'>
                {t('form.eyebrow')}
              </p>
              <h2 className='font-heading text-4xl lg:text-5xl font-bold text-primary-500 mb-lg'>
                {t('form.title')}
              </h2>
              <p className='text-primary-500/75 text-base leading-relaxed max-w-xl mx-auto'>
                {t('form.lede')}
              </p>
            </div>

            <div className='bg-white rounded-3xl p-4xl lg:p-6xl border border-primary-500/10 shadow-sm'>
              <ApplicationForm />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
