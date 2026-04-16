'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, useInView } from 'framer-motion';
import { Playfair_Display } from 'next/font/google';
import { Header } from '@/components/layout';
import { EnterpriseForm } from '@/components/sections/EnterpriseForm';

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  display: 'swap',
  variable: '--font-playfair',
});

// ─── Animated counter ────────────────────────────────────────────────────────
function Counter({ target, suffix = '' }: { target: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    if (!inView) return;
    const numeric = parseFloat(target.replace(/[^0-9.]/g, ''));
    const prefix = target.match(/^[^0-9]*/)?.[0] ?? '';
    const actualSuffix = target.replace(/[0-9.]/g, '').replace(prefix, '') + suffix;
    let start = 0;
    const duration = 1800;
    const step = 16;
    const increment = numeric / (duration / step);
    const timer = setInterval(() => {
      start += increment;
      if (start >= numeric) {
        setDisplay(`${prefix}${numeric}${actualSuffix}`);
        clearInterval(timer);
      } else {
        setDisplay(`${prefix}${Math.floor(start)}${actualSuffix}`);
      }
    }, step);
    return () => clearInterval(timer);
  }, [inView, target, suffix]);

  return <span ref={ref}>{display}</span>;
}

// ─── Framework card ───────────────────────────────────────────────────────────
interface FrameworkItem {
  code: string;
  title: string;
  body: string;
}

function FrameworkCard({ item, index }: { item: FrameworkItem; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.07, ease: 'easeOut' }}
      className='group relative rounded-2xl p-6 cursor-default overflow-hidden'
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(0,82,80,0.25)',
        transition: 'border-color 0.3s, background 0.3s',
      }}
      whileHover={{
        backgroundColor: 'rgba(0,82,80,0.12)',
        borderColor: 'rgba(0,82,80,0.6)',
      }}
    >
      {/* Code badge */}
      <span
        className='inline-block text-[10px] font-black tracking-[0.2em] uppercase px-2.5 py-1 rounded-full mb-4'
        style={{ background: 'rgba(255,121,115,0.15)', color: '#ff7973' }}
      >
        {item.code}
      </span>
      <h3
        className='text-white font-bold text-base mb-2'
        style={{ fontFamily: 'var(--font-playfair)' }}
      >
        {item.title}
      </h3>
      <p className='text-sm leading-relaxed' style={{ color: 'rgba(240,236,228,0.55)' }}>
        {item.body}
      </p>
    </motion.div>
  );
}

// ─── Noise texture overlay ────────────────────────────────────────────────────
const noiseStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'repeat',
  backgroundSize: '200px',
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CompaniesPage() {
  const t = useTranslations('companies');

  const stats = t.raw('hero.stats') as Array<{ value: string; label: string }>;
  const frameworks = t.raw('frameworks.items') as FrameworkItem[];
  const employeePoints = t.raw('employee.points') as Array<{ title: string; body: string }>;

  const employeeIcons = [
    // piggy bank
    <svg key='0' className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth={1.5}
        d='M12 8c-2.21 0-4 1.343-4 3s1.79 3 4 3 4-1.343 4-3-1.79-3-4-3zM4 12c0 4.418 3.582 8 8 8s8-3.582 8-8'
      />
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth={1.5}
        d='M20 10h1a1 1 0 010 2h-1'
      />
    </svg>,
    // smile
    <svg key='1' className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <circle cx='12' cy='12' r='10' strokeWidth={1.5} />
      <path strokeLinecap='round' strokeWidth={1.5} d='M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01' />
    </svg>,
    // chart rising
    <svg key='2' className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth={1.5}
        d='M13 7h8m0 0v8m0-8l-8 8-4-4-6 6'
      />
    </svg>,
    // check shield
    <svg key='3' className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth={1.5}
        d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
      />
    </svg>,
  ];

  return (
    <div
      className={`${playfair.variable} min-h-screen`}
      style={{ background: '#020f0c', color: '#f0ece4' }}
    >
      {/* Noise overlay */}
      <div
        className='fixed inset-0 pointer-events-none z-0'
        style={noiseStyle}
        aria-hidden='true'
      />

      <div className='relative z-10'>
        <Header />

        {/* ── HERO ──────────────────────────────────────────────────── */}
        <section className='relative min-h-screen flex items-center pt-20 pb-16 overflow-hidden'>
          {/* Background glow */}
          <div
            className='absolute inset-0 pointer-events-none'
            aria-hidden='true'
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 20% 50%, rgba(0,82,80,0.18) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 75% 30%, rgba(255,121,115,0.07) 0%, transparent 70%)',
            }}
          />

          <div className='max-w-7xl mx-auto px-6 lg:px-10 w-full grid lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_480px] gap-12 lg:gap-16 items-start'>
            {/* Left: Hook */}
            <div>
              <motion.p
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className='text-xs font-black tracking-[0.25em] uppercase mb-6 inline-flex items-center gap-2'
                style={{ color: '#ff7973' }}
              >
                <span
                  className='inline-block w-6 h-px'
                  style={{ background: '#ff7973' }}
                  aria-hidden='true'
                />
                {t('hero.eyebrow')}
              </motion.p>

              <motion.h1
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className='text-5xl md:text-6xl xl:text-7xl font-black leading-[1.05] tracking-tight mb-8'
                style={{ fontFamily: 'var(--font-playfair)', color: '#f0ece4' }}
              >
                {t('hero.headline')}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
                className='text-lg leading-relaxed max-w-xl mb-12'
                style={{ color: 'rgba(240,236,228,0.65)' }}
              >
                {t('hero.sub')}
              </motion.p>

              {/* Stats */}
              <div className='grid grid-cols-3 gap-4 md:gap-6'>
                {stats.map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.35 + i * 0.1 }}
                    className='rounded-2xl p-4 md:p-5'
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(0,82,80,0.3)',
                    }}
                  >
                    <p
                      className='text-3xl md:text-4xl font-black mb-1 leading-none'
                      style={{ color: '#ff7973', fontFamily: 'var(--font-playfair)' }}
                    >
                      <Counter target={stat.value} />
                    </p>
                    <p className='text-xs leading-snug' style={{ color: 'rgba(240,236,228,0.5)' }}>
                      {stat.label}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right: Form */}
            <div className='lg:sticky lg:top-24'>
              <EnterpriseForm />
            </div>
          </div>
        </section>

        {/* ── URGENCY BANNER ────────────────────────────────────────── */}
        <section
          className='py-16 px-6 relative overflow-hidden'
          style={{
            background: 'linear-gradient(135deg, rgba(0,82,80,0.25) 0%, rgba(2,15,12,0.9) 100%)',
            borderTop: '1px solid rgba(0,82,80,0.25)',
            borderBottom: '1px solid rgba(0,82,80,0.25)',
          }}
        >
          <div className='max-w-4xl mx-auto text-center'>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className='text-3xl md:text-4xl font-black mb-5'
              style={{ fontFamily: 'var(--font-playfair)', color: '#f0ece4' }}
            >
              {t('urgency.title')}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className='text-base md:text-lg leading-relaxed'
              style={{ color: 'rgba(240,236,228,0.6)' }}
            >
              {t('urgency.body')}
            </motion.p>
          </div>
          {/* Decorative lines */}
          <div
            className='absolute left-0 top-1/2 -translate-y-1/2 w-24 h-px opacity-30'
            style={{ background: 'linear-gradient(to right, transparent, #005250)' }}
            aria-hidden='true'
          />
          <div
            className='absolute right-0 top-1/2 -translate-y-1/2 w-24 h-px opacity-30'
            style={{ background: 'linear-gradient(to left, transparent, #005250)' }}
            aria-hidden='true'
          />
        </section>

        {/* ── FRAMEWORKS ────────────────────────────────────────────── */}
        <section className='py-24 px-6'>
          <div className='max-w-7xl mx-auto'>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className='mb-14'
            >
              <p
                className='text-xs font-black tracking-[0.2em] uppercase mb-3'
                style={{ color: '#ff7973' }}
              >
                COMPLIANCE & STANDARDS
              </p>
              <h2
                className='text-4xl md:text-5xl font-black'
                style={{ fontFamily: 'var(--font-playfair)', color: '#f0ece4' }}
              >
                {t('frameworks.title')}
              </h2>
            </motion.div>

            <div className='grid sm:grid-cols-2 lg:grid-cols-4 gap-4'>
              {frameworks.map((item, i) => (
                <FrameworkCard key={item.code} item={item} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ── EMPLOYEE BENEFITS ─────────────────────────────────────── */}
        <section
          className='py-24 px-6 relative overflow-hidden'
          style={{ background: 'rgba(0,82,80,0.08)', borderTop: '1px solid rgba(0,82,80,0.2)' }}
        >
          {/* Large background text */}
          <p
            className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10rem] md:text-[16rem] font-black pointer-events-none select-none whitespace-nowrap'
            style={{
              color: 'rgba(0,82,80,0.05)',
              fontFamily: 'var(--font-playfair)',
              lineHeight: 1,
            }}
            aria-hidden='true'
          >
            IMPACT
          </p>

          <div className='max-w-7xl mx-auto relative z-10'>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className='mb-14'
            >
              <p
                className='text-xs font-black tracking-[0.2em] uppercase mb-3'
                style={{ color: '#ff7973' }}
              >
                WHY YOUR TEAM WILL LOVE IT
              </p>
              <h2
                className='text-4xl md:text-5xl font-black'
                style={{ fontFamily: 'var(--font-playfair)', color: '#f0ece4' }}
              >
                {t('employee.title')}
              </h2>
            </motion.div>

            <div className='grid sm:grid-cols-2 gap-6'>
              {employeePoints.map((point, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -24 : 24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className='flex gap-5 rounded-2xl p-7'
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(0,82,80,0.2)',
                  }}
                >
                  <div
                    className='w-12 h-12 rounded-xl flex items-center justify-center shrink-0'
                    style={{ background: 'rgba(255,121,115,0.12)', color: '#ff7973' }}
                  >
                    {employeeIcons[i]}
                  </div>
                  <div>
                    <h3
                      className='font-bold text-lg mb-2'
                      style={{ color: '#f0ece4', fontFamily: 'var(--font-playfair)' }}
                    >
                      {point.title}
                    </h3>
                    <p
                      className='text-sm leading-relaxed'
                      style={{ color: 'rgba(240,236,228,0.55)' }}
                    >
                      {point.body}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── BOTTOM CTA SPLIT ──────────────────────────────────────── */}
        <section
          className='py-24 px-6 relative overflow-hidden'
          style={{ borderTop: '1px solid rgba(0,82,80,0.2)' }}
        >
          {/* Ambient glow */}
          <div
            className='absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none'
            style={{
              background: 'radial-gradient(ellipse, rgba(0,82,80,0.15) 0%, transparent 70%)',
            }}
            aria-hidden='true'
          />

          <div className='max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center relative z-10'>
            {/* Left: Pitch */}
            <motion.div
              initial={{ opacity: 0, x: -32 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              <p
                className='text-xs font-black tracking-[0.2em] uppercase mb-4 flex items-center gap-2'
                style={{ color: '#ff7973' }}
              >
                <span
                  className='inline-block w-5 h-px'
                  style={{ background: '#ff7973' }}
                  aria-hidden='true'
                />
                BECOME A PARTNER
              </p>
              <h2
                className='text-4xl md:text-5xl font-black leading-tight mb-6'
                style={{ fontFamily: 'var(--font-playfair)', color: '#f0ece4' }}
              >
                {t('form.title')}.
                <br />
                <span style={{ color: '#005250' }}>Start today.</span>
              </h2>
              <p
                className='text-base leading-relaxed mb-10'
                style={{ color: 'rgba(240,236,228,0.55)' }}
              >
                {t('form.sub')}
              </p>

              {/* Trust signals */}
              <div className='space-y-3'>
                {[
                  'Response within 24 hours, guaranteed',
                  'Dedicated enterprise account manager',
                  'Free ESG impact report for your first year',
                  'Fully customisable employee benefit plan',
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
                    className='flex items-center gap-3'
                  >
                    <div
                      className='w-5 h-5 rounded-full flex items-center justify-center shrink-0'
                      style={{ background: 'rgba(0,82,80,0.3)', border: '1px solid #005250' }}
                    >
                      <svg
                        className='w-3 h-3'
                        style={{ color: '#7fb89a' }}
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2.5}
                          d='M5 13l4 4L19 7'
                        />
                      </svg>
                    </div>
                    <span className='text-sm' style={{ color: 'rgba(240,236,228,0.7)' }}>
                      {item}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Right: Form again */}
            <EnterpriseForm />
          </div>
        </section>

        {/* ── FOOTER STRIP ──────────────────────────────────────────── */}
        <div
          className='py-10 px-6 text-center'
          style={{
            borderTop: '1px solid rgba(0,82,80,0.2)',
            color: 'rgba(240,236,228,0.3)',
            fontSize: '0.75rem',
          }}
        >
          © {new Date().getFullYear()} Too Fresh To Waste Tunisia · Sousse 4013 Messadine ·{' '}
          <a
            href='mailto:contact@toofreshtowaste.com'
            className='hover:text-[#f0ece4] transition-colors'
          >
            contact@toofreshtowaste.com
          </a>
        </div>
      </div>
    </div>
  );
}
