'use client';

import { useTranslations } from 'next-intl';
import { RolloutMap } from '@/components/sections';
import { Link } from '@/i18n/routing';
import { usePublicImpact } from '@/hooks/use-public';
import { useFormat } from '@/lib/use-format';

/** The three numbers that make the ambition concrete rather than rhetorical. */
const PROOF = ['bags', 'meals', 'carbon'] as const;

/** Who wins, in the order a sceptical reader asks about them. */
const WINNERS = ['merchant', 'customer', 'planet', 'neighbour'] as const;

function ProofRow() {
  const fmt = useFormat();
  const t = useTranslations('dream');
  const { data } = usePublicImpact();

  const value = (key: (typeof PROOF)[number]): string => {
    if (!data) return '-';
    if (key === 'bags') return fmt.count(data.bagsRescued);
    if (key === 'meals') return fmt.count(data.mealsRescued);
    return `${fmt.count(data.carbonAvoidedKg)} kg`;
  };

  return (
    <dl className='grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3'>
      {PROOF.map((key, i) => (
        <div key={key} className={`bg-primary-500 dream-rise d${i + 1} flex flex-col gap-sm p-2xl`}>
          <dd
            className='font-heading text-3xl leading-none text-white tabular-nums md:text-4xl'
            dir='ltr'
          >
            {value(key)}
          </dd>
          <dt className='text-sm text-white/75'>{t(`proof.${key}`)}</dt>
        </div>
      ))}
    </dl>
  );
}

export default function DreamClient() {
  const t = useTranslations('dream');

  return (
    <main role='main' className='bg-primary-500'>
      {/* ── Thesis ───────────────────────────────────────────── */}
      <section
        className='relative overflow-hidden px-lg py-5xl md:py-28'
        aria-labelledby='dream-heading'
      >
        <div className='relative mx-auto flex max-w-4xl flex-col items-center gap-3xl text-center'>
          <p className='dream-rise text-[11px] font-medium tracking-[0.28em] text-white/75 uppercase'>
            {t('eyebrow')}
          </p>

          <h1
            id='dream-heading'
            className='dream-rise d1 font-heading text-white'
            style={{
              fontSize: 'clamp(2.4rem, 7vw, 5rem)',
              lineHeight: 1.02,
              letterSpacing: '-0.035em',
              textWrap: 'balance',
            }}
          >
            {t('headlineLead')} <span className='text-secondary'>{t('headlineAccent')}</span>
          </h1>

          <p className='dream-rise d2 max-w-2xl text-base leading-relaxed text-white/75 md:text-lg'>
            {t('standfirst')}
          </p>

          <div className='dream-rise d3 flex flex-col gap-md sm:flex-row'>
            <Link
              href='/merchant-signup'
              className='bg-secondary text-secondary-foreground rounded-full px-4xl py-3.5 text-sm font-bold whitespace-nowrap transition-transform duration-200 hover:scale-105 md:text-base'
            >
              {t('cta.primary')}
            </Link>
            <a
              href='#rollout'
              className='hover:text-primary-500 rounded-full border border-white/30 px-4xl py-3.5 text-sm font-bold whitespace-nowrap text-white transition-all duration-200 hover:bg-white md:text-base'
            >
              {t('cta.secondary')}
            </a>
          </div>
        </div>
      </section>

      {/* ── The problem, stated once, plainly ────────────────── */}
      <section
        className='border-t border-white/10 px-lg py-4xl md:py-6xl'
        aria-labelledby='dream-problem'
      >
        <div className='mx-auto grid max-w-6xl gap-6xl lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-4xl'>
          <div className='flex flex-col gap-xl'>
            <p className='text-[11px] font-medium tracking-[0.22em] text-white/75 uppercase'>
              {t('problem.eyebrow')}
            </p>
            <h2
              id='dream-problem'
              className='font-heading max-w-[14ch] text-3xl leading-[1.06] text-white md:text-4xl'
            >
              {t('problem.title')}
            </h2>
          </div>

          <div className='flex flex-col gap-xl'>
            <p className='text-base leading-relaxed text-white/75'>{t('problem.body1')}</p>
            <p className='text-base leading-relaxed text-white/75'>{t('problem.body2')}</p>
            <blockquote className='border-secondary text-secondary border-s-2 ps-xl text-lg leading-relaxed font-medium italic'>
              {t('problem.pullquote')}
            </blockquote>
          </div>
        </div>
      </section>

      {/* ── Everybody wins, and how ──────────────────────────── */}
      <section
        className='border-t border-white/10 px-lg py-4xl md:py-6xl'
        aria-labelledby='dream-wins'
      >
        <div className='mx-auto flex max-w-6xl flex-col gap-6xl'>
          <div className='flex flex-col gap-lg'>
            <p className='text-[11px] font-medium tracking-[0.22em] text-white/75 uppercase'>
              {t('wins.eyebrow')}
            </p>
            <h2
              id='dream-wins'
              className='font-heading max-w-[20ch] text-3xl leading-[1.06] text-white md:text-4xl'
            >
              {t('wins.title')}
            </h2>
          </div>

          <div className='grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4'>
            {WINNERS.map(key => (
              <article key={key} className='bg-primary-500 flex flex-col gap-md p-2xl'>
                <h3 className='font-heading text-lg text-white'>{t(`wins.${key}.who`)}</h3>
                <p className='text-sm leading-relaxed text-white/75'>{t(`wins.${key}.what`)}</p>
              </article>
            ))}
          </div>

          <ProofRow />
          <p className='text-xs text-white/75'>{t('proof.note')}</p>
        </div>
      </section>

      {/* ── Where we are, and who decides what comes next ────── */}
      <RolloutMap />

      {/* ── Close ────────────────────────────────────────────── */}
      <section className='border-t border-white/10 px-lg py-5xl md:py-28'>
        <div className='mx-auto flex max-w-3xl flex-col items-center gap-3xl text-center'>
          <h2 className='font-heading text-3xl leading-[1.06] text-white md:text-5xl'>
            {t('close.title')}
          </h2>
          <p className='max-w-xl text-base leading-relaxed text-white/70'>{t('close.body')}</p>
          <Link
            href='/merchant-signup'
            className='bg-secondary text-secondary-foreground rounded-full px-4xl py-3.5 text-sm font-bold whitespace-nowrap transition-transform duration-200 hover:scale-105 md:text-base'
          >
            {t('close.cta')}
          </Link>
        </div>
      </section>
    </main>
  );
}
