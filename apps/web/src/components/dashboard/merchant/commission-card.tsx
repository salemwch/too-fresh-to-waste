'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, Receipt } from 'lucide-react';

import { useCommissionStatement } from '@/hooks/use-merchant-dashboard';
import { formatMoney } from '@/lib/format';

/**
 * The merchant's commission, in the shape a merchant already understands.
 *
 * ## Why it reads the way it does
 *
 * Commission is a loss, and losses are felt harder than the equivalent gain.
 * The design brief is therefore the opposite of the admin view: nothing here
 * may read as a deduction, a warning, or a debt notice.
 *
 * Three decisions follow from that:
 *
 * 1. **The month leads, not the balance.** Sold / commission / received is
 *    identical to any ordinary commission statement and reconciles to the flat
 *    rate. The per-order lumpiness is a payout detail and does not belong in
 *    the headline.
 * 2. **The outstanding balance is stated plainly and never coloured.** A red
 *    number next to "commission to settle" turns a bookkeeping line into an
 *    accusation. It is muted text, below the fold of the card.
 * 3. **"Full price on N orders" is shown because it is the true part of the
 *    pitch.** It is a count from the ledger, not a marketing claim.
 *
 * The word "settle" is used throughout - never "deducted", "withheld", "taken"
 * or "owed".
 */
export function CommissionCard() {
  const t = useTranslations('dashboard.commission');
  const locale = useLocale();
  const { data, isLoading, isError, isPending, fetchStatus } = useCommissionStatement();

  const ratePercent = useMemo(() => (data ? Math.round(data.rate * 100) : null), [data]);

  /*
   * The query is disabled until an establishment is selected. A disabled query
   * in TanStack v5 reports `isPending` with `fetchStatus: 'idle'` and no data -
   * so `isLoading` is false and `!data` is true, which sent a merchant who had
   * simply not picked a shop yet straight into the error branch. Waiting is not
   * failing; keep showing the skeleton.
   */
  const isWaitingForEstablishment = isPending && fetchStatus === 'idle';

  if (isLoading || isWaitingForEstablishment) {
    return (
      <div
        data-testid='commission-card-skeleton'
        className='glass rounded-2xl shadow-soft h-[196px] animate-pulse bg-white/30'
      />
    );
  }

  if (isError || !data) {
    return (
      <div className='glass rounded-2xl shadow-soft p-lg'>
        <p className='text-sm text-primary-500/65'>{t('error')}</p>
      </div>
    );
  }

  // No sales this month is not an error and not an empty state to apologise
  // for - it is simply a month that has not started yet.
  const hasActivity = data.sales > 0;

  return (
    <div className='glass rounded-2xl shadow-soft p-lg'>
      <div className='flex items-center gap-sm mb-md'>
        <div className='h-10 w-10 rounded-xl bg-primary-500/[0.08] grid place-items-center text-primary-500 shrink-0'>
          {/* Decorative - the card title carries the meaning. */}
          <Receipt size={18} aria-hidden='true' />
        </div>
        <div className='min-w-0'>
          <div className='font-heading text-lg text-primary-500 leading-tight'>{t('title')}</div>
          <p className='text-xs text-primary-500/65 mt-xxs'>{t('subtitle')}</p>
        </div>
      </div>

      {hasActivity ? (
        <>
          {/*
            The three lines a merchant reconciles against. `received` is the
            largest and last because it is the number they actually care about.
          */}
          <dl className='space-y-sm'>
            <div className='flex items-baseline justify-between gap-sm'>
              <dt className='text-sm text-primary-500/65'>{t('sold')}</dt>
              <dd className='font-mono text-sm tabular-nums text-primary-500'>
                {formatMoney(locale, data.sales)}
              </dd>
            </div>

            <div className='flex items-baseline justify-between gap-sm'>
              <dt className='text-sm text-primary-500/65'>
                {ratePercent != null
                  ? t('commissionWithRate', { rate: ratePercent })
                  : t('commission')}
              </dt>
              <dd className='font-mono text-sm tabular-nums text-primary-500/65'>
                {formatMoney(locale, data.commission)}
              </dd>
            </div>

            <div className='border-t border-primary-500/10 pt-sm flex items-baseline justify-between gap-sm'>
              <dt className='text-sm font-semibold text-primary-500'>{t('received')}</dt>
              <dd className='font-mono text-xl font-bold tabular-nums text-primary-500'>
                {formatMoney(locale, data.received)}
              </dd>
            </div>
          </dl>

          {data.fullPriceOrders > 0 && (
            <p className='mt-md flex items-center gap-xs text-xs text-primary-500/65'>
              <CheckCircle2 size={14} aria-hidden='true' className='shrink-0 text-primary-500/40' />
              {t('fullPriceOrders', { count: data.fullPriceOrders })}
            </p>
          )}

          {/*
            Outstanding balance. Deliberately last, muted, and uncoloured - see
            the component note. It is a fact, not a warning.
          */}
          {data.commissionDue > 0 && (
            <p className='mt-xs text-xs text-primary-500/50'>
              {t('toSettle', { amount: formatMoney(locale, data.commissionDue) })}
            </p>
          )}
        </>
      ) : (
        <p className='text-sm text-primary-500/65'>{t('noActivity')}</p>
      )}
    </div>
  );
}
