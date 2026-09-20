'use client';

import { useCallback, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Building2, Flag, LifeBuoy, Receipt, ShoppingBag, Store, TrendingUp } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AdminAlertBand,
  ALERT_ICONS,
  type AdminAlert,
} from '@/components/dashboard/admin/admin-alert-band';
import { AdminErrorState } from '@/components/dashboard/admin/admin-error-state';
import { AdminKpiRow, type KpiItem } from '@/components/dashboard/admin/admin-kpi-row';
import { AdminTrendChart, type TrendPoint } from '@/components/dashboard/admin/admin-trend-chart';
import { AdminWorkQueue, type WorkQueueItem } from '@/components/dashboard/admin/admin-work-queue';
import { ActivityFeed } from '@/components/dashboard/admin/activity-feed';
import { WasteImpactBanner } from '@/components/dashboard/admin/waste-impact-banner';
import {
  useAdminOrderStats,
  useAnomalies,
  useHealth,
  useModerationStats,
  usePendingApprovals,
  usePlatformAnalytics,
  useRecentActivity,
  useTicketStats,
} from '@/hooks/use-admin';
import { useCommissionSummary } from '@/hooks/use-commission';
import { formatMoney } from '@/lib/format';
import type { AnalyticsPeriod } from '@/types/admin';

/**
 * Admin dashboard - a triage screen, not a summary.
 *
 * ## What changed and why
 *
 * The previous version opened with five equal-weight KPI tiles. DESIGN.md §17
 * rules that out directly: "a grid of identical stat tiles with no ranking is a
 * data dump, not a dashboard. Lead with the number that drives a decision."
 * Totals do not drive decisions - exceptions and queues do.
 *
 * So the order is now strictly by what an admin can act on:
 *
 *   1. ALERTS      only rendered when something is wrong; invisible otherwise
 *   2. WORK QUEUE  what is waiting, each tile a link into that queue
 *   3. METRICS     three ranked figures plus a real trend line
 *   4. CONTEXT     impact and activity, below the fold
 *
 * ## The period selector now means something
 *
 * It previously reached 3 of 9 data sources, and the change chips said
 * "vs last week" even when Year was selected - one of them had
 * `direction: 'up'` hardcoded, so it could never show a decline. Trend is now
 * read from the chart's own series over the selected period, and figures that
 * cannot honour the period are not dressed up with a delta at all.
 *
 * ## Every section handles failure
 *
 * The previous page read `isError` exactly zero times across nine queries, so a
 * failed request rendered identically to an empty platform. Each block now
 * distinguishes the two.
 */
export default function AdminDashboardPage() {
  const t = useTranslations('adminDashboard');
  const locale = useLocale();
  const [period, setPeriod] = useState<AnalyticsPeriod>('week');

  // ── Data ───────────────────────────────────────────────────────────────────

  const analytics = usePlatformAnalytics(period);
  const commission = useCommissionSummary();
  const health = useHealth();
  const anomalies = useAnomalies();
  const orderStats = useAdminOrderStats();
  const moderation = useModerationStats();
  const approvals = usePendingApprovals(6);
  const tickets = useTicketStats();
  const activity = useRecentActivity(24 * 7, 10);

  const retryMetrics = useCallback(() => {
    void analytics.refetch();
  }, [analytics]);

  const retryQueue = useCallback(() => {
    void approvals.refetch();
    void moderation.refetch();
    void orderStats.refetch();
    void tickets.refetch();
  }, [approvals, moderation, orderStats, tickets]);

  // ── Alerts: only what is actually wrong ────────────────────────────────────

  const alerts = useMemo<AdminAlert[]>(() => {
    const list: AdminAlert[] = [];

    // The ledger and the running balances are two independent records of the
    // same money. A drift means one of them lost some, and nothing else in the
    // product would notice.
    if (commission.data && !commission.data.reconciled) {
      list.push({
        id: 'reconciliation',
        severity: 'critical',
        icon: ALERT_ICONS.reconciliation,
        title: t('alerts.reconcileTitle'),
        detail: t('alerts.reconcileDetail', {
          delta: formatMoney(locale, commission.data.reconciliationDelta),
        }),
        href: '/admin/commission',
        actionLabel: t('alerts.reconcileAction'),
      });
    }

    /*
     * Health has two distinct bad states and the old widget conflated them.
     * On a failed request `indicators` was `{}`, and `[].every()` is `true`, so
     * it rendered "All systems go" at precisely the moment health was unknown.
     */
    if (health.isError) {
      list.push({
        id: 'health-unknown',
        severity: 'critical',
        icon: ALERT_ICONS.health,
        title: t('alerts.healthUnknownTitle'),
        detail: t('alerts.healthUnknownDetail'),
        href: '/admin/health',
        actionLabel: t('alerts.healthAction'),
      });
    } else if (health.data?.error && Object.keys(health.data.error).length > 0) {
      list.push({
        id: 'health-down',
        severity: 'critical',
        icon: ALERT_ICONS.health,
        title: t('alerts.healthTitle'),
        detail: t('alerts.healthDetail', { services: Object.keys(health.data.error).join(', ') }),
        href: '/admin/health',
        actionLabel: t('alerts.healthAction'),
      });
    }

    const critical = anomalies.data?.filter(a => a.severity === 'critical') ?? [];
    if (critical.length > 0) {
      list.push({
        id: 'anomalies',
        severity: 'critical',
        icon: ALERT_ICONS.anomaly,
        title: t('alerts.anomalyTitle', { count: critical.length }),
        detail: t('alerts.anomalyDetail', { first: critical[0]?.title ?? '' }),
        href: '/admin/orders',
        actionLabel: t('alerts.anomalyAction'),
      });
    }

    // 2% is the threshold the orders page already treats as normal; above it,
    // something systemic is usually wrong rather than a run of bad luck.
    const disputeRate = orderStats.data?.disputeRate ?? 0;
    if (disputeRate > 2) {
      list.push({
        id: 'disputes',
        severity: 'warning',
        icon: ALERT_ICONS.disputes,
        title: t('alerts.disputesTitle'),
        detail: t('alerts.disputesDetail', { rate: disputeRate.toFixed(1) }),
        href: '/admin/orders?tab=disputes',
        actionLabel: t('alerts.disputesAction'),
      });
    }

    return list;
  }, [commission.data, health.isError, health.data, anomalies.data, orderStats.data, t, locale]);

  // ── Queues ────────────────────────────────────────────────────────────────

  const queueItems = useMemo<WorkQueueItem[]>(() => {
    const nothing = t('queue.nothing');
    const hint = (count: number | undefined, label: string) => (count === 0 ? nothing : label);

    const approvalCount = approvals.data?.length;
    const reportCount = moderation.data?.pendingReports;
    const disputeCount = orderStats.data?.countByStatus?.['disputed'];
    const ticketCount = tickets.data?.open;

    return [
      {
        id: 'approvals',
        label: t('queue.approvals'),
        count: approvalCount,
        icon: Store,
        href: '/admin/establishments',
        hint: hint(approvalCount, t('queue.approvalsHint')),
      },
      {
        id: 'reports',
        label: t('queue.reports'),
        count: reportCount,
        icon: Flag,
        href: '/admin/moderation',
        hint: hint(reportCount, t('queue.reportsHint')),
      },
      {
        id: 'disputes',
        label: t('queue.disputes'),
        count: disputeCount,
        icon: ShoppingBag,
        href: '/admin/orders?tab=disputes',
        hint: hint(disputeCount, t('queue.disputesHint')),
      },
      {
        id: 'tickets',
        label: t('queue.tickets'),
        count: ticketCount,
        icon: LifeBuoy,
        href: '/admin/support-tickets',
        hint: hint(ticketCount, t('queue.ticketsHint')),
      },
    ];
  }, [approvals.data, moderation.data, orderStats.data, tickets.data, t]);

  const queueFailed =
    approvals.isError && moderation.isError && orderStats.isError && tickets.isError;

  // ── Metrics: three, ranked, not five equal ────────────────────────────────

  const kpis = useMemo<KpiItem[]>(() => {
    const a = analytics.data;

    return [
      {
        label: t('metrics.gmv'),
        value: a ? formatMoney(locale, a.revenue.totalRevenue) : '-',
        icon: TrendingUp,
        iconBg: 'bg-primary-500/10',
        iconColor: 'text-primary-500',
        highlight: true,
      },
      {
        label: t('metrics.orders'),
        value: a ? new Intl.NumberFormat(locale).format(a.orders.totalOrders) : '-',
        icon: ShoppingBag,
        iconBg: 'bg-secondary/15',
        iconColor: 'text-secondary',
      },
      {
        // Previously computed by the backend and never rendered anywhere.
        label: t('metrics.commission'),
        value: a ? formatMoney(locale, a.revenue.platformCommission) : '-',
        icon: Receipt,
        iconBg: 'bg-success/10',
        iconColor: 'text-success',
      },
      {
        label: t('metrics.merchants'),
        value: a
          ? new Intl.NumberFormat(locale).format(a.establishments.activeEstablishments)
          : '-',
        icon: Building2,
        iconBg: 'bg-muted',
        iconColor: 'text-muted-foreground',
      },
    ];
  }, [analytics.data, locale, t]);

  /** `orderTrends` has always been returned and was always discarded. */
  const trend = useMemo<TrendPoint[]>(
    () => analytics.data?.orders.orderTrends ?? [],
    [analytics.data],
  );

  const impact = analytics.data?.offers.wasteReductionImpact;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className='flex flex-col gap-2xl'>
      <header className='flex flex-col gap-sm sm:flex-row sm:items-start sm:justify-between'>
        <div className='min-w-0'>
          <h1 className='font-heading text-2xl leading-tight'>{t('title')}</h1>
          <p className='text-muted-foreground mt-xxs text-sm'>{t('subtitle')}</p>
        </div>

        <Select value={period} onValueChange={value => setPeriod(value as AnalyticsPeriod)}>
          <SelectTrigger className='w-40 shrink-0'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(['day', 'week', 'month', 'quarter', 'year', 'all'] as const).map(value => (
              <SelectItem key={value} value={value}>
                {t(`period.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      {/* 1. Only present when something is wrong. */}
      <AdminAlertBand alerts={alerts} />

      {/* 2. What is waiting. */}
      <section className='flex flex-col gap-md'>
        <h2 className='text-sm font-semibold uppercase tracking-wide text-muted-foreground'>
          {t('queue.title')}
        </h2>

        {queueFailed ? (
          <AdminErrorState
            title={t('errors.queueTitle')}
            description={t('errors.queueBody')}
            retryLabel={t('errors.retry')}
            onRetry={retryQueue}
          />
        ) : (
          <AdminWorkQueue items={queueItems} />
        )}
      </section>

      {/* 3. How the platform is doing. */}
      {analytics.isError ? (
        <AdminErrorState
          variant='block'
          title={t('errors.metricsTitle')}
          description={t('errors.metricsBody')}
          retryLabel={t('errors.retry')}
          onRetry={retryMetrics}
        />
      ) : (
        <div className='flex flex-col gap-lg'>
          <AdminKpiRow items={kpis} loading={analytics.isLoading} columns={4} />

          <div className='grid grid-cols-1 gap-lg xl:grid-cols-2'>
            <AdminTrendChart
              data={trend}
              series='revenue'
              title={t('charts.revenue')}
              isLoading={analytics.isLoading}
              emptyLabel={t('charts.empty')}
            />
            <AdminTrendChart
              data={trend}
              series='orders'
              title={t('charts.orders')}
              isLoading={analytics.isLoading}
              emptyLabel={t('charts.empty')}
            />
          </div>
        </div>
      )}

      {/* 4. Context, below the fold. */}
      <WasteImpactBanner
        kgSaved={impact?.totalKgSaved ?? 0}
        mealsSaved={impact?.totalMealsSaved ?? 0}
        co2Reduced={impact?.co2ReductionKg ?? 0}
        waterSaved={impact?.waterLitersSaved ?? 0}
        kgSavedLabel={t('impact.kg')}
        mealsSavedLabel={t('impact.meals')}
        co2ReducedLabel={t('impact.co2')}
        waterSavedLabel={t('impact.water')}
        title={t('impact.title')}
        subtitle={t('impact.subtitle')}
        loading={analytics.isLoading}
      />

      <section className='border-border bg-card rounded-lg border p-lg'>
        <h2 className='font-semibold'>{t('activity.title')}</h2>
        <p className='text-muted-foreground mt-xxs mb-md text-sm'>{t('activity.subtitle')}</p>
        <ActivityFeed
          activities={activity.data?.activities ?? []}
          loading={activity.isLoading}
          emptyTitle={t('activity.emptyTitle')}
          emptyDescription={t('activity.emptyBody')}
        />
      </section>
    </div>
  );
}
