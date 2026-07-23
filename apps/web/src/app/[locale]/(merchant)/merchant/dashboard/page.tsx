'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/lib/auth';
import {
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  Target,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@foodwaste/ui';
import { Skeleton } from '@/components/ui/skeleton';
import {
  SurpriseBagPanel,
  DashboardWelcomeHeader,
  ImpactCards,
  ImpactCardsSkeleton,
  TrendChart,
  TrendChartSkeleton,
  CampaignSidePanel,
  ReportingBar,
  StreakWidget,
} from '@/components/dashboard/merchant';
import {
  useOrderStats,
  useRevenueChart,
  useMyEstablishment,
  usePricingSuggestions,
} from '@/hooks/use-merchant-dashboard';
import { cn } from '@/lib/utils';
import { type DatePreset, PRESET_CONFIG, type PricingInsight } from '@/types/dashboard';

const INSIGHT_ICONS: Record<string, typeof TrendingUp> = {
  price_above_zone: TrendingDown,
  price_below_zone: TrendingUp,
  low_fill_rate: Target,
  best_day: Calendar,
  best_hour: Clock,
  low_discount: TrendingDown,
};

function SmartPricingPanel() {
  const t = useTranslations('dashboard.merchantPricing');
  const { data, isLoading } = usePricingSuggestions();

  if (isLoading) {
    return (
      <Card className='border-border/60'>
        <CardHeader className='pb-3'>
          <Skeleton className='h-5 w-48 rounded' />
          <Skeleton className='h-3 w-64 rounded mt-1' />
        </CardHeader>
        <CardContent className='space-y-3'>
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className='h-16 rounded-lg' />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!data || (data.insights.length === 0 && data.merchantStats.totalOffers === 0)) {
    return null;
  }

  return (
    <Card className='border-border/60'>
      <CardHeader className='pb-3'>
        <div className='flex items-center gap-2'>
          <Lightbulb className='size-4 text-amber-500' />
          <CardTitle className='text-sm font-semibold'>{t('title')}</CardTitle>
        </div>
        <CardDescription className='text-xs'>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Stats summary */}
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
          <div className='rounded-lg border border-border/60 bg-muted/20 p-3 text-center'>
            <p className='text-lg font-bold tabular-nums'>
              {data.merchantStats.avgDiscountedPrice}{' '}
              <span className='text-xs font-normal'>TND</span>
            </p>
            <p className='text-[10px] text-muted-foreground'>{t('avgPrice')}</p>
          </div>
          <div className='rounded-lg border border-border/60 bg-muted/20 p-3 text-center'>
            <p className='text-lg font-bold tabular-nums'>{data.merchantStats.fillRate}%</p>
            <p className='text-[10px] text-muted-foreground'>{t('fillRate')}</p>
          </div>
          <div className='rounded-lg border border-border/60 bg-muted/20 p-3 text-center'>
            <p className='text-lg font-bold tabular-nums'>
              {data.zoneStats.avgDiscountedPrice} <span className='text-xs font-normal'>TND</span>
            </p>
            <p className='text-[10px] text-muted-foreground'>{t('zoneAvg')}</p>
          </div>
          <div className='rounded-lg border border-border/60 bg-muted/20 p-3 text-center'>
            <p className='text-lg font-bold tabular-nums'>
              {data.suggestedPriceRange.min}–{data.suggestedPriceRange.max}
            </p>
            <p className='text-[10px] text-muted-foreground'>{t('suggestedRange')}</p>
          </div>
        </div>

        {/* Insights */}
        {data.insights.length > 0 && (
          <div className='space-y-2'>
            {data.insights.map((insight: PricingInsight, i: number) => {
              const Icon = INSIGHT_ICONS[insight.type] ?? Lightbulb;
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border px-3 py-2.5',
                    insight.impact === 'high'
                      ? 'border-amber-300/60 bg-amber-50/30'
                      : 'border-border/60 bg-muted/10',
                  )}
                >
                  <Icon
                    className={cn(
                      'size-4 mt-0.5 shrink-0',
                      insight.impact === 'high' ? 'text-amber-600' : 'text-muted-foreground',
                    )}
                  />
                  <div className='min-w-0 flex-1'>
                    <p className='text-xs text-foreground leading-relaxed'>{insight.message}</p>
                  </div>
                  {insight.impact === 'high' && (
                    <ArrowRight className='size-3.5 mt-0.5 shrink-0 text-amber-500' />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MerchantDashboardPage() {
  useAuthStore(state => state.user); // subscribe so re-renders on user change

  const [panelOpen, setPanelOpen] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>('7d');

  const { granularity, value } = PRESET_CONFIG[datePreset];

  const startDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (granularity === 'month') {
      d.setMonth(d.getMonth() - value);
      d.setDate(1);
    } else {
      const days = granularity === 'week' ? value * 7 : value;
      d.setDate(d.getDate() - days);
    }
    return d;
  }, [granularity, value]);

  const orderStatsQuery = useOrderStats(startDate);
  const revenueQuery = useRevenueChart(granularity, value);
  const myEstablishmentQuery = useMyEstablishment();

  const isTrialSuspended = myEstablishmentQuery.data?.subscriptionStatus === 'suspended';

  return (
    <div className='space-y-[32px]'>
      {/* Surprise bag creation panel (portal-rendered) */}
      <SurpriseBagPanel open={panelOpen} onClose={() => setPanelOpen(false)} />

      {/* ── Welcome header: greeting + ESG badge + goal progress ── */}
      <DashboardWelcomeHeader establishment={myEstablishmentQuery.data} />

      {/* ── Daily listing streak ── */}
      <StreakWidget onListOffer={() => setPanelOpen(true)} disabled={isTrialSuspended} />

      {/* ── Impact KPI cards ── */}
      {orderStatsQuery.isLoading ? (
        <ImpactCardsSkeleton />
      ) : (
        <ImpactCards stats={orderStatsQuery.data} />
      )}

      {/* ── Trend chart + Campaign side panel ── */}
      <div className='grid grid-cols-1 xl:grid-cols-3 gap-[24px]'>
        <div className='xl:col-span-2'>
          {revenueQuery.isLoading ? (
            <TrendChartSkeleton />
          ) : (
            <TrendChart
              data={revenueQuery.data ?? []}
              datePreset={datePreset}
              onDatePresetChange={setDatePreset}
            />
          )}
        </div>
        <CampaignSidePanel
          stats={orderStatsQuery.data}
          onLaunchCampaign={() => setPanelOpen(true)}
          isTrialSuspended={isTrialSuspended}
        />
      </div>

      {/* ── Smart Pricing Suggestions ── */}
      <SmartPricingPanel />

      {/* ── PDF carbon report bar ── */}
      <ReportingBar />
    </div>
  );
}
