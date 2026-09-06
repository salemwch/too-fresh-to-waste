'use client';

import { useMemo, useState } from 'react';
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
  WalletBalanceCard,
  FundLedgerCard,
} from '@/components/dashboard/merchant';
import { useOrderStats, useRevenueChart, useMyEstablishment } from '@/hooks/use-merchant-dashboard';
import { type DatePreset, PRESET_CONFIG } from '@/types/dashboard';

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

      {/* ── Payout balance ── */}
      <WalletBalanceCard />

      {/* ── Impact KPI cards ── */}
      {orderStatsQuery.isLoading ? (
        <ImpactCardsSkeleton />
      ) : (
        <ImpactCards stats={orderStatsQuery.data} />
      )}

      {/* ── Community fund ledger ── */}
      <FundLedgerCard />

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
