'use client';

import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/layout';
import { Link } from '@/i18n/routing';

// ── Animated counter hook ─────────────────────────────────────────────────────

function useCountUp(target: number, duration = 2000, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf: number;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min((now - startTime) / duration, 1);
      // ease out cubic
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setCount(Math.floor(eased * target));
      if (elapsed < 1) raf = requestAnimationFrame(tick);
      else setCount(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return count;
}

// ── Counter card ─────────────────────────────────────────────────────────────

function ScoreCard({
  value,
  suffix = '',
  prefix = '',
  label,
  sublabel,
  started,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
  sublabel: string;
  started: boolean;
}) {
  const count = useCountUp(value, 2200, started);
  return (
    <div className='flex flex-col'>
      <p className='font-playfair text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-none mb-2'>
        {prefix}
        {count.toLocaleString()}
        {suffix}
      </p>
      <p className='text-sm font-black uppercase tracking-widest text-white mb-1'>{label}</p>
      <p className='text-xs text-white/40 leading-snug'>{sublabel}</p>
    </div>
  );
}

// ── Tension card ─────────────────────────────────────────────────────────────

interface TensionData {
  left: string;
  right: string;
  leftDesc: string;
  rightDesc: string;
  navigation: string;
  lean: 'left' | 'right';
}

function TensionCard({ data }: { data: TensionData }) {
  const [active, setActive] = useState<'left' | 'right'>(data.lean);

  return (
    <div className='bg-white rounded-3xl overflow-hidden border-2 border-primary-500/8 hover:border-primary-500/15 transition-colors'>
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
          className={`relative z-10 py-4 text-sm font-black uppercase tracking-widest transition-colors duration-300 ${
            active === 'left' ? 'text-white' : 'text-primary-500/40 hover:text-primary-500/70'
          }`}
        >
          {data.left}
        </button>
        <button
          onClick={() => setActive('right')}
          className={`relative z-10 py-4 text-sm font-black uppercase tracking-widest transition-colors duration-300 ${
            active === 'right' ? 'text-white' : 'text-primary-500/40 hover:text-primary-500/70'
          }`}
        >
          {data.right}
        </button>
      </div>

      {/* Description */}
      <div className='px-6 pt-5 pb-3 min-h-[72px]'>
        <p className='text-sm text-primary-500/65 leading-relaxed transition-all duration-200'>
          {active === 'left' ? data.leftDesc : data.rightDesc}
        </p>
      </div>

      {/* Navigation */}
      <div className='mx-6 mb-6 bg-cream rounded-2xl px-5 py-4 border border-primary-500/8'>
        <p className='text-[10px] font-black uppercase tracking-widest text-primary-500/40 mb-1.5'>
          How we navigate it
        </p>
        <p className='text-sm font-medium text-primary-500 leading-relaxed'>{data.navigation}</p>
      </div>

      {/* Lean indicator */}
      <div className='px-6 pb-5 flex items-center gap-2'>
        <span className='text-[10px] font-black uppercase tracking-widest text-primary-500/30'>
          We lean
        </span>
        <span className='text-[10px] font-black uppercase tracking-widest bg-primary-500/8 text-primary-500 px-2.5 py-1 rounded-full'>
          {data.lean === 'right' ? data.right : data.left}
        </span>
        <span className='text-[10px] text-primary-500/30 italic'>— but we hold the tension</span>
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
        className={`flex items-center justify-between px-8 lg:px-16 transition-all duration-500 ease-out ${hovered ? 'py-8 bg-primary-500' : 'py-6 bg-white'}`}
      >
        <div className='flex items-center gap-6 lg:gap-10 min-w-0'>
          <span
            className={`font-playfair text-sm font-bold tabular-nums transition-colors duration-500 shrink-0 ${hovered ? 'text-white/30' : 'text-primary-500/20'}`}
          >
            {num}
          </span>
          <div className='min-w-0'>
            <p
              className={`font-playfair text-2xl lg:text-4xl font-bold leading-none transition-colors duration-500 ${hovered ? 'text-white' : 'text-primary-500'}`}
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
          className={`w-6 h-6 shrink-0 transition-all duration-500 ${hovered ? 'text-brand-coral translate-x-2' : 'text-primary-500/20 translate-x-0'}`}
          aria-hidden='true'
        >
          <path d='M5 12h14M12 5l7 7-7 7' />
        </svg>
      </div>
    </Link>
  );
}

// ── Static data ───────────────────────────────────────────────────────────────

const tensions: TensionData[] = [
  {
    left: 'Growth',
    right: 'Impact',
    leftDesc:
      'Scaling fast reaches more users, funds the mission, and builds an unassailable market position.',
    rightDesc:
      'Every new city we enter must have a real food waste problem we can measurably reduce. Not just a market we can monetise.',
    navigation:
      'We expand only where food waste density and partner willingness are both high. Revenue follows rescued bags — not the reverse.',
    lean: 'right',
  },
  {
    left: 'Speed',
    right: 'Care',
    leftDesc:
      'Moving fast means more restaurants onboarded, more bags listed, more families saving — sooner.',
    rightDesc:
      'A rushed partner makes bad bags. A bad bag kills trust. Lost trust cannot be recovered with a discount code.',
    navigation:
      'We onboard every partner manually for the first 30 days. It costs us throughput. It earns us permanence.',
    lean: 'right',
  },
  {
    left: 'Profitability',
    right: 'Accessibility',
    leftDesc: 'Higher fees and premium pricing make the business sustainable and investor-ready.',
    rightDesc:
      'Food savings must reach the families who need them most — not just consumers who can afford "conscious choices."',
    navigation:
      'We cap platform take-rates. We do not let pricing drift to where rescue stops being real savings for real people.',
    lean: 'right',
  },
];

const scoreMetrics = [
  { value: 12400, suffix: '+', label: 'Bags Saved', sublabel: 'Food rescued from the bin' },
  {
    value: 186000,
    suffix: '+',
    prefix: '',
    label: 'TND Kept in Pockets',
    sublabel: 'Real savings for real families',
  },
  { value: 31000, suffix: ' kg', label: 'CO₂ Not Released', sublabel: 'Methane we never produced' },
  { value: 8700, suffix: '+', label: 'Families Fed', sublabel: 'Meals that had a second life' },
  {
    value: 94,
    suffix: '%',
    label: 'Partner Retention',
    sublabel: 'Restaurants that stayed with us',
  },
  { value: 3, suffix: ' cities', label: 'Markets Active', sublabel: 'With a real waiting list' },
];

const forUs = [
  'The family who wants good food and feels good saving money doing it',
  'The bakery owner who hates watching his craft go in the bin at midnight',
  'The student who stretches a tight budget without compromising on eating well',
  'The restaurant manager who wants a zero-waste day to actually be possible',
  'The investor who measures success in lives changed, not just multiples',
  'The city that wants to halve its food waste in five years',
];

const notForUs = [
  'Businesses that see surplus food as a PR opportunity, not a real problem to solve',
  "Consumers who want the cheapest food with no curiosity about why it's cheap",
  'Partners who want to dump low-quality stock under the cover of "sustainability"',
  'Investors whose exit timeline is shorter than the time it takes to change a habit',
  'Institutions that need the optics of ESG without the operational commitment',
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MissionDrivenPage() {
  const scoreRef = useRef<HTMLDivElement>(null);
  const [scoreStarted, setScoreStarted] = useState(false);

  useEffect(() => {
    if (!scoreRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setScoreStarted(true);
      },
      { threshold: 0.3 },
    );
    observer.observe(scoreRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <Header />

      <main className='min-h-screen bg-white text-primary-500'>
        {/* ── MANIFESTO HERO ───────────────────────────────────────────────── */}
        <section className='bg-primary-500 relative overflow-hidden min-h-[85vh] flex flex-col justify-center'>
          {/* Subtle noise texture via radial layers */}
          <div
            className='absolute inset-0 pointer-events-none'
            aria-hidden='true'
            style={{
              background:
                'radial-gradient(ellipse at 20% 50%, rgba(255,121,115,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(255,160,0,0.05) 0%, transparent 45%)',
            }}
          />
          {/* Ghost text */}
          <p
            className='absolute bottom-0 right-0 text-[clamp(80px,14vw,180px)] font-black text-white/[0.03] select-none pointer-events-none leading-none tracking-tight whitespace-nowrap'
            aria-hidden='true'
          >
            TOO FRESH TO WASTE
          </p>

          <div className='relative mx-auto max-w-5xl px-6 lg:px-8 py-20 lg:py-32'>
            {/* Eyebrow */}
            <div className='flex items-center gap-3 mb-10'>
              <div className='h-px w-12 bg-brand-coral' aria-hidden='true' />
              <span className='text-brand-coral text-xs font-black uppercase tracking-[0.35em]'>
                Mission Driven
              </span>
            </div>

            {/* Main headline — stacked for maximum typographic impact */}
            <h1 className='font-playfair font-bold text-white leading-[0.95] mb-0'>
              <span className='block text-[clamp(42px,8vw,96px)]'>We did not</span>
              <span className='block text-[clamp(42px,8vw,96px)] text-brand-coral italic'>
                start a business.
              </span>
              <span className='block text-[clamp(42px,8vw,96px)] mt-2'>We declared</span>
              <span className='block text-[clamp(42px,8vw,96px)] text-brand-coral italic'>
                war on waste.
              </span>
            </h1>

            <div className='mt-10 max-w-2xl'>
              <p className='text-white/60 text-base lg:text-xl leading-relaxed'>
                Every night across Tunisia, food worth thousands of dinars is destroyed. Not because
                no one is hungry. Because no bridge exists between the two. We built the bridge.
              </p>
            </div>

            {/* Scroll cue */}
            <div className='mt-14 flex items-center gap-3'>
              <div className='h-px w-8 bg-white/20' aria-hidden='true' />
              <p className='text-white/25 text-xs uppercase tracking-widest'>Read the manifesto</p>
            </div>
          </div>
        </section>

        {/* ── THE ORIGIN ───────────────────────────────────────────────────── */}
        <section className='bg-white py-20 lg:py-28'>
          <div className='mx-auto max-w-4xl px-6 lg:px-8'>
            <p className='text-xs font-black uppercase tracking-[0.3em] text-brand-coral mb-8'>
              Where this started
            </p>

            <div className='space-y-6 text-primary-500'>
              <p className='font-playfair text-2xl lg:text-3xl font-bold leading-snug'>
                It was 10:47 pm in Tunis. A bakery was closing. The owner loaded unsold bread into a
                black bin bag and set it by the door.
              </p>

              <p className='text-base lg:text-lg text-primary-500/65 leading-relaxed'>
                Two streets over, a family was calculating whether they could afford tomorrow's
                breakfast. The same city. The same night. No connection between them.
              </p>

              <p className='text-base lg:text-lg text-primary-500/65 leading-relaxed'>
                That image did not leave us. Because it was not a coincidence — it was a system
                failure happening thousands of times a day, in every Tunisian city, in every country
                on earth. One third of all food produced globally is wasted. Not because the world
                lacks hunger. Because it lacks infrastructure.
              </p>

              <p className='text-base lg:text-lg text-primary-500/65 leading-relaxed'>
                We are that infrastructure. Built in Tunisia first, because that is where we are
                from, where we know the streets, where we know the bakery owners by name. The
                mission starts here — and it does not stop until the problem does.
              </p>
            </div>

            {/* Pull quote */}
            <div className='mt-12 border-l-4 border-brand-coral pl-7'>
              <p className='font-playfair text-xl lg:text-2xl font-bold text-primary-500 italic leading-snug'>
                &ldquo;We are not solving a business problem. We are solving a civilisational one —
                one bag at a time.&rdquo;
              </p>
            </div>
          </div>
        </section>

        {/* ── WHAT MISSION-DRIVEN MEANS HERE ───────────────────────────────── */}
        <section className='bg-cream py-16 lg:py-24'>
          <div className='mx-auto max-w-7xl px-6 lg:px-8'>
            <div className='grid lg:grid-cols-[1fr_1.6fr] gap-10 lg:gap-16 items-start'>
              <div className='lg:sticky lg:top-24'>
                <p className='text-xs font-black uppercase tracking-[0.3em] text-brand-coral mb-5'>
                  What we actually mean
                </p>
                <h2 className='font-playfair text-3xl lg:text-4xl xl:text-5xl font-bold text-primary-500 leading-tight'>
                  &ldquo;Mission-driven&rdquo; is a claim.
                  <br />
                  <span className='text-brand-coral italic'>Here is the proof.</span>
                </h2>
                <p className='text-primary-500/55 text-base mt-5 leading-relaxed'>
                  Every company says they have values. We decided to make ours mechanically visible
                  — decisions you can point to, constraints we operate under, numbers we publish.
                </p>
              </div>

              <div className='space-y-4'>
                {[
                  {
                    n: '01',
                    title: 'The 5% pledge is structural, not symbolic.',
                    body: '5% of every transaction goes to food security programmes — meal funds for families, school meal initiatives, and community food banks. It is written into how the fee model works, not added as a donation layer on top. You cannot remove it without breaking the product.',
                  },
                  {
                    n: '02',
                    title: 'We have walked away from revenue.',
                    body: 'We have declined partnerships with establishments that wanted to use the platform to move low-quality stock at scale. The bags we list must be genuinely good food rescued — not a clearance channel. That decision cost us growth. We made it anyway.',
                  },
                  {
                    n: '03',
                    title: 'Impact targets gate expansion targets.',
                    body: 'Before we open a new city, we set a minimum bags-per-week threshold the existing cities must maintain. We do not expand by diluting what works. Our roadmap is gated by verified impact, not by investor timelines.',
                  },
                  {
                    n: '04',
                    title: 'Our pricing is pegged to real savings.',
                    body: 'We run an internal rule: the consumer must save a minimum of 50% compared to buying the same food at standard price. If a partner raises prices in a way that breaks this rule, they are removed from the platform. Market forces do not override mission logic here.',
                  },
                  {
                    n: '05',
                    title: 'We publish what we do not know yet.',
                    body: 'Our CO₂ figures are estimates based on industry averages. Our family impact numbers are proxies. We say this clearly. We believe that honest approximations, labelled as such, are more valuable than precise-sounding fiction.',
                  },
                ].map(item => (
                  <div
                    key={item.n}
                    className='bg-white rounded-3xl p-7 border border-primary-500/8 hover:border-primary-500/20 hover:shadow-md transition-all duration-300'
                  >
                    <div className='flex items-start gap-5'>
                      <span className='font-playfair text-2xl font-bold text-primary-500/15 shrink-0 leading-none mt-0.5'>
                        {item.n}
                      </span>
                      <div>
                        <h3 className='font-bold text-base text-primary-500 mb-2 leading-snug'>
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
        <section className='bg-white py-16 lg:py-24'>
          <div className='mx-auto max-w-7xl px-6 lg:px-8'>
            <div className='text-center mb-5'>
              <p className='text-xs font-black uppercase tracking-[0.3em] text-brand-coral mb-4'>
                Radical honesty
              </p>
              <h2 className='font-playfair text-3xl lg:text-5xl font-bold text-primary-500 leading-tight mb-4'>
                The tensions we live with.
                <br />
                <span className='text-brand-coral italic'>Every single day.</span>
              </h2>
              <p className='text-primary-500/50 text-base max-w-xl mx-auto leading-relaxed'>
                Click either side to see what pulling that way looks like. Then see how we navigate
                the tension.
              </p>
            </div>

            {/* Instruction hint */}
            <div className='flex justify-center mb-8'>
              <div className='inline-flex items-center gap-2 bg-cream border border-primary-500/10 rounded-full px-4 py-2'>
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
                  Interactive — tap a side
                </span>
              </div>
            </div>

            <div className='grid md:grid-cols-3 gap-5 lg:gap-6'>
              {tensions.map((t, i) => (
                <TensionCard key={i} data={t} />
              ))}
            </div>
          </div>
        </section>

        {/* ── WHO WE'RE FOR / NOT FOR ───────────────────────────────────────── */}
        <section className='bg-cream py-16 lg:py-24 relative overflow-hidden'>
          <div className='mx-auto max-w-7xl px-6 lg:px-8'>
            <div className='text-center mb-14'>
              <p className='text-xs font-black uppercase tracking-[0.3em] text-brand-coral mb-4'>
                Clarity over mass appeal
              </p>
              <h2 className='font-playfair text-3xl lg:text-5xl font-bold text-primary-500 leading-tight'>
                We draw a line.
              </h2>
            </div>

            <div className='grid lg:grid-cols-2 gap-5 lg:gap-6'>
              {/* Built for */}
              <div className='bg-primary-500 rounded-3xl p-8 lg:p-10'>
                <div className='flex items-center gap-3 mb-7'>
                  <div className='w-3 h-3 rounded-full bg-brand-coral' aria-hidden='true' />
                  <p className='text-brand-coral text-xs font-black uppercase tracking-[0.3em]'>
                    Built for
                  </p>
                </div>
                <ul className='space-y-4'>
                  {forUs.map((item, i) => (
                    <li key={i} className='flex items-start gap-3'>
                      <svg
                        viewBox='0 0 20 20'
                        fill='currentColor'
                        className='w-4 h-4 text-brand-coral shrink-0 mt-0.5'
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
              <div className='bg-white rounded-3xl p-8 lg:p-10 border-2 border-primary-500/8'>
                <div className='flex items-center gap-3 mb-7'>
                  <div className='w-3 h-3 rounded-full bg-primary-500/20' aria-hidden='true' />
                  <p className='text-primary-500/40 text-xs font-black uppercase tracking-[0.3em]'>
                    Not for
                  </p>
                </div>
                <ul className='space-y-4'>
                  {notForUs.map((item, i) => (
                    <li key={i} className='flex items-start gap-3'>
                      <svg
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth={2}
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        className='w-4 h-4 text-primary-500/25 shrink-0 mt-0.5'
                        aria-hidden='true'
                      >
                        <line x1='18' y1='6' x2='6' y2='18' />
                        <line x1='6' y1='6' x2='18' y2='18' />
                      </svg>
                      <p className='text-sm text-primary-500/50 leading-snug'>{item}</p>
                    </li>
                  ))}
                </ul>

                <div className='mt-8 pt-6 border-t border-primary-500/8'>
                  <p className='text-xs text-primary-500/35 italic leading-relaxed'>
                    This is not a rejection. It is honesty. We believe the most respectful thing a
                    brand can do is tell you clearly who it is — so you can decide if you belong.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── THE SCORECARD ────────────────────────────────────────────────── */}
        <section className='bg-primary-500 py-16 lg:py-24 relative overflow-hidden' ref={scoreRef}>
          {/* Top wave */}
          <div className='absolute top-0 left-0 right-0' aria-hidden='true'>
            <svg
              viewBox='0 0 1440 72'
              xmlns='http://www.w3.org/2000/svg'
              className='block w-full'
              preserveAspectRatio='none'
            >
              <path d='M0,32 C360,0 1080,64 1440,32 L1440,0 L0,0 Z' fill='#f9f3f0' />
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
              <path d='M0,40 C360,72 1080,8 1440,40 L1440,72 L0,72 Z' fill='white' />
            </svg>
          </div>

          <div className='relative mx-auto max-w-7xl px-6 lg:px-8 pt-10 pb-8'>
            <div className='text-center mb-12'>
              <p className='text-xs font-black uppercase tracking-[0.3em] text-brand-coral mb-4'>
                The real metrics
              </p>
              <h2 className='font-playfair text-3xl lg:text-5xl font-bold text-white mb-3'>
                Judge us by these.
              </h2>
              <p className='text-white/40 text-base'>
                Not by our fundraising round. Not by our valuation. By this.
              </p>
            </div>

            <div className='grid grid-cols-2 md:grid-cols-3 gap-8 lg:gap-12 pt-4'>
              {scoreMetrics.map((m, i) => (
                <ScoreCard key={i} {...m} started={scoreStarted} />
              ))}
            </div>

            <p className='text-center text-white/20 text-xs mt-12 italic'>
              Numbers updated monthly. Methodology published on request.
            </p>
          </div>
        </section>

        {/* ── THE INVITATION — doors ────────────────────────────────────────── */}
        <section className='bg-white py-16 lg:py-20'>
          <div className='mx-auto max-w-5xl px-6 lg:px-8 mb-12 text-center'>
            <p className='text-xs font-black uppercase tracking-[0.3em] text-brand-coral mb-4'>
              If this page felt like your own thoughts
            </p>
            <h2 className='font-playfair text-3xl lg:text-5xl font-bold text-primary-500 leading-tight'>
              There is a door here for you.
            </h2>
          </div>

          <div className='border-t border-primary-500/10'>
            <Door
              href='/careers'
              label='Join the team.'
              tagline='Four seats open. We are looking for the ones who are restless about this.'
              index={0}
            />
            <Door
              href='/esg'
              label='Partner on ESG.'
              tagline='Your company needs measurable impact. We have it — with the data to prove it.'
              index={1}
            />
            <Door
              href='/consumer'
              label='Start rescuing food.'
              tagline='Download the app. Your first bag is waiting two streets away.'
              index={2}
            />
          </div>

          {/* Final line */}
          <div className='mx-auto max-w-5xl px-6 lg:px-8 pt-14 text-center'>
            <p className='font-playfair text-lg lg:text-2xl text-primary-500/30 italic'>
              &ldquo;The planet does not need more companies that care about waste in their brand
              deck. It needs ones that care about it in their spreadsheets.&rdquo;
            </p>
            <p className='text-brand-coral text-xs font-black uppercase tracking-widest mt-4'>
              — Too Fresh To Waste
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
