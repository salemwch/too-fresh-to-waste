'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Leaf,
  Users,
  Utensils,
  TrendingUp,
  Download,
  Calendar,
  FileText,
  Wind,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button } from '@foodwaste/ui';
import { AdminModuleHeader } from '@/components/dashboard/admin/admin-module-header';
import { AdminTabNav, type AdminTab } from '@/components/dashboard/admin/admin-tab-nav';
import { AdminKpiRow, type KpiItem } from '@/components/dashboard/admin/admin-kpi-row';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { AnalyticsPeriod } from '@/types/admin';

// ─── Mock chart data ─────────────────────────────────────────────────────────

const WASTE_SAVED_MONTHLY = [
  { month: 'Jan', kg: 320 },
  { month: 'Feb', kg: 410 },
  { month: 'Mar', kg: 380 },
  { month: 'Apr', kg: 520 },
  { month: 'May', kg: 610 },
  { month: 'Jun', kg: 740 },
  { month: 'Jul', kg: 680 },
];

const ORDER_STATUS_DIST = [
  { status: 'Completed', count: 1842, pct: 72, color: 'bg-emerald-500' },
  { status: 'Cancelled', count: 384, pct: 15, color: 'bg-rose-500' },
  { status: 'Expired', count: 204, pct: 8, color: 'bg-gray-400' },
  { status: 'Disputed', count: 128, pct: 5, color: 'bg-orange-500' },
];

const USER_GROWTH = [
  { month: 'Jan', users: 120 },
  { month: 'Feb', users: 185 },
  { month: 'Mar', users: 240 },
  { month: 'Apr', users: 310 },
  { month: 'May', users: 420 },
  { month: 'Jun', users: 540 },
  { month: 'Jul', users: 630 },
];

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

// ─── Bar Chart (CSS-based) ───────────────────────────────────────────────────

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
          <div key={i} className='flex-1 flex flex-col items-center gap-1'>
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

// ─── Content ─────────────────────────────────────────────────────────────────

function AnalyticsContent() {
  const t = useTranslations('adminAnalytics');
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') ?? 'impact';
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');

  const tabs: AdminTab[] = [
    { key: 'impact', label: t('tabs.impact') },
    { key: 'growth', label: t('tabs.growth') },
    { key: 'retention', label: t('tabs.retention') },
    { key: 'reports', label: t('tabs.reports') },
  ];

  const kpis: KpiItem[] = [
    {
      label: t('kpi.wasteSaved'),
      value: '3,660 kg',
      icon: Leaf,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      change: { value: 12, direction: 'up', label: 'vs last month' },
    },
    {
      label: t('kpi.co2Reduced'),
      value: '9,150 kg',
      icon: Wind,
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
    },
    {
      label: t('kpi.mealsSaved'),
      value: '7,320',
      icon: Utensils,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      label: t('kpi.activeUsers'),
      value: '2,847',
      icon: Users,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      change: { value: 8, direction: 'up', label: 'growth' },
    },
  ];

  return (
    <div className='space-y-5'>
      <AdminModuleHeader
        title={t('title')}
        subtitle={t('subtitle')}
        period={period}
        onPeriodChange={setPeriod}
        onExport={() => {}}
        exportLabel={t('export')}
      />

      <AdminKpiRow items={kpis} />

      <Card className='border-border/60'>
        <CardContent className='p-0'>
          <AdminTabNav tabs={tabs} />
          <div className='p-4'>
            {/* ── Impact Dashboard ── */}
            {currentTab === 'impact' && (
              <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                {/* Waste saved over time */}
                <Card className='border-border/60'>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm font-semibold'>
                      {t('impact.wasteTrend')}
                    </CardTitle>
                    <CardDescription className='text-xs'>
                      {t('impact.wasteTrendDesc')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <MiniBarChart
                      data={WASTE_SAVED_MONTHLY}
                      labelKey='month'
                      valueKey='kg'
                      unit='kg'
                      color='bg-emerald-500'
                    />
                  </CardContent>
                </Card>

                {/* Order status distribution */}
                <Card className='border-border/60'>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm font-semibold'>{t('impact.orderDist')}</CardTitle>
                    <CardDescription className='text-xs'>
                      {t('impact.orderDistDesc')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className='space-y-3'>
                      {ORDER_STATUS_DIST.map(item => (
                        <div key={item.status}>
                          <div className='flex items-center justify-between mb-1'>
                            <span className='text-xs font-medium'>{item.status}</span>
                            <span className='text-xs text-muted-foreground tabular-nums'>
                              {item.count.toLocaleString()} ({item.pct}%)
                            </span>
                          </div>
                          <div className='h-2 w-full rounded-full bg-muted overflow-hidden'>
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-500',
                                item.color,
                              )}
                              style={{ width: `${item.pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Impact summary */}
                <Card className='border-border/60 lg:col-span-2'>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm font-semibold'>{t('impact.summary')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                      {[
                        {
                          label: t('impact.totalOrders'),
                          value: '2,558',
                          change: '+12%',
                          up: true,
                        },
                        {
                          label: t('impact.completionRate'),
                          value: '72%',
                          change: '+3%',
                          up: true,
                        },
                        {
                          label: t('impact.avgOrderValue'),
                          value: '8.40 TND',
                          change: '-2%',
                          up: false,
                        },
                        { label: t('impact.repeatRate'), value: '34%', change: '+5%', up: true },
                      ].map(stat => (
                        <div
                          key={stat.label}
                          className='rounded-lg border border-border/60 p-3 text-center'
                        >
                          <p className='text-xl font-bold tabular-nums'>{stat.value}</p>
                          <p className='text-[10px] text-muted-foreground mt-0.5'>{stat.label}</p>
                          <div
                            className={cn(
                              'flex items-center justify-center gap-0.5 mt-1 text-[10px] font-medium',
                              stat.up ? 'text-emerald-600' : 'text-rose-600',
                            )}
                          >
                            {stat.up ? (
                              <ArrowUpRight className='size-3' />
                            ) : (
                              <ArrowDownRight className='size-3' />
                            )}
                            {stat.change}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ── Growth ── */}
            {currentTab === 'growth' && (
              <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                <Card className='border-border/60'>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm font-semibold'>
                      {t('growth.userGrowth')}
                    </CardTitle>
                    <CardDescription className='text-xs'>
                      {t('growth.userGrowthDesc')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <MiniBarChart
                      data={USER_GROWTH}
                      labelKey='month'
                      valueKey='users'
                      color='bg-violet-500'
                    />
                  </CardContent>
                </Card>

                <Card className='border-border/60'>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm font-semibold'>
                      {t('growth.merchantOnboarding')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='space-y-4'>
                      {[
                        {
                          label: t('growth.totalMerchants'),
                          value: '142',
                          trend: '+18 this month',
                        },
                        {
                          label: t('growth.avgOnboardingTime'),
                          value: '2.3 days',
                          trend: '-0.5 days',
                        },
                        { label: t('growth.approvalRate'), value: '89%', trend: '+4%' },
                        { label: t('growth.activeRate'), value: '76%', trend: 'Stable' },
                      ].map(item => (
                        <div key={item.label} className='flex items-center justify-between'>
                          <span className='text-xs text-muted-foreground'>{item.label}</span>
                          <div className='text-end'>
                            <p className='text-sm font-bold tabular-nums'>{item.value}</p>
                            <p className='text-[10px] text-muted-foreground'>{item.trend}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ── Retention ── */}
            {currentTab === 'retention' && (
              <div className='flex flex-col items-center justify-center py-16 gap-3 text-center'>
                <TrendingUp className='size-12 text-muted-foreground/30' />
                <h3 className='text-md font-semibold'>{t('retention.title')}</h3>
                <p className='text-sm text-muted-foreground max-w-xs'>
                  {t('retention.description')}
                </p>
              </div>
            )}

            {/* ── Reports ── */}
            {currentTab === 'reports' && (
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                {REPORT_TEMPLATES.map(report => {
                  const Icon = report.icon;
                  return (
                    <Card
                      key={report.id}
                      className='border-border/60 hover:border-primary/30 transition-colors cursor-pointer group'
                    >
                      <CardContent className='p-4'>
                        <div className='flex items-start gap-3'>
                          <div className='rounded-lg bg-primary/10 p-2.5 shrink-0 group-hover:bg-primary/15 transition-colors'>
                            <Icon className='size-5 text-primary' />
                          </div>
                          <div className='flex-1 min-w-0'>
                            <p className='text-sm font-semibold'>{report.name}</p>
                            <p className='text-xs text-muted-foreground mt-0.5'>
                              {report.description}
                            </p>
                            <div className='flex gap-2 mt-3'>
                              <Button size='sm' variant='outline' className='h-7 text-xs'>
                                <Download className='me-1 size-3' /> CSV
                              </Button>
                              <Button size='sm' variant='outline' className='h-7 text-xs'>
                                <FileText className='me-1 size-3' /> PDF
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
        <div className='space-y-5'>
          <Skeleton className='h-16 rounded-lg' />
          <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
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
