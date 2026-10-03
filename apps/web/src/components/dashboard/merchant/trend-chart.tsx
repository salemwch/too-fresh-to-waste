'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceDot,
} from 'recharts';
import { useTranslations } from 'next-intl';

import { formatMoney } from '@/lib/format';
import type { MerchantSalesChart } from '@/types/payments';

type ChartSlot = MerchantSalesChart['slots'][number];
type Granularity = MerchantSalesChart['granularity'];

interface TrendChartProps {
  slots: ChartSlot[];
  granularity: Granularity;
  locale: string;
}

interface ChartPoint {
  label: string;
  earned: number;
  bags: number;
}

/** Reduce seed for an empty chart - never mutated, so it is a stable identity. */
const EMPTY_POINT: ChartPoint = Object.freeze({ label: '', earned: 0, bags: 0 });

/** X-axis label for one slot, in the merchant's own timezone regardless of the browser's. */
function formatSlotLabel(locale: string, start: string, granularity: Granularity): string {
  const options: Intl.DateTimeFormatOptions =
    granularity === 'hour'
      ? // `hourCycle: 'h23'` is required: 'en' defaults `hour: '2-digit'` to
        // 12-hour ("12 AM"), not the 24-hour "00" an hourly slot needs.
        { hour: '2-digit', hourCycle: 'h23' }
      : granularity === 'day'
        ? { day: 'numeric', month: 'short' }
        : { month: 'short', year: '2-digit' };
  return new Intl.DateTimeFormat(locale, { timeZone: 'Africa/Tunis', ...options }).format(
    new Date(start),
  );
}

function CustomTooltip({
  active,
  payload,
  locale,
  bagsUnit,
  peakLabel,
  isPeak,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
  locale: string;
  bagsUnit: string;
  peakLabel: string;
  isPeak: (point: ChartPoint) => boolean;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className='glass rounded-xl px-[16px] py-md shadow-elegant'>
      <div className='text-[10px] uppercase tracking-wider text-primary-500/60'>{point.label}</div>
      <div className='font-display text-xl text-primary-500'>
        {formatMoney(locale, point.earned, 'TND')}
      </div>
      <div className='mt-xxs text-[11px] text-primary-500/60'>
        {point.bags} {bagsUnit}
      </div>
      {isPeak(point) && point.earned > 0 && (
        <div className='mt-xs text-[11px] font-medium text-brand-green'>{peakLabel}</div>
      )}
    </div>
  );
}

export function TrendChart({ slots, granularity, locale }: TrendChartProps) {
  const t = useTranslations('dashboard.trendChart');

  // Arabic reads right-to-left; Recharts does not mirror the x-axis on its
  // own, so the slots are reversed for `ar` alone - earliest slot still
  // reads first for the direction the locale is read in.
  const orderedSlots = useMemo(
    () => (locale === 'ar' ? [...slots].reverse() : slots),
    [slots, locale],
  );

  const chartData = useMemo<ChartPoint[]>(
    () =>
      orderedSlots.map(slot => ({
        label: formatSlotLabel(locale, slot.start, granularity),
        earned: slot.earned,
        bags: slot.bags,
      })),
    [orderedSlots, granularity, locale],
  );

  // `salesSlots` (backend) always returns at least one slot, so
  // `chartData.length === 0` can never actually happen - the real "nothing to
  // show" signal is every slot sitting at zero.
  const isEmpty = chartData.every(point => point.earned === 0 && point.bags === 0);

  const peak = useMemo(
    () =>
      chartData.reduce((max, d) => (d.earned > max.earned ? d : max), chartData[0] ?? EMPTY_POINT),
    [chartData],
  );

  return (
    <div className='glass rounded-2xl p-[24px] shadow-soft'>
      <div className='flex items-start justify-between mb-[24px] flex-wrap gap-md'>
        <div>
          <div className='text-xs uppercase tracking-wider text-primary-500/60 mb-xs'>
            {t('subtitle')}
          </div>
          <h3 className='font-display text-2xl text-primary-500'>{t('title')}</h3>
        </div>
      </div>

      {isEmpty ? (
        <div className='h-64 flex items-center justify-center text-primary-500/40 text-sm'>
          {t('noData')}
        </div>
      ) : (
        <div className='h-64 -ms-sm'>
          <ResponsiveContainer width='100%' height='100%'>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id='areaFill' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='0%' stopColor='#1E4448' stopOpacity={0.45} />
                  <stop offset='100%' stopColor='#1E4448' stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey='label'
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'rgba(30,68,72,0.6)', fontSize: 12 }}
              />
              <YAxis hide />
              <Tooltip
                content={
                  <CustomTooltip
                    locale={locale}
                    bagsUnit={t('bagsUnit')}
                    peakLabel={t('peakLabel')}
                    isPeak={point => point === peak}
                  />
                }
                cursor={{ stroke: 'rgba(30,68,72,0.2)', strokeDasharray: '4 4' }}
              />
              <Area
                type='monotone'
                dataKey='earned'
                stroke='#1E4448'
                strokeWidth={2.5}
                fill='url(#areaFill)'
              />
              {peak.earned > 0 && (
                <ReferenceDot
                  x={peak.label}
                  y={peak.earned}
                  r={6}
                  fill='#FF7973'
                  stroke='white'
                  strokeWidth={2}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function TrendChartSkeleton() {
  return (
    <div className='glass rounded-2xl p-[24px] shadow-soft h-[360px] animate-pulse bg-white/30' />
  );
}

/** A failed `useSalesChart` - distinct from `noData`, which is a legitimately empty period. */
export function TrendChartError() {
  const t = useTranslations('dashboard.trendChart');
  return (
    <div
      data-testid='trend-chart-error'
      className='glass rounded-2xl p-[24px] shadow-soft h-[360px] flex items-center justify-center'
    >
      <p className='text-sm text-primary-500/65'>{t('error')}</p>
    </div>
  );
}
