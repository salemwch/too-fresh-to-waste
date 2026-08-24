'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslations } from 'next-intl';

// ── Constants ────────────────────────────────────────────────
const SERIF: CSSProperties = { fontFamily: 'var(--font-heading)' };

const ZELLIGE_LIGHT =
  "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cg fill='%23C4A35A' fill-opacity='0.045'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")";

const ZELLIGE_DARK =
  "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cg fill='%23C4A35A' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")";

// ── Scroll reveal ────────────────────────────────────────────
function useScrollReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries =>
        entries.forEach(e => {
          if (e.isIntersecting) e.target.classList.add('in');
        }),
      { threshold: 0.12 },
    );
    document.querySelectorAll('.rv').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

// ── Bag SVG ──────────────────────────────────────────────────
function BagSVG() {
  return (
    <div
      className='relative w-[460px] h-[540px]'
      style={{ opacity: 0, animation: 'fadeIn 1.2s ease forwards 0.3s' }}
    >
      <svg
        viewBox='0 0 360 420'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
        className='w-full h-full'
      >
        <defs>
          <linearGradient
            id='bagGrad'
            x1='30'
            y1='110'
            x2='330'
            y2='400'
            gradientUnits='userSpaceOnUse'
          >
            <stop offset='0%' stopColor='#254E55' />
            <stop offset='100%' stopColor='#152E33' />
          </linearGradient>
          <linearGradient id='bagShine' x1='0' y1='0' x2='1' y2='1'>
            <stop offset='0%' stopColor='rgba(255,255,255,0.06)' />
            <stop offset='100%' stopColor='rgba(255,255,255,0)' />
          </linearGradient>
        </defs>

        {/* Drop shadow under bag */}
        <ellipse cx='180' cy='408' rx='130' ry='10' fill='rgba(0,0,0,0.28)' />

        {/* Bag body */}
        <rect x='30' y='110' width='300' height='280' rx='18' fill='url(#bagGrad)' />
        <rect x='30' y='110' width='300' height='280' rx='18' fill='url(#bagShine)' />

        {/* Front panel */}
        <rect
          x='52'
          y='148'
          width='256'
          height='220'
          rx='12'
          fill='rgba(255,255,255,0.03)'
          stroke='rgba(196,163,90,0.18)'
          strokeWidth='1'
        />

        {/* Zellige accent pattern */}
        <g opacity='0.12' style={{ stroke: 'hsl(var(--secondary))' }} strokeWidth='0.8'>
          <path d='M90 168 L110 190 L90 212 L70 190 Z' />
          <path d='M130 168 L150 190 L130 212 L110 190 Z' />
          <path d='M170 168 L190 190 L170 212 L150 190 Z' />
          <path d='M210 168 L230 190 L210 212 L190 190 Z' />
          <path d='M250 168 L270 190 L250 212 L230 190 Z' />
          <path d='M110 212 L130 234 L110 256 L90 234 Z' />
          <path d='M150 212 L170 234 L150 256 L130 234 Z' />
          <path d='M190 212 L210 234 L190 256 L170 234 Z' />
          <path d='M230 212 L250 234 L230 256 L210 234 Z' />
        </g>

        {/* Leaf logo mark */}
        <path
          d='M175 268 Q180 245 185 268 Q190 282 180 288 Q170 282 175 268Z'
          fill='#3D6B5C'
          opacity='0.9'
        />
        <line
          x1='180'
          y1='268'
          x2='180'
          y2='288'
          style={{ stroke: 'hsl(var(--secondary))' }}
          strokeWidth='0.9'
          opacity='0.55'
        />

        {/* Label */}
        <text
          x='180'
          y='342'
          fontFamily='serif'
          fontSize='16'
          fontWeight='400'
          style={{ fill: 'hsl(var(--secondary))' }}
          textAnchor='middle'
          opacity='0.92'
          letterSpacing='2'
        >
          PARCLESS BAG
        </text>

        {/* Handles */}
        <path
          d='M110 110 C110 54 148 42 180 42 C212 42 250 54 250 110'
          style={{ stroke: 'hsl(var(--secondary))' }}
          strokeWidth='7'
          fill='none'
          strokeLinecap='round'
        />
        <path
          d='M110 110 C110 54 148 42 180 42 C212 42 250 54 250 110'
          stroke='#1E4448'
          strokeWidth='3.5'
          fill='none'
          strokeLinecap='round'
        />

        {/* Gusset fold lines */}
        <path d='M30 120 L52 142' stroke='rgba(255,255,255,0.08)' strokeWidth='1' />
        <path d='M330 120 L308 142' stroke='rgba(255,255,255,0.08)' strokeWidth='1' />

        {/* Shine highlight */}
        <ellipse
          cx='88'
          cy='152'
          rx='28'
          ry='7'
          fill='rgba(255,255,255,0.04)'
          transform='rotate(-28 88 152)'
        />
      </svg>
    </div>
  );
}

// ── Hero ─────────────────────────────────────────────────────
function HeroSection() {
  const t = useTranslations('parclessBag.hero');
  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section
      className='h-screen min-h-[680px] bg-primary grid grid-cols-1 lg:grid-cols-2 relative overflow-hidden'
      style={{ backgroundImage: ZELLIGE_LIGHT }}
    >
      {/* Left - headline */}
      <div className='flex flex-col justify-end px-5xl py-5xl lg:px-4xl lg:py-6xl relative z-10'>
        <p
          className='text-secondary text-[0.68rem] font-semibold tracking-[0.22em] uppercase mb-3xl'
          style={{ opacity: 0, animation: 'fadeUp 0.8s ease forwards 0.2s' }}
        >
          {t('eyebrow')}
        </p>

        <h1
          className='text-[#F2EBD9] mb-3xl'
          style={{
            ...SERIF,
            fontSize: 'clamp(3.4rem, 5.5vw, 5.2rem)',
            lineHeight: 1.06,
            fontWeight: 400,
            opacity: 0,
            animation: 'fadeUp 0.9s ease forwards 0.4s',
          }}
        >
          <span className='block'>{t('headline.line1')}</span>
          <span className='block'>
            {t('headline.line2')} <em className='text-secondary'>{t('headline.line2Em')}</em>
          </span>
          {t('headline.line3Em') && (
            <span className='block'>
              <em className='text-secondary'>{t('headline.line3Em')}</em>
            </span>
          )}
        </h1>

        <p
          className='text-[#7FA896] text-[0.98rem] font-light leading-[1.75] max-w-[370px] mb-11'
          style={{ opacity: 0, animation: 'fadeUp 0.9s ease forwards 0.6s' }}
        >
          {t('subtitle')}
        </p>

        <div
          className='flex flex-wrap gap-lg items-center'
          style={{ opacity: 0, animation: 'fadeUp 0.9s ease forwards 0.8s' }}
        >
          <a
            href='#cta'
            className='bg-secondary text-primary font-semibold text-[0.82rem] tracking-[0.09em] uppercase px-5xl py-lg rounded-full flex items-center gap-sm transition-all hover:-translate-y-xxs hover:bg-[#F2EBD9] hover:shadow-[0_14px_42px_rgba(196,163,90,0.38)]'
          >
            {t('ctaPartner')}
            <svg
              width='15'
              height='15'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2.5'
            >
              <path d='M5 12h14M12 5l7 7-7 7' />
            </svg>
          </a>
          <button
            className='text-[rgba(242,235,217,0.65)] text-[0.84rem] underline underline-offset-4 bg-transparent border-0 px-sm py-lg cursor-pointer transition-colors hover:text-secondary'
            onClick={() => scrollTo('concept')}
          >
            {t('ctaLearnMore')}
          </button>
        </div>
      </div>

      {/* Right - bag (hidden on mobile) */}
      <div className='hidden lg:flex items-center justify-center relative z-10'>
        <BagSVG />
      </div>

      {/* Scroll hint */}
      <div
        className='absolute bottom-11 left-5xl lg:left-4xl flex items-center gap-md'
        style={{ opacity: 0, animation: 'fadeUp 1s ease forwards 1.4s' }}
      >
        <span className='text-[0.62rem] tracking-[0.22em] uppercase text-[#7FA896]'>
          {t('scrollHint')}
        </span>
      </div>
    </section>
  );
}

// ── Marquee ──────────────────────────────────────────────────
function MarqueeStrip() {
  const t = useTranslations('parclessBag.marquee');
  const items = t.raw('items') as string[];

  return (
    <div className='bg-secondary py-[22px] overflow-hidden'>
      <div
        className='flex whitespace-nowrap'
        style={{ animation: 'marqueeScroll 22s linear infinite' }}
      >
        {/* Duplicated for seamless loop */}
        {[0, 1].map(copy => (
          <div key={copy} className='flex items-center flex-shrink-0'>
            {items.map(item => (
              <div key={item} className='flex items-center gap-6xl pr-6xl flex-shrink-0'>
                <span className='text-[#0A1C1E] text-[1.05rem] italic flex-shrink-0' style={SERIF}>
                  {item}
                </span>
                <span className='w-[5px] h-[5px] rounded-full bg-[#0A1C1E] flex-shrink-0' />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Concept ──────────────────────────────────────────────────
function ConceptSection() {
  const t = useTranslations('parclessBag.concept');
  const miniStats = t.raw('miniStats') as Array<{ n: string; l: string }>;
  const tags = t.raw('tags') as string[];

  return (
    <section
      id='concept'
      className='bg-[#F2EBD9] px-5xl py-5xl lg:px-5xl lg:py-28 grid grid-cols-1 lg:grid-cols-2 gap-[72px] items-center'
    >
      {/* Left */}
      <div>
        <p className='rv text-[#C05F4A] text-[0.63rem] font-semibold tracking-[0.26em] uppercase mb-[18px]'>
          {t('label')}
        </p>
        <h2
          className='rv d1 text-primary mb-2xl'
          style={{
            ...SERIF,
            fontSize: 'clamp(2.4rem, 3.8vw, 3.6rem)',
            fontWeight: 400,
            lineHeight: 1.1,
          }}
        >
          {t('headlineBefore')} <em className='text-[#3D6B5C]'>{t('headlineEm')}</em>
          <br />
          {t('headlineAfter')}
        </h2>
        <p className='rv d2 text-[#3A4F48] text-[0.96rem] font-light leading-[1.82] mb-xl'>
          {t('body1')}
        </p>
        <p className='rv d2 text-[#3A4F48] text-[0.96rem] font-light leading-[1.82]'>
          {t('body2')}
        </p>
        <div className='rv d3 flex flex-wrap gap-[10px] mt-3xl'>
          {tags.map((tag, i) => (
            <span
              key={tag}
              className={`text-[0.68rem] font-medium tracking-[0.1em] uppercase px-[18px] py-sm rounded-full ${
                i === 0
                  ? 'bg-primary text-[#F2EBD9]'
                  : 'text-primary border border-[rgba(30,68,72,0.35)]'
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Right - stat card */}
      <div className='rv d2 relative'>
        <span
          className='absolute -top-[18px] right-4xl z-10 bg-[#C05F4A] text-white rounded-full px-[22px] py-[10px] text-[0.72rem] font-semibold tracking-[0.08em] uppercase shadow-[0_8px_28px_rgba(192,95,74,0.45)]'
          style={{ animation: 'floatItem 3s ease-in-out infinite' }}
        >
          {t('badge')}
        </span>
        <div className='bg-primary rounded-[22px] p-11 relative overflow-hidden'>
          <p className='text-secondary text-[0.62rem] tracking-[0.2em] uppercase mb-[18px]'>
            {t('statLabel')}
          </p>
          <p
            className='text-[#F2EBD9] leading-none mb-[6px]'
            style={{ ...SERIF, fontSize: '5.5rem', fontWeight: 300 }}
          >
            <span className='text-secondary'>73</span>%
          </p>
          <p className='text-[#7FA896] text-[0.87rem] font-light leading-[1.65] mb-5xl'>
            {t('statDesc')}
          </p>
          <div className='grid grid-cols-2 gap-lg'>
            {miniStats.map(({ n, l }) => (
              <div key={n} className='bg-[rgba(255,255,255,0.055)] rounded-xl p-[18px]'>
                <p className='text-secondary text-[1.75rem] font-light' style={SERIF}>
                  {n}
                </p>
                <p className='text-[#7FA896] text-[0.68rem] font-light mt-xs'>{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── How It Works ─────────────────────────────────────────────
function HowItWorksSection() {
  const t = useTranslations('parclessBag.howItWorks');
  const steps = t.raw('steps') as Array<{ n: string; icon: string; title: string; body: string }>;

  return (
    <section
      className='bg-primary px-5xl py-5xl lg:px-5xl lg:py-28 relative overflow-hidden'
      style={{ backgroundImage: ZELLIGE_DARK }}
    >
      <div className='text-center mb-[72px] rv'>
        <p className='text-secondary text-[0.63rem] font-semibold tracking-[0.26em] uppercase mb-[14px]'>
          {t('label')}
        </p>
        <h2
          className='text-[#F2EBD9] mb-[14px]'
          style={{ ...SERIF, fontSize: 'clamp(2.4rem, 3.8vw, 3.6rem)', fontWeight: 400 }}
        >
          {t('headlineBefore')} <em className='text-secondary'>{t('headlineEm')}</em>
        </h2>
        <p className='text-[#7FA896] text-[0.96rem] font-light max-w-[460px] mx-auto leading-[1.72]'>
          {t('subtitle')}
        </p>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-lg'>
        {steps.map(({ n, icon, title, body }, i) => (
          <div
            key={n}
            className={`rv d${i + 1} bg-[rgba(255,255,255,0.04)] border border-[rgba(196,163,90,0.14)] rounded-[20px] p-11 transition-all duration-300 hover:bg-[rgba(196,163,90,0.08)] hover:border-[rgba(196,163,90,0.38)] hover:-translate-y-sm`}
          >
            <p
              className='text-[rgba(196,163,90,0.18)] leading-none mb-xl'
              style={{ ...SERIF, fontSize: '4.5rem', fontWeight: 300 }}
            >
              {n}
            </p>
            <div className='w-[46px] h-[46px] bg-secondary rounded-[11px] flex items-center justify-center mb-[22px] text-[1.3rem]'>
              {icon}
            </div>
            <h3
              className='text-[#F2EBD9] mb-[14px]'
              style={{ ...SERIF, fontSize: '1.5rem', fontWeight: 400 }}
            >
              {title}
            </h3>
            <p className='text-[#7FA896] text-[0.88rem] font-light leading-[1.72]'>{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Benefits ─────────────────────────────────────────────────
type BenefitType = 'dark' | 'green' | 'gold' | 'light' | 'terra';

const BENEFIT_STYLES: Record<BenefitType, { bg: string; title: string; body: string }> = {
  dark: { bg: 'bg-primary', title: 'text-secondary', body: 'text-[#7FA896]' },
  green: { bg: 'bg-[#3D6B5C]', title: 'text-[#F2EBD9]', body: 'text-[#F2EBD9]' },
  gold: { bg: 'bg-secondary', title: 'text-primary', body: 'text-primary' },
  light: {
    bg: 'bg-[#E8DFC8] border border-[rgba(30,68,72,0.1)]',
    title: 'text-primary',
    body: 'text-primary',
  },
  terra: { bg: 'bg-[#C05F4A]', title: 'text-white', body: 'text-white' },
};

const BENEFIT_LAYOUT: Array<{ type: BenefitType; wide?: boolean; icon: string }> = [
  { type: 'dark', wide: true, icon: '💰' },
  { type: 'green', icon: '🌿' },
  { type: 'light', icon: '📊' },
  { type: 'gold', icon: '🤝' },
  { type: 'terra', icon: '🏛️' },
  { type: 'dark', icon: '🎯' },
];

function BenefitsSection() {
  const t = useTranslations('parclessBag.benefits');
  const benefitTexts = t.raw('items') as Array<{ title: string; body: string; big?: string }>;

  return (
    <section className='bg-[#F2EBD9] px-5xl py-5xl lg:px-5xl lg:py-28'>
      <div className='mb-[52px] rv'>
        <p className='text-[#C05F4A] text-[0.63rem] font-semibold tracking-[0.26em] uppercase mb-[10px]'>
          {t('label')}
        </p>
        <h2
          className='text-primary mb-[10px]'
          style={{ ...SERIF, fontSize: 'clamp(2.4rem, 3.8vw, 3.6rem)', fontWeight: 400 }}
        >
          {t('headlineBefore')} <em className='text-[#3D6B5C]'>{t('headlineEm')}</em>
          <br />
          {t('headlineAfter')}
        </h2>
        <p className='text-[#5A7A72] text-[0.96rem] font-light'>{t('subtitle')}</p>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[18px]'>
        {BENEFIT_LAYOUT.map((layout, i) => {
          const text = benefitTexts[i];
          const s = BENEFIT_STYLES[layout.type];
          return (
            <div
              key={i}
              className={`rv d${(i % 3) + 1} ${s.bg} ${layout.wide ? 'lg:col-span-2' : ''} rounded-[20px] p-[38px] transition-transform duration-300 hover:-translate-y-1.5`}
            >
              <span className='block text-[1.9rem] mb-[22px]'>{layout.icon}</span>
              <h3
                className={`${s.title} mb-[10px]`}
                style={{ ...SERIF, fontSize: '1.45rem', fontWeight: 400, lineHeight: 1.2 }}
              >
                {text.title}
              </h3>
              <p className={`${s.body} text-[0.84rem] font-light leading-[1.72] opacity-[0.82]`}>
                {text.body}
              </p>
              {text.big && (
                <span
                  className='block mt-2xl leading-none text-secondary'
                  style={{ ...SERIF, fontSize: '3.8rem', fontWeight: 300 }}
                >
                  {text.big}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Quote ────────────────────────────────────────────────────
function QuoteSection() {
  const t = useTranslations('parclessBag.quote');

  return (
    <section className='bg-[#F2EBD9] px-5xl py-6xl lg:px-5xl flex flex-col items-center text-center'>
      <div
        className='rv text-secondary leading-[0.4] mb-4xl'
        style={{ ...SERIF, fontSize: '7rem', opacity: 0.38 }}
      >
        &ldquo;
      </div>
      <blockquote
        className='rv text-primary max-w-[680px] mb-3xl'
        style={{
          ...SERIF,
          fontSize: 'clamp(1.5rem, 2.8vw, 2.2rem)',
          fontWeight: 300,
          fontStyle: 'italic',
          lineHeight: 1.42,
        }}
      >
        {t('text')}
      </blockquote>
      <cite className='rv text-[#C05F4A] text-[0.74rem] font-semibold tracking-[0.16em] uppercase not-italic'>
        {t('cite')}
      </cite>
    </section>
  );
}

// ── CTA ──────────────────────────────────────────────────────
function CTASection() {
  const t = useTranslations('parclessBag.cta');
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setEmail('');
    }, 3500);
  };

  return (
    <section id='cta' className='bg-primary px-5xl py-6xl lg:px-5xl relative overflow-hidden'>
      <div className='max-w-[680px] relative z-10'>
        <p className='rv text-secondary text-[0.62rem] tracking-[0.26em] uppercase mb-[18px]'>
          {t('label')}
        </p>
        <h2
          className='rv text-[#F2EBD9] mb-[18px]'
          style={{
            ...SERIF,
            fontSize: 'clamp(2.4rem, 3.8vw, 3.6rem)',
            fontWeight: 400,
            lineHeight: 1.08,
          }}
        >
          {t('headline')}
          <br />
          <em className='text-secondary'>{t('headlineEm')}</em>
        </h2>
        <p className='rv text-[#7FA896] text-[0.96rem] font-light leading-[1.75] mb-5xl'>
          {t('body')}
        </p>

        <form
          className='rv flex flex-col sm:flex-row gap-[10px] max-w-[460px]'
          onSubmit={handleSubmit}
        >
          <input
            type='email'
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={t('placeholder')}
            required
            className='flex-1 bg-[rgba(255,255,255,0.07)] border border-[rgba(196,163,90,0.28)] rounded-full px-[22px] py-[15px] text-[#F2EBD9] text-[0.88rem] outline-none focus:border-secondary transition-colors placeholder:text-[rgba(242,235,217,0.28)]'
          />
          <button
            type='submit'
            className={`flex items-center justify-center gap-sm font-semibold text-[0.82rem] tracking-[0.09em] uppercase px-5xl py-lg rounded-full flex-shrink-0 transition-all hover:-translate-y-xxs ${
              submitted ? 'bg-[#3D6B5C] text-white' : 'bg-secondary text-primary hover:bg-[#F2EBD9]'
            }`}
          >
            {submitted ? (
              t('submitted')
            ) : (
              <>
                {t('submit')}
                <svg
                  width='14'
                  height='14'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2.5'
                >
                  <path d='M5 12h14M12 5l7 7-7 7' />
                </svg>
              </>
            )}
          </button>
        </form>

        <p className='rv mt-[13px] text-[0.72rem] text-[rgba(242,235,217,0.35)]'>{t('note')}</p>
      </div>
    </section>
  );
}

// ── Page composition ─────────────────────────────────────────
export default function ParclessBagClient() {
  useScrollReveal();

  return (
    <main role='main'>
      <HeroSection />
      <MarqueeStrip />
      <ConceptSection />
      <HowItWorksSection />
      <BenefitsSection />
      <QuoteSection />
      <CTASection />
    </main>
  );
}
