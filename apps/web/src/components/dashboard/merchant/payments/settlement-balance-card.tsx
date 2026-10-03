'use client';

import { ShieldCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCommissionStatement } from '@/hooks/use-merchant-dashboard';
import { formatMoney } from '@/lib/format';

/**
 * The live settlement balance TFTW is still owed from this merchant's
 * completed sales - never a debt notice, see `CommissionCard`'s note on word
 * choice (never "deducted"/"withheld"/"owed").
 *
 * Period-independent like `HeldBalanceCard`: `useCommissionStatement()` takes
 * no period argument, so the `PeriodBar` above the Payments stats cannot
 * change what renders here.
 *
 * Replaces the Dashboard's `CommissionCard` (task-17 B1 -
 * `.claude/work/merchant-earnings.md` Decisions, 2026-09-26): the commission
 * statement now lives on Payments, next to the rest of the money story,
 * rather than split across two pages.
 */
export function SettlementBalanceCard() {
  const t = useTranslations('dashboard.payments.settlement');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { data, isLoading, refetch } = useCommissionStatement();

  if (isLoading) {
    return (
      <div
        data-testid='settlement-balance-skeleton'
        className='glass rounded-xl shadow-soft p-lg space-y-md'
      >
        <Skeleton className='h-4 w-48' />
        <Skeleton className='h-10 w-32' />
      </div>
    );
  }

  // Checked by presence of data, not an `isError` flag - a background refetch
  // failing must not blank out a balance already on screen, the same pattern
  // as `HeldBalanceCard` and `EarningsCard`.
  if (!data) {
    return (
      <div className='glass rounded-xl shadow-soft p-lg flex flex-wrap items-center justify-between gap-md'>
        <p className='text-sm text-muted-foreground'>{t('error')}</p>
        <Button variant='outline' size='sm' onClick={() => void refetch()}>
          {tCommon('retry')}
        </Button>
      </div>
    );
  }

  return (
    <section
      aria-labelledby='settlement-balance-title'
      className='glass rounded-xl shadow-soft p-lg'
    >
      <div className='flex items-center gap-xs'>
        <ShieldCheck size={16} aria-hidden='true' className='text-primary-500/60' />
        <h2
          id='settlement-balance-title'
          className='text-xs uppercase tracking-wider text-primary-500/60'
        >
          {t('title')}
        </h2>
      </div>
      <p className='mt-xxs text-xs text-primary-500/50'>{t('body')}</p>

      <p className='mt-md font-mono text-2xl font-semibold tabular-nums text-primary-500'>
        {formatMoney(locale, data.commissionDue, data.currency)}
      </p>

      {/*
        Under "All locations" the balance above sums several shops. Naming
        each one keeps the sum from hiding which location carries it - same
        reasoning as the old `CommissionCard`. One location needs no
        breakdown - it would repeat the line above.
      */}
      {data.dueByEstablishment.length > 1 && (
        <dl aria-label={t('byLocation')} className='mt-sm space-y-xxs text-xs text-primary-500/50'>
          {data.dueByEstablishment.map(row => (
            <div key={row.establishmentId} className='flex items-baseline justify-between gap-sm'>
              <dt className='truncate'>{row.name}</dt>
              <dd className='font-mono tabular-nums shrink-0'>
                {formatMoney(locale, row.amount, data.currency)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
