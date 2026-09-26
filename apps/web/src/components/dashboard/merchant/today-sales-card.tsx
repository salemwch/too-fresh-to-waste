'use client';

import { ArrowRight, Banknote, CreditCard, ShoppingBag } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { InfoDisclosure } from '@/components/ui/info-disclosure';
import { useTodaySales } from '@/hooks/use-merchant-dashboard';
import { Link } from '@/i18n/routing';
import { formatMoney } from '@/lib/format';

/**
 * Today's sales - the day as the merchant lived it, cash and online together.
 *
 * The wallet card only holds what TFTW collected online; a merchant who sold
 * everything for cash saw 0.00 there and concluded nothing had sold. This card
 * answers "how did today go?" for every payment method.
 *
 * Every money line comes from each order's frozen commission decision
 * (backend `today-sales.util.ts`), so it reconciles with the commission card
 * and never recomputes 19% itself. Each line a merchant could misread carries
 * an info disclosure (DESIGN.md §13.12). Finished days live in Payments.
 */
export function TodaySalesCard() {
  const t = useTranslations('dashboard.todaySales');
  const locale = useLocale();
  const { data, isLoading, isError } = useTodaySales();

  if (isLoading) {
    return (
      <div
        data-testid='today-sales-skeleton'
        className='glass rounded-2xl shadow-soft h-[240px] animate-pulse bg-white/30'
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

  const money = (value: number) => formatMoney(locale, value, data.currency);
  const ratePercent = Math.round(data.rate * 100);
  const hasSales = data.total.orders > 0;

  return (
    <section className='glass rounded-2xl shadow-soft p-lg' aria-labelledby='today-sales-title'>
      <div className='flex items-start justify-between gap-sm mb-md'>
        <div className='flex items-center gap-sm min-w-0'>
          <div className='h-10 w-10 rounded-xl bg-primary-500/[0.08] grid place-items-center text-primary-500 shrink-0'>
            <ShoppingBag size={18} aria-hidden='true' />
          </div>
          <div className='min-w-0'>
            <h2
              id='today-sales-title'
              className='font-heading text-lg text-primary-500 leading-tight'
            >
              {t('title')}
            </h2>
            <p className='text-xs text-primary-500/65 mt-xxs'>{t('subtitle')}</p>
          </div>
        </div>
        <Link
          href='/merchant/payments'
          className='inline-flex min-h-11 items-center gap-xxs text-sm font-medium text-primary-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md shrink-0'
        >
          {t('history')}
          <ArrowRight size={14} aria-hidden='true' className='rtl:rotate-180' />
        </Link>
      </div>

      {hasSales ? (
        <>
          <div className='flex items-baseline gap-sm mb-md'>
            <span className='font-mono text-3xl font-bold tabular-nums text-primary-500'>
              {money(data.total.sales)}
            </span>
            <span className='text-sm text-primary-500/65'>
              {t('orders', { count: data.total.orders })}
            </span>
          </div>

          <div className='grid grid-cols-2 gap-sm mb-md'>
            <div className='rounded-xl bg-primary-500/[0.04] p-sm'>
              <div className='flex items-center gap-xs text-xs text-primary-500/65'>
                <Banknote size={14} aria-hidden='true' />
                {t('cash')}
              </div>
              <div className='mt-xxs font-mono text-base font-semibold tabular-nums text-primary-500'>
                {money(data.cash.sales)}
              </div>
              <div className='text-xs text-primary-500/65'>
                {t('orders', { count: data.cash.orders })}
              </div>
            </div>
            <div className='rounded-xl bg-primary-500/[0.04] p-sm'>
              <div className='flex items-center gap-xs text-xs text-primary-500/65'>
                <CreditCard size={14} aria-hidden='true' />
                {t('online')}
              </div>
              <div className='mt-xxs font-mono text-base font-semibold tabular-nums text-primary-500'>
                {money(data.online.sales)}
              </div>
              <div className='text-xs text-primary-500/65'>
                {t('orders', { count: data.online.orders })}
              </div>
            </div>
          </div>

          <dl className='space-y-sm'>
            <div className='flex items-start justify-between gap-sm'>
              <dt className='text-sm text-primary-500/65'>
                <InfoDisclosure
                  label={<span>{t('commission', { rate: ratePercent })}</span>}
                  buttonLabel={t('commissionInfoLabel')}
                >
                  {t('commissionInfo', { rate: ratePercent })}
                </InfoDisclosure>
              </dt>
              <dd className='font-mono text-sm tabular-nums text-primary-500/65 shrink-0'>
                {money(data.total.commission)}
              </dd>
            </div>

            {data.total.settled > 0 ? (
              <div className='flex items-start justify-between gap-sm'>
                <dt className='text-sm text-primary-500/65'>
                  <InfoDisclosure
                    label={<span>{t('settled')}</span>}
                    buttonLabel={t('settledInfoLabel')}
                  >
                    {t('settledInfo')}
                  </InfoDisclosure>
                </dt>
                <dd className='font-mono text-sm tabular-nums text-primary-500/65 shrink-0'>
                  {money(data.total.settled)}
                </dd>
              </div>
            ) : null}

            <div className='border-t border-primary-500/10 pt-sm flex items-start justify-between gap-sm'>
              <dt className='text-sm font-semibold text-primary-500'>
                <InfoDisclosure label={<span>{t('kept')}</span>} buttonLabel={t('keptInfoLabel')}>
                  {t('keptInfo')}
                </InfoDisclosure>
              </dt>
              <dd className='font-mono text-xl font-bold tabular-nums text-primary-500 shrink-0'>
                {money(data.total.kept)}
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <p className='text-sm text-primary-500/65'>{t('empty')}</p>
      )}

      {data.toCollect.orders > 0 ? (
        <p className='mt-md text-xs text-primary-500/50'>
          {t('toCollect', { count: data.toCollect.orders, amount: money(data.toCollect.sales) })}
        </p>
      ) : null}
    </section>
  );
}
