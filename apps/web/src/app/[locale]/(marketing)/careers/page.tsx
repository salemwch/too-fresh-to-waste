'use client';

import { useState } from 'react';
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

const expansionStages = [
  {
    flag: '🇹🇳',
    region: 'Tunisia',
    subtitle: 'Where it all begins',
    desc: 'We are launching in the heart of North Africa - connecting local restaurants and bakeries with consumers who care about their wallet and their planet.',
    color: 'bg-primary-500',
    textColor: 'text-primary-500',
    borderColor: 'border-primary-500',
    active: true,
  },
  {
    flag: '🌍',
    region: 'Gulf Cooperation Council',
    subtitle: 'Saudi Arabia · UAE · Qatar · Kuwait · Oman · Bahrain',
    desc: 'Six nations with booming food scenes and a growing appetite for sustainability. The GCC is our second home - high impact, massive scale.',
    color: 'bg-secondary-dark',
    textColor: 'text-secondary-dark',
    borderColor: 'border-secondary-dark',
    active: false,
  },
  {
    flag: '🌍',
    region: 'Africa',
    subtitle: 'The continent of the future',
    desc: 'From Morocco to Egypt, Senegal to Kenya - a billion people, thousands of local food businesses, and enormous potential to change how a continent eats.',
    color: 'bg-brand-coral',
    textColor: 'text-brand-coral',
    borderColor: 'border-brand-coral',
    active: false,
  },
  {
    flag: '🌏',
    region: 'Asia',
    subtitle: "The world's largest opportunity",
    desc: 'Home to more than half of humanity. Cities that never sleep, food cultures that run deep - and a food waste crisis that demands bold solutions.',
    color: 'bg-primary-500/80',
    textColor: 'text-primary-500',
    borderColor: 'border-primary-500/60',
    active: false,
  },
];

const positions = [
  {
    id: 'backend-dev',
    gender: 'Male',
    role: 'Backend Developer',
    tagline: 'The architect of the engine that feeds thousands.',
    Icon: CodeIcon,
    accentBg: 'bg-primary-500/10',
    accentText: 'text-primary-500',
    accentBorder: 'border-primary-500/20',
    badgeBg: 'bg-primary-500',
    skills: [
      'NestJS / Node.js',
      'MongoDB & Redis',
      'REST APIs & WebSockets',
      'Authentication & Security',
    ],
    description:
      'You will build the backbone of a platform that feeds families and fights waste at scale. Every endpoint you write powers a real meal rescued from the bin. We run NestJS, MongoDB, Redis, and Bull queues - and we move fast.',
    dream:
      'You dream in APIs and wake up thinking about performance. Bugs make you curious, not scared.',
  },
  {
    id: 'marketing-male',
    gender: 'Male',
    role: 'Growth & Marketing',
    tagline: 'The voice that turns strangers into believers.',
    Icon: MegaphoneIcon,
    accentBg: 'bg-secondary-dark/10',
    accentText: 'text-secondary-dark',
    accentBorder: 'border-secondary-dark/20',
    badgeBg: 'bg-secondary-dark',
    skills: [
      'Social Media & Content',
      'Performance Marketing',
      'Community Building',
      'Data & Analytics',
    ],
    description:
      'You will craft the story of Too Fresh To Waste - the campaigns, the content, the message that makes people stop scrolling and start caring. You measure everything and optimize relentlessly.',
    dream:
      'You believe that a great message can change behavior. You want your work to mean something beyond a KPI.',
  },
  {
    id: 'marketing-female',
    gender: 'Female',
    role: 'Brand & Community',
    tagline: 'The human connection behind every download.',
    Icon: HeartIcon,
    accentBg: 'bg-brand-coral/10',
    accentText: 'text-brand-coral',
    accentBorder: 'border-brand-coral/20',
    badgeBg: 'bg-brand-coral',
    skills: [
      'Brand Identity & Storytelling',
      'Influencer & Partnership',
      'Email & CRM Campaigns',
      'User Research',
    ],
    description:
      'You will be the soul of our brand - building trust with consumers, nurturing our community, and ensuring every touchpoint feels warm, real, and human. You turn users into ambassadors.',
    dream:
      'You find meaning in connection. You believe brands should stand for something, not just sell something.',
  },
  {
    id: 'frontend-dev',
    gender: 'Female',
    role: 'Frontend Developer - Mobile & Web',
    tagline: 'The designer of the world people actually see.',
    Icon: LayoutIcon,
    accentBg: 'bg-primary-500/10',
    accentText: 'text-primary-500',
    accentBorder: 'border-primary-500/20',
    badgeBg: 'bg-primary-500',
    skills: [
      'React Native (iOS & Android)',
      'Next.js & React',
      'Tailwind CSS & Design Systems',
      'Performance & Animations',
    ],
    description:
      'You will build the app that people open every day to rescue food, earn points, and make an impact. The UI is your canvas - beautiful, fast, accessible, and alive. You own the experience from pixel to production.',
    dream:
      'You obsess over details others miss. You believe that great software makes people feel something - not just click somewhere.',
  },
];

// ── Application Form Component ────────────────────────────────────────────────

function ApplicationForm() {
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
      <div className='flex flex-col items-center justify-center py-16 gap-5 text-center'>
        <div className='w-20 h-20 rounded-full bg-primary-500/10 flex items-center justify-center'>
          <CheckCircleIcon className='w-10 h-10 text-primary-500' />
        </div>
        <h3 className='font-heading text-3xl font-bold text-primary-500'>Application received.</h3>
        <p className='text-primary-500/60 text-base max-w-md leading-relaxed'>
          Thank you for believing in our mission. We read every single application personally. If
          your vision aligns with ours, we will be in touch soon.
        </p>
        <p className='text-brand-coral font-bold text-sm'>- The Too Fresh To Waste Team</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-6' noValidate>
      <div className='grid sm:grid-cols-2 gap-5'>
        {/* Full Name */}
        <div className='flex flex-col gap-1.5'>
          <label
            htmlFor='name'
            className='text-xs font-bold uppercase tracking-widest text-primary-500/60'
          >
            Full Name <span className='text-brand-coral'>*</span>
          </label>
          <input
            id='name'
            name='name'
            type='text'
            required
            value={formData.name}
            onChange={handleChange}
            placeholder='Your full name'
            className='w-full bg-cream border border-primary-500/15 rounded-xl px-4 py-3 text-sm text-primary-500 placeholder:text-primary-500/35 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/40 transition-all'
          />
        </div>

        {/* Email */}
        <div className='flex flex-col gap-1.5'>
          <label
            htmlFor='email'
            className='text-xs font-bold uppercase tracking-widest text-primary-500/60'
          >
            Email Address <span className='text-brand-coral'>*</span>
          </label>
          <input
            id='email'
            name='email'
            type='email'
            required
            value={formData.email}
            onChange={handleChange}
            placeholder='you@example.com'
            className='w-full bg-cream border border-primary-500/15 rounded-xl px-4 py-3 text-sm text-primary-500 placeholder:text-primary-500/35 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/40 transition-all'
          />
        </div>
      </div>

      <div className='grid sm:grid-cols-2 gap-5'>
        {/* Phone */}
        <div className='flex flex-col gap-1.5'>
          <label
            htmlFor='phone'
            className='text-xs font-bold uppercase tracking-widest text-primary-500/60'
          >
            Phone Number <span className='text-brand-coral'>*</span>
          </label>
          <input
            id='phone'
            name='phone'
            type='tel'
            required
            value={formData.phone}
            onChange={handleChange}
            placeholder='+216 XX XXX XXX'
            className='w-full bg-cream border border-primary-500/15 rounded-xl px-4 py-3 text-sm text-primary-500 placeholder:text-primary-500/35 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/40 transition-all'
          />
        </div>

        {/* Position */}
        <div className='flex flex-col gap-1.5'>
          <label
            htmlFor='position'
            className='text-xs font-bold uppercase tracking-widest text-primary-500/60'
          >
            Position Applying For <span className='text-brand-coral'>*</span>
          </label>
          <select
            id='position'
            name='position'
            required
            value={formData.position}
            onChange={handleChange}
            className='w-full bg-cream border border-primary-500/15 rounded-xl px-4 py-3 text-sm text-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/40 transition-all appearance-none cursor-pointer'
          >
            <option value='' disabled>
              Select a position…
            </option>
            <option value='backend-dev'>Backend Developer (Male)</option>
            <option value='marketing-male'>Growth & Marketing (Male)</option>
            <option value='marketing-female'>Brand & Community (Female)</option>
            <option value='frontend-dev'>Frontend Developer - Mobile & Web (Female)</option>
          </select>
        </div>
      </div>

      {/* Motivation Letter */}
      <div className='flex flex-col gap-1.5'>
        <label
          htmlFor='letter'
          className='text-xs font-bold uppercase tracking-widest text-primary-500/60'
        >
          Your Story - How Will You Help Us Change the World?{' '}
          <span className='text-brand-coral'>*</span>
        </label>
        <textarea
          id='letter'
          name='letter'
          required
          rows={7}
          value={formData.letter}
          onChange={handleChange}
          placeholder='Tell us who you are, what drives you, and what you would bring to Too Fresh To Waste. This is not a cover letter - it is your chance to speak to us as a human being. What change do you want to see? Why does this mission matter to you personally? What will you add that no one else can?'
          className='w-full bg-cream border border-primary-500/15 rounded-xl px-4 py-3 text-sm text-primary-500 placeholder:text-primary-500/35 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/40 transition-all resize-none leading-relaxed'
        />
        <p className='text-xs text-primary-500/40'>
          Minimum 100 words. Be authentic - we value honesty over polish.
        </p>
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
        className='w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-primary-500 text-white font-black text-sm px-10 py-4 rounded-full hover:bg-primary-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl'
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
            Send My Application
            <ArrowRightIcon className='w-4 h-4' />
          </>
        )}
      </button>
    </form>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CareersPage() {
  return (
    <>
      <Header />

      <main className='min-h-screen bg-white text-primary-500'>
        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <section className='bg-primary-500 relative overflow-hidden'>
          {/* Decorative glows */}

          {/* Floating decorative numbers */}
          <div
            className='absolute top-20 left-[5%] text-[120px] font-black text-white/[0.03] select-none pointer-events-none leading-none'
            aria-hidden='true'
          >
            01
          </div>
          <div
            className='absolute bottom-10 right-[4%] text-[180px] font-black text-white/[0.03] select-none pointer-events-none leading-none'
            aria-hidden='true'
          >
            ∞
          </div>

          <div className='relative mx-auto max-w-5xl px-6 lg:px-8 pt-16 pb-0 lg:pt-24 text-center'>
            {/* Eyebrow */}
            <div className='inline-flex items-center gap-2 bg-brand-coral/20 border border-brand-coral/40 text-brand-coral text-xs font-black uppercase tracking-[0.3em] px-4 py-2 rounded-full mb-8'>
              <RocketIcon className='w-3.5 h-3.5' />
              We are hiring
            </div>

            <h1 className='font-heading text-4xl sm:text-5xl lg:text-7xl font-bold text-white leading-tight mb-6'>
              We are not just building <span className='text-brand-coral italic'>a startup.</span>
              <br />
              We are building <span className='text-brand-coral italic'>a movement.</span>
            </h1>

            <p className='text-white/70 text-base lg:text-xl leading-relaxed max-w-3xl mx-auto mb-10'>
              Every night, tons of food that could feed entire families is thrown away - not because
              there is no hunger, but because there is no bridge. We are building that bridge. And
              we need the ones who refuse to watch the world waste its potential.
            </p>

            {/* Stats row */}
            <div className='flex flex-wrap justify-center gap-8 lg:gap-16 pb-16'>
              {[
                { stat: '4', label: 'Open positions' },
                { stat: '1.3B', label: 'Tonnes wasted/year' },
                { stat: '4+', label: 'Regions in our vision' },
                { stat: '∞', label: 'Impact if we win' },
              ].map((item, i) => (
                <div key={i} className='text-center'>
                  <p className='font-heading text-3xl lg:text-4xl font-bold text-white'>
                    {item.stat}
                  </p>
                  <p className='text-white/45 text-xs uppercase tracking-widest mt-1'>
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
        <section className='bg-white py-16 lg:py-24'>
          <div className='mx-auto max-w-4xl px-6 lg:px-8 text-center'>
            <p className='text-xs font-bold uppercase tracking-[0.3em] text-brand-coral mb-6'>
              Our reason for existing
            </p>
            <blockquote className='font-heading text-3xl lg:text-5xl font-bold text-primary-500 leading-tight mb-8'>
              &ldquo;A planet where no family goes to sleep hungry. Where no child grows up without
              an education. Where food feeds people, not landfills.&rdquo;
            </blockquote>
            <p className='text-primary-500/60 text-base lg:text-lg leading-relaxed max-w-2xl mx-auto'>
              This is not a pitch deck quote. This is the reason we wake up. And if this sentence
              stirs something in you - something between urgency and hope - then you might already
              belong here.
            </p>
          </div>
        </section>

        {/* ── VISION & EXPANSION ───────────────────────────────────────────── */}
        <section className='bg-cream py-16 lg:py-24 relative overflow-hidden'>
          <div className='relative mx-auto max-w-7xl px-6 lg:px-8'>
            <div className='text-center mb-14'>
              <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-coral mb-3'>
                Where we are going
              </p>
              <h2 className='font-heading text-4xl lg:text-5xl font-bold text-primary-500'>
                Tunisia is <span className='text-brand-coral italic'>chapter one.</span>
              </h2>
              <p className='text-primary-500/55 text-base lg:text-lg mt-4 max-w-2xl mx-auto leading-relaxed'>
                We are writing a story that starts in Tunis and ends on every continent. Here is the
                roadmap.
              </p>
            </div>

            {/* Expansion timeline */}
            <div className='relative'>
              {/* Connecting line (desktop) */}
              <div
                className='hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-px bg-primary-500/10'
                aria-hidden='true'
              />

              <div className='grid sm:grid-cols-2 lg:grid-cols-4 gap-6'>
                {expansionStages.map((stage, i) => (
                  <div key={i} className='relative'>
                    {/* Step dot */}
                    <div
                      className='hidden lg:flex absolute -top-[3px] left-1/2 -translate-x-1/2 w-6 h-6 rounded-full border-2 border-white items-center justify-center shadow-md z-10'
                      style={{ backgroundColor: stage.active ? '#005250' : '#d1d5db' }}
                      aria-hidden='true'
                    />

                    <div
                      className={`mt-0 lg:mt-10 bg-white rounded-3xl p-6 border-2 ${stage.active ? stage.borderColor + ' shadow-lg' : 'border-transparent'} transition-all hover:shadow-md`}
                    >
                      <div className='text-3xl mb-3 leading-none'>{stage.flag}</div>
                      <div className='flex items-center gap-2 mb-1'>
                        <h3 className='font-bold text-base text-primary-500 leading-tight'>
                          {stage.region}
                        </h3>
                        {stage.active && (
                          <span className='text-[9px] font-black uppercase tracking-widest bg-primary-500 text-white px-2 py-0.5 rounded-full leading-none'>
                            Now
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-xs font-bold uppercase tracking-wider ${stage.textColor} mb-3`}
                      >
                        {stage.subtitle}
                      </p>
                      <p className='text-sm text-primary-500/60 leading-relaxed'>{stage.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* GCC country flags detail */}
            <div className='mt-10 bg-white rounded-3xl p-6 lg:p-8 border border-primary-500/10'>
              <p className='text-xs font-bold uppercase tracking-widest text-primary-500/50 mb-5 text-center'>
                Gulf Cooperation Council - 6 nations, one vision
              </p>
              <div className='flex flex-wrap justify-center gap-4 lg:gap-8'>
                {[
                  { flag: '🇸🇦', name: 'Saudi Arabia' },
                  { flag: '🇦🇪', name: 'United Arab Emirates' },
                  { flag: '🇶🇦', name: 'Qatar' },
                  { flag: '🇰🇼', name: 'Kuwait' },
                  { flag: '🇴🇲', name: 'Oman' },
                  { flag: '🇧🇭', name: 'Bahrain' },
                ].map((c, i) => (
                  <div key={i} className='flex flex-col items-center gap-1.5'>
                    <span className='text-3xl leading-none'>{c.flag}</span>
                    <span className='text-xs font-bold text-primary-500/60 text-center'>
                      {c.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── WHO WE NEED ──────────────────────────────────────────────────── */}
        <section className='bg-white py-16 lg:py-24'>
          <div className='mx-auto max-w-7xl px-6 lg:px-8'>
            <div className='text-center mb-14'>
              <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-coral mb-3'>
                Open positions
              </p>
              <h2 className='font-heading text-4xl lg:text-5xl font-bold text-primary-500'>
                Four seats at the table.{' '}
                <span className='text-brand-coral italic'>One mission.</span>
              </h2>
              <p className='text-primary-500/55 text-base lg:text-lg mt-4 max-w-xl mx-auto leading-relaxed'>
                We are not hiring employees. We are looking for founders-at-heart who want to own a
                piece of something that matters.
              </p>
            </div>

            <div className='grid md:grid-cols-2 gap-6 lg:gap-8'>
              {positions.map(pos => (
                <div
                  key={pos.id}
                  className={`group relative bg-cream rounded-3xl p-7 lg:p-8 border-2 ${pos.accentBorder} hover:shadow-xl transition-all duration-300 overflow-hidden`}
                >
                  {/* Background pattern */}
                  <div
                    className='absolute -bottom-8 -right-8 w-40 h-40 rounded-full opacity-5 pointer-events-none'
                    style={{ backgroundColor: 'currentColor' }}
                    aria-hidden='true'
                  />

                  {/* Header */}
                  <div className='flex items-start justify-between mb-5'>
                    <div
                      className={`w-14 h-14 rounded-2xl ${pos.accentBg} ${pos.accentText} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
                    >
                      <pos.Icon className='w-7 h-7' />
                    </div>
                    <div className='flex flex-col items-end gap-1.5'>
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest ${pos.badgeBg} text-white px-3 py-1 rounded-full`}
                      >
                        {pos.gender}
                      </span>
                      <span className='text-[10px] font-bold uppercase tracking-widest text-primary-500/40 flex items-center gap-1'>
                        <MapPinIcon className='w-3 h-3' />
                        Remote · Tunisia
                      </span>
                    </div>
                  </div>

                  <h3 className='font-heading text-xl lg:text-2xl font-bold text-primary-500 mb-1 leading-snug'>
                    {pos.role}
                  </h3>
                  <p className={`text-sm font-bold italic ${pos.accentText} mb-4`}>{pos.tagline}</p>
                  <p className='text-sm text-primary-500/65 leading-relaxed mb-5'>
                    {pos.description}
                  </p>

                  {/* What you dream */}
                  <div
                    className={`${pos.accentBg} rounded-2xl p-4 mb-5 border ${pos.accentBorder}`}
                  >
                    <p className='text-xs font-bold uppercase tracking-wider text-primary-500/50 mb-1'>
                      You are this person if…
                    </p>
                    <p className={`text-sm font-medium ${pos.accentText} leading-relaxed`}>
                      {pos.dream}
                    </p>
                  </div>

                  {/* Skills */}
                  <div className='flex flex-wrap gap-2'>
                    {pos.skills.map((skill, si) => (
                      <span
                        key={si}
                        className='text-xs font-bold text-primary-500/70 bg-white border border-primary-500/10 px-3 py-1 rounded-full'
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  {/* Apply anchor */}
                  <a
                    href='#apply'
                    className={`mt-6 inline-flex items-center gap-2 text-sm font-black ${pos.accentText} hover:opacity-75 transition-opacity`}
                  >
                    Apply for this role
                    <ArrowRightIcon className='w-4 h-4' />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── VALUES BANNER ────────────────────────────────────────────────── */}
        <section className='bg-primary-500 py-14 lg:py-20 relative overflow-hidden'>
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

          <div className='relative mx-auto max-w-5xl px-6 lg:px-8 pt-8 text-center'>
            <GlobeIcon className='w-10 h-10 text-brand-coral mx-auto mb-6' />
            <h2 className='font-heading text-3xl lg:text-5xl font-bold text-white mb-5 leading-tight'>
              If you believe we can make a change -<br />
              <span className='text-brand-coral italic'>be part of the change.</span>
            </h2>
            <p className='text-white/65 text-base lg:text-lg leading-relaxed max-w-2xl mx-auto'>
              We are a small team with a massive vision. There is no bureaucracy, no empty titles.
              Just work that matters, people who care, and the chance to look back in ten years and
              say: <em className='text-white/80'>I helped build this.</em>
            </p>
          </div>
        </section>

        {/* ── APPLICATION FORM ─────────────────────────────────────────────── */}
        <section id='apply' className='bg-cream py-16 lg:py-24 scroll-mt-20'>
          <div className='mx-auto max-w-3xl px-6 lg:px-8'>
            <div className='text-center mb-12'>
              <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-coral mb-3'>
                Ready to join us?
              </p>
              <h2 className='font-heading text-4xl lg:text-5xl font-bold text-primary-500 mb-4'>
                Tell us your story.
              </h2>
              <p className='text-primary-500/60 text-base leading-relaxed max-w-xl mx-auto'>
                No CV required (you can attach one in your letter if you like). We care more about
                who you are, what drives you, and what you will bring to the mission.
              </p>
            </div>

            <div className='bg-white rounded-3xl p-8 lg:p-10 border border-primary-500/10 shadow-sm'>
              <ApplicationForm />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
