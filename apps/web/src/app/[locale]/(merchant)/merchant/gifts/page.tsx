'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, Check, Gift, Lock } from 'lucide-react';
import { Button } from '@foodwaste/ui';

import {
  MAX_PERK_TIER,
  MERCHANT_PERKS,
  resolveTierProgress,
  type Perk,
} from '@/config/merchant-perks.config';
import { useOrderStats } from '@/hooks/use-merchant-dashboard';
import { cn } from '@/lib/utils';

/** Frozen - a fresh array in render gives every child a new prop identity. */
const SKELETON_CARDS = Object.freeze([0, 1]);

/**
 * Merchant perks: subsidised connectivity and packaging.
 *
 * ## What this screen is careful about
 *
 * The tiers are placeholders (see `merchant-perks.config.ts`) because the unit
 * economics are not decided. So the page **states what is on offer and how far
 * along a merchant is, and stops there**. It does not auto-grant, does not show
 * a claim button, and does not imply an entitlement. Creating an obligation the
 * margin has not been checked against is far more expensive than a merchant
 * waiting a week for a real answer.
 *
 * Progress is driven by `bagsSaved`, which is a real figure already on the
 * order-stats endpoint (sum of item quantities on picked-up orders). Nothing
 * here invents a metric.
 */
export default function MerchantGiftsPage() {
  const t = useTranslations('merchantGifts');
  const locale = useLocale();
  const { data, isLoading, isError, refetch } = useOrderStats();

  const bagsSold = data?.bagsSaved ?? 0;

  /** One place to format, so the three locales share a number system. */
  const formatCount = useMemo(() => new Intl.NumberFormat(locale).format, [locale]);

  if (isLoading) {
    return (
      <div className='flex flex-col gap-lg'>
        <div className='glass rounded-2xl shadow-soft h-[120px] animate-pulse bg-white/30' />
        <div className='grid grid-cols-1 gap-lg lg:grid-cols-2'>
          {SKELETON_CARDS.map(i => (
            <div
              key={i}
              data-testid='perk-card-skeleton'
              className='glass rounded-2xl shadow-soft h-[280px] animate-pulse bg-white/30'
            />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className='glass rounded-2xl shadow-soft flex flex-col items-center gap-sm p-4xl text-center'>
        <AlertTriangle aria-hidden='true' className='text-primary-500/40 size-12' />
        <h2 className='font-heading text-md text-primary-500'>{t('error.title')}</h2>
        <p className='max-w-xs text-sm text-primary-500/65'>{t('error.body')}</p>
        {/* The shared primitive, not a hand-rolled button: it already carries
            the focus ring, disabled state and hit area the design system
            requires, and it keeps the retry here identical to every other. */}
        <Button type='button' className='mt-sm' onClick={() => void refetch()}>
          {t('error.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-lg'>
      {/* ── Header ── */}
      <div className='glass rounded-2xl shadow-soft p-lg'>
        <div className='flex items-center gap-sm'>
          <div className='bg-secondary/[0.12] text-secondary grid size-10 shrink-0 place-items-center rounded-xl'>
            {/* Decorative - the heading beside it carries the meaning. */}
            <Gift size={18} aria-hidden='true' />
          </div>
          <div className='min-w-0'>
            <h1 className='font-heading text-lg leading-tight text-primary-500'>{t('title')}</h1>
            <p className='mt-xxs text-xs text-primary-500/65'>{t('subtitle')}</p>
          </div>
        </div>

        <div className='mt-lg flex items-baseline gap-sm'>
          <span className='font-mono text-3xl font-bold tabular-nums text-primary-500'>
            {formatCount(bagsSold)}
          </span>
          <span className='text-sm text-primary-500/65'>{t('bagsSold')}</span>
        </div>

        {bagsSold === 0 && <p className='mt-sm text-sm text-primary-500/65'>{t('empty')}</p>}
      </div>

      {/* ── Perks ── */}
      <div className='grid grid-cols-1 gap-lg lg:grid-cols-2'>
        {MERCHANT_PERKS.map(perk => (
          <PerkCard key={perk.id} perk={perk} bagsSold={bagsSold} formatCount={formatCount} />
        ))}
      </div>

      {/*
        No claim button. The tiers are placeholders until the unit economics are
        settled, so the page must not create an entitlement the margin has not
        been checked against.
      */}
      <p className='text-center text-xs text-primary-500/50'>{t('howToClaim')}</p>
    </div>
  );
}

// ─── Perk card ───────────────────────────────────────────────────────────────

function PerkCard({
  perk,
  bagsSold,
  formatCount,
}: {
  perk: Perk;
  bagsSold: number;
  formatCount: (n: number) => string;
}) {
  const t = useTranslations('merchantGifts');
  const { reached, next } = resolveTierProgress(perk, bagsSold);
  const Icon = perk.icon;

  // Capped at 100 so a merchant past every tier does not overflow the bar.
  const progress = Math.min(100, (bagsSold / MAX_PERK_TIER) * 100);

  return (
    <section className='glass rounded-2xl shadow-soft flex flex-col p-lg'>
      <div className='flex items-center gap-sm'>
        <div
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-xl',
            perk.iconBg,
            perk.iconColor,
          )}
        >
          <Icon size={18} aria-hidden='true' />
        </div>
        <div className='min-w-0'>
          <h2 className='font-heading text-md leading-tight text-primary-500'>
            {t(`perks.${perk.id}.title`)}
          </h2>
          <p className='mt-xxs text-xs text-primary-500/65'>{t(`perks.${perk.id}.subtitle`)}</p>
        </div>
      </div>

      {/* Progress toward the next tier. */}
      <div className='mt-lg'>
        <div
          className='bg-primary-500/[0.08] h-1.5 w-full overflow-hidden rounded-full'
          role='progressbar'
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t(`perks.${perk.id}.title`)}
        >
          <div
            className='bg-secondary h-full rounded-full transition-[width] duration-500'
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className='mt-sm text-xs text-primary-500/65'>
          {next
            ? t('bagsToNext', { count: formatCount(next.bagsRequired - bagsSold) })
            : t('allUnlocked')}
        </p>
      </div>

      {/* Tier list. Reached tiers are ticked; the rest stay visibly locked so
          the merchant can see what trading more actually buys them. */}
      <ul className='mt-lg flex flex-col gap-sm'>
        {perk.tiers.map(tier => {
          const unlocked = bagsSold >= tier.bagsRequired;
          const isNext = next?.bagsRequired === tier.bagsRequired;

          return (
            <li
              key={tier.bagsRequired}
              className={cn(
                'flex items-start gap-sm rounded-xl p-sm transition-colors',
                isNext && 'bg-secondary/[0.08]',
              )}
            >
              {unlocked ? (
                <Check size={16} aria-hidden='true' className='text-secondary mt-0.5 shrink-0' />
              ) : (
                <Lock
                  size={16}
                  aria-hidden='true'
                  className='text-primary-500/30 mt-0.5 shrink-0'
                />
              )}

              <div className='min-w-0 flex-1'>
                <p
                  className={cn(
                    'text-sm',
                    unlocked ? 'font-semibold text-primary-500' : 'text-primary-500/65',
                  )}
                >
                  {t(`perks.${perk.id}.tiers.${tier.labelKey}`)}
                </p>
                <p className='mt-xxs text-xs text-primary-500/50'>
                  {t('atBags', { count: formatCount(tier.bagsRequired) })}
                </p>
              </div>

              {/* Screen readers get the state as words, not as an icon alone. */}
              <span className='sr-only'>{unlocked ? t('unlocked') : t('locked')}</span>
            </li>
          );
        })}
      </ul>

      {reached && <p className='mt-lg text-xs font-semibold text-secondary'>{t('eligible')}</p>}
    </section>
  );
}
