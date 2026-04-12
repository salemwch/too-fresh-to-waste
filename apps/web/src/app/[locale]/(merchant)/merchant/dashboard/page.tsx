'use client';

import { useCallback, useMemo, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/lib/auth';
import { DollarSign, ShoppingBag, Package, Zap } from 'lucide-react';
import {
  StatsCards,
  RevenueChart,
  RecentOrdersPanel,
  DateFilter,
  StatsCardsSkeleton,
  RevenueChartSkeleton,
  PanelSkeleton,
  SurpriseBagPanel,
  type StatCardItem,
  type RevenueChartData,
  type RecentOrderItem,
  RevenueDetailDialog,
  type RevenueDetailData,
} from '@/components/dashboard/merchant';
import {
  useOrderStats,
  useMerchantRecentOrders,
  useActiveOfferCount,
  useRevenueChart,
  useMyEstablishment,
} from '@/hooks/use-merchant-dashboard';
import {
  type DatePreset,
  type ChartGranularity,
  type OrderStatsResponse,
  type MerchantOrder,
  type RevenueChartItem,
  type OrderStatus as BackendOrderStatus,
  PRESET_CONFIG,
} from '@/types/dashboard';
import { resolveProfileImage } from '@/lib/media';
import type { OrderStatus as UIOrderStatus } from '@/components/dashboard/merchant';

// ─── Formatters ─────────────────────────────────────────────────────────────

const CURRENCY = 'TND';

function formatCurrency(value: number): string {
  return `${value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${CURRENCY}`;
}

function formatCompactCurrency(value: number): string {
  return `${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${CURRENCY}`;
}

/** Abbreviate large values: 1234 → "1.2K", 1500000 → "1.5M", 850 → "850" */
function formatAbbreviatedCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M ${CURRENCY}`;
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K ${CURRENCY}`;
  }
  return `${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${CURRENCY}`;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// ─── Data transformers ──────────────────────────────────────────────────────

const STATUS_MAP: Record<BackendOrderStatus, UIOrderStatus> = {
  pending: 'pending',
  reserved: 'pending',
  confirmed: 'confirmed',
  ready_for_pickup: 'confirmed',
  picked_up: 'picked_up',
  expired: 'expired',
  cancelled: 'cancelled',
  refunded: 'cancelled',
};

function buildStatsCards(
  stats: OrderStatsResponse,
  offerCount: number,
  chartItems: RevenueChartItem[],
  t: ReturnType<typeof useTranslations<'dashboard'>>,
): StatCardItem[] {
  // Sparkline: last 8 revenue values for the Revenue KPI card
  const revenueSparkline = chartItems.slice(-8).map(m => m.revenue);

  return [
    {
      id: 'revenue',
      label: t('merchant.totalRevenue'),
      value: formatAbbreviatedCurrency(stats.totalRevenue),
      icon: DollarSign,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      trend: {
        value:
          stats.totalOrders > 0
            ? Number(((stats.completedOrders / stats.totalOrders) * 100).toFixed(1))
            : 0,
        suffix: '%',
        direction: stats.completedOrders > 0 ? 'up' : 'down',
        label: `${stats.completedOrders} ${t('merchant.completed')}`,
      },
      ...(revenueSparkline.length >= 2 ? { sparkline: revenueSparkline } : {}),
      clickable: true,
    },
    {
      id: 'bags',
      label: t('merchant.bagsSaved'),
      value: (stats.bagsSaved ?? stats.completedOrders).toLocaleString(),
      icon: ShoppingBag,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      trend: {
        value: stats.completedOrders,
        direction: stats.completedOrders > 0 ? 'up' : 'down',
        label: `${stats.completedOrders} ${t('merchant.completed')}`,
      },
    },
    {
      id: 'offers',
      label: t('merchant.activeOffers'),
      value: offerCount.toLocaleString(),
      icon: Package,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      trend: {
        value: stats.totalOrders,
        direction: stats.totalOrders > 0 ? 'up' : 'down',
        label: `${stats.totalOrders} ${t('merchant.totalOrders')}`,
      },
    },
  ];
}

const CHART_VS_LABEL: Record<ChartGranularity, string> = {
  day: 'vs previous day',
  week: 'vs previous week',
  month: 'vs previous month',
};

function buildRevenueChartData(
  items: RevenueChartItem[],
  stats: OrderStatsResponse,
  granularity: ChartGranularity,
): RevenueChartData {
  const totalRevenue = items.reduce((sum, m) => sum + m.revenue, 0);
  const activePeriods = items.filter(m => m.revenue > 0).length || 1;
  const avgIncome = totalRevenue / activePeriods;

  const lastPeriod = items[items.length - 1]?.revenue ?? 0;
  const prevPeriod = items[items.length - 2]?.revenue ?? 0;
  const trendPct =
    prevPeriod > 0 ? Number((((lastPeriod - prevPeriod) / prevPeriod) * 100).toFixed(2)) : 0;

  const cancelledValue = stats.cancelledOrders * stats.averageOrderValue;

  return {
    months: items.map(m => ({ label: m.label, value: m.revenue })),
    averageIncome: formatCompactCurrency(avgIncome),
    trend: {
      value: Math.abs(trendPct),
      direction: trendPct >= 0 ? 'up' : 'down',
      label: CHART_VS_LABEL[granularity],
    },
    summary: {
      expenses: formatCompactCurrency(cancelledValue),
      income: formatCompactCurrency(totalRevenue),
      profit: formatCompactCurrency(Math.max(0, totalRevenue - cancelledValue)),
    },
  };
}

function buildRecentOrders(orders: MerchantOrder[]): RecentOrderItem[] {
  return orders.map(order => {
    const customer = order.customerId;
    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const avatar = resolveProfileImage(customer.profileImage, customer.avatar);
    return {
      id: order._id,
      orderNumber: order.orderNumber,
      customerName: `${customer.firstName} ${customer.lastName}`,
      customerInitials: getInitials(customer.firstName, customer.lastName),
      ...(avatar ? { customerAvatar: avatar } : {}),
      itemCount,
      total: formatCurrency(order.pricing.total),
      status: STATUS_MAP[order.status] ?? 'pending',
      createdAt: order.createdAt,
      timeAgo: timeAgo(order.createdAt),
    };
  });
}

// ─── Error banner ────────────────────────────────────────────────────────────

function DashboardError({ message }: { message: string }) {
  return (
    <div className='bg-red-50 border border-red-200 rounded-lg px-6 py-4 text-center max-w-md mx-auto mt-4'>
      <p className='text-sm font-medium text-red-800'>Failed to load dashboard data</p>
      <p className='text-xs text-red-600 mt-1'>{message}</p>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MerchantDashboardPage() {
  const t = useTranslations('dashboard');
  const user = useAuthStore(state => state.user);

  // ── Panel state ─────────────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false);
  const [revenueDialogOpen, setRevenueDialogOpen] = useState(false);

  // ── Global date filter ──────────────────────────────────────────────────
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');

  /** Derive granularity and slot-count from the selected preset. */
  const { granularity, value } = PRESET_CONFIG[datePreset];

  /**
   * Start of the visible window, midnight local time.
   * Used to scope orderStats to the same window as the chart.
   */
  const startDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (granularity === 'month') {
      d.setMonth(d.getMonth() - value);
      d.setDate(1);
    } else {
      // day → go back `value` days; week → go back `value` weeks
      const days = granularity === 'week' ? value * 7 : value;
      d.setDate(d.getDate() - days);
    }
    return d;
  }, [granularity, value]);

  // ── Data fetching (all scoped to the same time window) ──────────────────
  const orderStatsQuery = useOrderStats(startDate);
  const revenueQuery = useRevenueChart(granularity, value);
  // Recent orders and active offers are always "current" — not time-scoped
  const recentOrdersQuery = useMerchantRecentOrders(1, 5);
  const activeOfferCountQuery = useActiveOfferCount();
  const myEstablishmentQuery = useMyEstablishment();
  const isTrialSuspended = myEstablishmentQuery.data?.subscriptionStatus === 'suspended';
  // ── Data transformation (memoised) ─────────────────────────────────────
  const stats = useMemo(() => {
    if (!orderStatsQuery.data) return null;
    const activeCount = activeOfferCountQuery.data ?? 0;
    const chartItems = revenueQuery.data ?? [];
    return buildStatsCards(orderStatsQuery.data, activeCount, chartItems, t);
  }, [orderStatsQuery.data, activeOfferCountQuery.data, revenueQuery.data, t]);

  const revenueData = useMemo(() => {
    if (!revenueQuery.data || !orderStatsQuery.data) return null;
    return buildRevenueChartData(revenueQuery.data, orderStatsQuery.data, granularity);
  }, [revenueQuery.data, orderStatsQuery.data, granularity]);

  const recentOrders = useMemo(() => {
    if (!recentOrdersQuery.data?.orders) return [];
    return buildRecentOrders(recentOrdersQuery.data.orders);
  }, [recentOrdersQuery.data]);

  // ── Revenue detail popup data ────────────────────────────────────────
  const revenueDetailData = useMemo<RevenueDetailData | null>(() => {
    if (!orderStatsQuery.data) return null;
    const s = orderStatsQuery.data;
    const cfg = PRESET_CONFIG[datePreset];
    return {
      totalRevenue: s.totalRevenue,
      completedOrders: s.completedOrders,
      cancelledOrders: s.cancelledOrders,
      totalOrders: s.totalOrders,
      averageOrderValue: s.averageOrderValue,
      bagsSaved: s.bagsSaved ?? s.completedOrders,
      periodLabel: `Last ${cfg.label} (${cfg.granularity} view)`,
    };
  }, [orderStatsQuery.data, datePreset]);

  const handleStatCardClick = useCallback((id: string) => {
    if (id === 'revenue') setRevenueDialogOpen(true);
  }, []);

  const statusLabels = {
    pending: t('merchant.pending'),
    confirmed: t('merchant.confirmed'),
    picked_up: t('merchant.pickedUp'),
    expired: t('merchant.expired'),
    cancelled: t('merchant.cancelled'),
  } as const;

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className='space-y-5'>
      {/* Surprise Bag panel (portal-rendered) */}
      <SurpriseBagPanel open={panelOpen} onClose={() => setPanelOpen(false)} />

      {/* Revenue breakdown dialog */}
      <RevenueDetailDialog
        open={revenueDialogOpen}
        onOpenChange={setRevenueDialogOpen}
        data={revenueDetailData}
      />

      {/* ── Critical error (stats unavailable) ── */}
      {orderStatsQuery.error && (
        <DashboardError message={(orderStatsQuery.error as Error).message} />
      )}

      {/*
       * ── Header row (mirrors the 12-col grid so the button lands above Active Offers) ──
       * Left 8-col: welcome text + ⚡ button  |  Right 4-col: invisible spacer
       * This keeps Recent Orders vertically aligned with the KPI cards below.
       */}
      <div className='grid grid-cols-1 lg:grid-cols-12 gap-5'>
        <div className='lg:col-span-8 xl:col-span-9 flex items-center justify-between gap-4'>
          <div>
            <h1 className='text-lg font-bold tracking-tight flex items-center gap-1.5'>
              {t('welcome', { name: user?.firstName ?? '' })}
              <Image
                src='/icons/Blue Bold Modern How to Get Verified Instagram Post.svg'
                alt='Verified'
                width={20}
                height={20}
                className='h-5 w-5 shrink-0'
              />
            </h1>
            <p className='text-sm text-muted-foreground'>{t('merchantDashboardDescription')}</p>
          </div>

          <button
            type='button'
            onClick={() => setPanelOpen(true)}
            disabled={isTrialSuspended}
            aria-label={
              isTrialSuspended
                ? 'Creating new offers is paused — your free trial has ended. Contact the admin team to reactivate your account.'
                : 'Add Surprise Bag'
            }
            title={
              isTrialSuspended
                ? 'Your free trial has ended. Contact the admin team to reactivate your account.'
                : undefined
            }
            className='flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:opacity-50 disabled:active:scale-100'
          >
            <Zap className='h-4 w-4' />
            Add Surprise Bag
          </button>
        </div>
        {/* Spacer: keeps the grid columns consistent so the header row has the same width as the content grid */}
        <div className='hidden lg:block lg:col-span-4 xl:col-span-3' aria-hidden='true' />
      </div>

      {/* ── 12-column content grid ── */}
      <div className='grid grid-cols-1 lg:grid-cols-12 gap-5'>
        {/* Left column */}
        <div className='lg:col-span-8 xl:col-span-9 space-y-5'>
          {/* KPI Stats */}
          {orderStatsQuery.isLoading || !stats ? (
            <StatsCardsSkeleton />
          ) : (
            <StatsCards stats={stats} onCardClick={handleStatCardClick} />
          )}

          {/* Revenue Chart */}
          {revenueQuery.isLoading || !revenueData ? (
            <RevenueChartSkeleton />
          ) : (
            <RevenueChart
              data={revenueData}
              title={t(`merchant.${granularity}Revenue`)}
              avgLabel={t(
                `merchant.avg${granularity.charAt(0).toUpperCase() + granularity.slice(1)}Income`,
              )}
              vsLabel={t(
                `merchant.vsPrevious${granularity.charAt(0).toUpperCase() + granularity.slice(1)}`,
              )}
              expensesLabel={t('merchant.totalExpenses')}
              incomeLabel={t('merchant.totalIncome')}
              profitLabel={t('merchant.totalProfit')}
              tooltipLabel={t('merchant.totalIncome')}
              filterSlot={<DateFilter value={datePreset} onChange={setDatePreset} />}
            />
          )}
        </div>

        {/* Right sidebar — starts at the same vertical level as KPI cards */}
        <div className='lg:col-span-4 xl:col-span-3'>
          {recentOrdersQuery.isLoading ? (
            <PanelSkeleton rows={5} />
          ) : (
            <RecentOrdersPanel
              orders={recentOrders}
              title={t('merchant.recentOrders')}
              statusLabels={statusLabels}
              itemsLabel={t('merchant.items', { count: '{count}' })}
              viewAllHref='/merchant/orders'
            />
          )}
        </div>
      </div>
    </div>
  );
}
