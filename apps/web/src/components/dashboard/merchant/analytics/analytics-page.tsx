'use client';

import { useState, useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceDot,
} from 'recharts';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  ShoppingBag,
  BarChart3,
  Percent,
  Leaf,
  Droplets,
  Zap,
  Package,
  MapPin,
  AlertCircle,
  Wind,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LocationSwitcher } from '@/components/dashboard/organization/location-switcher';
import {
  useBusinessMetrics,
  useRevenueChart,
  useCustomerLocations,
  useMyEstablishments,
} from '@/hooks/use-merchant-dashboard';
import type {
  AnalyticsPeriod,
  BusinessMetrics,
  RevenueChartItem,
  CustomerLocationItem,
} from '@/types/dashboard';

// ─── Date period utilities ──────────────────────────────────────────────────

function getChartParams(period: AnalyticsPeriod) {
  switch (period) {
    case 'today':
      return { granularity: 'day' as const, value: 1 };
    case '7d':
      return { granularity: 'day' as const, value: 7 };
    case '30d':
      return { granularity: 'day' as const, value: 30 };
    case '90d':
      return { granularity: 'week' as const, value: 12 };
    default:
      return { granularity: 'day' as const, value: 30 };
  }
}

function getPeriodDates(period: AnalyticsPeriod): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case '7d':
      start.setDate(end.getDate() - 7);
      break;
    case '30d':
      start.setDate(end.getDate() - 30);
      break;
    case '90d':
      start.setDate(end.getDate() - 90);
      break;
    default:
      start.setDate(end.getDate() - 30);
  }
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

function formatCurrency(v: number | undefined): string {
  const n = v ?? 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

function formatNumber(v: number | undefined): string {
  const n = v ?? 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ─── Period Filter ──────────────────────────────────────────────────────────

const PERIODS: AnalyticsPeriod[] = ['today', '7d', '30d', '90d'];

function PeriodFilter({
  active,
  onChange,
  t,
}: {
  active: AnalyticsPeriod;
  onChange: (p: AnalyticsPeriod) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const labels: Record<AnalyticsPeriod, string> = {
    today: t('periodToday'),
    '7d': t('period7d'),
    '30d': t('period30d'),
    '90d': t('period90d'),
    custom: t('periodCustom'),
  };

  return (
    <div className='flex items-center gap-sm text-xs'>
      {PERIODS.map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-md py-1.5 rounded-full transition-colors ${
            active === p
              ? 'bg-primary-500 text-white'
              : 'text-primary-500/60 hover:text-primary-500'
          }`}
        >
          {labels[p]}
        </button>
      ))}
    </div>
  );
}

// ─── KPI Card ───────────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string;
  value: string;
  unit?: string;
  trend: 'up' | 'down' | 'stable';
  changePercent?: number | undefined;
  icon: React.ElementType;
  index: number;
}

function KpiCard({ title, value, unit, trend, changePercent, icon: Icon, index }: KpiCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up' ? 'text-brand-coral' : trend === 'down' ? 'text-red-500' : 'text-primary-500/40';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.06, duration: 0.5, ease: 'easeOut' }}
      className='glass rounded-2xl p-[24px] shadow-soft relative overflow-hidden group'
    >
      <div className='absolute -top-6xl -right-6xl h-32 w-32 rounded-full bg-brand-coral/10 blur-2xl group-hover:bg-brand-coral/20 transition-colors pointer-events-none' />

      <div className='relative flex items-start justify-between mb-[16px]'>
        <div className='h-11 w-11 rounded-xl bg-primary-500/[0.08] grid place-items-center text-primary-500'>
          <Icon size={20} />
        </div>
        {changePercent !== undefined && (
          <div className={`flex items-center gap-xs text-[11px] font-medium ${trendColor}`}>
            <TrendIcon size={12} />
            {Math.abs(changePercent).toFixed(1)}%
          </div>
        )}
      </div>

      <div className='relative'>
        <div className='text-xs uppercase tracking-wider text-primary-500/60 mb-sm'>{title}</div>
        <div className='flex items-baseline gap-1.5'>
          <span className='font-display text-3xl text-primary-500 tracking-tight'>{value}</span>
          {unit && <span className='text-sm text-primary-500/60 font-medium'>{unit}</span>}
        </div>
      </div>
    </motion.div>
  );
}

function KpiCardsSkeleton() {
  return (
    <div className='grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-[20px]'>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className='glass rounded-2xl p-[24px] shadow-soft h-[160px] animate-pulse bg-white/30'
        />
      ))}
    </div>
  );
}

// ─── KPI Cards Grid ─────────────────────────────────────────────────────────

function KpiCards({ data, t }: { data: BusinessMetrics; t: ReturnType<typeof useTranslations> }) {
  const cards: Omit<KpiCardProps, 'index'>[] = [
    {
      title: t('kpi.revenue'),
      value: formatCurrency(data.totalRevenue?.value),
      unit: 'TND',
      trend: data.totalRevenue?.trend,
      changePercent: data.totalRevenue?.changePercentage,
      icon: DollarSign,
    },
    {
      title: t('kpi.totalOrders'),
      value: formatNumber(data.totalOrders?.value),
      trend: data.totalOrders?.trend,
      changePercent: data.totalOrders?.changePercentage,
      icon: ShoppingBag,
    },
    {
      title: t('kpi.avgOrderValue'),
      value: formatCurrency(data.averageOrderValue?.value),
      unit: 'TND',
      trend: data.averageOrderValue?.trend,
      changePercent: data.averageOrderValue?.changePercentage,
      icon: BarChart3,
    },
    {
      title: t('kpi.conversionRate'),
      value: `${(data.conversionRate?.value ?? 0).toFixed(1)}%`,
      trend: data.conversionRate?.trend,
      changePercent: data.conversionRate?.changePercentage,
      icon: Percent,
    },
    {
      title: t('kpi.foodSaved'),
      value: formatNumber(data.foodWasteSaved?.value),
      unit: 'kg',
      trend: data.foodWasteSaved?.trend,
      changePercent: data.foodWasteSaved?.changePercentage,
      icon: Leaf,
    },
    {
      title: t('kpi.co2Avoided'),
      value: formatNumber(data.carbonFootprintReduced?.value),
      unit: 'kg',
      trend: data.carbonFootprintReduced?.trend,
      changePercent: data.carbonFootprintReduced?.changePercentage,
      icon: Wind,
    },
  ];

  return (
    <div className='grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-[20px]'>
      {cards.map((card, i) => (
        <KpiCard key={card.title} {...card} index={i} />
      ))}
    </div>
  );
}

// ─── Revenue Chart ──────────────────────────────────────────────────────────

function RevenueTooltip({ active, payload, label, t }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className='glass rounded-xl px-[16px] py-md shadow-elegant'>
      <div className='text-[10px] uppercase tracking-wider text-primary-500/60'>{label}</div>
      <div className='font-display text-xl text-primary-500'>
        {(payload[0].value ?? 0).toFixed(2)} TND
      </div>
      {payload[0].payload?.orderCount !== undefined && (
        <div className='text-[11px] font-medium text-brand-coral mt-xs'>
          {t('revenueChart.tooltip.orders')}: {payload[0].payload.orderCount}
        </div>
      )}
    </div>
  );
}

function RevenueChart({
  data,
  t,
}: {
  data: RevenueChartItem[];
  t: ReturnType<typeof useTranslations>;
}) {
  const peak = data.reduce(
    (max, d) => (d.revenue > max.revenue ? d : max),
    data[0] ?? { label: '', revenue: 0 },
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5, ease: 'easeOut' }}
      className='glass rounded-2xl p-[24px] shadow-soft'
    >
      <div className='mb-[24px]'>
        <div className='text-xs uppercase tracking-wider text-primary-500/60 mb-xs'>
          {t('revenueChart.subtitle')}
        </div>
        <h3 className='font-display text-2xl text-primary-500'>{t('revenueChart.title')}</h3>
      </div>

      {data.length === 0 ? (
        <div className='h-64 flex items-center justify-center text-primary-500/40 text-sm'>
          {t('noData')}
        </div>
      ) : (
        <div className='h-64 -ms-sm'>
          <ResponsiveContainer width='100%' height='100%' minWidth={0} minHeight={0}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id='revenueGradient' x1='0' y1='0' x2='0' y2='1'>
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
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'rgba(30,68,72,0.6)', fontSize: 11 }}
                tickFormatter={v => formatCurrency(v)}
              />
              <Tooltip
                content={<RevenueTooltip t={t} />}
                cursor={{ stroke: 'rgba(30,68,72,0.2)', strokeDasharray: '4 4' }}
              />
              <Area
                type='monotone'
                dataKey='revenue'
                stroke='#1E4448'
                strokeWidth={2.5}
                fill='url(#revenueGradient)'
              />
              {peak.revenue > 0 && (
                <ReferenceDot
                  x={peak.label}
                  y={peak.revenue}
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
    </motion.div>
  );
}

// ─── Orders Chart ───────────────────────────────────────────────────────────

function OrdersChart({
  data,
  t,
}: {
  data: RevenueChartItem[];
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.5, ease: 'easeOut' }}
      className='glass rounded-2xl p-[24px] shadow-soft'
    >
      <div className='mb-[24px]'>
        <div className='text-xs uppercase tracking-wider text-primary-500/60 mb-xs'>
          {t('ordersChart.subtitle')}
        </div>
        <h3 className='font-display text-2xl text-primary-500'>{t('ordersChart.title')}</h3>
      </div>

      {data.length === 0 ? (
        <div className='h-64 flex items-center justify-center text-primary-500/40 text-sm'>
          {t('noData')}
        </div>
      ) : (
        <div className='h-64 -ms-sm'>
          <ResponsiveContainer width='100%' height='100%' minWidth={0} minHeight={0}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis
                dataKey='label'
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'rgba(30,68,72,0.6)', fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'rgba(30,68,72,0.6)', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '12px',
                  border: 'none',
                  background: 'rgba(255,255,255,0.85)',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 8px 32px rgba(30,68,72,0.08)',
                }}
              />
              <Bar dataKey='orderCount' fill='#1E4448' radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}

// ─── Customer Locations ─────────────────────────────────────────────────────

function CustomerLocations({
  data,
  isLoading,
  t,
}: {
  data: CustomerLocationItem[] | undefined;
  isLoading: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  if (isLoading) {
    return (
      <div className='glass rounded-2xl p-[24px] shadow-soft'>
        <div className='h-6 w-40 rounded bg-white/30 animate-pulse mb-sm' />
        <div className='h-4 w-60 rounded bg-white/30 animate-pulse mb-[24px]' />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className='h-10 rounded bg-white/30 animate-pulse mb-md' />
        ))}
      </div>
    );
  }

  const locations = data ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
      className='glass rounded-2xl p-[24px] shadow-soft'
    >
      <div className='flex items-center gap-md mb-[24px]'>
        <div className='h-11 w-11 rounded-xl bg-primary-500/[0.08] grid place-items-center text-primary-500'>
          <MapPin size={20} />
        </div>
        <div>
          <h3 className='font-display text-2xl text-primary-500'>{t('customerLocations.title')}</h3>
          <p className='text-xs text-primary-500/60'>{t('customerLocations.subtitle')}</p>
        </div>
      </div>

      {locations.length === 0 ? (
        <div className='flex flex-col items-center justify-center py-6xl gap-md text-center'>
          <MapPin size={32} className='text-primary-500/30' />
          <p className='text-sm text-primary-500/60'>{t('customerLocations.noData')}</p>
        </div>
      ) : (
        <div className='space-y-[16px]'>
          {locations.map((loc, i) => {
            const maxCount = locations[0]?.count ?? 1;
            const pct = maxCount > 0 ? (loc.count / maxCount) * 100 : 0;
            return (
              <motion.div
                key={loc.city}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.06, duration: 0.4 }}
                className='flex items-center gap-md'
              >
                <span className='text-xs font-semibold text-primary-500/40 w-5 text-end'>
                  {i + 1}
                </span>
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center justify-between mb-1.5'>
                    <span className='text-sm font-medium text-primary-500 truncate'>
                      {loc.city}
                    </span>
                    <span className='text-xs text-primary-500/60 ms-sm'>
                      {loc.count} {t('customerLocations.orders')}
                    </span>
                  </div>
                  <div className='h-[6px] rounded-full bg-primary-500/[0.08] overflow-hidden'>
                    <motion.div
                      className='h-full rounded-full bg-brand-coral'
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1.2, ease: 'easeOut', delay: 0.4 + i * 0.08 }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ─── Sustainability Panel ───────────────────────────────────────────────────

function SustainabilityPanel({
  data,
  t,
}: {
  data: BusinessMetrics | undefined;
  t: ReturnType<typeof useTranslations>;
}) {
  if (!data) {
    return (
      <div className='glass rounded-2xl p-[24px] shadow-soft h-[300px] animate-pulse bg-white/30' />
    );
  }

  const metrics = [
    {
      icon: Leaf,
      label: t('sustainability.foodSaved'),
      value: formatNumber(data.foodWasteSaved.value),
      unit: 'kg',
    },
    {
      icon: Wind,
      label: t('sustainability.co2Avoided'),
      value: formatNumber(data.carbonFootprintReduced.value),
      unit: 'kg',
    },
    {
      icon: Droplets,
      label: t('sustainability.waterSaved'),
      value: formatNumber(data.waterSaved.value),
      unit: 'L',
    },
    {
      icon: Zap,
      label: t('sustainability.energySaved'),
      value: formatNumber(data.energySaved.value),
      unit: 'kWh',
    },
    {
      icon: Package,
      label: t('sustainability.packagingSaved'),
      value: formatNumber(data.packagingSaved.value),
      unit: 'kg',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
      className='glass rounded-2xl p-[24px] shadow-soft'
    >
      <div className='mb-[24px]'>
        <div className='text-xs uppercase tracking-wider text-primary-500/60 mb-xs'>
          {t('sustainability.subtitle')}
        </div>
        <h3 className='font-display text-2xl text-primary-500'>{t('sustainability.title')}</h3>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[16px]'>
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.06, duration: 0.4 }}
              className='flex items-center gap-md rounded-xl bg-primary-500/[0.04] p-[16px] group'
            >
              <div className='h-11 w-11 rounded-xl bg-primary-500/[0.08] grid place-items-center text-primary-500 group-hover:bg-brand-coral/10 transition-colors'>
                <Icon size={20} />
              </div>
              <div>
                <div className='text-xs uppercase tracking-wider text-primary-500/60'>
                  {m.label}
                </div>
                <div className='flex items-baseline gap-xs'>
                  <span className='font-display text-2xl text-primary-500'>{m.value}</span>
                  <span className='text-sm text-primary-500/60 font-medium'>{m.unit}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Error State ────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className='flex items-center gap-md rounded-xl bg-brand-coral/10 border border-brand-coral/20 p-[16px]'
    >
      <AlertCircle size={18} className='text-brand-coral shrink-0' />
      <p className='text-sm text-brand-coral'>{message}</p>
    </motion.div>
  );
}

// ─── Chart Skeleton ─────────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <div className='glass rounded-2xl p-[24px] shadow-soft h-[360px] animate-pulse bg-white/30' />
  );
}

// ─── Main Analytics Page ────────────────────────────────────────────────────

export function AnalyticsPage() {
  const t = useTranslations('dashboard.analytics');
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');

  const { startDate, endDate } = useMemo(() => getPeriodDates(period), [period]);
  const chartParams = useMemo(() => getChartParams(period), [period]);

  const metricsQuery = useBusinessMetrics(startDate, endDate);
  const chartQuery = useRevenueChart(chartParams.granularity, chartParams.value);
  const locationsQuery = useCustomerLocations(5);
  const establishmentsQuery = useMyEstablishments();

  const showLocationSwitcher = establishmentsQuery.data && establishmentsQuery.data.length > 1;

  return (
    <div className='flex flex-col gap-[24px] p-[24px]'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row sm:items-start justify-between gap-[16px]'>
        <div>
          <div className='text-xs uppercase tracking-[0.18em] text-primary-500/60 mb-sm'>
            {t('subtitle')}
          </div>
          <h1 className='font-display text-3xl md:text-4xl text-primary-500'>{t('title')}</h1>
        </div>
        <div className='flex items-center gap-md flex-wrap'>
          {showLocationSwitcher && <LocationSwitcher />}
          <PeriodFilter active={period} onChange={setPeriod} t={t} />
        </div>
      </div>

      {/* Error state */}
      {metricsQuery.isError && <ErrorState message={t('error')} />}

      <Tabs defaultValue='overview'>
        <TabsList className='mb-[16px]'>
          <TabsTrigger value='overview'>{t('tabs.overview')}</TabsTrigger>
          <TabsTrigger value='customers'>{t('tabs.customers')}</TabsTrigger>
          <TabsTrigger value='sustainability'>{t('tabs.sustainability')}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value='overview' className='flex flex-col gap-[24px] mt-0'>
          {metricsQuery.isLoading ? (
            <KpiCardsSkeleton />
          ) : metricsQuery.data ? (
            <KpiCards data={metricsQuery.data} t={t} />
          ) : null}

          <div className='grid grid-cols-1 lg:grid-cols-2 gap-[20px]'>
            {chartQuery.isLoading ? (
              <>
                <ChartSkeleton />
                <ChartSkeleton />
              </>
            ) : chartQuery.data ? (
              <>
                <RevenueChart data={chartQuery.data} t={t} />
                <OrdersChart data={chartQuery.data} t={t} />
              </>
            ) : (
              <>
                <RevenueChart data={[]} t={t} />
                <OrdersChart data={[]} t={t} />
              </>
            )}
          </div>
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value='customers' className='mt-0'>
          <CustomerLocations
            data={locationsQuery.data}
            isLoading={locationsQuery.isLoading}
            t={t}
          />
        </TabsContent>

        {/* Sustainability Tab */}
        <TabsContent value='sustainability' className='mt-0'>
          <SustainabilityPanel data={metricsQuery.data} t={t} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
