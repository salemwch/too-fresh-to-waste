'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ShoppingBag,
  AlertTriangle,
  RotateCcw,
  DollarSign,
  Eye,
  Ban,
  MoreHorizontal,
  Clock,
  CheckCircle2,
  XCircle,
  MapPin,
  User,
  Store,
  Hash,
  Calendar,
  CreditCard,
  Copy,
  MessageSquare,
} from 'lucide-react';
import {
  Card,
  CardContent,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  SheetTitle,
  Separator,
  Avatar,
  AvatarFallback,
} from '@foodwaste/ui';
import { AdminModuleHeader } from '@/components/dashboard/admin/admin-module-header';
import { AdminTabNav } from '@/components/dashboard/admin/admin-tab-nav';
import { AdminKpiRow } from '@/components/dashboard/admin/admin-kpi-row';
import { AdminDataTable, type ColumnDef } from '@/components/dashboard/admin/admin-data-table';
import { ConfirmActionDialog } from '@/components/dashboard/admin/confirm-action-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { KpiItem } from '@/components/dashboard/admin/admin-kpi-row';
import type { AdminTab } from '@/components/dashboard/admin/admin-tab-nav';
import type { AnalyticsPeriod } from '@/types/admin';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  orderNumber: string;
  customer: { name: string; email: string };
  merchant: { name: string; establishment: string };
  status: 'pending' | 'confirmed' | 'ready' | 'completed' | 'cancelled' | 'expired' | 'disputed';
  amount: number;
  paymentMethod: 'cash' | 'online';
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'failed';
  items: number;
  createdAt: string;
  pickupTime?: string;
  disputeReason?: string;
  refundAmount?: number;
}

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_ORDERS: OrderItem[] = [
  {
    id: '1',
    orderNumber: 'ORD-2026-001234',
    customer: { name: 'Ahmed Ben Ali', email: 'ahmed@example.com' },
    merchant: { name: 'Boulangerie Sfax', establishment: 'Downtown Branch' },
    status: 'completed',
    amount: 12.5,
    paymentMethod: 'online',
    paymentStatus: 'paid',
    items: 2,
    createdAt: '2026-07-18T10:30:00Z',
    pickupTime: '2026-07-18T11:00:00Z',
  },
  {
    id: '2',
    orderNumber: 'ORD-2026-001235',
    customer: { name: 'Fatma Trabelsi', email: 'fatma@example.com' },
    merchant: { name: 'Patisserie Tunis', establishment: 'Main Store' },
    status: 'disputed',
    amount: 8.0,
    paymentMethod: 'online',
    paymentStatus: 'paid',
    items: 1,
    createdAt: '2026-07-17T14:20:00Z',
    disputeReason: 'Items were not as described in the offer',
  },
  {
    id: '3',
    orderNumber: 'ORD-2026-001236',
    customer: { name: 'Mohamed Khelifi', email: 'mohamed@example.com' },
    merchant: { name: 'Restaurant El Walima', establishment: 'Sousse' },
    status: 'cancelled',
    amount: 15.0,
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    items: 3,
    createdAt: '2026-07-17T09:15:00Z',
  },
  {
    id: '4',
    orderNumber: 'ORD-2026-001237',
    customer: { name: 'Leila Gharbi', email: 'leila@example.com' },
    merchant: { name: 'Superette Bizerte', establishment: 'Centre Ville' },
    status: 'confirmed',
    amount: 6.5,
    paymentMethod: 'online',
    paymentStatus: 'paid',
    items: 1,
    createdAt: '2026-07-18T08:45:00Z',
    pickupTime: '2026-07-18T12:00:00Z',
  },
  {
    id: '5',
    orderNumber: 'ORD-2026-001238',
    customer: { name: 'Youssef Mansour', email: 'youssef@example.com' },
    merchant: { name: 'Boulangerie Sfax', establishment: 'Downtown Branch' },
    status: 'expired',
    amount: 10.0,
    paymentMethod: 'online',
    paymentStatus: 'refunded',
    items: 2,
    createdAt: '2026-07-16T16:00:00Z',
    refundAmount: 10.0,
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

function getOrderStatusColor(status: OrderItem['status']) {
  const map: Record<OrderItem['status'], string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    confirmed: 'bg-sky-50 text-sky-700 border-sky-200',
    ready: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
    expired: 'bg-gray-100 text-gray-500 border-gray-200',
    disputed: 'bg-orange-50 text-orange-700 border-orange-200',
  };
  return map[status];
}

function getPaymentStatusIcon(status: OrderItem['paymentStatus']) {
  switch (status) {
    case 'paid':
      return <CheckCircle2 className='size-3.5 text-emerald-600' />;
    case 'refunded':
      return <RotateCcw className='size-3.5 text-sky-600' />;
    case 'failed':
      return <XCircle className='size-3.5 text-rose-600' />;
    default:
      return <Clock className='size-3.5 text-amber-600' />;
  }
}

// ─── Order Detail Drawer ─────────────────────────────────────────────────────

function OrderDetailDrawer({
  order,
  open,
  onClose,
}: {
  order: OrderItem | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!order) return null;

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-xl'>
        <SheetTitle className='sr-only'>Order Details</SheetTitle>

        <div className='space-y-0'>
          {/* Header */}
          <div className='-mx-6 -mt-6 mb-0 border-b border-border/60 bg-muted/20 px-6 pb-5 pt-5 pe-14'>
            <div className='flex items-start justify-between gap-3'>
              <div>
                <p className='text-base font-semibold'>{order.orderNumber}</p>
                <p className='mt-0.5 text-xs text-muted-foreground'>
                  {new Date(order.createdAt).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize',
                  getOrderStatusColor(order.status),
                )}
              >
                {order.status}
              </span>
            </div>
            <div className='mt-3 flex gap-2'>
              <div className='flex-1 rounded-lg bg-background/60 border border-border/40 px-3 py-2 text-center'>
                <p className='text-lg font-bold tabular-nums'>{formatCurrency(order.amount)}</p>
                <p className='text-[10px] text-muted-foreground'>Amount</p>
              </div>
              <div className='flex-1 rounded-lg bg-background/60 border border-border/40 px-3 py-2 text-center'>
                <p className='text-lg font-bold tabular-nums'>{order.items}</p>
                <p className='text-[10px] text-muted-foreground'>Items</p>
              </div>
              <div className='flex-1 rounded-lg bg-background/60 border border-border/40 px-3 py-2 text-center'>
                <div className='flex items-center justify-center gap-1'>
                  {getPaymentStatusIcon(order.paymentStatus)}
                  <p className='text-sm font-semibold capitalize'>{order.paymentStatus}</p>
                </div>
                <p className='text-[10px] text-muted-foreground'>Payment</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className='space-y-5 px-0 py-5'>
            {/* Customer */}
            <section className='space-y-3'>
              <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                Customer
              </h3>
              <div className='flex items-center gap-3 rounded-lg border border-border/60 p-3'>
                <Avatar className='size-9'>
                  <AvatarFallback className='text-xs'>
                    {order.customer.name
                      .split(' ')
                      .map(n => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div className='min-w-0 flex-1'>
                  <p className='text-sm font-medium'>{order.customer.name}</p>
                  <p className='text-xs text-muted-foreground'>{order.customer.email}</p>
                </div>
              </div>
            </section>

            {/* Merchant */}
            <section className='space-y-3'>
              <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                Merchant
              </h3>
              <div className='flex items-center gap-3 rounded-lg border border-border/60 p-3'>
                <div className='size-9 rounded-lg bg-primary/10 grid place-items-center'>
                  <Store className='size-4 text-primary' />
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='text-sm font-medium'>{order.merchant.name}</p>
                  <p className='text-xs text-muted-foreground'>{order.merchant.establishment}</p>
                </div>
              </div>
            </section>

            <Separator />

            {/* Order Details */}
            <section className='space-y-3'>
              <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                Details
              </h3>
              <div className='space-y-2.5'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-1.5 text-muted-foreground'>
                    <Hash className='size-3' />
                    <span className='text-xs'>Order ID</span>
                  </div>
                  <div className='flex items-center gap-1.5'>
                    <span className='font-mono text-[11px] text-muted-foreground'>
                      ...{order.id.slice(-8)}
                    </span>
                    <button
                      onClick={() => void navigator.clipboard.writeText(order.id)}
                      className='text-muted-foreground hover:text-foreground transition-colors'
                      aria-label='Copy order ID'
                    >
                      <Copy className='size-3' />
                    </button>
                  </div>
                </div>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-1.5 text-muted-foreground'>
                    <CreditCard className='size-3' />
                    <span className='text-xs'>Payment Method</span>
                  </div>
                  <span className='text-xs font-medium capitalize'>{order.paymentMethod}</span>
                </div>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-1.5 text-muted-foreground'>
                    <Calendar className='size-3' />
                    <span className='text-xs'>Created</span>
                  </div>
                  <span className='text-xs font-medium'>
                    {new Date(order.createdAt).toLocaleString('en-GB')}
                  </span>
                </div>
                {order.pickupTime && (
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-1.5 text-muted-foreground'>
                      <MapPin className='size-3' />
                      <span className='text-xs'>Pickup Time</span>
                    </div>
                    <span className='text-xs font-medium'>
                      {new Date(order.pickupTime).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Dispute info */}
            {order.disputeReason && (
              <>
                <Separator />
                <section className='space-y-3'>
                  <h3 className='text-xs font-semibold uppercase tracking-wide text-orange-600'>
                    Dispute
                  </h3>
                  <div className='rounded-lg border border-orange-200 bg-orange-50/50 p-3'>
                    <div className='flex items-start gap-2'>
                      <MessageSquare className='size-4 text-orange-600 mt-0.5 shrink-0' />
                      <p className='text-xs text-orange-800'>{order.disputeReason}</p>
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* Refund info */}
            {order.refundAmount !== undefined && order.refundAmount > 0 && (
              <>
                <Separator />
                <section className='space-y-3'>
                  <h3 className='text-xs font-semibold uppercase tracking-wide text-sky-600'>
                    Refund
                  </h3>
                  <div className='rounded-lg border border-sky-200 bg-sky-50/50 p-3'>
                    <div className='flex items-center justify-between'>
                      <span className='text-xs text-sky-800'>Refund Amount</span>
                      <span className='text-sm font-bold text-sky-700'>
                        {formatCurrency(order.refundAmount)}
                      </span>
                    </div>
                  </div>
                </section>
              </>
            )}

            <Separator />

            {/* Admin Actions */}
            <section className='space-y-3'>
              <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                Actions
              </h3>
              <div className='flex flex-wrap gap-2'>
                {order.status === 'disputed' && (
                  <Button size='sm' className='h-8 text-xs'>
                    <CheckCircle2 className='me-1.5 size-3.5' />
                    Resolve Dispute
                  </Button>
                )}
                {(order.status === 'confirmed' || order.status === 'pending') && (
                  <Button
                    size='sm'
                    variant='outline'
                    className='h-8 text-xs text-rose-600 border-rose-200 hover:bg-rose-50'
                  >
                    <Ban className='me-1.5 size-3.5' />
                    Cancel Order
                  </Button>
                )}
                {order.paymentStatus === 'paid' && order.status !== 'completed' && (
                  <Button
                    size='sm'
                    variant='outline'
                    className='h-8 text-xs text-sky-600 border-sky-200 hover:bg-sky-50'
                  >
                    <RotateCcw className='me-1.5 size-3.5' />
                    Issue Refund
                  </Button>
                )}
              </div>
            </section>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Orders Content (with searchParams) ──────────────────────────────────────

function OrdersContent() {
  const t = useTranslations('adminOrders');
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') ?? 'all';
  const [period, setPeriod] = useState<AnalyticsPeriod>('week');
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; order: OrderItem | null }>({
    open: false,
    order: null,
  });

  const tabs: AdminTab[] = [
    { key: 'all', label: t('tabs.all') },
    { key: 'disputes', label: t('tabs.disputes'), badge: 1 },
    { key: 'refunds', label: t('tabs.refunds') },
  ];

  const filteredOrders = MOCK_ORDERS.filter(order => {
    if (currentTab === 'disputes') return order.status === 'disputed';
    if (currentTab === 'refunds')
      return order.paymentStatus === 'refunded' || order.refundAmount !== undefined;
    return true;
  });

  const kpis: KpiItem[] = [
    {
      label: t('kpi.totalOrders'),
      value: MOCK_ORDERS.length.toString(),
      icon: ShoppingBag,
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
    },
    {
      label: t('kpi.activeOrders'),
      value: MOCK_ORDERS.filter(
        o => o.status === 'confirmed' || o.status === 'pending',
      ).length.toString(),
      icon: Clock,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      label: t('kpi.disputeRate'),
      value: `${((MOCK_ORDERS.filter(o => o.status === 'disputed').length / MOCK_ORDERS.length) * 100).toFixed(1)}%`,
      icon: AlertTriangle,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      highlight: MOCK_ORDERS.some(o => o.status === 'disputed'),
    },
    {
      label: t('kpi.totalRevenue'),
      value: formatCurrency(MOCK_ORDERS.reduce((s, o) => s + o.amount, 0)),
      icon: DollarSign,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
  ];

  const columns: ColumnDef<OrderItem>[] = [
    {
      key: 'orderNumber',
      header: t('columns.order'),
      render: order => (
        <div>
          <p className='text-xs font-semibold tabular-nums'>{order.orderNumber}</p>
          <p className='text-[10px] text-muted-foreground'>{relativeDate(order.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: t('columns.customer'),
      render: order => (
        <div className='flex items-center gap-2'>
          <User className='size-3.5 text-muted-foreground shrink-0' />
          <span className='text-xs truncate max-w-[120px]'>{order.customer.name}</span>
        </div>
      ),
    },
    {
      key: 'merchant',
      header: t('columns.merchant'),
      render: order => (
        <div className='flex items-center gap-2'>
          <Store className='size-3.5 text-muted-foreground shrink-0' />
          <span className='text-xs truncate max-w-[120px]'>{order.merchant.name}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('columns.status'),
      render: order => (
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize',
            getOrderStatusColor(order.status),
          )}
        >
          {order.status}
        </span>
      ),
    },
    {
      key: 'amount',
      header: t('columns.amount'),
      render: order => (
        <span className='text-xs font-semibold tabular-nums'>{formatCurrency(order.amount)}</span>
      ),
    },
    {
      key: 'payment',
      header: t('columns.payment'),
      render: order => (
        <div className='flex items-center gap-1.5'>
          {getPaymentStatusIcon(order.paymentStatus)}
          <span className='text-xs capitalize'>{order.paymentMethod}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: order => (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='sm' className='h-7 w-7 p-0'>
              <MoreHorizontal className='size-3.5' />
              <span className='sr-only'>Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-36'>
            <DropdownMenuItem onClick={() => setSelectedOrder(order)}>
              <Eye className='me-2 size-3.5' />
              {t('actions.viewDetails')}
            </DropdownMenuItem>
            {(order.status === 'pending' || order.status === 'confirmed') && (
              <DropdownMenuItem
                className='text-rose-600'
                onClick={() => setCancelDialog({ open: true, order })}
              >
                <Ban className='me-2 size-3.5' />
                {t('actions.cancel')}
              </DropdownMenuItem>
            )}
            {order.paymentStatus === 'paid' && (
              <DropdownMenuItem className='text-sky-600'>
                <RotateCcw className='me-2 size-3.5' />
                {t('actions.refund')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
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
        exportLabel={t('export')}
      />

      <AdminKpiRow items={kpis} />

      <Card className='border-border/60'>
        <CardContent className='p-0'>
          <AdminTabNav tabs={tabs} />

          <div className='p-4'>
            <AdminDataTable
              columns={columns}
              data={filteredOrders}
              isLoading={false}
              page={1}
              totalPages={1}
              total={filteredOrders.length}
              onPageChange={() => {}}
              searchPlaceholder={t('searchPlaceholder')}
              onSearchChange={() => {}}
              onRowClick={row => setSelectedOrder(row)}
              emptyIcon={ShoppingBag}
              emptyTitle={t('empty.title')}
              emptyDescription={t('empty.description')}
            />
          </div>
        </CardContent>
      </Card>

      <OrderDetailDrawer
        order={selectedOrder}
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />

      {cancelDialog.order && (
        <ConfirmActionDialog
          open={cancelDialog.open}
          onOpenChange={open => !open && setCancelDialog({ open: false, order: null })}
          title={t('cancelDialog.title')}
          description={t('cancelDialog.description')}
          confirmLabel={t('actions.cancel')}
          variant='danger'
          isLoading={false}
          onConfirm={() => setCancelDialog({ open: false, order: null })}
          reasonConfig={{
            label: t('cancelDialog.reasonLabel'),
            placeholder: t('cancelDialog.reasonPlaceholder'),
            required: true,
          }}
        />
      )}
    </div>
  );
}

// ─── Page (Suspense boundary for searchParams) ───────────────────────────────

export default function AdminOrdersPage() {
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
      <OrdersContent />
    </Suspense>
  );
}
