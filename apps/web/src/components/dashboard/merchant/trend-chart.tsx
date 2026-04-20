'use client';

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
import type { RevenueChartItem, DatePreset } from '@/types/dashboard';

interface TrendChartProps {
  data: RevenueChartItem[];
  datePreset: DatePreset;
  onDatePresetChange: (preset: DatePreset) => void;
}

function CustomTooltip({ active, payload, label, bagsUnit, peakLabel }: any) {
  if (!active || !payload?.length) return null;
  const v: number = payload[0].value;
  const dataArr: { v: number }[] = payload[0].payload ? [{ v }] : [{ v }];
  const isRecord = v === Math.max(...dataArr.map((d: { v: number }) => d.v));
  return (
    <div className='glass rounded-xl px-[16px] py-3 shadow-elegant'>
      <div className='text-[10px] uppercase tracking-wider text-primary-500/60'>{label}</div>
      <div className='font-display text-xl text-primary-500'>
        {v} {bagsUnit}
      </div>
      {isRecord && v > 0 && (
        <div className='mt-1 text-[11px] font-medium text-brand-coral'>{peakLabel}</div>
      )}
    </div>
  );
}

const RANGE_KEYS: DatePreset[] = ['7d', '30d', '12m'];

export function TrendChart({ data, datePreset, onDatePresetChange }: TrendChartProps) {
  const t = useTranslations('dashboard.trendChart');

  const chartData = data.map(item => ({ day: item.label, v: item.bagCount }));
  const peak = chartData.reduce(
    (max, d) => (d.v > max.v ? d : max),
    chartData[0] ?? { day: '', v: 0 },
  );

  return (
    <div className='glass rounded-2xl p-[24px] shadow-soft'>
      <div className='flex items-start justify-between mb-[24px] flex-wrap gap-3'>
        <div>
          <div className='text-xs uppercase tracking-wider text-primary-500/60 mb-1'>
            {t('subtitle')}
          </div>
          <h3 className='font-display text-2xl text-primary-500'>{t('title')}</h3>
        </div>
        <div className='flex items-center gap-2 text-xs'>
          {RANGE_KEYS.map(key => (
            <button
              key={key}
              onClick={() => onDatePresetChange(key)}
              className={`px-3 py-1.5 rounded-full transition-colors ${
                datePreset === key
                  ? 'bg-primary-500 text-white'
                  : 'text-primary-500/60 hover:text-primary-500'
              }`}
            >
              {t(`periods.${key}`)}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className='h-64 flex items-center justify-center text-primary-500/40 text-sm'>
          {t('noData')}
        </div>
      ) : (
        <div className='h-64 -ml-2'>
          <ResponsiveContainer width='100%' height='100%'>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id='areaFill' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='0%' stopColor='#1E4448' stopOpacity={0.45} />
                  <stop offset='100%' stopColor='#1E4448' stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey='day'
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'rgba(30,68,72,0.6)', fontSize: 12 }}
              />
              <YAxis hide />
              <Tooltip
                content={<CustomTooltip bagsUnit={t('bagsUnit')} peakLabel={t('peakLabel')} />}
                cursor={{ stroke: 'rgba(30,68,72,0.2)', strokeDasharray: '4 4' }}
              />
              <Area
                type='monotone'
                dataKey='v'
                stroke='#1E4448'
                strokeWidth={2.5}
                fill='url(#areaFill)'
              />
              {peak.v > 0 && (
                <ReferenceDot
                  x={peak.day}
                  y={peak.v}
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
