'use client';

import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, Check, Info } from 'lucide-react';
import { usePricingSuggestions } from '@/hooks/use-merchant-dashboard';
import { cn } from '@/lib/utils';

interface PriceGuidanceProps {
  /** What the customer would pay with the currently selected price + discount. */
  discountedPrice: number;
}

/**
 * Price guidance shown next to the price field while a bag is being created.
 *
 * The pricing guide on the dashboard is read long after the pricing decision is
 * made; this puts the same range at the moment it can still change the outcome.
 * It shares `usePricingSuggestions`' query key, so it costs no extra request
 * when the dashboard has already loaded the guide.
 */
export function PriceGuidance({ discountedPrice }: PriceGuidanceProps) {
  const t = useTranslations('dashboard.merchantPricing');
  const { data } = usePricingSuggestions();

  const range = data?.suggestedPriceRange;
  // No history and no peers means no honest range to show. `basis` also guards
  // against an older API build that still returns a range without provenance.
  if (!range?.basis) return null;

  const status =
    discountedPrice <= 0
      ? null
      : discountedPrice < range.min
        ? 'below'
        : discountedPrice > range.max
          ? 'above'
          : 'inRange';

  const StatusIcon = status === 'inRange' ? Check : status === 'below' ? ArrowDown : ArrowUp;

  return (
    <div className='rounded-md border border-slate-200 bg-slate-50 px-sm py-1.5'>
      <p className='flex items-start gap-1.5 text-[11px] text-slate-500'>
        <Info className='mt-px size-3 shrink-0' aria-hidden='true' />
        <span>
          {t(range.basis === 'own_history' ? 'hint.own' : 'hint.zone', {
            min: range.min,
            max: range.max,
          })}
        </span>
      </p>
      {status && (
        <p
          className={cn(
            'mt-xs flex items-center gap-1.5 text-[11px] font-medium',
            status === 'inRange' ? 'text-success' : 'text-warning',
          )}
        >
          <StatusIcon className='size-3 shrink-0' aria-hidden='true' />
          {t(`hint.${status}`)}
        </p>
      )}
    </div>
  );
}
