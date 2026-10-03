'use client';

import { useTranslations } from 'next-intl';

import { SALES_PERIODS } from '@/lib/sales-period';

import type { SalesPeriod } from '@/types/payments';

/** One bar per page; every period-based figure on the page follows it. */
export function PeriodBar({
  value,
  onChange,
}: {
  value: SalesPeriod;
  onChange: (p: SalesPeriod) => void;
}) {
  const t = useTranslations('dashboard.period');
  return (
    <div
      role='group'
      aria-label={t('label')}
      className='inline-flex flex-wrap gap-xs rounded-full bg-primary-500/[0.06] p-xxs'
    >
      {SALES_PERIODS.map(period => (
        <button
          key={period}
          type='button'
          aria-pressed={value === period}
          onClick={() => onChange(period)}
          className={`min-h-11 rounded-full px-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            value === period
              ? 'bg-primary-500 text-white'
              : 'text-primary-500/70 hover:text-primary-500'
          }`}
        >
          {t(period)}
        </button>
      ))}
    </div>
  );
}
