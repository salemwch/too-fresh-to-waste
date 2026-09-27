'use client';

import { Suspense, useState } from 'react';
import { useLocale } from 'next-intl';

import { useAuthStore } from '@/lib/auth';
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
  SmartPricingPanel,
  EarningsCard,
  FundLedgerCard,
  CommissionCard,
  PeriodBar,
} from '@/components/dashboard/merchant';
import { useOrderStats, useMyEstablishment } from '@/hooks/use-merchant-dashboard';
import { useSalesChart, useSalesSummary } from '@/hooks/use-merchant-sales';
import { useSalesPeriod } from '@/hooks/use-sales-period';

function MerchantDashboardContent() {
  useAuthStore(state => state.user); // subscribe so re-renders on user change
  const locale = useLocale();

  const [panelOpen, setPanelOpen] = useState(false);
  const [period, setPeriod] = useSalesPeriod();

  const orderStatsQuery = useOrderStats();
  const summaryQuery = useSalesSummary(period);
  const chartQuery = useSalesChart(period);
  const myEstablishmentQuery = useMyEstablishment();

  const isTrialSuspended = myEstablishmentQuery.data?.subscriptionStatus === 'suspended';

  return (
    <div className='space-y-[32px]'>
      {/* Surprise bag creation panel (portal-rendered) */}
      <SurpriseBagPanel open={panelOpen} onClose={() => setPanelOpen(false)} />

      {/* ── Welcome header: greeting + ESG badge + goal progress ── */}
      <DashboardWelcomeHeader establishment={myEstablishmentQuery.data} />

      {/* ── One period bar; every period-based figure below follows it ── */}
      <PeriodBar value={period} onChange={setPeriod} />

      {/* ── Daily listing streak ── */}
      <StreakWidget onListOffer={() => setPanelOpen(true)} disabled={isTrialSuspended} />

      {/* ── Earnings for the period + commission statement ── */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-[24px]'>
        <EarningsCard period={period} />
        <CommissionCard />
      </div>

      {/* ── Impact KPI cards ── */}
      {orderStatsQuery.isLoading ? (
        <ImpactCardsSkeleton />
      ) : (
        <ImpactCards stats={orderStatsQuery.data} summary={summaryQuery.data} />
      )}

      {/* ── Community fund ledger ── */}
      <FundLedgerCard />

      {/* ── Trend chart + Campaign side panel ── */}
      <div className='grid grid-cols-1 xl:grid-cols-3 gap-[24px]'>
        <div className='xl:col-span-2'>
          {chartQuery.isLoading ? (
            <TrendChartSkeleton />
          ) : (
            <TrendChart
              slots={chartQuery.data?.slots ?? []}
              granularity={chartQuery.data?.granularity ?? 'day'}
              locale={locale}
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

function MerchantDashboardSkeleton() {
  return (
    <div className='space-y-[32px]'>
      <div className='glass rounded-2xl shadow-soft h-[96px] animate-pulse bg-white/30' />
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-[24px]'>
        <div className='glass rounded-2xl shadow-soft h-[320px] animate-pulse bg-white/30' />
        <div className='glass rounded-2xl shadow-soft h-[320px] animate-pulse bg-white/30' />
      </div>
      <ImpactCardsSkeleton />
      <TrendChartSkeleton />
    </div>
  );
}

// Suspense boundary: useSalesPeriod reads useSearchParams.
export default function MerchantDashboardPage() {
  return (
    <Suspense fallback={<MerchantDashboardSkeleton />}>
      <MerchantDashboardContent />
    </Suspense>
  );
}
