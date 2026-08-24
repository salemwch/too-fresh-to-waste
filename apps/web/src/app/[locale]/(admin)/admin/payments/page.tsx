'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DollarSign, Clock, Store, TrendingUp, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@foodwaste/ui';
import { AdminModuleHeader } from '@/components/dashboard/admin/admin-module-header';
import { AdminTabNav, type AdminTab } from '@/components/dashboard/admin/admin-tab-nav';
import { AdminKpiRow, type KpiItem } from '@/components/dashboard/admin/admin-kpi-row';
import { AdminDataTable, type ColumnDef } from '@/components/dashboard/admin/admin-data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAdminPaymentStats, useAdminPayouts } from '@/hooks/use-admin';
import type { AdminPayoutSummary } from '@/types/admin';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(v: number) {
  return `${v.toFixed(2)} TND`;
}

// ─── Payment Methods Breakdown ──────────────────────────────────────────────

function PaymentMethodsCard({
  methods,
}: {
  methods: Array<{ method: string; count: number; total: number }>;
}) {
  const t = useTranslations('adminPayments');
  const totalCount = methods.reduce((s, m) => s + m.count, 0);

  return (
    <Card className='border-border/60'>
      <CardContent className='p-xl'>
        <h3 className='text-sm font-semibold mb-lg'>{t('methodsBreakdown')}</h3>
        <div className='space-y-md'>
          {methods.map(m => {
            const pct = totalCount > 0 ? (m.count / totalCount) * 100 : 0;
            return (
              <div key={m.method} className='space-y-1.5'>
                <div className='flex items-center justify-between'>
                  <span className='text-xs font-medium capitalize'>{m.method ?? 'unknown'}</span>
                  <span className='text-xs text-muted-foreground tabular-nums'>
                    {m.count} ({pct.toFixed(0)}%)
                  </span>
                </div>
                <div className='h-1.5 w-full rounded-full bg-muted'>
                  <div
                    className='h-1.5 rounded-full bg-primary transition-all'
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className='text-[10px] text-muted-foreground tabular-nums'>
                  {formatCurrency(m.total)}
                </p>
              </div>
            );
          })}
          {methods.length === 0 && (
            <p className='text-xs text-muted-foreground text-center py-lg'>{t('noMethodData')}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Content ─────────────────────────────────────────────────────────────────

function PaymentsContent() {
  const t = useTranslations('adminPayments');
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') ?? 'overview';

  const [payoutPage, setPayoutPage] = useState(1);

  const { data: stats, isLoading: statsLoading } = useAdminPaymentStats();
  const { data: payoutsResponse, isLoading: payoutsLoading } = useAdminPayouts(payoutPage);

  const payouts = payoutsResponse?.data ?? [];
  const payoutMeta = payoutsResponse?.meta;
  const payoutTotal = payoutMeta?.total ?? 0;
  const payoutTotalPages = payoutMeta?.totalPages ?? 1;

  const tabs: AdminTab[] = [
    { key: 'overview', label: t('tabs.overview') },
    { key: 'payouts', label: t('tabs.payouts') },
  ];

  const kpis: KpiItem[] = [
    {
      label: t('kpi.totalRevenue'),
      value: stats ? formatCurrency(stats.totalAmount) : '—',
      icon: DollarSign,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: t('kpi.completedPayments'),
      value: stats?.completedPayments.toLocaleString() ?? '—',
      icon: TrendingUp,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
    },
    {
      label: t('kpi.pendingPayments'),
      value: stats?.pendingPayments.toLocaleString() ?? '—',
      icon: Clock,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      highlight: (stats?.pendingPayments ?? 0) > 0,
    },
    {
      label: t('kpi.failedPayments'),
      value: stats?.failedPayments.toLocaleString() ?? '—',
      icon: AlertCircle,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      highlight: (stats?.failedPayments ?? 0) > 0,
    },
  ];

  const payoutColumns: ColumnDef<AdminPayoutSummary>[] = [
    {
      key: 'merchant',
      header: t('columns.merchant'),
      render: p => (
        <div>
          <p className='text-xs font-medium'>{p.merchantName}</p>
          <p className='text-[10px] text-muted-foreground'>{p.merchantEmail}</p>
        </div>
      ),
    },
    {
      key: 'establishment',
      header: t('columns.establishment'),
      render: p => <span className='text-xs'>{p.establishmentName ?? '—'}</span>,
    },
    {
      key: 'available',
      header: t('columns.available'),
      render: p => (
        <span className='text-xs tabular-nums font-semibold text-emerald-600'>
          {formatCurrency(p.availableBalance)}
        </span>
      ),
    },
    {
      key: 'pending',
      header: t('columns.pending'),
      render: p => (
        <span className='text-xs tabular-nums text-amber-600'>
          {formatCurrency(p.pendingBalance)}
        </span>
      ),
    },
    {
      key: 'currency',
      header: t('columns.currency'),
      render: p => (
        <span
          className={cn(
            'inline-flex rounded-full border px-sm py-xxs text-[10px] font-semibold',
            'bg-muted text-muted-foreground',
          )}
        >
          {p.currency}
        </span>
      ),
    },
  ];

  return (
    <div className='space-y-xl'>
      <AdminModuleHeader title={t('title')} subtitle={t('subtitle')} />

      <AdminKpiRow items={kpis} loading={statsLoading} />

      <Card className='border-border/60'>
        <CardContent className='p-0'>
          <AdminTabNav tabs={tabs} />
          <div className='p-lg'>
            {currentTab === 'overview' && (
              <div className='grid grid-cols-1 lg:grid-cols-2 gap-xl'>
                <Card className='border-border/60'>
                  <CardContent className='p-xl'>
                    <h3 className='text-sm font-semibold mb-lg'>{t('overview.summary')}</h3>
                    <div className='space-y-md'>
                      {[
                        {
                          label: t('overview.totalPayments'),
                          value: stats?.totalPayments.toLocaleString() ?? '—',
                        },
                        {
                          label: t('overview.totalRefunded'),
                          value: stats ? formatCurrency(stats.totalRefunded) : '—',
                        },
                        {
                          label: t('overview.averageAmount'),
                          value: stats ? formatCurrency(stats.averageAmount) : '—',
                        },
                        {
                          label: t('overview.processingFees'),
                          value: stats ? formatCurrency(stats.totalProcessingFees) : '—',
                        },
                        {
                          label: t('overview.refundedCount'),
                          value: stats?.refundedPayments.toLocaleString() ?? '—',
                        },
                      ].map(row => (
                        <div key={row.label} className='flex items-center justify-between'>
                          <span className='text-xs text-muted-foreground'>{row.label}</span>
                          <span className='text-xs font-semibold tabular-nums'>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <PaymentMethodsCard methods={stats?.paymentMethods ?? []} />
              </div>
            )}

            {currentTab === 'payouts' && (
              <AdminDataTable
                columns={payoutColumns}
                data={payouts}
                isLoading={payoutsLoading}
                page={payoutPage}
                totalPages={payoutTotalPages}
                total={payoutTotal}
                onPageChange={setPayoutPage}
                searchPlaceholder={t('searchMerchant')}
                onSearchChange={() => {}}
                emptyIcon={Store}
                emptyTitle={t('emptyPayouts.title')}
                emptyDescription={t('emptyPayouts.description')}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPaymentsPage() {
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
      <PaymentsContent />
    </Suspense>
  );
}
