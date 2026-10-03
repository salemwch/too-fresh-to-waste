'use client';

import { Suspense } from 'react';
import { useLocale, useTranslations } from 'next-intl';
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
  PeriodBar,
  TrendChart,
  TrendChartSkeleton,
  TrendChartError,
} from '@/components/dashboard/merchant';
import { useFormat } from '@/lib/use-format';
import {
  useBusinessMetrics,
  useCustomerLocations,
  useMyEstablishments,
} from '@/hooks/use-merchant-dashboard';
import { useSalesChart } from '@/hooks/use-merchant-sales';
import { useSalesPeriod } from '@/hooks/use-sales-period';
import type { BusinessMetrics, CustomerLocationItem } from '@/types/dashboard';
import type { MerchantSalesChart } from '@/types/payments';

/** Stable identity - `chartQuery.data?.slots ?? []` would allocate a new array every render. */
const EMPTY_SLOTS = Object.freeze([]) as unknown as MerchantSalesChart['slots'];

function formatCurrency(v: number | undefined): string {
  const n = v ?? 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
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
    trend === 'up' ? 'text-brand-green' : trend === 'down' ? 'text-red-500' : 'text-primary-500/40';

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
  const fmt = useFormat();
  const cards: Omit<KpiCardProps, 'index'>[] = [
    {
      title: t('kpi.revenue'),
      value: formatCurrency(data.totalEarnings?.value),
      unit: 'TND',
      trend: data.totalEarnings?.trend,
      changePercent: data.totalEarnings?.changePercentage,
      icon: DollarSign,
    },
    {
      title: t('kpi.totalOrders'),
      value: fmt.compact(data.totalOrders?.value),
      trend: data.totalOrders?.trend,
      changePercent: data.totalOrders?.changePercentage,
      icon: ShoppingBag,
    },
    {
      title: t('kpi.avgFoodValue'),
      value: formatCurrency(data.averageFoodValue?.value),
      unit: 'TND',
      trend: data.averageFoodValue?.trend,
      changePercent: data.averageFoodValue?.changePercentage,
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
      value: fmt.compact(data.foodWasteSaved?.value),
      unit: 'kg',
      trend: data.foodWasteSaved?.trend,
      changePercent: data.foodWasteSaved?.changePercentage,
      icon: Leaf,
    },
    {
      title: t('kpi.co2Avoided'),
      value: fmt.compact(data.carbonFootprintReduced?.value),
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
  const fmt = useFormat();
  if (!data) {
    return (
      <div className='glass rounded-2xl p-[24px] shadow-soft h-[300px] animate-pulse bg-white/30' />
    );
  }

  const metrics = [
    {
      icon: Leaf,
      label: t('sustainability.foodSaved'),
      value: fmt.compact(data.foodWasteSaved.value),
      unit: 'kg',
    },
    {
      icon: Wind,
      label: t('sustainability.co2Avoided'),
      value: fmt.compact(data.carbonFootprintReduced.value),
      unit: 'kg',
    },
    {
      icon: Droplets,
      label: t('sustainability.waterSaved'),
      value: fmt.compact(data.waterSaved.value),
      unit: 'L',
    },
    {
      icon: Zap,
      label: t('sustainability.energySaved'),
      value: fmt.compact(data.energySaved.value),
      unit: 'kWh',
    },
    {
      icon: Package,
      label: t('sustainability.packagingSaved'),
      value: fmt.compact(data.packagingSaved.value),
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
      className='flex items-center gap-md rounded-xl bg-destructive/10 border border-destructive/20 p-[16px]'
    >
      <AlertCircle size={18} className='text-destructive shrink-0' />
      <p className='text-sm text-destructive'>{message}</p>
    </motion.div>
  );
}

// ─── Main Analytics Page ────────────────────────────────────────────────────
// Reads `period` from the URL (`useSalesPeriod`) - the same five periods and
// the same earnings calculation as the Dashboard and Payments.

function AnalyticsPageContent() {
  const t = useTranslations('dashboard.analytics');
  const locale = useLocale();
  const [period, setPeriod] = useSalesPeriod();

  const metricsQuery = useBusinessMetrics(period);
  const chartQuery = useSalesChart(period);
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
          <PeriodBar value={period} onChange={setPeriod} />
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

          {chartQuery.isLoading ? (
            <TrendChartSkeleton />
          ) : chartQuery.isError ? (
            <TrendChartError />
          ) : (
            <TrendChart
              slots={chartQuery.data?.slots ?? EMPTY_SLOTS}
              granularity={chartQuery.data?.granularity ?? 'day'}
              locale={locale}
            />
          )}
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

function AnalyticsPageSkeleton() {
  return (
    <div className='flex flex-col gap-[24px] p-[24px]'>
      <div className='glass rounded-2xl shadow-soft h-[64px] animate-pulse bg-white/30' />
      <KpiCardsSkeleton />
      <TrendChartSkeleton />
    </div>
  );
}

// Suspense boundary: useSalesPeriod reads useSearchParams.
export function AnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsPageSkeleton />}>
      <AnalyticsPageContent />
    </Suspense>
  );
}
