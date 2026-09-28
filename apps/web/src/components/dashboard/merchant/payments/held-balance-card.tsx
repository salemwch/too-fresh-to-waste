'use client';

import { Wallet } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyWallet } from '@/hooks/use-merchant-dashboard';
import { formatMoney } from '@/lib/format';

/**
 * The live balance TFTW currently holds for this merchant right now -
 * available for payout, and awaiting pickup - read from the wallet endpoint.
 *
 * Deliberately NOT a period figure: `useMyWallet()` takes no argument and its
 * query key (`dashboardKeys.myWallet`) carries no period, so the `PeriodBar`
 * above this card can never change what renders here (CLAUDE.md - never put
 * the viewer's id in a cache key; the same rule applies to the period). The
 * `note` copy says this explicitly, since the card sits directly under a
 * period selector a merchant would otherwise expect it to obey.
 *
 * Moved here from the Dashboard's `EarningsCard` in task-15b - a live balance
 * does not belong next to a period figure (product decision). See
 * `.claude/work/merchant-earnings.md` Decisions, 2026-09-28.
 */
export function HeldBalanceCard() {
  const t = useTranslations('dashboard.payments.held');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const wallet = useMyWallet();

  if (wallet.isLoading) {
    return (
      <div
        data-testid='held-balance-skeleton'
        className='glass rounded-xl shadow-soft p-lg space-y-md'
      >
        <Skeleton className='h-4 w-40' />
        <div className='grid grid-cols-2 gap-md'>
          <Skeleton className='h-12 w-full' />
          <Skeleton className='h-12 w-full' />
        </div>
      </div>
    );
  }

  // Checked by presence of data, not `wallet.isError`: a background refetch
  // failing must not blank out a balance already on screen - the same
  // pattern the Dashboard's EarningsCard used for this section before it
  // moved here. Only reaching here with no data at all (the initial load
  // failed) shows the error state with a way to retry.
  if (!wallet.data) {
    return (
      <div className='glass rounded-xl shadow-soft p-lg flex flex-wrap items-center justify-between gap-md'>
        <p className='text-sm text-muted-foreground'>{t('error')}</p>
        <Button variant='outline' size='sm' onClick={() => void wallet.refetch()}>
          {tCommon('retry')}
        </Button>
      </div>
    );
  }

  return (
    <section aria-labelledby='held-balance-title' className='glass rounded-xl shadow-soft p-lg'>
      <div className='flex items-center gap-xs'>
        <Wallet size={16} aria-hidden='true' className='text-primary-500/60' />
        <h2
          id='held-balance-title'
          className='text-xs uppercase tracking-wider text-primary-500/60'
        >
          {t('title')}
        </h2>
      </div>
      <p className='mt-xxs text-xs text-primary-500/50'>{t('note')}</p>

      <dl className='mt-md grid grid-cols-2 gap-md'>
        <div>
          <dt className='text-xs text-primary-500/60'>{t('available')}</dt>
          <dd className='font-mono text-lg font-semibold tabular-nums text-primary-500'>
            {formatMoney(locale, wallet.data.availableBalance, wallet.data.currency)}
          </dd>
        </div>
        <div>
          <dt className='text-xs text-primary-500/60'>{t('pending')}</dt>
          <dd className='font-mono text-lg font-semibold tabular-nums text-primary-500'>
            {formatMoney(locale, wallet.data.pendingBalance, wallet.data.currency)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
