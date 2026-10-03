import { act, renderHook } from '@testing-library/react';

import { useSalesPeriod } from '../use-sales-period';

/**
 * The URL round-trip is the entire contract of this hook: preserve whatever
 * else is in the query string, drop `period` when it is the default rather
 * than writing `?period=month`, and never scroll to top on a filter change.
 * period-bar.test.tsx only exercises the presentational component with a
 * fixed `value`/`onChange` - nothing there calls `useSearchParams` or
 * `router.replace`, so a regression in this hook would pass that suite.
 */

const mockReplace = jest.fn();
let mockSearch = '';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

jest.mock('@/i18n/routing', () => ({
  usePathname: () => '/en/merchant/payments',
  useRouter: () => ({ replace: (...args: unknown[]) => mockReplace(...args) }),
}));

describe('useSalesPeriod', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockSearch = '';
  });

  it('defaults to month when the URL has no period param', () => {
    mockSearch = '';
    const { result } = renderHook(() => useSalesPeriod());
    expect(result.current[0]).toBe('month');
  });

  it('falls back to month for an unknown period value', () => {
    mockSearch = 'period=90d';
    const { result } = renderHook(() => useSalesPeriod());
    expect(result.current[0]).toBe('month');
  });

  it('reads a known, non-default period from the URL', () => {
    mockSearch = 'period=7d';
    const { result } = renderHook(() => useSalesPeriod());
    expect(result.current[0]).toBe('7d');
  });

  it('preserves other params and appends period when setting a non-default period', () => {
    mockSearch = 'tab=refunded';
    const { result } = renderHook(() => useSalesPeriod());

    act(() => {
      result.current[1]('7d');
    });

    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/en/merchant/payments?tab=refunded&period=7d', {
      scroll: false,
    });
  });

  it('drops period when set to the default, keeping the other param', () => {
    mockSearch = 'period=7d&tab=refunded';
    const { result } = renderHook(() => useSalesPeriod());

    act(() => {
      result.current[1]('month');
    });

    expect(mockReplace).toHaveBeenCalledWith('/en/merchant/payments?tab=refunded', {
      scroll: false,
    });
  });

  it('replaces with the bare pathname when no params remain', () => {
    mockSearch = 'period=7d';
    const { result } = renderHook(() => useSalesPeriod());

    act(() => {
      result.current[1]('month');
    });

    expect(mockReplace).toHaveBeenCalledWith('/en/merchant/payments', { scroll: false });
  });
});
