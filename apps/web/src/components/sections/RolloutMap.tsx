'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Radio, TrendingUp, Users } from 'lucide-react';

import { usePublicImpact, usePublicZones, useJoinWaitlist } from '@/hooks/use-public';
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
    <div className='flex flex-col gap-xs'>
      <span className='flex items-center gap-1.5 text-[10px] font-medium tracking-[0.16em] text-white/75 uppercase'>
        <Icon className='size-3.5 shrink-0' aria-hidden='true' />
        {label}
      </span>
      <span
        className='font-heading text-xl leading-none tabular-nums text-white md:text-2xl'
        dir='ltr'
      >
        {value === undefined ? '-' : value.toLocaleString()}
      </span>
    </div>
  );
}

type StopRole = 'live' | 'next' | 'queued';

function StatusPill({ role }: { role: StopRole }) {
  const t = useTranslations('rollout');

  const tone =
    role === 'live'
      ? 'text-primary-500 border-secondary bg-secondary'
      : role === 'next'
        ? 'text-secondary border-secondary'
        : 'text-white/75 border-white/25';

  return (
    <span
      className={cn(
        'rounded-sm border px-1.5 py-xxs text-[10px] font-medium tracking-[0.14em] whitespace-nowrap uppercase',
        tone,
      )}
    >
      {t(`status.${role}`)}
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
    <div className='mt-xs'>
      <div
        className='h-1.5 w-full overflow-hidden rounded-full bg-white/10'
        role='progressbar'
        aria-valuenow={zone.foundingSigned}
        aria-valuemin={0}
        aria-valuemax={zone.foundingTarget}
        aria-label={t('meterLabel', { city: zone.displayName })}
      >
        <div className='bg-secondary h-full rounded-full' style={{ width: `${pct}%` }} />
      </div>
      <p className='mt-sm text-[11px] text-white/70 tabular-nums'>
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

function Stop({
  zone,
  role,
  index,
  isLast,
}: {
  zone: PublicZone;
  role: StopRole;
  index: number;
  isLast: boolean;
}) {
  const t = useTranslations('rollout');

  const isLive = role === 'live';
  const isNext = role === 'next';

  return (
    /*
     * Flex with a fixed-width marker column, and the connector as a flex child
     * that stretches. The first version used a grid with an arbitrary column
     * width and an absolutely positioned connector, which put the markers on top
     * of the city names. Nothing here can overlap: the text column is a sibling
     * that starts where the marker column ends.
     */
    <li className='flex gap-lg pb-2xl last:pb-0'>
      <div className='flex w-10 flex-none flex-col items-center'>
        <span
          aria-hidden='true'
          className={cn(
            'flex h-10 w-10 flex-none items-center justify-center rounded-full border text-[11px] font-bold tabular-nums',
            isLive && 'border-secondary bg-secondary text-secondary-foreground',
            isNext && 'border-secondary text-secondary bg-transparent',
            !isLive && !isNext && 'border-white/20 text-white/75',
          )}
        >
          {String(index + 1).padStart(2, '0')}
        </span>

        {!isLast && (
          <span
            aria-hidden='true'
            className={cn('mt-sm w-0.5 flex-1', isLive ? 'bg-secondary' : 'bg-white/15')}
          />
        )}
      </div>

      <div
        className={cn(
          'min-w-0 flex-1',
          isNext && 'rounded-lg border border-white/15 bg-white/[0.04] px-lg py-3.5',
        )}
      >
        <div className='flex flex-wrap items-center gap-x-md gap-y-sm'>
          <h3
            className={cn(
              'font-heading text-lg leading-none md:text-xl',
              isLive || isNext ? 'text-white' : 'text-white/70',
            )}
          >
            {zone.displayName}
          </h3>
          <StatusPill role={role} />
        </div>

        {isNext ? (
          <UnlockMeter zone={zone} />
        ) : (
          <p className='mt-1.5 text-[11px] text-white/75 tabular-nums'>
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
    <aside className='rounded-xl border border-white/15 bg-white/[0.05] p-2xl'>
      <p className='text-[10px] font-medium tracking-[0.2em] text-white/75 uppercase'>
        {t('panel.eyebrow')}
      </p>
      <h3 className='font-heading mt-sm text-2xl leading-none text-white md:text-3xl'>
        {zone.displayName}
      </h3>
      <p className='mt-md text-sm leading-relaxed text-white/75'>
        {zone.foundingTarget > 0
          ? t('panel.body', { target: zone.foundingTarget, city: zone.displayName })
          : t('panel.bodyNoTarget', { city: zone.displayName })}
      </p>

      <dl className='mt-xl grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/15 bg-white/10'>
        <div className='bg-primary-500 flex flex-col gap-xs p-md'>
          <dt className='text-[10px] tracking-[0.15em] text-white/75 uppercase'>
            {t('panel.signed')}
          </dt>
          <dd className='font-heading text-lg leading-none text-white tabular-nums' dir='ltr'>
            {zone.foundingTarget > 0
              ? `${zone.foundingSigned} / ${zone.foundingTarget}`
              : zone.foundingSigned}
          </dd>
        </div>
        <div className='bg-primary-500 flex flex-col gap-xs p-md'>
          <dt className='text-[10px] tracking-[0.15em] text-white/75 uppercase'>
            {t('panel.waiting')}
          </dt>
          <dd className='font-heading text-lg leading-none text-white tabular-nums' dir='ltr'>
            {zone.peopleWaiting.toLocaleString()}
          </dd>
        </div>
        {zone.foundingTarget > 0 && (
          <div className='bg-primary-500 col-span-2 flex flex-col gap-xs p-md'>
            <dt className='text-[10px] tracking-[0.15em] text-white/75 uppercase'>
              {t('panel.remaining')}
            </dt>
            <dd className='font-heading text-lg leading-none text-white tabular-nums' dir='ltr'>
              {t('panel.remainingValue', { count: remaining })}
            </dd>
          </div>
        )}
      </dl>

      {mutation.isSuccess ? (
        <p className='bg-secondary/15 text-secondary mt-xl rounded-lg px-lg py-md text-sm font-medium'>
          {t('form.success', { city: zone.displayName })}
        </p>
      ) : (
        <form
          className='mt-xl flex flex-col gap-sm'
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
            className='focus:border-secondary focus:ring-secondary/40 w-full rounded-full border border-white/20 bg-white/5 px-xl py-md text-sm text-white placeholder:text-white/75 focus:ring-2 focus:outline-none'
          />
          <button
            type='submit'
            disabled={mutation.isPending}
            className='bg-secondary text-secondary-foreground flex items-center justify-center gap-sm rounded-full px-xl py-md text-sm font-bold transition-transform duration-200 hover:scale-[1.02] disabled:opacity-60'
          >
            {mutation.isPending ? t('form.submitting') : t('form.submit')}
            <ArrowRight className='size-4 shrink-0 rtl:rotate-180' aria-hidden='true' />
          </button>
          {mutation.isError && (
            <p role='alert' className='text-secondary text-xs'>
              {t('form.error')}
            </p>
          )}
        </form>
      )}

      <p className='mt-lg text-[11px] leading-relaxed text-white/75'>{t('panel.fine')}</p>
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
export default function RolloutMap() {
  const t = useTranslations('rollout');
  const { data: zones, isLoading, isError } = usePublicZones();
  const { data: impact } = usePublicImpact();

  // Exactly one city can be "unlocking next". The API may publish several as
  // `coming_soon` — a queue of announced cities — so the first in the server's
  // order takes the panel and the rest read as queued. Without this every
  // announced city claimed the same status and the section had no single
  // call to action.
  const nextZone = useMemo(() => zones?.find(z => z.status === 'coming_soon'), [zones]);

  const roles = useMemo<StopRole[]>(() => {
    let nextTaken = false;
    return (zones ?? []).map(zone => {
      if (zone.status === 'active') return 'live';
      if (zone.status === 'coming_soon' && !nextTaken) {
        nextTaken = true;
        return 'next';
      }
      return 'queued';
    });
  }, [zones]);

  // No invented placeholder map: with nothing to show, the section stays out of
  // the page rather than advertising cities we cannot confirm.
  if (isError || (!isLoading && (!zones || zones.length === 0))) return null;

  return (
    <section
      id='rollout'
      aria-labelledby='rollout-heading'
      className='bg-primary-500 border-t border-white/10 px-lg py-4xl md:py-6xl'
    >
      <div className='mx-auto flex max-w-6xl flex-col gap-6xl'>
        <div className='flex flex-wrap items-end justify-between gap-4xl border-b border-white/15 pb-4xl'>
          <div>
            <p className='text-[10px] font-medium tracking-[0.22em] text-white/75 uppercase'>
              {t('eyebrow')}
            </p>
            <h2
              id='rollout-heading'
              className='font-heading mt-md max-w-[16ch] text-3xl leading-[1.05] text-white md:text-5xl'
            >
              {t('headlineLead')} <span className='text-secondary'>{t('headlineAccent')}</span>
            </h2>
          </div>

          <div className='flex flex-wrap gap-4xl'>
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
          <div className='flex flex-col gap-lg' aria-busy='true'>
            {[...Array(4)].map((_, i) => (
              <div key={i} className='h-14 animate-pulse rounded-lg bg-white/5' />
            ))}
          </div>
        ) : (
          <div className='grid items-start gap-6xl lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]'>
            <ol className='flex list-none flex-col'>
              {(zones ?? []).map((zone, i) => (
                <Stop
                  key={zone.name}
                  zone={zone}
                  role={roles[i] ?? 'queued'}
                  index={i}
                  isLast={i === (zones ?? []).length - 1}
                />
              ))}
            </ol>

            {nextZone && <UnlockPanel zone={nextZone} />}
          </div>
        )}

        {/* ── International intent, deliberately a board and not a road ── */}
        <div className='mt-lg flex flex-col gap-lg'>
          <h3 className='font-heading text-xl text-white md:text-2xl'>{t('board.title')}</h3>
          <div className='overflow-x-auto rounded-lg border border-white/15'>
            <table className='w-full min-w-[30rem] border-collapse text-sm'>
              <thead>
                <tr>
                  <th
                    scope='col'
                    className='border-b border-white/15 px-lg py-md text-start text-[10px] font-medium tracking-[0.16em] text-white/75 uppercase'
                  >
                    {t('board.destination')}
                  </th>
                  <th
                    scope='col'
                    className='border-b border-white/15 px-lg py-md text-start text-[10px] font-medium tracking-[0.16em] text-white/75 uppercase'
                  >
                    {t('board.market')}
                  </th>
                  <th
                    scope='col'
                    className='border-b border-white/15 px-lg py-md text-start text-[10px] font-medium tracking-[0.16em] text-white/75 uppercase'
                  >
                    {t('board.status')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {DESTINATIONS.map(key => (
                  <tr key={key}>
                    <td className='font-heading border-b border-white/[0.07] px-lg py-md text-white'>
                      {t(`board.countries.${key}.name`)}
                    </td>
                    <td className='border-b border-white/[0.07] px-lg py-md text-white/75'>
                      {t(`board.countries.${key}.market`)}
                    </td>
                    <td className='border-b border-white/[0.07] px-lg py-md'>
                      <span
                        className={cn(
                          'rounded-sm border px-1.5 py-xxs text-[10px] font-medium tracking-[0.14em] uppercase',
                          key === 'tunisia'
                            ? 'text-secondary border-secondary'
                            : 'border-white/25 text-white/75',
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
          <p className='max-w-2xl text-sm text-white/75 italic'>{t('board.closing')}</p>
        </div>
      </div>
    </section>
  );
}
