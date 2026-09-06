'use client';

import { HeartHandshake } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useFundLedger } from '@/hooks/use-merchant-dashboard';

export function FundLedgerCard() {
  const t = useTranslations('dashboard.fundLedger');
  const { data, isLoading, isError } = useFundLedger();

  if (isLoading) {
    return (
      <div
        data-testid='fund-ledger-skeleton'
        className='glass rounded-2xl shadow-soft h-[140px] animate-pulse bg-white/30'
      />
    );
  }

  if (isError) {
    return (
      <div className='glass rounded-2xl shadow-soft p-lg'>
        <p className='text-sm text-primary-500/65'>{t('error')}</p>
      </div>
    );
  }

  if (!data || data.contributionCount === 0) {
    return (
      <div className='glass rounded-2xl shadow-soft p-lg flex flex-col items-center text-center gap-sm'>
        <HeartHandshake size={32} className='text-primary-500/40' />
        <h3 className='font-display text-md text-primary-500'>{t('empty')}</h3>
        <p className='text-xs text-primary-500/65 max-w-xs'>{t('emptyHint')}</p>
      </div>
    );
  }

  // A category that funded money but no whole item is carried by the TND total.
  // Rendering "0 school kits" reads as failure for a real contribution.
  const fundedItems = data.items.filter(item => item.count > 0);

  return (
    <div className='glass rounded-2xl shadow-soft p-lg'>
      <div className='flex items-center gap-sm mb-md'>
        <div className='h-10 w-10 rounded-xl bg-primary-500/[0.08] grid place-items-center text-primary-500 shrink-0'>
          <HeartHandshake size={18} />
        </div>
        <div className='min-w-0'>
          <div className='font-display text-lg text-primary-500 leading-tight'>{t('title')}</div>
          <p className='text-xs text-primary-500/65 mt-xxs'>{t('subtitle')}</p>
        </div>
      </div>

      <div className='flex items-baseline gap-xs'>
        <span className='font-display text-4xl text-primary-500 tracking-tight'>
          {data.totalTnd.toFixed(3)}
        </span>
        <span className='text-sm text-primary-500/60 font-medium'>{data.currency}</span>
      </div>
      <p className='text-xs text-primary-500/50 mt-xxs'>{t('totalLabel')}</p>

      {fundedItems.length > 0 && (
        <ul className='mt-md flex flex-wrap gap-sm'>
          {fundedItems.map(item => (
            <li
              key={item.category}
              className='rounded-full bg-primary-500/[0.06] px-md py-xs text-xs text-primary-500'
            >
              <span className='font-semibold'>{item.count}</span> {t(`categories.${item.category}`)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
