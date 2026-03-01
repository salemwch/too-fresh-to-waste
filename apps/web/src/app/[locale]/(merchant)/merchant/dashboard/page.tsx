'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/lib/auth';
import { DollarSign, ShoppingBag, Package, Zap } from 'lucide-react';
import {
  StatsCards,
  RevenueChart,
  CustomersByLocation,
  TrendingOffers,
  RecentOrdersPanel,
  DateFilter,
  StatsCardsSkeleton,
  RevenueChartSkeleton,
  PanelSkeleton,
  SurpriseBagPanel,
  type StatCardItem,
  type RevenueChartData,
  type LocationItem,
  type TrendingOfferItem,
  type RecentOrderItem,
} from '@/components/dashboard/merchant';
import {
  useOrderStats,
  useMerchantRecentOrders,
  useMerchantOffers,
  useActiveOfferCount,
  useRevenueChart,
  useCustomerLocations,
} from '@/hooks/use-merchant-dashboard';
import {
  type DatePreset,
  type ChartGranularity,
  type OrderStatsResponse,
  type MerchantOrder,
  type MerchantOffer,
  type RevenueChartItem,
  type CustomerLocationItem,
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
  const revenueSparkline = chartItems.slice(-8).map((m) => m.revenue);

  return [
    {
      label: t('merchant.totalRevenue'),
      value: formatCurrency(stats.totalRevenue),
      icon: DollarSign,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      trend: {
        value: stats.totalOrders > 0
          ? Number(((stats.completedOrders / stats.totalOrders) * 100).toFixed(1))
          : 0,
        suffix: '%',
        direction: stats.completedOrders > 0 ? 'up' : 'down',
        label: `${stats.completedOrders} ${t('merchant.completed')}`,
      },
      ...(revenueSparkline.length >= 2 ? { sparkline: revenueSparkline } : {}),
    },
    {
      label: t('merchant.bagsSaved'),
      value: stats.completedOrders.toLocaleString(),
      icon: ShoppingBag,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      trend: {
        value: stats.cancelledOrders,
        direction: stats.cancelledOrders === 0 ? 'up' : 'down',
        label: `${stats.cancelledOrders} ${t('merchant.cancelled')}`,
      },
    },
    {
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
  day:   'vs previous day',
  week:  'vs previous week',
  month: 'vs previous month',
};

function buildRevenueChartData(
  items: RevenueChartItem[],
  stats: OrderStatsResponse,
  granularity: ChartGranularity,
): RevenueChartData {
  const totalRevenue  = items.reduce((sum, m) => sum + m.revenue, 0);
  const activePeriods = items.filter((m) => m.revenue > 0).length || 1;
  const avgIncome     = totalRevenue / activePeriods;

  const lastPeriod = items[items.length - 1]?.revenue ?? 0;
  const prevPeriod = items[items.length - 2]?.revenue ?? 0;
  const trendPct   = prevPeriod > 0
    ? Number((((lastPeriod - prevPeriod) / prevPeriod) * 100).toFixed(2))
    : 0;

  const cancelledValue = stats.cancelledOrders * stats.averageOrderValue;

  return {
    months: items.map((m) => ({ label: m.label, value: m.revenue })),
    averageIncome: formatCompactCurrency(avgIncome),
    trend: {
      value:     Math.abs(trendPct),
      direction: trendPct >= 0 ? 'up' : 'down',
      label:     CHART_VS_LABEL[granularity],
    },
    summary: {
      expenses: formatCompactCurrency(cancelledValue),
      income:   formatCompactCurrency(totalRevenue),
      profit:   formatCompactCurrency(Math.max(0, totalRevenue - cancelledValue)),
    },
  };
}

const LOCATION_COLORS: Array<{ color: string; textColor: string }> = [
  { color: 'bg-blue-100',    textColor: 'text-blue-700' },
  { color: 'bg-purple-100',  textColor: 'text-purple-700' },
  { color: 'bg-orange-100',  textColor: 'text-orange-700' },
  { color: 'bg-emerald-100', textColor: 'text-emerald-700' },
  { color: 'bg-rose-100',    textColor: 'text-rose-700' },
];

function buildLocations(data: CustomerLocationItem[]): LocationItem[] {
  return data.map((loc, i) => {
    const colors = LOCATION_COLORS[i % LOCATION_COLORS.length]!;
    return { name: loc.city, value: loc.count, ...colors };
  });
}

function buildTrendingOffers(offers: MerchantOffer[]): TrendingOfferItem[] {
  return offers.map((offer) => ({
    id: offer.id,
    name: offer.title,
    image: offer.image || '/images/bag.png',
    price: formatCurrency(offer.pricing.discountedPrice),
    rating: offer.establishment.averageRating ?? 0,
    orderCount: offer.availableQuantity,
  }));
}

function buildRecentOrders(orders: MerchantOrder[]): RecentOrderItem[] {
  return orders.map((order) => {
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
    <div className="bg-red-50 border border-red-200 rounded-lg px-6 py-4 text-center max-w-md mx-auto mt-4">
      <p className="text-sm font-medium text-red-800">Failed to load dashboard data</p>
      <p className="text-xs text-red-600 mt-1">{message}</p>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MerchantDashboardPage() {
  const t = useTranslations('dashboard');
  const user = useAuthStore((state) => state.user);

  // ── Panel state ─────────────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false);

  // ── Global date filter ──────────────────────────────────────────────────
  const [datePreset, setDatePreset] = useState<DatePreset>('9m');

  /** Derive granularity and slot-count from the selected preset. */
  const { granularity, value } = PRESET_CONFIG[datePreset];

  /**
   * Start of the visible window, midnight local time.
   * Used to scope orderStats and customerLocations to the same window as the chart.
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
  const orderStatsQuery    = useOrderStats(startDate);
  const revenueQuery       = useRevenueChart(granularity, value);
  const locationsQuery     = useCustomerLocations(5, startDate);
  // Recent orders and active offers are always "current" — not time-scoped
  const recentOrdersQuery  = useMerchantRecentOrders(1, 6);
  const offersQuery        = useMerchantOffers(1, 8);
  const activeOfferCountQuery = useActiveOfferCount();

  // ── Data transformation (memoised) ─────────────────────────────────────
  const stats = useMemo(() => {
    if (!orderStatsQuery.data) return null;
    const activeCount  = activeOfferCountQuery.data ?? 0;
    const chartItems   = revenueQuery.data ?? [];
    return buildStatsCards(orderStatsQuery.data, activeCount, chartItems, t);
  }, [orderStatsQuery.data, activeOfferCountQuery.data, revenueQuery.data, t]);

  const revenueData = useMemo(() => {
    if (!revenueQuery.data || !orderStatsQuery.data) return null;
    return buildRevenueChartData(revenueQuery.data, orderStatsQuery.data, granularity);
  }, [revenueQuery.data, orderStatsQuery.data, granularity]);

  const locations = useMemo(() => {
    if (!locationsQuery.data) return [];
    return buildLocations(locationsQuery.data);
  }, [locationsQuery.data]);

  const trendingOffers = useMemo(() => {
    if (!offersQuery.data?.offers) return [];
    return buildTrendingOffers(offersQuery.data.offers);
  }, [offersQuery.data]);

  const recentOrders = useMemo(() => {
    if (!recentOrdersQuery.data?.orders) return [];
    return buildRecentOrders(recentOrdersQuery.data.orders);
  }, [recentOrdersQuery.data]);


  const statusLabels = {
    pending:   t('merchant.pending'),
    confirmed: t('merchant.confirmed'),
    picked_up: t('merchant.pickedUp'),
    expired:   t('merchant.expired'),
    cancelled: t('merchant.cancelled'),
  } as const;

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Surprise Bag panel (portal-rendered) */}
      <SurpriseBagPanel open={panelOpen} onClose={() => setPanelOpen(false)} />

      {/* ── Critical error (stats unavailable) ── */}
      {orderStatsQuery.error && (
        <DashboardError message={(orderStatsQuery.error as Error).message} />
      )}

      {/*
       * ── Header row (mirrors the 12-col grid so the button lands above Active Offers) ──
       * Left 8-col: welcome text + ⚡ button  |  Right 4-col: invisible spacer
       * This keeps Recent Orders vertically aligned with the KPI cards below.
       */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 xl:col-span-9 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-1.5">
              {t('welcome', { name: user?.firstName ?? '' })}
              <Image
                src="/icons/Blue Bold Modern How to Get Verified Instagram Post.svg"
                alt="Verified"
                width={20}
                height={20}
                className="h-5 w-5 shrink-0"
              />
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('merchantDashboardDescription')}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 active:scale-[0.97] transition-all"
          >
            <Zap className="h-4 w-4" />
            Add Surprise Bag
          </button>
        </div>
        {/* Spacer: keeps the grid columns consistent so the header row has the same width as the content grid */}
        <div className="hidden lg:block lg:col-span-4 xl:col-span-3" aria-hidden="true" />
      </div>

      {/* ── 12-column content grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Left column */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-5">

          {/* KPI Stats */}
          {orderStatsQuery.isLoading || !stats
            ? <StatsCardsSkeleton />
            : <StatsCards stats={stats} />}

          {/* Revenue Chart */}
          {revenueQuery.isLoading || !revenueData
            ? <RevenueChartSkeleton />
            : (
              <RevenueChart
                data={revenueData}
                title={t(`merchant.${granularity}Revenue`)}
                avgLabel={t(`merchant.avg${granularity.charAt(0).toUpperCase() + granularity.slice(1)}Income`)}
                vsLabel={t(`merchant.vsPrevious${granularity.charAt(0).toUpperCase() + granularity.slice(1)}`)}
                expensesLabel={t('merchant.totalExpenses')}
                incomeLabel={t('merchant.totalIncome')}
                profitLabel={t('merchant.totalProfit')}
                tooltipLabel={t('merchant.totalIncome')}
                filterSlot={<DateFilter value={datePreset} onChange={setDatePreset} />}
              />
            )}

          {/* Bottom row: Location + Trending */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {locationsQuery.isLoading
              ? <PanelSkeleton rows={5} />
              : (
                <CustomersByLocation
                  locations={locations}
                  title={t('merchant.customersByLocation')}
                />
              )}

            {offersQuery.isLoading
              ? <PanelSkeleton rows={4} />
              : (
                <TrendingOffers
                  offers={trendingOffers}
                  title={t('merchant.trendingOffers')}
                  orderLabel={t('merchant.orderLabel')}
                  viewAllHref="/merchant/offers"
                />
              )}
          </div>
        </div>

        {/* Right sidebar — starts at the same vertical level as KPI cards */}
        <div className="lg:col-span-4 xl:col-span-3">
          {recentOrdersQuery.isLoading
            ? <PanelSkeleton rows={6} />
            : (
              <RecentOrdersPanel
                orders={recentOrders}
                title={t('merchant.recentOrders')}
                statusLabels={statusLabels}
                itemsLabel={t('merchant.items', { count: '{count}' })}
                viewAllHref="/merchant/orders"
              />
            )}
        </div>
      </div>
    </div>
  );
}
