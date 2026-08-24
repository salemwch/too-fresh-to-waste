'use client';

import { useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Leaf, Users, Utensils, Download, Calendar, FileText, Wind } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button } from '@foodwaste/ui';
import { AdminModuleHeader } from '@/components/dashboard/admin/admin-module-header';
import { AdminTabNav, type AdminTab } from '@/components/dashboard/admin/admin-tab-nav';
import { AdminKpiRow, type KpiItem } from '@/components/dashboard/admin/admin-kpi-row';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { usePlatformAnalytics } from '@/hooks/use-admin';
import { adminService } from '@/services/admin.service';
import type { AnalyticsPeriod } from '@/types/admin';

// ─── Bar Chart (CSS-based) ──────────────────────────────────────────────────

function MiniBarChart({
  data,
  labelKey,
  valueKey,
  unit,
  color = 'bg-primary',
}: {
  data: Record<string, string | number>[];
  labelKey: string;
  valueKey: string;
  unit?: string;
  color?: string;
}) {
  const maxVal = Math.max(...data.map(d => Number(d[valueKey])));
  return (
    <div className='flex items-end gap-1.5 h-32'>
      {data.map((item, i) => {
        const val = Number(item[valueKey]);
        const height = maxVal > 0 ? (val / maxVal) * 100 : 0;
        return (
          <div key={i} className='flex-1 flex flex-col items-center gap-xs'>
            <span className='text-[9px] text-muted-foreground tabular-nums'>
              {val}
              {unit}
            </span>
            <div
              className='w-full rounded-t-sm overflow-hidden bg-muted/30'
              style={{ height: '100px' }}
            >
              <div
                className={cn('w-full rounded-t-sm transition-all duration-500', color)}
                style={{ height: `${height}%`, marginTop: `${100 - height}%` }}
              />
            </div>
            <span className='text-[9px] text-muted-foreground'>{String(item[labelKey])}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Report Templates ───────────────────────────────────────────────────────

const REPORT_TEMPLATES = [
  {
    id: 'daily',
    name: 'Daily Summary',
    description: 'Orders, revenue, and waste saved for the day',
    icon: Calendar,
  },
  {
    id: 'weekly',
    name: 'Weekly Impact Report',
    description: 'Comprehensive waste reduction metrics and trends',
    icon: Leaf,
  },
  {
    id: 'monthly',
    name: 'Monthly Revenue Report',
    description: 'Revenue breakdown, commissions, and merchant payouts',
    icon: FileText,
  },
  {
    id: 'quarterly',
    name: 'Quarterly ESG Report',
    description: 'Environmental impact metrics for stakeholder reporting',
    icon: Wind,
  },
];

// ─── Content ─────────────────────────────────────────────────────────────────

function AnalyticsContent() {
  const t = useTranslations('adminAnalytics');
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') ?? 'impact';
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');

  const { data: analytics, isLoading } = usePlatformAnalytics(period);

  const tabs: AdminTab[] = [
    { key: 'impact', label: t('tabs.impact') },
    { key: 'growth', label: t('tabs.growth') },
    { key: 'reports', label: t('tabs.reports') },
  ];

  const wasteMetrics = analytics?.offers?.wasteReductionImpact;
  const orderData = analytics?.orders;
  const userAnalytics = analytics?.users;
  const estAnalytics = analytics?.establishments;

  const kpis: KpiItem[] = [
    {
      label: t('kpi.wasteSaved'),
      value: wasteMetrics ? `${wasteMetrics.totalKgSaved.toLocaleString()} kg` : '—',
      icon: Leaf,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: t('kpi.co2Reduced'),
      value: wasteMetrics ? `${wasteMetrics.co2ReductionKg.toLocaleString()} kg` : '—',
      icon: Wind,
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
    },
    {
      label: t('kpi.mealsSaved'),
      value: wasteMetrics?.totalMealsSaved.toLocaleString() ?? '—',
      icon: Utensils,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      label: t('kpi.activeUsers'),
      value: userAnalytics?.activeUsers.toLocaleString() ?? '—',
      icon: Users,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
    },
  ];

  const handleExport = useCallback(async () => {
    try {
      const response = await adminService.exportAuditLogs({ format: 'csv' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      // notifications module will handle this
    }
  }, [period]);

  const orderTrends = orderData?.orderTrends ?? [];
  const ordersByStatus = orderData?.ordersByStatus ?? {};

  const statusEntries = Object.entries(ordersByStatus).map(([status, count]) => ({
    status,
    count: count as number,
  }));
  const totalOrders = statusEntries.reduce((s, e) => s + e.count, 0);
  const statusColors: Record<string, string> = {
    completed: 'bg-emerald-500',
    confirmed: 'bg-primary',
    cancelled: 'bg-rose-500',
    expired: 'bg-gray-400',
    pending: 'bg-amber-500',
  };

  return (
    <div className='space-y-xl'>
      <AdminModuleHeader
        title={t('title')}
        subtitle={t('subtitle')}
        period={period}
        onPeriodChange={setPeriod}
        onExport={handleExport}
        exportLabel={t('export')}
      />

      <AdminKpiRow items={kpis} loading={isLoading} />

      <Card className='border-border/60'>
        <CardContent className='p-0'>
          <AdminTabNav tabs={tabs} />
          <div className='p-lg'>
            {currentTab === 'impact' && (
              <div className='grid grid-cols-1 lg:grid-cols-2 gap-lg'>
                {orderTrends.length > 0 && (
                  <Card className='border-border/60'>
                    <CardHeader className='pb-sm'>
                      <CardTitle className='text-sm font-semibold'>
                        {t('impact.wasteTrend')}
                      </CardTitle>
                      <CardDescription className='text-xs'>
                        {t('impact.wasteTrendDesc')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <MiniBarChart
                        data={orderTrends.slice(-7).map(tr => ({
                          date: new Date(tr.date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                          }),
                          revenue: tr.revenue,
                        }))}
                        labelKey='date'
                        valueKey='revenue'
                        unit=' TND'
                        color='bg-emerald-500'
                      />
                    </CardContent>
                  </Card>
                )}

                {statusEntries.length > 0 && (
                  <Card className='border-border/60'>
                    <CardHeader className='pb-sm'>
                      <CardTitle className='text-sm font-semibold'>
                        {t('impact.orderDist')}
                      </CardTitle>
                      <CardDescription className='text-xs'>
                        {t('impact.orderDistDesc')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className='space-y-md'>
                        {statusEntries
                          .sort((a, b) => b.count - a.count)
                          .map(item => {
                            const pct = totalOrders > 0 ? (item.count / totalOrders) * 100 : 0;
                            return (
                              <div key={item.status}>
                                <div className='flex items-center justify-between mb-xs'>
                                  <span className='text-xs font-medium capitalize'>
                                    {item.status}
                                  </span>
                                  <span className='text-xs text-muted-foreground tabular-nums'>
                                    {item.count.toLocaleString()} ({pct.toFixed(0)}%)
                                  </span>
                                </div>
                                <div className='h-2 w-full rounded-full bg-muted overflow-hidden'>
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-all duration-500',
                                      statusColors[item.status] ?? 'bg-primary',
                                    )}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className='border-border/60 lg:col-span-2'>
                  <CardHeader className='pb-sm'>
                    <CardTitle className='text-sm font-semibold'>{t('impact.summary')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='grid grid-cols-2 md:grid-cols-4 gap-lg'>
                      {[
                        {
                          label: t('impact.totalOrders'),
                          value: orderData?.totalOrders.toLocaleString() ?? '—',
                        },
                        {
                          label: t('impact.completionRate'),
                          value: orderData ? `${orderData.orderCompletionRate}%` : '—',
                        },
                        {
                          label: t('impact.avgOrderValue'),
                          value: orderData ? `${orderData.averageOrderValue.toFixed(2)} TND` : '—',
                        },
                        {
                          label: t('impact.repeatRate'),
                          value: userAnalytics ? `${userAnalytics.retentionRate}%` : '—',
                        },
                      ].map(stat => (
                        <div
                          key={stat.label}
                          className='rounded-lg border border-border/60 p-md text-center'
                        >
                          <p className='text-xl font-bold tabular-nums'>{stat.value}</p>
                          <p className='text-[10px] text-muted-foreground mt-xxs'>{stat.label}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {isLoading && (
                  <div className='lg:col-span-2 grid grid-cols-2 gap-lg'>
                    <Skeleton className='h-64 rounded-lg' />
                    <Skeleton className='h-64 rounded-lg' />
                  </div>
                )}
              </div>
            )}

            {currentTab === 'growth' && (
              <div className='grid grid-cols-1 lg:grid-cols-2 gap-lg'>
                <Card className='border-border/60'>
                  <CardHeader className='pb-sm'>
                    <CardTitle className='text-sm font-semibold'>
                      {t('growth.userGrowth')}
                    </CardTitle>
                    <CardDescription className='text-xs'>
                      {t('growth.userGrowthDesc')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className='space-y-lg'>
                      {[
                        {
                          label: t('growth.totalUsers'),
                          value: userAnalytics?.totalUsers.toLocaleString() ?? '—',
                        },
                        {
                          label: t('growth.newThisWeek'),
                          value: userAnalytics?.newUsersThisWeek.toLocaleString() ?? '—',
                        },
                        {
                          label: t('growth.newThisMonth'),
                          value: userAnalytics?.newUsersThisMonth.toLocaleString() ?? '—',
                        },
                        {
                          label: t('growth.retentionRate'),
                          value: userAnalytics ? `${userAnalytics.retentionRate}%` : '—',
                        },
                      ].map(item => (
                        <div key={item.label} className='flex items-center justify-between'>
                          <span className='text-xs text-muted-foreground'>{item.label}</span>
                          <span className='text-sm font-bold tabular-nums'>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className='border-border/60'>
                  <CardHeader className='pb-sm'>
                    <CardTitle className='text-sm font-semibold'>
                      {t('growth.merchantOnboarding')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='space-y-lg'>
                      {[
                        {
                          label: t('growth.totalMerchants'),
                          value: estAnalytics?.totalEstablishments.toLocaleString() ?? '—',
                        },
                        {
                          label: t('growth.activeEstablishments'),
                          value: estAnalytics?.activeEstablishments.toLocaleString() ?? '—',
                        },
                        {
                          label: t('growth.pendingApproval'),
                          value: estAnalytics?.pendingApproval.toLocaleString() ?? '—',
                        },
                        {
                          label: t('growth.averageRating'),
                          value: estAnalytics ? estAnalytics.averageRating.toFixed(1) : '—',
                        },
                      ].map(item => (
                        <div key={item.label} className='flex items-center justify-between'>
                          <span className='text-xs text-muted-foreground'>{item.label}</span>
                          <span className='text-sm font-bold tabular-nums'>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {currentTab === 'reports' && (
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-md'>
                {REPORT_TEMPLATES.map(report => {
                  const Icon = report.icon;
                  return (
                    <Card
                      key={report.id}
                      className='border-border/60 hover:border-primary/30 transition-colors cursor-pointer group'
                    >
                      <CardContent className='p-lg'>
                        <div className='flex items-start gap-md'>
                          <div className='rounded-lg bg-primary/10 p-2.5 shrink-0 group-hover:bg-primary/15 transition-colors'>
                            <Icon className='size-5 text-primary' />
                          </div>
                          <div className='flex-1 min-w-0'>
                            <p className='text-sm font-semibold'>{report.name}</p>
                            <p className='text-xs text-muted-foreground mt-xxs'>
                              {report.description}
                            </p>
                            <div className='flex gap-sm mt-md'>
                              <Button size='sm' variant='outline' className='text-xs'>
                                <Download className='me-xs size-3' /> CSV
                              </Button>
                              <Button size='sm' variant='outline' className='text-xs'>
                                <FileText className='me-xs size-3' /> PDF
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className='space-y-xl'>
          <Skeleton className='h-16 rounded-lg' />
          <div className='grid grid-cols-2 md:grid-cols-4 gap-md'>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className='h-24 rounded-lg' />
            ))}
          </div>
          <Skeleton className='h-96 rounded-lg' />
        </div>
      }
    >
      <AnalyticsContent />
    </Suspense>
  );
}
