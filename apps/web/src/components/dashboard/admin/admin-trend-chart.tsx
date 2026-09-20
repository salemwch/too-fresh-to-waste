'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingDown, TrendingUp } from 'lucide-react';

import { Skeleton } from '@foodwaste/ui';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface TrendPoint {
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  orders: number;
  revenue: number;
}

type Series = 'revenue' | 'orders';

interface AdminTrendChartProps {
  data: TrendPoint[];
  series: Series;
  title: string;
  isLoading?: boolean;
  emptyLabel: string;
}

/**
 * Platform trend over the selected period.
 *
 * ## Why this exists
 *
 * The admin area had no chart of any kind. Every figure was a single number,
 * which can say "what is it now" but never "is it getting better or worse" -
 * and the second question is the one that changes what an admin does.
 *
 * The series is `orders.orderTrends[]`, which `PlatformAnalytics` has always
 * returned and the dashboard discarded. No new endpoint, no new query.
 *
 * ## Reading the numbers honestly
 *
 * The delta compares the **last point to the first**, and is labelled with the
 * period rather than a hardcoded "vs last week" - the old KPI chips said "vs
 * last week" even when Year was selected, and one of them had `direction: 'up'`
 * hardcoded so it could never show a decline.
 *
 * Fewer than two points cannot describe a trend, so the delta is suppressed
 * rather than shown as 0%.
 */
export function AdminTrendChart({
  data,
  series,
  title,
  isLoading = false,
  emptyLabel,
}: AdminTrendChartProps) {
  const locale = useLocale();

  const { chartData, delta } = useMemo(() => {
    // Recharts renders points in array order; the API does not promise one.
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

    const first = sorted[0]?.[series];
    const last = sorted.at(-1)?.[series];

    return {
      chartData: sorted,
      delta:
        sorted.length >= 2 && typeof first === 'number' && typeof last === 'number' && first > 0
          ? ((last - first) / first) * 100
          : null,
    };
  }, [data, series]);

  const formatValue = (value: number): string =>
    series === 'revenue' ? formatMoney(locale, value) : new Intl.NumberFormat(locale).format(value);

  if (isLoading) {
    return (
      <div className='border-border bg-card rounded-lg border p-lg'>
        <Skeleton className='h-5 w-40' />
        <Skeleton className='mt-lg h-[200px] w-full' />
      </div>
    );
  }

  return (
    <div className='border-border bg-card rounded-lg border p-lg'>
      <div className='flex items-baseline justify-between gap-sm'>
        <h3 className='font-semibold'>{title}</h3>

        {delta !== null && (
          <span
            className={cn(
              'flex items-center gap-xs text-sm font-semibold tabular-nums',
              delta >= 0 ? 'text-success' : 'text-destructive',
            )}
          >
            {delta >= 0 ? (
              <TrendingUp aria-hidden='true' className='size-4' />
            ) : (
              <TrendingDown aria-hidden='true' className='size-4' />
            )}
            {delta >= 0 ? '+' : ''}
            {delta.toFixed(1)}%
          </span>
        )}
      </div>

      {chartData.length === 0 ? (
        <p className='text-muted-foreground py-4xl text-center text-sm'>{emptyLabel}</p>
      ) : (
        <div className='mt-lg h-[200px] w-full'>
          <ResponsiveContainer width='100%' height='100%'>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`adminTrend-${series}`} x1='0' y1='0' x2='0' y2='1'>
                  {/* Brand teal, via the CSS variable rather than a literal, so
                      it follows the theme instead of pinning a hex. */}
                  <stop offset='0%' stopColor='hsl(var(--primary))' stopOpacity={0.24} />
                  <stop offset='100%' stopColor='hsl(var(--primary))' stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray='3 3' stroke='hsl(var(--border))' vertical={false} />

              <XAxis
                dataKey='date'
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                // Day and month only: a full ISO date per tick is unreadable at
                // this width and forces recharts to drop most of them anyway.
                tickFormatter={(value: string) =>
                  new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
                }
                minTickGap={24}
              />

              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value: number) =>
                  value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value)
                }
              />

              <Tooltip
                cursor={{ stroke: 'hsl(var(--border))' }}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--card))',
                  fontSize: 12,
                }}
                /*
                 * Recharts types both callbacks loosely - `labelFormatter`
                 * receives `ReactNode` and `formatter` receives
                 * `ValueType | undefined`. Narrowing here rather than casting:
                 * a tooltip on a gap in the series really can arrive with no
                 * value, and formatting `undefined` would print "NaN TND".
                 */
                labelFormatter={label =>
                  typeof label === 'string' || typeof label === 'number'
                    ? new Date(label).toLocaleDateString(locale, {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : ''
                }
                formatter={value => [typeof value === 'number' ? formatValue(value) : '-', title]}
              />

              <Area
                type='monotone'
                dataKey={series}
                stroke='hsl(var(--primary))'
                strokeWidth={2}
                fill={`url(#adminTrend-${series})`}
                // The dashboard polls; animating on every refetch is a flicker.
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
