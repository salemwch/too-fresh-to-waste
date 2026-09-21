import { renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';

import { MISSING_COUNT } from '../format';
import { useFormat } from '../use-format';

/**
 * `useFormat` - the `format*` helpers with the current locale bound.
 *
 * The helpers themselves are covered in `format.test.ts`. What is verified
 * here is the wiring, which is where this can silently go wrong: that the hook
 * picks up the locale from context rather than a default, that it re-binds
 * when the locale changes, and that its identity is stable so consumers that
 * list it in a dependency array do not recompute on every render.
 */

const ISO = '2026-03-12T14:05:09.000Z';

function wrapperFor(locale: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    // `messages` is required by the provider but unused here - nothing in this
    // hook reads a translation.
    return (
      <NextIntlClientProvider locale={locale} messages={{}}>
        {children}
      </NextIntlClientProvider>
    );
  };
}

describe('useFormat', () => {
  it('formats in the locale from context, not a hardcoded default', () => {
    const en = renderHook(() => useFormat(), { wrapper: wrapperFor('en') });
    const fr = renderHook(() => useFormat(), { wrapper: wrapperFor('fr') });

    // The whole point of the hook. If it ignored context, these would match.
    expect(en.result.current.date(ISO)).not.toBe(fr.result.current.date(ISO));
    expect(en.result.current.date(ISO)).toContain('Mar');
    expect(fr.result.current.date(ISO)).toContain('mars');
  });

  it('re-binds when the locale changes', () => {
    // `renderHook`'s wrapper does not receive `initialProps`, so the locale is
    // held in a closure the wrapper reads on each render instead.
    let locale = 'en';
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <NextIntlClientProvider locale={locale} messages={{}}>
        {children}
      </NextIntlClientProvider>
    );

    const { result, rerender } = renderHook(() => useFormat(), { wrapper: Wrapper });
    const inEnglish = result.current.date(ISO);

    locale = 'fr';
    rerender();

    expect(inEnglish).toContain('Mar');
    expect(result.current.date(ISO)).toContain('mars');
    expect(result.current.date(ISO)).not.toBe(inEnglish);
  });

  it('keeps one identity across renders at the same locale', () => {
    // Consumers list `fmt` in useMemo/useCallback dependency arrays. A fresh
    // object each render invalidates every one of them -
    // .claude/rules/performance.md rule 1.
    const { result, rerender } = renderHook(() => useFormat(), {
      wrapper: wrapperFor('en'),
    });

    const first = result.current;
    rerender();
    rerender();

    expect(result.current).toBe(first);
  });

  describe('exposes every formatter', () => {
    it.each([
      'count',
      'compact',
      'decimal',
      'date',
      'dateShort',
      'dateShortTime',
      'dateTime',
      'time',
      'relative',
      'money',
    ])('%s', name => {
      // Rendered inside the test, not at describe time: a hook rendered during
      // collection runs outside the test's lifecycle and leaks between cases.
      const { result } = renderHook(() => useFormat(), { wrapper: wrapperFor('en') });

      expect(typeof (result.current as Record<string, unknown>)[name]).toBe('function');
    });
  });

  describe('null handling matches the underlying helpers', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['an unparseable string', 'not a date'],
    ])('date returns null for %s so the caller can use its own copy', (_label, value) => {
      const { result } = renderHook(() => useFormat(), { wrapper: wrapperFor('en') });

      expect(result.current.date(value as never)).toBeNull();
    });

    it('count resolves a missing value itself', () => {
      // Asymmetric with `date` on purpose: a count is either known or not,
      // there is no third rendering, so it answers rather than deferring.
      const { result } = renderHook(() => useFormat(), { wrapper: wrapperFor('en') });

      expect(result.current.count(undefined)).toBe(MISSING_COUNT);
      expect(result.current.count(null)).toBe(MISSING_COUNT);
    });

    it('accepts Date and epoch milliseconds as well as ISO strings', () => {
      const { result } = renderHook(() => useFormat(), { wrapper: wrapperFor('en') });
      const asString = result.current.date(ISO);

      expect(result.current.date(new Date(ISO))).toBe(asString);
      expect(result.current.date(new Date(ISO).getTime())).toBe(asString);
    });
  });

  it('passes the seconds option through to time()', () => {
    const { result } = renderHook(() => useFormat(), { wrapper: wrapperFor('en') });

    expect(result.current.time(ISO, { seconds: true })).not.toBe(result.current.time(ISO));
  });

  it('passes the precision through to decimal()', () => {
    const { result } = renderHook(() => useFormat(), { wrapper: wrapperFor('en') });

    expect(result.current.decimal(1.55, 0)).toBe('2');
    expect(result.current.decimal(1.55, 2)).toBe('1.55');
  });

  it('passes the currency through to money()', () => {
    const { result } = renderHook(() => useFormat(), { wrapper: wrapperFor('en') });

    expect(result.current.money(10, 'EUR')).toContain('€');
    // Defaults to TND, which carries three decimals.
    expect(result.current.money(10)).toContain('10.000');
  });
});
