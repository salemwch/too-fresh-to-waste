'use client';

import { Banknote, CreditCard, Truck, Wallet } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { useMyWallet } from '@/hooks/use-merchant-dashboard';
import { useSalesSummary } from '@/hooks/use-merchant-sales';
import { formatMoney } from '@/lib/format';
import type { PaymentLine, SalesPeriod } from '@/types/payments';

const LINES: ReadonlyArray<{ line: PaymentLine; icon: typeof Banknote }> = [
  { line: 'cashStore', icon: Banknote },
  { line: 'cashDelivery', icon: Truck },
  { line: 'online', icon: CreditCard },
];

/**
 * Everything the merchant's food earned in the period, cash and online
 * together, from the backend's single earnings calculation. Below it,
 * visually separate, what TFTW holds right now: a live balance from the
 * wallet, whose query key has no period, so changing the period cannot
 * change it.
 */
export function EarningsCard({ period }: { period: SalesPeriod }) {
  const t = useTranslations('dashboard.earnings');
  const tp = useTranslations('dashboard.period');
  const locale = useLocale();
  const summary = useSalesSummary(period);
  const wallet = useMyWallet();

  if (summary.isLoading) {
    return (
      <div
        data-testid='earnings-skeleton'
        className='glass rounded-2xl shadow-soft h-[320px] animate-pulse bg-white/30'
      />
    );
  }
  // Checked by presence of data, not `summary.isError`: a background refetch
  // failing (e.g. after a period change re-triggers it) must not blank out
  // data already on screen. `isLoading` was handled above, so reaching here
  // with no data means there is nothing safe to render either way.
  if (!summary.data) {
    return (
      <div data-testid='earnings-error' className='glass rounded-2xl shadow-soft p-lg'>
        <p className='text-sm text-primary-500/65'>{t('error')}</p>
      </div>
    );
  }

  const data = summary.data;
  const money = (value: number) => formatMoney(locale, value, data.currency);

  return (
    <section
      className='glass rounded-2xl shadow-soft p-lg space-y-lg'
      aria-labelledby='earnings-title'
    >
      <div>
        <h2 id='earnings-title' className='font-heading text-lg text-primary-500'>
          {t('title', { period: tp(period) })}
        </h2>
        {data.total.orders === 0 ? (
          <p className='mt-sm text-sm text-primary-500/65'>{t('empty')}</p>
        ) : (
          <div className='mt-sm flex items-baseline gap-sm'>
            <span
              data-testid='earnings-total'
              className='font-mono text-3xl font-bold tabular-nums text-primary-500'
            >
              {money(data.total.earned)}
            </span>
            <span className='text-sm text-primary-500/65'>
              {t('orders', { count: data.total.orders })}
            </span>
          </div>
        )}
      </div>

      {data.unverifiedOrders > 0 && (
        <p role='status' className='rounded-xl bg-warning/10 px-md py-sm text-sm text-primary-500'>
          {t('unverified', { count: data.unverifiedOrders })}
        </p>
      )}

      <ul className='space-y-sm'>
        {LINES.map(({ line, icon: Icon }) => (
          <li key={line} className='flex items-center justify-between gap-sm'>
            <span className='flex items-center gap-sm text-sm text-primary-500'>
              <Icon size={16} aria-hidden='true' />
              {t(`lines.${line}`)}
            </span>
            <span className='font-mono tabular-nums text-sm text-primary-500'>
              {money(data.channels[line].earned)}
            </span>
          </li>
        ))}
      </ul>

      <section aria-labelledby='held-title' className='border-t border-border pt-md'>
        <h3
          id='held-title'
          className='flex items-center gap-xs text-xs uppercase tracking-wider text-primary-500/60'
        >
          <Wallet size={14} aria-hidden='true' />
          {t('held.title')}
        </h3>
        {!wallet.data ? (
          <p className='mt-sm text-sm text-primary-500/65'>
            {wallet.isLoading ? t('held.loading') : t('held.error')}
          </p>
        ) : (
          <dl className='mt-sm grid grid-cols-2 gap-md'>
            <div>
              <dt className='text-xs text-primary-500/60'>{t('held.available')}</dt>
              <dd className='font-mono tabular-nums text-primary-500'>
                {formatMoney(locale, wallet.data.availableBalance, wallet.data.currency)}
              </dd>
            </div>
            <div>
              <dt className='text-xs text-primary-500/60'>{t('held.pending')}</dt>
              <dd className='font-mono tabular-nums text-primary-500'>
                {formatMoney(locale, wallet.data.pendingBalance, wallet.data.currency)}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <dl className='grid grid-cols-2 gap-md text-xs text-primary-500/65'>
        <div>
          <dt>{t('commission.accrued', { rate: Math.round(data.commission.rate * 100) })}</dt>
          <dd className='font-mono tabular-nums'>{money(data.commission.accrued)}</dd>
        </div>
        <div>
          <dt>{t('commission.settled')}</dt>
          <dd className='font-mono tabular-nums'>{money(data.commission.settled)}</dd>
        </div>
      </dl>
    </section>
  );
}
