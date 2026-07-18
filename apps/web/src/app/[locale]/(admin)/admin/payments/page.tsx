'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Wallet,
  DollarSign,
  CreditCard,
  Clock,
  Eye,
  Store,
  User,
  Webhook,
  Calendar,
  Copy,
  TrendingUp,
} from 'lucide-react';
import {
  Card,
  CardContent,
  Button,
  Sheet,
  SheetContent,
  SheetTitle,
  Separator,
} from '@foodwaste/ui';
import { AdminModuleHeader } from '@/components/dashboard/admin/admin-module-header';
import { AdminTabNav, type AdminTab } from '@/components/dashboard/admin/admin-tab-nav';
import { AdminKpiRow, type KpiItem } from '@/components/dashboard/admin/admin-kpi-row';
import { AdminDataTable, type ColumnDef } from '@/components/dashboard/admin/admin-data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { AnalyticsPeriod } from '@/types/admin';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  commission: number;
  netAmount: number;
  paymentMethod: 'konnect' | 'cash';
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  webhookStatus: 'received' | 'pending' | 'failed' | 'not_applicable';
  konnectRef?: string;
  customer: string;
  merchant: string;
  createdAt: string;
}

interface MerchantPayout {
  id: string;
  merchantName: string;
  establishment: string;
  totalEarned: number;
  commission: number;
  netPayout: number;
  pendingOrders: number;
  lastPayoutDate?: string;
  status: 'paid' | 'pending' | 'overdue';
}

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'txn_001',
    orderId: 'ord_001',
    orderNumber: 'ORD-2026-001234',
    amount: 12.5,
    commission: 1.25,
    netAmount: 11.25,
    paymentMethod: 'konnect',
    status: 'completed',
    webhookStatus: 'received',
    konnectRef: 'KNT-ABC123',
    customer: 'Ahmed Ben Ali',
    merchant: 'Boulangerie Sfax',
    createdAt: '2026-07-18T10:30:00Z',
  },
  {
    id: 'txn_002',
    orderId: 'ord_002',
    orderNumber: 'ORD-2026-001235',
    amount: 8.0,
    commission: 0.8,
    netAmount: 7.2,
    paymentMethod: 'konnect',
    status: 'pending',
    webhookStatus: 'pending',
    konnectRef: 'KNT-DEF456',
    customer: 'Fatma Trabelsi',
    merchant: 'Patisserie Tunis',
    createdAt: '2026-07-17T14:20:00Z',
  },
  {
    id: 'txn_003',
    orderId: 'ord_003',
    orderNumber: 'ORD-2026-001236',
    amount: 15.0,
    commission: 0,
    netAmount: 15.0,
    paymentMethod: 'cash',
    status: 'completed',
    webhookStatus: 'not_applicable',
    customer: 'Mohamed Khelifi',
    merchant: 'Restaurant El Walima',
    createdAt: '2026-07-17T09:15:00Z',
  },
  {
    id: 'txn_004',
    orderId: 'ord_004',
    orderNumber: 'ORD-2026-001237',
    amount: 6.5,
    commission: 0.65,
    netAmount: 5.85,
    paymentMethod: 'konnect',
    status: 'failed',
    webhookStatus: 'failed',
    konnectRef: 'KNT-GHI789',
    customer: 'Leila Gharbi',
    merchant: 'Superette Bizerte',
    createdAt: '2026-07-18T08:45:00Z',
  },
];

const MOCK_PAYOUTS: MerchantPayout[] = [
  {
    id: 'p1',
    merchantName: 'Boulangerie Sfax',
    establishment: 'Downtown Branch',
    totalEarned: 450.0,
    commission: 45.0,
    netPayout: 405.0,
    pendingOrders: 3,
    lastPayoutDate: '2026-07-15T00:00:00Z',
    status: 'pending',
  },
  {
    id: 'p2',
    merchantName: 'Patisserie Tunis',
    establishment: 'Main Store',
    totalEarned: 280.0,
    commission: 28.0,
    netPayout: 252.0,
    pendingOrders: 0,
    lastPayoutDate: '2026-07-10T00:00:00Z',
    status: 'paid',
  },
  {
    id: 'p3',
    merchantName: 'Restaurant El Walima',
    establishment: 'Sousse',
    totalEarned: 620.0,
    commission: 62.0,
    netPayout: 558.0,
    pendingOrders: 5,
    status: 'overdue',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(v: number) {
  return `${v.toFixed(2)} TND`;
}

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function getWebhookBadge(status: Transaction['webhookStatus']) {
  const styles = {
    received: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    failed: 'bg-rose-50 text-rose-700 border-rose-200',
    not_applicable: 'bg-gray-100 text-gray-500 border-gray-200',
  };
  const labels = {
    received: 'Received',
    pending: 'Pending',
    failed: 'Failed',
    not_applicable: 'N/A',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
        styles[status],
      )}
    >
      <Webhook className='size-3' />
      {labels[status]}
    </span>
  );
}

function getPaymentStatusStyle(status: Transaction['status']) {
  const map = {
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    failed: 'bg-rose-50 text-rose-700 border-rose-200',
    refunded: 'bg-sky-50 text-sky-700 border-sky-200',
  };
  return map[status];
}

// ─── Detail Drawer ───────────────────────────────────────────────────────────

function TransactionDrawer({
  txn,
  open,
  onClose,
}: {
  txn: Transaction | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!txn) return null;
  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-xl'>
        <SheetTitle className='sr-only'>Transaction Details</SheetTitle>
        <div className='space-y-0'>
          <div className='-mx-6 -mt-6 mb-0 border-b border-border/60 bg-muted/20 px-6 pb-5 pt-5 pe-14'>
            <div className='flex items-start justify-between'>
              <div>
                <p className='text-base font-semibold'>{txn.orderNumber}</p>
                <p className='mt-0.5 text-xs text-muted-foreground'>
                  {new Date(txn.createdAt).toLocaleString('en-GB')}
                </p>
              </div>
              <span
                className={cn(
                  'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize',
                  getPaymentStatusStyle(txn.status),
                )}
              >
                {txn.status}
              </span>
            </div>
            <div className='mt-3 grid grid-cols-3 gap-2'>
              <div className='rounded-lg bg-background/60 border border-border/40 px-3 py-2 text-center'>
                <p className='text-lg font-bold tabular-nums'>{formatCurrency(txn.amount)}</p>
                <p className='text-[10px] text-muted-foreground'>Total</p>
              </div>
              <div className='rounded-lg bg-background/60 border border-border/40 px-3 py-2 text-center'>
                <p className='text-lg font-bold tabular-nums text-amber-600'>
                  {formatCurrency(txn.commission)}
                </p>
                <p className='text-[10px] text-muted-foreground'>Commission</p>
              </div>
              <div className='rounded-lg bg-background/60 border border-border/40 px-3 py-2 text-center'>
                <p className='text-lg font-bold tabular-nums text-emerald-600'>
                  {formatCurrency(txn.netAmount)}
                </p>
                <p className='text-[10px] text-muted-foreground'>Net</p>
              </div>
            </div>
          </div>

          <div className='space-y-5 py-5'>
            <section className='space-y-2.5'>
              <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                Details
              </h3>
              {[
                { label: 'Customer', value: txn.customer, icon: User },
                { label: 'Merchant', value: txn.merchant, icon: Store },
                {
                  label: 'Payment Method',
                  value: txn.paymentMethod === 'konnect' ? 'Konnect (Online)' : 'Cash',
                  icon: CreditCard,
                },
                {
                  label: 'Created',
                  value: new Date(txn.createdAt).toLocaleString('en-GB'),
                  icon: Calendar,
                },
              ].map(row => (
                <div key={row.label} className='flex items-center justify-between'>
                  <div className='flex items-center gap-1.5 text-muted-foreground'>
                    <row.icon className='size-3' />
                    <span className='text-xs'>{row.label}</span>
                  </div>
                  <span className='text-xs font-medium'>{row.value}</span>
                </div>
              ))}
            </section>

            <Separator />

            <section className='space-y-2.5'>
              <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                Webhook Status
              </h3>
              <div className='rounded-lg border border-border/60 p-3'>
                <div className='flex items-center justify-between'>
                  <span className='text-xs text-muted-foreground'>Status</span>
                  {getWebhookBadge(txn.webhookStatus)}
                </div>
                {txn.konnectRef && (
                  <div className='flex items-center justify-between mt-2'>
                    <span className='text-xs text-muted-foreground'>Konnect Ref</span>
                    <div className='flex items-center gap-1.5'>
                      <span className='font-mono text-[11px]'>{txn.konnectRef}</span>
                      <button
                        onClick={() => void navigator.clipboard.writeText(txn.konnectRef!)}
                        className='text-muted-foreground hover:text-foreground'
                        aria-label='Copy ref'
                      >
                        <Copy className='size-3' />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Content ─────────────────────────────────────────────────────────────────

function PaymentsContent() {
  const t = useTranslations('adminPayments');
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') ?? 'transactions';
  const [period, setPeriod] = useState<AnalyticsPeriod>('week');
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);

  const tabs: AdminTab[] = [
    { key: 'transactions', label: t('tabs.transactions') },
    {
      key: 'payouts',
      label: t('tabs.payouts'),
      badge: MOCK_PAYOUTS.filter(p => p.status === 'overdue').length,
    },
    { key: 'revenue', label: t('tabs.revenue') },
  ];

  const totalRevenue = MOCK_TRANSACTIONS.reduce((s, t) => s + t.amount, 0);
  const totalCommission = MOCK_TRANSACTIONS.reduce((s, t) => s + t.commission, 0);

  const kpis: KpiItem[] = [
    {
      label: t('kpi.totalRevenue'),
      value: formatCurrency(totalRevenue),
      icon: DollarSign,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: t('kpi.commission'),
      value: formatCurrency(totalCommission),
      icon: TrendingUp,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
    },
    {
      label: t('kpi.pendingPayouts'),
      value: formatCurrency(
        MOCK_PAYOUTS.filter(p => p.status !== 'paid').reduce((s, p) => s + p.netPayout, 0),
      ),
      icon: Clock,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      highlight: true,
    },
    {
      label: t('kpi.paymentMethods'),
      value: '2',
      icon: CreditCard,
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
    },
  ];

  const txnColumns: ColumnDef<Transaction>[] = [
    {
      key: 'order',
      header: t('columns.order'),
      render: txn => (
        <div>
          <p className='text-xs font-semibold tabular-nums'>{txn.orderNumber}</p>
          <p className='text-[10px] text-muted-foreground'>{relativeDate(txn.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: t('columns.customer'),
      render: txn => <span className='text-xs'>{txn.customer}</span>,
    },
    {
      key: 'merchant',
      header: t('columns.merchant'),
      render: txn => <span className='text-xs'>{txn.merchant}</span>,
    },
    {
      key: 'amount',
      header: t('columns.amount'),
      render: txn => (
        <span className='text-xs font-semibold tabular-nums'>{formatCurrency(txn.amount)}</span>
      ),
    },
    {
      key: 'commission',
      header: t('columns.commission'),
      render: txn => (
        <span className='text-xs tabular-nums text-amber-600'>
          {formatCurrency(txn.commission)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('columns.status'),
      render: txn => (
        <span
          className={cn(
            'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize',
            getPaymentStatusStyle(txn.status),
          )}
        >
          {txn.status}
        </span>
      ),
    },
    {
      key: 'webhook',
      header: t('columns.webhook'),
      render: txn => getWebhookBadge(txn.webhookStatus),
    },
    {
      key: 'actions',
      header: '',
      render: txn => (
        <Button
          variant='ghost'
          size='sm'
          className='h-7 w-7 p-0'
          onClick={() => setSelectedTxn(txn)}
        >
          <Eye className='size-3.5' />
          <span className='sr-only'>View</span>
        </Button>
      ),
    },
  ];

  const payoutColumns: ColumnDef<MerchantPayout>[] = [
    {
      key: 'merchant',
      header: t('columns.merchant'),
      render: p => (
        <div>
          <p className='text-xs font-medium'>{p.merchantName}</p>
          <p className='text-[10px] text-muted-foreground'>{p.establishment}</p>
        </div>
      ),
    },
    {
      key: 'earned',
      header: t('columns.totalEarned'),
      render: p => (
        <span className='text-xs tabular-nums font-medium'>{formatCurrency(p.totalEarned)}</span>
      ),
    },
    {
      key: 'commission',
      header: t('columns.commission'),
      render: p => (
        <span className='text-xs tabular-nums text-amber-600'>{formatCurrency(p.commission)}</span>
      ),
    },
    {
      key: 'net',
      header: t('columns.netPayout'),
      render: p => (
        <span className='text-xs tabular-nums font-semibold text-emerald-600'>
          {formatCurrency(p.netPayout)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('columns.status'),
      render: p => {
        const styles = {
          paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          pending: 'bg-amber-50 text-amber-700 border-amber-200',
          overdue: 'bg-rose-50 text-rose-700 border-rose-200',
        };
        return (
          <span
            className={cn(
              'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize',
              styles[p.status],
            )}
          >
            {p.status}
          </span>
        );
      },
    },
    {
      key: 'lastPayout',
      header: t('columns.lastPayout'),
      render: p => (
        <span className='text-xs text-muted-foreground'>
          {p.lastPayoutDate ? new Date(p.lastPayoutDate).toLocaleDateString('en-GB') : 'Never'}
        </span>
      ),
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
      />

      <AdminKpiRow items={kpis} />

      <Card className='border-border/60'>
        <CardContent className='p-0'>
          <AdminTabNav tabs={tabs} />
          <div className='p-4'>
            {currentTab === 'transactions' && (
              <AdminDataTable
                columns={txnColumns}
                data={MOCK_TRANSACTIONS}
                isLoading={false}
                page={1}
                totalPages={1}
                total={MOCK_TRANSACTIONS.length}
                onPageChange={() => {}}
                searchPlaceholder={t('searchPlaceholder')}
                onSearchChange={() => {}}
                onRowClick={row => setSelectedTxn(row)}
                emptyIcon={Wallet}
                emptyTitle={t('empty.title')}
                emptyDescription={t('empty.description')}
              />
            )}
            {currentTab === 'payouts' && (
              <AdminDataTable
                columns={payoutColumns}
                data={MOCK_PAYOUTS}
                isLoading={false}
                page={1}
                totalPages={1}
                total={MOCK_PAYOUTS.length}
                onPageChange={() => {}}
                searchPlaceholder={t('searchMerchant')}
                onSearchChange={() => {}}
                emptyIcon={Store}
                emptyTitle={t('emptyPayouts.title')}
                emptyDescription={t('emptyPayouts.description')}
              />
            )}
            {currentTab === 'revenue' && (
              <div className='flex flex-col items-center justify-center py-16 gap-3 text-center'>
                <TrendingUp className='size-12 text-muted-foreground/30' />
                <h3 className='text-md font-semibold'>{t('revenue.title')}</h3>
                <p className='text-sm text-muted-foreground max-w-xs'>{t('revenue.description')}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <TransactionDrawer
        txn={selectedTxn}
        open={!!selectedTxn}
        onClose={() => setSelectedTxn(null)}
      />
    </div>
  );
}

export default function AdminPaymentsPage() {
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
      <PaymentsContent />
    </Suspense>
  );
}
