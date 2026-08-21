'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Radio, TrendingUp, Users } from 'lucide-react';

import { usePublicImpact, usePublicZones, useJoinWaitlist } from '@/hooks/use-public';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import type { PublicZone } from '@/types/public';

/** The countries below Tunisia. Static: intent, with no date attached. */
const DESTINATIONS = ['tunisia', 'algeria', 'morocco', 'uae', 'saudi'] as const;

/** A rescued-bag count only means something once a city has actually opened. */
const hasHistory = (zone: PublicZone) => zone.status === 'active' && zone.bagsRescued > 0;

function StatChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Radio;
  label: string;
  value: number | undefined;
}) {
  return (
    <div className='flex flex-col gap-1'>
      <span className='flex items-center gap-1.5 text-[10px] font-medium tracking-[0.16em] text-white/50 uppercase'>
        <Icon className='size-3.5 shrink-0' aria-hidden='true' />
        {label}
      </span>
      <span
        className='font-heading text-xl leading-none tabular-nums text-white md:text-2xl'
        dir='ltr'
      >
        {value === undefined ? '—' : value.toLocaleString()}
      </span>
    </div>
  );
}

function StatusPill({ status }: { status: PublicZone['status'] }) {
  const t = useTranslations('rollout');

  const tone =
    status === 'active'
      ? 'text-secondary border-secondary'
      : status === 'coming_soon'
        ? 'text-accent-500 border-accent-500'
        : 'text-white/40 border-white/25';

  return (
    <span
      className={cn(
        'rounded-sm border px-1.5 py-0.5 text-[10px] font-medium tracking-[0.14em] whitespace-nowrap uppercase',
        tone,
      )}
    >
      {t(`status.${status}`)}
    </span>
  );
}

function UnlockMeter({ zone }: { zone: PublicZone }) {
  const t = useTranslations('rollout');

  // A zone with no target is not running an unlock campaign, so there is no
  // meter to draw and no number to promise.
  if (zone.foundingTarget <= 0) return null;

  const pct = Math.min(100, Math.round((zone.foundingSigned / zone.foundingTarget) * 100));
  const left = Math.max(0, zone.foundingTarget - zone.foundingSigned);

  return (
    <div className='mt-1'>
      <div
        className='h-1.5 w-full overflow-hidden rounded-full bg-white/10'
        role='progressbar'
        aria-valuenow={zone.foundingSigned}
        aria-valuemin={0}
        aria-valuemax={zone.foundingTarget}
        aria-label={t('meterLabel', { city: zone.displayName })}
      >
        <div
          className='from-accent-500 to-secondary h-full rounded-full bg-gradient-to-r'
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className='mt-2 text-[11px] text-white/70 tabular-nums'>
        {t('foundingProgress', {
          signed: zone.foundingSigned,
          target: zone.foundingTarget,
          left,
          city: zone.displayName,
        })}
      </p>
    </div>
  );
}

function Stop({ zone, index, isLast }: { zone: PublicZone; index: number; isLast: boolean }) {
  const t = useTranslations('rollout');

  const isLive = zone.status === 'active';
  const isNext = zone.status === 'coming_soon';

  return (
    <li className='relative grid grid-cols-[2.6rem_minmax(0,1fr)] gap-4 pb-6 last:pb-0'>
      {!isLast && (
        <span
          aria-hidden='true'
          className={cn(
            'absolute top-11 bottom-0 w-0.5 -translate-x-1/2 start-[1.3rem]',
            isLive ? 'bg-secondary' : 'bg-white/15',
          )}
        />
      )}

      <span
        aria-hidden='true'
        className={cn(
          'relative z-10 grid size-10 place-items-center rounded-full border text-[11px] font-bold tabular-nums',
          isLive &&
            'from-accent-500 to-secondary border-transparent bg-gradient-to-br text-primary-500',
          isNext && 'border-accent-500 text-accent-500 bg-primary-500',
          !isLive && !isNext && 'border-white/20 bg-primary-500 text-white/40',
        )}
      >
        {String(index + 1).padStart(2, '0')}
      </span>

      <div
        className={cn(
          'min-w-0',
          isNext && 'rounded-lg border border-white/12 bg-white/[0.04] px-4 py-3.5',
        )}
      >
        <div className='flex flex-wrap items-center gap-x-3 gap-y-2'>
          <h3
            className={cn(
              'font-heading text-lg leading-none md:text-xl',
              isLive || isNext ? 'text-white' : 'text-white/70',
            )}
          >
            {zone.displayName}
          </h3>
          <StatusPill status={zone.status} />
        </div>

        {isNext ? (
          <UnlockMeter zone={zone} />
        ) : (
          <p className='mt-1.5 text-[11px] text-white/55 tabular-nums'>
            {hasHistory(zone)
              ? t('liveSummary', { partners: zone.partners, bags: zone.bagsRescued })
              : t('waiting', { count: zone.peopleWaiting })}
          </p>
        )}
      </div>
    </li>
  );
}

function UnlockPanel({ zone }: { zone: PublicZone }) {
  const t = useTranslations('rollout');
  const [email, setEmail] = useState('');
  const mutation = useJoinWaitlist();

  const remaining = Math.max(0, zone.foundingTarget - zone.foundingSigned);

  return (
    <aside className='rounded-xl border border-white/12 bg-white/[0.05] p-6'>
      <p className='text-[10px] font-medium tracking-[0.2em] text-white/50 uppercase'>
        {t('panel.eyebrow')}
      </p>
      <h3 className='font-heading mt-2 text-2xl leading-none text-white md:text-3xl'>
        {zone.displayName}
      </h3>
      <p className='mt-3 text-sm leading-relaxed text-white/75'>
        {zone.foundingTarget > 0
          ? t('panel.body', { target: zone.foundingTarget, city: zone.displayName })
          : t('panel.bodyNoTarget', { city: zone.displayName })}
      </p>

      <dl className='mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/12 bg-white/10'>
        <div className='bg-primary-500 flex flex-col gap-1 p-3'>
          <dt className='text-[10px] tracking-[0.15em] text-white/50 uppercase'>
            {t('panel.signed')}
          </dt>
          <dd className='font-heading text-lg leading-none text-white tabular-nums' dir='ltr'>
            {zone.foundingTarget > 0
              ? `${zone.foundingSigned} / ${zone.foundingTarget}`
              : zone.foundingSigned}
          </dd>
        </div>
        <div className='bg-primary-500 flex flex-col gap-1 p-3'>
          <dt className='text-[10px] tracking-[0.15em] text-white/50 uppercase'>
            {t('panel.waiting')}
          </dt>
          <dd className='font-heading text-lg leading-none text-white tabular-nums' dir='ltr'>
            {zone.peopleWaiting.toLocaleString()}
          </dd>
        </div>
        {zone.foundingTarget > 0 && (
          <div className='bg-primary-500 col-span-2 flex flex-col gap-1 p-3'>
            <dt className='text-[10px] tracking-[0.15em] text-white/50 uppercase'>
              {t('panel.remaining')}
            </dt>
            <dd className='font-heading text-lg leading-none text-white tabular-nums' dir='ltr'>
              {t('panel.remainingValue', { count: remaining })}
            </dd>
          </div>
        )}
      </dl>

      {mutation.isSuccess ? (
        <p className='bg-secondary/15 text-secondary mt-5 rounded-lg px-4 py-3 text-sm font-medium'>
          {t('form.success', { city: zone.displayName })}
        </p>
      ) : (
        <form
          className='mt-5 flex flex-col gap-2'
          onSubmit={event => {
            event.preventDefault();
            if (!email.trim()) return;
            mutation.mutate({ email: email.trim(), zone: zone.name });
          }}
        >
          <label className='sr-only' htmlFor='rollout-email'>
            {t('form.emailLabel')}
          </label>
          <input
            id='rollout-email'
            type='email'
            required
            autoComplete='email'
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder={t('form.emailPlaceholder')}
            className='focus:border-secondary focus:ring-secondary/40 w-full rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm text-white placeholder:text-white/40 focus:ring-2 focus:outline-none'
          />
          <button
            type='submit'
            disabled={mutation.isPending}
            className='from-accent-500 to-secondary text-primary-500 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r px-5 py-3 text-sm font-bold transition-transform duration-200 hover:scale-[1.02] disabled:opacity-60'
          >
            {mutation.isPending ? t('form.submitting') : t('form.submit')}
            <ArrowRight className='size-4 shrink-0 rtl:rotate-180' aria-hidden='true' />
          </button>
          {mutation.isError && (
            <p role='alert' className='text-accent-500 text-xs'>
              {t('form.error')}
            </p>
          )}
        </form>
      )}

      <p className='mt-4 text-[11px] leading-relaxed text-white/45'>{t('panel.fine')}</p>
    </aside>
  );
}

/**
 * The public rollout map.
 *
 * Order comes from the API and is not re-sorted here: live first, the city
 * unlocking next second, then everything queued ranked by how many people are
 * waiting for it. That ranking is the point — a single sign-up can move the
 * list — so the client must not impose an order of its own.
 */
export default function RolloutMap({ showStoryLink = false }: { showStoryLink?: boolean } = {}) {
  const t = useTranslations('rollout');
  const { data: zones, isLoading, isError } = usePublicZones();
  const { data: impact } = usePublicImpact();

  const nextZone = useMemo(() => zones?.find(z => z.status === 'coming_soon'), [zones]);

  // No invented placeholder map: with nothing to show, the section stays out of
  // the page rather than advertising cities we cannot confirm.
  if (isError || (!isLoading && (!zones || zones.length === 0))) return null;

  return (
    <section
      id='rollout'
      aria-labelledby='rollout-heading'
      className='bg-primary-500 border-t border-white/10 px-4 py-16 md:py-24'
    >
      <div className='mx-auto flex max-w-6xl flex-col gap-10'>
        <div className='flex flex-wrap items-end justify-between gap-8 border-b border-white/12 pb-8'>
          <div>
            <p className='text-[10px] font-medium tracking-[0.22em] text-white/50 uppercase'>
              {t('eyebrow')}
            </p>
            <h2
              id='rollout-heading'
              className='font-heading mt-3 max-w-[16ch] text-3xl leading-[1.05] text-white md:text-5xl'
            >
              {t('headlineLead')}{' '}
              <span className='from-accent-500 to-secondary bg-gradient-to-r bg-clip-text text-transparent'>
                {t('headlineAccent')}
              </span>
            </h2>
          </div>

          <div className='flex flex-wrap gap-8'>
            <StatChip icon={Radio} label={t('chips.citiesLive')} value={impact?.citiesLive} />
            <StatChip icon={Users} label={t('chips.waiting')} value={impact?.peopleWaiting} />
            <StatChip
              icon={TrendingUp}
              label={t('chips.bagsRescued')}
              value={impact?.bagsRescued}
            />
          </div>
        </div>

        {isLoading ? (
          <div className='flex flex-col gap-4' aria-busy='true'>
            {[...Array(4)].map((_, i) => (
              <div key={i} className='h-14 animate-pulse rounded-lg bg-white/5' />
            ))}
          </div>
        ) : (
          <div className='grid items-start gap-10 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]'>
            <ol className='flex list-none flex-col'>
              {(zones ?? []).map((zone, i) => (
                <Stop
                  key={zone.name}
                  zone={zone}
                  index={i}
                  isLast={i === (zones ?? []).length - 1}
                />
              ))}
            </ol>

            {nextZone && <UnlockPanel zone={nextZone} />}
          </div>
        )}

        {/* ── International intent, deliberately a board and not a road ── */}
        <div className='mt-4 flex flex-col gap-4'>
          <h3 className='font-heading text-xl text-white md:text-2xl'>{t('board.title')}</h3>
          <div className='overflow-x-auto rounded-lg border border-white/12'>
            <table className='w-full min-w-[30rem] border-collapse text-sm'>
              <thead>
                <tr>
                  <th
                    scope='col'
                    className='border-b border-white/12 px-4 py-3 text-start text-[10px] font-medium tracking-[0.16em] text-white/50 uppercase'
                  >
                    {t('board.destination')}
                  </th>
                  <th
                    scope='col'
                    className='border-b border-white/12 px-4 py-3 text-start text-[10px] font-medium tracking-[0.16em] text-white/50 uppercase'
                  >
                    {t('board.market')}
                  </th>
                  <th
                    scope='col'
                    className='border-b border-white/12 px-4 py-3 text-start text-[10px] font-medium tracking-[0.16em] text-white/50 uppercase'
                  >
                    {t('board.status')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {DESTINATIONS.map(key => (
                  <tr key={key}>
                    <td className='font-heading border-b border-white/[0.07] px-4 py-3 text-white'>
                      {t(`board.countries.${key}.name`)}
                    </td>
                    <td className='border-b border-white/[0.07] px-4 py-3 text-white/60'>
                      {t(`board.countries.${key}.market`)}
                    </td>
                    <td className='border-b border-white/[0.07] px-4 py-3'>
                      <span
                        className={cn(
                          'rounded-sm border px-1.5 py-0.5 text-[10px] font-medium tracking-[0.14em] uppercase',
                          key === 'tunisia'
                            ? 'text-secondary border-secondary'
                            : 'border-white/25 text-white/40',
                        )}
                      >
                        {t(key === 'tunisia' ? 'board.boarding' : 'board.scheduled')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className='max-w-2xl text-sm text-white/55 italic'>{t('board.closing')}</p>
          {showStoryLink && (
            <Link
              href='/dream'
              className='text-secondary hover:text-secondary/80 inline-flex w-fit items-center gap-1.5 text-sm font-semibold underline underline-offset-4'
            >
              {t('board.storyLink')}
              <ArrowRight className='size-4 shrink-0 rtl:rotate-180' aria-hidden='true' />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
