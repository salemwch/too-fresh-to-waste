'use client';

import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

import { usePathname, useRouter } from '@/i18n/routing';
import { DEFAULT_SALES_PERIOD, parseSalesPeriod } from '@/lib/sales-period';
import type { SalesPeriod } from '@/types/payments';

/**
 * The period lives in the URL (?period=month): reload and shared links keep
 * it. It is page state, not a remembered preference, so not a cookie.
 */
export function useSalesPeriod(): [SalesPeriod, (next: SalesPeriod) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const period = parseSalesPeriod(params.get('period'));

  const setPeriod = useCallback(
    (next: SalesPeriod) => {
      const query = new URLSearchParams(params.toString());
      if (next === DEFAULT_SALES_PERIOD) {
        query.delete('period');
      } else {
        query.set('period', next);
      }
      const qs = query.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return [period, setPeriod];
}
