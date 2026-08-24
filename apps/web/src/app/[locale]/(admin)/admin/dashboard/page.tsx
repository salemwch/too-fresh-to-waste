'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/lib/auth';
import {
  Users,
  Building2,
  ShoppingBag,
  DollarSign,
  Clock,
  Activity,
  Tag,
  CheckCircle2,
  XCircle,
  Zap,
  RefreshCw,
  Download,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@foodwaste/ui';
import {
  AdminStatCard,
  WasteImpactBanner,
  ActivityFeed,
  QuickActions,
  AdminStatGridSkeleton,
  AdminPendingCardsSkeleton,
} from '@/components/dashboard/admin';
import { StatusBadge } from '@/components/dashboard/admin/status-badge';
import { ConfirmActionDialog } from '@/components/dashboard/admin/confirm-action-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  usePlatformAnalytics,
  useRecentActivity,
  usePendingApprovals,
  useModerationStats,
  useApproveEstablishment,
  useHealth,
  useRealTimeMetrics,
  useOfferStats,
  useAuditStats,
  useAnomalies,
} from '@/hooks/use-admin';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { adminService } from '@/services/admin.service';
import type { AdminEstablishment, AnalyticsPeriod } from '@/types/admin';

const CURRENCY = 'TND';

function formatRevenue(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M ${CURRENCY}`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K ${CURRENCY}`;
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${CURRENCY}`;
}

function fmtPct(v: number) {
  return `${Math.round(v * 100)}%`;
}

// ─── Mini health dot ──────────────────────────────────────────────────────────

function HealthDot({ status }: { status: 'ok' | 'error' | 'shutting_down' | undefined }) {
  if (!status) return null;
  return (
    <span className='relative flex size-2'>
      {status === 'ok' && (
        <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2E7D32] opacity-60' />
      )}
      <span
        className={cn(
          'relative inline-flex size-2 rounded-full',
          status === 'ok' ? 'bg-[#2E7D32]' : 'bg-destructive',
        )}
      />
    </span>
  );
}

// ─── Health mini widget ───────────────────────────────────────────────────────

function HealthWidget() {
  const { data: health, isLoading } = useHealth();

  const indicators = health ? { ...health.info, ...health.error } : {};

  const allUp = Object.values(indicators).every(i => i.status === 'up');
  const anyDown = Object.values(indicators).some(i => i.status === 'down');

  return (
    <Card className='border-border/60'>
      <CardContent className='p-lg'>
        <div className='flex items-center justify-between gap-md'>
          <div className='flex items-center gap-sm'>
            <Activity className='size-4 text-muted-foreground' />
            <span className='text-sm font-semibold'>System Health</span>
          </div>
          {isLoading ? (
            <Skeleton className='h-5 w-20 rounded-full' />
          ) : (
            <div className='flex items-center gap-1.5'>
              <HealthDot status={health?.status} />
              <span
                className={cn('text-xs font-medium', allUp ? 'text-[#2E7D32]' : 'text-destructive')}
              >
                {allUp ? 'All systems go' : anyDown ? 'Degraded' : 'Checking…'}
              </span>
            </div>
          )}
        </div>

        {!isLoading && Object.keys(indicators).length > 0 && (
          <div className='mt-md grid grid-cols-2 gap-1.5'>
            {Object.entries(indicators).map(([name, ind]) => (
              <div key={name} className='flex items-center gap-1.5'>
                {ind.status === 'up' ? (
                  <CheckCircle2 className='size-3 text-[#2E7D32]' />
                ) : (
                  <XCircle className='size-3 text-destructive' />
                )}
                <span className='truncate text-[11px] text-muted-foreground capitalize'>
                  {name.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        )}

        <Link
          href='/admin/health'
          className='mt-md block text-center text-[11px] text-primary hover:underline'
        >
          View details →
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── Real-time card ───────────────────────────────────────────────────────────

function RealTimeCard() {
  const { data, isLoading, dataUpdatedAt, refetch, isFetching } = useRealTimeMetrics();

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <Card className='border-border/60'>
      <CardHeader className='pb-sm'>
        <div className='flex items-center justify-between gap-sm'>
          <div className='flex items-center gap-sm'>
            <Zap className='size-4 text-[#FFA000]' />
            <CardTitle className='text-sm font-semibold'>Real-time</CardTitle>
          </div>
          <div className='flex items-center gap-1.5'>
            {lastUpdated && (
              <span className='text-[10px] text-muted-foreground'>{lastUpdated}</span>
            )}
            <button
              onClick={() => void refetch()}
              disabled={isFetching}
              className='rounded p-xs text-muted-foreground hover:text-foreground'
              aria-label='Refresh'
            >
              <RefreshCw className={cn('size-3', isFetching && 'animate-spin')} />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className='pb-lg'>
        {isLoading ? (
          <div className='grid grid-cols-2 gap-sm'>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className='h-12 rounded-lg' />
            ))}
          </div>
        ) : (
          <div className='grid grid-cols-2 gap-sm'>
            {[
              { label: 'Active Users', value: data?.activeUsers ?? '—', icon: Users },
              { label: 'Active Offers', value: data?.activeOffers ?? '—', icon: Tag },
              { label: 'Orders / hr', value: data?.ordersLastHour ?? '—', icon: ShoppingBag },
              {
                label: 'Revenue / hr',
                value: data?.revenueLastHour != null ? formatRevenue(data.revenueLastHour) : '—',
                icon: DollarSign,
              },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className='rounded-lg bg-muted/40 px-md py-2.5'>
                <div className='flex items-center gap-1.5'>
                  <Icon className='size-3 text-muted-foreground' />
                  <span className='text-[10px] text-muted-foreground'>{label}</span>
                </div>
                <p className='mt-xxs text-sm font-bold tabular-nums'>{String(value)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Audit stats card ─────────────────────────────────────────────────────────

function AuditStatsCard() {
  const { data: stats, isLoading } = useAuditStats(30);

  const topActions = Object.entries(stats?.actionsByType ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topAdmins = (stats?.actionsByAdmin ?? []).slice(0, 3);

  function handleExportAuditLogs() {
    void adminService.exportAuditLogs({ format: 'csv' }).then(response => {
      const blob = new Blob([response.data as unknown as BlobPart], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <Card className='border-border/60'>
      <CardHeader className='pb-sm'>
        <div className='flex items-center justify-between gap-sm'>
          <div className='flex items-center gap-sm'>
            <Activity className='size-4 text-muted-foreground' />
            <CardTitle className='text-sm font-semibold'>Admin Activity (30d)</CardTitle>
          </div>
          <button
            onClick={handleExportAuditLogs}
            className='flex items-center gap-xs rounded px-1.5 py-xxs text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'
            title='Export audit logs as CSV'
          >
            <Download className='size-3' />
            Export
          </button>
        </div>
      </CardHeader>
      <CardContent className='pb-lg'>
        {isLoading ? (
          <div className='space-y-sm'>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className='h-6 rounded' />
            ))}
          </div>
        ) : (
          <div className='space-y-md'>
            <div className='flex items-center justify-between text-xs'>
              <span className='text-muted-foreground'>Total actions</span>
              <span className='font-bold tabular-nums'>
                {(stats?.totalActions ?? 0).toLocaleString()}
              </span>
            </div>
            {topActions.length > 0 && (
              <div className='space-y-1.5'>
                {topActions.map(([action, count]) => {
                  const pct = stats?.totalActions ? (count / stats.totalActions) * 100 : 0;
                  return (
                    <div key={action}>
                      <div className='mb-xxs flex items-center justify-between text-[11px]'>
                        <span className='capitalize text-muted-foreground'>
                          {action.replace(/_/g, ' ')}
                        </span>
                        <span className='tabular-nums'>{count}</span>
                      </div>
                      <div className='h-1.5 w-full rounded-full bg-muted overflow-hidden'>
                        <div
                          className='h-full rounded-full bg-primary/60 transition-all'
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {topAdmins.length > 0 && (
              <>
                <p className='text-[11px] font-medium text-muted-foreground'>Top moderators</p>
                <div className='space-y-xs'>
                  {topAdmins.map(({ adminEmail, count }) => (
                    <div key={adminEmail} className='flex items-center justify-between text-[11px]'>
                      <span className='truncate text-muted-foreground'>{adminEmail}</span>
                      <span className='ms-sm shrink-0 font-medium tabular-nums'>{count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Offer performance card ───────────────────────────────────────────────────

function OfferPerformanceCard() {
  const { data: stats, isLoading } = useOfferStats();

  const topCategories = stats?.topCategories?.slice(0, 4) ?? [];
  const totalForPct = topCategories.reduce((s, c) => s + c.count, 0);

  return (
    <Card className='border-border/60'>
      <CardHeader className='pb-sm'>
        <div className='flex items-center justify-between gap-sm'>
          <div className='flex items-center gap-sm'>
            <Tag className='size-4 text-muted-foreground' />
            <CardTitle className='text-sm font-semibold'>Offer Performance</CardTitle>
          </div>
          <Link href='/admin/offers' className='text-[11px] text-primary hover:underline'>
            Manage →
          </Link>
        </div>
      </CardHeader>
      <CardContent className='pb-lg'>
        {isLoading ? (
          <div className='space-y-sm'>
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className='h-8 rounded' />
            ))}
          </div>
        ) : (
          <div className='space-y-md'>
            <div className='grid grid-cols-3 gap-sm text-center'>
              <div>
                <p className='text-base font-bold tabular-nums'>
                  {stats?.countByStatus?.['active'] ?? 0}
                </p>
                <p className='text-[10px] text-muted-foreground'>Active</p>
              </div>
              <div>
                <p className='text-base font-bold tabular-nums text-[#2E7D32]'>
                  {fmtPct(stats?.platformPickupRate ?? 0)}
                </p>
                <p className='text-[10px] text-muted-foreground'>Pickup rate</p>
              </div>
              <div>
                <p className='text-base font-bold tabular-nums'>
                  {stats?.totalSoldBags?.toLocaleString() ?? 0}
                </p>
                <p className='text-[10px] text-muted-foreground'>Bags sold</p>
              </div>
            </div>

            {topCategories.length > 0 && (
              <>
                <p className='text-[11px] font-medium text-muted-foreground'>Top categories</p>
                <div className='space-y-1.5'>
                  {topCategories.map(({ category, count }) => {
                    const pct = totalForPct > 0 ? (count / totalForPct) * 100 : 0;
                    return (
                      <div key={category}>
                        <div className='flex items-center justify-between text-[11px] mb-xxs'>
                          <span className='capitalize text-muted-foreground'>{category}</span>
                          <span className='tabular-nums text-muted-foreground'>{count}</span>
                        </div>
                        <div className='h-1.5 w-full rounded-full bg-muted overflow-hidden'>
                          <div
                            className='h-full rounded-full bg-primary transition-all duration-500'
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const t = useTranslations('dashboard.admin');
  const user = useAuthStore(state => state.user);
  const [period, setPeriod] = useState<AnalyticsPeriod>('week');
  const [activityDays, setActivityDays] = useState<7 | 14>(7);

  const { data: analytics, isLoading: loadingAnalytics } = usePlatformAnalytics(period);
  const { data: recentActivity, isLoading: loadingActivity } = useRecentActivity(
    activityDays * 24,
    10,
  );
  const { data: pending, isLoading: loadingPending } = usePendingApprovals(6);
  const { data: modStats } = useModerationStats();
  const { data: anomalies, isLoading: loadingAnomalies } = useAnomalies();
  const approveMutation = useApproveEstablishment();

  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    establishment: AdminEstablishment | null;
    type: 'approve' | 'reject';
  }>({ open: false, establishment: null, type: 'approve' });

  function openAction(est: AdminEstablishment, type: 'approve' | 'reject') {
    setActionDialog({ open: true, establishment: est, type });
  }

  function handleConfirmAction(reason?: string) {
    if (!actionDialog.establishment) return;
    approveMutation.mutate(
      {
        id: actionDialog.establishment.id,
        payload: {
          approved: actionDialog.type === 'approve',
          ...(reason ? { reason } : {}),
          sendNotification: true,
        },
      },
      { onSuccess: () => setActionDialog({ open: false, establishment: null, type: 'approve' }) },
    );
  }

  return (
    <div className='space-y-xl'>
      {/* Header + period selector */}
      <div className='flex items-start justify-between gap-lg'>
        <div>
          <h1 className='text-xl font-bold tracking-tight'>
            {t('title')}
            {user?.firstName ? `, ${user.firstName}` : ''}
          </h1>
          <p className='mt-xxs text-sm text-muted-foreground'>{t('description')}</p>
        </div>
        <Select value={period} onValueChange={v => setPeriod(v as AnalyticsPeriod)}>
          <SelectTrigger className='h-8 w-28 text-xs'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='day'>{t('periods.day')}</SelectItem>
            <SelectItem value='week'>{t('periods.week')}</SelectItem>
            <SelectItem value='month'>{t('periods.month')}</SelectItem>
            <SelectItem value='quarter'>{t('periods.quarter')}</SelectItem>
            <SelectItem value='year'>{t('periods.year')}</SelectItem>
            {/* All time — lets admin totals be compared directly against the
                merchant dashboards, which are always all-time. */}
            <SelectItem value='all'>{t('periods.all')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Grid */}
      {loadingAnalytics ? (
        <AdminStatGridSkeleton count={5} />
      ) : (
        <div className='grid grid-cols-2 gap-md md:grid-cols-3 lg:grid-cols-5'>
          <AdminStatCard
            label={t('kpi.totalUsers')}
            value={analytics?.users.totalUsers.toLocaleString() ?? '—'}
            icon={Users}
            iconBg='bg-indigo-50'
            iconColor='text-indigo-600'
            {...(analytics
              ? {
                  change: {
                    value: analytics.users.newUsersThisWeek,
                    direction: 'up' as const,
                    label: t('kpi.newThisWeek'),
                  },
                }
              : {})}
          />
          <AdminStatCard
            label={t('kpi.totalEstablishments')}
            value={analytics?.establishments.totalEstablishments.toLocaleString() ?? '—'}
            icon={Building2}
            iconBg='bg-violet-50'
            iconColor='text-violet-600'
          />
          <AdminStatCard
            label={t('kpi.totalOrders')}
            value={analytics?.orders.totalOrders.toLocaleString() ?? '—'}
            icon={ShoppingBag}
            iconBg='bg-sky-50'
            iconColor='text-sky-600'
          />
          <AdminStatCard
            label={t('kpi.totalRevenue')}
            value={analytics ? formatRevenue(analytics.revenue.totalRevenue) : '—'}
            icon={DollarSign}
            iconBg='bg-emerald-50'
            iconColor='text-emerald-600'
            {...(analytics
              ? {
                  change: {
                    value: Math.round(analytics.revenue.revenueGrowthRate),
                    direction: (analytics.revenue.revenueGrowthRate >= 0 ? 'up' : 'down') as
                      | 'up'
                      | 'down',
                    label: t('kpi.vsLastWeek'),
                  },
                }
              : {})}
          />
          <AdminStatCard
            label={t('kpi.pendingApprovals')}
            value={analytics?.establishments.pendingApproval ?? '—'}
            icon={Clock}
            iconBg='bg-amber-50'
            iconColor='text-amber-600'
            highlight={(analytics?.establishments.pendingApproval ?? 0) > 0}
          />
        </div>
      )}

      {/* Waste Impact Banner */}
      <WasteImpactBanner
        kgSaved={analytics?.offers.wasteReductionImpact.totalKgSaved ?? 0}
        mealsSaved={analytics?.offers.wasteReductionImpact.totalMealsSaved ?? 0}
        co2Reduced={analytics?.offers.wasteReductionImpact.co2ReductionKg ?? 0}
        waterSaved={analytics?.offers.wasteReductionImpact.waterLitersSaved ?? 0}
        kgSavedLabel={t('waste.kgSaved')}
        mealsSavedLabel={t('waste.mealsSaved')}
        co2ReducedLabel={t('waste.co2Reduced')}
        waterSavedLabel={t('waste.waterSaved')}
        title={t('waste.title')}
        subtitle={t('waste.subtitle')}
        loading={loadingAnalytics}
      />

      {/* Main 3-column grid */}
      <div className='grid grid-cols-1 gap-lg lg:grid-cols-12'>
        {/* Activity Feed — 7 cols */}
        <div className='lg:col-span-7'>
          <Card className='border-border/60'>
            <CardHeader className='pb-md'>
              <div className='flex items-start justify-between gap-md'>
                <div>
                  <CardTitle className='text-sm font-semibold'>{t('activity.title')}</CardTitle>
                  <CardDescription className='text-xs'>{t('activity.subtitle')}</CardDescription>
                </div>
                <div className='flex items-center gap-sm'>
                  <div className='flex items-center rounded-md border border-border/60 p-xxs'>
                    {([7, 14] as const).map(d => (
                      <button
                        key={d}
                        onClick={() => setActivityDays(d)}
                        className={cn(
                          'rounded px-2.5 py-xs text-[11px] font-medium transition-colors',
                          activityDays === d
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                  <Link
                    href='/admin/audit-log'
                    className='text-[11px] text-primary hover:underline whitespace-nowrap'
                  >
                    View all →
                  </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ActivityFeed
                activities={(recentActivity?.activities ?? []).slice(0, 10)}
                loading={loadingActivity}
                emptyTitle={t('activity.empty')}
                emptyDescription={t('activity.emptyDescription')}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar — 5 cols */}
        <div className='flex flex-col gap-lg lg:col-span-5'>
          {/* Quick Actions */}
          <Card className='border-border/60'>
            <CardHeader className='pb-md'>
              <CardTitle className='text-sm font-semibold'>{t('quickActions.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <QuickActions
                labels={{
                  title: t('quickActions.title'),
                  approvePending: t('quickActions.approvePending'),
                  reviewReports: t('quickActions.reviewReports'),
                  manageUsers: t('quickActions.manageUsers'),
                  systemConfig: t('quickActions.systemConfig'),
                }}
                pendingApprovals={analytics?.establishments.pendingApproval ?? 0}
                pendingReports={modStats?.pendingReports ?? 0}
              />
            </CardContent>
          </Card>

          {/* Health widget */}
          <HealthWidget />

          {/* Real-time */}
          <RealTimeCard />

          {/* Offer performance */}
          <OfferPerformanceCard />

          {/* Audit stats */}
          <AuditStatsCard />

          {/* Pending approvals mini-queue */}
          <Card className='border-border/60'>
            <CardHeader className='pb-md'>
              <div className='flex items-center justify-between'>
                <CardTitle className='text-sm font-semibold'>{t('pendingQueue.title')}</CardTitle>
                <Link href='/admin/establishments' className='text-xs text-primary hover:underline'>
                  {t('pendingQueue.viewAll')}
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {loadingPending ? (
                <AdminPendingCardsSkeleton count={3} />
              ) : !pending || pending.length === 0 ? (
                <p className='py-lg text-center text-xs text-muted-foreground'>
                  {t('pendingQueue.empty')}
                </p>
              ) : (
                <div className='space-y-sm'>
                  {pending.slice(0, 5).map(est => (
                    <div
                      key={est.id}
                      className='flex items-center justify-between gap-md rounded-lg border border-amber-200/60 bg-amber-50/30 px-md py-2.5'
                    >
                      <div className='min-w-0'>
                        <p className='truncate text-xs font-medium'>{est.name}</p>
                        <div className='mt-xxs flex items-center gap-1.5'>
                          <StatusBadge status={est.type} variant='role' />
                          {est.address?.city && (
                            <span className='text-[10px] text-muted-foreground'>
                              {est.address.city}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className='flex shrink-0 gap-1.5'>
                        <button
                          onClick={() => openAction(est, 'approve')}
                          className='rounded px-sm py-xs text-[10px] font-medium text-emerald-700 hover:bg-emerald-100 transition-colors'
                        >
                          {t('pendingQueue.approve')}
                        </button>
                        <button
                          onClick={() => openAction(est, 'reject')}
                          className='rounded px-sm py-xs text-[10px] font-medium text-rose-600 hover:bg-rose-100 transition-colors'
                        >
                          {t('pendingQueue.reject')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Anomaly Detection Alerts */}
      <Card className='border-border/60'>
        <CardHeader className='pb-md'>
          <div className='flex items-center gap-sm'>
            <ShieldAlert className='size-4 text-destructive' />
            <CardTitle className='text-sm font-semibold'>{t('anomalies.title')}</CardTitle>
          </div>
          <CardDescription className='text-xs'>{t('anomalies.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingAnomalies ? (
            <div className='space-y-sm'>
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className='h-14 rounded-lg' />
              ))}
            </div>
          ) : !anomalies || anomalies.length === 0 ? (
            <div className='flex flex-col items-center gap-sm py-2xl'>
              <CheckCircle2 className='size-8 text-green-500/40' />
              <p className='text-xs font-medium text-muted-foreground'>{t('anomalies.noAlerts')}</p>
            </div>
          ) : (
            <div className='space-y-sm'>
              {anomalies.slice(0, 8).map(alert => (
                <div
                  key={alert.id}
                  className={cn(
                    'flex items-start gap-md rounded-lg border px-md py-2.5',
                    alert.severity === 'critical'
                      ? 'border-destructive/40 bg-destructive/5'
                      : alert.severity === 'high'
                        ? 'border-orange-300/60 bg-orange-50/30'
                        : 'border-border/60 bg-muted/20',
                  )}
                >
                  <AlertTriangle
                    className={cn(
                      'size-4 mt-xxs shrink-0',
                      alert.severity === 'critical'
                        ? 'text-destructive'
                        : alert.severity === 'high'
                          ? 'text-orange-500'
                          : 'text-muted-foreground',
                    )}
                  />
                  <div className='min-w-0 flex-1'>
                    <div className='flex items-center gap-sm'>
                      <p className='text-xs font-semibold'>{alert.title}</p>
                      <span
                        className={cn(
                          'inline-flex rounded-full px-1.5 py-xxs text-[10px] font-medium',
                          alert.severity === 'critical'
                            ? 'bg-destructive/10 text-destructive'
                            : alert.severity === 'high'
                              ? 'bg-orange-500/10 text-orange-600'
                              : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {alert.severity}
                      </span>
                    </div>
                    <p className='mt-xxs text-[11px] text-muted-foreground'>{alert.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Action Dialog */}
      <ConfirmActionDialog
        open={actionDialog.open}
        onOpenChange={open => setActionDialog(s => ({ ...s, open }))}
        title={
          actionDialog.type === 'approve'
            ? t('establishments.confirmApprove.title')
            : t('establishments.confirmReject.title')
        }
        description={
          actionDialog.type === 'approve'
            ? t('establishments.confirmApprove.description')
            : t('establishments.confirmReject.description')
        }
        confirmLabel={
          actionDialog.type === 'approve' ? t('pendingQueue.approve') : t('pendingQueue.reject')
        }
        variant={actionDialog.type === 'reject' ? 'danger' : 'default'}
        isLoading={approveMutation.isPending}
        onConfirm={handleConfirmAction}
        reasonConfig={
          actionDialog.type === 'reject'
            ? {
                label: t('establishments.confirmReject.reasonLabel'),
                placeholder: t('establishments.confirmReject.reasonPlaceholder'),
                required: true,
              }
            : {
                label: t('establishments.confirmApprove.reasonLabel'),
                placeholder: t('establishments.confirmApprove.reasonPlaceholder'),
              }
        }
      />
    </div>
  );
}
