'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Phone, PhoneOff, Navigation, Store, MapPin, Clock, PackageSearch } from 'lucide-react';
import { Skeleton } from '@foodwaste/ui';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { DriverActivity, LiveDriver } from '@/types/admin';

/**
 * Order the list puts drivers in.
 *
 * `stale` first, deliberately. It is the only state that needs someone to *do*
 * something - a driver whose heartbeat stopped mid-delivery is the reason to
 * open this screen at all - and burying it under twenty idle drivers is how it
 * gets missed. Everything else follows in descending usefulness to dispatch.
 */
const ACTIVITY_ORDER: Record<DriverActivity, number> = {
  stale: 0,
  en_route: 1,
  idle: 2,
  offline: 3,
};

const ACTIVITY_DOT: Record<DriverActivity, string> = {
  en_route: 'bg-primary-500',
  idle: 'bg-success',
  stale: 'bg-warning',
  offline: 'bg-muted-foreground/40',
};

interface DriverFleetPanelProps {
  drivers: readonly LiveDriver[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (driverId: string | null) => void;
}

export function DriverFleetPanel({
  drivers,
  isLoading,
  selectedId,
  onSelect,
}: DriverFleetPanelProps) {
  const t = useTranslations('adminDrivers.map');

  const sorted = useMemo(
    () =>
      [...drivers].sort(
        (a, b) =>
          ACTIVITY_ORDER[a.activity] - ACTIVITY_ORDER[b.activity] ||
          a.firstName.localeCompare(b.firstName),
      ),
    [drivers],
  );

  if (isLoading) {
    return (
      <div className='flex flex-col gap-sm'>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className='h-[72px] rounded-lg' />
        ))}
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className='flex flex-col items-center gap-md rounded-lg border border-border/60 py-3xl text-center'>
        <PackageSearch className='size-10 text-muted-foreground/40' aria-hidden='true' />
        <p className='text-sm font-medium text-muted-foreground'>{t('noDriversTitle')}</p>
        <p className='max-w-xs text-xs text-muted-foreground/70'>{t('noDriversBody')}</p>
      </div>
    );
  }

  return (
    <ul className='flex flex-col gap-sm'>
      {sorted.map(driver => (
        <DriverCard
          key={driver._id}
          driver={driver}
          selected={driver._id === selectedId}
          onSelect={() => onSelect(driver._id === selectedId ? null : driver._id)}
        />
      ))}
    </ul>
  );
}

function DriverCard({
  driver,
  selected,
  onSelect,
}: {
  driver: LiveDriver;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations('adminDrivers.map');
  const locale = useLocale();
  const assignment = driver.assignment;

  // formatRelative returns null for a missing or unparseable timestamp, so the
  // 'never reported' copy covers both rather than rendering 'null'.
  const lastFix = formatRelative(locale, driver.position?.at ?? null);

  return (
    <li
      className={cn(
        'rounded-lg border border-border/60 bg-card transition-colors',
        selected && 'border-primary-500/40 bg-primary-500/[0.04]',
      )}
    >
      {/*
        The call link is a sibling of the select button, not a child of it.
        Nesting an <a> inside a <button> is invalid HTML: React hydration warns
        on it and browsers disagree about which element receives the click, so
        "call the driver" would sometimes just toggle the selection.
      */}
      <div className='flex items-start justify-between gap-sm p-md pb-0'>
        <div className='min-w-0'>
          <p className='truncate text-sm font-semibold'>
            {driver.firstName} {driver.lastName}
          </p>
          <span className='mt-0.5 flex items-center gap-xs text-xs text-muted-foreground'>
            <span
              aria-hidden='true'
              className={cn('size-2 shrink-0 rounded-full', ACTIVITY_DOT[driver.activity])}
            />
            {t(`activity.${driver.activity}`)}
          </span>
        </div>

        {/*
          `tel:` is the point of showing a phone number on a dispatch screen -
          the admin is about to call this person.
        */}
        {driver.phoneNumber ? (
          <a
            href={`tel:${driver.phoneNumber}`}
            className='flex shrink-0 items-center gap-xs rounded-full border border-border/60 px-sm py-xxs text-xs font-medium hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'
            // dir=ltr: a phone number is a left-to-right sequence even in
            // Arabic, and without this the + lands on the wrong end.
            dir='ltr'
            aria-label={t('callDriver', { name: `${driver.firstName} ${driver.lastName}` })}
          >
            <Phone className='size-3' aria-hidden='true' />
            {driver.phoneNumber}
          </a>
        ) : (
          <span className='flex shrink-0 items-center gap-xs text-xs text-muted-foreground/60'>
            <PhoneOff className='size-3' aria-hidden='true' />
            {t('noPhone')}
          </span>
        )}
      </div>

      <button
        type='button'
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          'w-full rounded-b-lg px-md pb-md pt-0 text-start transition-colors',
          'hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500',
        )}
      >
        {/* Where they are going, which is the question this screen answers. */}
        {assignment ? (
          <div className='mt-sm flex flex-col gap-xs border-t border-border/40 pt-sm text-xs'>
            <span className='flex items-center gap-xs text-muted-foreground'>
              <Navigation className='size-3 shrink-0' aria-hidden='true' />
              {t(`assignmentStatus.${assignment.status}`)}
              <span className='font-mono'>{assignment.orderNumber}</span>
            </span>
            {assignment.pickup?.name && (
              <span className='flex items-center gap-xs text-muted-foreground'>
                <Store className='size-3 shrink-0' aria-hidden='true' />
                {assignment.pickup.name}
              </span>
            )}
            {assignment.destination?.city && (
              <span className='flex items-center gap-xs text-muted-foreground'>
                <MapPin className='size-3 shrink-0' aria-hidden='true' />
                {assignment.destination.city}
              </span>
            )}
          </div>
        ) : (
          <p className='mt-sm border-t border-border/40 pt-sm text-xs text-muted-foreground/70'>
            {t('noAssignment')}
          </p>
        )}

        {/*
          How old the fix is. Shown for every driver, not just stale ones: "en
          route, fix 4 minutes ago" is a different call than "en route, fix 5
          seconds ago", and only one of them needs chasing.
        */}
        <span className='mt-sm flex items-center gap-xs text-[11px] text-muted-foreground/70'>
          <Clock className='size-3 shrink-0' aria-hidden='true' />
          {lastFix ? t('lastFix', { when: lastFix }) : t('neverReported')}
        </span>
      </button>
    </li>
  );
}
